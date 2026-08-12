import { DataTableSkeleton, TabsSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function UsersLoading() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-28" />
      </div>
      {/* All users / Pending invites */}
      <TabsSkeleton tabs={2} />
      <DataTableSkeleton columns={5} rows={6} filters={1} />
    </div>
  );
}
