import { QUEST_DATA } from "./quests.js";
import { CropStates, SoilStates } from "./enum.js";

export function lessonTiles(key, size) {
  const setup = QUEST_DATA[key]?.setup;
  if (!setup || setup === "movement") return [];
  const rows = setup.startsWith("farm-") || ["bugs", "fires"].includes(setup) ? size.rows : 1;
  const columns = rows > 1 || setup.startsWith("wide-") ? size.columns :
    setup.startsWith("row-") ? 3 : ["two-bare", "mixed"].includes(setup) ? 2 : 1;
  return Array.from({ length: rows * columns }, (_, i) => ({ x: i % columns, y: Math.floor(i / columns) }));
}

export function releaseLesson(grid) {
  grid.lessonActive = false;
  grid.lessonQuest = null;
  for (const tile of grid.values()) {
    tile.lesson = null;
    if (tile.lessonBug) { tile.lessonBug.destroy(); tile.lessonBug = null; }
    if (tile.lessonFire) { tile.lessonFire.destroy(); tile.lessonFire = null; }
  }
}

// Automatic preparation never replaces a player's crop. Reset is an explicit UI action.
export function prepareLesson(key, { grid, size, robot, inventory, createCrop, createBug, ignite, replace = false }) {
  const setup = QUEST_DATA[key]?.setup;
  if (!setup || !robot || robot.is_available === false) return { prepared: false };
  const positions = lessonTiles(key, size);
  if (positions.some(({ x, y }) => !grid.get(y + "-" + x)?.soil)) return { prepared: false, message: "This lesson needs three columns. Buy a column first." };
  if (!replace && positions.some(({ x, y }) => {
    const tile = grid.get(y + "-" + x);
    return tile.crop || tile.bug || tile.fire;
  })) return { prepared: false, message: "Reset lesson tiles to replace their crops with practice crops." };
  releaseLesson(grid);
  grid.lessonActive = true;
  grid.lessonQuest = key;
  for (const { x, y } of positions) {
    const tile = grid.get(y + "-" + x);
    tile.bug?.destroy(); tile.fire?.destroy(); tile.crop?.cropDestroy("lesson_reset");
    tile.lesson = setup;
    const bare = setup.endsWith("bare") || setup === "bare";
    tile.soil.setSoilState(bare ? SoilStates.INITIAL : SoilStates.READY);
    const planted = !bare && setup !== "empty";
    if (planted) {
      const ready = setup.includes("ready") || setup === "mixed" && x === 0;
      tile.crop = createCrop(x, y, ready ? CropStates.HARVESTABLE : CropStates.YOUNG);
      if (setup === "dead") tile.crop.markDead("lesson");
      if (setup === "growing") {
        tile.crop.crop_state = CropStates.GROWING;
        tile.crop.crop_grow_duration = 8;
        tile.crop.crop_grow_time = 0;
        tile.soil.water();
      }
    }
  }
  if (setup === "bugs" || setup === "fires") {
    for (const { x, y } of [positions[0], positions.at(-1)]) {
      const tile = grid.get(y + "-" + x);
      if (setup === "bugs") tile.lessonBug = createBug(x, y);
      else tile.lessonFire = ignite(y + "-" + x);
    }
  }
  for (const [crop, amount] of Object.entries({ wheat: positions.length, corn: key === "fn_param_0" ? size.columns : 1, rice: key === "list_crops_0" ? 1 : 0 })) {
    if ((inventory.crops[crop] ?? 0) < amount) inventory.changeCrops(crop, amount - (inventory.crops[crop] ?? 0));
  }
  robot.botJump(setup === "movement" ? 1 : 0, 0);
  return { prepared: true, message: "Practice tiles are ready. Start with Bot 0." };
}
