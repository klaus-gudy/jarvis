import "dotenv/config";

import { prisma } from "@/lib/prisma";

/**
 * Fills `MemberProfile.nationality` — printed on contracts as
 * `{{tenant_nationality}}` — for tenants who have none. The column arrived on
 * 2026-08-26 with nothing to fill it, so every older tenant prints a blank.
 *
 * Nothing is inferred: you say what to write.
 *
 *   npm run members:backfill-nationality -- --nationality=Tanzanian --dry-run
 *   npm run members:backfill-nationality -- --nationality=Tanzanian --with-nida
 *   npm run members:backfill-nationality -- --nationality=Tanzanian --org=<id>
 *
 * `--with-nida` limits it to tenants with a NIDA number on file — the closest
 * thing the data has to evidence. Only tenants, only empty values; a
 * nationality someone typed is never overwritten. Safe to run twice.
 */

function flag(name: string) {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const withNida = process.argv.includes("--with-nida");
  const organizationId = flag("org");
  const nationality = flag("nationality")?.trim();
  if (!nationality) {
    console.error("Say what to write: --nationality=Tanzanian");
    process.exitCode = 1;
    return;
  }

  const tenants = await prisma.membership.findMany({
    where: {
      role: { kind: "TENANT" },
      ...(organizationId ? { organizationId } : {}),
      OR: [{ profile: null }, { profile: { nationality: null } }],
      ...(withNida ? { profile: { nidaNumber: { not: null }, nationality: null } } : {}),
    },
    select: { id: true, profile: { select: { id: true } } },
  });

  if (!dryRun) {
    for (const tenant of tenants) {
      await prisma.memberProfile.upsert({
        where: { membershipId: tenant.id },
        create: { membershipId: tenant.id, nationality },
        update: { nationality },
      });
    }
  }

  console.log(
    `${dryRun ? "Dry run — nothing written. Would set" : "Set"} nationality "${nationality}" on ${tenants.length} tenant(s)${withNida ? " with a NIDA number" : ""}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
