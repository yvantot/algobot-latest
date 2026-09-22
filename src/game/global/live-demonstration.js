import { k } from "../../lib/kaplay.js";
import { CONFIG } from "./global.js";
import { CropStates, SoilStates } from "./enum.js";
import { addSoilToGrid } from "../components-kaplay/soil.js";
import { addFarmbot } from "../components-kaplay/robot.js";

// Run the normal entity actions on a private farm. The player's entities remain
// paused in place and are restored even if the cutscene is skipped mid-action.
export function startLiveDemonstration(onStep, onComplete) {
  let disposed = false;
  const originals = k.get().map(object => ({ object, hidden: object.hidden, paused: object.paused }));
  const speed = k.debug.timeScale;
  for (const { object } of originals) {
    object.paused = true;
    if (!["grass_bg", "land_bg"].includes(object.layer)) object.hidden = true;
  }
  k.debug.timeScale = 1;
  const farm = new Map();
  farm.isDemonstration = true;
  const owned = [];
  for (let y = 0; y < CONFIG.FARM.rows; y++) for (let x = 0; x < CONFIG.FARM.columns; x++) {
    const soil = addSoilToGrid(x, y, SoilStates.INITIAL, farm);
    owned.push(soil);
    farm.set(`${y}-${x}`, { soil, crop: null, bots: [] });
  }
  const robot = addFarmbot("DEMO", farm, 0, 0);
  owned.push(robot);
  let waiting = null;
  const controller = k.onUpdate(() => {
    if (waiting?.ready()) { const resume = waiting.resolve; waiting = null; resume(true); }
  });
  function until(ready) {
    if (disposed) return Promise.resolve(false);
    return new Promise(resolve => { waiting = { ready, resolve }; });
  }
  function action(label, method, ...args) {
    if (disposed) return Promise.resolve(false);
    onStep(label);
    return new Promise(resolve => robot[method](...args, result => resolve(!disposed && !!result)));
  }
  async function play() {
    onStep("Watch the robot follow a program.");
    if (!await until(() => robot.is_available)) return;
    if (!await action("bot.right()", "botJump", 1, 0)) return;
    if (!await action("bot.till()", "botTill")) return;
    if (!await action('bot.plant("wheat")', "botPlant", "wheat")) return;
    if (!await action("bot.water()", "botWater")) return;
    onStep("The crop absorbs water and grows.");
    if (!await until(() => !farm.get("0-1").soil.isWatered())) return;
    if (!await action("bot.water()", "botWater")) return;
    onStep("Water again to finish growing.");
    if (!await until(() => farm.get("0-1").crop?.crop_state === CropStates.HARVESTABLE)) return;
    if (!await action("bot.harvest()", "botHarvest")) return;
    onStep("Harvest complete. Now it is your turn.");
    onComplete();
  }
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller.cancel();
    waiting?.resolve(false); waiting = null;
    for (const tile of farm.values()) tile.crop?.destroy();
    for (const object of owned.reverse()) object.destroy();
    for (const { object, hidden, paused } of originals) if (object.exists()) {
      object.hidden = hidden; object.paused = paused;
    }
    k.debug.timeScale = speed;
  };
  play().catch(error => { dispose(); console.error("Live demonstration failed", error); onComplete(); });
  return dispose;
}
