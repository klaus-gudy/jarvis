import "dotenv/config";

import { buildContractPlan, findLeasesMissingContracts } from "@/lib/contracts";
import { closeEventConnection, publishEvent } from "@/lib/events/publisher";
import { prisma } from "@/lib/prisma";

/**
 * Queues a contract for every lease that has none.
 *
 * The recovery path for everything the event cannot reach on its own: leases
 * signed before contracts existed, ones whose render dead-lettered twice, and
 * ones created while the broker or the worker was down.
 *
 *   npm run backfill:contracts -- --dry-run
 *   npm run backfill:contracts -- --org=<organizationId>
 *   npm run backfill:contracts -- --limit=20
 *
 * It **publishes rather than renders**, so it needs no browser and does the
 * same thing a real lease does — the worker is still the only thing that makes
 * a PDF, and there is still exactly one code path that files one. Run the
 * worker alongside it, or the messages simply wait on the durable queue until
 * something does.
 *
 * Safe to run twice: a lease that got its contract on the first pass is no
 * longer missing one, so the second pass skips it.
 */

function flag(name: string) {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const organizationId = flag("org");
  const limitRaw = flag("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  if (limitRaw && (!Number.isInteger(limit) || limit! < 1)) {
    console.error(`[backfill] --limit must be a positive whole number`);
    process.exit(1);
  }

  const missing = await findLeasesMissingContracts(organizationId, limit);

  const scope = organizationId ? ` in organization ${organizationId}` : "";
  if (missing.length === 0) {
    console.log(`[backfill] every lease${scope} already has a contract`);
    return;
  }

  console.log(
    `[backfill] ${missing.length} lease(s)${scope} with no contract:` +
      `\n  ${missing.map((lease) => lease.reference).join(", ")}`
  );

  if (dryRun) {
    console.log("[backfill] --dry-run, nothing published");
    return;
  }

  let queued = 0;
  for (const lease of missing) {
    // The same event a real lease publishes — filled HTML and object key and
    // all — so `document-worker` cannot tell a backfill from a signing and
    // there is no second path to keep in step.
    const plan = await buildContractPlan(lease.organizationId, lease.leaseId);

    if ("error" in plan) {
      console.error(
        `[backfill] ${lease.reference} not queued: ${plan.error.message}`
      );
      continue;
    }

    const result = await publishEvent("lease.created", plan.plan.event);

    if (result.ok) {
      queued += 1;
    } else {
      // Logged and carried on: one unpublishable message should not abandon
      // the rest, and re-running skips whatever did get through.
      console.error(`[backfill] ${lease.reference} not queued: ${result.error}`);
    }
  }

  console.log(
    `[backfill] queued ${queued}/${missing.length} — run \`npm run worker\` to render them`
  );
}

main()
  .catch((error) => {
    console.error("[backfill] fatal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeEventConnection();
    await prisma.$disconnect();
  });
