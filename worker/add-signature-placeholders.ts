import "dotenv/config";

import { prisma } from "@/lib/prisma";

/**
 * Puts `{{landlord_signature}}` / `{{tenant_signature}}` into lease templates
 * that predate them — where the starter template has them now.
 *
 *   npm run templates:add-signatures -- --dry-run
 *   npm run templates:add-signatures -- --org=<organizationId>
 *
 * **Deploy the signature code first.** A build that doesn't know these tokens
 * prints them literally (unknown tokens stay visible on purpose), so running
 * this against a database whose app is older puts `{{landlord_signature}}` on
 * real contracts.
 *
 * Only the starter's own shape is rewritten: the plain signing line
 * (`<div class="rule"></div>`) directly above LANDLORD/MPANGISHAJI or
 * TENANT/MPANGAJI becomes a `signature-slot` holding the token — the image when
 * one is on file, the dotted blank line when not. A template edited past
 * recognition is reported, not guessed at; add the tokens from the editor's
 * placeholder panel instead.
 *
 * Safe to run twice: a template that already has a token is left alone.
 */

const SLOTS = [
  {
    token: "{{landlord_signature}}",
    pattern: /<div class="rule"><\/div>(\s*<strong>(?:LANDLORD|MPANGISHAJI)<\/strong>)/,
  },
  {
    token: "{{tenant_signature}}",
    pattern: /<div class="rule"><\/div>(\s*<strong>(?:TENANT|MPANGAJI)<\/strong>)/,
  },
];

function flag(name: string) {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const organizationId = flag("org");

  const templates = await prisma.leaseTemplate.findMany({
    where: organizationId ? { organizationId } : undefined,
    select: {
      id: true,
      name: true,
      body: true,
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  let changed = 0;
  let manual = 0;
  for (const template of templates) {
    const label = `"${template.name}" (${template.organization.name}, ${template.id})`;
    let body = template.body;
    const added: string[] = [];
    const unmatched: string[] = [];

    for (const slot of SLOTS) {
      const name = slot.token.slice(2, -2);
      if (body.includes(slot.token)) continue;
      if (!slot.pattern.test(body)) {
        unmatched.push(name);
        continue;
      }
      body = body.replace(
        slot.pattern,
        `<div class="signature-slot">${slot.token}</div>$1`
      );
      added.push(name);
    }

    if (unmatched.length > 0) {
      manual += 1;
      console.log(
        `[signatures] ${label}: no starter signing line for ${unmatched.join(", ")} — add from the editor`
      );
    }
    if (added.length === 0) {
      if (unmatched.length === 0) console.log(`[signatures] ${label}: already has both`);
      continue;
    }

    changed += 1;
    console.log(
      `[signatures] ${label}: ${dryRun ? "would add" : "adding"} ${added.join(", ")}`
    );
    if (!dryRun) {
      await prisma.leaseTemplate.update({
        where: { id: template.id },
        data: { body },
      });
    }
  }

  console.log(
    `[signatures] ${templates.length} template(s): ${changed} ${dryRun ? "would change" : "changed"}, ${manual} need a manual edit`
  );
}

main()
  .catch((error) => {
    console.error("[signatures] failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
