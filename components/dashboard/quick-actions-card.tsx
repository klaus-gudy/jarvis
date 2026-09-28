import Link from "next/link"
import { ChevronRightIcon, ZapIcon, type LucideIcon } from "lucide-react"

import {
  PortalDocumentViewer,
  type PortalViewableDocument,
} from "@/components/portal/portal-document-viewer"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type QuickAction = {
  label: string
  caption: string
  icon: LucideIcon
  /** An in-app page — or, with `document`, nothing: the row opens the viewer. */
  href?: string
  document?: PortalViewableDocument
  /** Something to do now — marked "To do" and shown on its own. */
  needed?: boolean
}

/**
 * The Quick actions card, shared by the landlord dashboard and the tenant Home
 * so both read the same. **Urgent first, and only urgent:** when any action is
 * `needed`, the everyday shortcuts are hidden so the list stays short; they
 * come back once nothing is waiting. Callers offer only actions that can work.
 */
export function QuickActionsCard({ actions }: { actions: QuickAction[] }) {
  const urgent = actions.filter((action) => action.needed)
  const shown = urgent.length > 0 ? urgent : actions

  return (
    <Card className="gap-0 p-0 shadow-sm">
      <div className="flex items-center gap-2 border-b px-5 py-3.5">
        <ZapIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold">Quick actions</h3>
      </div>
      <div className="flex flex-col gap-2 p-3">
        {shown.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            Nothing needs your attention.
          </p>
        )}
        {shown.map((action) => {
          const className = cn(
            "group flex min-w-0 items-center gap-3 rounded-lg border px-3 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
            action.needed && "border-stat-accent/50 bg-stat-accent/5"
          )
          const body = (
            <>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  action.needed
                    ? "bg-stat-accent/15 text-stat-accent"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <action.icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{action.label}</p>
                <p className="truncate text-xs text-muted-foreground">{action.caption}</p>
              </div>
              {action.needed ? (
                <span className="shrink-0 rounded-full bg-stat-accent px-2 py-0.5 text-[10px] font-semibold text-stat-foreground">
                  To do
                </span>
              ) : (
                <ChevronRightIcon
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              )}
            </>
          )
          return action.document ? (
            <PortalDocumentViewer
              key={action.label}
              document={action.document}
              className={cn(className, "text-left")}
            >
              {body}
            </PortalDocumentViewer>
          ) : (
            <Link key={action.label} href={action.href ?? "/"} className={className}>
              {body}
            </Link>
          )
        })}
      </div>
    </Card>
  )
}
