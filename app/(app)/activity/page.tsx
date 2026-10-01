import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { requireStaffPage } from "@/lib/authz";

export const metadata = { title: "Activity" };

/**
 * Everything that happened across the organization, newest first — where the
 * dashboard's Recent activity panel leads. Each record's own page has the same
 * timeline narrowed to it.
 */
export default async function ActivityPage() {
  await requireStaffPage("dashboard:read");
  return (
    <div className="mx-auto w-full max-w-4xl">
      <ActivityTimeline emptyMessage="Nothing has happened in this organization yet." />
    </div>
  );
}
