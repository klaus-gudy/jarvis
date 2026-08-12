import { DataTableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function TenantsLoading() {
  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-28" />
      </div>
      <DataTableSkeleton columns={6} rows={6} filters={1} />
    </div>
  );
}
