import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const check = await prisma.healthCheck.create({ data: {} });
    const total = await prisma.healthCheck.count();

    return Response.json({
      status: "ok",
      database: "connected",
      checkId: check.id,
      checkedAt: check.createdAt,
      totalChecks: total,
    });
  } catch (error) {
    console.error("Health check failed:", error);

    return Response.json(
      { status: "error", database: "unreachable" },
      { status: 503 }
    );
  }
}
