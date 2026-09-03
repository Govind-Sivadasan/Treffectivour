import fs from "fs";
import { parseOcrText, runOcr } from "../src/lib/ocr.ts";

const samples = [
  `Gayatri Technopark
9:29:28 AM
MISSING`,
  `Gayatri Technopark
9:29:28 AM MISSING`,
];

for (const raw of samples) {
  const r = parseOcrText(raw);
  console.log("---");
  console.log(r.punches.map((p) => `${p.type} ${p.time}`).join(", ") || "(none)");
}

const imagePath =
  "C:/Users/1219/.cursor/projects/d-PROJECTS-Treffectivour/assets/c__Users_1219_AppData_Roaming_Cursor_User_workspaceStorage_f555ec4319025a8696fabc803280f9c9_images_image-a1b29289-0a92-4491-a025-c35fd6b808d6.png";

if (fs.existsSync(imagePath)) {
  console.log("\n=== image OCR ===");
  const start = Date.now();
  const r = await runOcr(fs.readFileSync(imagePath));
  console.log("ms:", Date.now() - start);
  console.log("raw:", JSON.stringify(r.rawText));
  console.log("punches:", r.punches.map((p) => `${p.type} ${p.time}`).join(", "));
}
