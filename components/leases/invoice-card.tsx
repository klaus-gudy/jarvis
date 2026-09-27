import { DetailRow } from "@/components/detail-row";
import { InvoiceProgress } from "@/components/leases/invoice-progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { INVOICE_STATUS_VARIANT, type InvoiceStatus } from "@/lib/invoice-types";

export type InvoiceCardData = {
  reference: string;
  amount: number;
  paid: number;
  balance: number;
  status: InvoiceStatus;
  dueDate: Date;
};

/**
 * A lease's invoice: the paid bar, then reference, status and due date. One
 * card for both sides — the landlord's lease Overview and the tenant's lease
 * page — so the same invoice never reads two different ways.
 */
export function InvoiceCard({
  invoice,
  className,
}: {
  invoice: InvoiceCardData | null;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <CardTitle className="text-base">Invoice</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {invoice ? (
          <>
            {/* The bar replaces the Total / Paid so far / Balance rows that
                used to sit below — same three numbers, but a reader no longer
                has to subtract to see where the invoice stands. What remains
                are the facts a bar can't carry. */}
            <div className="px-6 py-4">
              <InvoiceProgress
                amount={invoice.amount}
                paid={invoice.paid}
                balance={invoice.balance}
              />
            </div>
            <dl className="border-t">
              <DetailRow
                label="Reference"
                value={<span className="font-mono text-xs">{invoice.reference}</span>}
              />
              <DetailRow
                label="Status"
                value={
                  <Badge
                    variant={INVOICE_STATUS_VARIANT[invoice.status]}
                    className="rounded-full font-normal"
                  >
                    {invoice.status}
                  </Badge>
                }
              />
              <DetailRow label="Due date" value={formatDate(invoice.dueDate)} />
            </dl>
          </>
        ) : (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No invoice exists for this lease yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
