"use client";

import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
  LEASE_PLACEHOLDERS,
  PLACEHOLDER_GROUP_ORDER,
  placeholderToken,
} from "@/lib/lease-placeholders";

/**
 * The list of tokens a template may use, beside the editor rather than behind
 * a help link: writing a contract is a long scroll through prose, and a
 * reference you have to leave the page for is a reference nobody checks.
 *
 * Clicking one inserts it where the cursor was. Inserting rather than copying
 * because the token is only ever wanted in one place — the body — and a paste
 * is two extra steps to arrive there. The clipboard is written to as well, so
 * the copy that the panel's label promises still happens for anyone who has
 * scrolled the editor out of reach.
 */
export function PlaceholderPanel({
  onInsert,
  used,
}: {
  onInsert: (token: string) => void;
  /** Keys the body already uses, so the panel can mark them off. */
  used: Set<string>;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-0">
        <div className="px-4 py-3.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Placeholders{" "}
            <span className="font-normal normal-case">(click to insert)</span>
          </p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto border-t">
          {PLACEHOLDER_GROUP_ORDER.map((group) => {
            const placeholders = LEASE_PLACEHOLDERS.filter(
              (placeholder) => placeholder.group === group
            );
            if (placeholders.length === 0) return null;

            return (
              <div key={group}>
                <p className="sticky top-0 z-10 bg-muted/80 px-4 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase backdrop-blur-sm">
                  {group}
                </p>

                {placeholders.map((placeholder) => (
                  <button
                    key={placeholder.key}
                    type="button"
                    onClick={() => onInsert(placeholderToken(placeholder.key))}
                    className="flex w-full items-center gap-2 border-b px-4 py-2 text-left transition-colors last:border-b-0 hover:bg-accent/10"
                  >
                    <code
                      className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs ${
                        used.has(placeholder.key)
                          ? "bg-primary/12 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {placeholderToken(placeholder.key)}
                    </code>
                    <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                      {placeholder.label}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          Highlighted tokens are already in this template. Anything left
          unfilled when a contract is generated prints as a blank line.
        </p>
      </CardContent>
    </Card>
  );
}
