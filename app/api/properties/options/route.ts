import { requireActiveOrg } from "@/lib/api-auth";
import {
  AMENITY_OPTIONS,
  CATEGORY_OPTIONS,
  PROPERTY_STATUS_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from "@/lib/property-options";

/** Picker options for the property form. Static, but auth-gated for consistency. */
export async function GET() {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  return Response.json({
    categories: CATEGORY_OPTIONS,
    amenities: AMENITY_OPTIONS,
    types: PROPERTY_TYPE_OPTIONS,
    statuses: PROPERTY_STATUS_OPTIONS,
  });
}
