"use client";

import { StarIcon } from "lucide-react";

import { TemplatePreview } from "@/components/settings/template-preview";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { languageLabel } from "@/lib/lease-template-options";
import type { LeaseTemplateRow } from "@/lib/lease-templates";

/**
 * Reading a template without opening the editor — the same split the Units
 * table makes between its view dialog and its form, so the eye and the pencil
 * mean two different things here as they do everywhere else in the app.
 *
 * The body is fetched by the caller when the action fires rather than held on
 * every row: a list of ten templates would otherwise ship ten contracts' worth
 * of HTML to the client to render four columns of metadata.
 */
export function LeaseTemplateViewDialog({
  template,
  body,
  onOpenChange,
}: {
  template: LeaseTemplateRow | null;
  body: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={template !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {template?.name}
            {template?.isDefault && (
              <StarIcon
                className="size-4 shrink-0 fill-stat-accent text-stat-accent"
                aria-label="Default template"
              />
            )}
            <Badge variant="outline" className="rounded-full font-normal">
              {languageLabel(template?.language ?? "")}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {template?.description ??
              "How this contract reads once a lease fills it in."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <TemplatePreview body={body} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
