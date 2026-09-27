import Link from "next/link"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type FilterPill = { label: string; value: string | undefined }

/**
 * The landlord Properties page's filter row, tenant-side: rounded pills that
 * are plain links carrying `?status=`, so a filtered list is a URL and the
 * page stays a server component. `value: undefined` is the "All" pill.
 */
export function FilterPills({
  basePath,
  filters,
  active,
}: {
  basePath: string
  filters: readonly FilterPill[]
  active: string | undefined
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const isActive = filter.value === active
        return (
          <Button
            key={filter.label}
            variant={isActive ? "default" : "outline"}
            className={cn("rounded-full", !isActive && "bg-background")}
            nativeButton={false}
            render={
              <Link href={filter.value ? `${basePath}?status=${filter.value}` : basePath} />
            }
          >
            {filter.label}
          </Button>
        )
      })}
    </div>
  )
}

/** The `?status=` value if it is one of the pills, else undefined ("All"). */
export function parseFilter(
  filters: readonly FilterPill[],
  raw: string | undefined
): string | undefined {
  return filters.find((f) => f.value !== undefined && f.value === raw)?.value
}
