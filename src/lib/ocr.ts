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

function compactToTime(digits: string, meridiem: string): string {
  const m = normalizeMeridiem(meridiem) ?? "AM";
  if (digits.length === 5) {
    const hour = digits[0];
    const mm = digits.slice(1, 3);
    const ss = digits.slice(3, 5);
    let candidate = `${hour}:${mm}:${ss} ${m}`;

    // OCR often drops the tens digit of minutes (70948 -> 70048 => 7:00:48).
    if (mm === "00" && Number(ss) >= 30) {
      for (let tens = 9; tens >= 1; tens--) {
        const alt = `${hour}:${String(tens).padStart(2, "0")}:${ss} ${m}`;
        if (isValidTimeString(normalizeTimeToken(alt))) {
          candidate = alt;
          break;
        }
      }
    }

    return candidate;
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

  const compactRegex = new RegExp(COMPACT_TIME.source, "gi");
  while ((match = compactRegex.exec(text)) !== null) {
    add(compactToTime(match[1], match[2]));
  }

  const hhmmDotRegex = new RegExp(HHMM_DOT_SS.source, "gi");
  while ((match = hhmmDotRegex.exec(text)) !== null) {
    const digits = match[1];
    const m = normalizeMeridiem(match[3]) ?? "PM";
    add(`${digits.slice(0, 2)}:${digits.slice(2, 4)}:${match[2]} ${m}`);
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
  return t;
}

function extractTimesFromLine(line: string): string[] {
  return refineTimes(extractTimes(line));
}

function isHeaderLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (/missing/i.test(line)) return false;
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

/** Attendance popup OCR often yields one time per line (IN, OUT, IN, OUT…). */
function parseGridFromLines(
  text: string,
  dateForParsing: string,
  refDate: Date
): OcrResult["punches"] {
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

  const punches: OcrResult["punches"] = [];
  for (let i = 0; i < times.length; i++) {
    pushPunch(punches, i % 2 === 0 ? "IN" : "OUT", times[i], dateForParsing, refDate);
  }

  return dedupePunches(punches);
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

export function parseOcrText(text: string, referenceDate?: Date): OcrResult {
  const normalized = normalizeOcrLayout(text);
  const { dateKey, label } = inferDateFromText(normalized);
  const refDate = referenceDate ?? new Date();
  const dateForParsing =
    dateKey ??
    `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-${String(refDate.getDate()).padStart(2, "0")}`;

  const times = refineTimes(extractTimes(normalized));
  const linePunches = parsePunchesFromLines(normalized, dateForParsing, refDate);
  const gridPunches = parseGridFromLines(normalized, dateForParsing, refDate);
  const punches =
    gridPunches.length >= linePunches.length ? gridPunches : linePunches;

  // Fallback when line layout yields nothing but times exist globally
  if (punches.length === 0 && times.length > 0) {
    for (let i = 0; i < times.length; i++) {
      const type: PunchType = i % 2 === 0 ? "IN" : "OUT";
      pushPunch(punches, type, times[i], dateForParsing, refDate);
    }
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

async function preprocessImage(imageData: Buffer): Promise<Buffer> {
  const { Jimp } = await import("jimp");
  const image = await Jimp.read(imageData);
  const scale = image.width < 400 ? 4 : image.width < 800 ? 3 : 2;
  image
    .scale(scale)
    .greyscale()
    .contrast(0.35)
    .normalize();
  return image.getBuffer("image/png");
}

async function recognizeText(imageData: Buffer, psm: string): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: psm as unknown as (typeof PSM)[keyof typeof PSM],
      tessedit_char_whitelist: "0123456789:.,APMapmMISSINGGayatriTechnopark()AugJanFebMarAprMayJunJulSepOctNovDec/- ",
    });
    const { data } = await worker.recognize(imageData);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export async function runOcr(imageData: Buffer | string): Promise<OcrResult> {
  const input = Buffer.isBuffer(imageData)
    ? imageData
    : Buffer.from(
        imageData.replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );

  let processed: Buffer;
  try {
    processed = await preprocessImage(input);
  } catch {
    processed = input;
  }

  const psms = ["11", "6", "13", "7"];
  let best: OcrResult | null = null;

  for (const psm of psms) {
    try {
      const raw = await recognizeText(processed, psm);
      const parsed = parseOcrText(raw);
      if (!best || parsed.punches.length > best.punches.length) {
        best = { ...parsed, rawText: raw };
      }
      if (parsed.punches.length >= 3) break;
    } catch {
      // try next mode
    }
  }

  if (best && best.punches.length > 0) return best;

  for (const psm of psms) {
    try {
      const raw = await recognizeText(input, psm);
      const parsed = parseOcrText(raw);
      if (!best || parsed.punches.length > best.punches.length) {
        best = { ...parsed, rawText: raw };
      }
    } catch {
      // try next
    }
  }

  return best ?? parseOcrText("");
}

async function preprocessImageInBrowser(file: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width < 400 ? 4 : bitmap.width < 800 ? 3 : 2;
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file instanceof File ? file : new File([file], "ocr.png");

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const boosted = gray < 128 ? gray * 0.85 : Math.min(255, gray * 1.15);
    data[i] = data[i + 1] = data[i + 2] = boosted;
  }
  ctx.putImageData(imageData, 0, 0);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to preprocess image"))),
      "image/png"
    );
  });
}

export async function runOcrInBrowser(file: File | Blob): Promise<OcrResult> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    let input: File | Blob = file;
    try {
      input = await preprocessImageInBrowser(file);
    } catch {
      // use original
    }

    const modes = [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK, PSM.RAW_LINE];
    let best: OcrResult | null = null;

    for (const psm of modes) {
      await worker.setParameters({
        tessedit_pageseg_mode: psm,
        tessedit_char_whitelist:
          "0123456789:.,APMapmMISSINGGayatriTechnopark()AugJanFebMarAprMayJunJulSepOctNovDec/- ",
      });
      const { data } = await worker.recognize(input);
      const parsed = parseOcrText(data.text);
      if (!best || parsed.punches.length > best.punches.length) {
        best = { ...parsed, rawText: data.text };
      }
      if (parsed.punches.length >= 3) break;
    }

    return best ?? parseOcrText("");
  } finally {
    await worker.terminate();
  }
}
