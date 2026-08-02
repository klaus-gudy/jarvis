import "dotenv/config";

import { prisma } from "../lib/prisma";

type UnitSeed = { label: string; rentAmount: number; occupied: boolean };
type PropertySeed = {
  name: string;
  type: "RESIDENTIAL" | "COMMERCIAL";
  category: string;
  address: string;
  ownerName: string;
  description: string;
  amenities: string[];
  units: UnitSeed[];
};

const properties: PropertySeed[] = [
  {
    name: "Mwenge Apartments",
    type: "RESIDENTIAL",
    category: "Apartments",
    address: "Kinondoni, Dar es Salaam",
    ownerName: "Aziz Holdings Ltd",
    description:
      "Residential property offering secure, serviced units with reliable water and backup power in a well-connected neighbourhood.",
    amenities: ["Borehole water", "Backup generator", "CCTV", "Parking", "24/7 security", "Lift"],
    units: [
      { label: "A1", rentAmount: 500_000, occupied: true },
      { label: "A2", rentAmount: 450_000, occupied: true },
      { label: "A3", rentAmount: 450_000, occupied: true },
      { label: "B1", rentAmount: 500_000, occupied: false },
      { label: "B2", rentAmount: 480_000, occupied: false },
    ],
  },
  {
    name: "Oyster Bay Office Park",
    type: "COMMERCIAL",
    category: "Office suites",
    address: "Oyster Bay, Dar es Salaam",
    ownerName: "Coastal REIT",
    description:
      "Grade-A office suites with fibre connectivity and dedicated parking, a short drive from the city centre.",
    amenities: ["Fibre internet", "Backup generator", "CCTV", "Parking", "24/7 security", "Lift", "Air conditioning"],
    units: [
      { label: "Suite 1", rentAmount: 1_800_000, occupied: true },
      { label: "Suite 2", rentAmount: 1_500_000, occupied: true },
      { label: "Suite 3", rentAmount: 1_600_000, occupied: false },
    ],
  },
  {
    name: "Mlimani City Hostel",
    type: "RESIDENTIAL",
    category: "Hostel rooms",
    address: "Ubungo, Dar es Salaam",
    ownerName: "UDSM Estates",
    description:
      "Affordable student rooms within walking distance of campus, with shared kitchens and study areas.",
    amenities: ["Borehole water", "CCTV", "24/7 security", "Shared kitchen", "Study room", "Laundry"],
    units: [
      { label: "Room 1", rentAmount: 210_000, occupied: true },
      { label: "Room 2", rentAmount: 210_000, occupied: false },
      { label: "Room 3", rentAmount: 195_000, occupied: false },
    ],
  },
  {
    name: "Masaki Garden Villas",
    type: "RESIDENTIAL",
    category: "Villas",
    address: "Masaki, Dar es Salaam",
    ownerName: "J. Mushi (Private)",
    description:
      "Spacious standalone villas with private gardens in a quiet diplomatic neighbourhood.",
    amenities: ["Borehole water", "Backup generator", "CCTV", "Parking", "24/7 security", "Swimming pool", "Garden"],
    units: [
      { label: "Villa 1", rentAmount: 3_800_000, occupied: true },
      { label: "Villa 2", rentAmount: 3_500_000, occupied: false },
    ],
  },
  {
    name: "Kariakoo Trade Plaza",
    type: "COMMERCIAL",
    category: "Retail units",
    address: "Ilala, Dar es Salaam",
    ownerName: "Kariakoo Holdings",
    description:
      "High-footfall retail units in the heart of the city's busiest trading district.",
    amenities: ["Backup generator", "CCTV", "24/7 security", "Loading bay", "Lift"],
    units: [
      { label: "Shop 1", rentAmount: 1_200_000, occupied: true },
      { label: "Shop 2", rentAmount: 900_000, occupied: false },
      { label: "Shop 3", rentAmount: 950_000, occupied: false },
    ],
  },
  {
    name: "Tegeta Heights",
    type: "RESIDENTIAL",
    category: "Apartments",
    address: "Kinondoni, Dar es Salaam",
    ownerName: "Aziz Holdings Ltd",
    description:
      "Modern apartments with sea breeze and easy access to the main highway.",
    amenities: ["Borehole water", "Backup generator", "CCTV", "Parking", "Lift"],
    units: [
      { label: "1A", rentAmount: 400_000, occupied: true },
      { label: "1B", rentAmount: 380_000, occupied: false },
      { label: "2A", rentAmount: 400_000, occupied: false },
    ],
  },
];

const tenants = [
  { name: "Neema Kimaro", email: "neema@tenant.test" },
  { name: "Baraka Mollel", email: "baraka@tenant.test" },
  { name: "Zawadi Shirima", email: "zawadi@tenant.test" },
  { name: "Juma Ally", email: "juma@tenant.test" },
  { name: "Rehema Nyerere", email: "rehema@tenant.test" },
  { name: "Frank Massawe", email: "frank@tenant.test" },
  { name: "Salma Hamisi", email: "salma@tenant.test" },
  { name: "Peter Mrema", email: "peter@tenant.test" },
  { name: "Anna Lyimo", email: "anna@tenant.test" },
  { name: "Hassan Juma", email: "hassan@tenant.test" },
  { name: "Grace Mushi", email: "grace@tenant.test" },
];

async function main() {
  // Pass an org name to target it explicitly, otherwise seed the newest org
  // (the one most likely just created by whoever is testing).
  const args = process.argv.slice(2);
  // --refresh-only updates properties that already exist and creates nothing,
  // so it can't resurrect properties someone deliberately deleted.
  const refreshOnly = args.includes("--refresh-only");
  const requestedName = args.find((arg) => !arg.startsWith("--"));
  const org = requestedName
    ? await prisma.organization.findFirst({ where: { name: requestedName } })
    : await prisma.organization.findFirst({ orderBy: { createdAt: "desc" } });

  if (!org) {
    throw new Error(
      requestedName
        ? `No organization named "${requestedName}".`
        : "No organization found — register an account first."
    );
  }

  console.log(`Seeding into organization: ${org.name}`);

  // Tenants need a Membership in this org, which needs a Tenant role.
  const tenantRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Tenant" } },
    update: {},
    create: { name: "Tenant", organizationId: org.id },
  });

  const memberships = [];
  for (const tenant of tenants) {
    const user = await prisma.user.upsert({
      where: { email: tenant.email },
      update: {},
      // Seeded tenants can't sign in; the hash is deliberately not a valid bcrypt digest.
      create: { email: tenant.email, name: tenant.name, passwordHash: "!seeded-no-login" },
    });
    memberships.push(
      await prisma.membership.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
        update: {},
        create: { userId: user.id, organizationId: org.id, roleId: tenantRole.id },
      })
    );
  }

  let tenantIndex = 0;
  for (const seed of properties) {
    const existing = await prisma.property.findFirst({
      where: { organizationId: org.id, name: seed.name },
    });
    if (existing) {
      await prisma.property.update({
        where: { id: existing.id },
        data: { description: seed.description, amenities: seed.amenities },
      });
      console.log(`  ~ ${seed.name} (existed, refreshed description/amenities)`);
      continue;
    }

    if (refreshOnly) {
      console.log(`  skip ${seed.name} (not present, --refresh-only)`);
      continue;
    }

    const property = await prisma.property.create({
      data: {
        name: seed.name,
        type: seed.type,
        category: seed.category,
        address: seed.address,
        ownerName: seed.ownerName,
        description: seed.description,
        amenities: seed.amenities,
        organizationId: org.id,
      },
    });

    for (const unit of seed.units) {
      const created = await prisma.unit.create({
        data: {
          label: unit.label,
          rentAmount: unit.rentAmount,
          propertyId: property.id,
        },
      });

      if (unit.occupied) {
        const membership = memberships[tenantIndex % memberships.length];
        tenantIndex += 1;
        await prisma.lease.create({
          data: {
            unitId: created.id,
            membershipId: membership.id,
            startDate: new Date("2026-01-01"),
            endDate: null,
          },
        });
      }
    }

    console.log(`  + ${seed.name} (${seed.units.length} units)`);
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
