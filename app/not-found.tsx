"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { RentopsWordmark } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

export default function NotFound() {
  const router = useRouter()

  return (
    <main className="relative flex min-h-svh items-center justify-center bg-background p-6 sm:p-10">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <RentopsWordmark className="mb-10" />

        <p className="text-sm font-medium tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Page not found
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          That link is broken or the page has moved. Let&apos;s get you back on
          track.
        </p>

        <div className="mt-8 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => router.back()}>
            <ArrowLeftIcon />
            Go back
          </Button>
          <Button
            className="w-full sm:w-auto"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Take me home
          </Button>
        </div>
      </div>
    </main>
  )
}
