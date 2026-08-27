import {
  connect,
  type ChannelModel,
  type ConfirmChannel,
  type RecoveringChannelModel,
} from "amqplib";

import {
  CONTRACT_BINDINGS,
  CONTRACT_DLQ,
  CONTRACT_QUEUE,
  EVENTS_DLX,
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
 * Declared by the *producer*, not left to the worker: an event published
 * before the contract worker has ever run must be held, and a topic exchange
 * with no bound queue drops what it receives without complaint. That is the
 * difference between "the worker was down for ten minutes" and "ten leases
 * have no contract and nothing recorded why".
 */
export async function declareEventTopology(model: ChannelModel) {
  const channel = await model.createChannel();

  await channel.assertExchange(EVENTS_EXCHANGE, "topic", { durable: true });
  await channel.assertExchange(EVENTS_DLX, "fanout", { durable: true });

  await channel.assertQueue(CONTRACT_QUEUE, {
    durable: true,
    deadLetterExchange: EVENTS_DLX,
  });
  for (const binding of CONTRACT_BINDINGS) {
    await channel.bindQueue(CONTRACT_QUEUE, EVENTS_EXCHANGE, binding);
  }

  await channel.assertQueue(CONTRACT_DLQ, { durable: true });
  await channel.bindQueue(CONTRACT_DLQ, EVENTS_DLX, "");

  await channel.close();
}

async function openConnection(): Promise<EventConnection> {
  const model = await connect(RABBITMQ_URL, {
    recovery: { setup: declareEventTopology },
  });

  model.on("disconnect", (error) =>
    console.error("[events] RabbitMQ disconnected:", error.message)
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
      console.error("[events] channel error:", error.message);
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

    channel.publish(
      EVENTS_EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        // Survives a broker restart, which a durable queue on its own does not
        // guarantee for the messages already sitting in it.
        persistent: true,
        contentType: "application/json",
        contentEncoding: "utf-8",
        type: routingKey,
        timestamp: Date.now(),
      }
    );

    await channel.waitForConfirms();
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[events] failed to publish ${routingKey}: ${reason}`);
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
