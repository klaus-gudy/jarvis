import {
  connect,
  type ChannelModel,
  type ConfirmChannel,
  type RecoveringChannelModel,
} from "amqplib";

import { describeError } from "@/lib/errors";
import {
  ROUTING_KEY,
  DOCUMENTS_BINDINGS,
  DOCUMENTS_DLQ,
  DOCUMENTS_QUEUE,
  EVENTS_DLX,
  EVENTS_DLX_TYPE,
  EVENTS_EXCHANGE,
  RABBITMQ_URL,
  type DomainEvent,
  type EventRoutingKey,
} from "@/lib/events/config";

/**
 * Publishing side of the domain-event bus. Deliberately the same shape as
 * `lib/mail/queue.ts` — one recovering connection per process, a confirm
 * channel, topology re-asserted on every reconnect — because it is the same
 * problem and a second, subtly different AMQP client is how the two drift.
 */

type EventConnection = {
  model: RecoveringChannelModel;
  channel: ConfirmChannel;
};

/**
 * Declared by the *producer*, not left to a consumer: an event published before
 * its consumer has ever run must be held, and a topic exchange with no bound
 * queue drops what it receives without complaint. That is the difference
 * between "the worker was down for ten minutes" and "ten leases have no
 * contract and nothing recorded why".
 *
 * **This app no longer declares a queue for `lease.created`.** That message is
 * for `document-worker`, which owns `DOCUMENT_WORKER_QUEUE` and declares it
 * itself; a second queue bound to the same key here would mean two services
 * racing to render one contract. What is declared instead is the mailbox for
 * the reply — `document.rendered`, which is how the `FileAsset` row gets
 * written once the PDF is actually in the bucket.
 *
 * The dead-letter topology deliberately mirrors `document-worker`'s, down to
 * the exchange type and the routing key being the originating queue's own name.
 * Both apps assert the same exchange, and an exchange's type cannot be changed
 * after creation, so agreeing is not optional — see `EVENTS_DLX_TYPE`.
 */
export async function declareEventTopology(model: ChannelModel) {
  const channel = await model.createChannel();

  await channel.assertExchange(EVENTS_EXCHANGE, "topic", { durable: true });
  await channel.assertExchange(EVENTS_DLX, EVENTS_DLX_TYPE, { durable: true });

  // The holding area first: a dead-letter exchange with no queue bound behaves
  // exactly like having none at all — the broker publishes the rejected
  // message, nothing is listening, and it is dropped just as silently.
  await channel.assertQueue(DOCUMENTS_DLQ, { durable: true });
  await channel.bindQueue(DOCUMENTS_DLQ, EVENTS_DLX, DOCUMENTS_QUEUE);

  await channel.assertQueue(DOCUMENTS_QUEUE, {
    durable: true,
    deadLetterExchange: EVENTS_DLX,
    deadLetterRoutingKey: DOCUMENTS_QUEUE,
  });
  for (const binding of DOCUMENTS_BINDINGS) {
    await channel.bindQueue(DOCUMENTS_QUEUE, EVENTS_EXCHANGE, binding);
  }

  await channel.close();
}

async function openConnection(): Promise<EventConnection> {
  const model = await connect(RABBITMQ_URL, {
    recovery: { setup: declareEventTopology },
  });

  model.on("disconnect", (error) =>
    console.error("[events] RabbitMQ disconnected:", describeError(error))
  );
  model.on("reconnect-scheduled", ({ attempt, delay }) =>
    console.warn(`[events] RabbitMQ reconnect attempt ${attempt} in ${delay}ms`)
  );

  return { model, channel: await model.createConfirmChannel() };
}

// Reused across hot reloads in dev for the same reason the Prisma client is:
// otherwise every edit leaks another connection to the broker.
const globalForEvents = globalThis as unknown as {
  eventConnection?: Promise<EventConnection>;
};

function getConnection(): Promise<EventConnection> {
  const existing = globalForEvents.eventConnection;
  if (existing) return existing;

  const started = openConnection();
  globalForEvents.eventConnection = started;

  const invalidate = () => {
    // Identity-checked so a late close event from a superseded connection
    // can't evict the live one.
    if (globalForEvents.eventConnection === started) {
      globalForEvents.eventConnection = undefined;
    }
  };

  started.then(({ channel }) => {
    channel.on("close", invalidate);
    channel.on("error", (error: Error) => {
      console.error("[events] channel error:", describeError(error));
      invalidate();
    });
  }, invalidate);

  return started;
}

/**
 * Publishes one domain event.
 *
 * **Never throws**, for the same reason `publishMail` doesn't: the thing that
 * happened has already been committed. A broker outage must not turn a
 * successful lease into a 500 — it means the contract is generated late, which
 * is exactly the failure mode this indirection was chosen for.
 */
export async function publishEvent<K extends EventRoutingKey>(
  routingKey: K,
  payload: DomainEvent[K]
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { channel } = await getConnection();

    /*
     * The *configured* key, not the internal name they happen to share by
     * default. `routingKey` here is this app's identity for the event — what
     * `DomainEvent` is keyed by — and the wire value is whatever `.env` says
     * `document-worker` is listening for.
     */
    channel.publish(
      EVENTS_EXCHANGE,
      ROUTING_KEY[routingKey],
      Buffer.from(JSON.stringify(payload)),
      {
        // Survives a broker restart, which a durable queue on its own does not
        // guarantee for the messages already sitting in it.
        persistent: true,
        contentType: "application/json",
        contentEncoding: "utf-8",
        type: ROUTING_KEY[routingKey],
        timestamp: Date.now(),
      }
    );

    await channel.waitForConfirms();
    return { ok: true };
  } catch (error) {
    /*
     * `describeError`, never `error.message`. Node throws an `AggregateError`
     * with an **empty** message when a connection is refused on several
     * addresses — which is exactly what an unreachable RabbitMQ looks like, so
     * the one log line written to explain the outage explained nothing. The
     * detail is only ever in `errors[]` and `code`.
     */
    const reason = describeError(error);
    console.error(
      `[events] failed to publish ${routingKey} (as "${ROUTING_KEY[routingKey]}"): ${reason}`
    );
    return { ok: false, error: reason };
  }
}

/** Closes the shared connection. For scripts, which otherwise hang on exit. */
export async function closeEventConnection() {
  const existing = globalForEvents.eventConnection;
  if (!existing) return;
  globalForEvents.eventConnection = undefined;
  try {
    const { model } = await existing;
    await model.close();
  } catch {
    // Already gone; nothing to close.
  }
}
