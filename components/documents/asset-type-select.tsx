"use client";

import * as React from "react";
import { CheckIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssetTypeView } from "@/lib/asset-types";
import type { FileAssetSubject } from "@/lib/generated/prisma/enums";

/**
 * The document-type dropdown, with "add one" built into it.
 *
 * The list is `FileAssetType` rows rather than an enum, which only helps if
 * adding one is available at the moment you discover it is missing — mid-
 * upload, looking at a dropdown that does not contain what you are holding.
 * So the control sits at the bottom of the list rather than on a settings page
 * nobody knows exists.
 *
 * **The group is never asked for.** `subject` and `isPhoto` come from whoever
 * rendered this — a lease's documents table, a property's Images tab — and are
 * posted along with the label. The person types a name and gets back a type
 * already filed in the right place.
 */
export function AssetTypeSelect({
  id,
  assetTypes,
  value,
  onValueChange,
  onCreated,
  subject,
  isPhoto,
  disabledTypeIds = [],
  disabledNote = "On file",
  disabled = false,
}: {
  id?: string;
  assetTypes: AssetTypeView[];
  value: string;
  onValueChange: (assetTypeId: string) => void;
  /** Called with the new type so the caller can add it to its own list and select it. */
  onCreated: (assetType: AssetTypeView) => void;
  subject: FileAssetSubject;
  isPhoto: boolean;
  /** Types already on file for this subject, greyed rather than hidden. */
  disabledTypeIds?: string[];
  disabledNote?: string;
  disabled?: boolean;
}) {
  const [adding, setAdding] = React.useState(false);
  const [label, setLabel] = React.useState("");
  // Unreachable for a photo type — `isPhoto` forces multiple server-side, and
  // the control is hidden below to match, rather than offering a choice that
  // would be silently overridden.
  const [allowsMultiple, setAllowsMultiple] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const taken = React.useMemo(
    () => new Set(disabledTypeIds),
    [disabledTypeIds]
  );

  async function submit() {
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Give the type a name");
      return;
    }

    setPending(true);
    setError(null);

    const response = await fetch("/api/asset-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: trimmed, subject, isPhoto, allowsMultiple }),
    });
    const data = await response.json().catch(() => null);
    setPending(false);

    if (!response.ok) {
      const issue = data?.issues
        ? Object.values(data.issues as Record<string, string[]>)[0]?.[0]
        : null;
      setError(issue ?? data?.error ?? "Could not add that type");
      return;
    }

    onCreated(data.assetType as AssetTypeView);
    setAdding(false);
    setLabel("");
    setAllowsMultiple(false);
    toast.success(`“${data.assetType.label}” added`);
  }

  function cancel() {
    setAdding(false);
    setLabel("");
    setAllowsMultiple(false);
    setError(null);
  }

  if (adding) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            autoFocus
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              // The picker lives inside a <form> that submits the upload, so
              // Enter here must not send the file with no type chosen.
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              }
            }}
            placeholder="e.g. Inspection report"
            maxLength={60}
            disabled={pending}
          />
          <Button
            type="button"
            size="icon"
            aria-label="Save document type"
            onClick={() => void submit()}
            disabled={pending || label.trim().length === 0}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cancel adding a type"
            onClick={cancel}
            disabled={pending}
          >
            <XIcon />
          </Button>
        </div>

        {/* Not offered for a photo type: every photo type allows multiple,
            enforced server-side regardless of what this would send, so asking
            here would be a question with a fixed answer. */}
        {!isPhoto && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={allowsMultiple}
              onCheckedChange={(checked) => setAllowsMultiple(checked === true)}
              disabled={pending}
            />
            Allow multiple of this type
          </label>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(next) => next && onValueChange(next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue>
          {(selected: string) =>
            assetTypes.find((type) => type.id === selected)?.label ?? "Choose a type"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {assetTypes.map((type) => (
          <SelectItem key={type.id} value={type.id} disabled={taken.has(type.id)}>
            {type.label}
            {taken.has(type.id) && (
              <span className="text-muted-foreground"> · {disabledNote}</span>
            )}
          </SelectItem>
        ))}

        {/* Not a SelectItem: choosing it would set the field to a sentinel
            value, and a "type" called __add__ is one forgotten guard away from
            reaching the API. A button in the popup does the one thing it says. */}
        <div className="mt-1 border-t pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-1.5 font-normal"
            onClick={() => setAdding(true)}
          >
            <PlusIcon />
            Add a type…
          </Button>
        </div>
      </SelectContent>
    </Select>
  );
}
