import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CHECKOUT_URL } from "@/lib/site";
import { RentopsWordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  firstParam,
  normalizePaymentOutcome,
  safeReference,
  type PaymentOutcome,
} from "@/lib/payment-return";

/**
 * Where a payment gateway drops the payer once checkout is over.
 *
 * Built as `not-found.tsx` is — one centred column on the plain background,
 * outside every route group, so it carries no sidebar and no sign-in panel.
 * A page somebody sees once, for ten seconds, in whatever browser the payment
 * finished in, should be the smallest thing that answers "did that work?".
 *
 * **Public, and it has to be.** The browser arriving here has just come back
 * from a provider's domain; a bounce to `/login` at that moment tells somebody
 * who has just paid that we have never heard of them. Hence the entry in
 * `proxy.ts`'s `PUBLIC_PAGES`, and hence the rule the page is written under:
 * everything it knows arrives as a **query parameter the payer can edit**, so
 * `?status=success` is a claim, not a fact. It prints words and grants nothing.
 * The trusted record is snippe's signed webhook (`/api/webhooks/snippe`),
 * which writes a `BillingEvent`; this page could later look that row up by
 * reference instead of believing the status word.
 */

export const metadata: Metadata = {
  title: "Payment",
  // A real return URL carries a live transaction reference, so an indexed one
  // publishes a stranger's payment id. `robots.ts` disallows the path too.
  robots: { index: false, follow: false },
};

/**
 * One line of copy per outcome, and nothing else. `pending` is not folded into
 * success because mobile money settles after the redirect, and telling someone
 * it is done when it isn't makes them pay twice; `unknown` is not folded into
 * failure because a provider that redirects with no status at all is normal,
 * and "your payment failed" is the one guess that costs a person money.
 */
const COPY: Record<PaymentOutcome, { title: string; body: string }> = {
  succeeded: {
    title: "Payment received",
    body: "Thank you. Your payment went through and your account is ready.",
  },
  pending: {
    title: "Confirming your payment",
    body: "We're waiting for the provider to confirm it — mobile money can take a minute. You don't need to pay again.",
  },
  failed: {
    title: "That payment didn't go through",
    body: "Nothing has been taken from your account. You can try again whenever you're ready.",
  },
  unknown: {
    title: "Checking your payment",
    body: "The provider sent you back without saying how it went. If money has left your account it will be applied shortly — don't pay a second time.",
  },
};

export default async function PaymentCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const outcome = normalizePaymentOutcome(
    firstParam(params.status) ?? firstParam(params.state)
  );

  // Providers disagree on the name of this field, and a return URL often
  // carries two spellings of it.
  const reference = safeReference(
    firstParam(params.reference) ??
      firstParam(params.ref) ??
      firstParam(params.tx_ref) ??
      firstParam(params.trxref)
  );

  const copy = COPY[outcome];

  return (
    <main className="relative flex min-h-svh items-center justify-center bg-background p-6 sm:p-10">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <RentopsWordmark className="mb-10" />

        {/* The slot 404 gives its status code. A reference is the one thing a
            payer may need to read back to us, and monospace is how a string
            copied character by character wants to be set. */}
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          {reference ?? "Payment"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {copy.title}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{copy.body}</p>

        <div className="mt-8 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
          {outcome === "failed" ? (
            <>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                nativeButton={false}
                render={<Link href="/" />}
              >
                Take me home
              </Button>
              {/* Straight back to the hosted checkout, not to the pricing
                  table — somebody re-reading three packages after a card was
                  declined is being asked to make a decision they already
                  made. A plain <a> because it leaves the site, and no plan
                  parameter because a failed payment's return URL is not a
                  reliable record of which package was being bought. */}
              <Button
                className="w-full sm:w-auto"
                nativeButton={false}
                render={<a href={CHECKOUT_URL} />}
              >
                Try again
              </Button>
            </>
          ) : (
            /* One button, and it is a plain link: no auto-redirect. This is the
               only screen the reference appears on, and a page that walks away
               on a timer takes it with it. */
            <Button
              className="w-full sm:w-auto"
              nativeButton={false}
              render={<Link href="/dashboard" />}
            >
              Go to dashboard
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
