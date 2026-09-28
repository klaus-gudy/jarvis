import "dotenv/config";

import { sanitizeTemplateHtml } from "@/lib/lease-placeholders";
import { prisma } from "@/lib/prisma";

/**
 * Re-sanitises every stored lease template body with the DOMPurify sanitizer.
 *
 *   npm run templates:sanitize -- --dry-run
 *   npm run templates:sanitize -- --org=<organizationId>
 *
 * Bodies used to be stored exactly as sent and cleaned only on the way out,
 * by a regex that `<img/src=x/onerror=…>` walked past — and the editor seeded
 * itself from the raw body. New writes are sanitised now; this brings the rows
 * written before that into line. Safe to run twice: a clean body is unchanged.
 */

function flag(name: string) {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const organizationId = flag("org");

  const templates = await prisma.leaseTemplate.findMany({
    where: organizationId ? { organizationId } : undefined,
    select: { id: true, name: true, body: true, organization: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  let changed = 0;
  for (const template of templates) {
    const clean = sanitizeTemplateHtml(template.body);
    if (clean === template.body) continue;
    changed += 1;
    console.log(
      `${dryRun ? "would clean" : "cleaned"} "${template.name}" (${template.organization.name}, ${template.id}): ` +
        `${template.body.length} → ${clean.length} chars`
    );
    if (!dryRun) {
      await prisma.leaseTemplate.update({ where: { id: template.id }, data: { body: clean } });
    }
  }

  console.log(`${templates.length} templates checked, ${changed} ${dryRun ? "would change" : "changed"}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
