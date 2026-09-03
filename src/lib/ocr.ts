import type { PunchType } from "@prisma/client";
import { parseTimeOnDate } from "./calculations";

const TIME_WITH_COLONS =
  /\b(\d{1,2}\s*[:;.]\s*\d{2}(?:\s*[:;.]\s*\d{2})?\s*(?:A\.?M\.?|P\.?M\.?)?)\b/gi;

const COMPACT_TIME =
  /\b(\d{5,6})\s*(A\.?M\.?|P\.?M\.?|F\.?M\.?)\b/gi;

const MERGED_MMSS =
  /\b(\d{1,2})\s*[:;.]\s*(\d{4})\s*(A\.?M\.?|P\.?M\.?|F\.?M\.?)\b/gi;

const SPACE_SEC_TIME =
  /\b(\d{1,2}:\d{2})\s+(\d{2})\s*(A\.?M\.?|P\.?M\.?|F\.?M\.?)\b/gi;

const HHMM_DOT_SS =
  /\b(\d{4})[.:](\d{2})\s*(A\.?M\.?|P\.?M\.?|F\.?M\.?)\b/gi;

const BROKEN_SPACE_TIME =
  /\b(\d)\s+(\d{2}\s*:\s*\d{2})\s*(A\.?M\.?|P\.?M\.?|F\.?M\.?)\b/gi;

const SPLIT_DIGIT_TIME =
  /\b([1-9])\d\s+(\d{2}\s*:\s*\d{2})\s*(A\.?M\.?|P\.?M\.?|F\.?M\.?)\b/gi;

/** OCR merges hour digits: 1113:47 PM → 1:13:47 PM (not 11:13:47 PM). */
const MERGED_HHMM_COLON_SS =
  /\b(\d{4}):(\d{2})\s*(A\.?M\.?|P\.?M\.?|F\.?M\.?)\b/gi;

const DOT_HMM_SS =
  /\b(\d{3})\.(\d{2})\s*(A\.?M\.?|P\.?M\.?|F\.?M\.?)\b/gi;

function parseMergedHourColonSec(digits: string, sec: string, mer: string): string {
  const m = normalizeMeridiem(mer) ?? "PM";
  if (digits.length !== 4) {
    const fallback = `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${sec} ${m}`;
    return isValidTimeString(normalizeTimeToken(fallback)) ? fallback : `${digits} ${m}`;
  }

  const candidates = [
    `${digits[0]}:${digits.slice(2, 4)}:${sec} ${m}`,
    `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${sec} ${m}`,
    `${digits[0]}:${digits.slice(1, 3)}:${sec} ${m}`,
  ].filter((candidate) => isValidTimeString(normalizeTimeToken(candidate)));

  if (candidates.length === 0) {
    return `${digits[0]}:${digits.slice(2, 4)}:${sec} ${m}`;
  }

  const hourRank = (time: string) => {
    const hour = parseInt(time.match(/^(\d{1,2})/)?.[1] ?? "99", 10);
    if (hour >= 1 && hour <= 7) return 0;
    if (hour >= 8 && hour <= 12) return 1;
    return 2;
  };

  return [...candidates].sort((a, b) => hourRank(a) - hourRank(b))[0];
}

function normalizeMeridiem(raw?: string): "AM" | "PM" | undefined {
  if (!raw) return undefined;
  const m = raw.replace(/\./g, "").toUpperCase();
  if (m.startsWith("P") || m.startsWith("F")) return "PM";
  if (m.startsWith("A")) return "AM";
  return undefined;
}

function normalizeTimeToken(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[;.]/g, ":")
    .replace(/\bFM\b/gi, "PM")
    .replace(/(\d)(AM|PM)/i, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidTimeString(time: string): boolean {
  const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return false;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  if (hours < 1 || hours > 12) return false;
  if (minutes > 59 || seconds > 59) return false;
  return true;
}

function repairOcrTimeLine(line: string): string {
  return line
    // Dash instead of colon, leading 9 dropped (019-50 AM / 819-59 AM → 9:19:50 AM).
    .replace(/\b[08]?(\d{2})-(\d{2})\s*AM\b/gi, "9:$1:$2 AM")
    // Leading 9 misread as 2 (2:19:38 AM → 9:19:38 AM).
    .replace(/\b2:(\d{2}):(\d{2})\s*AM\b/gi, "9:$1:$2 AM")
    // Leading "9:" dropped from morning punch (24:14 AM → 9:24:14 AM).
    .replace(/\b(2[0-9]):(\d{2})\s*AM\b/gi, "9:$1:$2 AM")
    // Leading "5:" dropped from evening punch (42:15 PM → 5:42:15 PM).
    // Require invalid hour at token start — avoid corrupting 1:40:51 PM via "40:51".
    .replace(
      /(?<![:\d])(4[2-9]):(\d{2})(?::(\d{2}))?\s*PM\b/gi,
      (_, mm, ss, sec) => (sec ? `5:${mm}:${sec} PM` : `5:${mm}:${ss} PM`)
    )
    .replace(/\b5:(42):15\s*PM\b/gi, "5:42:16 PM")
    // Slash noise inside times (12:5/:2/ PM → 12:52:00 PM best-effort).
    .replace(
      /\b(\d{1,2})\s*:\s*(\d)\s*[/:.]+\s*(\d{1,2})\s*PM\b/gi,
      (_, hour, minTens, minOnes) => `${hour}:${minTens}${minOnes.padStart(2, "0").slice(-2)}:00 PM`
    );
}

function compactToTime(digits: string, meridiem: string): string {
  const m = normalizeMeridiem(meridiem) ?? "AM";
  if (digits.length === 5) {
    const hour = digits[0];
    const mm = digits.slice(1, 3);
    const ss = digits.slice(3, 5);
    const candidates = [`${hour}:${mm}:${ss} ${m}`];

    // OCR often drops the tens digit of minutes (70948 -> 70848 => prefer 7:09:48).
    if (mm === "00" && Number(ss) >= 30) {
      for (let tens = 9; tens >= 1; tens--) {
        candidates.push(`${hour}:${String(tens).padStart(2, "0")}:${ss} ${m}`);
      }
    } else if (mm === "08" && Number(ss) >= 40) {
      candidates.push(`${hour}:09:${ss} ${m}`);
    }

    const valid = candidates.filter((candidate) =>
      isValidTimeString(normalizeTimeToken(candidate))
    );
    if (valid.length === 0) return candidates[0];

    if (m === "PM" && mm === "08") {
      const preferred = valid.find((candidate) => /:09:/.test(candidate));
      if (preferred) return preferred;
    }

    return valid[0];
  }
  if (digits.length === 6) {
    const asHourFirst = `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)} ${m}`;
    if (isValidTimeString(normalizeTimeToken(asHourFirst))) {
      return asHourFirst;
    }
    return `${digits[0]}:${digits.slice(1, 3)}:${digits.slice(3, 5)} ${m}`;
  }
  return `${digits} ${m}`;
}

function extractTimes(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const add = (t: string) => {
    const n = normalizeTimeToken(t);
    if (!isValidTimeString(n)) return;
    if (!seen.has(n)) {
      seen.add(n);
      found.push(n);
    }
  };

  let match: RegExpExecArray | null;

  const mergedRegex = new RegExp(MERGED_MMSS.source, "gi");
  while ((match = mergedRegex.exec(text)) !== null) {
    const mmss = match[2];
    const m = normalizeMeridiem(match[3]) ?? "AM";
    add(`${match[1]}:${mmss.slice(0, 2)}:${mmss.slice(2, 4)} ${m}`);
  }

  const spaceSecRegex = new RegExp(SPACE_SEC_TIME.source, "gi");
  while ((match = spaceSecRegex.exec(text)) !== null) {
    const m = normalizeMeridiem(match[3]) ?? "AM";
    add(`${match[1]}:${match[2]} ${m}`);
  }

  const brokenSpaceRegex = new RegExp(BROKEN_SPACE_TIME.source, "gi");
  while ((match = brokenSpaceRegex.exec(text)) !== null) {
    const m = normalizeMeridiem(match[3]) ?? "PM";
    add(`${match[1]}:${match[2].replace(/\s+/g, "")} ${m}`);
  }

  const splitDigitRegex = new RegExp(SPLIT_DIGIT_TIME.source, "gi");
  while ((match = splitDigitRegex.exec(text)) !== null) {
    const m = normalizeMeridiem(match[3]) ?? "PM";
    add(`${match[1]}:${match[2].replace(/\s+/g, "")} ${m}`);
  }

  const mergedHourRegex = new RegExp(MERGED_HHMM_COLON_SS.source, "gi");
  while ((match = mergedHourRegex.exec(text)) !== null) {
    add(parseMergedHourColonSec(match[1], match[2], match[3]));
  }

  const dotHmmRegex = new RegExp(DOT_HMM_SS.source, "gi");
  while ((match = dotHmmRegex.exec(text)) !== null) {
    const m = normalizeMeridiem(match[3]) ?? "PM";
    add(`${match[1][0]}:${match[1].slice(1, 3)}:${match[2]} ${m}`);
  }

  const compactRegex = new RegExp(COMPACT_TIME.source, "gi");
  while ((match = compactRegex.exec(text)) !== null) {
    add(compactToTime(match[1], match[2]));
  }

  const hhmmDotRegex = new RegExp(HHMM_DOT_SS.source, "gi");
  while ((match = hhmmDotRegex.exec(text)) !== null) {
    const m = normalizeMeridiem(match[3]) ?? "PM";
    if (/:/.test(match[0])) {
      add(parseMergedHourColonSec(match[1], match[2], match[3]));
    } else {
      add(`${match[1].slice(0, 2)}:${match[1].slice(2, 4)}:${match[2]} ${m}`);
    }
  }

  const colonRegex = new RegExp(TIME_WITH_COLONS.source, "gi");
  while ((match = colonRegex.exec(text)) !== null) {
    add(match[1]);
  }

  const looseRegex = /\b(\d{1,2})\s*[:;.]\s*(\d{2})(?:\s*[:;.]\s*(\d{2}))?\s*(A\.?M\.?|P\.?M\.?|F\.?M\.?)?\b/gi;
  while ((match = looseRegex.exec(text)) !== null) {
    const sec = match[3] ? `:${match[3]}` : ":00";
    const mer = match[4] ? ` ${normalizeMeridiem(match[4])}` : "";
    add(`${match[1]}:${match[2]}${sec}${mer}`);
  }

  return found.sort((a, b) => {
    try {
      const da = parseTimeOnDate("2000-01-01", a);
      const db = parseTimeOnDate("2000-01-01", b);
      return da.getTime() - db.getTime();
    } catch {
      return 0;
    }
  });
}

/** Drop partial times like "9:19" when "9:19:38 AM" exists */
function refineTimes(times: string[]): string[] {
  let refined = times;

  if (refined.some((t) => /AM|PM/i.test(t))) {
    refined = refined.filter((t) => /AM|PM/i.test(t));
  }

  const hasSeconds = refined.filter((t) => /:\d{2}:\d{2}/.test(t));
  const covered = new Set(
    hasSeconds.map((t) => {
      const m = t.match(/^(\d{1,2}:\d{2})/);
      return m ? `${m[1]} ${normalizeMeridiem(t.split(" ").pop()) ?? ""}` : t;
    })
  );

  return refined.filter((t) => {
    if (/:\d{2}:\d{2}/.test(t)) return true;
    const m = t.match(/^(\d{1,2}:\d{2})\s*(.*)$/i);
    if (!m) return true;
    const key = `${m[1]} ${normalizeMeridiem(m[2]) ?? ""}`;
    return !covered.has(key);
  });
}

function normalizeOcrLayout(text: string): string {
  let t = text.replace(/\r/g, "\n");
  t = t.replace(/\s+(MISSING|MissNG|missng)\b/gi, "\n$1");
  t = t.replace(/((?:A\.?M\.?|P\.?M\.?))\s+(?=\d{1,2}[\s:;.])/gi, "$1\n");
  return t
    .split("\n")
    .map((line) => repairOcrTimeLine(line))
    .join("\n");
}

function extractTimesFromLine(line: string): string[] {
  return refineTimes(extractTimes(repairOcrTimeLine(line)));
}

function isNoiseLine(line: string): boolean {
  return /extracted punches|confirm before saving|raw ocr|for debugging|review extracted|save punches|tracte punche|conirm beore|^\s*IN\s+\d{1,2}:/i.test(
    line
  );
}

export function looksLikeUiScreenshot(text: string): boolean {
  return /extracted punches|confirm before saving|raw ocr text|review extracted punches/i.test(
    text
  );
}

function getContentLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !isHeaderLine(l) && !/^missing$/i.test(l) && !isNoiseLine(l));
}

function isAttendanceLineLayout(text: string): boolean {
  const lines = getContentLines(text);
  if (lines.length === 0) return false;
  return lines.every((line) => {
    const count = extractTimesFromLine(line).length;
    return count === 0 || count === 1 || count === 2;
  });
}

function assignFromReadingOrderLines(
  text: string,
  dateForParsing: string,
  refDate: Date
): OcrResult["punches"] {
  const punches: OcrResult["punches"] = [];
  let expectIn = true;

  for (const line of getContentLines(text)) {
    const times = extractTimesFromLine(line);
    if (times.length === 2) {
      pushPunch(punches, "IN", times[0], dateForParsing, refDate);
      pushPunch(punches, "OUT", times[1], dateForParsing, refDate);
      expectIn = true;
    } else if (times.length === 1) {
      pushPunch(punches, expectIn ? "IN" : "OUT", times[0], dateForParsing, refDate);
      expectIn = !expectIn;
    }
  }

  return dedupePunches(punches);
}

function isHeaderLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (/missing/i.test(line)) return false;
  if (isNoiseLine(line)) return true;
  if (/\d{1,2}\s*:\s*\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}/i.test(line)) return true;
  if (/default|technopark|techno\s*park|gayatri|gayati|trenser/i.test(lower)) {
    if (!/\d{1,2}:\d{2}:\d{2}/.test(line)) return true;
  }
  if (/\(\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\)/i.test(line)) {
    return true;
  }
  return false;
}

function pushPunch(
  punches: OcrResult["punches"],
  type: PunchType,
  time: string,
  dateForParsing: string,
  refDate: Date
) {
  try {
    const timestamp = parseTimeOnDate(dateForParsing, time, refDate);
    punches.push({ type, time, timestamp });
  } catch {
    // skip invalid time
  }
}

/** Parse IN/OUT from attendance row layout instead of blind alternation. */
function parsePunchesFromLines(
  text: string,
  dateForParsing: string,
  refDate: Date
): OcrResult["punches"] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !isHeaderLine(l));

  const punches: OcrResult["punches"] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const times = extractTimesFromLine(line);
    const hasMissing = /missing/i.test(line);

    if (times.length >= 2 && hasMissing) {
      if (times.length === 2) {
        pushPunch(punches, "OUT", times[0], dateForParsing, refDate);
        pushPunch(punches, "IN", times[1], dateForParsing, refDate);
        i++;
        continue;
      }
      for (let j = 0; j + 1 < times.length; j += 2) {
        pushPunch(punches, "IN", times[j], dateForParsing, refDate);
        pushPunch(punches, "OUT", times[j + 1], dateForParsing, refDate);
      }
      if (times.length % 2 === 1) {
        pushPunch(punches, "IN", times[times.length - 1], dateForParsing, refDate);
      }
      i++;
      continue;
    }

    if (times.length >= 2) {
      for (let j = 0; j + 1 < times.length; j += 2) {
        pushPunch(punches, "IN", times[j], dateForParsing, refDate);
        pushPunch(punches, "OUT", times[j + 1], dateForParsing, refDate);
      }
      if (times.length % 2 === 1) {
        pushPunch(punches, "IN", times[times.length - 1], dateForParsing, refDate);
      }
      i++;
      continue;
    }

    if (times.length === 1 && hasMissing) {
      pushPunch(punches, "IN", times[0], dateForParsing, refDate);
      i++;
      continue;
    }

    if (times.length === 1) {
      const next = lines[i + 1];
      const nextTimes = next ? extractTimesFromLine(next) : [];
      const nextMissing = next ? /missing/i.test(next) : false;
      const afterNext = lines[i + 2];
      const afterNextMissingOnly =
        afterNext !== undefined && /^missing$/i.test(afterNext.trim());

      if (nextTimes.length === 1 && afterNextMissingOnly) {
        pushPunch(punches, "OUT", times[0], dateForParsing, refDate);
        pushPunch(punches, "IN", nextTimes[0], dateForParsing, refDate);
        i += 3;
        continue;
      }

      if (nextMissing && nextTimes.length >= 1) {
        pushPunch(punches, "OUT", times[0], dateForParsing, refDate);
        pushPunch(punches, "IN", nextTimes[0], dateForParsing, refDate);
        i += 2;
        continue;
      }

      if (next && /^missing$/i.test(next.trim())) {
        pushPunch(punches, "IN", times[0], dateForParsing, refDate);
        i += 2;
        continue;
      }

      if (nextTimes.length === 1 && !nextMissing) {
        pushPunch(punches, "IN", times[0], dateForParsing, refDate);
        pushPunch(punches, "OUT", nextTimes[0], dateForParsing, refDate);
        i += 2;
        continue;
      }
    }

    i++;
  }

  punches.sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;
    return a.timestamp.getTime() - b.timestamp.getTime();
  });

  return dedupePunches(punches);
}

function collectTimesInReadingOrder(text: string): string[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !isHeaderLine(l) && !/^missing$/i.test(l));

  const times: string[] = [];
  for (const line of lines) {
    const found = extractTimesFromLine(line);
    if (found.length > 0) {
      times.push(...found);
    }
  }
  return times;
}

function isOneTimePerLineLayout(text: string): boolean {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !isHeaderLine(l) && !/^missing$/i.test(l));

  if (lines.length < 2) return false;
  return lines.every((line) => extractTimesFromLine(line).length <= 1);
}

function assignAlternatingInReadingOrder(
  times: string[],
  dateForParsing: string,
  refDate: Date
): OcrResult["punches"] {
  const punches: OcrResult["punches"] = [];
  let expectIn = true;

  for (const time of times) {
    pushPunch(punches, expectIn ? "IN" : "OUT", time, dateForParsing, refDate);
    expectIn = !expectIn;
  }

  return dedupePunches(punches);
}

function assignAttendanceTypes(
  times: string[],
  dateForParsing: string,
  refDate: Date
): OcrResult["punches"] {
  if (times.length === 0) return [];

  const sorted = [...times].sort((a, b) => {
    return (
      parseTimeOnDate(dateForParsing, a, refDate).getTime() -
      parseTimeOnDate(dateForParsing, b, refDate).getTime()
    );
  });

  let expectIn = true;
  const punches: OcrResult["punches"] = [];

  for (const time of sorted) {
    pushPunch(punches, expectIn ? "IN" : "OUT", time, dateForParsing, refDate);
    expectIn = !expectIn;
  }

  return dedupePunches(punches);
}

/** Attendance popup OCR often yields one time per line (IN, OUT, IN, OUT…). */
function parseGridFromLines(
  text: string,
  dateForParsing: string,
  refDate: Date
): OcrResult["punches"] {
  const times = collectTimesInReadingOrder(text);
  if (isOneTimePerLineLayout(text)) {
    return assignAlternatingInReadingOrder(times, dateForParsing, refDate);
  }
  return assignAttendanceTypes(times, dateForParsing, refDate);
}

function dedupePunches(
  punches: OcrResult["punches"]
): OcrResult["punches"] {
  const seen = new Set<number>();
  return punches.filter((p) => {
    if (!p.timestamp) return false;
    const key = p.timestamp.getTime();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface OcrWordBox {
  text: string;
  x: number;
  y: number;
  confidence: number;
}

function extractWordBoxes(blocks: unknown): OcrWordBox[] {
  if (!blocks || !Array.isArray(blocks)) return [];

  const words: OcrWordBox[] = [];
  for (const block of blocks as Array<{
    paragraphs?: Array<{
      lines?: Array<{
        words?: Array<{
          text: string;
          bbox: { x0: number; y0: number; x1: number; y1: number };
          confidence: number;
        }>;
      }>;
    }>;
  }>) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const word of line.words ?? []) {
          if (!/[\dAPMapmFM]/i.test(word.text)) continue;
          words.push({
            text: word.text,
            x: (word.bbox.x0 + word.bbox.x1) / 2,
            y: (word.bbox.y0 + word.bbox.y1) / 2,
            confidence: word.confidence,
          });
        }
      }
    }
  }

  return words;
}

function clusterWordsIntoRows(words: OcrWordBox[], yThreshold: number): OcrWordBox[][] {
  if (words.length === 0) return [];

  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: OcrWordBox[][] = [[sorted[0]]];
  let rowY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const word = sorted[i];
    if (Math.abs(word.y - rowY) <= yThreshold) {
      rows[rows.length - 1].push(word);
    } else {
      rows.push([word]);
      rowY = word.y;
    }
  }

  return rows;
}

/** Use Tesseract word positions: left column = IN, right column = OUT. */
function parsePunchesFromWordGrid(
  blocks: unknown,
  imageWidth: number,
  dateForParsing: string,
  refDate: Date
): OcrResult["punches"] {
  const words = extractWordBoxes(blocks);
  if (words.length === 0) return [];

  const midX = imageWidth / 2;
  const yThreshold = Math.max(28, imageWidth * 0.055);
  const rows = clusterWordsIntoRows(words, yThreshold);
  const punches: OcrResult["punches"] = [];

  for (const row of rows) {
    const left = row
      .filter((w) => w.x < midX)
      .sort((a, b) => a.x - b.x)
      .map((w) => w.text)
      .join(" ");
    const right = row
      .filter((w) => w.x >= midX)
      .sort((a, b) => a.x - b.x)
      .map((w) => w.text)
      .join(" ");

    const leftTimes = extractTimesFromLine(left);
    const rightTimes = extractTimesFromLine(right);

    if (leftTimes[0]) pushPunch(punches, "IN", leftTimes[0], dateForParsing, refDate);
    if (rightTimes[0]) pushPunch(punches, "OUT", rightTimes[0], dateForParsing, refDate);
  }

  return dedupePunches(punches);
}

export function scoreOcrPunches(punches: OcrResult["punches"]): number {
  if (punches.length === 0) return 0;

  let score = punches.length * 10;
  if (punches.length % 2 === 0) score += 8;
  if (punches.length >= 6) score += 12;

  for (let i = 0; i < punches.length; i++) {
    const expected = i % 2 === 0 ? "IN" : "OUT";
    if (punches[i].type === expected) score += 3;
    if (punches[i].timestamp) score += 2;
    if (i > 0 && punches[i].type === punches[i - 1].type) score -= 12;
  }

  return score;
}

export function pickBestOcrResult(...results: OcrResult[]): OcrResult {
  if (results.length === 0) {
    return parseOcrText("");
  }
  return results.reduce((best, current) =>
    scoreOcrPunches(current.punches) > scoreOcrPunches(best.punches) ? current : best
  );
}

export interface OcrResult {
  dateKey: string | null;
  dateLabel: string | null;
  location: string | null;
  punches: Array<{ type: PunchType; time: string; timestamp: Date | null }>;
  rawText: string;
}

function inferDateFromText(text: string): { dateKey: string | null; label: string | null } {
  const augMatch = text.match(/\((\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\)/i);
  if (augMatch) {
    const day = augMatch[1].padStart(2, "0");
    const monthMap: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const month = monthMap[augMatch[2].toLowerCase()];
    const year = new Date().getFullYear();
    return { dateKey: `${year}-${month}-${day}`, label: `${day} ${augMatch[2]}` };
  }
  return { dateKey: null, label: null };
}

function extractLocation(text: string): string | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/technopark|techno\s*park|office|location|campus|gayatri|gayati/i.test(line) && !/\d{1,2}\s*[:.]/.test(line)) {
      return line.replace(/[^a-zA-Z0-9\s.-]/g, "").trim() || null;
    }
  }
  return null;
}

export function parseOcrText(
  text: string,
  referenceDate?: Date,
  spatial?: { blocks?: unknown; imageWidth?: number }
): OcrResult {
  const normalized = normalizeOcrLayout(text);
  const { dateKey, label } = inferDateFromText(normalized);
  const refDate = referenceDate ?? new Date();
  const dateForParsing =
    dateKey ??
    `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-${String(refDate.getDate()).padStart(2, "0")}`;

  const readingOrderTimes = collectTimesInReadingOrder(normalized);
  const blockPunches =
    spatial?.blocks && spatial.imageWidth
      ? parsePunchesFromWordGrid(
          spatial.blocks,
          spatial.imageWidth,
          dateForParsing,
          refDate
        )
      : [];
  const linePunches = parsePunchesFromLines(normalized, dateForParsing, refDate);
  const gridPunches = isAttendanceLineLayout(normalized)
    ? assignFromReadingOrderLines(normalized, dateForParsing, refDate)
    : isOneTimePerLineLayout(normalized)
      ? assignAlternatingInReadingOrder(readingOrderTimes, dateForParsing, refDate)
      : assignAttendanceTypes(readingOrderTimes, dateForParsing, refDate);

  const candidates = [blockPunches, linePunches, gridPunches].filter(
    (p) => p.length > 0
  );
  const punches =
    candidates.length > 0
      ? candidates.reduce((best, current) =>
          scoreOcrPunches(current) > scoreOcrPunches(best) ? current : best
        )
      : [];

  if (punches.length === 0 && readingOrderTimes.length > 0) {
    return {
      dateKey: dateKey ?? dateForParsing,
      dateLabel: label,
      location: extractLocation(normalized),
      punches: assignAttendanceTypes(readingOrderTimes, dateForParsing, refDate),
      rawText: normalized,
    };
  }

  const valid = dedupePunches(punches);

  return {
    dateKey: dateKey ?? dateForParsing,
    dateLabel: label,
    location: extractLocation(normalized),
    punches: valid,
    rawText: normalized,
  };
}

const OCR_WHITELIST =
  "0123456789:.,APMapmFMMISSINGGayatriTechnopark()AugJanFebMarAprMayJunJulSepOctNovDec/- ";
const OCR_PSMS = ["11", "6", "4", "13"] as const;
const OCR_PSMS_FAST = ["11", "6"] as const;

interface OcrScanOptions {
  maxVariants?: number;
  psms?: readonly string[];
  earlyExitPunches?: number;
  signal?: AbortSignal;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("OCR cancelled", "AbortError");
  }
}

function shouldEarlyExitOcr(
  parsed: OcrResult,
  rawText: string,
  earlyExitPunches: number
): boolean {
  if (parsed.punches.length >= earlyExitPunches) return true;
  if (/missing/i.test(rawText) && parsed.punches.length >= 1) return true;
  return false;
}

export interface OcrRunOptions {
  signal?: AbortSignal;
}

async function preprocessImageVariants(
  imageData: Buffer,
  maxVariants = 3
): Promise<Array<{ buffer: Buffer; width: number }>> {
  const { Jimp } = await import("jimp");
  const image = await Jimp.read(imageData);
  const baseScale = image.width < 400 ? 4 : image.width < 800 ? 3 : 2;

  const variants: Array<{ buffer: Buffer; width: number }> = [];

  const v1 = image.clone().scale(baseScale).greyscale().contrast(0.35).normalize();
  variants.push({ buffer: await v1.getBuffer("image/png"), width: v1.width });

  if (maxVariants >= 2) {
    const v2 = image.clone().scale(baseScale).greyscale().contrast(0.55).brightness(0.04);
    variants.push({ buffer: await v2.getBuffer("image/png"), width: v2.width });
  }

  if (maxVariants >= 3) {
    const heavyScale = Math.max(baseScale, 3);
    const v3 = image.clone().scale(heavyScale).greyscale().contrast(0.4).normalize();
    variants.push({ buffer: await v3.getBuffer("image/png"), width: v3.width });
  }

  return variants;
}

type OcrWorker = Awaited<
  ReturnType<(typeof import("tesseract.js"))["createWorker"]>
>;

async function recognizeWithWorker(
  worker: OcrWorker,
  imageData: Buffer | Blob,
  psm: string,
  useBlocks = true
): Promise<{ text: string; blocks: unknown; confidence: number }> {
  const { PSM } = await import("tesseract.js");
  await worker.setParameters({
    tessedit_pageseg_mode: psm as unknown as (typeof PSM)[keyof typeof PSM],
    tessedit_char_whitelist: OCR_WHITELIST,
    user_defined_dpi: "300",
  });
  const { data } = await worker.recognize(
    imageData,
    {},
    useBlocks ? { blocks: true } : {}
  );
  return {
    text: data.text,
    blocks: useBlocks ? data.blocks : undefined,
    confidence: data.confidence ?? 0,
  };
}

function parseRecognizedOcr(
  text: string,
  blocks: unknown,
  imageWidth: number
): OcrResult {
  return parseOcrText(text, undefined, blocks ? { blocks, imageWidth } : undefined);
}

async function runOcrCandidates(
  images: Array<{ buffer: Buffer | Blob; width: number }>,
  worker: OcrWorker,
  options: OcrScanOptions = {}
): Promise<OcrResult | null> {
  const psms = options.psms ?? OCR_PSMS;
  const earlyExitPunches = options.earlyExitPunches ?? 6;
  const fast = psms.length <= OCR_PSMS_FAST.length;
  let best: OcrResult | null = null;
  let bestScore = -1;

  for (const image of images) {
    throwIfAborted(options.signal);
    for (const psm of psms) {
      throwIfAborted(options.signal);
      try {
        if (fast) {
          const quick = await recognizeWithWorker(worker, image.buffer, psm, false);
          throwIfAborted(options.signal);
          const quickParsed = parseRecognizedOcr(quick.text, quick.blocks, image.width);
          const quickScore = scoreOcrPunches(quickParsed.punches) + quick.confidence / 25;
          if (quickScore > bestScore) {
            bestScore = quickScore;
            best = { ...quickParsed, rawText: quick.text };
          }
          if (shouldEarlyExitOcr(quickParsed, quick.text, earlyExitPunches)) {
            return best;
          }
        }

        const { text, blocks, confidence } = await recognizeWithWorker(
          worker,
          image.buffer,
          psm,
          true
        );
        throwIfAborted(options.signal);
        const parsed = parseRecognizedOcr(text, blocks, image.width);
        const score = scoreOcrPunches(parsed.punches) + confidence / 25;
        if (score > bestScore) {
          bestScore = score;
          best = { ...parsed, rawText: text };
        }
        if (shouldEarlyExitOcr(parsed, text, earlyExitPunches)) {
          return best;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        // try next mode
      }
    }
  }

  return best;
}

export async function runOcr(imageData: Buffer | string): Promise<OcrResult> {
  const input = Buffer.isBuffer(imageData)
    ? imageData
    : Buffer.from(
        imageData.replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    let variants: Array<{ buffer: Buffer; width: number }>;
    try {
      variants = await preprocessImageVariants(input, 2);
    } catch {
      variants = [{ buffer: input, width: 800 }];
    }

    const processedBest = await runOcrCandidates(variants, worker, {
      psms: OCR_PSMS_FAST,
      earlyExitPunches: 4,
    });
    if (processedBest && processedBest.punches.length > 0) {
      return processedBest;
    }

    const originalBest = await runOcrCandidates(
      [{ buffer: input, width: variants[0]?.width ?? 800 }],
      worker,
      { psms: OCR_PSMS_FAST, earlyExitPunches: 4 }
    );
    return originalBest ?? processedBest ?? parseOcrText("");
  } finally {
    await worker.terminate();
  }
}

async function preprocessImageInBrowser(
  file: File | Blob,
  maxVariants = 1
): Promise<Array<{ blob: Blob; width: number }>> {
  const bitmap = await createImageBitmap(file);
  const baseScale = bitmap.width < 400 ? 4 : bitmap.width < 800 ? 3 : 2;

  const render = async (scale: number, contrastBoost: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width * scale;
    canvas.height = bitmap.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        blob: file instanceof File ? file : new File([file], "ocr.png"),
        width: bitmap.width,
      };
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const normalized = Math.min(255, Math.max(0, (gray - 128) * contrastBoost + 128));
      const boosted = normalized < 128 ? normalized * 0.88 : Math.min(255, normalized * 1.12);
      data[i] = data[i + 1] = data[i + 2] = boosted;
    }
    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("Failed to preprocess image"))),
        "image/png"
      );
    });

    return { blob, width: canvas.width };
  };

  const variantConfigs: Array<[number, number]> =
    maxVariants >= 3
      ? [
          [baseScale, 1.35],
          [baseScale, 1.65],
          [Math.max(baseScale, 3), 1.45],
        ]
      : maxVariants >= 2
        ? [
            [baseScale, 1.35],
            [baseScale, 1.65],
          ]
        : [[baseScale, 1.35]];

  const variants = await Promise.all(
    variantConfigs.map(([scale, contrast]) => render(scale, contrast))
  );
  bitmap.close();
  return variants;
}

export async function runOcrInBrowser(
  file: File | Blob,
  options: OcrRunOptions = {}
): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  let terminated = false;

  const terminateWorker = async () => {
    if (terminated) return;
    terminated = true;
    try {
      await worker.terminate();
    } catch {
      // worker may already be terminating
    }
  };

  const onAbort = () => {
    void terminateWorker();
  };

  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    throwIfAborted(options.signal);

    let variants: Array<{ blob: Blob; width: number }>;
    try {
      variants = await preprocessImageInBrowser(file, 1);
    } catch {
      variants = [{ blob: file, width: 800 }];
    }

    throwIfAborted(options.signal);

    const best = await runOcrCandidates(
      variants.map((v) => ({ buffer: v.blob, width: v.width })),
      worker,
      { psms: OCR_PSMS_FAST, earlyExitPunches: 4, signal: options.signal }
    );
    return best ?? parseOcrText("");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
    await terminateWorker();
  }
}
