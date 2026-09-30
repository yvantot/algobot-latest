import { robots, robots_state, CLAIMED_REWARDS, Personalize, QUEST_STATE, QUEST_SELECTION, QUEST_FEEDBACK, TUTORIAL, ONBOARDING, DID_YOU_KNOW_STATE, Modals, UNLOCK_VERSION, UNLOCK_ANIMATIONS, EVENT_BANNER_STATE, currentQuest, PLAYTHROUGH_UI } from "../../components/global.svelte.js";
import { CONFIG, INVENTORY, PLAYER_DATA, SHOP_DATA, DOCUMENT_DATA, CROP_DATA } from "../global/global.js";
import { farm_grid_index, game } from "../game.js";
import { addCrop, addFarmbot, addBug } from "../components-kaplay/components.js";
import { CropStates } from "../global/enum.js";
import { tutorialPolicy } from "../global/tutorial.js";
import { releaseLesson } from "../global/quest-setup.js";
import { snapshotInboxes, restoreInboxes } from "../global/bot-messages.js";
import { getFarmEventRuntime, destroyFarmEvents } from "../events/renderer.js";
import { eventScheduler } from "../ml/event-scheduler.js";
import { telemetry } from "../ml/telemetry.js";
import { dda } from "../ml/dda.js";
import { stopCodeRuns } from "../global/code-runner.js";
import { farmChallengeRewards } from "../challenges/records.js";
import { createRandom } from "./random.js";
import { encodeTimer, decodeTimer, catalogState } from "./schema.js";

const clone = value => JSON.parse(JSON.stringify(value));
const replace = (target, source) => { for (const key of Object.keys(target)) delete target[key]; Object.assign(target, clone(source)); };
const restoreCatalog = (catalog, state) => { for (const [category, entries] of Object.entries(state)) for (const [key, value] of Object.entries(entries)) { if (!catalog[category]?.[key]) throw Error("Unknown saved unlock."); Object.assign(catalog[category][key], value); } };
const rng = createRandom();
const cropFields = ["crop_duration", "crop_reward", "crop_exp", "crop_spoilage_time", "crop_resistance", "crop_seed_drop_chance", "crop_synergy_elapsed"];

function captureStores() {
  return clone({ economy: { coins: INVENTORY.coins, crops: INVENTORY.crops, exp: PLAYER_DATA.exp },
    personalize: Personalize, quests: QUEST_STATE, selection: QUEST_SELECTION.key,
    tutorial: TUTORIAL, feedback: QUEST_FEEDBACK, startClicked: ONBOARDING.startClicked,
    ui: PLAYTHROUGH_UI, claimedRewards: CLAIMED_REWARDS, tips: DID_YOU_KNOW_STATE.shown,
    shop: catalogState(SHOP_DATA), documents: catalogState(DOCUMENT_DATA), cropData: CROP_DATA,
    difficulty: dda.currentAction, challengeRewards: [...farmChallengeRewards],
    exclusions: telemetry.researchExclusionReasons ?? [],
  });
}
const defaults = captureStores();
export function restoreStores(p) {
  INVENTORY.coins = p.economy.coins; replace(INVENTORY.crops, p.economy.crops);
  PLAYER_DATA.exp = p.economy.exp; PLAYER_DATA.level = Math.floor(p.economy.exp / 100);
  replace(Personalize, p.personalize); PLAYER_DATA.custom.farm_name = Personalize.FARM_NAME;
  replace(QUEST_STATE, p.quests); QUEST_SELECTION.key = p.selection;
  replace(TUTORIAL, p.tutorial); replace(QUEST_FEEDBACK, p.feedback);
  ONBOARDING.startClicked = p.startClicked; ONBOARDING.isModalOpen = false;
  replace(PLAYTHROUGH_UI, p.ui); CLAIMED_REWARDS.splice(0, CLAIMED_REWARDS.length, ...p.claimedRewards);
  DID_YOU_KNOW_STATE.activeTip = null; replace(DID_YOU_KNOW_STATE.shown, p.tips);
  restoreCatalog(SHOP_DATA, p.shop); restoreCatalog(DOCUMENT_DATA, p.documents); UNLOCK_VERSION.count++;
  dda.applyAction(p.difficulty); replace(CROP_DATA, p.cropData);
  farmChallengeRewards.clear(); for (const id of p.challengeRewards) farmChallengeRewards.add(id);
  telemetry.researchExclusionReasons = [...p.exclusions];
  tutorialPolicy.protected = TUTORIAL.active;
  for (const key of Object.keys(Modals)) Modals[key] = false;
  UNLOCK_ANIMATIONS.flyingItems = []; clearTimeout(EVENT_BANNER_STATE.dismissTimer); EVENT_BANNER_STATE.active = false;
}
function haltWorld() {
  stopCodeRuns(robots_state, telemetry); eventScheduler.stop();
  farm_grid_index.restoring = true;
  for (const bot of robots) { bot.bot_action_done = null; bot.bot_action_version++; }
  destroyFarmEvents(farm_grid_index);
}
export async function newWorld() {
  haltWorld(); restoreStores(defaults);
  CONFIG.FARM.rows = CONFIG.FARM.columns = 3;
  robots_state.splice(0); eventScheduler.reset();
  rng.restore(createRandom().snapshot()); farm_grid_index.random = () => rng.next();
  eventScheduler.random = () => rng.next();
  await game();
  farm_grid_index.restoring = false; farm_grid_index.lessonActive = false; farm_grid_index.lessonQuest = null;
}
export function captureWorld() {
  const grid = farm_grid_index;
  const tiles = [...grid.values()].filter(tile => tile.soil).map(tile => {
    const c = tile.crop;
    if (c && !c.saveId) c.saveId = crypto.randomUUID();
    tile.soil.releaseUnusedWater();
    return { x: tile.soil.grid_x, y: tile.soil.grid_y,
      lesson: tile.lesson ?? null,
      soil: { state: tile.soil.soil_state, water: tile.soil.water_remaining, owner: tile.soil.water_crop?.saveId ?? null },
      crop: c && !c.crop_removed ? { id: c.saveId, type: c.crop_type, state: c.crop_state, health: c.crop_health,
        growTime: c.crop_grow_time, growDuration: c.crop_grow_duration, spoilage: encodeTimer(c.spoilage_remaining),
        fields: Object.fromEntries(cropFields.map(field => [field, c[field]])) } : null };
  });
  const hazards = getFarmEventRuntime(grid).simulation.snapshot();
  const pests = [...new Set([...grid.values()].map(tile => tile.bug).filter(bug => bug && !bug.is_dying))].map(bug => ({
    id: bug.saveId ??= crypto.randomUUID(), x: bug.grid_x, y: bug.grid_y, motion: bug.grid_motion,
    reservation: [...grid].find(([, tile]) => tile.bug === bug)?.[0],
    config: { damage: bug.bug_damage, attack_interval: bug.bug_attack_interval, move_interval: bug.bug_move_interval, jump_duration: bug.bug_jump_duration, stationary: !!bug.pestConfig.stationary, lesson: !!bug.pestConfig.lesson },
    attackRemaining: bug.attackRemaining, moveRemaining: bug.moveRemaining, exposureAge: bug.exposureAge, spawned_at: bug.spawned_at,
  }));
  return clone({ ...captureStores(), rows: CONFIG.FARM.rows, columns: CONFIG.FARM.columns, tiles, hazards, pests,
    lessonQuest: grid.lessonQuest ?? null, lessonActive: !!grid.lessonActive,
    lessonFires: [...grid].filter(([, t]) => t.lessonFire?.active).map(([key]) => key),
    bots: robots.map(bot => ({ index: bot.bot_index, x: bot.grid_x, y: bot.grid_y,
      moveDuration: bot.botmove_duration, actionDuration: bot.botact_duration, checkDuration: bot.botcheck_duration,
      program: { text_code: robots_state[bot.bot_index]?.text_code ?? 'bot.say("Hello World!")', block_xml: robots_state[bot.bot_index]?.blockly_xml ?? "<xml></xml>" } })),
    inboxes: snapshotInboxes(grid), rng: rng.snapshot(), scheduler: eventScheduler.snapshot(),
  });
}
export async function restoreWorld(p) {
  haltWorld(); restoreStores(p);
  CONFIG.FARM.rows = p.rows; CONFIG.FARM.columns = p.columns;
  robots_state.splice(0); rng.restore(p.rng); farm_grid_index.random = () => rng.next();
  await game(() => {
    const grid = farm_grid_index;
    for (const saved of p.tiles) {
      const tile = grid.get(`${saved.y}-${saved.x}`);
      tile.lesson = saved.lesson;
      if (saved.crop) {
        const c = saved.crop;
        tile.crop = addCrop(grid, c.type, saved.x, saved.y, c.state);
        Object.assign(tile.crop, c.fields, { saveId: c.id, crop_health: c.health, crop_grow_time: c.growTime, crop_grow_duration: c.growDuration, spoilage_remaining: decodeTimer(c.spoilage) });
      }
      Object.assign(tile.soil, { soil_state: saved.soil.state, water_remaining: saved.soil.water, water_crop: saved.soil.owner ? tile.crop : null });
      tile.soil.refreshSoilVisual();
    }
    for (const saved of p.bots) {
      const bot = addFarmbot(saved.index, grid, saved.x, saved.y);
      Object.assign(bot, { botmove_duration: saved.moveDuration, botact_duration: saved.actionDuration, botcheck_duration: saved.checkDuration });
      robots_state[saved.index] = { robot: bot, text_code: saved.program.text_code, blockly_xml: saved.program.block_xml, block_code: "", is_running: false, interval: null, interpreter: null };
    }
    restoreInboxes(grid, p.inboxes);
    for (const saved of p.pests) {
      const bug = addBug(grid, { ...saved.config, restoring: true, spawnAt: { x: saved.x, y: saved.y } });
      Object.assign(bug, { saveId: saved.id, attackRemaining: saved.attackRemaining, moveRemaining: saved.moveRemaining, exposureAge: saved.exposureAge, spawned_at: saved.spawned_at });
      if (saved.motion) { bug.updateGridIndex(saved.motion.x, saved.motion.y); bug.gridJump(saved.motion.x, saved.motion.y, saved.motion.remaining); }
      if (saved.config.lesson) grid.get(saved.reservation).lessonBug = bug;
    }
    getFarmEventRuntime(grid).simulation.restore(p.hazards);
    for (const key of p.lessonFires) grid.get(key).lessonFire = grid.get(key).fire;
    grid.lessonQuest = p.lessonQuest; grid.lessonActive = p.lessonActive;
    if (grid.lessonQuest !== currentQuest() || QUEST_STATE[grid.lessonQuest]?.is_completed) { releaseLesson(grid); grid.lessonQuest = null; }
    eventScheduler.restore(p.scheduler); eventScheduler.random = () => rng.next();
  });
  farm_grid_index.restoring = false;
}
