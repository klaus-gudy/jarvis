"use client";

import { StarIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { languageLabel } from "@/lib/lease-template-options";
import type { LeaseTemplateRow } from "@/lib/lease-templates";

/**
 * One template as a card, for the mobile list on the Lease templates page.
 *
 * The body itself is deliberately absent: a paragraph of HTML tells you nothing
 * at this size, while the name, the language and whether it is the default are
 * the three things that distinguish one template from another.
 */
export function LeaseTemplateCard({
  template,
}: {
  template: LeaseTemplateRow;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 font-medium">
          <span className="truncate">{template.name}</span>
          {template.isDefault && (
            <StarIcon
              className="size-3.5 shrink-0 fill-stat-accent text-stat-accent"
              aria-label="Default template"
            />
          )}
        </p>
        <Badge variant="outline" className="shrink-0 rounded-full font-normal">
          {languageLabel(template.language)}
        </Badge>
      </div>

      {template.description && (
        // Two lines, then an ellipsis: a description written as a paragraph
        // otherwise makes one card as tall as the three below it, and the list
        // stops being scannable — which is the only thing a card list is for.
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {template.description}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        <span className="tabular-nums">{template.placeholderCount}</span>{" "}
        {template.placeholderCount === 1 ? "placeholder" : "placeholders"}
        {" · edited "}
        {formatDate(template.updatedAt)}
      </p>
    </div>
  );
}
