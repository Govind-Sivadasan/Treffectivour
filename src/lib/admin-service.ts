import {
  aggregateWorkPeriod,
  calculateFromPunches,
  enumerateDates,
  getAttendanceStatus,
  getDateKey,
  getMonthRange,
  getWeekRange,
  type DaySummary,
  type WorkPeriodStats,
} from "./calculations";
import { prisma } from "./db";

function summariesForUser(
  dayRecords: Array<{
    date: string;
    dayType: DaySummary["dayType"];
    requiredHours: number;
    punches: Array<{
      id: string;
      type: "IN" | "OUT";
      timestamp: Date;
      isManual: boolean;
    }>;
  }>,
  dates: string[],
  now: Date
): DaySummary[] {
  const recordMap = new Map(dayRecords.map((r) => [r.date, r]));
  return dates.map((date) => {
    const record = recordMap.get(date);
    if (!record) return calculateFromPunches([], { date, now });
    return calculateFromPunches(record.punches, {
      date,
      dayType: record.dayType,
      requiredHours: record.requiredHours,
      now,
    });
  });
}

export async function getAdminOverview(now = new Date()) {
  const todayKey = getDateKey(now);
  const { start: weekStart, end: weekEnd } = getWeekRange(now);
  const weekDateList = enumerateDates(weekStart, weekEnd);
  const { start: monthStart, end: monthEnd } = getMonthRange(now);
  const monthDateList = enumerateDates(monthStart, monthEnd);
  const allDates = [...new Set([...weekDateList, ...monthDateList, todayKey])];

  const users = await prisma.user.findMany({
    where: { role: "USER" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      dayRecords: {
        where: { date: { in: allDates } },
        include: { punches: { orderBy: [{ sortOrder: "asc" }, { timestamp: "asc" }] } },
      },
    },
    orderBy: { name: "asc" },
  });

  const data = users.map((user) => {
    const weekDaily = summariesForUser(user.dayRecords, weekDateList, now);
    const monthDaily = summariesForUser(user.dayRecords, monthDateList, now);
    const todaySummary =
      weekDaily.find((d) => d.date === todayKey) ??
      calculateFromPunches([], { date: todayKey, now });

    const firstIn = todaySummary.punches.find((p) => p.type === "IN");

    const weekStats: WorkPeriodStats = aggregateWorkPeriod(weekDaily);
    const monthStats: WorkPeriodStats = aggregateWorkPeriod(monthDaily);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      today: {
        ...todaySummary,
        status: getAttendanceStatus(todaySummary, todayKey),
        firstInAt: firstIn?.timestamp.toISOString() ?? null,
      },
      week: {
        totalEffectiveHours: weekStats.totalEffectiveMs / 3600000,
        totalGrossHours: weekStats.totalGrossMs / 3600000,
        daysTracked: weekStats.daysTracked,
        daysComplete: weekStats.daysComplete,
        workDaysInRange: weekStats.workDaysInRange,
        weeklyTargetHours: weekStats.weeklyTargetMs / 3600000,
        isWeeklyTargetMet: weekStats.isWeeklyTargetMet,
        remainingHours: weekStats.remainingToTargetMs / 3600000,
      },
      month: {
        totalEffectiveHours: monthStats.totalEffectiveMs / 3600000,
        totalGrossHours: monthStats.totalGrossMs / 3600000,
        daysTracked: monthStats.daysTracked,
        daysComplete: monthStats.daysComplete,
        workDaysInRange: monthStats.workDaysInRange,
        totalRequiredHours: monthStats.totalRequiredMs / 3600000,
      },
      daily: weekDaily.filter((d) => d.punches.length > 0),
    };
  });

  return {
    todayDate: todayKey,
    weekRange: { start: weekDateList[0], end: weekDateList.at(-1) },
    monthRange: { start: monthDateList[0], end: monthDateList.at(-1) },
    users: data,
  };
}
