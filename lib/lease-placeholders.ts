import { CURRENCY, formatDate, formatMoneyFull } from "@/lib/format";

/**
 * Every token a lease template may carry, and the one place that knows how to
 * fill it in.
 *
 * Deliberately free of Prisma: the editor's placeholder panel is a client
 * component and imports this list, while the server builds a
 * `LeaseContractContext` from the database (`buildLeaseContext` in
 * `lib/lease-templates.ts`) and hands it here. One list, so a token offered in
 * the editor cannot be a token nothing resolves.
 */

export type PlaceholderGroup =
  | "Contract"
  | "Landlord"
  | "Tenant"
  | "Property"
  | "Unit"
  | "Lease terms";

/**
 * What a contract is generated *from*. Nullable throughout because most of it
 * is: a tenant onboarded by staff may have no email, a unit may have no floor,
 * and a contract that refuses to render until every optional field is filled
 * would be unusable. Unresolved tokens become a blank fill line and are
 * reported back to the caller instead.
 */
export type LeaseContractContext = {
  agreementDate: Date;
  contractNumber: string;
  organizationName: string | null;
  landlord: {
    name: string | null;
    email: string | null;
    phone: string | null;
    /** `data:image/png;base64,…` of the owner's drawn signature. */
    signature: string | null;
  };
  tenant: {
    name: string | null;
    nationalId: string | null;
    phone: string | null;
    email: string | null;
    nationality: string | null;
    occupation: string | null;
    nextOfKin: string | null;
    nextOfKinPhone: string | null;
    /** `data:image/png;base64,…` of the tenant's drawn signature. */
    signature: string | null;
  };
  property: {
    name: string | null;
    location: string | null;
    category: string | null;
  };
  unit: {
    name: string | null;
    type: string | null;
    floor: string | null;
    block: string | null;
    areaSqm: number | null;
  };
  lease: {
    startDate: Date | null;
    endDate: Date | null;
    months: number | null;
    rentAmount: number | null;
    totalAmount: number | null;
  };
};

export type Placeholder = {
  key: string;
  /** Shown beside the token in the editor panel. */
  label: string;
  group: PlaceholderGroup;
  /** Stands in for the real value while previewing an unsaved template. */
  example: string;
  /**
   * `signature` renders its value as an image rather than text — see
   * `renderLeaseTemplate`. Text when left out.
   */
  kind?: "text" | "signature";
  resolve: (context: LeaseContractContext) => string | null;
};

const money = (amount: number | null) =>
  amount === null ? null : formatMoneyFull(amount);
const date = (value: Date | null) => (value === null ? null : formatDate(value));

export const LEASE_PLACEHOLDERS: Placeholder[] = [
  {
    key: "agreement_date",
    label: "Contract generation date",
    group: "Contract",
    example: "26 Aug 2026",
    resolve: (context) => formatDate(context.agreementDate),
  },
  {
    key: "contract_number",
    label: "Auto-generated contract number",
    group: "Contract",
    example: "L-7F3QA",
    resolve: (context) => context.contractNumber,
  },
  {
    key: "organization_name",
    label: "Organization name",
    group: "Landlord",
    example: "Bahari Properties",
    resolve: (context) => context.organizationName,
  },
  {
    key: "landlord_name",
    label: "Owner full name",
    group: "Landlord",
    example: "Asha Mwinyi",
    resolve: (context) => context.landlord.name,
  },
  {
    key: "landlord_email",
    label: "Owner email",
    group: "Landlord",
    example: "asha@bahariproperties.co.tz",
    resolve: (context) => context.landlord.email,
  },
  {
    key: "landlord_phone",
    label: "Owner phone",
    group: "Landlord",
    example: "+255712345678",
    resolve: (context) => context.landlord.phone,
  },
  {
    key: "landlord_signature",
    label: "Owner signature",
    group: "Landlord",
    example: "[Owner signature]",
    kind: "signature",
    resolve: (context) => context.landlord.signature,
  },
  {
    key: "tenant_name",
    label: "Tenant full name",
    group: "Tenant",
    example: "Juma Salehe",
    resolve: (context) => context.tenant.name,
  },
  {
    key: "tenant_id",
    label: "National ID / Passport",
    group: "Tenant",
    example: "19900101-12345-00001-01",
    resolve: (context) => context.tenant.nationalId,
  },
  {
    key: "tenant_phone",
    label: "Tenant phone",
    group: "Tenant",
    example: "+255754112233",
    resolve: (context) => context.tenant.phone,
  },
  {
    key: "tenant_email",
    label: "Tenant email",
    group: "Tenant",
    example: "juma.salehe@example.com",
    resolve: (context) => context.tenant.email,
  },
  {
    key: "tenant_nationality",
    label: "Nationality",
    group: "Tenant",
    example: "Tanzanian",
    resolve: (context) => context.tenant.nationality,
  },
  {
    key: "tenant_occupation",
    label: "Occupation",
    group: "Tenant",
    example: "Teacher",
    resolve: (context) => context.tenant.occupation,
  },
  {
    key: "tenant_next_of_kin",
    label: "Emergency contact",
    group: "Tenant",
    example: "Neema Salehe",
    resolve: (context) => context.tenant.nextOfKin,
  },
  {
    key: "tenant_next_of_kin_phone",
    label: "Emergency contact phone",
    group: "Tenant",
    example: "+255768990011",
    resolve: (context) => context.tenant.nextOfKinPhone,
  },
  {
    key: "tenant_signature",
    label: "Tenant signature",
    group: "Tenant",
    example: "[Tenant signature]",
    kind: "signature",
    resolve: (context) => context.tenant.signature,
  },
  {
    key: "property_name",
    label: "Property name",
    group: "Property",
    example: "Bahari Heights",
    resolve: (context) => context.property.name,
  },
  {
    key: "property_location",
    label: "Property location",
    group: "Property",
    example: "Masaki, Dar es Salaam",
    resolve: (context) => context.property.location,
  },
  {
    key: "property_category",
    label: "Property category",
    group: "Property",
    example: "Apartment block",
    resolve: (context) => context.property.category,
  },
  {
    key: "unit_name",
    label: "Unit name",
    group: "Unit",
    example: "C1",
    resolve: (context) => context.unit.name,
  },
  {
    key: "unit_type",
    label: "Unit type",
    group: "Unit",
    example: "2 Bedroom",
    resolve: (context) => context.unit.type,
  },
  {
    key: "unit_floor",
    label: "Floor",
    group: "Unit",
    example: "Ground",
    resolve: (context) => context.unit.floor,
  },
  {
    key: "unit_block",
    label: "Block",
    group: "Unit",
    example: "Block C",
    resolve: (context) => context.unit.block,
  },
  {
    key: "area_sqm",
    label: "Area in sqm",
    group: "Unit",
    example: "62.5",
    resolve: (context) =>
      context.unit.areaSqm === null ? null : String(context.unit.areaSqm),
  },
  {
    key: "lease_start_date",
    label: "Lease start date",
    group: "Lease terms",
    example: "1 Sep 2026",
    resolve: (context) => date(context.lease.startDate),
  },
  {
    key: "lease_end_date",
    label: "Lease end date",
    group: "Lease terms",
    example: "31 Aug 2027",
    resolve: (context) => date(context.lease.endDate),
  },
  {
    key: "number_of_months",
    label: "Term in months",
    group: "Lease terms",
    example: "12",
    resolve: (context) =>
      context.lease.months === null ? null : String(context.lease.months),
  },
  {
    key: "rent_amount",
    label: "Monthly rent",
    group: "Lease terms",
    example: "650,000",
    resolve: (context) => money(context.lease.rentAmount),
  },
  {
    key: "total_amount",
    label: "Total for the whole term",
    group: "Lease terms",
    example: "7,800,000",
    resolve: (context) => money(context.lease.totalAmount),
  },
  {
    key: "currency",
    label: "Currency code",
    group: "Lease terms",
    example: CURRENCY,
    resolve: () => CURRENCY,
  },
];

/**
 * The order groups appear in the editor panel — contract identity first, then
 * the two parties, then what is being let, then the terms, which is the order
 * the clauses of an agreement tend to follow.
 */
export const PLACEHOLDER_GROUP_ORDER: PlaceholderGroup[] = [
  "Contract",
  "Landlord",
  "Tenant",
  "Property",
  "Unit",
  "Lease terms",
];

const PLACEHOLDERS_BY_KEY = new Map(
  LEASE_PLACEHOLDERS.map((placeholder) => [placeholder.key, placeholder])
);

/** `{{ key }}` — whitespace inside the braces is tolerated, case is not. */
const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * The only shape a signature value may take to become an `<img>`: an inlined
 * PNG, nothing else. The image is built *after* the body is sanitized, so this
 * test is what stands between a value and raw HTML — base64 has no quote, no
 * angle bracket, no space, so a match cannot break out of the attribute.
 */
const SIGNATURE_DATA_URI = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

/** What a token with nothing behind it renders as: a line to fill in by hand. */
export const BLANK_VALUE = "……………………";

export function placeholderToken(key: string) {
  return `{{${key}}}`;
}

/** The human name for a token, for the editor's chips and the panel's list. */
export function placeholderLabel(key: string) {
  return PLACEHOLDERS_BY_KEY.get(key)?.label ?? key;
}

/**
 * The attribute an editor chip carries its key in. One constant, because the
 * editor writes it and the serializer reads it, and a typo across the two
 * would silently turn every variable into plain text.
 */
export const VARIABLE_ATTR = "data-variable";

/** Markup for one chip. Atomic — `contenteditable="false"` so it deletes whole. */
export function variableChipHtml(key: string) {
  return `<span class="jarvis-var" ${VARIABLE_ATTR}="${escapeHtml(
    key
  )}" contenteditable="false">${escapeHtml(placeholderLabel(key))}</span>`;
}

/** `<style>` blocks, which the document stylesheet replaced. See `lib/lease-document-style.ts`. */
const STYLE_BLOCK = /<style\b[^>]*>[\s\S]*?<\/style>/gi;

/**
 * Stored body → what the editor shows. Every *known* token becomes a chip
 * displaying its label; the author never sees `{{tenant_name}}`, only "Tenant
 * full name" as one solid object.
 *
 * An unknown token is deliberately left as literal text. It is a typo, and a
 * typo that renders as a chip is a typo nobody finds.
 */
export function tokensToChips(body: string) {
  return body
    .replace(STYLE_BLOCK, "")
    .replace(TOKEN_PATTERN, (token, key: string) =>
      PLACEHOLDERS_BY_KEY.has(key) ? variableChipHtml(key) : token
    );
}

/** Resolves every token against a context, ready to hand to `renderLeaseTemplate`. */
export function placeholderValues(
  context: LeaseContractContext
): Record<string, string | null> {
  const values: Record<string, string | null> = {};
  for (const placeholder of LEASE_PLACEHOLDERS) {
    values[placeholder.key] = placeholder.resolve(context);
  }
  return values;
}

/** The example column, as a values map — what an unsaved template previews with. */
export function samplePlaceholderValues(): Record<string, string | null> {
  const values: Record<string, string | null> = {};
  for (const placeholder of LEASE_PLACEHOLDERS) {
    values[placeholder.key] = placeholder.example;
  }
  return values;
}

/** Which known tokens a body actually uses, in the order they first appear. */
export function usedPlaceholders(body: string) {
  const seen = new Set<string>();
  for (const match of body.matchAll(TOKEN_PATTERN)) {
    if (PLACEHOLDERS_BY_KEY.has(match[1])) seen.add(match[1]);
  }
  return [...seen];
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A template body is HTML written by a member of the organization, so it is
 * trusted about as far as any CMS trusts its authors — which is to say it is
 * still stripped before anyone else's browser sees it. A tenant reading their
 * own contract should not be running a manager's script.
 *
 * This is an allowlist over markup, not a parser, so it is the second line of
 * defence rather than the only one: every surface that renders a body puts it
 * in a `sandbox`ed iframe, where scripts do not run at all. The two together
 * are the guarantee; neither alone is.
 */
const FORBIDDEN_ELEMENTS =
  /<\s*(script|iframe|object|embed|applet|link|meta|base|form|input|button|textarea|select)\b[\s\S]*?(<\s*\/\s*\1\s*>|>)/gi;
const DANGLING_FORBIDDEN_CLOSERS =
  /<\s*\/\s*(script|iframe|object|embed|applet|link|meta|base|form|input|button|textarea|select)\s*>/gi;
/** `onclick=…`, quoted or bare. */
const EVENT_HANDLERS = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
/** `href="javascript:…"`, and the `data:text/html` trick that behaves like it. */
const SCRIPT_URLS =
  /\s(href|src|xlink:href|action|formaction)\s*=\s*(?:"\s*(?:javascript|vbscript|data)\s*:[^"]*"|'\s*(?:javascript|vbscript|data)\s*:[^']*'|(?:javascript|vbscript|data)\s*:[^\s>]*)/gi;
/** CSS that reaches outside the document, in a `style` attribute or a `<style>` block. */
const CSS_ESCAPES = /(@import|expression\s*\(|javascript\s*:|behavior\s*:)/gi;

export function sanitizeTemplateHtml(html: string) {
  return html
    .replace(FORBIDDEN_ELEMENTS, "")
    .replace(DANGLING_FORBIDDEN_CLOSERS, "")
    .replace(EVENT_HANDLERS, "")
    .replace(SCRIPT_URLS, "")
    .replace(CSS_ESCAPES, "");
}

export type RenderedTemplate = {
  html: string;
  /** Known tokens the body used that had nothing behind them. */
  missing: string[];
  /** Tokens the body used that no placeholder defines — a typo, usually. */
  unknown: string[];
};

/**
 * Substitutes tokens into a sanitized body.
 *
 * `decorate` receives text that is already HTML-escaped and returns HTML, which
 * is how the editor's preview wraps each value in a highlight without either
 * side having to escape twice. Left out, a value is inserted as plain text.
 */
export function renderLeaseTemplate(
  body: string,
  {
    values,
    decorate,
  }: {
    values: Record<string, string | null>;
    decorate?: (args: {
      key: string;
      /** HTML-escaped, ready to embed. */
      html: string;
      /** False when the key matches no placeholder. */
      known: boolean;
      /** True when the key is known but resolved to nothing. */
      blank: boolean;
    }) => string;
  }
): RenderedTemplate {
  const missing = new Set<string>();
  const unknown = new Set<string>();

  const html = sanitizeTemplateHtml(body).replace(
    TOKEN_PATTERN,
    (token, key: string) => {
      const known = PLACEHOLDERS_BY_KEY.has(key);
      if (!known) {
        unknown.add(key);
        // Left visible rather than blanked: an unrecognised token is a typo in
        // the template, and silently rendering nothing hides it until the
        // contract is signed.
        const escaped = escapeHtml(token);
        return decorate
          ? decorate({ key, html: escaped, known: false, blank: false })
          : escaped;
      }

      const placeholder = PLACEHOLDERS_BY_KEY.get(key)!;
      const value = values[key];
      const blank = value === null || value === undefined || value === "";
      if (blank) missing.add(key);
      // A signature is an image only when it really is an inlined PNG. Any
      // other value — the preview's "[Owner signature]" — stays escaped text.
      const html =
        placeholder.kind === "signature" && !blank && SIGNATURE_DATA_URI.test(value)
          ? `<img class="jarvis-signature" alt="${escapeHtml(placeholder.label)}" src="${value}" />`
          : escapeHtml(blank ? BLANK_VALUE : value);
      return decorate ? decorate({ key, html, known: true, blank }) : html;
    }
  );

  return { html, missing: [...missing], unknown: [...unknown] };
}
