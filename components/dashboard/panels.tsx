import {
  ClockIcon,
  DoorOpenIcon,
  FileTextIcon,
  HistoryIcon,
  MailPlusIcon,
  PieChartIcon,
} from "lucide-react";

import { DashboardPanel, PanelRow } from "@/components/dashboard/panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type {
  ActivityRow,
  MoveInRow,
  NeedsInviteRow,
  PanelList,
  RenewalRow,
  VacantUnitRow,
} from "@/lib/dashboard";
import { formatCurrency, formatDayMonth, formatRelativeTime } from "@/lib/format";
import type { PropertySummary } from "@/lib/properties";
import { initials } from "@/lib/user-display";

/** Matches the tables' person cells, so the same tenant looks the same anywhere. */
function PersonAvatar({ name, photoId }: { name: string; photoId: string | null }) {
  return (
    <Avatar className="size-8 shrink-0">
      {photoId && <AvatarImage src={`/api/documents/${photoId}`} alt={name} />}
      <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

/** Leases running out inside 90 days, soonest first. */
export function RenewalsPanel({
  renewals,
}: {
  renewals: PanelList<RenewalRow>;
}) {
  return (
    <DashboardPanel
      title="Renewals due"
      icon={ClockIcon}
      href="/leases"
      linkLabel="All leases"
      count={renewals.total}
      empty="No leases ending in the next 90 days."
    >
      {renewals.items.map((renewal) => (
        <PanelRow
          key={renewal.id}
          href={`/leases/${renewal.id}`}
          leading={<PersonAvatar name={renewal.tenantName} photoId={renewal.photoId} />}
          title={renewal.tenantName}
          subtitle={`${renewal.propertyName} / ${renewal.unitLabel}`}
          trailing={`${renewal.daysLeft}d`}
          trailingCaption={formatDayMonth(renewal.endDate)}
          // Under a month left is the point where it stops being a diary note.
          tone={renewal.daysLeft <= 30 ? "accent" : "default"}
        />
      ))}
    </DashboardPanel>
  );
}

/** Leases that start within the month — units to have ready. */
export function MoveInsPanel({ moveIns }: { moveIns: PanelList<MoveInRow> }) {
  return (
    <DashboardPanel
      title="Upcoming move-ins"
      icon={DoorOpenIcon}
      href="/leases"
      linkLabel="All leases"
      count={moveIns.total}
      empty="No move-ins scheduled in the next 30 days."
    >
      {moveIns.items.map((moveIn) => (
        <PanelRow
          key={moveIn.id}
          href={`/leases/${moveIn.id}`}
          leading={<PersonAvatar name={moveIn.tenantName} photoId={moveIn.photoId} />}
          title={moveIn.tenantName}
          subtitle={`${moveIn.propertyName} / ${moveIn.unitLabel}`}
          trailing={moveIn.daysUntil === 0 ? "today" : `${moveIn.daysUntil}d`}
          trailingCaption={formatDayMonth(moveIn.startDate)}
        />
      ))}
    </DashboardPanel>
  );
}

/** Empty units, longest-standing first — what to market next. */
export function VacantUnitsPanel({
  units,
}: {
  units: PanelList<VacantUnitRow>;
}) {
  return (
    <DashboardPanel
      title="Longest vacant"
      icon={DoorOpenIcon}
      href="/properties"
      linkLabel="Properties"
      count={units.total}
      empty="Every unit is occupied."
    >
      {units.items.map((unit) => (
        <PanelRow
          key={unit.id}
          href={`/properties/${unit.propertyId}`}
          title={`${unit.propertyName} / ${unit.label}`}
          subtitle={`${formatCurrency(unit.rentAmount)}/mo going unearned`}
          trailing={
            unit.daysVacant === null ? "Never let" : `${unit.daysVacant}d`
          }
          trailingCaption={unit.daysVacant === null ? undefined : "vacant"}
          tone="accent"
        />
      ))}
    </DashboardPanel>
  );
}

/** Where the headline occupancy rate actually comes from, worst first. */
export function OccupancyPanel({
  properties,
}: {
  properties: PropertySummary[];
}) {
  return (
    <DashboardPanel
      title="Occupancy by property"
      icon={PieChartIcon}
      href="/properties"
      linkLabel="Properties"
      empty="No properties yet."
    >
      {properties.map((property) => (
        <li key={property.id} className="px-5 py-3">
          {/* Name and figures share one line so each property costs two rows
              rather than three — the caption used to sit under the bar. */}
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm">
              <span className="font-medium">{property.name}</span>
              <span className="text-muted-foreground">
                {" · "}
                {property.totalUnits === 0
                  ? "No units yet"
                  : `${property.occupiedUnits}/${property.totalUnits} units · ${formatCurrency(
                      property.monthlyRentRoll
                    )}/mo`}
              </span>
            </p>
            {property.totalUnits > 0 && (
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {property.occupancyRate}%
              </p>
            )}
          </div>
          {/* No units means no occupancy to draw. A 0% bar would read as a
              building standing empty, which is a different problem. */}
          {property.totalUnits > 0 && (
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={property.occupancyRate}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${property.name} occupancy`}
            >
              <div
                className="h-full rounded-full bg-stat-accent transition-all"
                style={{ width: `${property.occupancyRate}%` }}
              />
            </div>
          )}
        </li>
      ))}
    </DashboardPanel>
  );
}

/** Members recorded in the org who still have no way to sign in. */
export function NeedsInvitePanel({
  members,
}: {
  members: PanelList<NeedsInviteRow>;
}) {
  return (
    <DashboardPanel
      title="Awaiting invite"
      icon={MailPlusIcon}
      href="/users"
      linkLabel="Users"
      count={members.total}
      empty="Everyone can sign in."
    >
      {members.items.map((member) => (
        <PanelRow
          key={member.membershipId}
          href={`/members/${member.membershipId}`}
          leading={<PersonAvatar name={member.name} photoId={member.photoId} />}
          title={member.name}
          subtitle={member.contact ?? "No contact on file"}
          trailing={member.roleName}
          tone="muted"
        />
      ))}
    </DashboardPanel>
  );
}

/** Leases signed and tenants added, newest first. */
export function ActivityPanel({ activity }: { activity: ActivityRow[] }) {
  return (
    <DashboardPanel
      title="Recent activity"
      icon={HistoryIcon}
      href="/leases"
      linkLabel="All leases"
      empty="Nothing has happened yet."
    >
      {activity.map((entry) => (
        <PanelRow
          key={entry.id}
          leading={
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {entry.kind === "lease" ? (
                <FileTextIcon className="size-4" aria-hidden />
              ) : (
                <MailPlusIcon className="size-4" aria-hidden />
              )}
            </span>
          }
          title={entry.title}
          subtitle={entry.subtitle}
          trailing={formatRelativeTime(entry.createdAt)}
          tone="muted"
        />
      ))}
    </DashboardPanel>
  );
}
