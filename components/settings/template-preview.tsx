"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { CONTRACT_CSS } from "@/lib/lease-document-style";
import {
  LEASE_PLACEHOLDERS,
  placeholderToken,
  renderLeaseTemplate,
  samplePlaceholderValues,
} from "@/lib/lease-placeholders";

export type PreviewMode = "sample" | "tokens";
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
}: {
  body: string;
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

  const { srcDoc, unknown } = React.useMemo(() => {
    const rendered = renderLeaseTemplate(body, {
      values: mode === "sample" ? samplePlaceholderValues() : TOKEN_VALUES,
      decorate: ({ html, known }) =>
        `<mark class="jarvis-ph" data-unknown="${!known}">${html}</mark>`,
    });

    return {
      srcDoc: `<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_STYLE}</style></head><body class="jarvis-doc">${rendered.html}</body></html>`,
      unknown: rendered.unknown,
    };
  }, [body, mode]);

  return (
    <div className="space-y-3">
      {controlledMode === undefined && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-muted p-0.5">
            <ModeButton
              active={mode === "tokens"}
              onClick={() => setInternalMode("tokens")}
            >
              Placeholders
            </ModeButton>
            <ModeButton
              active={mode === "sample"}
              onClick={() => setInternalMode("sample")}
            >
              Sample data
            </ModeButton>
          </div>
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
        className="h-[70vh] w-full rounded-lg bg-white ring-1 ring-foreground/10"
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
