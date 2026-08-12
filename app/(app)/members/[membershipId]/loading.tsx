import { DetailCardSkeleton, TabsSkeleton } from "@/components/skeletons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MemberDetailLoading() {
  return (
    <div className="space-y-6">
      <Card className="gap-0 p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          {/* Avatar with initials */}
          <Skeleton className="size-12 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </Card>

      {/* Profile / Leases */}
      <TabsSkeleton tabs={2} />

      <DetailCardSkeleton rows={6} />
    </div>
  );
}
