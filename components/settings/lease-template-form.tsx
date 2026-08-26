"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon, PencilIcon, SettingsIcon } from "lucide-react";
import { toast } from "sonner";

import {
  LeaseTemplateDetailsDialog,
  type LeaseTemplateDetails,
} from "@/components/settings/lease-template-details-dialog";
import {
  PlaceholderPanel,
  type PlaceholderPanelHandle,
} from "@/components/settings/placeholder-panel";
import {
  RichTextEditor,
  editorHtmlToBody,
  type RichTextEditorHandle,
} from "@/components/settings/rich-text-editor";
import {
  TemplatePreview,
  type PreviewMode,
} from "@/components/settings/template-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { tokensToChips, usedPlaceholders } from "@/lib/lease-placeholders";
import {
  languageLabel,
  type LeaseTemplateLanguage,
} from "@/lib/lease-template-options";
import { starterBody } from "@/lib/lease-template-starters";
import type { LeaseTemplateDetail } from "@/lib/lease-templates";

type FieldErrors = Partial<Record<string, string[]>>;

const LIST_URL = "/settings/lease-templates";

/**
 * Writing or editing one template.
 *
 * The page is the document. Name, language and description were asked for in
 * the dialog that got you here, so they appear as a heading and a badge rather
 * than as three fields competing with the contract for the top of the screen —
 * `Edit details` reopens that dialog for the once-in-a-while case.
 */
export function LeaseTemplateForm({
  template,
  isFirstTemplate = false,
  initialDetails,
}: {
  /** Absent when creating. */
  template?: LeaseTemplateDetail;
  /** True when the organization has no template yet — this one has to be the default. */
  isFirstTemplate?: boolean;
  /** Carried over from the New-template dialog. */
  initialDetails?: Partial<LeaseTemplateDetails>;
}) {
  const router = useRouter();
  const editing = template !== undefined;

  const [details, setDetails] = React.useState<LeaseTemplateDetails>({
    name: template?.name ?? initialDetails?.name ?? "",
    language:
      (template?.language as LeaseTemplateLanguage) ??
      initialDetails?.language ??
      "en",
    description: template?.description ?? initialDetails?.description ?? "",
    isDefault: template?.isDefault ?? initialDetails?.isDefault ?? false,
  });

  /**
   * The stored form: HTML with `{{token}}`s in it. The editor works in a
   * different shape (tokens as chips) and hands this back on every change, so
   * the server contract and every preview are unaffected by there being an
   * editor at all.
   */
  const [body, setBody] = React.useState(
    () => template?.body ?? starterBody(details.language)
  );

  /**
   * Seeded once. The editor is uncontrolled — see `RichTextEditor` — so this is
   * what it reads on mount, not a value pushed on every keystroke.
   */
  const initialEditorHtml = React.useMemo(
    () => tokensToChips(template?.body ?? starterBody(details.language)),
    // Deliberately empty: reseeding on a body change would fight the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [detailsOpen, setDetailsOpen] = React.useState(
    // Landing on /new without going through the dialog — a typed URL, a stale
    // bookmark — asks for the details here rather than dead-ending.
    !editing && !initialDetails?.name
  );

  /**
   * The default can only be moved by promoting another template, never by
   * demoting this one. Asked for in the details dialog now, where the rest of
   * what a template *is* lives.
   */
  const lockedDefault = editing ? template.isDefault : isFirstTemplate;

  /**
   * One button, two states — the feedback's shape. The mode sits where the
   * page's other action sat, and `previewMode` only has a control to itself
   * while previewing, since it means nothing in the editor.
   */
  const [mode, setMode] = React.useState<"edit" | "preview">("edit");
  const [previewMode, setPreviewMode] = React.useState<PreviewMode>("tokens");

  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  const editorRef = React.useRef<RichTextEditorHandle>(null);
  const panelRef = React.useRef<PlaceholderPanelHandle>(null);
  const used = React.useMemo(() => new Set(usedPlaceholders(body)), [body]);

  function handleEditorChange(html: string) {
    setBody(editorHtmlToBody(html));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const response = await fetch(
      editing ? `/api/lease-templates/${template.id}` : "/api/lease-templates",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: details.name,
          description: details.description || null,
          language: details.language,
          body,
          isDefault: details.isDefault,
        }),
      }
    );

    if (response.ok) {
      toast.success(
        editing ? "Template saved" : `“${details.name}” created`
      );
      router.push(LIST_URL);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    setFieldErrors(data?.issues ?? {});
    const message = data?.issues
      ? null
      : (data?.error ?? "Could not save this template");
    setFormError(message);
    if (message) toast.error(message);
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="truncate text-xl font-semibold">
            {details.name || "Untitled template"}
          </h1>
          <Badge variant="outline" className="rounded-full font-normal">
            {languageLabel(details.language)}
          </Badge>
          {/*
            The description is deliberately absent: it exists to tell two rows
            of the list apart, and on the page for one template it is a line of
            text that never earns its place.
          */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Template details"
            title="Template details"
            className="text-muted-foreground"
            onClick={() => setDetailsOpen(true)}
          >
            <SettingsIcon />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/*
            Only while previewing: which values fill the gaps is a question the
            editor cannot answer, so the control does not exist there.
          */}
          {mode === "preview" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-card"
              onClick={() =>
                setPreviewMode((current) =>
                  current === "tokens" ? "sample" : "tokens"
                )
              }
            >
              {previewMode === "tokens" ? "Sample data" : "Placeholders"}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-card"
            onClick={() =>
              setMode((current) => (current === "edit" ? "preview" : "edit"))
            }
          >
            {mode === "edit" ? <EyeIcon /> : <PencilIcon />}
            {mode === "edit" ? "Preview" : "Edit"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          {/*
            Both stay mounted and the inactive one is hidden. The editor is
            uncontrolled, so unmounting it on a mode switch and remounting it on
            the way back would reseed from the *original* body and silently
            discard everything typed since.
          */}
          <div hidden={mode !== "edit"}>
            <RichTextEditor
              ref={editorRef}
              initialHtml={initialEditorHtml}
              onChange={handleEditorChange}
              onRequestVariable={() => panelRef.current?.focusSearch()}
              ariaLabel="Contract"
            />
            <FieldError
              errors={fieldErrors.body?.map((m) => ({ message: m }))}
            />
          </div>

          <div hidden={mode !== "preview"}>
            <TemplatePreview body={body} mode={previewMode} />
          </div>

          {formError && <FieldError>{formError}</FieldError>}
          {fieldErrors.name && (
            <FieldError
              errors={fieldErrors.name.map((m) => ({ message: m }))}
            />
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              disabled={pending}
              render={<Link href={LIST_URL} />}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || details.name.trim().length === 0}
            >
              {pending
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Create template"}
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-4">
          <PlaceholderPanel
            ref={panelRef}
            onInsert={(key) => editorRef.current?.insertVariable(key)}
            used={used}
          />
        </div>
      </div>

      {/* Remounted per open so it re-seeds from the current values. */}
      <LeaseTemplateDetailsDialog
        key={String(detailsOpen)}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        initial={details}
        editing
        lockedDefault={lockedDefault}
        submitLabel="Save details"
        onSubmit={(next) => {
          setDetails(next);
          setDetailsOpen(false);
        }}
      />
    </form>
  );
}
