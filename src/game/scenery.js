import { k } from "../lib/kaplay.js";
import { CONFIG } from "./global/global.js";

const SCENERY_SPACING = 80;
const GRASS_FRAMES = [2, 5, 6, 2, 5, 6, 0, 1, 3, 4, 7, 8, 9];

export function sceneryHash(x, y) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

export function sceneryTiles(bounds, farm) {
  const result = [];
  const size = SCENERY_SPACING;
  const left = farm.grid_origin.x - 45, top = farm.grid_origin.y - 45;
  const right = farm.grid_origin.x + farm.columns * farm.cell_size + 35;
  const bottom = farm.grid_origin.y + farm.rows * farm.cell_size + 35;
  for (let y = Math.floor(bounds.top / size) - 1; y <= Math.ceil(bounds.bottom / size) + 1; y++) {
    for (let x = Math.floor(bounds.left / size) - 1; x <= Math.ceil(bounds.right / size) + 1; x++) {
      const hash = sceneryHash(x, y);
      if (hash % 10 === 0) continue;
      const px = x * size + (hash % 29), py = y * size + ((hash >>> 8) % 29);
      if (px + 40 > left && px - 40 < right && py + 40 > top && py - 40 < bottom) continue;
      const flower = hash % 7 === 0;
      const frame = flower ? (hash >>> 12) % 7 : GRASS_FRAMES[(hash >>> 12) % GRASS_FRAMES.length];
      result.push({ x:px, y:py, flower, frame, sway:flower || [2,5,6].includes(frame), phase:hash % 628 / 100 });
    }
  }
  return result;
}

export function addScenery() {
  let tiles = [], previous = "";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  return k.add([k.pos(0,0), k.layer("grass_bg"), {
    id: "scenery",
    sceneryBackground: true,
    draw() {
      const a = k.toWorld(k.vec2(0,0)), b = k.toWorld(k.vec2(k.width(),k.height()));
      const farm = CONFIG.FARM;
      const signature = [Math.floor(a.x/SCENERY_SPACING),Math.floor(a.y/SCENERY_SPACING),Math.ceil(b.x/SCENERY_SPACING),Math.ceil(b.y/SCENERY_SPACING),farm.rows,farm.columns,farm.grid_origin.x,farm.grid_origin.y].join();
      if (signature !== previous) {
        previous = signature;
        tiles = sceneryTiles({left:a.x,top:a.y,right:b.x,bottom:b.y}, farm);
      }
      // One scene object, bounded visible tiles, and atlas-backed draws. No per-tile timers.
      for (const tile of tiles) {
        const sway = !reduced && tile.sway ? Math.sin(k.time()*1.7 + tile.phase) : 0;
        k.drawSprite({sprite:tile.flower ? "flowers_tile" : "grasses_tile", frame:tile.frame,
          pos:k.vec2(tile.x,tile.y), anchor:"bot", width:tile.flower ? 42 : 64,
          angle:sway*3, scale:k.vec2(1 + sway*.025,1)});
      }
    },
  }]);
}
