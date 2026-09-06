import "dotenv/config";

import { connect } from "amqplib";

import { describeError, generateAndStoreContract } from "@/lib/contracts";
import {
  CONTRACT_QUEUE,
  RABBITMQ_URL,
  type LeaseCreatedEvent,
} from "@/lib/events/config";
import { declareEventTopology } from "@/lib/events/publisher";
import { closePdfBrowser } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";

/**
 * Generates a lease contract whenever one is signed.
 *
 * A separate process, not a call inside `POST /api/leases`, for two reasons
 * the user named directly: signing a lease must not wait on a browser
 * launching, and it must not fail because object storage is briefly down. The
 * lease is committed, `lease.created` goes on the bus, and whatever happens
 * next happens on its own time — including "the worker was off for an hour",
 * which a durable queue turns into an hour's delay rather than an hour of
 * leases with no contract.
 *
 * It is also where **Chromium lives**. `lib/pdf.ts` needs a ~100MB browser;
 * keeping the only caller in this process means the web app never has to have
 * one installed. Run it alongside `next start`:
 *
 *   npm run worker
 *
 * Requires `npx playwright install chromium` once on the host.
 */

/** How many contracts to render at once. */
const PREFETCH = 1;

/**
 * One retry, then the dead-letter queue.
 *
 * A rendering or storage failure is usually transient (a browser that died, a
 * bucket that blinked) and worth one more go. Anything that fails twice is
 * almost certainly not transient, and requeueing it forever would spin the CPU
 * on one poisoned message while every later lease waits behind it.
 */
const MAX_ATTEMPTS = 2;

function attemptsOf(headers: Record<string, unknown> | undefined) {
  const raw = headers?.["x-attempts"];
  return typeof raw === "number" ? raw : 0;
}

async function main() {
  const model = await connect(RABBITMQ_URL, {
    recovery: { setup: declareEventTopology },
  });

  model.on("disconnect", (error) =>
    console.error("[contract-worker] RabbitMQ disconnected:", error.message)
  );
  model.on("reconnect-scheduled", ({ attempt, delay }) =>
    console.warn(
      `[contract-worker] RabbitMQ reconnect attempt ${attempt} in ${delay}ms`
    )
  );

  const channel = await model.createChannel();
  await channel.prefetch(PREFETCH);

  console.log(`[contract-worker] consuming ${CONTRACT_QUEUE}`);

  await channel.consume(CONTRACT_QUEUE, async (message) => {
    if (!message) return;

    const attempts = attemptsOf(message.properties.headers) + 1;
    let event: LeaseCreatedEvent;

    try {
      event = JSON.parse(message.content.toString()) as LeaseCreatedEvent;
    } catch {
      // Unparseable will never become parseable. Straight to the DLQ, where a
      // person can look at it, rather than round and round the retry loop.
      console.error("[contract-worker] dropping unparseable message");
      channel.nack(message, false, false);
      return;
    }

    if (!event.organizationId || !event.leaseId) {
      console.error("[contract-worker] dropping message with no ids");
      channel.nack(message, false, false);
      return;
    }

    const label = `${event.leaseId} (org ${event.organizationId})`;

    try {
      const result = await generateAndStoreContract(
        event.organizationId,
        event.leaseId
      );

      if (result.ok) {
        const blanks = result.missing.length
          ? ` — ${result.missing.length} placeholder(s) had no data: ${result.missing.join(", ")}`
          : "";
        console.log(`[contract-worker] filed ${result.fileName} for ${label}${blanks}`);
        channel.ack(message);
        return;
      }

      // A missing template or a lease that no longer exists will not fix
      // itself on a retry — the first needs someone to write a template, the
      // second is already gone. Acked so the queue moves on; the Contract tab
      // shows nothing and offers a Generate button, which is the recovery.
      if (result.reason === "no-template" || result.reason === "no-lease") {
        console.warn(`[contract-worker] skipping ${label}: ${result.message}`);
        channel.ack(message);
        return;
      }

      throw new Error(result.message);
    } catch (cause) {
      const reason = describeError(cause);
      console.error(
        `[contract-worker] attempt ${attempts}/${MAX_ATTEMPTS} failed for ${label}: ${reason}`
      );

      if (attempts >= MAX_ATTEMPTS) {
        channel.nack(message, false, false);
        return;
      }

      // Republished rather than `nack(requeue: true)`, so the attempt count
      // travels with the message — a requeued delivery looks brand new, and
      // the retry would never terminate.
      channel.publish("", CONTRACT_QUEUE, message.content, {
        ...message.properties,
        headers: { ...message.properties.headers, "x-attempts": attempts },
      });
      channel.ack(message);
    }
  });

  async function shutdown(signal: string) {
    console.log(`[contract-worker] ${signal} — shutting down`);
    try {
      await channel.close();
      await model.close();
    } catch {
      // Already closing.
    }
    await closePdfBrowser();
    await prisma.$disconnect();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[contract-worker] fatal:", error);
  process.exit(1);
});
