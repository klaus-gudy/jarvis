import {
  BedIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  HouseIcon,
  StoreIcon,
} from "lucide-react";

import type { PropertyType } from "@/lib/generated/prisma/enums";

/**
 * Returns JSX per branch rather than resolving an icon into a variable, which
 * `react-hooks/static-components` reads as building a component during render.
 */
export function PropertyIcon({
  category,
  type,
  className,
}: {
  category: string;
  type: PropertyType;
  className?: string;
}) {
  switch (category.toLowerCase()) {
    case "apartments":
      return <Building2Icon className={className} />;
    case "office suites":
      return <BriefcaseBusinessIcon className={className} />;
    case "hostel rooms":
      return <BedIcon className={className} />;
    case "villas":
      return <HouseIcon className={className} />;
    case "retail units":
      return <StoreIcon className={className} />;
    default:
      return type === "COMMERCIAL" ? (
        <BriefcaseBusinessIcon className={className} />
      ) : (
        <Building2Icon className={className} />
      );
  }
}
