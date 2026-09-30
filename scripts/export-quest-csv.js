import fs from "node:fs";
import { readCollection } from "./collection-dataset.js";
import { questCSV } from "../src/game/ml/quest-csv.js";
const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error("Usage: node scripts/export-quest-csv.js <dataset.json-or-directory> <NEW-quests.csv>");
fs.writeFileSync(output, questCSV(readCollection(input).sessions), { flag: "wx" });
console.log(`Derived quest summary written to ${output}; retain the original JSON for training.`);
