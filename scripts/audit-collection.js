import { readCollection, auditCollection } from "./collection-dataset.js";
const input = process.argv[2];
if (!input) throw Error("Usage: npm run audit:collection -- <download.json-or-directory>");
const data = readCollection(input);
if (!data.sessions.length) throw Error("No canonical session exports found");
console.log(JSON.stringify({ ...auditCollection(data.sessions), source_sha256: data.source_sha256 }, null, 2));
