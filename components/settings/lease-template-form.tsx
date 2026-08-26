"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PlaceholderPanel } from "@/components/settings/placeholder-panel";
import { TemplatePreview } from "@/components/settings/template-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usedPlaceholders } from "@/lib/lease-placeholders";
import {
  LEASE_TEMPLATE_LANGUAGES,
  languageLabel,
  type LeaseTemplateLanguage,
} from "@/lib/lease-template-options";
import { isStarterBody, starterBody } from "@/lib/lease-template-starters";
import type { LeaseTemplateDetail } from "@/lib/lease-templates";

type FieldErrors = Partial<Record<string, string[]>>;

const LIST_URL = "/settings/lease-templates";

/**
 * Writing or editing one template.
 *
 * A page rather than a dialog: a tenancy agreement is several screens of prose
 * with a reference panel beside it, and neither survives being put in a box you
 * can dismiss by clicking beside it.
 */
export function LeaseTemplateForm({
  template,
  isFirstTemplate = false,
}: {
  /** Absent when creating. */
  template?: LeaseTemplateDetail;
  /** True when the organization has no template yet — this one has to be the default. */
  isFirstTemplate?: boolean;
}) {
  const router = useRouter();
  const editing = template !== undefined;

  const [name, setName] = React.useState(template?.name ?? "");
  const [description, setDescription] = React.useState(
    template?.description ?? ""
  );
  const [language, setLanguage] = React.useState<LeaseTemplateLanguage>(
    (template?.language as LeaseTemplateLanguage) ?? "en"
  );
  const [body, setBody] = React.useState(
    template?.body ?? starterBody("en")
  );
  const [isDefault, setIsDefault] = React.useState(template?.isDefault ?? false);

  /**
   * The default can only be moved by promoting another template, never by
   * demoting this one — so the box is checked and inert on the organization's
   * first template and on the one already in force. Shown rather than
   * silently overridden by the server, which is what a disabled checkbox is
   * for.
   */
  const lockedDefault = editing ? template.isDefault : isFirstTemplate;

  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const used = React.useMemo(() => new Set(usedPlaceholders(body)), [body]);

  /**
   * Switching language swaps the starter — but only while the body still *is* a
   * starter. Once a word of it has been edited it is someone's work, and
   * replacing that because a dropdown moved would be the worst bug this page
   * could have.
   */
  function handleLanguageChange(next: LeaseTemplateLanguage) {
    setLanguage(next);
    if (isStarterBody(body)) setBody(starterBody(next));
  }

  /**
   * Where the caret belongs once React has committed an inserted token.
   * Restoring it inside the click handler doesn't work: the textarea is
   * controlled, so React writes `value` afterwards and takes the selection
   * with it — the caret ended up at 0, and a second insert landed *before* the
   * first. Held here and applied from an effect, which runs after the commit.
   */
  const pendingCaret = React.useRef<number | null>(null);

  React.useEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;

    const textarea = bodyRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  }, [body]);

  function insertToken(token: string) {
    const textarea = bodyRef.current;
    if (!textarea) {
      // The Preview tab is showing, so the textarea isn't mounted. The panel
      // still promises a copy, so give one.
      void navigator.clipboard?.writeText(token);
      toast.success(`${token} copied`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    // Straight after the token, not at the end of a two-hundred-line document.
    pendingCaret.current = start + token.length;
    setBody((current) => current.slice(0, start) + token + current.slice(end));
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
          name,
          description: description || null,
          language,
          body,
          isDefault,
        }),
      }
    );

    if (response.ok) {
      toast.success(editing ? "Template saved" : `“${name}” created`);
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
    <form onSubmit={handleSubmit}>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="template-name" required>
                  Template name
                </FieldLabel>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Residential tenancy agreement"
                  required
                  autoFocus
                />
                <FieldError
                  errors={fieldErrors.name?.map((m) => ({ message: m }))}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="template-language">Language</FieldLabel>
                <Select
                  value={language}
                  onValueChange={(next) =>
                    next && handleLanguageChange(next as LeaseTemplateLanguage)
                  }
                >
                  <SelectTrigger id="template-language" className="w-full">
                    <SelectValue>
                      {(selected: string) => languageLabel(selected)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LEASE_TEMPLATE_LANGUAGES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError
                  errors={fieldErrors.language?.map((m) => ({ message: m }))}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="template-description">Description</FieldLabel>
              <Input
                id="template-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Standard 12-month let for furnished units"
              />
              <FieldDescription>
                Optional — shown in the list, to tell two templates apart.
              </FieldDescription>
              <FieldError
                errors={fieldErrors.description?.map((m) => ({ message: m }))}
              />
            </Field>

            <Tabs defaultValue="editor">
              <TabsList variant="line">
                <TabsTrigger value="editor">Contract</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="editor" className="pt-3">
                <Field>
                  <FieldLabel htmlFor="template-body" required>
                    Contract body
                  </FieldLabel>
                  <Textarea
                    id="template-body"
                    ref={bodyRef}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    // field-sizing-content on the shared Textarea grows with a
                    // whole contract; a fixed height with its own scrollbar
                    // keeps the Save button reachable.
                    className="h-[60vh] resize-y overflow-auto font-mono text-xs !text-xs"
                    spellCheck={false}
                    required
                  />
                  <FieldDescription>
                    HTML. Click a placeholder on the right to drop it in at the
                    cursor — it fills itself in from the lease when a contract
                    is generated.
                  </FieldDescription>
                  <FieldError
                    errors={fieldErrors.body?.map((m) => ({ message: m }))}
                  />
                </Field>
              </TabsContent>

              <TabsContent value="preview" className="pt-3">
                <TemplatePreview body={body} />
              </TabsContent>
            </Tabs>

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
                    — {editing
                      ? "already the default; promote another template to move it"
                      : "your first template always is"}
                  </span>
                )}
              </FieldLabel>
            </Field>

            {formError && <FieldError>{formError}</FieldError>}

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
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Create template"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-4">
          <PlaceholderPanel onInsert={insertToken} used={used} />
        </div>
      </div>
    </form>
  );
}
