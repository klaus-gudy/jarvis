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
  limit: number;
  totalPages: number;
};

export const SMS_DEFAULT_PAGE_SIZE = 20;

/**
 * Three 160-character segments. A cost guard rather than a provider limit
 * (notifier takes 1600): every segment is billed, and an alert that needs more
 * than three belongs in a document, not a text.
 */
export const SMS_MAX_LENGTH = 480;
export const SMS_SEGMENT_LENGTH = 160;

/** Rows per page the tab offers; notifier's own ceiling is 100. */
export const SMS_PAGE_SIZES = [10, 20, 50, 100] as const;
