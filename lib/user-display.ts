/**
 * Both email and phone are optional, and a tenant onboarded by staff may have
 * neither a name nor an email — so every place that renders a person needs the
 * same fallback chain rather than assuming a string is present.
 */
export function displayName(user: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  return user.name ?? user.email ?? user.phone ?? "Unnamed";
}

/** First letters of the first two words, for avatar fallbacks. */
export function initials(value: string) {
  const letters = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return letters || "?";
}

/** Best available way to reach someone, preferring phone for tenants. */
export function primaryContact(user: {
  phone?: string | null;
  email?: string | null;
}) {
  return user.phone ?? user.email ?? null;
}
