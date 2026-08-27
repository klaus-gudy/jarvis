/**
 * Domain events — things that *happened*, published for anything that cares to
 * react to them. Dependency-free so a consumer can import the types without
 * pulling in Prisma or the publisher.
 *
 * **A separate exchange from `lib/mail/`, deliberately.** `jarvis.emails`
 * carries finished emails: its queue binds `#`, and the mail service treats
 * everything it receives as a `MailMessage` to send. A domain event published
 * there would be mailed to nobody and dead-lettered. The two happen to share
 * some routing-key names (`lease.created` exists on both) precisely because
 * they describe the same occurrence in two different vocabularies — one says
 * "tell these people", the other says "this is now true".
 */

/**
 * Defaults match `docker-compose.yml`, so a fresh checkout works with no `.env`
 * entry at all. Shared with the mail queue — one broker, two exchanges.
 */
export const RABBITMQ_URL =
  process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5682";

/** Topic exchange every domain event is published to. */
export const EVENTS_EXCHANGE = process.env.EVENTS_EXCHANGE ?? "jarvis.events";

/** Where a message goes when a consumer rejects it, instead of vanishing. */
export const EVENTS_DLX = `${EVENTS_EXCHANGE}.dlx`;

/**
 * Every routing key this app publishes as a domain event.
 *
 * A topic exchange carries them, so a second consumer can bind `lease.*` or
 * `#` later without this app changing — which is the whole reason the contract
 * worker is not simply called inline from the route handler.
 */
export const EVENT_ROUTING_KEYS = ["lease.created"] as const;

export type EventRoutingKey = (typeof EVENT_ROUTING_KEYS)[number];

/**
 * A lease now exists. Carries ids, not a snapshot of the lease: by the time a
 * consumer runs, the database is the truth and anything copied into the
 * message is already a guess about what it said. The consumer re-reads.
 */
export type LeaseCreatedEvent = {
  organizationId: string;
  leaseId: string;
  /** ISO 8601. Lets a consumer notice it is working through a backlog. */
  occurredAt: string;
};

export type DomainEvent = {
  "lease.created": LeaseCreatedEvent;
};

/**
 * One queue per *job*, not per event. `lease.created` may one day feed three
 * different consumers, and giving each its own queue is what lets a slow or
 * broken one fall behind without holding up the others.
 */
export const CONTRACT_QUEUE =
  process.env.CONTRACT_QUEUE ?? "contracts.generate";
export const CONTRACT_DLQ = `${CONTRACT_QUEUE}.dead`;

/** What `CONTRACT_QUEUE` binds to on the events exchange. */
export const CONTRACT_BINDINGS: EventRoutingKey[] = ["lease.created"];
