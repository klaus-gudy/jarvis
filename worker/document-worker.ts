import "dotenv/config";

import { startDocumentConsumer } from "@/lib/events/document-consumer";

/**
 * Runs the contract-filing consumer as its own process.
 *
 * Production does not use this: `instrumentation.ts` starts the same consumer
 * inside the Next.js server, so the app and its consumer deploy together. This
 * shim stays for local debugging, where watching one consumer's log without the
 * dev server's output around it is the whole point.
 */
async function main() {
  const stop = await startDocumentConsumer();

  async function shutdown(signal: string) {
    console.log(`[document-worker] ${signal} — shutting down`);
    await stop();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[document-worker] fatal:", error);
  process.exit(1);
});
