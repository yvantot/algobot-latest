import { CropTypes } from "./enum.js";
import { PLAYER_DATA, INVENTORY } from "./global.js";

export const QuestTypes = {
  TUTORIAL: "tutorial",
  CROP: "crop",
  CS_CONCEPT: "cs_concept"
};

export const QUEST_DATA = {
  // Tutorial Quests
  "tut_0": {
    type: QuestTypes.TUTORIAL,
    title: "Welcome to AlgoBot",
    description: "Make your bot say something.",
    tip: 'Use bot.say("Hello!") in your code or block to make your bot speak.',
    goal: 1,
    rewards: { exp: 10, coins: 5 },
    prereq: [],
  },
  "tut_1": {
    type: QuestTypes.TUTORIAL,
    title: "Movement Basics",
    description: "Use bot.right() or bot.down().",
    tip: 'Call bot.right(), bot.down(), bot.left(), or bot.up() to move your bot around tiles.',
    goal: 3,
    rewards: { exp: 15, coins: 10, unlocks: ["jump", "is_tilled", "is_planted", "rows", "columns"] },
    prereq: ["tut_0"],
  },
  "tut_2": {
    type: QuestTypes.TUTORIAL,
    title: "First Steps in Farming",
    description: "Till, plant, water, and harvest a wheat crop.",
    tip: 'Run bot.till(), then bot.plant("wheat"), bot.water(), and finally bot.harvest().',
    goal: 4, // 1 till, 1 plant, 1 water, 1 harvest
    rewards: { exp: 30, coins: 20 },
    prereq: ["tut_1"],
  },

  // Crop Quests
  "crop_wheat_1": {
    type: QuestTypes.CROP,
    title: "Wheat Master",
    description: "Harvest wheat 5 times.",
    tip: 'Plant wheat seeds on tilled soil and water them until they are ready to harvest.',
    goal: 5,
    rewards: { exp: 50, coins: 25, unlocks: [CropTypes.CORN] },
    prereq: ["tut_2"],
  },
  "crop_corn_1": {
    type: QuestTypes.CROP,
    title: "Corn Master",
    description: "Harvest corn 10 times.",
    tip: 'Buy corn seeds from the shop! Corn grows faster when planted next to other corn plants.',
    goal: 10,
    rewards: { exp: 100, coins: 50, unlocks: [CropTypes.RICE, "kill_bug", "extinguish", "fire", "bug"] },
    prereq: ["crop_wheat_1"],
  },
  "crop_rice_1": {
    type: QuestTypes.CROP,
    title: "Rice Master",
    description: "Harvest rice 10 times.",
    tip: 'Rice yields great profit, but watch out for bugs! Use bot.is_bug() and bot.kill_bug().',
    goal: 10,
    rewards: { exp: 150, coins: 75, unlocks: [CropTypes.POTATO, "randint", "randfloat", "wait", "bot"] },
    prereq: ["crop_corn_1"],
  },
  "crop_potato_1": {
    type: QuestTypes.CROP,
    title: "Potato Master",
    description: "Harvest potato 10 times.",
    tip: 'Potatoes take longer to grow, but they are immune to surface pests.',
    goal: 10,
    rewards: { exp: 200, coins: 100, unlocks: [CropTypes.SUGARCANE] },
    prereq: ["crop_rice_1"],
  },
  "crop_sugarcane_1": {
    type: QuestTypes.CROP,
    title: "Sugarcane Master",
    description: "Harvest sugarcane 10 times.",
    tip: 'Sugarcane automatically regrows after harvesting, so you do not need to replant!',
    goal: 10,
    rewards: { exp: 250, coins: 150, unlocks: [CropTypes.TOMATO] },
    prereq: ["crop_potato_1"],
  },
  
  // CS Concept Quests
  "cs_loop_0": {
    type: QuestTypes.CS_CONCEPT,
    title: "Repetitive Tasks",
    description: "Use a for-loop 1 time.",
    tip: 'Write a loop: for (let i = 0; i < 5; i++) { bot.right(); } or use the repeat block.',
    concept: "for",
    goal: 1,
    rewards: { exp: 50, coins: 20, unlocks: ["is_watered", "is_harvestable", "buy_seed", "buy_row", "buy_column", "upgrade_bot_action", "upgrade_bot_check", "upgrade_bot_move", "row", "column", "move_speed", "action_speed", "check_speed"] },
    prereq: ["tut_1"],
  },
  "cs_if_0": {
    type: QuestTypes.CS_CONCEPT,
    title: "Decision Making",
    description: "Use an 'if' statement 1 time.",
    tip: 'Write a condition: if (bot.is_harvestable()) { bot.harvest(); } or use the "if" block.',
    concept: "if",
    goal: 1,
    rewards: { exp: 50, coins: 20, unlocks: ["is_bug", "is_fire", "is_dead"] },
    prereq: ["tut_1"],
  }
};
