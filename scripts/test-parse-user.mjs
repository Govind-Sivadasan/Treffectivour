import { parseOcrText } from "../src/lib/ocr.ts";

const cases = [
  {
    name: "merged digits",
    raw: `Gayatri Technopark
9:24:14 AM
12:29:08 PM
1113:47 PM
4:22:26 PM
5:42:16 PM
70948 PM`,
  },
  {
    name: "dropped prefixes",
    raw: `Gayatri Technopark
24:14 AM
12:29:08 PM
1:13:47 PM
4:22:26 PM
42:15 PM
70848 FM`,
  },
];

for (const c of cases) {
  const r = parseOcrText(c.raw);
  console.log(`=== ${c.name} (${r.punches.length}) ===`);
  console.log(r.punches.map((p) => `${p.type} ${p.time}`).join("\n"));
  console.log();
}
