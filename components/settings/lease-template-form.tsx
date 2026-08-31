"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BracesIcon,
  EyeIcon,
  Loader2Icon,
  PencilIcon,
  RotateCcwIcon,
  SaveIcon,
  SettingsIcon,
} from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
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

  /**
   * What "unsaved changes" is measured against. A lazy `useState` initializer
   * rather than a ref: its setter is never called, so the value is stable
   * across renders exactly like a ref would be, but reading it during render
   * (for `isDirty`, below) doesn't trip the rule against reading ref values
   * outside an effect or handler.
   */
  const [baselineBody] = React.useState(body);
  const [baselineDetails] = React.useState(details);
  /** Bumped to force `RichTextEditor` to reseed from `initialEditorHtml` on Reset. */
  const [resetCount, setResetCount] = React.useState(0);

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
  /** The variables panel, as a bottom sheet — its only form below `lg`. */
  const [variablesOpen, setVariablesOpen] = React.useState(false);

  const isDirty =
    body !== baselineBody ||
    JSON.stringify(details) !== JSON.stringify(baselineDetails);

  function handleReset() {
    setBody(baselineBody);
    setDetails(baselineDetails);
    setResetCount((count) => count + 1);
  }

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
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="min-w-0 truncate text-lg font-semibold sm:text-xl">
            {details.name || "Untitled template"}
          </h1>
          <Badge
            variant="outline"
            className="shrink-0 rounded-full font-normal"
          >
            {languageLabel(details.language)}
          </Badge>

          {/*
            Reset has no floating button — three is the whole point of the
            stack, and a destructive fourth sitting under the thumb is the last
            thing it should hold. It keeps a place in the header instead, icon
            only, appearing on the same condition as its desktop twin.
          */}
          {isDirty && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Discard changes"
              title="Discard changes"
              className="shrink-0 text-muted-foreground lg:hidden"
              onClick={handleReset}
              disabled={pending}
            >
              <RotateCcwIcon />
            </Button>
          )}
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

        {/*
          Every action for the page lives on this one row, level with Preview —
          there is no second, bottom-of-page copy of Save any more, so this is
          the only place it can be reached from.
        */}
        <div className="hidden items-center gap-2 lg:flex">
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

          {/* Only once there is something to throw away. */}
          {isDirty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-card"
              onClick={handleReset}
              disabled={pending}
            >
              <RotateCcwIcon />
              Reset
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

          {/*
            Always reachable, unlike Reset: a brand-new template built entirely
            from the untouched starter is still something to save, even though
            nothing has been *changed* yet. Disabled once an existing template
            has no pending changes — there is nothing to resubmit.
          */}
          <Button
            type="submit"
            size="sm"
            disabled={
              pending ||
              details.name.trim().length === 0 ||
              (editing && !isDirty)
            }
          >
            {pending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create template"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/*
          `pb-24` below `lg`: the floating stack is fixed, so it sits over
          whatever the document's last line happens to be. The padding is what
          guarantees the end of a contract can still be read and tapped.
        */}
        {/*
          `min-w-0`: a grid item defaults to `min-width: auto`, so the column
          grows to its widest child's *min-content* — and the contract's
          signatures table has a 500px min-content. That one table was
          stretching the column past the viewport and scrolling the whole app
          sideways on a phone. Capped here, the editor's own scroller handles
          anything genuinely too wide.
        */}
        <div className="min-w-0 space-y-4 pb-24 lg:pb-0">
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
              documentKey={String(resetCount)}
              onChange={handleEditorChange}
              onRequestVariable={() => panelRef.current?.focusSearch()}
              ariaLabel="Contract"
            />
            <FieldError
              errors={fieldErrors.body?.map((m) => ({ message: m }))}
            />
          </div>

          <div hidden={mode !== "preview"} className="space-y-2">
            {/*
              The desktop copy of this switch lives in the action row, which is
              gone below `lg`. It belongs to the preview rather than to the
              floating stack: it changes what the paper *says*, not what the
              page does, and the stack is for the three things you do.
            */}
            <div className="flex justify-end lg:hidden">
              <div className="inline-flex rounded-full bg-muted p-0.5">
                {(["tokens", "sample"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPreviewMode(value)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      previewMode === value
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground"
                    )}
                  >
                    {value === "tokens" ? "Placeholders" : "Sample data"}
                  </button>
                ))}
              </div>
            </div>

            <TemplatePreview
              body={body}
              mode={previewMode}
              heightClassName="h-[calc(100svh-15rem)] lg:h-[70vh]"
            />
          </div>

          {formError && <FieldError>{formError}</FieldError>}
          {fieldErrors.name && (
            <FieldError
              errors={fieldErrors.name.map((m) => ({ message: m }))}
            />
          )}
        </div>

        <div className="hidden lg:sticky lg:top-4 lg:block">
          <PlaceholderPanel
            ref={panelRef}
            onInsert={(key) => editorRef.current?.insertVariable(key)}
            used={used}
          />
        </div>
      </div>

      {/*
        The phone's version of the action row: three fixed buttons at the
        bottom-left, in the order they are reached for — look at it, fetch a
        variable, keep it. Left rather than right because the editor's own
        caret and selection handles live on the right of a line, and a button
        parked over them is one you fight with while writing.

        Below `lg` only. Above it the action row is back and a floating stack
        would be a second, competing copy of the same three commands.
      */}
      <div
        className="fixed bottom-5 left-4 z-40 flex flex-col items-start gap-2.5 lg:hidden"
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <FloatingAction
          label={mode === "edit" ? "Preview" : "Back to editing"}
          onClick={() =>
            setMode((current) => (current === "edit" ? "preview" : "edit"))
          }
        >
          {mode === "edit" ? <EyeIcon /> : <PencilIcon />}
        </FloatingAction>

        <FloatingAction
          label="Variables"
          onClick={() => {
            // Straight back to the editor first. Inserting into a hidden
            // editor would file the variable somewhere the reader cannot see
            // it happen, which reads as the button having done nothing.
            setMode("edit");
            setVariablesOpen(true);
          }}
        >
          <BracesIcon />
        </FloatingAction>

        {/*
          The primary one, biggest and nearest the thumb. `type="submit"` works
          from here because the stack is still inside the form — it is only
          positioned out of the flow, not out of the tree.
        */}
        <FloatingAction
          primary
          type="submit"
          label={editing ? "Save changes" : "Create template"}
          // A dot rather than a count or a word: the question a writer asks of
          // this button is only ever "is there anything of mine not in there
          // yet", and the answer is yes or no.
          badge={isDirty}
          disabled={
            pending ||
            details.name.trim().length === 0 ||
            (editing && !isDirty)
          }
        >
          {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
        </FloatingAction>
      </div>

      {/*
        The variables panel, as a sheet. The same component the sidebar
        renders — `flat` only drops the card and the caption this header
        already supplies — so a variable cannot exist on one surface and not
        the other.
      */}
      <Sheet open={variablesOpen} onOpenChange={setVariablesOpen}>
        <SheetContent side="bottom" className="max-h-[85svh]">
          <SheetHeader>
            <SheetTitle>Variables</SheetTitle>
            <SheetDescription>
              Tap one to drop it in at the cursor. Each fills itself in from the
              lease when a contract is generated.
            </SheetDescription>
          </SheetHeader>

          <PlaceholderPanel
            flat
            onInsert={(key) => {
              /*
                Close first, insert on the next frame — deliberately this order.
                Inserting focuses the editor to restore the caret, and doing
                that while the sheet is still open puts focus outside a sheet
                that is managing it; the close queued in the same tick was
                swallowed and the sheet stayed put over the document. Letting it
                dismiss first also shows the chip landing in the sentence, which
                is the whole point of tapping a variable.
              */
              setVariablesOpen(false);
              requestAnimationFrame(() =>
                editorRef.current?.insertVariable(key)
              );
            }}
            used={used}
          />
        </SheetContent>
      </Sheet>

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

/**
 * One button in the floating stack.
 *
 * Circular and 48px, which is the smallest thing a thumb hits reliably, with a
 * shadow rather than a border — it floats over the document rather than being
 * part of it, and a ring at this size reads as a hole punched in the page. The
 * label is carried by `aria-label` and `title` rather than shown: three icons
 * in a column stay a column, while three labelled pills become a wall down the
 * side of the screen, which is the clutter this arrangement exists to avoid.
 */
function FloatingAction({
  label,
  children,
  primary = false,
  badge = false,
  ...props
}: React.ComponentProps<typeof Button> & {
  label: string;
  /** The one that commits. Filled, and a size larger than its neighbours. */
  primary?: boolean;
  /** Shows an unread-style dot — used for "there are unsaved changes". */
  badge?: boolean;
}) {
  return (
    <div className="relative">
      <Button
        aria-label={label}
        title={label}
        variant={primary ? "default" : "outline"}
        className={cn(
          "rounded-full shadow-lg transition-transform active:scale-95",
          primary
            ? "size-13 [&_svg:not([class*='size-'])]:size-5.5"
            : "size-11 bg-card [&_svg:not([class*='size-'])]:size-5"
        )}
        {...props}
      >
        {children}
      </Button>

      {badge && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-0.5 -right-0.5 size-3 rounded-full bg-stat-accent ring-2 ring-background"
        />
      )}
    </div>
  );
}
