import { k } from "../../lib/kaplay.js";
import { CONFIG } from "../global/global.js";
import { CropStates, SoilStates } from "../global/enum.js";
import { addFarmbot } from "../components-kaplay/robot.js";
import { addCrop } from "../components-kaplay/crop.js";
import { addSoilToGrid } from "../components-kaplay/soil.js";
import { addLandBackground } from "../land-background.js";
import { isolateScene } from "./scene-session.js";

export function startChallengeFarm(getViewport) {
  const restore = isolateScene(k);
  const farm = new Map();
  // Reuse the demonstration's resource and telemetry isolation.
  farm.isDemonstration = true;
  farm.freezeCropLifecycle = true;
  farm.demoEffects = [];
  let owned = [], robot = null, disposed = false;
  function clear() {
    robot?.destroy(); robot = null;
    for (const tile of farm.values()) { tile.crop?.destroy(); tile.soil?.destroy(); }
    for (const object of [...owned, ...farm.demoEffects]) if (object.exists()) object.destroy();
    owned = []; farm.demoEffects = []; farm.clear();
  }
  function fit() {
    if (disposed || !farm.demoBounds) return;
    const rect = getViewport(), canvas = document.getElementById("game")?.getBoundingClientRect();
    if (!rect?.width || !canvas?.width) return;
    const width = farm.demoBounds.columns * CONFIG.FARM.cell_size + 70;
    const scale = Math.max(.25, Math.min(1.25, (rect.width - 30) / width, (rect.height - 25) / 270));
    const x = (rect.left + rect.width / 2 - canvas.left) * k.width() / canvas.width;
    const y = (rect.top + rect.height / 2 - canvas.top) * k.height() / canvas.height;
    k.setCamScale(scale);
    k.setCamPos(CONFIG.FARM.grid_origin.x + (farm.demoBounds.columns * CONFIG.FARM.cell_size - CONFIG.FARM.gap) / 2 - (x - k.width() / 2) / scale,
      CONFIG.FARM.grid_origin.y - 25 - (y - k.height() / 2) / scale);
  }
  function reset(layout, task = {}) {
    if (disposed) throw Error("Challenge farm has closed.");
    clear(); farm.demoBounds = { columns: layout.length, rows: 1 };
    owned.push(...addLandBackground(k, { ...CONFIG.FARM, ...farm.demoBounds }));
    for (let x=0; x<layout.length; x++) {
      const spec = typeof layout[x] === "object" ? layout[x] : {type:"wheat",state:layout[x] ? "ready" : "young"};
      const soil = addSoilToGrid(x, 0, spec.state === "bare" ? SoilStates.INITIAL : SoilStates.READY, farm);
      const tile = { soil, crop: null, bots: [] }; farm.set(`0-${x}`, tile);
      if (spec.type) {
        tile.crop = addCrop(farm, spec.type, x, 0, spec.state === "ready" ? CropStates.HARVESTABLE : CropStates.YOUNG);
        if (spec.state === "dead") tile.crop.markDead();
        if (spec.timeLeft) tile.crop.spoilage_remaining = spec.timeLeft;
      }
    }
    robot = addFarmbot(0, farm, 0, 0);
    robot.botmove_duration = .45; robot.botact_duration = .45; robot.botcheck_duration = .3;
    fit(); return robot;
  }
  function dispose() { if (disposed) return; disposed = true; clear(); restore(); }
  return { reset, fit, dispose, get robot() { return robot; },
    inspect: () => [...farm.values()].map(tile => ({ watered:tile.soil.isWatered(), planted:!!tile.crop })),
    advanceWait(seconds) {
      for (const tile of farm.values()) if (tile.crop) {
        tile.crop.crop_duration = 1; tile.crop.crop_grow_duration = 1;
        tile.crop.advanceGrowth(seconds);
      }
    },
  };
}
