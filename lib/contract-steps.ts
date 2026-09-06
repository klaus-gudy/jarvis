/**
 * The phases of generating a contract, as a **client-safe** module.
 *
 * These live apart from `lib/contracts.ts` for one hard reason: that file
 * imports `lib/pdf.ts`, which imports Playwright. The Contract tab is a client
 * component, and importing a single label constant from `lib/contracts.ts`
 * dragged a headless browser into the browser bundle — a build failure with
 * 144 errors, all of them `playwright-core [Client Component Browser]`.
 *
 * Same split as `lib/document-options.ts`: the constants both sides need to
 * agree on, with no dependencies of their own.
 *
 * Named rather than numbered, so a stream that stops halfway says *which* part
 * gave up — "render" and "store" fail for completely different reasons and
 * want completely different fixes.
 */

export type ContractStep = "template" | "render" | "store";

export const CONTRACT_STEP_LABELS: Record<ContractStep, string> = {
  template: "Reading the lease and filling the template",
  render: "Rendering the PDF",
  store: "Filing it in document storage",
};

/**
 * Called as each phase *begins*. Optional wherever it is accepted: the worker
 * passes nothing and logs only the outcome, while
 * `POST /api/leases/[id]/contract` passes one that writes each step down the
 * response as it happens.
 */
export type ContractStepReporter = (step: ContractStep) => void;
