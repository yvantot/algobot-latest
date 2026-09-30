import fs from "node:fs";
import { readCollection, challengeSamples } from "./collection-dataset.js";
import { ALL_CHALLENGES as CHALLENGES } from "../src/game/challenges/catalog.js";
import { researchFeatureNames } from "../src/game/ml/research-features.js";

const [input, output, taskId, schema] = process.argv.slice(2);
if (!input || !output || !CHALLENGES.some(task => task.id === taskId) || (schema && !researchFeatureNames(schema))) {
  throw Error(`Usage: node scripts/prepare-challenges.js <export-file-or-folder> <NEW-output.json> <${CHALLENGES.map(task=>task.id).join("|")}> [recent-12f-v1|active-14f-v2]`);
}
const data = readCollection(input);
const result = challengeSamples(data.sessions, taskId, schema ? {schema} : {});
fs.writeFileSync(output, JSON.stringify({ ...result, source_sha256: data.source_sha256 }, null, 2), { flag: "wx" });
console.log(`${result.samples.length} usable first submissions; ${result.excluded.length} excluded. See ${output}.`);
