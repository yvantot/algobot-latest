import { lerp } from "../utils/math.js";
import { RewardTypes, CropTypes } from "./enum.js";

export const TYPE_COLORS = {
  keyword: "#c678dd",
  variable: "#abb2bf",
  function: "#61afef",
  crop: "#37d337",
  event: "#ddea23",
};

export const LEVEL_REWARDS_DATA = {
  // Default: small coin bonus for every level without a special reward
  DEFAULT: { type: RewardTypes.COIN, amount: 15 },

  // Early Game (1-9): Get started with wheat, then taste other crops
  1: { type: RewardTypes.COIN, amount: 25 },                                       // First level bonus
  2: { type: RewardTypes.CROPS, item: CropTypes.WHEAT, amount: 10 },                // Wheat starter pack
  4: { type: RewardTypes.COIN, amount: 30 },                                       // Small milestone
  6: { type: RewardTypes.CROPS, item: CropTypes.WHEAT, amount: 15 },                // More wheat

  // Mid-Early (10-14): Corn era begins
  10: { type: RewardTypes.COIN, amount: 50 },                                       // Level 10 milestone
  11: { type: RewardTypes.CROPS, item: CropTypes.CORN, amount: 10 },                 // Corn seeds
  13: { type: RewardTypes.CROPS, item: CropTypes.CORN, amount: 15 },                 // More corn

  // Mid Game (15-19): Rice era
  15: { type: RewardTypes.COIN, amount: 75 },                                       // Level 15 milestone
  16: { type: RewardTypes.CROPS, item: CropTypes.RICE, amount: 10 },                 // Rice seeds
  18: { type: RewardTypes.CROPS, item: CropTypes.RICE, amount: 15 },                 // More rice

  // Mid-Late (20-24): Potato era
  20: { type: RewardTypes.COIN, amount: 100 },                                      // Level 20 milestone
  21: { type: RewardTypes.CROPS, item: CropTypes.POTATO, amount: 10 },               // Potato seeds
  23: { type: RewardTypes.CROPS, item: CropTypes.POTATO, amount: 12 },               // More potato

  // Late Game (25-28): Sugarcane era
  25: { type: RewardTypes.COIN, amount: 150 },                                      // Level 25 milestone
  26: { type: RewardTypes.CROPS, item: CropTypes.SUGARCANE, amount: 10 },            // Sugarcane seeds
  28: { type: RewardTypes.CROPS, item: CropTypes.SUGARCANE, amount: 15 },            // More sugarcane

  // End Game (29-30): Tomato era
  29: { type: RewardTypes.CROPS, item: CropTypes.TOMATO, amount: 10 },               // Tomato seeds
  30: { type: RewardTypes.COIN, amount: 250 },                                      // Grand finale
};

export const SHOP_DATA = {
  seeds: {
    [CropTypes.WHEAT]: {
      icon: "/sprites/icon_wheat.png",
      definition: "A cheap and reliable seed for beginners.",
      price: 3,
      unlocked: true,
    },

    [CropTypes.CORN]: {
      icon: "/sprites/icon_corn.png",
      definition: "Grows best when planted together.",
      price: 6,
      unlocked: false,
    },

    [CropTypes.RICE]: {
      icon: "/sprites/icon_rice.png",
      definition: "A valuable crop that attracts bugs.",
      price: 9,
      unlocked: false,
    },

    [CropTypes.POTATO]: {
      icon: "/sprites/icon_potato.png",
      definition: "Slow to grow, but highly rewarding.",
      price: 12,
      unlocked: false,
    },

    [CropTypes.SUGARCANE]: {
      icon: "/sprites/icon_sugarcane.png",
      definition: "Regrows automatically after harvest.",
      price: 15,
      unlocked: false,
    },

    [CropTypes.TOMATO]: {
      icon: "/sprites/icon_tomato.png",
      definition: "High profit, but spoils quickly.",
      price: 18,
      unlocked: false,
    },
  },

  land: {
    row: {
      icon: "/sprites/icon_buy_row.png",
      definition: "Adds one row to your farm.",
      price: 100,
      unlocked: false,
    },

    column: {
      icon: "/sprites/icon_buy_col.png",
      definition: "Adds one column to your farm.",
      price: 100,
      unlocked: false,
    },
  },
  bots: {
    bot: {
      icon: "/sprites/avatar_default.png",
      definition: "Buy additional bot to help with your farm!",
      price: 500,
      unlocked: false,
    },
  },
  bot_upgrades: {
    move_speed: {
      icon: "/sprites/icon_bot_move.png",
      definition: "Makes robots move faster.",
      price: 50,
      unlocked: false,
    },

    action_speed: {
      icon: "/sprites/icon_bot_act.png",
      definition: "Makes robots perform actions faster.",
      price: 50,
      unlocked: false,
    },

    check_speed: {
      icon: "/sprites/icon_bot_check.png",
      definition: "Makes robots inspect crops faster.",
      price: 50,
      unlocked: false,
    },
  },
}

export const PLAYER_DATA = {
  level: 0,
  exp: 0,
  custom: {
    farm_name: "My Amazing Farm",
  },
  getLevel() {
    return Math.floor(this.exp / 100);
  },
  changeExp(amount) {
    this.exp += amount;
    this.updateUI();
  },
  updateUI() {
    // This should scale
    const level = this.getLevel();
    if (level > this.level) {
      // This should do animation
      const player_ui = document.getElementById("player-info");
      player_ui.classList.remove("jello-horizontal-normal");
      void player_ui.offsetWidth;
      player_ui.classList.add("jello-horizontal-normal");
    }
    this.level = level;
    const progress = this.exp % 100;
    document.getElementById("player-level").innerText = `Level ${Math.floor(level)}`;
    document.getElementById("progress-level").style.width = progress + "%";
  },
};

export const INVENTORY = {
  coins: 50,
  crops: {
    [CropTypes.WHEAT]: 5,
    [CropTypes.CORN]: 0,
    [CropTypes.RICE]: 0,
    [CropTypes.POTATO]: 0,
    [CropTypes.SUGARCANE]: 0,
    [CropTypes.TOMATO]: 0,
  },
  elements: {
    coin: null,
    [CropTypes.WHEAT]: null,
    [CropTypes.CORN]: null,
    [CropTypes.RICE]: null,
    [CropTypes.POTATO]: null,
    [CropTypes.SUGARCANE]: null,
    [CropTypes.TOMATO]: null,
  },
  changeCoins(amount) {
    if (this.elements.coin === null) this.setElements();
    if (!this.elements.coin) return;

    const start_value = this.coins;
    const end_value = this.coins + amount;
    const duration = 500;
    const start_time = performance.now();

    const animate = (current_time) => {
      const elapsed = current_time - start_time;
      const progress = Math.min(elapsed / duration, 1);

      const current_value = Math.floor(start_value + (end_value - start_value) * progress);
      this.elements.coin.innerText = current_value;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.elements.coin.innerText = end_value;
      }
    };

    const icon = document.getElementById("coin-icon");
    if (icon) {
      icon.classList.remove("jello-horizontal-normal");
      void icon.offsetWidth;
      icon.classList.add("jello-horizontal-normal");
    }
    this.coins = end_value;

    requestAnimationFrame(animate);
  },
  changeCrops(type, amount) {
    this.crops[type] += amount;

    this.updateUI();
  },
  setElements() {
    this.elements.coin = document.getElementById("coin");
    this.elements[CropTypes.WHEAT] = document.getElementById(CropTypes.WHEAT);
    this.elements[CropTypes.CORN] = document.getElementById(CropTypes.CORN);
    this.elements[CropTypes.RICE] = document.getElementById(CropTypes.RICE);
    this.elements[CropTypes.POTATO] = document.getElementById(CropTypes.POTATO);
    this.elements[CropTypes.SUGARCANE] = document.getElementById(CropTypes.SUGARCANE);
    this.elements[CropTypes.TOMATO] = document.getElementById(CropTypes.TOMATO);
  },
  updateUI() {
    if (this.elements.coin === null) this.setElements();

    if (this.elements[CropTypes.WHEAT]) this.elements[CropTypes.WHEAT].innerText = this.crops[CropTypes.WHEAT];
    if (this.elements[CropTypes.CORN]) this.elements[CropTypes.CORN].innerText = this.crops[CropTypes.CORN];
    if (this.elements[CropTypes.RICE]) this.elements[CropTypes.RICE].innerText = this.crops[CropTypes.RICE];
    if (this.elements[CropTypes.POTATO]) this.elements[CropTypes.POTATO].innerText = this.crops[CropTypes.POTATO];
    if (this.elements[CropTypes.SUGARCANE]) this.elements[CropTypes.SUGARCANE].innerText = this.crops[CropTypes.SUGARCANE];
    if (this.elements[CropTypes.TOMATO]) this.elements[CropTypes.TOMATO].innerText = this.crops[CropTypes.TOMATO];
  },
};

function createCropData(data = {}) {
  return {
    health: 20,
    duration: 15,
    reward: 3,
    exp: 3,
    spoilage_time: 20,
    seed_drop_chance: 0.5,
    resistance: {
      fire: 0.5,
      bug: 0.5,
    },
    ...data,
    resistance: {
      fire: 0.5,
      bug: 0.5,
      ...(data.resistance ?? {}),
    },
  };
}

export const CONFIG = {
  FARM: {
    rows: 3,
    columns: 3,
    gap: 12,
    tile_size: 64,
    tile_radius: 12,
    bg_soil: "#EFB675",
    bg_grass: "#719816",
  },
  BOT: {
    move_duration: 0.7, // These values are only default values, they do not reflect the latest values of bots
    action_duration: 0.8,
    check_duration: 0.5,
  },
};

export const CROP_DATA = {
  [CropTypes.WHEAT]: createCropData({
    duration: 1,
    seed_drop_chance: 0.9,
  }),
  [CropTypes.CORN]: createCropData({
    health: 15,
    duration: 30,
    reward: 5,
    exp: 5,
    spoilage_time: 13,
    seed_drop_chance: 0.75,
  }),
  [CropTypes.RICE]: createCropData({
    health: 10,
    duration: 25,
    reward: 8,
    exp: 7,
    spoilage_time: 20,
    seed_drop_chance: 0.7,
    resistance: {
      bug: 1,
    },
  }),
  // Very stable plant, bug-immune but slow to grow
  [CropTypes.POTATO]: createCropData({
    health: 12,
    duration: 55,
    reward: 12,
    exp: 9,
    spoilage_time: 60,
    seed_drop_chance: 0.6,
    resistance: {
      fire: 0.2,
      bug: 0
    },
  }),
  [CropTypes.SUGARCANE]: createCropData({
    health: 10,
    duration: 15,
    reward: 4,
    exp: 4,
    spoilage_time: 60,
    seed_drop_chance: 0.1,
    resistance: {
      fire: 1,
    },
  }),
  [CropTypes.TOMATO]: createCropData({
    health: 8,
    duration: 30,
    reward: 18,
    exp: 12,
    spoilage_time: 8,
    seed_drop_chance: 0.05,
  }),
};

export const SAY_DATA = {
  farm: {
    error: {
      till_tilled: "Already tilled",
      water_initial: "Till the soil first",
      water_watered: "Already watered",
      water_harvestable: "The crop is harvestable",
      plant_planted: "Tile is already planted",
      plant_initial: "The soil is not tilled",
      harvest_not_ready: "The crop is not fully grown",
      destroy_absoring: "The crop is absoring water",
      crop_dead: "The crop is dead, destroy instead",
      out_of_bounds: "Out of bounds",
      insufficient_resources: "Insufficient resources",
      crop_locked: "Crop is locked",
      no_plant: "Plant the soil first",
      no_bug: "There is no bug",
    },
  },
};

export const CAMERA = {
  x: 500,
  y: 700,
};

export function setGridOrigin(k, farm) {
  farm.cell_size = farm.tile_size + farm.gap;
  farm.grid_size = {
    h: farm.rows * farm.tile_size + (farm.rows - 1) * farm.gap,
    w: farm.columns * farm.tile_size + (farm.columns - 1) * farm.gap,
  };
  farm.grid_origin = {
    x: k.width() / 2 - farm.grid_size.w / 2,
    y: k.height() / 2 - farm.grid_size.h / 2,
  };
}

export function setCameraCenter(k, camera) {
  camera.x = k.width() / 2;
  camera.y = k.height() / 2;
}

export const DOCUMENT_DATA = {
  events: {
    fire: {
      definition: "A fire starts on a random crop and spreads to nearby crops unless extinguished quickly.",
      icon: "/sprites/icon_fire.png",
      example: `bot.extinguish(); // Put out the fire`,
      note: "Respond immediately. Delaying can cause the fire to spread across your farm.",
      type: "event",
      is_unlocked: false,
      tier: 3,
    },

    bug: {
      definition: "Bugs appear unexpectedly and begin eating nearby crops until they're eliminated.",
      icon: "/sprites/icon_bug.png",
      example: `bot.kill_bug(); // Eliminate nearby bugs`,
      note: "Inspect your crops regularly so your bot can react before too much damage is done.",
      type: "event",
      is_unlocked: false,
      tier: 3,
    },

    rain: {
      definition: "Rain automatically waters all crops, reducing the need for manual watering.",
      icon: "/sprites/icon_rain.png",
      example: `// No action required`,
      note: "Take advantage of rainy weather by skipping unnecessary watering commands.",
      type: "event",
      is_unlocked: true,
      tier: 1,
    },
  },
  crops: {
    wheat: {
      definition: "A basic, reliable crop. Perfect for learning the fundamentals of tilling and planting.",
      example: `bot.plant("wheat")`,
      icon: "/sprites/icon_wheat.png",

      strength: "None",
      weakness: "None",
      note: "Use this to practice your first bot.plant() and bot.water() sequences.",
      type: "crop",
      is_unlocked: true,
      tier: 1,
    },

    corn: {
      definition: "A social crop that grows better when crowded together. Plant corn adjacent to each other.",
      example: `bot.plant("corn")`,
      icon: "/sprites/icon_corn.png",

      strength: "Faster growth (-6s) for every adjacent corn plant.",
      weakness: "Pest Infestation",
      note: "This is the perfect time to use 'for' loops to plant long rows of corn at once.",
      type: "crop",
      is_unlocked: false,
      tier: 2,
    },

    rice: {
      definition: "A valuable grain crop that rewards careful management and proper planning.",
      example: `bot.plant("rice")`,
      icon: "/sprites/icon_rice.png",

      strength: "High-yield crop! Get rich? This is the way.",
      weakness: "Bugs love this crop! They will eat it whenever they can.",
      note: "Use 'if' statements to inspect your crops and react quickly when bugs appear.",
      type: "crop",
      is_unlocked: false,
      tier: 3,
    },

    potato: {
      definition: "A slow-growing but highly valuable tuber that grows safely underground.",
      example: `bot.plant("potato")`,
      icon: "/sprites/icon_potato.png",

      strength: "Underground (immune to bugs at the surface).",
      weakness: "Very slow to grow.",
      note: "A long duration means high reward. Think about the efficiency of your code while waiting.",
      type: "crop",
      is_unlocked: false,
      tier: 4,
    },

    sugarcane: {
      definition: "A tall grass that keeps providing value as long as it stays standing.",
      example: `bot.plant("sugarcane")`,
      icon: "/sprites/icon_sugarcane.png",

      strength: "Automatic Regrowth (does not need to be replanted after harvest).",
      weakness: "Fire (highly flammable and spreads quickly).",
      note: "Use a 'while' loop to harvest this repeatedly until a disaster occurs.",
      type: "crop",
      is_unlocked: false,
      tier: 5,
    },

    tomato: {
      definition: "A delicate fruit that requires precise timing to maximize profit.",
      example: `bot.plant("tomato")`,
      icon: "/sprites/icon_tomato.png",

      strength: "High Market Demand (sells for a premium).",
      weakness: "Spoilage (the fastest crop to rot).",
      note: "Your code needs to be responsive. Use events to trigger a harvest exactly when it's ready.",
      type: "crop",
      is_unlocked: false,
      tier: 5,
    },
  },
  globals: {
    bot: {
      definition: "Use this variable to control your bot.",
      example: `bot.right(); // Move the bot to the right`,
      type: "variable",
      is_unlocked: true,
      tier: 0,
    },
    shop: {
      definition: "Use this variable to access shop related functions.",
      example: `shop.buy_plants("wheat", 1)`,
      type: "variable",
      is_unlocked: true,
      tier: 0,
    },
    inventory: {
      definition: "Use this variable to access inventory contents.",
      example: `inventory.coins() // Return the coins player has`,
      type: "variable",
      is_unlocked: true,
      tier: 0,
    },
    rows: {
      definition: "Use this to access the number of your rows",
      arguments: `None`,
      example: `rows() // Returns the number of grid rows`,
      type: "function",
      is_unlocked: false,
      tier: 1,
    },
    columns: {
      definition: "Use this to access the number of your columns",
      arguments: `None`,
      example: `columns() // Returns the number of grid columns`,
      type: "function",
      is_unlocked: false,
      tier: 1,
    },
    randint: {
      type: "function",
      definition: "Returns a whole random number.",
      arguments: `randint(lower: Number, upper: Number)`,
      example: `randint(0, 10) // Returns a number between 0 and 10`,
      is_unlocked: false,
      tier: 4,
    },
    randfloat: {
      type: "function",
      definition: "Returns a random number with decimals.",
      arguments: `randfloat(lower: Number, upper: Number)`,
      example: `randfloat(0, 1) // Returns a number between 0 and 1`,
      is_unlocked: false,
      tier: 4,
    },
  },
  syntax: {
    var: {
      definition: "A variable stores a value under a name so you can use or change it later.",
      example: `var speed = 5;\nvar cropName = "wheat";\nvar isReady = true;`,
      type: "keyword",
      is_unlocked: true,
      tier: 1,
    },
    if: {
      definition: "Runs a block of code only if a condition is true.",
      example: `if (cropCount > 10) {\n  console.log("Plenty of crops!");\n}`,
      note: "Don't confuse '==' (comparison) with '=' (assignment) inside conditions. Also, a missing curly brace can cause only the first line to be conditional.",
      type: "keyword",
      is_unlocked: true,
      tier: 1,
    },
    else: {
      type: "keyword",
      definition: "Runs a block of code when the 'if' condition is false.",
      example: `if (isRaining) {\n  console.log("Stay inside.");\n} else {\n  console.log("Go outside.");\n}`,
      is_unlocked: true,
      tier: 1,
    },
    "else if": {
      type: "keyword",
      definition: "Checks another condition if the previous 'if' was false. You can chain multiple 'else if' blocks together.",
      example: `if (score >= 90) {\n  console.log("A");\n} else if (score >= 75) {\n  console.log("B");\n} else {\n  console.log("C");\n}`,
      note: "Conditions are checked top to bottom and stop at the first true one. Order matters, putting a broader condition before a narrower one can make the narrower one unreachable.",
      is_unlocked: true,
      tier: 3,
    },
    "!": {
      type: "keyword",
      definition: "Negates a boolean. For example, true will be false, false will be true.",
      example: `if (!true) bot.right();`,
      note: "You must use it syntatically correct in-order to work.",
      is_unlocked: true,
      tier: 2,
    },
    true: {
      type: "keyword",
      definition: "Represents a truth value. It means 'yes', 'correct', or 'condition is satisfied'. In programming, true is used to control decisions and logic.",
      example: `if (true) bot.right();`,
      note: 'true is not a string. Writing "true" is text, not a boolean value.',
      is_unlocked: true,
      tier: 1,
    },
    false: {
      type: "keyword",
      definition: "Represents a false value. It means 'no', 'incorrect', or 'condition is not satisfied'. It is used to stop actions or choose alternative paths.",
      example: `if (false) bot.left();`,
      note: "false is not the same as 0 or null, though some languages may treat them similarly in conditions.",
      is_unlocked: true,
      tier: 1,
    },
    for: {
      type: "keyword",
      definition: "Repeats a block of code a set number of times using a counter variable.",
      example: `for (let i = 0; i < 5; i++) {\n  console.log("Step " + i);\n}`,
      note: "Off-by-one errors are common, double-check whether your condition uses '<' or '<='. Also, forgetting to increment 'i' creates an infinite loop.",
      is_unlocked: true,
      tier: 2,
    },
    break: {
      type: "keyword",
      definition: "Immediately exits a loop or switch statement.",
      example: `for (let i = 0; i < 10; i++) {\n  if (i === 5) break;\n  console.log(i);\n}`,
      note: "'break' only exits the innermost loop or switch. If you have nested loops, it won't break out of the outer one.",
      is_unlocked: true,
      tier: 3,
    },
    continue: {
      type: "keyword",
      definition: "Skips the rest of the current loop iteration and jumps to the next one.",
      example: `for (let i = 0; i < 5; i++) {\n  if (i === 2) continue;\n  console.log(i); // prints 0, 1, 3, 4\n}`,
      note: "Like 'break', 'continue' only affects the innermost loop. Overusing it can make loops harder to read and reason about.",
      is_unlocked: true,
      tier: 3,
    },
    while: {
      type: "keyword",
      definition: "Repeats a block of code as long as a condition stays true.",
      example: `let water = 10;\nwhile (water > 0) {\n  water--;\n}`,
      note: "If the condition never becomes false, the loop runs forever and crashes your program. Always make sure something inside the loop moves it toward ending.",
      is_unlocked: true,
      tier: 3,
    },
    function: {
      type: "keyword",
      definition: "A reusable named block of code. Define it once, call it as many times as you need.",
      example: `function greet(name) {\n  console.log("Hello, " + name);\n}\n\ngreet("Alex");`,
      note: "A function must be called to run, defining it does nothing on its own. Also, variables declared inside a function are not accessible outside of it.",
      is_unlocked: true,
      tier: 4,
    },
    return: {
      type: "keyword",
      definition: "Exits a function and optionally sends a value back to whoever called it.",
      example: `function add(a, b) {\n  return a + b;\n}\n\nlet sum = add(3, 4); // sum is 7`,
      note: "Any code written after 'return' in the same block will never run. Also, a function without a 'return' statement gives back 'undefined' by default.",
      is_unlocked: true,
      tier: 4,
    },
    switch: {
      type: "keyword",
      definition: "Compares a value against multiple specific cases and runs the matching block.",
      example: `switch (var_num) {\n  case 1:\n    console.log("var_num is 1");\n    break;\n  case 2:\n    console.log("var_num is 2");\n    break;\n  default:\n    console.log("Unknown number!");\n}`,
      note: "Forgetting 'break' causes 'fall-through', the code keeps running into the next case even if it doesn't match. Always add 'break' unless fall-through is intentional.",
      is_unlocked: true,
      tier: 3,
    },
  },
  shop: {
    buy_seed: {
      type: "function",
      definition: "Purchases a specified number of seeds and adds them to your inventory. Returns purchase result as a boolean.",
      arguments: "buy_seed(crop_type: String, amount: Number)",
      example: `shop.buy_seed("wheat", 10)`,
      note: "Buying seeds before planting is essential. Make sure you have enough coins.",
      is_unlocked: false,
      tier: 2,
    },
    buy_row: {
      type: "function",
      definition: "Purchases an additional row of farmland, increasing your farm's height. Returns purchase result as a boolean.",
      arguments: "None",
      example: `shop.buy_row()`,
      note: "A larger farm lets your algorithms manage more crops at once.",
      is_unlocked: false,
      tier: 2,
    },
    buy_column: {
      type: "function",
      definition: "Purchases an additional column of farmland, increasing your farm's width. Returns purchase result as a boolean.",
      arguments: "None",
      example: `shop.buy_column()`,
      note: "Expanding your farm creates more opportunities to automate planting and harvesting.",
      is_unlocked: false,
      tier: 2,
    },
    upgrade_bot_action: {
      type: "function",
      definition: "Upgrades a robot's action speed. The parameter is the robot's ID shown on screen. Returns purchase result as a boolean.",
      arguments: "shop.upgrade_bot_action(bot_index: Number)",
      example: `shop.upgrade_bot_action(0) // 0 is the robot's number`,
      note: "Faster actions allow robots to plant, water, harvest, and respond to events more quickly.",
      is_unlocked: false,
      tier: 2,
    },
    upgrade_bot_check: {
      type: "function",
      definition: "Upgrades a robot's inspection speed, allowing it to detect crop status and events faster. Returns purchase result as a boolean.",
      arguments: `shop.upgrade_bot_check(bot_index: Numnber)`,
      example: `shop.upgrade_bot_check(0) // 0 is the robot's number`,
      note: "Useful for reacting quickly to fires, bugs, and crops that are ready to harvest.",
      is_unlocked: false,
      tier: 2,
    },
    upgrade_bot_move: {
      type: "function",
      definition: "Upgrades a robot's movement speed, reducing the time spent traveling around the farm. Returns purchase result as a boolean.",
      arguments: `shop.upgrade_bot_move(bot_index: Number)`,
      example: `shop.upgrade_bot_move(0) // 0 is the robot's number`,
      note: "Movement becomes increasingly important as your farm grows larger.",
      is_unlocked: false,
      tier: 2,
    },
  },
  inventory: {
    seed: {
      definition: "Returns the number of seeds of the specified crop in the inventory.",
      example: `inventory.seed("wheat");`,
      arguments: `inventory.seed(crop_type: String)`,
      type: "function",
      is_unlocked: true,
      tier: 0,
    },
    coin: {
      definition: "Returns the current number of coins the player has.",
      example: `inventory.coin();`,
      arguments: "None",
      type: "function",
      is_unlocked: true,
      tier: 0,
    },
  },
  bot_movement: {
    up: {
      definition: "Moves the bot one tile upward from its current position.",
      example: `bot.up();`,
      arguments: "None",
      type: "function",
      is_unlocked: true,
      tier: 0,
    },
    down: {
      definition: "Moves the bot one tile downward from its current position.",
      example: `bot.down();`,
      arguments: "None",
      type: "function",
      is_unlocked: true,
      tier: 0,
    },
    right: {
      definition: "Moves the bot one tile to the right from its current position.",
      example: `bot.right();`,
      arguments: "None",
      type: "function",
      is_unlocked: true,
      tier: 0,
    },
    left: {
      definition: "Moves the bot one tile to the left from its current position.",
      example: `bot.left();`,
      arguments: "None",
      type: "function",
      is_unlocked: true,
      tier: 0,
    },
    jump: {
      type: "function",
      arguments: "bot.jump(x: Number, y: Number)",
      definition: "Jump the bot directly to a specific tile by its x and y coordinates on the grid.",
      example: `bot.jump(3, 5); // bot jumps to tile at column 3, row 5`,
      note: "Make sure the target coordinates are valid tiles on the grid, jumping out of bounds will cause an error.",
      is_unlocked: false,
      tier: 1,
    },
  },
  bot_farm_actions: {
    say: {
      type: "function",
      arguments: "bot.say(text: String)",
      definition: "Makes the bot display a message as a popup above its head. The popup fades in and then fades out automatically.",
      example: `bot.say("Hello, farmer!");\nbot.say("Crop is ready!");`,
      note: "The message must be a string. say() is great for debugging your bot's logic, use it to confirm what your bot is doing and when.",
      is_unlocked: true,
      tier: 0,
    },
    till: {
      type: "function",
      arguments: "None",
      definition: "Prepares the soil on the bot's current tile for planting. The tile must be tilled before a crop can be planted on it.",
      example: `bot.till();`,
      note: "You cannot plant on a tile that hasn't been tilled first.",
      is_unlocked: true,
      tier: 0,
    },
    water: {
      type: "function",
      arguments: "None",
      definition: "Waters the soil on the bot's current tile. Crops need water to grow.",
      example: `bot.water();`,
      note: "Watering a tile that hasn't been planted yet has no effect.",
      is_unlocked: true,
      tier: 0,
    },
    plant: {
      type: "function",
      arguments: `bot.plant(crop_type: String)`,
      definition: "Plants a specified crop on the bot's current tile. The tile must already be tilled.",
      example: `bot.plant("wheat");\nbot.plant("carrot");`,
      note: "You must pass the crop name as a string argument. Planting on an untilled tile will fail.",
      is_unlocked: true,
      tier: 0,
    },
    harvest: {
      type: "function",
      arguments: `None`,
      definition: "Harvests the fully grown crop on the bot's current tile.",
      example: `bot.harvest();`,
      note: "You can only harvest a crop that is fully grown. Use bot.is_harvestable() to check before harvesting to avoid wasting a command.",
      is_unlocked: true,
      tier: 0,
    },
    wait: {
      type: "function",
      arguments: `bot.wait(amount: Number)`,
      definition: "Make the bot wait in seconds before taking any action.",
      example: `bot.wait(10)`,
      note: "Be careful setting this too high! It'll make your bot standby doing nothing.",
      is_unlocked: true,
      tier: 4,
    },
    destroy: {
      type: "function",
      arguments: `None`,
      definition: "Destroys crop that is on the bot's current tile.",
      example: `bot.destroy();`,
      note: "This is permanent. Destroying a crop means losing it entirely.",
      is_unlocked: true,
      tier: 0,
    },
    kill_bug: {
      type: "function",
      arguments: `None`,
      definition: "Eliminates a bug on the bot's current tile. Bugs can damage or destroy your crops if left alone.",
      example: `bot.kill_bug();`,
      note: "The bot must be on the same tile as the bug for this to work.",
      is_unlocked: false,
      tier: 3,
    },
    extinguish: {
      type: "function",
      arguments: `None`,
      definition: "Extinguishes a fire on the current tile.",
      example: `if (bot.is_fire()) bot.extinguish();`,
      note: "Always check for fire before extinguishing. Fires spread quickly and can destroy nearby crops.",
      is_unlocked: false,
      tier: 3,
    },
  },
  bot_checks: {
    is_tilled: {
      type: "function",
      arguments: `None`,
      definition: "Checks whether the bot's current tile has been tilled. Returns true if tilled, false otherwise.",
      example: `if (bot.is_tilled()) {\n  bot.plant("wheat");\n}`,
      is_unlocked: false,
      tier: 1,
    },
    is_watered: {
      type: "function",
      arguments: `None`,
      definition: "Checks whether the bot's current tile has been watered. Returns true if watered, false otherwise.",
      example: `if (!bot.is_watered()) {\n  bot.water();\n}`,
      is_unlocked: false,
      tier: 2,
    },
    is_planted: {
      type: "function",
      arguments: `None`,
      definition: "Checks whether the bot's current tile has a crop planted on it. Returns true if planted, false otherwise.",
      example: `if (bot.is_planted()) {\n  console.log("Something is growing here.");\n}`,
      is_unlocked: false,
      tier: 1,
    },
    is_harvestable: {
      type: "function",
      arguments: `None`,
      definition: "Checks whether the crop on the bot's current tile is fully grown and ready to harvest. Returns true or false.",
      example: `if (bot.is_harvestable()) {\n  bot.harvest();\n}`,
      is_unlocked: false,
      tier: 2,
    },
    is_bug: {
      type: "function",
      arguments: `None`,
      definition: "Returns whether the current tile contains a bug.",
      example: `if (bot.is_bug()) bot.kill_bug();`,
      note: "Use this inside an 'if' statement so your bot only attacks bugs when they are present which saves time.",
      is_unlocked: false,
      tier: 2,
    },
    is_fire: {
      type: "function",
      arguments: `None`,
      definition: "Returns whether the current tile is on fire.",
      example: `if (bot.is_fire()) bot.extinguish();`,
      note: "Checking for fire before extinguishing prevents unnecessary actions.",
      is_unlocked: false,
      tier: 2,
    },
    is_dead: {
      type: "function",
      arguments: `None`,
      definition: "Returns whether the current plant has died.",
      example: `if (bot.is_dead()) bot.destroy();`,
      note: "Dead crops cannot recover. Remove them before planting new seeds.",
      is_unlocked: false,
      tier: 2,
    },
  },
};