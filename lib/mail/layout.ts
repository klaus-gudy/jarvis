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
 * Every style is inline for the same reason all transactional email is: Gmail
 * strips `<style>` blocks, and there is no stylesheet to link to.
 */

const BRAND = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const ACCENT = "#0d9488";

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
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND};">${text}</p>`
    )
    .join("");

  const codeBlock = code
    ? `<div style="margin:0 0 20px;padding:16px;background:#f8fafc;border:1px solid ${BORDER};border-radius:8px;text-align:center;">
         <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:600;letter-spacing:6px;color:${BRAND};">${escapeHtml(code)}</span>
       </div>`
    : "";

  const button = action
    ? `<p style="margin:0 0 20px;">
         <a href="${escapeHtml(action.href)}" style="display:inline-block;padding:11px 22px;background:${ACCENT};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${escapeHtml(action.label)}</a>
       </p>`
    : "";

  const smallPrint = footnote
    ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${MUTED};">${footnote}</p>`
    : "";

  return `<div style="max-width:560px;margin:0 auto;padding:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <p style="margin:0 0 24px;font-size:15px;font-weight:700;color:${BRAND};letter-spacing:-0.01em;">${escapeHtml(SITE_NAME)}</p>
  <h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:700;color:${BRAND};letter-spacing:-0.02em;">${escapeHtml(heading)}</h1>
  ${paragraphs}
  ${codeBlock}
  ${button}
  <hr style="margin:28px 0 16px;border:none;border-top:1px solid ${BORDER};" />
  ${smallPrint}
  <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(SITE_NAME)} — property management for Tanzanian landlords. <a href="${escapeHtml(SITE_URL)}" style="color:${MUTED};">${escapeHtml(SITE_URL.replace(/^https?:\/\//, ""))}</a></p>
</div>`;
}

/** Absolute link into the app. Relative URLs are meaningless in an inbox. */
export function appUrl(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
