export const UNIT_TYPE_OPTIONS = [
  "Studio",
  "1 Bedroom",
  "2 Bedroom",
  "3 Bedroom",
  "4+ Bedroom",
  "Single room",
  "Office",
  "Shop",
  "Warehouse",
] as const;

/**
 * Amenities that belong to an individual unit. Deliberately separate from
 * AMENITY_OPTIONS in lib/property-options.ts, which covers shared building
 * facilities like lifts and generators.
 */
export const UNIT_AMENITY_OPTIONS = [
  "Furnished",
  "Built-in wardrobes",
  "Air conditioning",
  "Ensuite bathroom",
  "Balcony",
  "Water heater",
  "Kitchen appliances",
  "Tiled floors",
  "Private entrance",
  "Sea view",
] as const;
