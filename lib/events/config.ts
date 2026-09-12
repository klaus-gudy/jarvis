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

/**
 * Keys this app *consumes*. Kept apart from what it publishes: they are two
 * different lists that happen to share an exchange, and merging them would let
 * a typo bind a queue to something nothing ever sends.
 */
export const CONSUMED_ROUTING_KEYS = ["document.stored"] as const;

export type ConsumedRoutingKey = (typeof CONSUMED_ROUTING_KEYS)[number];

export type EventRoutingKey = (typeof EVENT_ROUTING_KEYS)[number];

/**
 * **The name of an event and the key it travels under are two different
 * things**, and only the second one belongs in `.env`.
 *
 * The lists above are *identities*: `DomainEvent` is keyed by them, so
 * `publishEvent("lease.created", …)` type-checks its payload against the right
 * shape and a typo is a build error. That only works while they are literal —
 * read from the environment they collapse to `string`, and the mapping that
 * makes this file worth having disappears with them.
 *
 * So the identity stays in code and the **wire key** moves out. These two maps
 * are the one place the two meet: everything that touches the broker routes
 * through them, and nothing else in the app spells a dotted key out.
 *
 * Each is a **contract with `document-worker`, not a preference** — it must
 * match that service's own setting character for character. Get it wrong and
 * nothing errors: a topic exchange routes the message to no queue at all and
 * drops it, which is the quietest failure in the system. Change both sides
 * together.
 *
 * | this app | document-worker |
 * |---|---|
 * | `LEASE_CREATED_ROUTING_KEY` | `EVENT_ROUTING_KEY` |
 * | `DOCUMENT_STORED_ROUTING_KEY` | `EVENT_COMPLETION_ROUTING_KEY` |
 */
export const ROUTING_KEY: Record<EventRoutingKey, string> = {
  "lease.created": process.env.LEASE_CREATED_ROUTING_KEY ?? "lease.created",
};

export const CONSUMED_ROUTING_KEY: Record<ConsumedRoutingKey, string> = {
  "document.stored":
    process.env.DOCUMENT_STORED_ROUTING_KEY ?? "document.stored",
};

/**
 * A lease now exists — **and here is the contract to make from it.**
 *
 * These two fields are the whole message, and that is the `document-worker`
 * service's contract, not a preference: it checks both are present and
 * non-empty and rejects the message otherwise. It renders the HTML exactly as
 * given and puts the PDF at exactly that key — it reads no database and
 * resolves no template, which is what keeps a service carrying a 100MB browser
 * free of any model of what a lease is.
 *
 * **Nothing else is sent, deliberately.** No lease id, no organization id. The
 * worker cannot echo back what it was never told, and it does not need to: the
 * key *is* the correlation id, because this side chose it and this side knows
 * what it means. See `parseContractObjectKey`.
 *
 * Note the trade-off, made deliberately: a snapshot in a message goes stale the
 * moment the template is edited. For a contract that is the *point* — the
 * wording in force when the lease was signed is the wording that should be
 * filed, not whatever the template says by the time the queue is drained.
 */
export type LeaseCreatedEvent = {
  /**
   * A **complete** HTML document with the stylesheet inlined — the output of
   * `printableDocument()`, not a bare template body. The worker adds nothing,
   * and blocks remote content at the network layer, so a linked stylesheet
   * would silently fail to load and file an unstyled contract.
   */
  html: string;
  /**
   * `organizations/<orgId>/leases/<leaseId>/<uuid>.pdf`, from `buildObjectKey`
   * — the same function every uploaded file's key comes from, so a generated
   * contract sits in the bucket exactly where a scanned one would. Also the
   * only thing tying the eventual `document.stored` back to this lease.
   */
  objectKey: string;
  /**
   * Printed at the foot of every page, beside a page counter — the template
   * name and the contract reference.
   *
   * The one piece of the page the renderer takes from this message. It owns the
   * layout (margins, format, whether a footer is drawn at all) precisely so a
   * filed contract is reproducible; the *words* are content only this side
   * knows. Capped at 200 characters on arrival, matching the renderer's HTTP
   * route.
   */
  footerText: string;
  /**
   * Our own details, carried so they come back on `document.stored`.
   *
   * The renderer treats this as **opaque** — it echoes it and never reads it,
   * which is exactly what lets it carry a lease id without learning what a
   * lease is. Everything in here is a fact this side already had while the
   * lease was in hand, so the consumer files the row without re-reading the
   * database to reconstruct a file name.
   *
   * Deliberately small: it rides on every message and returns on every
   * completion.
   */
  meta: LeaseContractMeta;
};

/**
 * What travels out on `lease.created` and comes back on `document.stored`.
 *
 * **Not authoritative on the way back.** It has been over a message bus, so
 * the consumer treats it as a claim: `organizationId` and `leaseId` are
 * re-derived from the object key (which this app built) and used to *check*
 * these rather than the other way round. What meta is genuinely for is the
 * cosmetic half — the file name and the blank-placeholder list — where being
 * wrong costs a label, not a tenancy boundary.
 */
export type LeaseContractMeta = {
  organizationId: string;
  leaseId: string;
  contractNumber: string;
  /** `contract-<contractNumber>.pdf`. */
  fileName: string;
  /** Known tokens the template used that had nothing behind them. */
  missing: string[];
};

/**
 * The PDF is in the bucket.
 *
 * Published by `document-worker` once `putObject` has returned, and consumed
 * here to create the `FileAsset` row. It carries no domain ids by design —
 * only the key it was given — so this side recovers the lease from the key it
 * built in the first place.
 *
 * The row is written *after* the object rather than before it, which is the
 * rule Phase 67 already settled: the failure that survives should be an
 * orphaned object, which is wasted bytes, not a row that renders as a document
 * nobody can open.
 */
export type DocumentStoredEvent = {
  /** The same key `lease.created` specified. */
  objectKey: string;
  /** `application/pdf`. */
  contentType: string;
  /** Size of the stored object, so `FileAsset.sizeBytes` is measured not guessed. */
  sizeBytes: number;
  /** ISO 8601. When the upload finished, not when this message is read. */
  storedAt: string;
  /**
   * Whatever `lease.created` put in its own `meta`, returned untouched.
   *
   * Optional because the renderer omits it when the request carried none —
   * and because a message published before this field existed has to keep
   * working. The consumer falls back to deriving what it needs from the key.
   */
  meta?: Partial<LeaseContractMeta>;
};

export type DomainEvent = {
  "lease.created": LeaseCreatedEvent;
};

export type ConsumedEvent = {
  "document.stored": DocumentStoredEvent;
};

/**
 * Where a message goes when a consumer rejects it.
 *
 * **`direct`, and that is a contract with `document-worker`, not a preference.**
 * Both apps declare an exchange of this name, and an exchange's type is fixed
 * at creation — this was declared `fanout` here and `direct` there, so whichever
 * asserted second got `PRECONDITION_FAILED` and lost its channel. `direct` is
 * the one that survives: every listener's rejects come through one exchange
 * routed by the *originating queue's own name*, so each queue's failures land
 * only in its own holding area, where a fanout would copy each one into all of
 * them.
 */
export const EVENTS_DLX_TYPE = "direct" as const;

/**
 * This app's own mailbox, for the events it consumes rather than publishes.
 *
 * Named for *who consumes*, in caps, matching `DOCUMENT_WORKER_QUEUE` on the
 * other side — a queue is who listens, a routing key is what happened, and
 * naming a queue after an event is what made them look like one thing.
 *
 * It replaces `contracts.generate`, which bound `lease.created` and rendered
 * PDFs here. That queue is gone: rendering belongs to `document-worker` now,
 * and leaving it bound would mean two services racing to produce one contract.
 */
export const DOCUMENTS_QUEUE =
  process.env.DOCUMENTS_QUEUE ?? "JARVIS_DOCUMENTS_QUEUE";

/** Derived, not configured, so the pair cannot drift apart. */
export const DOCUMENTS_DLQ = `${DOCUMENTS_QUEUE}_DEAD`;

/**
 * What `DOCUMENTS_QUEUE` binds to on the events exchange — the configured wire
 * keys, not the internal names, so a key overridden in `.env` is the key the
 * queue actually listens on.
 */
export const DOCUMENTS_BINDINGS: string[] = CONSUMED_ROUTING_KEYS.map(
  (name) => CONSUMED_ROUTING_KEY[name]
);
