import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { DayType, Punch, PunchType } from "@prisma/client";

export const DEFAULT_REQUIRED_HOURS = Number(
  process.env.DEFAULT_REQUIRED_HOURS || 8
);
export const HALF_DAY_REQUIRED_HOURS = Number(
  process.env.HALF_DAY_REQUIRED_HOURS || 4
);
export const FULL_DAY_LEAVE_REQUIRED_HOURS = 0;

export function formatDurationWithSeconds(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
}

export type LeaveTimeStatus = "leave_day" | "now" | "scheduled" | "clock_in";

export interface LeaveTimeInfo {
  at: Date | null;
  status: LeaveTimeStatus;
}

function computeGoalMetAt(
  pairs: Array<{ in: Date | string; out: Date | string | null }>,
  requiredMs: number,
  now: Date
): Date | null {
  let cumulative = 0;

  for (const pair of pairs) {
    const pairIn = pair.in instanceof Date ? pair.in : new Date(pair.in);
    const end =
      pair.out == null ? now : pair.out instanceof Date ? pair.out : new Date(pair.out);
    const durationMs = Math.max(0, end.getTime() - pairIn.getTime());
    if (cumulative + durationMs >= requiredMs) {
      const neededMs = requiredMs - cumulative;
      return new Date(pairIn.getTime() + neededMs);
    }
    cumulative += durationMs;
  }

  return null;
}

export function getLeaveTimeInfo(
  summary: {
    effectiveMs: number;
    requiredHours: number;
    isComplete: boolean;
    hasOpenSession?: boolean;
    pairs: Array<{ in: Date | string; out: Date | string | null }>;
  },
  now: Date
): LeaveTimeInfo {
  const requiredMs = summary.requiredHours * 3600000;

  if (summary.requiredHours === 0) {
    return { at: now, status: "leave_day" };
  }

  if (summary.isComplete) {
    return {
      at: computeGoalMetAt(summary.pairs, requiredMs, now) ?? now,
      status: "now",
    };
  }

  if (summary.hasOpenSession) {
    const remainingMs = Math.max(0, requiredMs - summary.effectiveMs);
    return {
      at: new Date(now.getTime() + remainingMs),
      status: "scheduled",
    };
  }

  return { at: null, status: "clock_in" };
}

export interface ParsedPunch {
  type: PunchType;
  timestamp: Date;
}

export interface DaySummary {
  date: string;
  effectiveMs: number;
  grossMs: number;
  effectiveHours: number;
  grossHours: number;
  requiredHours: number;
  dayType: DayType;
  isComplete: boolean;
  hasOpenSession: boolean;
  punches: Array<{
    id: string;
    type: PunchType;
    timestamp: Date;
    isManual: boolean;
  }>;
  pairs: Array<{
    in: Date;
    out: Date | null;
    durationMs: number;
  }>;
}

export function formatHours(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export function formatHoursDecimal(ms: number): number {
  return Math.round((ms / 3600000) * 100) / 100;
}

export function getRequiredHours(
  dayType: DayType,
  customRequired?: number
): number {
  if (customRequired !== undefined) return customRequired;
  if (dayType === "FULL_DAY_LEAVE") return FULL_DAY_LEAVE_REQUIRED_HOURS;
  if (dayType === "HALF_DAY_LEAVE") return HALF_DAY_REQUIRED_HOURS;
  return DEFAULT_REQUIRED_HOURS;
}

export function calculateFromPunches(
  punches: Array<Pick<Punch, "id" | "type" | "timestamp" | "isManual">>,
  options: {
    date: string;
    dayType?: DayType;
    requiredHours?: number;
    now?: Date;
  }
): DaySummary {
  const now = options.now ?? new Date();
  const sorted = [...punches].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const pairs: DaySummary["pairs"] = [];
  let effectiveMs = 0;
  let currentIn: Date | null = null;

  for (const punch of sorted) {
    if (punch.type === "IN") {
      currentIn = punch.timestamp;
    } else if (punch.type === "OUT" && currentIn) {
      const durationMs = punch.timestamp.getTime() - currentIn.getTime();
      effectiveMs += Math.max(0, durationMs);
      pairs.push({ in: currentIn, out: punch.timestamp, durationMs });
      currentIn = null;
    }
  }

  const hasOpenSession = currentIn !== null;

  if (currentIn) {
    const durationMs = Math.max(0, now.getTime() - currentIn.getTime());
    effectiveMs += durationMs;
    pairs.push({ in: currentIn, out: null, durationMs });
  }

  const firstIn = sorted.find((p) => p.type === "IN")?.timestamp;
  const lastOut = [...sorted].reverse().find((p) => p.type === "OUT")?.timestamp;

  let grossMs = 0;
  if (firstIn) {
    // Gross = first IN → last OUT. If OUT is missing, extend to now (live).
    const grossEnd = hasOpenSession ? now : (lastOut ?? now);
    grossMs = Math.max(0, grossEnd.getTime() - firstIn.getTime());
  }

  const dayType = options.dayType ?? "FULL";
  const requiredHours = getRequiredHours(dayType, options.requiredHours);

  return {
    date: options.date,
    effectiveMs,
    grossMs,
    effectiveHours: formatHoursDecimal(effectiveMs),
    grossHours: formatHoursDecimal(grossMs),
    requiredHours,
    dayType,
    isComplete: effectiveMs >= requiredHours * 3600000,
    hasOpenSession,
    punches: sorted,
    pairs,
  };
}

export function getDateKey(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

export function getWeekRange(reference: Date = new Date()) {
  const start = startOfWeek(reference, { weekStartsOn: 1 });
  const end = endOfWeek(reference, { weekStartsOn: 1 });
  return { start, end };
}

export function getMonthRange(reference: Date = new Date()) {
  return { start: startOfMonth(reference), end: endOfMonth(reference) };
}

export function enumerateDates(start: Date, end: Date): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(format(cursor, "yyyy-MM-dd"));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function parseTimeOnDate(
  dateKey: string,
  timeStr: string,
  reference?: Date
): Date {
  const ref = reference ?? parseISO(`${dateKey}T12:00:00`);
  const match = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) throw new Error("Invalid time format");

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  const meridiem = match[4]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const result = new Date(ref);
  result.setHours(hours, minutes, seconds, 0);
  return result;
}

export const WEEKLY_WORK_TARGET_HOURS = Number(
  process.env.WEEKLY_WORK_TARGET_HOURS || 40
);

export function isWeekendDate(dateKey: string): boolean {
  const day = parseISO(`${dateKey}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

export function filterWorkDays(daily: DaySummary[]): DaySummary[] {
  return daily.filter((d) => !isWeekendDate(d.date));
}

export type AttendanceStatus = "off" | "absent" | "working" | "complete";

export function getAttendanceStatus(
  summary: Pick<DaySummary, "punches" | "isComplete">,
  dateKey: string
): AttendanceStatus {
  if (isWeekendDate(dateKey)) return "off";
  const hasIn = summary.punches.some((p) => p.type === "IN");
  if (!hasIn) return "absent";
  if (summary.isComplete) return "complete";
  return "working";
}

export interface PeriodStats {
  totalEffectiveMs: number;
  totalGrossMs: number;
  totalRequiredMs: number;
  daysTracked: number;
  daysComplete: number;
  daily: DaySummary[];
}

export interface WorkPeriodStats extends PeriodStats {
  workDaysInRange: number;
  weeklyTargetMs: number;
  isWeeklyTargetMet: boolean;
  remainingToTargetMs: number;
}

export function aggregatePeriod(daily: DaySummary[]): PeriodStats {
  return daily.reduce(
    (acc, day) => ({
      totalEffectiveMs: acc.totalEffectiveMs + day.effectiveMs,
      totalGrossMs: acc.totalGrossMs + day.grossMs,
      totalRequiredMs: acc.totalRequiredMs + day.requiredHours * 3600000,
      daysTracked: acc.daysTracked + (day.punches.length > 0 ? 1 : 0),
      daysComplete: acc.daysComplete + (day.isComplete ? 1 : 0),
      daily: [...acc.daily, day],
    }),
    {
      totalEffectiveMs: 0,
      totalGrossMs: 0,
      totalRequiredMs: 0,
      daysTracked: 0,
      daysComplete: 0,
      daily: [] as DaySummary[],
    }
  );
}

export function aggregateWorkPeriod(
  daily: DaySummary[],
  options?: { weeklyTargetHours?: number }
): WorkPeriodStats {
  const workDays = filterWorkDays(daily);
  const base = aggregatePeriod(workDays);
  const weeklyTargetMs =
    (options?.weeklyTargetHours ?? WEEKLY_WORK_TARGET_HOURS) * 3600000;

  return {
    ...base,
    workDaysInRange: workDays.length,
    weeklyTargetMs,
    isWeeklyTargetMet: base.totalEffectiveMs >= weeklyTargetMs,
    remainingToTargetMs: Math.max(0, weeklyTargetMs - base.totalEffectiveMs),
  };
}
