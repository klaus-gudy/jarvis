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
          identifier?.includes("@") ? (
            <>
              We sent a 6-digit code to{" "}
              <span className="font-medium text-foreground">{identifier}</span>.
              Enter it below.
            </>
          ) : identifier ? (
            // Codes go by email only: a phone number is how the account was
            // found, not where the code went.
            <>
              If an account uses{" "}
              <span className="font-medium text-foreground">{identifier}</span>,
              we emailed a 6-digit code to the address on it. No email on your
              account? Ask your landlord to add one, then request a new code.
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
