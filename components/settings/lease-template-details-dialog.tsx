"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  LEASE_TEMPLATE_LANGUAGES,
  languageLabel,
  type LeaseTemplateLanguage,
} from "@/lib/lease-template-options";

export type LeaseTemplateDetails = {
  name: string;
  language: LeaseTemplateLanguage;
  description: string;
  isDefault: boolean;
};

/**
 * What a template *is*, asked before what it *says*.
 *
 * These three fields were sitting above the editor, where they competed with
 * the document for attention and were re-read on every visit despite changing
 * about once. Asking them once, up front, leaves the editor page to be a page
 * of contract with a name on top.
 *
 * The same dialog serves "New template" (its button reads Next and the caller
 * navigates) and "Edit details" on the editor page (its button reads Save and
 * the caller keeps the values in form state until the template is saved).
 */
export function LeaseTemplateDetailsDialog({
  open,
  onOpenChange,
  initial,
  submitLabel,
  onSubmit,
  /** Reopened from the editor to change these, rather than to start one. */
  editing = false,
  /**
   * The default cannot be moved by demoting this template, only by promoting
   * another — true on an organization's first template and on the one already
   * in force. Shown as a checked, disabled box rather than silently overruled
   * by the server.
   */
  lockedDefault = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<LeaseTemplateDetails>;
  submitLabel: string;
  onSubmit: (details: LeaseTemplateDetails) => void;
  editing?: boolean;
  lockedDefault?: boolean;
}) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [language, setLanguage] = React.useState<LeaseTemplateLanguage>(
    initial?.language ?? "en"
  );
  const [description, setDescription] = React.useState(
    initial?.description ?? ""
  );
  const [isDefault, setIsDefault] = React.useState(initial?.isDefault ?? false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      language,
      description: description.trim(),
      isDefault: lockedDefault || isDefault,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Template details" : "New lease template"}
            </DialogTitle>
            {!editing && (
              <DialogDescription>
                Name it and pick its language. You’ll write the contract itself
                on the next screen.
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="details-name" required>
                Template name
              </FieldLabel>
              <Input
                id="details-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Residential tenancy agreement"
                required
                autoFocus
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="details-language">Language</FieldLabel>
              <Select
                value={language}
                onValueChange={(next) =>
                  next && setLanguage(next as LeaseTemplateLanguage)
                }
              >
                <SelectTrigger id="details-language" className="w-full">
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
              <FieldDescription>
                Sets the wording the contract starts from.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="details-description">Description</FieldLabel>
              <Textarea
                id="details-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Standard 12-month let for furnished units"
                rows={3}
                className="min-h-20"
              />
            </Field>

            <Field orientation="horizontal">
              <Checkbox
                id="details-default"
                checked={lockedDefault || isDefault}
                disabled={lockedDefault}
                onCheckedChange={(checked) => setIsDefault(checked)}
              />
              <FieldLabel htmlFor="details-default" className="font-normal">
                Use this template by default for new contracts
                {lockedDefault && (
                  <span className="text-muted-foreground">
                    {" "}
                    —{" "}
                    {editing
                      ? "already the default; promote another to move it"
                      : "your first template always is"}
                  </span>
                )}
              </FieldLabel>
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={name.trim().length === 0}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
