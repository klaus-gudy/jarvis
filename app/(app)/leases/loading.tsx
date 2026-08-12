import { DataTableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeasesLoading() {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-32" />
      </div>
      <DataTableSkeleton columns={8} rows={6} filters={1} />
    </div>
  );
}
