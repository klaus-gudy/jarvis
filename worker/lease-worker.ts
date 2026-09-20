import "dotenv/config";

import { startLeaseConsumer } from "@/lib/events/lease-consumer";

/**
 * Runs the lease lifecycle consumer as its own process.
 *
 * Production does not use this: `instrumentation.ts` starts the same consumer
 * inside the Next.js server, so the app and its consumer deploy together. This
 * shim stays for local debugging, where watching one consumer's log without the
 * dev server's output around it is the whole point.
 */
async function main() {
  const stop = await startLeaseConsumer();

  async function shutdown(signal: string) {
    console.log(`[lease-worker] ${signal} — shutting down`);
    await stop();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[lease-worker] fatal:", error);
  process.exit(1);
});
