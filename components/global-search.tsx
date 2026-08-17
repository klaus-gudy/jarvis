"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  MIN_QUERY_LENGTH,
  SEARCH_TYPE_BADGE,
  SEARCH_TYPE_LABEL,
  type SearchResult,
  type SearchResultType,
} from "@/lib/search-types";
import { cn } from "@/lib/utils";

/** Fixed order so results don't reshuffle between keystrokes. */
/**
 * Both the section order and the filter: a type missing here never renders,
 * however many rows the API returned for it.
 */
const TYPE_ORDER: SearchResultType[] = [
  "property",
  "unit",
  "tenant",
  "user",
  "lease",
  // Required, not cosmetic: this array is both the section order *and* the
  // filter, so a type missing from it never renders however many rows the API
  // returns.
  "payment",
];

/** Long enough to swallow a typing burst, short enough to feel immediate. */
const DEBOUNCE_MS = 200;

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  /**
   * Results are stored with the query they answer. Both "is this loading" and
   * "are these results current" are then derived by comparing that query to
   * the live one — which keeps setState out of the effect body (the rule
   * `react-hooks/set-state-in-effect` forbids it) and, more usefully, makes it
   * impossible to render one query's results under another's text.
   */
  const [answered, setAnswered] = React.useState<{
    query: string;
    items: SearchResult[];
  }>({ query: "", items: [] });
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const isTooShort = trimmed.length < MIN_QUERY_LENGTH;
  const loading = !isTooShort && answered.query !== trimmed;
  // Memoised because a fresh `[]` each render would re-run the grouping below
  // on every keystroke.
  const results = React.useMemo(
    () => (!isTooShort && answered.query === trimmed ? answered.items : []),
    [isTooShort, answered, trimmed]
  );

  // ⌘K / Ctrl+K from anywhere.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced fetch. The AbortController matters as much as the timer: without
  // it a slow early request can resolve after a later one, and the in-flight
  // request for an abandoned query would still be paid for.
  React.useEffect(() => {
    const current = query.trim();
    if (current.length < MIN_QUERY_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(current)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("search failed");
        const data = await response.json();
        setAnswered({ query: current, items: data.results ?? [] });
        setActiveIndex(0);
      } catch (error) {
        // An abort means a newer query superseded this one — leaving `answered`
        // alone keeps the loading state up for that newer request.
        if ((error as Error).name !== "AbortError") {
          setAnswered({ query: current, items: [] });
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const grouped = React.useMemo(() => {
    return TYPE_ORDER.map((type) => ({
      type,
      items: results.filter((result) => result.type === type),
    })).filter((group) => group.items.length > 0);
  }, [results]);

  // Flattened in render order, so arrow keys walk the list the way it looks.
  const flat = React.useMemo(
    () => grouped.flatMap((group) => group.items),
    [grouped]
  );

  function select(result: SearchResult) {
    setOpen(false);
    setQuery("");
    setAnswered({ query: "", items: [] });
    router.push(result.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (flat.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + flat.length) % flat.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = flat[activeIndex];
      if (result) select(result);
    }
  }

  // Keep the highlighted row in view when arrowing past the fold.
  React.useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const showEmpty = !loading && !isTooShort && flat.length === 0;

  return (
    <>
      <button
        type="button"
        data-tour="global-search"
        onClick={() => setOpen(true)}
        // Explicit widths rather than `w-full max-w-*`: the header's trailing
        // group is content-sized, so a percentage width collapsed to the
        // placeholder's width instead of expanding.
        //
        // `bg-input` rather than `bg-background`: the header is already
        // `bg-background`, so that fill was invisible and only the border read
        // as a field. This is the token the Input primitive uses for its own
        // surface, and it sits lighter than the header in both themes.
        className="flex h-8 w-44 items-center gap-2 rounded-lg border border-input bg-input px-2.5 text-sm text-muted-foreground transition-colors hover:bg-input/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:w-64 lg:w-80"
      >
        <SearchIcon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Search…</span>
        {/* Hidden on touch, where there is no ⌘K to press. */}
        <kbd className="ml-auto hidden shrink-0 rounded border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-24 max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>
              Search properties, units, tenants and leases.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 border-b px-3">
            <SearchIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search properties, units, tenants, leases…"
              aria-label="Search"
              className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
            />
          </div>

          <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
            {isTooShort && (
              <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
                Type at least {MIN_QUERY_LENGTH} characters to search.
              </p>
            )}

            {loading && (
              <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
                Searching…
              </p>
            )}

            {showEmpty && (
              <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
                Nothing matches “{trimmed}”.
              </p>
            )}

            {grouped.map((group) => (
              <div key={group.type} className="mb-1 last:mb-0">
                <p className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                  {SEARCH_TYPE_LABEL[group.type]}
                </p>
                {group.items.map((result) => {
                  const index = flat.indexOf(result);
                  return (
                    <button
                      key={result.key}
                      type="button"
                      data-index={index}
                      onClick={() => select(result)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left outline-none",
                        index === activeIndex && "bg-muted"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {result.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {result.subtitle}
                        </p>
                      </div>
                      {result.meta && (
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {result.meta}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 rounded-full font-normal",
                          SEARCH_TYPE_BADGE[result.type]
                        )}
                      >
                        {SEARCH_TYPE_LABEL[result.type]}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
