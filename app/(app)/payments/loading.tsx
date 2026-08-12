import { DataTableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function PaymentsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-36" />
      </div>
      <DataTableSkeleton columns={7} rows={6} filters={2} />
    </div>
  );
}
