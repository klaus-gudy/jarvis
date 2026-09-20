import { connect } from "amqplib";

import { describeError } from "@/lib/errors";
import {
  AUTOMATIFIER_EXCHANGE,
  CONSUMED_ROUTING_KEY,
  LEASE_LIFECYCLE_QUEUE,
  RABBITMQ_URL,
  type LeaseLifecycleEvent,
} from "@/lib/events/config";
import { declareEventTopology } from "@/lib/events/publisher";
import {
  handleLeaseRenewal,
  handleLeaseVacating,
  type LifecycleOutcome,
} from "@/lib/lease-lifecycle";

/**
 * Acts on the lease lifecycle events `automatifier` publishes.
 *
 * That service runs the cron and decides *when* a lease's term is up; this
 * one owns the tables and decides *what that means* — `lease.renewal` writes
 * the successor lease, `lease.vacating` closes the tenancy.
 *
 * A separate process from `document-worker` on purpose: one is the reply to a
 * PDF this app asked for, the other is another service's clock, and a bad
 * message in either should not stop the other. Run it alongside:
 *
 *   npm run worker:leases
 */

/** One lease at a time — each message is a write, and ordering costs nothing here. */
/** See `document-consumer.ts` — one consumer per process, not one per reload. */
let running: Promise<StopConsumer> | null = null;

/** Closes the channel and connection this consumer opened. */
export type StopConsumer = () => Promise<void>;

const PREFETCH = 1;

/**
 * One retry, then the dead-letter queue — the same rule `document-worker`
 * follows. A failure here is usually a database that blinked; anything that
 * fails twice is not transient, and requeueing forever would spin on one
 * poisoned message while every later lease waits behind it.
 */
const MAX_ATTEMPTS = 2;

function attemptsOf(headers: Record<string, unknown> | undefined) {
  const raw = headers?.["x-attempts"];
  return typeof raw === "number" ? raw : 0;
}

/** The two keys this queue is bound to, as they travel on the wire. */
const RENEWAL_KEY = CONSUMED_ROUTING_KEY["lease.renewal"];
const VACATING_KEY = CONSUMED_ROUTING_KEY["lease.vacating"];

/** The lease id, or null if the message is not shaped like one of ours. */
function leaseIdOf(event: LeaseLifecycleEvent): string | null {
  const id = event?.lease?.id;
  return typeof id === "string" && id.trim() ? id : null;
}

/**
 * Starts acting on automatifier's lease lifecycle events.
 *
 * Resolves once subscribed, never waiting on messages — see
 * `startDocumentConsumer` for why that matters to `register()`.
 */
export function startLeaseConsumer(): Promise<StopConsumer> {
  running ??= attach();
  return running;
}

async function attach(): Promise<StopConsumer> {
  const model = await connect(RABBITMQ_URL, {
    recovery: { setup: declareEventTopology },
  });

  model.on("disconnect", (error) =>
    console.error("[lease-worker] RabbitMQ disconnected:", describeError(error))
  );
  model.on("reconnect-scheduled", ({ attempt, delay }) =>
    console.warn(
      `[lease-worker] RabbitMQ reconnect attempt ${attempt} in ${delay}ms`
    )
  );

  const channel = await model.createChannel();
  await channel.prefetch(PREFETCH);

  // Names the exchange as well as the keys: these come from *automatifier's*
  // exchange, and a binding that silently matches nothing looks exactly like a
  // quiet broker, so the startup line should be enough to tell them apart.
  console.log(
    `[lease-worker] consuming ${LEASE_LIFECYCLE_QUEUE} on "${AUTOMATIFIER_EXCHANGE}" ` +
      `for "${RENEWAL_KEY}" and "${VACATING_KEY}"`
  );

  await channel.consume(LEASE_LIFECYCLE_QUEUE, async (message) => {
    if (!message) return;

    const attempts = attemptsOf(message.properties.headers) + 1;
    /*
     * The key the message arrived on is the whole instruction — both events
     * carry the same body. A retry is republished straight to the queue, which
     * rewrites `fields.routingKey` to the queue's own name, so the original is
     * carried in a header and preferred when present.
     */
    const originalKey = message.properties.headers?.["x-original-routing-key"];
    const routingKey =
      typeof originalKey === "string" && originalKey
        ? originalKey
        : message.fields.routingKey;

    let event: LeaseLifecycleEvent;
    try {
      event = JSON.parse(message.content.toString()) as LeaseLifecycleEvent;
    } catch {
      // Unparseable will never become parseable. Straight to the DLQ, where a
      // person can look at it, rather than round and round the retry loop.
      console.error("[lease-worker] dropping unparseable message");
      channel.nack(message, false, false);
      return;
    }

    const leaseId = leaseIdOf(event);
    if (!leaseId) {
      console.error(`[lease-worker] dropping ${routingKey} with no lease id`);
      channel.nack(message, false, false);
      return;
    }

    try {
      let outcome: LifecycleOutcome;

      if (routingKey === RENEWAL_KEY) {
        outcome = await handleLeaseRenewal(leaseId);
      } else if (routingKey === VACATING_KEY) {
        outcome = await handleLeaseVacating(leaseId);
      } else {
        // Bound to two keys, so this means the binding and this file disagree.
        // Acked rather than dead-lettered: it is not a broken message, it is a
        // message for somebody else.
        console.warn(`[lease-worker] ignoring unexpected key "${routingKey}"`);
        channel.ack(message);
        return;
      }

      if (outcome.action === "retry") {
        throw new Error(outcome.detail);
      }

      if (outcome.action === "drop") {
        console.error(`[lease-worker] ${routingKey}: ${outcome.detail}`);
        channel.nack(message, false, false);
        return;
      }

      console.log(`[lease-worker] ${routingKey}: ${outcome.detail}`);
      channel.ack(message);
    } catch (error) {
      const reason = describeError(error);

      if (attempts >= MAX_ATTEMPTS) {
        console.error(
          `[lease-worker] ${routingKey} for lease ${leaseId} failed ${attempts}x, dead-lettering: ${reason}`
        );
        channel.nack(message, false, false);
        return;
      }

      /*
       * Republished with the count in a header rather than `nack(requeue)`:
       * a requeued message looks brand new, so a poisoned one would loop
       * forever at prefetch 1 with every later lease stuck behind it. Carrying
       * the attempt count is what makes the retry terminate.
       */
      console.warn(
        `[lease-worker] ${routingKey} for lease ${leaseId} failed (attempt ${attempts}), retrying: ${reason}`
      );
      channel.sendToQueue(LEASE_LIFECYCLE_QUEUE, message.content, {
        ...message.properties,
        headers: {
          ...message.properties.headers,
          "x-attempts": attempts,
          "x-original-routing-key": routingKey,
        },
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
    running = null;
  };
}
