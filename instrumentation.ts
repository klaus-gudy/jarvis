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
   * Kicked off, deliberately **not awaited**.
   *
   * `register` must finish before the server handles requests, so anything
   * awaited here is in front of the first page load. A rejection is caught
   * below, but a *hang* would not be: if the broker is unreachable or slow to
   * resolve on a cold deploy, amqplib sits in a TCP connect for over a minute,
   * and awaiting it would keep the whole site from serving over a queue that
   * nothing on the critical path needs. This is invisible locally, where the
   * broker answers instantly — it only shows up on a real deploy.
   *
   * The consumers are idempotent and amqplib reconnects on its own, so the
   * worst case is that messages sit in a durable queue for a few seconds
   * longer while pages are already being served.
   */
  void startDocumentConsumer().catch((error) =>
    console.error("[instrumentation] document consumer failed to start:", error)
  );

  void startLeaseConsumer().catch((error) =>
    console.error("[instrumentation] lease consumer failed to start:", error)
  );
}
