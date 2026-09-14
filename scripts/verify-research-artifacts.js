import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const manifest = JSON.parse(await readFile(new URL('../documentation/preserved-artifacts.json', import.meta.url), 'utf8'));
const failures = [];
for (const { path, sha256, sha256_lf } of manifest.files) {
  try {
    const bytes = await readFile(new URL(`../${path}`, import.meta.url));
    const exactMatch = createHash('sha256').update(bytes).digest('hex') === sha256;
    // Git core.autocrlf may change text line endings across machines; binaries stay exact.
    const lfMatch = sha256_lf && createHash('sha256')
      .update(bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex') === sha256_lf;
    if (!exactMatch && !lfMatch) failures.push(`${path}: changed`);
  } catch { failures.push(`${path}: missing or unreadable`); }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Verified ${manifest.files.length} preserved research artifacts against baseline ${manifest.baseline_commit}.`);
}
