/**
 * Starts this app's RabbitMQ consumers with the server.
 *
 * They used to be two processes nobody ran. `npm start` is web-only, so on a
 * deploy target nothing consumed `document.stored`: the separate renderer kept
 * producing PDFs, and `FileAsset` rows were silently never written — invisible
 * because every publisher is fire-and-forget. Starting them here makes a deploy
 * of the app a deploy of its consumers, which is the only arrangement where
 * that cannot happen again.
 *
 * This works because the app runs as a long-lived container. On a serverless
 * target it would be wrong — `register()` would run per instance, and a
 * consumer would be frozen mid-message. If this app ever moves, the consumers
 * move back out to their own service first.
 */
export async function register() {
  // Only the Node.js server can hold an AMQP socket; `register` also runs on
  // the Edge runtime, where `amqplib` has nothing to open.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ startDocumentConsumer }, { startLeaseConsumer }] = await Promise.all([
    import("@/lib/events/document-consumer"),
    import("@/lib/events/lease-consumer"),
  ]);

  /*
   * Failing to attach must not take the server down with it: the web app is
   * useful without a consumer, and a broker that is slow to come up on a cold
   * deploy would otherwise crash-loop the whole service. amqplib reconnects on
   * its own once attached — this only covers never getting that far.
   */
  await Promise.all([
    startDocumentConsumer().catch((error) =>
      console.error("[instrumentation] document consumer failed to start:", error)
    ),
    startLeaseConsumer().catch((error) =>
      console.error("[instrumentation] lease consumer failed to start:", error)
    ),
  ]);
}
