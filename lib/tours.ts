/**
 * Guided tours, one per page.
 *
 * A tour is a list of steps; each step optionally names an element to spotlight.
 * **A step whose target is not on the page is dropped at start time**, which is
 * what makes these safe for the people they exist for: a first-time user has no
 * properties, no tenants and no leases, so half the things a tour would point
 * at simply are not rendered yet. Anchors are `data-tour` attributes rather than
 * class or structural selectors, so restyling a page cannot silently break its
 * tour.
 *
 * `TOURS_VERSION` is stored alongside each user's seen-list. Bumping it
 * re-shows every tour to everyone, which is the point: a rewritten tour is a
 * new tour.
 */

export type TourStep = {
  /**
   * CSS selector for the element to spotlight. Omitted for a centred step,
   * used for openings and closings that are about the page as a whole.
   */
  target?: string;
  title: string;
  body: string;
};

export type Tour = {
  /** Stable id, and what is recorded in a user's `toursSeen`. */
  id: string;
  /** Route this tour belongs to. Matched **exactly** — see `findTourForPath`. */
  route: string;
  /** Shown in the help menu. */
  label: string;
  steps: TourStep[];
};

/** Bumping this re-shows every tour to everyone. See `User.toursSeenVersion`. */
export const TOURS_VERSION = 1;

const SIDEBAR = '[data-tour="sidebar-nav"]';
const SEARCH = '[data-tour="global-search"]';
const HELP = '[data-tour="tour-help"]';
const TABLE = '[data-tour="data-table"]';

export const TOURS: Tour[] = [
  {
    id: "dashboard",
    route: "/dashboard",
    label: "Dashboard tour",
    steps: [
      {
        title: "Welcome to Rentops",
        body: "A quick look around — under a minute. You can leave at any point, and replay this later from the help menu.",
      },
      {
        target: SIDEBAR,
        title: "Everything lives here",
        body: "Properties hold units, tenants rent them, leases connect the two, and payments settle the invoices each lease raises.",
      },
      {
        target: '[data-tour="dashboard-stats"]',
        title: "Your month, at a glance",
        body: "Rent collected, what is still outstanding, and what your empty units are costing you. Each card links through to the full list.",
      },
      {
        target: SEARCH,
        title: "Find anything, instantly",
        body: "One box across properties, units, tenants, leases and payments. Search a phone number and get the tenant. ⌘K opens it from anywhere.",
      },
      {
        target: HELP,
        title: "Lost? Start here",
        body: "Every page has its own tour. This menu replays the one you are on, or resets them all so they greet you fresh again.",
      },
    ],
  },
  {
    id: "properties",
    route: "/properties",
    label: "Properties tour",
    steps: [
      {
        title: "Properties",
        body: "A property is a building. Each one holds the units you actually rent out — this is where a new portfolio starts.",
      },
      {
        target: '[data-tour="add-property"]',
        title: "Add your first building",
        body: "Name and location are all that is required. Status, description and amenities sit under “Other property details”, and can wait.",
      },
      {
        target: '[data-tour="property-filters"]',
        title: "Narrow the list",
        body: "Split residential from commercial once you are running more than a handful of buildings.",
      },
      {
        target: '[data-tour="property-card"]',
        title: "Occupancy at a glance",
        body: "Each card shows how many units are filled and what the building bills each month. View, edit and delete sit along the bottom.",
      },
    ],
  },
  {
    id: "tenants",
    route: "/tenants",
    label: "Tenants tour",
    steps: [
      {
        title: "Tenants",
        body: "The people renting your units. A tenant is added once and keeps every lease they have ever held with you.",
      },
      {
        target: '[data-tour="add-tenant"]',
        title: "Add a tenant",
        body: "A phone number is the one thing required — many tenants have no email. You can also import an existing list in bulk.",
      },
      {
        target: TABLE,
        title: "Status works itself out",
        body: "Active, upcoming, prospect or vacated is derived from their leases, never typed in — so it cannot fall out of date.",
      },
    ],
  },
  {
    id: "leases",
    route: "/leases",
    label: "Leases tour",
    steps: [
      {
        title: "Leases",
        body: "A lease puts one tenant in one unit for a fixed term, and raises the invoice that rent is paid against.",
      },
      {
        target: '[data-tour="add-lease"]',
        title: "Create a lease",
        body: "Pick a property, a free unit and a tenant, then a start date and a duration. The end date and total are worked out for you.",
      },
      {
        target: TABLE,
        title: "Nothing slips past",
        body: "Expiring leases are flagged as their end date nears, and units you mark as auto-renewing carry themselves over.",
      },
    ],
  },
  {
    id: "payments",
    route: "/payments",
    label: "Payments tour",
    steps: [
      {
        title: "Payments",
        body: "Every payment recorded against an invoice — M-Pesa, Tigo Pesa, Airtel Money, bank transfer or cash.",
      },
      {
        target: '[data-tour="add-payment"]',
        title: "Record a payment",
        body: "Rent can arrive in instalments. Record as many payments against an invoice as it takes; the balance keeps itself current.",
      },
      {
        target: TABLE,
        title: "What is still owed",
        body: "Filter by status to see what remains unpaid or partly paid, and chase from a list rather than from memory.",
      },
    ],
  },
  {
    id: "users",
    route: "/users",
    label: "Users tour",
    steps: [
      {
        title: "Your team",
        body: "Managers and caretakers you work with. Everyone gets their own login — nobody shares a password.",
      },
      {
        target: '[data-tour="invite-user"]',
        title: "Invite by link",
        body: "Send someone a link and they set their own password. Revoke an invitation any time before it is used.",
      },
    ],
  },
];

/**
 * Exact route match only.
 *
 * This used to be a longest-prefix match, so `/properties/<id>` inherited the
 * Properties tour. That was wrong in a way that quietly cost people the tour
 * entirely: every step of that tour points at the *list* page — the Add
 * button, the filters, a property card — none of which exist on a detail page.
 * Opening one first therefore played a single orphaned title card, and
 * finishing it marked the whole tour seen, so the real four-step tour never ran
 * again. Reproduced before changing it: a property detail page showed
 * "Step 1 of 1" and wrote `properties` into the seen list.
 *
 * A detail page that deserves its own tour should get its own entry here, with
 * steps pointing at things that are actually on it.
 */
export function findTourForPath(pathname: string): Tour | undefined {
  return TOURS.find((tour) => tour.route === pathname);
}

/** Whether `id` names a real tour — used to validate ids arriving over HTTP. */
export function isTourId(id: string): boolean {
  return TOURS.some((tour) => tour.id === id);
}
