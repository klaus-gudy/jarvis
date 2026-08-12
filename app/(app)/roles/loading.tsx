import { DataTableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function RolesLoading() {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-28" />
      </div>
      <DataTableSkeleton columns={4} rows={5} filters={1} />
    </div>
  );
}
