import {
  connect,
  type ChannelModel,
  type ConfirmChannel,
  type RecoveringChannelModel,
} from "amqplib";

import { describeError } from "@/lib/errors";
import {
  MAIL_DLQ,
  MAIL_DLX,
  MAIL_EXCHANGE,
  MAIL_QUEUE,
  RABBITMQ_URL,
  type MailMessage,
  type MailRoutingKey,
} from "@/lib/mail/config";

/**
 * One AMQP connection per process, shared by every publish.
 *
 * amqplib 2's `recovery` option owns the hard part: it reconnects with
 * exponential backoff and jitter, and re-runs `setup` on each new connection —
 * so the topology is asserted again after a broker restart rather than being
 * declared once at boot and assumed forever after.
 *
 * The channel is a *confirm* channel. A bare `publish()` only means "handed to
 * the socket", which is not the same as "the broker has it"; waiting for the
 * confirm is what makes a successful send mean something.
 */

type MailConnection = {
  model: RecoveringChannelModel;
  channel: ConfirmChannel;
};

async function declareTopology(model: ChannelModel) {
  const channel = await model.createChannel();

  await channel.assertExchange(MAIL_EXCHANGE, "topic", { durable: true });
  await channel.assertExchange(MAIL_DLX, "fanout", { durable: true });

  // The queue is declared by the producer, not left to the consumer: a message
  // published before the mail service has ever run must be held, and a topic
  // exchange with no bound queue drops what it receives without complaint.
  await channel.assertQueue(MAIL_QUEUE, {
    durable: true,
    deadLetterExchange: MAIL_DLX,
  });
  await channel.bindQueue(MAIL_QUEUE, MAIL_EXCHANGE, "#");

  await channel.assertQueue(MAIL_DLQ, { durable: true });
  await channel.bindQueue(MAIL_DLQ, MAIL_DLX, "");

  await channel.close();
}

async function openConnection(): Promise<MailConnection> {
  const model = await connect(RABBITMQ_URL, {
    recovery: { setup: declareTopology },
  });

  model.on("disconnect", (error) =>
    console.error("[mail] RabbitMQ disconnected:", describeError(error))
  );
  model.on("reconnect-scheduled", ({ attempt, delay }) =>
    console.warn(`[mail] RabbitMQ reconnect attempt ${attempt} in ${delay}ms`)
  );

  return { model, channel: await model.createConfirmChannel() };
}

// Reused across hot reloads in dev for the same reason the Prisma client is:
// otherwise every edit leaks another connection to the broker.
const globalForMail = globalThis as unknown as {
  mailConnection?: Promise<MailConnection>;
};

function getConnection(): Promise<MailConnection> {
  const existing = globalForMail.mailConnection;
  if (existing) return existing;

  const started = openConnection();
  globalForMail.mailConnection = started;

  const invalidate = () => {
    // Identity-checked so a late close event from a superseded connection
    // can't evict the live one.
    if (globalForMail.mailConnection === started) {
      globalForMail.mailConnection = undefined;
    }
  };

  started.then(({ channel }) => {
    // A channel closed by a broker-side error is dead. Drop it so the next
    // publish opens a fresh one rather than writing into a corpse.
    channel.on("close", invalidate);
    channel.on("error", (error: Error) => {
      console.error("[mail] channel error:", describeError(error));
      invalidate();
    });
    // A failed connect must not stay cached either, or one outage at boot
    // would poison every publish for the life of the process.
  }, invalidate);

  return started;
}

/**
 * Publishes one rendered email.
 *
 * **Never throws.** Email is a side effect of a request, not part of it — a
 * broker outage must not turn a successful registration into a 500. Failures
 * are logged and returned; callers that care can act on the result, and the
 * ones in `lib/mail/auth.ts` deliberately don't.
 */
export async function publishMail(
  routingKey: MailRoutingKey,
  message: MailMessage
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { channel } = await getConnection();

    channel.publish(
      MAIL_EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(message)),
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
    // Same empty-`AggregateError` trap as `lib/events/publisher.ts` — a
    // refused connection carries its detail in `errors[]`, not `message`.
    const reason = describeError(error);
    // Deliberately does not log `message`: `auth.password.reset_requested`
    // carries a live one-time code, and logs are the wrong place for it.
    console.error(`[mail] failed to publish ${routingKey}: ${reason}`);
    return { ok: false, error: reason };
  }
}

/** Closes the shared connection. For scripts, which otherwise hang on exit. */
export async function closeMailConnection() {
  const existing = globalForMail.mailConnection;
  if (!existing) return;
  globalForMail.mailConnection = undefined;
  try {
    const { model } = await existing;
    await model.close();
  } catch {
    // Already gone; nothing to close.
  }
}
