/**
 * Categories must stay in step with the icon switch in
 * components/properties/property-icon.tsx — a value not listed there falls back
 * to a generic icon, so add to both places together.
 */
export const CATEGORY_OPTIONS = [
  "Apartments",
  "Office suites",
  "Hostel rooms",
  "Villas",
  "Retail units",
] as const;

export const AMENITY_OPTIONS = [
  "Borehole water",
  "Backup generator",
  "CCTV",
  "Parking",
  "24/7 security",
  "Lift",
  "Fibre internet",
  "Air conditioning",
  "Swimming pool",
  "Garden",
  "Shared kitchen",
  "Study room",
  "Laundry",
  "Loading bay",
] as const;

export const PROPERTY_TYPE_OPTIONS = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
] as const;

export const PROPERTY_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
] as const;
