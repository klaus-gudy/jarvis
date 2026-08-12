import {
  DashboardPanelSkeleton,
  MetricCardSkeleton,
  PageHeadingSkeleton,
} from "@/components/skeletons";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />

      {/* Six cards in two rows of three, matching the real grid. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <MetricCardSkeleton key={index} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <DashboardPanelSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
