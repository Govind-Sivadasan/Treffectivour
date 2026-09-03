import fs from "fs";
import { parseOcrText, runOcr } from "../src/lib/ocr.ts";

const raw = `Gayatri Technopark
019-50 AM 12:57:27 PM
142.57 FM TOT4I FM`;

console.log("=== parse garbled ===");
const r = parseOcrText(raw);
console.log(r.punches.map((p) => `${p.type} ${p.time}`).join("\n") || "(none)");
console.log("count:", r.punches.length);

const imagePath =
  "C:/Users/1219/.cursor/projects/d-PROJECTS-Treffectivour/assets/c__Users_1219_AppData_Roaming_Cursor_User_workspaceStorage_f555ec4319025a8696fabc803280f9c9_images_image-00df018e-9c7f-487b-84d1-ee685dfa1f68.png";

if (fs.existsSync(imagePath)) {
  console.log("\n=== runOcr ===");
  const result = await runOcr(fs.readFileSync(imagePath));
  console.log("raw:", JSON.stringify(result.rawText));
  console.log("punches:", result.punches.map((p) => `${p.type} ${p.time}`).join(" | "));
}
