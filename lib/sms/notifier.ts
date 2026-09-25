import type { SmsAlert, SmsAlertsPage, SmsStatus } from "@/lib/sms/sms-types";

/**
 * Reads the SMS audit trail from `notifier` (`../notifier`,
 * `GET /api/v1/notifications`). That service sends every SMS and keeps a row
 * per message; this app keeps none, so there is nothing to query locally.
 *
 * Notifier's rows carry a phone number and a service name, **not an
 * organization** — the only link from a member to their messages is the
 * number. Server-only: the base URL is internal and the API has no auth of
 * its own, so it must never be reachable from the browser.
 */
const NOTIFIER_API_URL = process.env.NOTIFIER_API_URL?.replace(/\/+$/, "");

/** Keeps a slow notifier from holding the tab's request open. */
const TIMEOUT_MS = 8_000;

export type SmsQuery = {
  /** International `255…` form — notifier matches exactly. */
  recipient: string;
  status?: SmsStatus;
  /** ISO timestamps, inclusive. */
  from?: string;
  to?: string;
  page: number;
  limit: number;
};

export type SmsLookupResult =
  | { ok: true; data: SmsAlertsPage }
  | { ok: false; reason: "not-configured" | "unavailable" };

type NotifierSummary = {
  id: string;
  service_name: string;
  channel: string;
  recipient: string;
  message: string;
  status: SmsStatus;
  error_message: string | null;
  created_at: string;
};

type NotifierPage = {
  data: NotifierSummary[];
  meta: { total: number; page: number; limit: number; total_pages: number };
};

export async function searchSmsAlerts(query: SmsQuery): Promise<SmsLookupResult> {
  if (!NOTIFIER_API_URL) return { ok: false, reason: "not-configured" };

  const params = new URLSearchParams({
    recipient: query.recipient,
    page: String(query.page),
    limit: String(query.limit),
  });
  if (query.status) params.set("status", query.status);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);

  let body: NotifierPage;
  try {
    const response = await fetch(
      `${NOTIFIER_API_URL}/api/v1/notifications?${params}`,
      { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!response.ok) {
      console.error(`[sms] notifier answered ${response.status}`);
      return { ok: false, reason: "unavailable" };
    }
    body = (await response.json()) as NotifierPage;
  } catch (error) {
    console.error("[sms] notifier unreachable", error);
    return { ok: false, reason: "unavailable" };
  }

  // Notifier can't filter by channel. A phone number never matches an email
  // recipient, so this is belt and braces rather than the real filter.
  const alerts: SmsAlert[] = body.data
    .filter((row) => row.channel === "SMS")
    .map((row) => ({
      id: row.id,
      serviceName: row.service_name,
      recipient: row.recipient,
      message: row.message,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));

  return {
    ok: true,
    data: {
      alerts,
      total: body.meta.total,
      page: body.meta.page,
      limit: body.meta.limit,
      totalPages: body.meta.total_pages,
    },
  };
}

/** What notifier's audit rows name as the sender for texts typed in Jarvis. */
const SERVICE_NAME = "Jarvis";

/**
 * Longer than a search: notifier contacts the provider inside the request and
 * may retry with backoff before it answers.
 */
const SEND_TIMEOUT_MS = 20_000;

export type SmsSendResult =
  | { ok: true; status: SmsStatus }
  /** Notifier kept an audit row, marked FAILED — it shows in the list. */
  | { ok: false; reason: "rejected"; error: string | null }
  | { ok: false; reason: "not-configured" | "unavailable" };

/**
 * Sends one SMS through notifier's `POST /api/v1/sms/send`, synchronously, so
 * the person who pressed Send hears whether the provider took it. Notifier
 * writes the audit row before contacting the provider, so a refusal is still
 * on record (502 with the row id).
 */
export async function sendSms(input: {
  /** International `255…` form. */
  recipient: string;
  message: string;
}): Promise<SmsSendResult> {
  if (!NOTIFIER_API_URL) return { ok: false, reason: "not-configured" };

  try {
    const response = await fetch(`${NOTIFIER_API_URL}/api/v1/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone_number: input.recipient,
        message: input.message,
        service_name: SERVICE_NAME,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => ({}));

    if (response.ok) return { ok: true, status: body.status as SmsStatus };
    if (response.status === 502 && body.notification_id) {
      return { ok: false, reason: "rejected", error: body.error ?? null };
    }
    console.error(`[sms] notifier send answered ${response.status}`, body);
    return { ok: false, reason: "unavailable" };
  } catch (error) {
    console.error("[sms] notifier unreachable on send", error);
    return { ok: false, reason: "unavailable" };
  }
}
