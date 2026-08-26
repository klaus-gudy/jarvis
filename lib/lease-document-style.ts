/**
 * What a contract looks like — defined once, used by the editor surface and by
 * the preview iframe.
 *
 * It used to live in a `<style>` block at the top of every template body, which
 * was fine while the body was edited as raw HTML and became a problem the
 * moment it was edited as a document: the author saw a screenful of CSS above
 * their agreement and could break the layout by deleting a line of it. The
 * body is now content only, and how that content is typeset is the app's
 * business.
 *
 * Scoped under `.jarvis-doc` so it can be dropped into the app's own page
 * (the editor) without escaping the surface it belongs to.
 */
const RULES = `
  .jarvis-doc {
    font-family: "Times New Roman", Times, serif;
    font-size: 15px;
    line-height: 1.75;
    color: #1a1a1a;
    text-align: justify;
    background: #fff;
  }
  .jarvis-doc .contract { max-width: 720px; margin: 0 auto; padding: 48px 56px; }
  .jarvis-doc h1 {
    font-size: 17px;
    text-align: center;
    text-transform: uppercase;
    text-decoration: underline;
    letter-spacing: 0.02em;
    font-weight: bold;
    margin: 0 0 20px;
  }
  .jarvis-doc h2 {
    font-size: 15px;
    text-align: center;
    letter-spacing: 0.08em;
    font-weight: bold;
    margin: 28px 0 12px;
  }
  .jarvis-doc h3 {
    font-size: 15px;
    text-decoration: underline;
    font-weight: bold;
    margin: 28px 0 10px;
  }
  .jarvis-doc p { margin: 0 0 12px; }
  .jarvis-doc ol, .jarvis-doc ul { padding-left: 22px; margin: 0 0 16px; }
  .jarvis-doc li { margin-bottom: 10px; }
  .jarvis-doc .meta { text-align: center; margin-bottom: 24px; }
  .jarvis-doc .ref { text-align: right; font-size: 13px; color: #555; }
  .jarvis-doc table { border-collapse: collapse; }
  .jarvis-doc table td, .jarvis-doc table th { padding: 6px 8px; }
  .jarvis-doc .signatures { margin-top: 40px; width: 100%; }
  .jarvis-doc .signatures td { width: 50%; padding: 10px 16px 28px 0; vertical-align: top; }
  .jarvis-doc .rule { border-bottom: 1px solid #333; height: 26px; margin-bottom: 4px; }
`;

/** The stylesheet body, for a `<style>` tag in the editor or the preview iframe. */
export const CONTRACT_CSS = RULES;

/**
 * A grid on any table *without* its own borders, so the signature block and
 * anything inserted from the toolbar stay visible while being edited. Not part
 * of the preview: a contract does not print its layout scaffolding.
 */
export const EDITOR_ONLY_CSS = `
  .jarvis-doc table td { outline: 1px dashed rgba(0, 0, 0, 0.18); }
  .jarvis-doc:focus { outline: none; }
  .jarvis-doc [data-variable] { cursor: default; }
`;
