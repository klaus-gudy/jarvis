/**
 * Shapes for the member "SMS alerts" tab. Prisma-free: the client tab imports
 * these, and the server side (`lib/sms/notifier.ts`) produces them.
 *
 * The statuses mirror notifier's `NotificationStatus` enum — notifier owns the
 * audit trail, this app only reads it.
 */
export const SMS_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SENT",
  "DELIVERED",
  "FAILED",
] as const;

export type SmsStatus = (typeof SMS_STATUSES)[number];

export const SMS_STATUS_LABELS: Record<SmsStatus, string> = {
  PENDING: "Queued",
  PROCESSING: "Sending",
  SENT: "Sent",
  DELIVERED: "Delivered",
  FAILED: "Failed",
};

export type SmsAlert = {
  id: string;
  /** Which service asked for it — "Automatifier" for lease reminders. */
  serviceName: string;
  recipient: string;
  message: string;
  status: SmsStatus;
  errorMessage: string | null;
  createdAt: string;
};

export type SmsAlertsPage = {
  alerts: SmsAlert[];
  total: number;
  page: number;
  totalPages: number;
};

export const SMS_PAGE_SIZE = 20;
