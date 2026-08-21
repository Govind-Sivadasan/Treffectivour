import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  aggregatePeriod,
  enumerateDates,
  getDateKey,
  getMonthRange,
  getWeekRange,
} from "@/lib/calculations";
import { getDaySummary, getSummariesForRange } from "@/lib/day-service";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "today";
    const dateParam = searchParams.get("date");
    const now = new Date();

    if (period === "today") {
      const date = dateParam || getDateKey(now);
      const summary = await getDaySummary(session.id, date, now);
      return NextResponse.json({ period: "today", summary });
    }

    const ref = dateParam ? new Date(`${dateParam}T12:00:00`) : now;

    if (period === "week") {
      const { start, end } = getWeekRange(ref);
      const dates = enumerateDates(start, end);
      const daily = await getSummariesForRange(session.id, dates, now);
      const stats = aggregatePeriod(daily);
      return NextResponse.json({ period: "week", stats, range: { start: dates[0], end: dates.at(-1) } });
    }

    if (period === "month") {
      const { start, end } = getMonthRange(ref);
      const dates = enumerateDates(start, end);
      const daily = await getSummariesForRange(session.id, dates, now);
      const stats = aggregatePeriod(daily);
      return NextResponse.json({ period: "month", stats, range: { start: dates[0], end: dates.at(-1) } });
    }

    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed to fetch dashboard" }, { status: 500 });
  }
}
