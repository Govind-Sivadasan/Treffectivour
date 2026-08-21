export interface TimePickerValue {
  hours: number;
  minutes: number;
  seconds: number;
  meridiem: "AM" | "PM";
}

/** Stable SSR-safe placeholder; set to real time in useEffect on the client. */
export const DEFAULT_TIME_PICKER_VALUE: TimePickerValue = {
  hours: 12,
  minutes: 0,
  seconds: 0,
  meridiem: "PM",
};

export function dateToTimePickerValue(date: Date): TimePickerValue {
  let hours = date.getHours();
  const meridiem: "AM" | "PM" = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return {
    hours,
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    meridiem,
  };
}

export function nowTimePickerValue(): TimePickerValue {
  return dateToTimePickerValue(new Date());
}

/** Build a Date in the user's local timezone (avoids server UTC drift). */
export function timePickerToDate(dateKey: string, v: TimePickerValue): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  let hours = v.hours;
  if (v.meridiem === "PM" && hours < 12) hours += 12;
  if (v.meridiem === "AM" && hours === 12) hours = 0;
  return new Date(year, month - 1, day, hours, v.minutes, v.seconds, 0);
}

export function timeStringToDate(dateKey: string, timeStr: string): Date {
  const match = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) throw new Error("Invalid time");
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  const meridiem = match[4]?.toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds, 0);
}
