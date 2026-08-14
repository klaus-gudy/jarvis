import { formatCurrencyFull } from "@/lib/format";

/**
 * The invoice as a bar: how much of the total has been paid, and what is left.
 *
 * Replaces three of the card's label/value rows rather than joining them —
 * total, paid and remaining were the same three numbers, and a reader had to
 * subtract to see where the invoice stood. The bar answers that before the
 * figures are read at all.
 *
 * `animate-bar-grow` is the same fill the dashboard's progress cards use.
 */
export function InvoiceProgress({
  amount,
  paid,
  balance,
}: {
  amount: number;
  paid: number;
  balance: number;
}) {
  // An invoice for nothing can't be part-paid; guard the division rather than
  // rendering NaN%.
  const percent =
    amount > 0 ? Math.min(100, Math.round((paid / amount) * 100)) : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm text-muted-foreground">Paid so far</span>
        <span className="font-mono text-sm font-medium tabular-nums">
          {formatCurrencyFull(paid)}
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {percent}%
          </span>
        </span>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Proportion of the invoice paid"
      >
        <div
          className="h-full animate-bar-grow rounded-full bg-stat-accent"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          Total{" "}
          <span className="font-mono tabular-nums text-foreground">
            {formatCurrencyFull(amount)}
          </span>
        </span>
        <span>
          Remaining{" "}
          <span className="font-mono tabular-nums text-foreground">
            {formatCurrencyFull(balance)}
          </span>
        </span>
      </div>
    </div>
  );
}
