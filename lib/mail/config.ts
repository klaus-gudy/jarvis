/**
 * The mail service's wire format, and the settings that decide where a message
 * goes. Dependency-free so anything can import the type.
 */

/**
 * Exactly what the mail service expects on the queue. It renders nothing of its
 * own — it takes a finished email and sends it — so every decision about what a
 * message *says* is made here, in `lib/mail/`, and none of it is made there.
 *
 * `service_name` is snake_case because the consumer's contract says so; it is
 * not this codebase's convention and shouldn't be copied elsewhere.
 */
export type MailMessage = {
  email: string;
  subject: string;
  /** An HTML *fragment*, not a document — see `lib/mail/layout.ts`. */
  content: string;
  service_name: string;
};

/**
 * Routing keys for the section-A (auth) emails. A topic exchange carries them,
 * so the mail service can bind `#` today and split `auth.password.*` onto its
 * own queue later without this app changing.
 */
export const MAIL_ROUTING_KEYS = [
  "auth.user.registered",
  "auth.email.verification_requested",
  "auth.password.reset_requested",
  "auth.password.reset_completed",
  "auth.password.changed",
  "auth.login.locked_out",
  "org.created",
] as const;

export type MailRoutingKey = (typeof MAIL_ROUTING_KEYS)[number];

/**
 * Defaults match `docker-compose.yml`, so a fresh checkout works with no
 * `.env` entry at all. Set `RABBITMQ_URL` on the deploy target.
 */
export const RABBITMQ_URL =
  process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5682";

/** Topic exchange every email is published to. */
export const MAIL_EXCHANGE = process.env.MAIL_EXCHANGE ?? "jarvis.emails";

/** The queue the mail service consumes. Declared here so publishing to a
 * broker nobody has consumed from yet still durably holds the messages. */
export const MAIL_QUEUE = process.env.MAIL_QUEUE ?? "emails.outbound";

/** Where a message goes when the consumer rejects it, instead of vanishing. */
export const MAIL_DLX = `${MAIL_EXCHANGE}.dlx`;
export const MAIL_DLQ = `${MAIL_QUEUE}.dead`;

/** The `service_name` stamped on every message. */
export const MAIL_SERVICE_NAME = process.env.MAIL_SERVICE_NAME ?? "Jarvis";
