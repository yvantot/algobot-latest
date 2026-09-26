import { version } from "./package.json";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { execFileSync } from "node:child_process";

let provenance = { version, commit: "unknown", dirty: null as boolean | null };
try {
  provenance = { version, commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    dirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0 };
} catch { /* Source archives may not contain a Git repository. */ }

export default defineConfig({
	plugins: [tailwindcss(), svelte()],
  define: { __BUILD_PROVENANCE__: JSON.stringify(provenance) },
});
