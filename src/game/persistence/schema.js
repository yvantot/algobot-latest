import { QUEST_DATA } from "../global/quests.js";
import { CropStates, CropTypes } from "../global/enum.js";
import { SHOP_DATA, DOCUMENT_DATA, BASE_CROP_DATA } from "../global/global.js";

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
export const catalogState = catalog => Object.fromEntries(Object.entries(catalog).map(([category, entries]) => [category,
  Object.fromEntries(Object.entries(entries).filter(([, value]) => value && typeof value === "object").map(([key, value]) => [key,
    Object.fromEntries(["unlocked", "is_unlocked", "price"].filter(field => value[field] !== undefined).map(field => [field, value[field]]))]))]));
const catalogShapes = { shop: catalogState(SHOP_DATA), documents: catalogState(DOCUMENT_DATA), cropData: BASE_CROP_DATA };
function validateShape(value, shape) {
  if (typeof shape === "number") return number(value);
  if (typeof shape === "boolean") return typeof value === "boolean";
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === Object.keys(shape).length
    && Object.entries(shape).every(([key, child]) => Object.hasOwn(value, key) && validateShape(value[key], child));
}
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
  requireSave(save && typeof save === "object", "Missing saved farm.");
  requireSave(Object.keys(save).every(key => ["schemaVersion", "questPathVersion", "gameVersion", "playthroughId", "revision", "savedAt", "owner", "payload", "recoveryGeneration"].includes(key)), "Unknown save envelope fields.");
  requireSave(integer(save.recoveryGeneration, 0, Number.MAX_SAFE_INTEGER), "Invalid recovery generation.");
  requireSave(save?.schemaVersion === SAVE_VERSION && save.questPathVersion === QUEST_PATH_VERSION, "Unsupported save format.");
  requireSave(typeof save.playthroughId === "string" && save.playthroughId.length <= 100, "Invalid playthrough ID.");
  requireSave(integer(save.revision, 1, Number.MAX_SAFE_INTEGER) && number(save.savedAt, 0, Number.MAX_SAFE_INTEGER), "Invalid checkpoint revision.");
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
      requireSave(c.fields && ["crop_duration", "crop_reward", "crop_exp", "crop_spoilage_time", "crop_seed_drop_chance", "crop_synergy_elapsed"].every(key => number(c.fields[key]))
        && validateShape(c.fields.crop_resistance, { fire: 0, bug: 0 }), "Invalid crop parameters.");
    }
    requireSave(tile.soil.owner === null || tile.soil.owner === tile.crop?.id, "Water belongs to a missing crop.");
    requireSave(tile.soil.water === 0 || (tile.soil.owner && tile.crop?.state !== CropStates.DEAD), "Unowned usable water.");
  }
  requireSave(Array.isArray(p.bots) && p.bots.length > 0 && p.bots.length <= 100, "Invalid bot count.");
  const bots = new Set();
  for (const bot of p.bots) {
    requireSave(bot.index === bots.size && !bots.has(bot.index), "Duplicate or missing bot ID."); bots.add(bot.index);
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
    requireSave(!q.is_completed || q.progress === data.goal, "Completed quest lacks progress.");
  }
  requireSave(p.personalize && typeof p.personalize.FARM_NAME === "string" && p.personalize.FARM_NAME.length <= 200 && typeof p.personalize.AVATAR === "string", "Invalid farm identity.");
  requireSave(p.tutorial && typeof p.tutorial.active === "boolean" && Array.isArray(p.tutorial.authoredBlocks) && Array.isArray(p.tutorial.sequenceBlocks), "Invalid tutorial state.");
  requireSave(p.feedback && Array.isArray(p.feedback.queue) && typeof p.feedback.hazardsPending === "boolean", "Invalid quest feedback.");
  requireSave(p.feedback.queue.every(item => Object.hasOwn(QUEST_DATA, item.key)), "Unknown pending milestone.");
  requireSave(p.selection === null || !!QUEST_DATA[p.selection]?.optional, "Invalid optional quest.");
  requireSave(p.ui && [0, 1].includes(p.ui.editor) && integer(p.ui.blockBot, 0, bots.size - 1) && integer(p.ui.textBot, 0, bots.size - 1) && Array.isArray(p.ui.completedDemos) && [null, "onboarding", "demonstration"].includes(p.ui.entryScreen), "Invalid editor or introduction state.");
  for (const field of ["claimedRewards", "challengeRewards", "exclusions", "pests", "lessonFires"]) requireSave(Array.isArray(p[field]), `Missing ${field}.`);
  for (const field of ["tips", "shop", "documents", "cropData"]) requireSave(p[field] && typeof p[field] === "object" && !Array.isArray(p[field]), `Missing ${field}.`);
  for (const [field, shape] of Object.entries(catalogShapes)) requireSave(validateShape(p[field], shape), `Invalid ${field} catalog.`);
  requireSave(p.claimedRewards.every(value => value === null || typeof value === "boolean") && p.challengeRewards.every(id => typeof id === "string") && p.exclusions.every(reason => typeof reason === "string"), "Invalid rewards or research exclusions.");
  requireSave(typeof p.startClicked === "boolean" && typeof p.lessonActive === "boolean" && (p.lessonQuest === null || Object.hasOwn(QUEST_DATA, p.lessonQuest)), "Invalid lesson ownership.");
  requireSave(integer(p.difficulty, 0, 4), "Invalid saved difficulty.");
  requireSave(p.rng?.algorithm === "mulberry32-v1" && integer(p.rng.state, 0, 0xffffffff), "Invalid random state.");
  requireSave(p.scheduler && ["clock", "checkRemaining", "lastEventTime", "lastCheckTime", "eventsTriggered"].every(key => number(p.scheduler[key])), "Invalid scheduler clocks.");
  requireSave(p.inboxes && integer(p.inboxes.nextId, 0, Number.MAX_SAFE_INTEGER) && Array.isArray(p.inboxes.inboxes), "Invalid inboxes.");
  const messageIds = new Set(), inboxIds = new Set();
  for (const [id, messages] of p.inboxes.inboxes) {
    requireSave(bots.has(id) && !inboxIds.has(id) && Array.isArray(messages) && messages.length <= 32, "Invalid inbox owner or capacity.");
    inboxIds.add(id);
    for (const message of messages) {
      requireSave(integer(message.id, 1, p.inboxes.nextId) && !messageIds.has(message.id), "Duplicate message ID."); messageIds.add(message.id);
      requireSave(integer(message.sender, 0, 99) && ["string", "boolean", "number"].includes(typeof message.value) && String(message.value).length <= 200, "Invalid message.");
    }
  }
  requireSave(p.hazards && Array.isArray(p.hazards.fires) && Array.isArray(p.hazards.clouds) && Array.isArray(p.hazards.drops), "Missing hazard state.");
  requireSave(number(p.hazards.accumulator, 0, .05) && integer(p.hazards.sequence, 0, Number.MAX_SAFE_INTEGER), "Invalid simulation clock.");
  const hazardIds = new Set();
  for (const entity of [...p.hazards.fires, ...p.hazards.clouds, ...p.hazards.drops]) {
    requireSave(integer(entity.id, 1, p.hazards.sequence) && !hazardIds.has(entity.id) && keys.has(entity.key), "Invalid hazard identity or location."); hazardIds.add(entity.id);
  }
  for (const fire of p.hazards.fires) {
    const tile = p.tiles.find(tile => `${tile.y}-${tile.x}` === fire.key);
    requireSave(cropIds.has(fire.cropId) && tile.crop?.id === fire.cropId, "Fire fuel is missing or substituted.");
    requireSave(integer(fire.stage, 0, 2) && ["age", "damageClock", "spreadClock", "matureAge", "matureDamage"].every(key => number(fire[key])), "Invalid fire clock.");
    requireSave(fire.settings && (number(fire.settings.stageDuration, .001) || fire.settings.stageDuration === null && p.lessonFires.includes(fire.key)), "Invalid fire settings.");
  }
  const clouds = new Set(p.hazards.clouds.map(c => c.id));
  requireSave(Array.isArray(p.hazards.events), "Missing rain events.");
  const events = new Set(p.hazards.events.map(e => e.id));
  requireSave(events.size === p.hazards.events.length && p.hazards.events.every(event => integer(event.id, 1, p.hazards.sequence) && Array.isArray(event.wateredKeys) && event.wateredKeys.every(key => keys.has(key)) && integer(event.wateredTiles, 0, keys.size) && integer(event.extinguishedFires, 0, 1e9)), "Invalid rain event aggregates.");
  requireSave(p.lessonFires.every(key => p.hazards.fires.some(fire => fire.key === key)), "Missing lesson fire.");
  for (const cloud of p.hazards.clouds) requireSave(events.has(cloud.eventId) && ["entering", "raining", "leaving"].includes(cloud.phase) && number(cloud.phaseAge) && number(cloud.dropClock) && number(cloud.dropInterval, .001), "Invalid rain clock or event.");
  for (const drop of p.hazards.drops) requireSave(clouds.has(drop.cloudId) && number(drop.age) && number(drop.duration, .001), "Rain cloud or clock is missing.");
  const reservations = new Set(), pestIds = new Set();
  for (const pest of p.pests) {
    requireSave(typeof pest.id === "string" && !pestIds.has(pest.id), "Duplicate pest ID."); pestIds.add(pest.id);
    requireSave(integer(pest.x, -5, p.columns + 4) && integer(pest.y, -5, p.rows + 4), "Pest outside spawn bounds.");
    requireSave(pest.config && number(pest.config.attack_interval, .001, 3600) && number(pest.config.move_interval, .001, 3600) && number(pest.config.jump_duration, .001, 3600) && number(pest.config.damage), "Invalid pest settings.");
    requireSave(number(pest.attackRemaining) && number(pest.moveRemaining) && number(pest.exposureAge), "Invalid pest clocks.");
    const target = pest.motion ?? pest;
    requireSave(integer(target.x, -5, p.columns + 4) && integer(target.y, -5, p.rows + 4) && (!pest.motion || number(pest.motion.remaining)), "Invalid pest movement.");
    requireSave(pest.reservation === `${target.y}-${target.x}` && !reservations.has(pest.reservation), "Invalid pest reservation."); reservations.add(pest.reservation);
  }
  return save;
}
