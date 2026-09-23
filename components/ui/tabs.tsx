"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  // A horizontal strip scrolls sideways rather than running off the screen:
  // four tabs with count badges (a lease's Overview/Billing/Contract/Documents)
  // overflow 375px, and with the strip clipped the last tab was unreachable on
  // a phone. `no-scrollbar` because the row is short enough to swipe and a
  // scrollbar under the tabs reads as a second underline. The active tab's own
  // `after:` indicator sits within the box, so it survives the clip.
  "group/tabs-list no-scrollbar inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-horizontal/tabs:overflow-x-auto group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type Overflow = { left: boolean; right: boolean }

function measure(node: HTMLElement): Overflow {
  // 1px of slack: fractional widths leave scrollLeft a hair short of the end.
  return {
    left: node.scrollLeft > 1,
    right: node.scrollLeft + node.clientWidth < node.scrollWidth - 1,
  }
}

/**
 * A swipeable strip gives no sign that it swipes: on a phone the member page's
 * fifth tab sat off-screen with nothing to say it was there. So each edge that
 * has tabs beyond it fades out and shows a chevron, and tapping the chevron
 * scrolls the row. Both hints go away at their end of the row, and neither
 * shows when everything fits.
 *
 * Measured in a ref callback rather than an effect, the pattern
 * `LoadMoreSentinel` uses: React 19 runs its cleanup on detach, and the
 * ResizeObserver's first callback supplies the initial state, so no state is
 * set during an effect. The chevrons aren't tab stops — arrow keys already
 * move through the tabs and scroll the active one into view.
 */
function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const [overflow, setOverflow] = React.useState<Overflow>({
    left: false,
    right: false,
  })

  const attach = React.useCallback((node: HTMLDivElement | null) => {
    listRef.current = node
    if (!node) return
    const update = () =>
      setOverflow((current) => {
        const next = measure(node)
        return next.left === current.left && next.right === current.right
          ? current
          : next
      })
    const observer = new ResizeObserver(update)
    observer.observe(node)
    node.addEventListener("scroll", update, { passive: true })
    return () => {
      observer.disconnect()
      node.removeEventListener("scroll", update)
    }
  }, [])

  const nudge = (direction: -1 | 1) => {
    const node = listRef.current
    if (!node) return
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    node.scrollBy({
      left: direction * node.clientWidth * 0.6,
      behavior: reduceMotion ? "auto" : "smooth",
    })
  }

  return (
    <div data-slot="tabs-list-frame" className="relative min-w-0">
      <TabsPrimitive.List
        ref={attach}
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      />
      <ScrollHint side="left" visible={overflow.left} onClick={() => nudge(-1)} />
      <ScrollHint side="right" visible={overflow.right} onClick={() => nudge(1)} />
    </div>
  )
}

function ScrollHint({
  side,
  visible,
  onClick,
}: {
  side: "left" | "right"
  visible: boolean
  onClick: () => void
}) {
  const Icon = side === "left" ? ChevronLeftIcon : ChevronRightIcon
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={side === "left" ? "Show earlier tabs" : "Show more tabs"}
      aria-hidden={!visible}
      onClick={onClick}
      className={cn(
        // `bottom-px` leaves the line variant's border running under the fade.
        "absolute top-0 bottom-px flex w-10 items-center text-muted-foreground transition-opacity duration-200 hover:text-foreground",
        side === "left"
          ? "left-0 justify-start bg-linear-to-r from-background from-40% to-transparent"
          : "right-0 justify-end bg-linear-to-l from-background from-40% to-transparent",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
