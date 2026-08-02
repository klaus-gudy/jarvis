import { redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth/session"
import { SignOutButton } from "@/components/sign-out-button"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function Home() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const membership = user.activeOrgId
    ? await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: user.activeOrgId,
          },
        },
        include: { organization: true, role: true },
      })
    : null

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          {membership?.organization.name ?? "Jarvis"}
        </h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>Welcome, {user.name ?? user.email}</CardTitle>
          <CardDescription>
            {membership
              ? `You are signed in as ${membership.role.name} of ${membership.organization.name}.`
              : "You are not a member of any organization yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          Your workspace is ready. Properties, units, and leases come next.
        </CardContent>
      </Card>
    </div>
  )
}
