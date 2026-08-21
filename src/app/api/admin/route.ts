import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminOverview } from "@/lib/admin-service";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const overview = await getAdminOverview();
    return NextResponse.json(overview);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { date, name, requiredHours } = await request.json();
    if (!date || !name || requiredHours === undefined) {
      return NextResponse.json({ error: "date, name, requiredHours required" }, { status: 400 });
    }

    const special = await prisma.specialDay.upsert({
      where: { date },
      create: { date, name, requiredHours: Number(requiredHours) },
      update: { name, requiredHours: Number(requiredHours) },
    });

    return NextResponse.json({ special });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
