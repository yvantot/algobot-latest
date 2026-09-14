// Temporary, hand-authored SVG placeholders. The requested weather PNGs were
// absent from this checkout; these keep event rendering usable without 404s.
// Add the original icon_*.png files under public/sprites (preferred),
// public/assets, assets, or src/assets, then restart Vite/rebuild to use them.
const svg = (width, height, shapes) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${shapes}</svg>`,
)}`;

const placeholders = Object.freeze({
  icon_cloud: svg(96, 64, '<path d="M22 52C3 52 3 28 21 25C22 7 49 3 57 21C76 12 91 27 86 39C97 51 83 57 72 54H22Z" fill="#dcecf5" stroke="#667f96" stroke-width="4" stroke-linejoin="round"/><path d="M20 44H73" stroke="#b0cbdc" stroke-width="5" stroke-linecap="round"/>'),
  icon_raindrop: svg(32, 48, '<path d="M16 3C13 12 3 22 3 31A13 13 0 0 0 29 31C29 22 19 12 16 3Z" fill="#61c5f0" stroke="#287db3" stroke-width="3"/><path d="M10 27C7 32 9 37 13 38" fill="none" stroke="#d9f7ff" stroke-width="3" stroke-linecap="round"/>'),
  icon_fire_0: svg(64, 64, '<path d="M31 14C32 27 14 32 16 45C18 64 49 63 49 43C49 34 43 31 43 27C37 32 38 35 35 37C33 29 37 25 31 14Z" fill="#f58a32" stroke="#a33c24" stroke-width="3" stroke-linejoin="round"/><path d="M31 38C29 45 24 46 25 52C27 58 39 58 39 51C39 47 35 43 31 38Z" fill="#ffe16b"/>'),
  icon_fire_1: svg(64, 64, '<path d="M34 7C37 22 15 28 19 39C13 37 15 31 11 29C0 54 23 65 41 58C58 52 57 35 46 25C47 35 42 37 40 38C37 29 45 23 34 7Z" fill="#f06a29" stroke="#a33c24" stroke-width="3" stroke-linejoin="round"/><path d="M31 30C33 42 23 43 23 51C23 61 42 61 43 50C43 43 37 39 37 35C37 41 34 43 32 43C30 39 34 36 31 30Z" fill="#ffd451"/>'),
  icon_fire_2: svg(64, 72, '<path d="M35 3C40 18 16 24 20 39C12 35 15 27 11 23C-1 40 3 59 19 66C42 78 65 56 58 39C56 29 50 22 48 16C47 34 39 32 39 39C31 26 47 23 35 3Z" fill="#e95024" stroke="#963322" stroke-width="3" stroke-linejoin="round"/><path d="M29 29C35 40 17 43 20 56C23 72 48 67 48 53C48 45 42 41 41 36C38 43 39 47 35 50C33 44 37 38 29 29Z" fill="#ffb52e"/><path d="M32 47C31 53 26 55 27 60C28 68 39 66 40 60C40 55 35 52 32 47Z" fill="#fff08a"/>'),
  icon_smoke_0: svg(64, 64, '<path d="M21 57C5 55 3 40 14 34C4 24 13 11 25 16C29 0 48 6 47 20C62 17 66 37 53 42C61 55 40 62 33 53C31 61 25 62 21 57Z" fill="#9eaaa9" fill-opacity="0.72"/><path d="M21 31C18 21 34 18 36 27" fill="none" stroke="#c9d0cb" stroke-width="5" stroke-linecap="round"/>'),
  icon_smoke_1: svg(64, 64, '<path d="M23 57C8 62 1 45 13 37C2 24 18 13 28 20C24 7 44 0 49 16C64 13 68 31 54 38C67 51 45 66 36 55C34 65 22 65 23 57Z" fill="#849391" fill-opacity="0.68"/><path d="M27 30C29 20 45 22 44 32" fill="none" stroke="#c1ccc6" stroke-width="5" stroke-linecap="round"/>'),
});

export const WEATHER_SPRITE_NAMES = Object.freeze(Object.keys(placeholders));

let providedFiles = {};
try {
  // Vite expands this at build time, so absent PNGs are never requested. Keeping
  // the call in a try also makes this module safe for plain Node test imports.
  providedFiles = import.meta.glob([
    "/public/sprites/**/icon_{cloud,raindrop,fire_0,fire_1,fire_2,smoke_0,smoke_1}.png",
    "/public/assets/**/icon_{cloud,raindrop,fire_0,fire_1,fire_2,smoke_0,smoke_1}.png",
    "/assets/**/icon_{cloud,raindrop,fire_0,fire_1,fire_2,smoke_0,smoke_1}.png",
    "/src/assets/**/icon_{cloud,raindrop,fire_0,fire_1,fire_2,smoke_0,smoke_1}.png",
  ], { eager: true, query: "?url", import: "default" });
} catch { /* No Vite transform in the Node unit-test runtime. */ }

const directoryPriority = path => ["/public/sprites/", "/public/assets/", "/assets/", "/src/assets/"].findIndex(directory => path.startsWith(directory));

// Kept pure so source priority and missing-file behavior can be verified without
// a browser, network, or filesystem reads at runtime.
export function createWeatherArtworkResolver(files = {}) {
  const detected = new Map();
  const sorted = Object.entries(files).sort(([left], [right]) => directoryPriority(left) - directoryPriority(right) || left.localeCompare(right));
  for (const [path, url] of sorted) {
    const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.png$/, "");
    if (Object.hasOwn(placeholders, name) && typeof url === "string" && !detected.has(name)) detected.set(name, url);
  }
  return {
    get(name) {
      if (!Object.hasOwn(placeholders, name)) throw new Error(`Unknown weather sprite: ${name}`);
      return detected.get(name) ?? placeholders[name];
    },
    isPlaceholder(name) {
      if (!Object.hasOwn(placeholders, name)) throw new Error(`Unknown weather sprite: ${name}`);
      return !detected.has(name);
    },
  };
}

const artwork = createWeatherArtworkResolver(providedFiles);
export const getWeatherArtwork = name => artwork.get(name);
export const isWeatherArtworkPlaceholder = name => artwork.isPlaceholder(name);
