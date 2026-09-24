import fs from "node:fs";
import { readCollection, challengeSamples } from "./collection-dataset.js";
import { CHALLENGES } from "../src/game/challenges/catalog.js";

const [input, output, taskId = "ready-row-v3"] = process.argv.slice(2);
if (!input || !output || !CHALLENGES.some(task => task.id === taskId)) {
  throw Error(`Usage: node scripts/prepare-challenges.js <export-file-or-folder> <NEW-output.json> [${CHALLENGES.map(task=>task.id).join("|")}]`);
}
const data = readCollection(input);
const result = challengeSamples(data.sessions, taskId);
fs.writeFileSync(output, JSON.stringify({ ...result, source_sha256: data.source_sha256 }, null, 2), { flag: "wx" });
console.log(`${result.samples.length} usable first submissions; ${result.excluded.length} excluded. See ${output}.`);
