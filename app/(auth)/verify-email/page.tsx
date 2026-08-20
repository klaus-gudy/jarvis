import { redirect } from "next/navigation";

import { AuthHeader } from "@/components/auth/auth-header";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { needsEmailVerification } from "@/lib/auth/email-verification";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * The one signed-in page outside the app shell. It deliberately sits in the
 * `(auth)` group — the centred card, no sidebar — but it is not an auth page
 * in `proxy.ts`'s sense: a signed-out visitor is sent to `/login` like any
 * other protected route, and a signed-in one is not bounced away.
 */
export default async function VerifyEmailPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Nothing to do here — already confirmed, or never required. Sending them on
  // rather than showing a code box for a gate that isn't holding them.
  if (!needsEmailVerification(user)) redirect("/dashboard");

  return (
    <>
      <AuthHeader
        title="Confirm your email"
        subtitle={
          <>
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{user.email}</span>.
            Enter it to finish setting up your account.
          </>
        }
      />
      <VerifyEmailForm />
    </>
  );
}
