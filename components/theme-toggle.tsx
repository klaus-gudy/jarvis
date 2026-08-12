"use client"

import { useTheme } from "next-themes"
import { MoonIcon, SunIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * A plain `setTheme` recolors every element in one frame — jarring against a
 * page this size. Where the browser supports it, the switch instead plays as
 * a ring expanding from the button that was clicked, via the View
 * Transitions API: it snapshots old/new paint states and animates between
 * them with a native `clip-path`, so nothing here hand-rolls a fade over
 * every element. Falls back to the instant switch under reduced motion or
 * on a browser without the API (Firefox, as of this app's target set).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  function toggleTheme(event: React.MouseEvent<HTMLButtonElement>) {
    const next = resolvedTheme === "dark" ? "light" : "dark"

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    if (prefersReducedMotion || !document.startViewTransition) {
      setTheme(next)
      return
    }

    // Read the click origin now — by the time `ready` resolves, React may
    // have already re-rendered this button (e.g. icon swap) under a
    // different layout.
    const { top, left, width, height } =
      event.currentTarget.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const transition = document.startViewTransition(() => {
      setTheme(next)
    })

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 500,
          easing: "ease-in-out",
          // Targets the incoming (new-theme) snapshot specifically, so the
          // circle reveals the new theme growing outward rather than the
          // API's default crossfade of both snapshots at once.
          pseudoElement: "::view-transition-new(root)",
        }
      )
    })
  }

  return (
    <Button variant="outline" size="icon" onClick={toggleTheme}>
      <SunIcon className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <MoonIcon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
