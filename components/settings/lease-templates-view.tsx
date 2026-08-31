"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  EyeIcon,
  PencilIcon,
  PlusIcon,
  ScrollTextIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { LeaseTemplateCard } from "@/components/settings/lease-template-card";
import { LeaseTemplateDetailsDialog } from "@/components/settings/lease-template-details-dialog";
import { LeaseTemplateViewDialog } from "@/components/settings/lease-template-view-dialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const [viewing, setViewing] = React.useState<{
    template: LeaseTemplateRow;
    body: string;
  } | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  /**
   * Fetched when the action fires, rather than carrying every body in the
   * table's data: a list of ten templates would otherwise ship ten contracts'
   * worth of HTML to the client to render four columns of metadata.
   */
  const openView = React.useCallback(async (template: LeaseTemplateRow) => {
    const response = await fetch(`/api/lease-templates/${template.id}`);
    if (!response.ok) {
      toast.error("Could not open this template");
      return;
    }
    const data = await response.json();
    setViewing({ template, body: data.template.body });
  }, []);

  const rowActions = React.useCallback(
    (template: LeaseTemplateRow): RowAction[] => [
      // Leads, because reading a template is the commoner errand and a
      // double-click on the row is not an affordance anyone discovers.
      {
        label: `View ${template.name}`,
        icon: EyeIcon,
        onSelect: () => void openView(template),
      },
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
    [openView]
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
            <span className="truncate font-medium">{row.original.name}</span>
            {row.original.isDefault && (
              <StarIcon
                className="size-3.5 shrink-0 fill-stat-accent text-stat-accent"
                aria-label="Default template"
              />
            )}
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        /*
          Capped and clipped. `TableCell` is `whitespace-nowrap`, so a
          description written as a paragraph pushed every column after it off
          the screen and turned the whole table into a horizontal scroller —
          one long row deciding the width for every short one. The full text is
          still reachable, on hover and on focus, rather than being thrown away.
        */
        cell: ({ row }) => {
          const description = row.original.description;
          if (!description) {
            return <span className="text-muted-foreground">—</span>;
          }

          return (
            <Tooltip>
              <TooltipTrigger
                render={<span />}
                className="block max-w-[22rem] cursor-default truncate text-muted-foreground"
              >
                {description}
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                {description}
              </TooltipContent>
            </Tooltip>
          );
        },
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
      <div className="flex justify-end">
        {/*
          A dialog, not a link straight to the editor: a template needs a name
          before it needs prose, and asking for it here leaves the next screen
          free to be a page of contract rather than a form with a document
          stapled underneath.
        */}
        <Button onClick={() => setCreating(true)}>
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

      {/* Remounted per open so it starts blank rather than holding the last try. */}
      <LeaseTemplateDetailsDialog
        key={String(creating)}
        open={creating}
        onOpenChange={setCreating}
        lockedDefault={templates.length === 0}
        submitLabel="Next"
        onSubmit={(details) => {
          const query = new URLSearchParams({
            name: details.name,
            language: details.language,
            ...(details.description
              ? { description: details.description }
              : {}),
            ...(details.isDefault ? { isDefault: "1" } : {}),
          });
          router.push(`/settings/lease-templates/new?${query}`);
        }}
      />

      <LeaseTemplateViewDialog
        template={viewing?.template ?? null}
        body={viewing?.body ?? ""}
        onOpenChange={(open) => !open && setViewing(null)}
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
