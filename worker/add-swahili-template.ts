import "dotenv/config";

import { seedSwahiliLeaseTemplate, SWAHILI_TEMPLATE_NAME } from "@/lib/lease-template-starters";
import { prisma } from "@/lib/prisma";

/**
 * Gives every organization created before 2026-10-08 the Swahili starter
 * template that new organizations now get at creation. Never the default —
 * switching is one click in Settings → Lease templates.
 *
 *   npm run templates:add-swahili -- --dry-run
 *   npm run templates:add-swahili -- --org=<organizationId>
 *
 * Skips an organization that already has any Swahili template (it has made its
 * own choice) or a template under the starter's name. Safe to run twice.
 */

function flag(name: string) {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const organizationId = flag("org");

  const organizations = await prisma.organization.findMany({
    where: organizationId ? { id: organizationId } : undefined,
    select: {
      id: true,
      name: true,
      leaseTemplates: { select: { language: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  let added = 0;
  for (const organization of organizations) {
    const label = `${organization.name} (${organization.id})`;
    const hasSwahili = organization.leaseTemplates.some((t) => t.language === "sw");
    const nameTaken = organization.leaseTemplates.some((t) => t.name === SWAHILI_TEMPLATE_NAME);
    if (hasSwahili || nameTaken) {
      console.log(`skip  ${label} — already has a Swahili template`);
      continue;
    }
    if (!dryRun) await seedSwahiliLeaseTemplate(prisma, organization.id);
    console.log(`${dryRun ? "would add" : "added"} ${label}`);
    added += 1;
  }

  console.log(
    `\n${dryRun ? "Dry run — nothing written. " : ""}${added} of ${organizations.length} organization(s) ${dryRun ? "would get" : "got"} the Swahili starter.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
