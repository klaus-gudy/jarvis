import { BrandLogo } from "@/components/logo";
import { SITE_NAME } from "@/lib/site";

/**
 * Brand row + page heading shared by every (auth) page. The logo repeats here
 * even though the brand panel shows it, because the panel is hidden below lg —
 * on mobile this is the only branding on screen.
 */
export function AuthHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: React.ReactNode;
}) {
  return (
    <div className="mb-8 space-y-6">
      <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
        <BrandLogo className="size-9" />
        {SITE_NAME}
      </div>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
