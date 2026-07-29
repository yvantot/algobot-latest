import { CONFIG, INVENTORY, DOCUMENT_DATA } from "./global.js";
import { buyLand, buyUpgrade, buyPlants } from "./shop.js";
import { telemetry } from "../ml/telemetry.js";

function checkUnlocked(category, key) {
	return DOCUMENT_DATA[category]?.[key]?.is_unlocked ?? true;
}

export function createInit(robot, workspace = null, onQuestEvent = null) {
	return function init(interpreter, global_obj) {
		const { columns, rows } = CONFIG.FARM;
		interpreter.setProperty(global_obj, "columns", interpreter.createNativeFunction(() => {
			if (!checkUnlocked("globals", "columns")) { robot.sayText("columns() is locked!"); return 0; }
			trackQ("cs_grid_0", 1);
			return CONFIG.FARM.columns;
		}));
		interpreter.setProperty(global_obj, "rows", interpreter.createNativeFunction(() => {
			if (!checkUnlocked("globals", "rows")) { robot.sayText("rows() is locked!"); return 0; }
			trackQ("cs_grid_0", 1);
			return CONFIG.FARM.rows;
		}));
		interpreter.setProperty(global_obj, "randint", interpreter.createNativeFunction((lower, upper) => {
			if (!checkUnlocked("globals", "randint")) { robot.sayText("randint() is locked!"); return 0; }
			lower = Number(lower);
			upper = Number(upper);
			trackQ("cs_random_0", 1);
			return Math.floor(Math.random() * (upper - lower + 1)) + lower;
		}));
		interpreter.setProperty(global_obj, "randfloat", interpreter.createNativeFunction((lower, upper) => {
			if (!checkUnlocked("globals", "randfloat")) { robot.sayText("randfloat() is locked!"); return 0; }
			lower = Number(lower);
			upper = Number(upper);
			trackQ("cs_random_0", 1);
			return Math.random() * (upper - lower) + lower;
		}));

		// For blockly highlighting
		interpreter.setProperty(global_obj, "highlightBlock", interpreter.createNativeFunction((id) => {
			id = id ? id.toString() : '';
			if (workspace) {
				workspace.highlightBlock(id);
			}
		}));

		const bot = interpreter.nativeToPseudo({});
		const shop = interpreter.nativeToPseudo({});
		const inventory = interpreter.nativeToPseudo({});

		interpreter.setProperty(global_obj, "shop", shop);
		interpreter.setProperty(global_obj, "bot", bot);
		interpreter.setProperty(global_obj, "inventory", inventory);

		// === Inventory Bindings
		interpreter.setProperty(inventory, "seeds", interpreter.createNativeFunction((crop_type) => INVENTORY.crops[crop_type]));
		interpreter.setProperty(inventory, "coins", interpreter.createNativeFunction(() => INVENTORY.coins));

		// === Shop Bindings ===
		interpreter.setProperty(shop, "buy_seed", interpreter.createNativeFunction((crop_type, amount) => {
			if (!checkUnlocked("shop", "buy_seed")) { robot.sayText("shop.buy_seed is locked!"); return false; }
			const res = buyPlants(crop_type, amount);
			if (res) trackQ("shop_seed_0", 1);
			return res;
		}));
		interpreter.setProperty(shop, "buy_row", interpreter.createNativeFunction(() => {
			if (!checkUnlocked("shop", "buy_row")) { robot.sayText("shop.buy_row is locked!"); return false; }
			const res = buyLand("row");
			if (res) trackQ("shop_land_0", 1);
			return res;
		}));
		interpreter.setProperty(shop, "buy_column", interpreter.createNativeFunction(() => {
			if (!checkUnlocked("shop", "buy_column")) { robot.sayText("shop.buy_column is locked!"); return false; }
			const res = buyLand("column");
			if (res) trackQ("shop_land_0", 1);
			return res;
		}));
		interpreter.setProperty(shop, "upgrade_bot_action", interpreter.createNativeFunction(() => {
			if (!checkUnlocked("shop", "upgrade_bot_action")) { robot.sayText("upgrade_bot_action is locked!"); return false; }
			const res = buyUpgrade("action_speed", robot.bot_index);
			if (res) trackQ("shop_upgrade_0", 1);
			return res;
		}));
		interpreter.setProperty(shop, "upgrade_bot_move", interpreter.createNativeFunction(() => {
			if (!checkUnlocked("shop", "upgrade_bot_move")) { robot.sayText("upgrade_bot_move is locked!"); return false; }
			const res = buyUpgrade("move_speed", robot.bot_index);
			if (res) trackQ("shop_upgrade_0", 1);
			return res;
		}));
		interpreter.setProperty(shop, "upgrade_bot_check", interpreter.createNativeFunction(() => {
			if (!checkUnlocked("shop", "upgrade_bot_check")) { robot.sayText("upgrade_bot_check is locked!"); return false; }
			const res = buyUpgrade("check_speed", robot.bot_index);
			if (res) trackQ("shop_upgrade_0", 1);
			return res;
		}));

		// Quest event helper, safely calls the callback if provided
		const trackQ = (key, amount = 1) => { if (onQuestEvent) onQuestEvent(key, amount); };

		// === Bot Bindings ===
		// Actions
		interpreter.setProperty(bot, "say", interpreter.createNativeFunction((t) => {
			telemetry.recordInterpreterStep();
			trackQ("tut_0", 1);
			return robot.sayText(t);
		}));
		interpreter.setProperty(bot, "wait", interpreter.createAsyncFunction((t, cb) => {
			if (!checkUnlocked("bot_farm_actions", "wait")) { robot.sayText("bot.wait is locked!"); return cb(); }
			telemetry.recordInterpreterStep();
			trackQ("cs_wait_0", 1);
			return robot.botWait(t, cb);
		}));
		interpreter.setProperty(bot, "jump", interpreter.createAsyncFunction((x, y, cb) => {
			if (!checkUnlocked("bot_movement", "jump")) { robot.sayText("bot.jump is locked!"); return cb(); }
			telemetry.recordBotAction("jump"); telemetry.recordInterpreterStep();
			trackQ("cs_jump_0", 1);
			return robot.botJump(x, y, cb);
		}));
		interpreter.setProperty(bot, "left", interpreter.createAsyncFunction((cb) => {
			telemetry.recordBotAction("move"); telemetry.recordInterpreterStep();
			const moved = robot.botJump(robot.grid_x - 1, robot.grid_y, cb);
			if (moved) trackQ("tut_1", 1);
			return moved;
		}));
		interpreter.setProperty(bot, "right", interpreter.createAsyncFunction((cb) => {
			telemetry.recordBotAction("move"); telemetry.recordInterpreterStep();
			const moved = robot.botJump(robot.grid_x + 1, robot.grid_y, cb);
			if (moved) trackQ("tut_1", 1);
			return moved;
		}));
		interpreter.setProperty(bot, "down", interpreter.createAsyncFunction((cb) => {
			telemetry.recordBotAction("move"); telemetry.recordInterpreterStep();
			const moved = robot.botJump(robot.grid_x, robot.grid_y + 1, cb);
			if (moved) trackQ("tut_1", 1);
			return moved;
		}));
		interpreter.setProperty(bot, "up", interpreter.createAsyncFunction((cb) => {
			telemetry.recordBotAction("move"); telemetry.recordInterpreterStep();
			const moved = robot.botJump(robot.grid_x, robot.grid_y - 1, cb);
			if (moved) trackQ("tut_1", 1);
			return moved;
		}));
		interpreter.setProperty(bot, "till", interpreter.createAsyncFunction((cb) => {
			telemetry.recordBotAction("till"); telemetry.recordInterpreterStep();
			const tilled = robot.botTill(cb);
			if (tilled) trackQ("tut_2", 1);
			return tilled;
		}));
		interpreter.setProperty(bot, "water", interpreter.createAsyncFunction((cb) => {
			telemetry.recordBotAction("water"); telemetry.recordInterpreterStep();
			const watered = robot.botWater(cb);
			if (watered) trackQ("tut_2", 1);
			return watered;
		}));
		interpreter.setProperty(bot, "plant", interpreter.createAsyncFunction((type, cb) => {
			telemetry.recordBotAction("plant"); telemetry.recordInterpreterStep();
			const planted = robot.botPlant(type, cb);
			if (planted) trackQ("tut_2", 1);
			return planted;
		}));
		interpreter.setProperty(bot, "harvest", interpreter.createAsyncFunction((cb) => {
			telemetry.recordBotAction("harvest"); telemetry.recordInterpreterStep();
			const cropType = robot.botHarvest(cb);
			if (cropType) {
				trackQ("tut_2", 1);
				if (cropType === "wheat") trackQ("crop_wheat_1", 1);
				if (cropType === "corn") trackQ("crop_corn_1", 1);
				if (cropType === "rice") trackQ("crop_rice_1", 1);
				if (cropType === "potato") trackQ("crop_potato_1", 1);
				if (cropType === "sugarcane") trackQ("crop_sugarcane_1", 1);
				if (cropType === "tomato") trackQ("crop_tomato_1", 1);
			}
			return cropType;
		}));
		interpreter.setProperty(bot, "destroy", interpreter.createAsyncFunction((cb) => {
			telemetry.recordBotAction("destroy"); telemetry.recordInterpreterStep();
			trackQ("cs_cleanup_0", 1);
			return robot.botDestroy(cb);
		}));
		interpreter.setProperty(bot, "kill_bug", interpreter.createAsyncFunction((cb) => {
			if (!checkUnlocked("bot_farm_actions", "kill_bug")) { robot.sayText("bot.kill_bug is locked!"); return cb(); }
			telemetry.recordBotAction("kill_bug"); telemetry.recordInterpreterStep();
			trackQ("cs_pest_0", 1);
			return robot.botKillBug ? robot.botKillBug(cb) : cb();
		}));
		interpreter.setProperty(bot, "extinguish", interpreter.createAsyncFunction((cb) => {
			if (!checkUnlocked("bot_farm_actions", "extinguish")) { robot.sayText("bot.extinguish is locked!"); return cb(); }
			telemetry.recordBotAction("extinguish"); telemetry.recordInterpreterStep();
			trackQ("cs_fire_0", 1);
			return robot.botExtinguish ? robot.botExtinguish(cb) : cb();
		}));
		// Checks, track use of conditional reactivity (Stage 2)
		interpreter.setProperty(bot, "is_dead", interpreter.createAsyncFunction((cb) => {
			if (!checkUnlocked("bot_checks", "is_dead")) { robot.sayText("bot.is_dead is locked!"); return cb(false); }
			telemetry.recordCheckBeforeAction();
			trackQ("cs_if_0", 1);
			return robot.checkDead(cb);
		}));
		interpreter.setProperty(bot, "is_tilled", interpreter.createAsyncFunction((cb) => {
			if (!checkUnlocked("bot_checks", "is_tilled")) { robot.sayText("bot.is_tilled is locked!"); return cb(false); }
			telemetry.recordCheckBeforeAction();
			trackQ("cs_if_0", 1);
			return robot.checkTilled(cb);
		}));
		interpreter.setProperty(bot, "is_watered", interpreter.createAsyncFunction((cb) => {
			if (!checkUnlocked("bot_checks", "is_watered")) { robot.sayText("bot.is_watered is locked!"); return cb(false); }
			telemetry.recordCheckBeforeAction();
			trackQ("cs_if_0", 1);
			return robot.checkWatered(cb);
		}));
		interpreter.setProperty(bot, "is_planted", interpreter.createAsyncFunction((cb) => {
			if (!checkUnlocked("bot_checks", "is_planted")) { robot.sayText("bot.is_planted is locked!"); return cb(false); }
			telemetry.recordCheckBeforeAction();
			trackQ("cs_if_0", 1);
			return robot.checkPlanted(cb);
		}));
		interpreter.setProperty(bot, "is_harvestable", interpreter.createAsyncFunction((cb) => {
			if (!checkUnlocked("bot_checks", "is_harvestable")) { robot.sayText("bot.is_harvestable is locked!"); return cb(false); }
			telemetry.recordCheckBeforeAction();
			trackQ("cs_if_0", 1);
			return robot.isHarvestable(cb);
		}));
		interpreter.setProperty(bot, "is_bug", interpreter.createAsyncFunction((cb) => {
			if (!checkUnlocked("bot_checks", "is_bug")) { robot.sayText("bot.is_bug is locked!"); return cb(false); }
			telemetry.recordCheckBeforeAction();
			trackQ("cs_if_0", 1);
			return robot.checkBug ? robot.checkBug(cb) : cb(false);
		}));
		interpreter.setProperty(bot, "is_fire", interpreter.createAsyncFunction((cb) => {
			if (!checkUnlocked("bot_checks", "is_fire")) { robot.sayText("bot.is_fire is locked!"); return cb(false); }
			telemetry.recordCheckBeforeAction();
			trackQ("cs_if_0", 1);
			return robot.checkFire ? robot.checkFire(cb) : cb(false);
		}));
	}
}
