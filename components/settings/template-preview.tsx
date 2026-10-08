"use client";

import * as React from "react";

import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTRACT_CSS } from "@/lib/lease-document-style";
import { cn } from "@/lib/utils";
import {
  LEASE_PLACEHOLDERS,
  placeholderToken,
  renderLeaseTemplate,
  samplePlaceholderValues,
} from "@/lib/lease-placeholders";

export type PreviewMode = "sample" | "tokens" | "lease";

/** What each mode is called, wherever a switch offers it. */
export const PREVIEW_MODE_LABEL: Record<PreviewMode, string> = {
  tokens: "Placeholders",
  sample: "Sample data",
  lease: "Real lease",
};

type LeaseChoice = { id: string; label: string };
type Mode = PreviewMode;

/**
 * How the contract will read, without needing a lease to read it against.
 *
 * Two modes, because the two questions are different: "does this look like a
 * contract" wants values in the gaps, and "did I put the right token there"
 * wants the token names. Both highlight every substitution, so a paragraph
 * that quietly hard-codes a name instead of asking for one is visible as a gap
 * in the highlighting.
 */
const PREVIEW_STYLE = `
  html, body { background: #fff; margin: 0; }
  ${CONTRACT_CSS}
  mark.jarvis-ph {
    background: #fdf0c4;
    color: inherit;
    padding: 0 2px;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1px #e8cf8a;
  }
  mark.jarvis-ph[data-unknown="true"] {
    background: #ffd9d9;
    box-shadow: inset 0 0 0 1px #e79b9b;
  }
`;

/** Token names, highlighted in place — the paper version of the template itself. */
const TOKEN_VALUES = Object.fromEntries(
  LEASE_PLACEHOLDERS.map((placeholder) => [
    placeholder.key,
    placeholderToken(placeholder.key),
  ])
);

export function TemplatePreview({
  body,
  mode: controlledMode,
  heightClassName = "h-[70vh]",
}: {
  body: string;
  /**
   * How tall the paper is. A prop rather than a fixed height because the two
   * callers want different things: the view dialog is already inside a scroll
   * container and wants a fixed pane, while the editor wants the rest of the
   * phone screen once its controls have moved to the floating stack.
   */
  heightClassName?: string;
  /**
   * Supplied when the surrounding page owns the switch — the editor puts it in
   * the header beside Edit/Preview rather than repeating it above the paper.
   * Left out, the preview carries its own pair of buttons, which is what the
   * view dialog wants.
   */
  mode?: Mode;
}) {
  const [internalMode, setInternalMode] = React.useState<Mode>("tokens");
  const mode = controlledMode ?? internalMode;
  const canReadLeases = useCan("lease:read");

  /*
   * "Real lease": the leases to pick from are fetched the first time the mode
   * is opened, and the chosen lease's values per pick. The body is rendered
   * here, client-side, so the preview shows unsaved edits filled with real
   * data — no save-then-generate round trip.
   */
  const [leases, setLeases] = React.useState<LeaseChoice[] | null>(null);
  const [leaseId, setLeaseId] = React.useState<string | null>(null);
  const [leaseValues, setLeaseValues] = React.useState<Record<string, string | null> | null>(null);
  const [leaseError, setLeaseError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (mode !== "lease" || leases !== null || !canReadLeases) return;
    let cancelled = false;
    fetch("/api/leases")
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: { leases: { id: string; reference: string; tenantName: string; unitLabel: string; propertyName: string }[] }) => {
        if (cancelled) return;
        setLeases(
          data.leases.map((lease) => ({
            id: lease.id,
            label: `${lease.reference} · ${lease.tenantName} · ${lease.propertyName} ${lease.unitLabel}`,
          }))
        );
      })
      .catch(() => !cancelled && setLeaseError("Couldn't load leases"));
    return () => {
      cancelled = true;
    };
  }, [mode, leases, canReadLeases]);

  async function pickLease(id: string) {
    setLeaseId(id);
    setLeaseValues(null);
    setLeaseError(null);
    const response = await fetch(`/api/leases/${id}/placeholder-values`);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.values) {
      setLeaseError(data?.error ?? "Couldn't load that lease");
      return;
    }
    setLeaseValues(data.values);
  }

  const { srcDoc, unknown } = React.useMemo(() => {
    const values =
      mode === "sample"
        ? samplePlaceholderValues()
        : mode === "lease"
          ? (leaseValues ?? TOKEN_VALUES)
          : TOKEN_VALUES;
    const rendered = renderLeaseTemplate(body, {
      values,
      decorate: ({ html, known }) =>
        `<mark class="jarvis-ph" data-unknown="${!known}">${html}</mark>`,
    });

    return {
      srcDoc: `<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_STYLE}</style></head><body class="jarvis-doc">${rendered.html}</body></html>`,
      unknown: rendered.unknown,
    };
  }, [body, mode, leaseValues]);

  return (
    <div className="space-y-3">
      {controlledMode === undefined && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-muted p-0.5">
            {(["tokens", "sample", "lease"] as const).map((value) => (
              <ModeButton
                key={value}
                active={mode === value}
                onClick={() => setInternalMode(value)}
              >
                {PREVIEW_MODE_LABEL[value]}
              </ModeButton>
            ))}
          </div>
        </div>
      )}

      {mode === "lease" && (
        <div className="flex flex-wrap items-center gap-2">
          {!canReadLeases ? (
            <p className="text-sm text-muted-foreground">
              Your role can&apos;t read leases, so there is nothing to fill this with.
            </p>
          ) : leases && leases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leases yet to preview with.</p>
          ) : (
            <Select value={leaseId} onValueChange={(next) => next && pickLease(next)}>
              <SelectTrigger className="w-full sm:w-96" aria-label="Lease to preview with">
                <SelectValue>
                  {(value: string | null) =>
                    leases?.find((lease) => lease.id === value)?.label ??
                    (leases ? "Pick a lease" : "Loading leases…")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(leases ?? []).map((lease) => (
                  <SelectItem key={lease.id} value={lease.id}>
                    {lease.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {leaseError && <p className="text-sm text-destructive">{leaseError}</p>}
          {leaseId && !leaseValues && !leaseError && (
            <p className="text-sm text-muted-foreground">Filling in…</p>
          )}
        </div>
      )}

      {unknown.length > 0 && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {unknown.length === 1
            ? "One token isn’t a placeholder and will print as written: "
            : `${unknown.length} tokens aren’t placeholders and will print as written: `}
          <span className="font-mono">
            {unknown.map((key) => placeholderToken(key)).join(", ")}
          </span>
        </p>
      )}

      {/*
        A sandboxed iframe, not `dangerouslySetInnerHTML`: the body is HTML a
        member of the organization wrote, and while it is stripped on the way
        in (`sanitizeTemplateHtml`), the sandbox is what actually guarantees no
        script runs. It also stops the template's own CSS — which is a whole
        page's worth — from leaking into the app around it.
      */}
      <iframe
        title="Template preview"
        sandbox=""
        srcDoc={srcDoc}
        className={cn(
          "w-full rounded-lg bg-white ring-1 ring-foreground/10",
          heightClassName
        )}
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onClick}
      className={active ? "bg-card shadow-xs" : "text-muted-foreground"}
    >
      {children}
    </Button>
  );
}
