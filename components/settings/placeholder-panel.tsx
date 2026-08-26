"use client";

import * as React from "react";
import { SearchIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  LEASE_PLACEHOLDERS,
  PLACEHOLDER_GROUP_ORDER,
} from "@/lib/lease-placeholders";

export type PlaceholderPanelHandle = {
  /** Puts the cursor in the search box — the toolbar's `{ } Variable` button. */
  focusSearch: () => void;
};

/**
 * The fields a template can pull from the database, beside the editor rather
 * than behind a help link: writing a contract is a long scroll through prose,
 * and a reference you have to leave the page for is one nobody checks.
 *
 * Names only — no `{{tenant_name}}`. The token is the storage format, not
 * something an author should have to read, type or get right; clicking the
 * name drops the variable in at the caret as one solid object.
 */
export const PlaceholderPanel = React.forwardRef<
  PlaceholderPanelHandle,
  {
    onInsert: (key: string) => void;
    /** Keys the body already uses, so the panel can mark them off. */
    used: Set<string>;
  }
>(function PlaceholderPanel({ onInsert, used }, ref) {
  const [query, setQuery] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useImperativeHandle(ref, () => ({
    focusSearch() {
      searchRef.current?.focus();
      searchRef.current?.select();
    },
  }));

  const matches = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return LEASE_PLACEHOLDERS;

    // The key is searched as well as the label, so someone who has seen
    // `{{tenant_id}}` in a preview can still find it by that name.
    return LEASE_PLACEHOLDERS.filter((placeholder) =>
      `${placeholder.label} ${placeholder.key} ${placeholder.group}`
        .toLowerCase()
        .includes(needle)
    );
  }, [query]);

  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-0">
        <div className="space-y-2.5 px-4 py-3.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Variables
          </p>
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search variables…"
              aria-label="Search variables"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="max-h-[52vh] overflow-y-auto border-t">
          {matches.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              No variable matches “{query.trim()}”.
            </p>
          ) : (
            PLACEHOLDER_GROUP_ORDER.map((group) => {
              const inGroup = matches.filter(
                (placeholder) => placeholder.group === group
              );
              if (inGroup.length === 0) return null;

              return (
                <div key={group}>
                  <p className="sticky top-0 z-10 bg-muted/80 px-4 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase backdrop-blur-sm">
                    {group}
                  </p>

                  {inGroup.map((placeholder) => (
                    <button
                      key={placeholder.key}
                      type="button"
                      // Keeps the caret in the document: the default mousedown
                      // would blur the editor and collapse the selection this
                      // is about to insert into.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onInsert(placeholder.key)}
                      className="flex w-full items-center gap-2 border-b px-4 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/10"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {placeholder.label}
                      </span>
                      {used.has(placeholder.key) && (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-stat-accent"
                          title="Already used in this template"
                          aria-label="Already used in this template"
                        />
                      )}
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>

        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          Click one to drop it in at the cursor. Each fills itself in from the
          lease when a contract is generated.
        </p>
      </CardContent>
    </Card>
  );
});
