import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/user-display";

/** Shared by the Users and Tenants tables so both render people identically. */
export function PersonCell({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="font-medium">{name}</span>
    </div>
  );
}
