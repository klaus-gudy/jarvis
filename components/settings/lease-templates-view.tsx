"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  PencilIcon,
  PlusIcon,
  ScrollTextIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { LeaseTemplateCard } from "@/components/settings/lease-template-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  RowActionButtons,
  type RowAction,
} from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { languageLabel } from "@/lib/lease-template-options";
import type { LeaseTemplateRow } from "@/lib/lease-templates";

export function LeaseTemplatesView({
  templates,
}: {
  templates: LeaseTemplateRow[];
}) {
  const router = useRouter();
  const [deleting, setDeleting] = React.useState<LeaseTemplateRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const rowActions = React.useCallback(
    (template: LeaseTemplateRow): RowAction[] => [
      {
        label: `Edit ${template.name}`,
        icon: PencilIcon,
        href: `/settings/lease-templates/${template.id}`,
      },
      {
        label: `Delete ${template.name}`,
        icon: Trash2Icon,
        tone: "destructive",
        onSelect: () => {
          setError(null);
          setDeleting(template);
        },
      },
    ],
    []
  );

  const columns = React.useMemo<ColumnDef<LeaseTemplateRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Template",
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ScrollTextIcon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium">{row.original.name}</span>
                {row.original.isDefault && (
                  <StarIcon
                    className="size-3.5 shrink-0 fill-stat-accent text-stat-accent"
                    aria-label="Default template"
                  />
                )}
              </div>
              {row.original.description && (
                <p className="truncate text-xs text-muted-foreground">
                  {row.original.description}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "language",
        header: "Language",
        cell: ({ row }) => (
          <Badge variant="outline" className="rounded-full font-normal">
            {languageLabel(row.original.language)}
          </Badge>
        ),
        filterFn: (row, columnId, filterValue) =>
          String(row.getValue(columnId)) === filterValue,
      },
      {
        accessorKey: "placeholderCount",
        header: "Placeholders",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.placeholderCount}</span>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Last edited",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <RowActionButtons actions={rowActions(row.original)} />
        ),
        enableSorting: false,
      },
    ],
    [rowActions]
  );

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);
    setError(null);

    const response = await fetch(`/api/lease-templates/${deleting.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      toast.success(`“${deleting.name}” deleted`);
      setDeleting(null);
      setPending(false);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    const message = data?.error ?? "Could not delete this template";
    setError(message);
    toast.error(message);
    setPending(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          The contract wording your leases are generated from. Write it once
          with placeholders, and every lease fills in its own tenant, unit and
          terms.
        </p>
        <Button
          nativeButton={false}
          render={<Link href="/settings/lease-templates/new" />}
        >
          <PlusIcon />
          New template
        </Button>
      </div>

      <DataTable
        stateKey="lease-templates"
        columns={columns}
        data={templates}
        searchPlaceholder="Search templates…"
        facetFilters={[
          {
            columnId: "language",
            placeholder: "All languages",
            label: "Language",
            // Built from what is on screen, so the filter can't offer a
            // language no template is written in.
            options: [
              ...new Set(templates.map((template) => template.language)),
            ]
              .sort()
              .map((value) => ({ label: languageLabel(value), value })),
          },
        ]}
        emptyMessage="No lease templates yet. Use “New template” to write the first one."
        getRowHref={(template) => `/settings/lease-templates/${template.id}`}
        renderCard={(template) => <LeaseTemplateCard template={template} />}
        rowActions={rowActions}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
            <DialogDescription>
              {deleting?.isDefault
                ? "This is the default template — the next one created takes over. Contracts already generated are unaffected. This cannot be undone."
                : "Contracts already generated from it are unaffected. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
