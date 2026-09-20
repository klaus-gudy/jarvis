import { connect } from "amqplib";

import {
  contractFileName,
  LEASE_CONTRACT_TYPE_ID,
} from "@/lib/contract-constants";
import {
  deleteDocument,
  parseContractObjectKey,
  recordDocument,
} from "@/lib/documents";
import { describeError } from "@/lib/errors";
import {
  CONSUMED_ROUTING_KEY,
  DOCUMENTS_QUEUE,
  RABBITMQ_URL,
  type DocumentStoredEvent,
} from "@/lib/events/config";
import { leaseReference } from "@/lib/leases";
import { declareEventTopology } from "@/lib/events/publisher";
import { prisma } from "@/lib/prisma";

/**
 * Files the contract that `document-worker` has just rendered.
 *
 * **This process no longer renders anything.** It used to consume
 * `lease.created` and drive a headless Chromium through `lib/pdf.ts`; rendering
 * now belongs to the standalone `document-worker` service, which is the only
 * thing in the system that needs a browser installed. What is left here is the
 * half that needs the database instead: turning "the PDF is at this key" into a
 * `FileAsset` row, so a generated contract is listed, downloaded and deleted by
 * exactly the code that handles a scanned one.
 *
 * Started by `instrumentation.ts` inside the Next.js server, so a deploy of the
 * app is a deploy of the consumer and neither can be forgotten. `npm run worker`
 * still runs the same code as its own process for local debugging.
 *
 * No `npx playwright install` on this host, or any other running this app.
 */

/**
 * Set once the consumer is running in this process.
 *
 * `instrumentation.ts` runs `register()` per server instance, and dev restarts
 * it on edits — without this, every reload would open another connection and
 * the same queue would end up with a pile of consumers nobody can see.
 */
let running: Promise<StopConsumer> | null = null;

/** Closes the channel and connection this consumer opened. */
export type StopConsumer = () => Promise<void>;

/** How many completions to file at once. */
const PREFETCH = 1;

/**
 * One retry, then the dead-letter queue.
 *
 * A failure here is a database that blinked, which is usually worth one more
 * go. Anything that fails twice is almost certainly not transient, and
 * requeueing forever would spin on one poisoned message while every later
 * contract waits behind it.
 */
const MAX_ATTEMPTS = 2;

function attemptsOf(headers: Record<string, unknown> | undefined) {
  const raw = headers?.["x-attempts"];
  return typeof raw === "number" ? raw : 0;
}

/** Every field this consumer actually depends on being present. */
function isUsable(event: DocumentStoredEvent) {
  return Boolean(event.objectKey && typeof event.sizeBytes === "number");
}

/**
 * A string from `meta`, or undefined.
 *
 * `meta` is whatever came back over the bus. The renderer echoes it without
 * looking inside, so nothing between here and the producer has checked its
 * shape — a field that should be a string may be a number, an object, or
 * missing entirely, and `undefined` is the only honest answer for all three.
 */
function metaString(
  meta: DocumentStoredEvent["meta"],
  key: "organizationId" | "leaseId" | "contractNumber" | "fileName"
): string | undefined {
  const value = meta?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

/** The blank-placeholder list from `meta`, or empty. */
function metaMissing(meta: DocumentStoredEvent["meta"]): string[] {
  return Array.isArray(meta?.missing)
    ? meta.missing.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Starts filing rendered contracts, and resolves once the consumer is attached.
 *
 * Safe to call more than once: later calls get the first call's consumer rather
 * than a second one. Resolving early matters for the Next.js entry point —
 * `register()` must finish before the server takes requests, so this awaits the
 * *subscription*, never the messages.
 */
export function startDocumentConsumer(): Promise<StopConsumer> {
  running ??= attach();
  return running;
}

async function attach(): Promise<StopConsumer> {
  const model = await connect(RABBITMQ_URL, {
    recovery: { setup: declareEventTopology },
  });

  model.on("disconnect", (error) =>
    console.error("[document-worker] RabbitMQ disconnected:", error.message)
  );
  model.on("reconnect-scheduled", ({ attempt, delay }) =>
    console.warn(
      `[document-worker] RabbitMQ reconnect attempt ${attempt} in ${delay}ms`
    )
  );

  const channel = await model.createChannel();
  await channel.prefetch(PREFETCH);

  // Names the key as well as the queue: a misconfigured routing key binds
  // nothing and looks exactly like a quiet broker, so the one line this
  // process prints at startup should be enough to tell those apart.
  console.log(
    `[document-worker] consuming ${DOCUMENTS_QUEUE} ` +
      `for "${CONSUMED_ROUTING_KEY["document.stored"]}"`
  );

  await channel.consume(DOCUMENTS_QUEUE, async (message) => {
    if (!message) return;

    const attempts = attemptsOf(message.properties.headers) + 1;
    let event: DocumentStoredEvent;

    try {
      event = JSON.parse(message.content.toString()) as DocumentStoredEvent;
    } catch {
      // Unparseable will never become parseable. Straight to the DLQ, where a
      // person can look at it, rather than round and round the retry loop.
      console.error("[document-worker] dropping unparseable message");
      channel.nack(message, false, false);
      return;
    }

    if (!isUsable(event)) {
      console.error("[document-worker] dropping message with missing fields");
      channel.nack(message, false, false);
      return;
    }

    /*
     * The ids come out of the key, because the message carries none — see
     * `DocumentStoredEvent`. This app built the key, so it is the one thing
     * that can read it back. A key it does not recognise is not an error to
     * retry: it is a document this app did not ask for (another publisher's,
     * or a subject that is not a lease), and the right response is to leave it
     * alone rather than to keep trying to file it.
     */
    const subject = parseContractObjectKey(event.objectKey);

    if (!subject) {
      console.warn(
        `[document-worker] ignoring ${event.objectKey} — not a lease contract key`
      );
      channel.ack(message);
      return;
    }

    /*
     * **The key wins, not `meta`.** Both claim to say which lease this is, and
     * only one of them was built by this app — so the key decides, and `meta`
     * is checked against it. A disagreement is not something to reconcile
     * quietly: it means a producer is confused or a message was tampered with,
     * and the tenancy boundary is the last place to take a message's word for
     * it. Said out loud, then ignored in favour of the key.
     */
    const { organizationId, leaseId } = subject;
    const label = `lease ${leaseId} (org ${organizationId})`;

    const claimedOrg = metaString(event.meta, "organizationId");
    const claimedLease = metaString(event.meta, "leaseId");
    const metaAgrees =
      (!claimedOrg || claimedOrg === organizationId) &&
      (!claimedLease || claimedLease === leaseId);

    /*
     * A `meta` that is wrong about which lease it belongs to is discarded
     * **whole**, not just corrected on the two fields that were checked.
     *
     * The alternative — keep the key's ids but still take the file name from
     * the same block that just lied about them — trusts a source exactly as
     * far as the fields that happen to be verifiable, which is not a rule that
     * survives contact with a confused producer. Nothing in `meta` is load
     * bearing, so throwing all of it away costs a label and a log line.
     */
    const meta = metaAgrees ? event.meta : undefined;

    if (!metaAgrees) {
      console.warn(
        `[document-worker] meta disagrees with the object key for ${label} — ` +
          `meta says lease ${claimedLease} (org ${claimedOrg}); ` +
          `discarding it and deriving from the key`
      );
    }

    /*
     * The file name is cosmetic — a `Content-Disposition` and a table cell —
     * so a `meta` that agrees with the key is allowed to supply it. It is
     * still only a preference: the contract number is a pure function of the
     * lease id, so the fallback is exact rather than a guess, and a message
     * that predates `meta` or lost it files a correctly-named contract anyway.
     */
    const fileName =
      metaString(meta, "fileName") ?? contractFileName(leaseReference(leaseId));
    const missing = metaMissing(meta);

    try {
      /*
       * The previous contract goes first. `sys_LEASE_CONTRACT` is not a
       * collection — one contract per lease — so a regenerated one replaces
       * rather than accumulates. Deleted through `deleteDocument` rather than a
       * raw query, so the object in the bucket goes with the row.
       *
       * Scoped to rows that are *not* the key we are about to file, so a
       * redelivery cannot delete the very contract it already recorded.
       */
      const previous = await prisma.fileAsset.findFirst({
        where: {
          organizationId,
          leaseId,
          assetTypeId: LEASE_CONTRACT_TYPE_ID,
          objectKey: { not: event.objectKey },
        },
        select: { id: true },
      });
      if (previous) await deleteDocument(organizationId, previous.id);

      const result = await recordDocument(
        organizationId,
        {
          assetTypeId: LEASE_CONTRACT_TYPE_ID,
          subjectType: "LEASE",
          subjectId: leaseId,
        },
        {
          objectKey: event.objectKey,
          name: fileName,
          type: "application/pdf",
          sizeBytes: event.sizeBytes,
        }
      );

      if ("error" in result) {
        // None of these fix themselves on a retry: a lease that no longer
        // exists is gone, and a key whose organization does not own the lease
        // is a forged or broken producer. Acked so the queue moves on, and
        // said out loud rather than swallowed.
        console.error(
          `[document-worker] refusing ${event.objectKey} for ${label}: ${result.error}`
        );
        channel.ack(message);
        return;
      }

      if (result.duplicate) {
        console.log(
          `[document-worker] ${fileName} for ${label} was already filed — ignoring redelivery`
        );
        channel.ack(message);
        return;
      }

      const blanks = missing.length
        ? ` — ${missing.length} placeholder(s) had no data: ${missing.join(", ")}`
        : "";
      console.log(
        `[document-worker] filed ${fileName} for ${label} — ${event.sizeBytes} bytes${blanks}`
      );
      channel.ack(message);
    } catch (cause) {
      const reason = describeError(cause);
      console.error(
        `[document-worker] attempt ${attempts}/${MAX_ATTEMPTS} failed for ${label}: ${reason}`
      );

      if (attempts >= MAX_ATTEMPTS) {
        channel.nack(message, false, false);
        return;
      }

      // Republished rather than `nack(requeue: true)`, so the attempt count
      // travels with the message — a requeued delivery looks brand new, and
      // the retry would never terminate.
      channel.publish("", DOCUMENTS_QUEUE, message.content, {
        ...message.properties,
        headers: { ...message.properties.headers, "x-attempts": attempts },
      });
      channel.ack(message);
    }
  });

  return async () => {
    try {
      await channel.close();
      await model.close();
    } catch {
      // Already closing.
    }
    // Deliberately no `prisma.$disconnect()`: this is the shared singleton, and
    // in the Next.js server it belongs to the request path too. Disconnecting
    // it here would close the web app's pool. The CLI shim owns that instead.
    running = null;
  };
}
