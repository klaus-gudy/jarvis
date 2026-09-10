import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  /**
   * Nothing the Next build can reach may import a renderer.
   *
   * This is a guard against a specific regression that already happened once:
   * `lib/contracts.ts` imported `lib/pdf.ts`, which imported Playwright, and
   * `app/(app)/leases/[id]/page.tsx` imported a single constant from
   * `lib/contracts.ts` — which put a ~100MB headless browser in the Next server
   * graph for an ordinary page render, and made `npx playwright install` a
   * requirement wherever `next start` ran.
   *
   * Rendering lives in the standalone `document-worker` service now. The rule
   * says so structurally, so the next person to reach for a PDF from a route
   * handler is told where it actually belongs rather than reintroducing the
   * dependency by accident.
   */
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "playwright",
              message:
                "Rendering belongs to the document-worker service. Publish `lease.created` with { html, objectKey } instead.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/pdf", "@/lib/pdf"],
              message:
                "lib/pdf.ts is gone — the document-worker service renders PDFs. Publish `lease.created` with { html, objectKey } instead.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
