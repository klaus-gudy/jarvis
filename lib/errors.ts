/**
 * Turns a thrown value into something worth showing a person.
 *
 * **Client-safe and dependency-free**, which is why it lives here rather than
 * in `lib/contracts.ts` where it started: that file reaches the database and
 * (until this phase) Playwright, while this is imported by workers, route
 * handlers and the Contract tab alike. Same split, same reason, as
 * `lib/contract-steps.ts`.
 *
 * `cause.message` alone is not enough. Node throws an **`AggregateError` with
 * an empty message** when a connection is refused on several addresses — which
 * is precisely what a stopped MinIO looks like — so the toast that exists to
 * explain the failure rendered a blank line under "Stopped at". The detail is
 * all in `errors[]` and in `code`, never in `message`.
 *
 * So: unwrap aggregates, and fall back to the error's `code` (`ECONNREFUSED`)
 * or its class name rather than to nothing. Whatever comes back is the string
 * the worker logs and the Contract tab prints, so "" is never an answer.
 */
export function describeError(cause: unknown): string {
  if (!(cause instanceof Error)) return String(cause) || "Unknown error";

  const parts = [cause.message.trim()];

  // AggregateError.errors — each one carries the address it could not reach.
  const nested = (cause as AggregateError).errors;
  if (Array.isArray(nested)) {
    const seen = new Set<string>();
    for (const item of nested) {
      const text = describeError(item);
      if (text && !seen.has(text)) {
        seen.add(text);
        parts.push(text);
      }
    }
  }

  const described = parts.filter(Boolean).join(" — ");
  if (described) return described;

  const code = (cause as NodeJS.ErrnoException).code;
  return code ? `${cause.name}: ${code}` : cause.name;
}
