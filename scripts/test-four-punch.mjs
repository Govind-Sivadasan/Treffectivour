import { parseOcrText } from "../src/lib/ocr.ts";

const raw = `2:19:38 AM
12:55:58 PM
1:40:51 PM
6:09:38 PM`;

console.log("=== 4-punch grid OCR ===");
const r = parseOcrText(raw);
console.log(r.punches.map((p) => `${p.type} ${p.time}`).join("\n"));
console.log("count:", r.punches.length);
