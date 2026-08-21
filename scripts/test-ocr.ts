import fs from "fs";
import { createWorker, PSM } from "tesseract.js";
import { parseOcrText, runOcr } from "../src/lib/ocr.ts";

const imagePath =
  "C:/Users/1219/.cursor/projects/d-PROJECTS-Treffectivour/assets/c__Users_1219_AppData_Roaming_Cursor_User_workspaceStorage_f555ec4319025a8696fabc803280f9c9_images_image-0b8087a1-7640-477e-a220-38378416f949.png";

const buf = fs.readFileSync(imagePath);

async function main() {
  console.log("=== full runOcr ===");
  const result = await runOcr(buf);
  console.log("punches:", result.punches.length, result.punches);
  console.log("raw:", JSON.stringify(result.rawText));
}

main().catch(console.error);
