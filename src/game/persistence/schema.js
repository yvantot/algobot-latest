import { QUEST_DATA } from "../global/quests.js";
import { CropStates, CropTypes } from "../global/enum.js";

export const SAVE_VERSION = 1;
export const QUEST_PATH_VERSION = 1;
export const MAX_SAVE_BYTES = 8 * 1024 * 1024;
export class SaveError extends Error {
  constructor(code, message, cause) { super(message, { cause }); this.name = "SaveError"; this.code = code; }
}
export function requireSave(condition, message) {
  if (!condition) throw new SaveError("corrupt", message);
}
export function plainData(value) {
  let count = 0;
  function visit(item, depth) {
    requireSave(++count <= 500000 && depth < 40, "Save data is too complex.");
    if (item === null || typeof item === "boolean") return item;
    if (typeof item === "number") { requireSave(Number.isFinite(item), "Nonfinite saved number."); return item; }
    if (typeof item === "string") { requireSave(item.length <= 1000000, "Saved text is too large."); return item; }
    requireSave(typeof item === "object", "Save contains non-data values.");
    if (Array.isArray(item)) return item.map(v => visit(v, depth + 1));
    requireSave(Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null, "Save contains a live object.");
    const result = {};
    for (const [key, entry] of Object.entries(item)) {
      requireSave(!["__proto__", "prototype", "constructor"].includes(key), "Unsafe saved property.");
      result[key] = visit(entry, depth + 1);
    }
    return result;
  }
  const result = visit(value, 0);
  requireSave(new TextEncoder().encode(JSON.stringify(result)).length <= MAX_SAVE_BYTES, "Save exceeds the size limit.");
  return result;
}
export const encodeTimer = value => value === Infinity ? { unbounded: true } : value;
export const decodeTimer = value => value?.unbounded === true ? Infinity : value;
const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const number = (n, min = 0, max = 1e12) => Number.isFinite(n) && n >= min && n <= max;
export function validateOwner(owner) {
  requireSave(owner && /^[A-Za-z0-9_-]{1,80}$/.test(owner.participantId), "Invalid save owner.");
  requireSave(["researcher_assigned_code", "browser_local_pseudonym", "temporary_browser_pseudonym"].includes(owner.identityKind), "Invalid identity kind.");
  requireSave(owner.studyProtocolVersion === null || typeof owner.studyProtocolVersion === "string", "Invalid study context.");
  return owner;
}
export function validateSave(input) {
  if (input?.schemaVersion > SAVE_VERSION || input?.questPathVersion > QUEST_PATH_VERSION)
    throw new SaveError("future", "This farm was saved by a newer game version.");
  const save = plainData(input);
  requireSave(save?.schemaVersion === SAVE_VERSION && save.questPathVersion === QUEST_PATH_VERSION, "Unsupported save format.");
  requireSave(typeof save.playthroughId === "string" && save.playthroughId.length <= 100, "Invalid playthrough ID.");
  requireSave(integer(save.revision, 1, Number.MAX_SAFE_INTEGER) && number(save.savedAt), "Invalid checkpoint revision.");
  validateOwner(save.owner);
  const p = save.payload;
  requireSave(p && integer(p.rows, 1, 100) && integer(p.columns, 1, 100), "Invalid farm dimensions.");
  requireSave(Array.isArray(p.tiles) && p.tiles.length === p.rows * p.columns, "Incomplete farm tiles.");
  const keys = new Set(), cropIds = new Set();
  for (const tile of p.tiles) {
    requireSave(integer(tile.x, 0, p.columns - 1) && integer(tile.y, 0, p.rows - 1), "Tile is outside the farm.");
    const key = `${tile.y}-${tile.x}`;
    requireSave(!keys.has(key), "Duplicate farm tile."); keys.add(key);
    requireSave([0, 1, 2].includes(tile.soil.state) && number(tile.soil.water, 0, 1), "Invalid soil state.");
    if (tile.crop) {
      const c = tile.crop;
      requireSave(typeof c.id === "string" && !cropIds.has(c.id), "Duplicate or missing crop ID."); cropIds.add(c.id);
      requireSave(Object.values(CropTypes).includes(c.type) && Object.values(CropStates).includes(c.state), "Unknown crop.");
      requireSave(number(c.health) && number(c.growTime) && number(c.growDuration, 0.001), "Invalid crop lifecycle.");
      requireSave(c.spoilage?.unbounded === true || number(c.spoilage), "Invalid spoilage clock.");
    }
    requireSave(tile.soil.owner === null || tile.soil.owner === tile.crop?.id, "Water belongs to a missing crop.");
    requireSave(tile.soil.water === 0 || (tile.soil.owner && tile.crop?.state !== CropStates.DEAD), "Unowned usable water.");
  }
  requireSave(Array.isArray(p.bots) && p.bots.length > 0 && p.bots.length <= 100, "Invalid bot count.");
  const bots = new Set();
  for (const bot of p.bots) {
    requireSave(integer(bot.index, 0, 99) && !bots.has(bot.index), "Duplicate bot ID."); bots.add(bot.index);
    requireSave(integer(bot.x, 0, p.columns - 1) && integer(bot.y, 0, p.rows - 1), "Bot outside farm.");
    for (const delay of [bot.moveDuration, bot.actionDuration, bot.checkDuration]) requireSave(number(delay, 0.001, 3600), "Invalid bot speed.");
    requireSave(typeof bot.program?.text_code === "string" && typeof bot.program?.block_xml === "string", "Missing bot program.");
  }
  requireSave(number(p.economy?.coins) && number(p.economy?.exp), "Invalid economy.");
  for (const type of Object.values(CropTypes)) requireSave(integer(p.economy.crops?.[type], 0, 1e9), "Invalid seed inventory.");
  requireSave(Object.keys(p.quests ?? {}).length === Object.keys(QUEST_DATA).length, "Missing quest progress.");
  for (const [id, data] of Object.entries(QUEST_DATA)) {
    const q = p.quests[id];
    requireSave(q && number(q.progress, 0, data.goal) && typeof q.is_completed === "boolean" && typeof q.is_claimed === "boolean", "Invalid quest progress.");
    requireSave(!q.is_claimed || q.is_completed, "Claimed quest is incomplete.");
  }
  requireSave(p.hazards && Array.isArray(p.hazards.fires) && Array.isArray(p.hazards.clouds) && Array.isArray(p.hazards.drops), "Missing hazard state.");
  for (const fire of p.hazards.fires) requireSave(cropIds.has(fire.cropId), "Fire fuel is missing.");
  const clouds = new Set(p.hazards.clouds.map(c => c.id));
  for (const drop of p.hazards.drops) requireSave(clouds.has(drop.cloudId), "Rain cloud is missing.");
  return save;
}
