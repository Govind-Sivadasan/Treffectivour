import type { DayType } from "@prisma/client";
import { prisma } from "./db";
import {
  calculateFromPunches,
  getDateKey,
  getRequiredHours,
  type DaySummary,
} from "./calculations";

export async function getOrCreateDayRecord(
  userId: string,
  date: string,
  overrides?: { dayType?: DayType; requiredHours?: number; notes?: string }
) {
  const dayType = overrides?.dayType ?? "FULL";
  const requiredHours =
    overrides?.requiredHours ?? getRequiredHours(dayType);

  return prisma.dayRecord.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      date,
      dayType,
      requiredHours,
      notes: overrides?.notes,
    },
    update: {
      ...(overrides?.dayType !== undefined ? { dayType: overrides.dayType } : {}),
      ...(overrides?.requiredHours !== undefined
        ? { requiredHours: overrides.requiredHours }
        : {}),
      ...(overrides?.notes !== undefined ? { notes: overrides.notes } : {}),
    },
    include: { punches: { orderBy: [{ sortOrder: "asc" }, { timestamp: "asc" }] } },
  });
}

export async function getDaySummary(
  userId: string,
  date: string,
  now?: Date
): Promise<
  DaySummary & {
    recordId: string;
    notes: string | null;
    goalNotifiedAt: Date | null;
    scheduledSpecialDay: { name: string; requiredHours: number } | null;
  }
> {
  const [record, special] = await Promise.all([
    getOrCreateDayRecord(userId, date),
    prisma.specialDay.findUnique({ where: { date } }),
  ]);
  const summary = calculateFromPunches(record.punches, {
    date,
    dayType: record.dayType,
    requiredHours: record.requiredHours,
    now,
  });

  return {
    ...summary,
    recordId: record.id,
    notes: record.notes,
    goalNotifiedAt: record.goalNotifiedAt,
    scheduledSpecialDay: special
      ? { name: special.name, requiredHours: special.requiredHours }
      : null,
  };
}

export async function getSummariesForRange(
  userId: string,
  dates: string[],
  now?: Date
) {
  const records = await prisma.dayRecord.findMany({
    where: { userId, date: { in: dates } },
    include: { punches: { orderBy: [{ sortOrder: "asc" }, { timestamp: "asc" }] } },
  });

  const recordMap = new Map(records.map((r) => [r.date, r]));

  return dates.map((date) => {
    const record = recordMap.get(date);
    if (!record) {
      return calculateFromPunches([], {
        date,
        now,
      });
    }
    return calculateFromPunches(record.punches, {
      date,
      dayType: record.dayType,
      requiredHours: record.requiredHours,
      now,
    });
  });
}

export async function markGoalNotified(recordId: string) {
  return prisma.dayRecord.update({
    where: { id: recordId },
    data: { goalNotifiedAt: new Date() },
  });
}

export { getDateKey };
