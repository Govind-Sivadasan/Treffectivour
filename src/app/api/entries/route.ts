import { NextResponse } from "next/server";
import type { DayType, PunchType } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { parseTimeOnDate, getEffectiveNowForDate } from "@/lib/calculations";
import { prisma } from "@/lib/db";
import { getDaySummary, getOrCreateDayRecord } from "@/lib/day-service";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const date = new URL(request.url).searchParams.get("date");
    if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
    const summary = await getDaySummary(session.id, date, getEffectiveNowForDate(date));
    return NextResponse.json({ summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const {
      date,
      type,
      time,
      timestamp: ts,
      dayType,
      requiredHours,
      notes,
    } = body as {
      date: string;
      type: PunchType;
      time?: string;
      timestamp?: string;
      dayType?: DayType;
      requiredHours?: number;
      notes?: string;
    };

    if (!date || !type) {
      return NextResponse.json({ error: "date and type required" }, { status: 400 });
    }

    const record = await getOrCreateDayRecord(session.id, date, {
      dayType,
      requiredHours,
      notes,
    });

    const lastPunch = await prisma.punch.findFirst({
      where: { dayRecordId: record.id },
      orderBy: [{ sortOrder: "desc" }, { timestamp: "desc" }],
      select: { sortOrder: true },
    });

    let punchTime: Date;
    if (ts) {
      punchTime = new Date(ts);
    } else if (time) {
      punchTime = parseTimeOnDate(date, time);
    } else {
      punchTime = new Date();
    }

    await prisma.punch.create({
      data: {
        userId: session.id,
        dayRecordId: record.id,
        type,
        timestamp: punchTime,
        sortOrder: (lastPunch?.sortOrder ?? -1) + 1,
        isManual: true,
      },
    });

    const summary = await getDaySummary(session.id, date, getEffectiveNowForDate(date));
    return NextResponse.json({ summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: msg || "Failed to add punch" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const { punchId, date, type, time, timestamp: ts } = body as {
      punchId: string;
      date: string;
      type?: PunchType;
      time?: string;
      timestamp?: string;
    };

    if (!punchId || !date) {
      return NextResponse.json({ error: "punchId and date required" }, { status: 400 });
    }

    const punch = await prisma.punch.findFirst({
      where: { id: punchId, userId: session.id },
    });
    if (!punch) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: { type?: PunchType; timestamp?: Date; isManual: boolean } = {
      isManual: true,
    };

    if (type) data.type = type;
    if (ts) {
      data.timestamp = new Date(ts);
    } else if (time) {
      data.timestamp = parseTimeOnDate(date, time);
    }

    if (!data.type && !data.timestamp) {
      return NextResponse.json({ error: "type or time required" }, { status: 400 });
    }

    await prisma.punch.update({
      where: { id: punchId },
      data,
    });

    const summary = await getDaySummary(session.id, date, getEffectiveNowForDate(date));
    return NextResponse.json({ summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: msg || "Failed to update punch" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const { date, dayType, requiredHours, notes, punchOrder } = body as {
      date?: string;
      dayType?: DayType;
      requiredHours?: number;
      notes?: string;
      punchOrder?: string[];
    };

    if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

    if (punchOrder) {
      if (!Array.isArray(punchOrder) || punchOrder.length === 0) {
        return NextResponse.json({ error: "punchOrder required" }, { status: 400 });
      }

      const record = await getOrCreateDayRecord(session.id, date);
      const punches = await prisma.punch.findMany({
        where: { dayRecordId: record.id, userId: session.id },
        select: { id: true },
      });

      if (punches.length !== punchOrder.length) {
        return NextResponse.json({ error: "Invalid punch order" }, { status: 400 });
      }

      const knownIds = new Set(punches.map((p) => p.id));
      if (punchOrder.some((id) => !knownIds.has(id))) {
        return NextResponse.json({ error: "Invalid punch order" }, { status: 400 });
      }

      await prisma.$transaction(
        punchOrder.map((id, index) =>
          prisma.punch.update({
            where: { id },
            data: { sortOrder: index },
          })
        )
      );

      const summary = await getDaySummary(session.id, date, getEffectiveNowForDate(date));
      return NextResponse.json({ summary });
    }

    await getOrCreateDayRecord(session.id, date, { dayType, requiredHours, notes });
    const summary = await getDaySummary(session.id, date, getEffectiveNowForDate(date));
    return NextResponse.json({ summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const punchId = new URL(request.url).searchParams.get("punchId");
    const date = new URL(request.url).searchParams.get("date");
    if (!punchId || !date) {
      return NextResponse.json({ error: "punchId and date required" }, { status: 400 });
    }

    const punch = await prisma.punch.findFirst({
      where: { id: punchId, userId: session.id },
    });
    if (!punch) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.punch.delete({ where: { id: punchId } });
    const summary = await getDaySummary(session.id, date, getEffectiveNowForDate(date));
    return NextResponse.json({ summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
