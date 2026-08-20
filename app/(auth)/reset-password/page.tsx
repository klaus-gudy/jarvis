import { AuthHeader } from "@/components/auth/auth-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeader
        title="Set a new password"
        subtitle="Choose a strong password you haven't used before."
      />
      <ResetPasswordForm />
    </>
  );
}
