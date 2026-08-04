/**
 * One label/value line inside a detail card's <dl>. Shared by the lease and
 * tenant detail pages so both keep the row rhythm the property page set.
 *
 * The divider is drawn as a pseudo-element inset to match the row's own
 * horizontal padding, rather than a `border-b` that would run edge to edge —
 * full-bleed lines are reserved for the card header, which separates sections.
 * Using ::after (rather than moving padding onto the parent) keeps the row
 * self-contained, so it behaves the same in a plain list or a grid.
 */
export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center justify-between gap-4 px-6 py-3.5 text-sm after:pointer-events-none after:absolute after:inset-x-6 after:bottom-0 after:h-px after:bg-border last:after:hidden">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  );
}

/** Optional values render as an em dash rather than collapsing the row. */
export function orDash(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "—" : value;
}
