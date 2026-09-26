import { version } from "./package.json";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { execFileSync } from "node:child_process";
import { sourceFingerprint, gitProvenance } from "./scripts/build-provenance.js";
import { fileURLToPath } from "node:url";

let provenance: Record<string, unknown> = { version, commit: "unknown", dirty: null };
try {
  provenance = { version, ...gitProvenance(args => execFileSync("git", args, { encoding: "utf8" })) };
} catch { /* Source archives may not contain a Git repository. */ }

export default defineConfig({
	plugins: [tailwindcss(), svelte()],
  define: { __BUILD_PROVENANCE__: JSON.stringify({ ...provenance, ...sourceFingerprint(fileURLToPath(new URL(".", import.meta.url))) }) },
});
