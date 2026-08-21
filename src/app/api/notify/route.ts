import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { markGoalNotified } from "@/lib/day-service";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const { recordId } = await request.json();
    if (!recordId) {
      return NextResponse.json({ error: "recordId required" }, { status: 400 });
    }

    await markGoalNotified(recordId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
