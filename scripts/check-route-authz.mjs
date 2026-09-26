/**
 * Fails when an API route handler doesn't pass through an authorization gate.
 *
 * Every exported handler in `app/api/**\/route.ts` must call one of the gates
 * from `lib/authz.ts` — unless its route is on the allowlist below, which is
 * the short, reviewed list of endpoints that are public or authenticate some
 * other way (session-less auth flows, signed webhooks, the cron secret).
 *
 * Checked per handler, not per file: one gated GET beside an ungated DELETE is
 * exactly the mistake this exists to catch.
 *
 *   npm run check:authz
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const API = join(ROOT, "app/api");

const GATES = ["authorize(", "authorizeMember(", "authorizeTenant("];

/** Route directories (relative to app/api) that don't use the org gates. */
const ALLOW = [
  "auth/", // login, register, reset… — before there is a session, or self-only
  "webhooks/", // signed by the provider
  "cron/", // Bearer CRON_SECRET
  "health", // liveness
  "invitations/accept", // the token is the credential
  "organizations/check-name", // registration form, yes/no only
  "organizations/switch", // validates membership itself
  "organizations/route.ts", // create-org for a user with none
  "account/", // the signed-in user's own password
  "tours", // the signed-in user's own tour progress
];

function* routes(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* routes(path);
    else if (entry === "route.ts") yield path;
  }
}

const failures = [];
for (const file of routes(API)) {
  const rel = relative(API, file);
  if (ALLOW.some((prefix) => rel.startsWith(prefix))) continue;

  const source = readFileSync(file, "utf8");
  // Top-level functions, each running to the next one. A handler counts as
  // gated if it calls a gate itself or calls a local helper that does (a
  // shared `exportResponse`, the signature route's `ownMembership`).
  const blocks = source
    .split(/^(?=(?:export )?(?:async )?function \w+|export const \w+ =)/m)
    .map((body) => ({ body, name: body.match(/^(?:export )?(?:async )?function (\w+)|^export const (\w+)/)?.slice(1).find(Boolean) }))
    .filter((block) => block.name);
  const hasGate = (text) => GATES.some((gate) => text.includes(gate));
  const gatedHelpers = blocks
    .filter((block) => !/^export/.test(block.body) && hasGate(block.body))
    .map((block) => block.name);

  for (const { name, body } of blocks) {
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(name)) continue;
    const gated = hasGate(body) || gatedHelpers.some((helper) => body.includes(`${helper}(`));
    if (!gated) failures.push(`app/api/${rel} ${name}`);
  }
}

if (failures.length) {
  console.error("API handlers without an authorization gate (lib/authz.ts):");
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error("\nGate them, or — if genuinely public — add the route to ALLOW in scripts/check-route-authz.mjs.");
  process.exit(1);
}
console.log("check:authz — every API handler is gated.");
