import { chromium, type Browser } from "playwright";

/**
 * HTML to PDF, through a real browser engine.
 *
 * Chosen over a pure-JS generator (pdfmake and friends) for one reason: the
 * contract's look is already defined, in `lib/lease-document-style.ts`, and
 * already approved by whoever wrote the template in the editor's Preview. A
 * layout engine that re-implements CSS produces something *similar*, which
 * means the stored contract and the preview drift apart and nobody can say
 * which one is right. Chromium renders the same stylesheet the preview does,
 * so the PDF is the preview.
 *
 * The cost is honest and worth stating: this pulls a ~100MB browser download,
 * and the process that calls it needs that browser present. It lives in the
 * contract worker rather than in the web app for exactly that reason — see
 * `worker/contract-worker.ts`.
 */

/**
 * One browser per process, launched on first use.
 *
 * Launching Chromium takes on the order of a second, which is fine once and
 * absurd per contract. Held on `globalThis` for the same reason the Prisma
 * client and the AMQP connection are: a hot reload in dev would otherwise
 * leave a trail of orphaned browser processes.
 */
const globalForPdf = globalThis as unknown as { pdfBrowser?: Promise<Browser> };

function getBrowser(): Promise<Browser> {
  const existing = globalForPdf.pdfBrowser;
  if (existing) return existing;

  const started = chromium.launch();
  globalForPdf.pdfBrowser = started;

  const invalidate = () => {
    if (globalForPdf.pdfBrowser === started) globalForPdf.pdfBrowser = undefined;
  };

  // A crashed browser is not reusable; drop it so the next render launches a
  // fresh one rather than throwing "Target closed" forever after.
  started.then(
    (browser) => browser.on("disconnected", invalidate),
    invalidate
  );

  return started;
}

export type PdfOptions = {
  /** Printed at the foot of every page. Blank when omitted. */
  footerText?: string;
};

/**
 * Renders a complete HTML document to PDF bytes.
 *
 * `setContent` rather than navigating to a data: or file: URL — the document
 * is built in memory, has no origin, and needs none. `waitUntil: "load"` is
 * enough because a contract has no scripts and no remote assets: the sanitizer
 * strips both, and the stylesheet is inlined by the caller.
 */
export async function htmlToPdf(
  html: string,
  { footerText }: PdfOptions = {}
): Promise<Uint8Array> {
  const browser = await getBrowser();
  // A fresh context per render, closed in `finally`: contexts are cheap, and
  // sharing one across tenants would share its cookies and storage too.
  const context = await browser.newContext();

  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });

    return await page.pdf({
      format: "A4",
      // The contract's own background — highlighted variables in particular —
      // is content, not decoration.
      printBackground: true,
      margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
      displayHeaderFooter: Boolean(footerText),
      headerTemplate: "<span></span>",
      footerTemplate: footerText
        ? // The page counter is one child, not three: `space-between` spreads
          // every child evenly, which turned "1 / 2" into "1     /     2".
          `<div style="width:100%;padding:0 16mm;font-family:Helvetica,Arial,sans-serif;font-size:8pt;color:#666;display:flex;justify-content:space-between;">
             <span>${escapeForTemplate(footerText)}</span>
             <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
           </div>`
        : "<span></span>",
    });
  } finally {
    await context.close();
  }
}

/**
 * Chromium's header/footer templates are HTML, and the text put in them here
 * is a contract reference and an organization name — both free text from the
 * database.
 */
function escapeForTemplate(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Shuts the shared browser down. For workers, which otherwise never exit. */
export async function closePdfBrowser() {
  const existing = globalForPdf.pdfBrowser;
  if (!existing) return;
  globalForPdf.pdfBrowser = undefined;
  try {
    await (await existing).close();
  } catch {
    // Already gone; nothing to close.
  }
}
