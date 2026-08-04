/**
 * One label/value line inside a detail card's <dl>. Shared by the lease and
 * tenant detail pages so both keep the row rhythm the property page set.
 */
export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b px-6 py-3.5 text-sm last:border-b-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  );
}

/** Optional values render as an em dash rather than collapsing the row. */
export function orDash(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "—" : value;
}
