"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";
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
import { TemplatePreview } from "@/components/settings/template-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const [isDefault, setIsDefault] = React.useState(template?.isDefault ?? false);
  const [detailsOpen, setDetailsOpen] = React.useState(
    // Landing on /new without going through the dialog — a typed URL, a stale
    // bookmark — asks for the details here rather than dead-ending.
    !editing && !initialDetails?.name
  );

  /**
   * The default can only be moved by promoting another template, never by
   * demoting this one — so the box is checked and inert on the organization's
   * first template and on the one already in force.
   */
  const lockedDefault = editing ? template.isDefault : isFirstTemplate;

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
          isDefault,
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold">
              {details.name || "Untitled template"}
            </h1>
            <Badge variant="outline" className="rounded-full font-normal">
              {languageLabel(details.language)}
            </Badge>
          </div>
          {details.description && (
            <p className="text-sm text-muted-foreground">
              {details.description}
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="bg-card"
          onClick={() => setDetailsOpen(true)}
        >
          <PencilIcon />
          Edit details
        </Button>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Tabs defaultValue="edit">
            <TabsList variant="line">
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            {/*
              `keepMounted`-by-hand: the editor is uncontrolled, so unmounting
              it on a tab switch and remounting it on the way back would reseed
              from the *original* body and silently discard the edits made
              since. Both panels stay mounted; only the inactive one is hidden.
            */}
            <TabsContent value="edit" className="pt-3" keepMounted>
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
            </TabsContent>

            <TabsContent value="preview" className="pt-3" keepMounted>
              <TemplatePreview body={body} />
            </TabsContent>
          </Tabs>

          <Card>
            <CardContent className="space-y-4">
              <Field orientation="horizontal">
                <Checkbox
                  id="template-default"
                  checked={lockedDefault || isDefault}
                  disabled={lockedDefault}
                  onCheckedChange={(checked) => setIsDefault(checked)}
                />
                <FieldLabel htmlFor="template-default" className="font-normal">
                  Use this template by default for new contracts
                  {lockedDefault && (
                    <span className="text-muted-foreground">
                      {" "}
                      —{" "}
                      {editing
                        ? "already the default; promote another template to move it"
                        : "your first template always is"}
                    </span>
                  )}
                </FieldLabel>
              </Field>

              {formError && <FieldError>{formError}</FieldError>}
              {fieldErrors.name && (
                <FieldError
                  errors={fieldErrors.name.map((m) => ({ message: m }))}
                />
              )}

              <div className="flex justify-end gap-2 border-t pt-4">
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
            </CardContent>
          </Card>
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
        submitLabel="Save details"
        onSubmit={(next) => {
          setDetails(next);
          setDetailsOpen(false);
        }}
      />
    </form>
  );
}
