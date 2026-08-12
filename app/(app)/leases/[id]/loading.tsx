import { DetailCardSkeleton, TabsSkeleton } from "@/components/skeletons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeaseDetailLoading() {
  return (
    <div className="space-y-6">
      <Card className="gap-0 p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <Skeleton className="size-12 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </Card>

      {/* Overview / Billing */}
      <TabsSkeleton tabs={2} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailCardSkeleton rows={6} />
        <DetailCardSkeleton rows={4} />
        <DetailCardSkeleton rows={4} />
        {/* Invoice card — Reference, Status, Total, Due, Paid, Balance */}
        <DetailCardSkeleton rows={6} />
      </div>
    </div>
  );
}
