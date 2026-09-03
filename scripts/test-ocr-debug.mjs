import fs from "fs";
import { runOcr, parseOcrText } from "../src/lib/ocr.ts";

const imagePath =
  "C:/Users/1219/.cursor/projects/d-PROJECTS-Treffectivour/assets/c__Users_1219_AppData_Roaming_Cursor_User_workspaceStorage_f555ec4319025a8696fabc803280f9c9_images_image-e3d58d56-dcda-4520-9ea0-0be47e0ba1ac.png";

console.log("=== parse samples ===");
const samples = [
  "9:2414 AM 122908 PM\n11347 PM 42226 PM\n54216 PM 70048 PM",
  "9:24:14 AM 12:29:08 PM\n1:13:47 PM 4:22:26 PM\n5:42:16 PM 7:09:48 PM",
  "9:24 14 AM\n12:29 08 PM",
  "11347 FM 42226 FM",
];
for (const s of samples) {
  const r = parseOcrText(s);
  console.log("---");
  console.log("IN:", s.slice(0, 60));
  console.log("OUT:", r.punches.map((p) => `${p.type} ${p.time}`).join(", "));
}

if (fs.existsSync(imagePath)) {
  console.log("\n=== runOcr on image ===");
  const buf = fs.readFileSync(imagePath);
  const r = await runOcr(buf);
  console.log("PUNCHES:", r.punches.map((p) => `${p.type} ${p.time}`).join(" | "));
  console.log("COUNT:", r.punches.length);
  console.log("RAW:", JSON.stringify(r.rawText));

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const { data } = await worker.recognize(buf, {}, { blocks: true });
  console.log("\nCONF:", data.confidence);
  console.log("BLOCKS:", JSON.stringify(data.blocks, null, 2).slice(0, 3000));
  await worker.terminate();
} else {
  console.log("\nImage not found:", imagePath);
}
