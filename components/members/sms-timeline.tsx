import { APP_TIME_ZONE } from "@/lib/dates";
import { SMS_STATUS_LABELS, type SmsAlert, type SmsStatus } from "@/lib/sms/sms-types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<SmsStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PROCESSING: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  SENT: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  DELIVERED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  FAILED: "bg-destructive/10 text-destructive",
};

const STATUS_DOT: Record<SmsStatus, string> = {
  PENDING: "bg-muted-foreground",
  PROCESSING: "bg-sky-500",
  SENT: "bg-amber-500",
  DELIVERED: "bg-emerald-500",
  FAILED: "bg-destructive",
};

// Everything on the landlord's clock, so a text sent at 01:00 in Dar es Salaam
// sits under that day rather than the UTC day before.
const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

/** Consecutive alerts (already newest first) grouped under their day. */
function groupByDay(alerts: SmsAlert[]) {
  const days: { key: string; label: string; alerts: SmsAlert[] }[] = [];
  for (const alert of alerts) {
    const date = new Date(alert.createdAt);
    const key = dayKey.format(date);
    const last = days.at(-1);
    if (last?.key === key) last.alerts.push(alert);
    else days.push({ key, label: dayLabel.format(date), alerts: [alert] });
  }
  return days;
}

/**
 * SMS alerts as a timeline: a day heading, then each message hanging off one
 * rail, its dot coloured by delivery status.
 *
 * `surface` is what the timeline sits on — inside a card on desktop, straight
 * on the page on a phone — so the bubbles and the dot's ring can contrast with
 * it instead of vanishing into it.
 */
export function SmsTimeline({
  alerts,
  surface,
  animate = false,
}: {
  alerts: SmsAlert[];
  surface: "card" | "page";
  /** Fade newly revealed items in, as the mobile card lists do. */
  animate?: boolean;
}) {
  return (
    <div className="space-y-5">
      {groupByDay(alerts).map((day) => (
        <section key={day.key} aria-label={day.label}>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">
            {day.label}
          </h3>
          <ol className="relative ml-1.5 space-y-3 border-l border-border pl-5">
            {day.alerts.map((alert) => (
              <li
                key={alert.id}
                className={cn(
                  "relative",
                  animate &&
                    "duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-3.5 -left-[25.5px] size-2.5 rounded-full ring-4",
                    surface === "card" ? "ring-card" : "ring-background",
                    STATUS_DOT[alert.status]
                  )}
                />
                <div
                  className={cn(
                    "space-y-1.5 rounded-xl p-3 ring-1 ring-foreground/10",
                    surface === "card" ? "bg-background/60" : "bg-card"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <time dateTime={alert.createdAt} className="tabular-nums">
                      {timeLabel.format(new Date(alert.createdAt))}
                    </time>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-medium",
                        STATUS_TONE[alert.status]
                      )}
                    >
                      {SMS_STATUS_LABELS[alert.status] ?? alert.status}
                    </span>
                    <span className="ml-auto">{alert.serviceName}</span>
                  </div>
                  <p className="text-sm whitespace-pre-line">{alert.message}</p>
                  {alert.status === "FAILED" && alert.errorMessage && (
                    <p className="text-xs text-destructive">{alert.errorMessage}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
