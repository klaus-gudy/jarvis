import { AuthHeader } from "@/components/auth/auth-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ identifier?: string; code?: string }>;
}) {
  const { identifier, code } = await searchParams;

  return (
    <>
      <AuthHeader
        title="Set a new password"
        subtitle="Choose a strong password you haven't used before."
      />
      <ResetPasswordForm identifier={identifier ?? null} code={code ?? null} />
    </>
  );
}
