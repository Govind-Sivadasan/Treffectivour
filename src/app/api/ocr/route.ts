import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { runOcr, type OcrResult } from "@/lib/ocr";
import { prisma } from "@/lib/db";
import { getDaySummary, getOrCreateDayRecord } from "@/lib/day-service";
import type { PunchType } from "@prisma/client";

async function saveOcrPunches(
  userId: string,
  date: string,
  ocr: OcrResult
) {
  const record = await getOrCreateDayRecord(userId, date);
  await prisma.punch.deleteMany({ where: { dayRecordId: record.id } });

  for (const [index, punch] of ocr.punches.entries()) {
    if (!punch.timestamp) continue;
    await prisma.punch.create({
      data: {
        userId,
        dayRecordId: record.id,
        type: punch.type,
        timestamp: punch.timestamp,
        sortOrder: index,
        isManual: false,
      },
    });
  }

  return getDaySummary(userId, date);
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      const date = body.date as string;
      const punches = body.punches as Array<{
        type: PunchType;
        timestamp: string;
      }>;

      if (!date || !punches?.length) {
        return NextResponse.json(
          { error: "date and punches required" },
          { status: 400 }
        );
      }

      const ocr: OcrResult = {
        dateKey: date,
        dateLabel: null,
        location: null,
        rawText: body.rawText ?? "",
        punches: punches.map((p) => ({
          type: p.type,
          time: p.timestamp,
          timestamp: new Date(p.timestamp),
        })),
      };

      const summary = await saveOcrPunches(session.id, date, ocr);
      return NextResponse.json({ ocr, summary });
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    const dateOverride = formData.get("date") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Image required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ocr = await runOcr(buffer);
    const date = dateOverride || ocr.dateKey;

    if (!date) {
      return NextResponse.json(
        { error: "Could not detect date. Please set date manually.", ocr },
        { status: 422 }
      );
    }

    return NextResponse.json({ ocr, date });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "OCR processing failed" }, { status: 500 });
  }
}
