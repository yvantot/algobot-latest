import { AvatarTypes, ModalTypes } from "../game/global/enum.js";
import { QUEST_DATA } from "../game/global/quests.js";
import { PLAYER_DATA, INVENTORY, DOCUMENT_DATA, SHOP_DATA, CROP_DATA } from "../game/global/global.js";
import { telemetry, CS1_STAGES } from "../game/ml/telemetry.js";
import { mlAgent } from "../game/ml/agent.js";

// I only need level as index, this is the simplest shit implementation
export const CLAIMED_REWARDS = $state([]);

export const robots = $state([]);

export const robots_state = $state([])

export const Personalize = $state({
	FARM_NAME: "My Amazing Farm",
	AVATAR: AvatarTypes.FARMER,
});

export const Modals = $state({
	[ModalTypes.LEVEL_REWARDS]: false,
	[ModalTypes.FARM_PERSONALIZE]: false,
	[ModalTypes.RESEARCH_TREE]: false,
	[ModalTypes.SHOP]: false,
});

export const QUEST_STATE = $state({});
// Initialize quest state
for (const [key, data] of Object.entries(QUEST_DATA)) {
	QUEST_STATE[key] = {
		progress: 0,
		is_completed: false,
		is_claimed: false,
	};
}

export function trackQuest(key, amount = 1) {
	if (!QUEST_STATE[key] || QUEST_STATE[key].is_completed) return;

	// Check if prereqs are met
	const prereq = QUEST_DATA[key].prereq;
	if (prereq && prereq.length > 0) {
		for (const req of prereq) {
			if (!QUEST_STATE[req] || !QUEST_STATE[req].is_claimed) return; // Must claim previous to progress
		}
	}

	QUEST_STATE[key].progress += amount;
	if (QUEST_STATE[key].progress >= QUEST_DATA[key].goal) {
		QUEST_STATE[key].progress = QUEST_DATA[key].goal;
		QUEST_STATE[key].is_completed = true;
	}

	// Telemetry: track CS1 milestone stage from quest type
	if (key.startsWith("tut_")) telemetry.setStage(CS1_STAGES.SEQUENTIAL);
	else if (key === "cs_if_0") telemetry.setStage(CS1_STAGES.CONDITIONAL);
	else if (key === "cs_loop_0") telemetry.setStage(CS1_STAGES.LOOPING);

	// Sample telemetry snapshot for LSTM buffer
	telemetry.sampleHistory();

	// Trigger async DDA update (non-blocking)
	mlAgent.updateAndPredict(telemetry.currentStage).catch(() => { });
}

export const UNLOCK_VERSION = $state({ count: 0 });

// Maps quest unlock names to their actual SHOP_DATA keys
const SHOP_KEY_MAP = {
	"buy_row": "row",
	"buy_column": "column",
	"upgrade_bot_action": "action_speed",
	"upgrade_bot_move": "move_speed",
	"upgrade_bot_check": "check_speed",
};

export function claimQuest(key) {
	if (!QUEST_STATE[key] || !QUEST_STATE[key].is_completed || QUEST_STATE[key].is_claimed) return;

	QUEST_STATE[key].is_claimed = true;
	const rewards = QUEST_DATA[key].rewards;
	if (rewards) {
		if (rewards.exp) PLAYER_DATA.changeExp(rewards.exp);
		if (rewards.coins) INVENTORY.changeCoins(rewards.coins);
		if (rewards.unlocks) {
			for (const item of rewards.unlocks) {
				// Search and unlock in DOCUMENT_DATA
				for (const category of Object.values(DOCUMENT_DATA)) {
					if (category[item]) {
						category[item].is_unlocked = true;
					}
				}
				// Search and unlock in SHOP_DATA
				for (const category of Object.values(SHOP_DATA)) {
					if (category[item]) {
						category[item].unlocked = true;
					}
				}
				// Also unlock the mapped SHOP_DATA key if one exists
				const mappedKey = SHOP_KEY_MAP[item];
				if (mappedKey) {
					for (const category of Object.values(SHOP_DATA)) {
						if (category[mappedKey]) {
							category[mappedKey].unlocked = true;
						}
					}
				}
			}
			UNLOCK_VERSION.count++;
		}
	}
}

// "Did You Know?" Tips Data & Popup State
export const DID_YOU_KNOW_TIPS = {
	spoilage: {
		id: "spoilage",
		title: "Quality & Freshness",
		category: "Game Mechanics",
		description: "Crops progress from Young -> Growing -> Harvestable. If a harvestable crop is left unpicked for too long, it expires into DEAD rot! Harvest promptly to maximize EXP and Coin yields.",
		image: "/sprites/art_crop_growth.png"
	},
	soil: {
		id: "soil",
		title: "Soil States",
		category: "Game Mechanics",
		description: "Land starts in an UNTILLED state (0). Use bot.till() to change it to READY (1), then bot.water() for WATERED (2). Crops only absorb water and grow when planted in watered soil!",
		image: "/sprites/art_soil_states.png"
	},
	bugs: {
		id: "bugs",
		title: "Bug Infestations",
		category: "Game Mechanics",
		description: "Purple bugs can spawn and invade your farm, chewing on harvestable crops and dealing damage! Use bot.kill_bug() to clear bugs before they destroy your crops.",
		image: "/sprites/art_bug_infestation.png"
	},
	shop: {
		id: "shop",
		title: "Shop & Expansion",
		category: "Game Mechanics",
		description: "Spend earned Coins in the Shop to purchase new seed varieties, expand farm rows & columns, and buy extra autonomous robots!",
		image: "/sprites/art_shop_expansion.png"
	},
	freshness: {
		id: "freshness",
		title: "Crop Freshness Stages",
		category: "Game Mechanics",
		description: "Once harvestable, a crop enters a freshness countdown, sparkle icons mean 100% rewards (FRESH), flies mean half rewards (EXPIRING). After full expiry, the crop rots. Watch for the visual cues!",
		image: "/sprites/art_crop_freshness.png"
	},
	seed_drop: {
		id: "seed_drop",
		title: "Seed Drop on Harvest",
		category: "Game Mechanics",
		description: "Harvesting a crop can randomly drop a bonus seed pack back into your inventory. Wheat has a 90% chance to drop seeds, but rare crops like Tomato only drop at 5%!",
		image: "/sprites/art_seed_drop.png"
	},
	corn_synergy: {
		id: "corn_synergy",
		title: "Corn Cluster Growth Synergy",
		category: "Game Mechanics",
		description: "Corn grows faster when surrounded by other corn! Each adjacent corn crop reduces its growth duration by 6 seconds. Plant corn in dense clusters to maximize growth speed.",
		image: "/sprites/art_corn_buff.png"
	},
	sugarcane: {
		id: "sugarcane",
		title: "Sugarcane Automatic Regrowth",
		category: "Game Mechanics",
		description: "Sugarcane does not die after harvesting! Once harvested, it automatically resets to the growing state. Automate a loop to harvest sugarcane continuously for ongoing profit.",
		image: "/sprites/art_sugarcane_regrow.png"
	},
	bot_check: {
		id: "bot_check",
		title: "Bot Inspection Functions",
		category: "Game Mechanics",
		description: "Bots can inspect their current tile using check functions: bot.is_tilled(), bot.is_watered(), bot.is_planted(), bot.is_harvestable(), bot.is_dead(), bot.is_bug(), and bot.is_fire(). These return true or false and are perfect for writing smart conditional logic.",
		image: "/sprites/art_bot_check.png"
	},
	out_of_bounds: {
		id: "out_of_bounds",
		title: "Farm Grid Boundaries",
		category: "Game Mechanics",
		description: "Bots cannot move outside the farm grid! Attempting to jump out of bounds will show an error and the bot will stop. Use conditional checks before moving to avoid errors."
	},
	bug_damage: {
		id: "bug_damage",
		title: "Crop Resistance to Bugs",
		category: "Game Mechanics",
		description: "Bugs deal damage based on a crop's resistance stat. Potato is completely immune to bugs (resistance = 0)! Rice takes normal damage, while Wheat, Corn, Tomato, and Sugarcane are more vulnerable.",
		image: "/sprites/art_crop_resistance.png"
	}
};

export const DID_YOU_KNOW_STATE = $state({
	activeTip: null,
	shown: {}
});

export function triggerDidYouKnow(id) {
	if (DID_YOU_KNOW_STATE.shown[id]) return;
	const tip = DID_YOU_KNOW_TIPS[id];
	if (!tip) return;
	DID_YOU_KNOW_STATE.shown[id] = true;
	DID_YOU_KNOW_STATE.activeTip = tip;
}