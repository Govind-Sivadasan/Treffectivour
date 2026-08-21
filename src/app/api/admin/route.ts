import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  aggregatePeriod,
  enumerateDates,
  getMonthRange,
  calculateFromPunches,
} from "@/lib/calculations";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month";
    const now = new Date();
    const { start, end } = getMonthRange(now);
    const dates = enumerateDates(start, end);

    const users = await prisma.user.findMany({
      where: { role: "USER" },
      select: {
        id: true,
        name: true,
        email: true,
        dayRecords: {
          where: { date: { in: dates } },
          include: { punches: { orderBy: { timestamp: "asc" } } },
        },
      },
    });

    const data = users.map((user) => {
      const recordMap = new Map(user.dayRecords.map((r) => [r.date, r]));
      const daily = dates.map((date) => {
        const record = recordMap.get(date);
        if (!record) return calculateFromPunches([], { date, now });
        return calculateFromPunches(record.punches, {
          date,
          dayType: record.dayType,
          requiredHours: record.requiredHours,
          now,
        });
      });
      const stats = aggregatePeriod(daily);
      return {
        user: { id: user.id, name: user.name, email: user.email },
        stats: {
          totalEffectiveHours: stats.totalEffectiveMs / 3600000,
          totalGrossHours: stats.totalGrossMs / 3600000,
          daysTracked: stats.daysTracked,
          daysComplete: stats.daysComplete,
        },
        daily: daily.filter((d) => d.punches.length > 0),
      };
    });

    return NextResponse.json({ period, users: data });
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
