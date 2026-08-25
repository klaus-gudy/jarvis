import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/user-display";

/**
 * Shared by every table and card that names a person, so the same member
 * looks the same everywhere — initials when there's no photo, the real one
 * when there is. `photoId` is optional and left undefined by callers with no
 * membership to look one up against (a pending invitation, for instance),
 * which reads identically to "no photo on file".
 */
export function PersonCell({
  name,
  photoId,
}: {
  name: string;
  photoId?: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="size-8 shrink-0">
        {photoId && <AvatarImage src={`/api/documents/${photoId}`} alt={name} />}
        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="font-medium">{name}</span>
    </div>
  );
}
