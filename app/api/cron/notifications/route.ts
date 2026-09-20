import { syncLeaseStatuses } from "@/lib/lease-lifecycle";
import { runNotificationSweep } from "@/lib/notifications/sweep";

/**
 * The scheduler this app has never had.
 *
 * Auto-renewal used to solve the same problem by running lazily at the top of
 * `/leases` and `/dashboard`, which was defensible for a database write nobody
 * sees; it now arrives as an event from `automatifier`, which owns the clock.
 * A page load was never defensible for email: so a reminder would arrive when someone happened to
 * open the app rather than when it was due — and an organization whose owner
 * takes a week off would send nothing all week.
 *
 * Point any scheduler at this once an hour:
 *
 *   curl -X POST https://<host>/api/cron/notifications \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * Running it more often is harmless — every send is claimed through a unique
 * key first, so the second run of an hour finds nothing left to do.
 */

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Refused rather than run open: this endpoint emails real people, so an
  // unset secret is a misconfiguration, not a reason to skip the check.
  if (!secret) {
    console.error("[cron] CRON_SECRET is not set — refusing to run");
    return Response.json({ error: "Not configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  try {
    /*
     * Upcoming → Active, the one status change no event announces: a term
     * *ending* arrives as `lease.renewal` or `lease.vacating`, but a lease
     * starting is not something anybody publishes. Cheap, idempotent, and
     * first, so a reminder is never decided against a stale status.
     */
    const { started: activated } = await syncLeaseStatuses();
    const result = await runNotificationSweep();
    const ms = Date.now() - started;
    console.log(
      `[cron] sweep done in ${ms}ms: ${activated} lease(s) now Active, ${result.leaseExpiring} lease-expiring, ${result.invoiceOverdue} overdue, ${result.skipped} already sent`
    );
    return Response.json({ ok: true, activated, ...result, ms });
  } catch (error) {
    console.error("[cron] sweep failed:", error);
    return Response.json({ error: "Sweep failed" }, { status: 500 });
  }
}
