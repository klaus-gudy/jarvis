import { ShieldOffIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";

/**
 * Where `requireStaffPage` sends a staff member whose role opens no page at
 * all — a custom role saved with nothing ticked, say. Not an error: the
 * account works, the role just grants nothing yet.
 */
export default function NoAccessPage() {
  return (
    <EmptyState
      icon={ShieldOffIcon}
      title="Nothing to show yet"
      description="Your role doesn't include access to any section. Ask an Owner of this organization to update it."
    />
  );
}
