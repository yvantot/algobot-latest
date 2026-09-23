// Student commands operate through the robot's public actions and sensors.
// No crop/soil ownership, scene graph, global farm map, or interpreter state is
// accessed here. Robot actions complete with callback(result), or a Promise:
// bool for actions/checks and a crop-type string (or false) for harvesting.
// Immediate return values only indicate acceptance; they never award quests.
export function createCommandAPI({
  robot,
  inventory = { crops: {}, coins: 0 },
  shop = {},
  telemetry = {},
  farmSize = () => ({ columns: 0, rows: 0 }),
  isUnlocked = () => true,
  onQuestEvent = null,
  random = Math.random,
}) {
  // Optional research/UI observers cannot interrupt a student's running code.
  const observe = (fn, ...args) => { try { return fn?.(...args); } catch { return undefined; } };
  const record = (method, ...args) => observe(telemetry[method]?.bind(telemetry), ...args);
  const quest = (key, amount = 1, action = null) => observe(onQuestEvent, key, amount, action);
  const speak = message => robot.sayText?.(message);
  let lastFarmSize = null;
  let lastHarvestCheck = null;

  function reportError(error) {
    const message = `Command error: ${error?.message || String(error)}`;
    robot.executionErrorCount = (robot.executionErrorCount || 0) + 1;
    record("recordError", message);
    observe(speak, message);
  }

  function unlocked(category, name) {
    if (isUnlocked(category, name)) return true;
    reportError(`${category === "globals" ? name + "()" : category === "shop" ? "shop." + name : "bot." + name} is locked!`);
    return false;
  }

  function native(category, name, operation, fallback = false) {
    return (...args) => {
      try { return unlocked(category, name) ? operation(...args) : fallback; }
      catch (error) { reportError(error); return fallback; }
    };
  }

  function command(name, method, { category = "bot_farm_actions", action = name, check = false, args = values => values, before = () => null, after = () => {} } = {}) {
    return (...values) => {
      const callback = typeof values.at(-1) === "function" ? values.pop() : () => {};
      let settled = false;
      let context;
      const finish = (value, failed = false) => {
        if (settled) return;
        settled = true;
        // Sensors always return booleans; no missing/null sensor can be truthy.
        const result = check ? !!value : value ?? false;
        if (name === "is_harvestable") lastHarvestCheck = !failed && typeof value === "boolean" ? value : null;
        if (result) observe(after, result, context, values);
        // A disposed editor's continuation must not create an unhandled Promise
        // rejection after an otherwise completed robot action.
        try { callback(result); } catch (error) { reportError(error); }
      };
      const fail = error => {
        if (settled) return;
        reportError(error);
        finish(false, true);
      };
      try {
        if (!unlocked(category, name)) return finish(false, true);
        if (check) record("recordCheckBeforeAction");
        else {
          if (action) record("recordBotAction", action);
          record("recordInterpreterStep");
        }
        if (typeof robot[method] !== "function") throw new Error(`bot.${name} is unavailable.`);
        context = before();
        const pending = robot[method](...args(values), finish);
        if (pending && typeof pending.then === "function") pending.then(finish, fail);
      } catch (error) { fail(error); }
    };
  }

  const bot = {
    say: native("bot_farm_actions", "say", text => {
      record("recordInterpreterStep");
      const result = speak(text);
      if(String(text ?? "").trim()) quest("intro_say");
      if(lastFarmSize !== null && text === lastFarmSize) quest("cs_grid_0");
      if(lastHarvestCheck !== null && text === lastHarvestCheck) quest("cs_check_0");
      lastFarmSize = null;
      lastHarvestCheck = null;
      return result;
    }),
    wait: command("wait", "botWait", { action: null, after: () => quest("cs_wait_0") }),
    jump: command("jump", "botJump", { category: "bot_movement", after: () => quest("cs_jump_0") }),
    till: command("till", "botTill", { after: () => quest("tut_2", 1, "till") }),
    water: command("water", "botWater", { after: () => quest("tut_2", 1, "water") }),
    plant: command("plant", "botPlant", { after: (_result, _context, values) => {
      if (values[0] === "wheat") quest("tut_2", 1, "plant");
    } }),
    harvest: command("harvest", "botHarvest", {
      before: () => observe(robot.getHarvestChoice?.bind(robot)),
      after: (cropType, choice) => {
        if (typeof choice === "boolean") record("recordGreedyChoice", choice);
        if (cropType === "wheat") quest("tut_2", 1, "harvest");
        if (["wheat", "corn", "rice", "potato", "sugarcane", "tomato"].includes(cropType)) quest(`crop_${cropType}_1`);
      },
    }),
    destroy: command("destroy", "botDestroy", {
      before: () => observe(robot.isCurrentCropDead?.bind(robot)),
      after: (_result, wasDead) => { if (wasDead) quest("cs_cleanup_0"); },
    }),
    kill_bug: command("kill_bug", "botKillBug"),
    extinguish: command("extinguish", "botExtinguish"),
  };
  for (const [name, dx, dy] of [["left", -1, 0], ["right", 1, 0], ["up", 0, -1], ["down", 0, 1]]) {
    bot[name] = command(name, "botJump", {
      category: "bot_movement", action: "move",
      args: () => [robot.grid_x + dx, robot.grid_y + dy],
      before: () => ({ inLoop: !!robot.executingLoop, blockId: robot.currentBlockId, x: robot.grid_x + dx, y: robot.grid_y + dy }),
      after: (_result, context) => quest("tut_1", 1, context),
    });
  }
  for (const [name, method] of Object.entries({
    is_dead: "checkDead", is_tilled: "checkTilled", is_watered: "checkWatered",
    is_planted: "checkPlanted", is_harvestable: "isHarvestable", is_bug: "isBug", is_fire: "checkFire",
  })) bot[name] = command(name, method, { category: "bot_checks", check: true });

  function bounds(lower, upper, integer) {
    lower = Number(lower);
    upper = Number(upper);
    if (integer) { lower = Math.ceil(lower); upper = Math.floor(upper); }
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper || !Number.isFinite(upper - lower) ||
      (integer && (!Number.isSafeInteger(lower) || !Number.isSafeInteger(upper) || !Number.isSafeInteger(upper - lower + 1)))) {
      throw new Error("Random bounds must be finite numbers with lower <= upper and a valid range.");
    }
    quest("cs_random_0");
    return integer ? Math.floor(random() * (upper - lower + 1)) + lower : random() * (upper - lower) + lower;
  }
  const seeds = cropType => Object.hasOwn(inventory.crops ?? {}, cropType) ? inventory.crops[cropType] ?? 0 : 0;
  const coins = () => inventory.coins;
  return {
    bot,
    globals: {
      columns: native("globals", "columns", () => lastFarmSize = farmSize().columns, 0),
      rows: native("globals", "rows", () => lastFarmSize = farmSize().rows, 0),
      randint: native("globals", "randint", (lower, upper) => bounds(lower, upper, true), 0),
      randfloat: native("globals", "randfloat", (lower, upper) => bounds(lower, upper, false), 0),
    },
    inventory: { seed: seeds, seeds, coin: coins, coins },
    shop: {
      buy_seed: native("shop", "buy_seed", (type, amount) => shop.buyPlants(type, amount)),
      buy_row: native("shop", "buy_row", () => shop.buyLand("row")),
      buy_column: native("shop", "buy_column", () => shop.buyLand("column")),
      upgrade_bot_action: native("shop", "upgrade_bot_action", (index = robot.bot_index) => shop.buyUpgrade("action_speed", index)),
      upgrade_bot_move: native("shop", "upgrade_bot_move", (index = robot.bot_index) => shop.buyUpgrade("move_speed", index)),
      upgrade_bot_check: native("shop", "upgrade_bot_check", (index = robot.bot_index) => shop.buyUpgrade("check_speed", index)),
    },
    console: { log: (...values) => { try { return speak(values.map(String).join(" ")); } catch (error) { reportError(error); } } },
    hooks: {
      __highlightBlock: id => { robot.currentBlockId = id; },
      __trackLoop: type => { record("recordLoopExecution", type ? String(type) : "for"); quest("cs_loop_0"); },
      __trackIf: result => record("recordIfCondition", !!result),
    },
  };
}
