import { DetailCardSkeleton, TabsSkeleton } from "@/components/skeletons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PropertyDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header card: icon, name, "address · category · Owner: x" */}
      <Card className="gap-0 p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <Skeleton className="size-12 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </Card>

      {/* Overview / Units */}
      <TabsSkeleton tabs={2} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="gap-2 p-5 shadow-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-20" />
          </Card>
        ))}
      </div>

      <DetailCardSkeleton rows={6} />
    </div>
  );
}
