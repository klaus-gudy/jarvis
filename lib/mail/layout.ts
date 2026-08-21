import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * The shared shell every email in `lib/mail/` renders into.
 *
 * It emits an HTML **fragment**, not a document — no `<html>`, `<head>` or
 * `<body>`. The mail service's contract takes `content` as a fragment (its own
 * example is a bare `<p>`), and a full document nested inside whatever wrapper
 * that service applies would be invalid either way. A `<div>` with inline
 * styles renders correctly in both cases.
 *
 * Every style is inline for the same reason all transactional email is: there
 * is no stylesheet to link to, and several clients drop `<style>` blocks. The
 * two exceptions below are additive only — a client that ignores them still
 * gets the complete design from the inline attributes.
 */

/* ------------------------------------------------------------------ *
 * Palette — the light-theme tokens from `app/globals.css`, resolved.
 *
 * Email has no `oklch()` (Outlook and several webmail clients drop the whole
 * declaration) and no CSS variables, so the tokens are pinned as sRGB hex
 * here. Light theme only: an inbox is not the app and has no theme switch.
 *
 * **These must be re-resolved by hand if the tokens in `app/globals.css`
 * change.** Each one records the token it came from.
 * ------------------------------------------------------------------ */

/** `--primary` / `--stat` — the navy. Headings, wordmark, buttons, links. */
const INK = "#1c2f40";
/** `--primary-foreground` — text on a filled navy surface. */
const ON_INK = "#ffffff";
/** `--foreground` — running body copy. */
const BODY = "#333333";
/** `--muted-foreground` — footnote and footer. */
const MUTED = "#6b7280";
/** `--border` — the rule and the code block's outline. */
const BORDER = "#d9d9d9";
/** `--muted` — the code block's fill. */
const SURFACE = "#f9fafb";
/** `--radius-lg` (0.75rem) — what `rounded-lg` gives a button in the app. */
const RADIUS = "12px";

/* ------------------------------------------------------------------ *
 * Type — the same three families as `app/globals.css`, per role.
 *
 * Set explicitly on *every* element rather than once on the wrapper: Outlook
 * renders through Word, which does not inherit `font-family` into block
 * children, so an unstyled `<p>` there falls back to Times New Roman no matter
 * what its parent says. Inheritance is the reason emails "lose" their font.
 * ------------------------------------------------------------------ */

/** `--font-heading` — Sora, for the wordmark and the `<h1>`. */
const HEADING =
  "'Sora','Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
/** `--font-sans` — Hanken Grotesk, for everything else. */
const SANS =
  "'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
/** `--font-mono` — IBM Plex Mono, for one-time codes. */
const MONO =
  "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace";

/**
 * The two non-inline blocks, both progressive enhancements.
 *
 * The `@import` is what actually puts Sora and Hanken Grotesk in an inbox —
 * neither is installed on anyone's machine, so without it the stacks above
 * always resolve to the system fallback. Apple Mail, iOS Mail and Samsung Mail
 * honour it; Gmail and Outlook block remote fonts and fall through, which is
 * why the fallbacks are ordered to match Hanken's proportions closely.
 *
 * The `[if mso]` block exists because Word's fallback is not a fallback: given
 * a stack it does not recognise it jumps straight to Times New Roman instead of
 * trying the next family. Naming Outlook's own fonts is the only way to keep it
 * out of a serif, and `!important` is required to beat the inline attributes.
 */
const FONT_LINK = `<style type="text/css">
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap');
</style>
<!--[if mso]>
<style type="text/css">
  h1, p, a, span, td, div { font-family: 'Segoe UI', Tahoma, Arial, sans-serif !important; }
  .mail-code { font-family: Consolas, 'Courier New', monospace !important; }
</style>
<![endif]-->`;

/**
 * Names, organization names and email addresses are free text a user typed.
 * Interpolating them raw would let a name containing `<` break the markup —
 * or worse in a mail client that renders scripts. Everything variable goes
 * through here.
 */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailParts = {
  /** The `<h1>`. Usually a restatement of the subject, not a repeat of it. */
  heading: string;
  /** Paragraphs, in order. Pre-escaped — build them with `escapeHtml`. */
  body: string[];
  /** A single primary action. More than one and neither gets clicked. */
  action?: { label: string; href: string };
  /** A one-time code, shown large and monospaced. */
  code?: string;
  /** Small print under the rule — the "wasn't you?" line, usually. */
  footnote?: string;
};

export function renderEmail({
  heading,
  body,
  action,
  code,
  footnote,
}: EmailParts): string {
  const paragraphs = body
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.6;color:${BODY};">${text}</p>`
    )
    .join("");

  const codeBlock = code
    ? `<div style="margin:0 0 20px;padding:16px;font-family:${MONO};background:${SURFACE};border:1px solid ${BORDER};border-radius:${RADIUS};text-align:center;">
         <span class="mail-code" style="font-family:${MONO};font-size:30px;font-weight:600;letter-spacing:6px;color:${INK};">${escapeHtml(code)}</span>
       </div>`
    : "";

  // Matches `<Button>`'s default variant in the app: the primary fill, its
  // foreground, `rounded-lg`. Outlook squares the corners off — border-radius
  // is the one thing Word cannot do — and that is the only way it differs
  // from every other client.
  const button = action
    ? `<p style="margin:0 0 20px;font-family:${SANS};">
         <a href="${escapeHtml(action.href)}" style="display:inline-block;padding:11px 22px;background:${INK};color:${ON_INK};font-family:${SANS};font-size:15px;font-weight:600;line-height:1.2;text-decoration:none;border-radius:${RADIUS};">${escapeHtml(action.label)}</a>
       </p>`
    : "";

  const smallPrint = footnote
    ? `<p style="margin:0 0 8px;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED};">${footnote}</p>`
    : "";

  return `${FONT_LINK}
<div style="max-width:560px;margin:0 auto;padding:8px;font-family:${SANS};color:${BODY};">
  <p style="margin:0 0 24px;font-family:${HEADING};font-size:15px;font-weight:700;color:${INK};letter-spacing:-0.01em;">${escapeHtml(SITE_NAME)}</p>
  <h1 style="margin:0 0 16px;font-family:${HEADING};font-size:21px;line-height:1.3;font-weight:700;color:${INK};letter-spacing:-0.02em;">${escapeHtml(heading)}</h1>
  ${paragraphs}
  ${codeBlock}
  ${button}
  <hr style="margin:28px 0 16px;border:none;border-top:1px solid ${BORDER};" />
  ${smallPrint}
  <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(SITE_NAME)} — property management for Tanzanian landlords. <a href="${escapeHtml(SITE_URL)}" style="font-family:${SANS};color:${MUTED};">${escapeHtml(SITE_URL.replace(/^https?:\/\//, ""))}</a></p>
</div>`;
}

/** Absolute link into the app. Relative URLs are meaningless in an inbox. */
export function appUrl(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
