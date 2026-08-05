import { AuthHeader } from "@/components/auth/auth-header";
import { VerifyOtpForm } from "@/components/auth/verify-otp-form";

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ identifier?: string }>;
}) {
  const { identifier } = await searchParams;

  return (
    <>
      <AuthHeader
        title="Check your messages"
        subtitle={
          identifier ? (
            <>
              We sent a 6-digit code to{" "}
              <span className="font-medium text-foreground">{identifier}</span>.
              Enter it below.
            </>
          ) : (
            "Enter the 6-digit verification code you received."
          )
        }
      />
      <VerifyOtpForm identifier={identifier ?? null} />
    </>
  );
}
