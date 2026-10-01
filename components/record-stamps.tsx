import { formatDate } from "@/lib/format";
import type { RecordStamps as Stamps } from "@/lib/record-stamps";

/**
 * "Created by Amina on 12 Aug 2026 · Last edited by Juma on 1 Oct 2026".
 * A missing name drops the "by" rather than guessing: rows from before actors
 * were recorded have none. "Last edited" is left off for a record never changed.
 */
export function RecordStamps({ stamps }: { stamps: Stamps | null }) {
  if (!stamps) return null;
  const by = (name: string | null) => (name ? ` by ${name}` : "");
  const edited = stamps.updatedAt.getTime() - stamps.createdAt.getTime() > 1000;
  return (
    <p className="text-xs text-muted-foreground">
      Created{by(stamps.createdBy)} on {formatDate(stamps.createdAt)}
      {edited && (
        <>
          {" · "}Last edited{by(stamps.updatedBy)} on {formatDate(stamps.updatedAt)}
        </>
      )}
    </p>
  );
}
