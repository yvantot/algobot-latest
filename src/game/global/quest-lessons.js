import { commandExample } from "./documentation.js";

const value = (type, fields, code) => ({ block: { type, fields }, code });
const number = n => value("math_number", { NUM: n }, String(n));
const text = s => value("text", { TEXT: s }, JSON.stringify(s));
const variable = name => value("variables_get", { VAR: { name } }, name);
const input = item => ({ block: structuredClone(item.block) });
const cmd = name => commandExample(name.startsWith("is_") ? "bot_checks" : ["left", "right", "down", "up", "jump"].includes(name) ? "bot_movement" : "bot_farm_actions", name);
const global = name => commandExample("globals", name);
const chain = (...items) => {
  const blocks = items.map(item => structuredClone(item.block));
  blocks.slice(0, -1).forEach((block, i) => {
    let tail = block;
    while (tail.next?.block) tail = tail.next.block;
    tail.next = { block: blocks[i + 1] };
  });
  return { block: blocks[0], code: items.map(item => item.code).join("\n") };
};
const expression = (type, fields, inputs, code) => ({ block: { type, fields, inputs: Object.fromEntries(Object.entries(inputs).map(([key, item]) => [key, input(item)])) }, code });
const say = item => expression("bot_say", {}, { TEXT: item }, "bot.say(" + item.code + ");");
const plant = crop => typeof crop === "string"
  ? value("bot_plant", { TYPE: crop }, 'bot.plant("' + crop + '");')
  : expression("bot_plant_value", {}, { CROP: crop }, "bot.plant(" + crop.code + ");");
const set = (name, item) => expression("variables_set", { VAR: { name } }, { VALUE: item }, "var " + name + " = " + item.code + ";");
const change = name => expression("math_change", { VAR: { name } }, { DELTA: number(1) }, name + " += 1;");
const not = item => expression("logic_negate", {}, { BOOL: item }, "!(" + item.code + ")");
const minus = (a, b) => expression("math_arithmetic", { OP: "MINUS" }, { A: a, B: b }, "(" + a.code + " - " + b.code + ")");
const compare = (a, b, op = "GT") => expression("logic_compare", { OP: op }, { A: a, B: b }, a.code + (op === "EQ" ? " === " : " > ") + b.code);
const indent = code => code.split("\n").map(line => "  " + line).join("\n");
const iff = (condition, yes, no) => {
  const result = expression("controls_if", {}, { IF0: condition, DO0: yes, ...(no ? { ELSE: no } : {}) },
    "if (" + condition.code + ") {\n" + indent(yes.code) + "\n}" + (no ? " else {\n" + indent(no.code) + "\n}" : ""));
  if (no) result.block.extraState = { hasElse: true };
  return result;
};
const repeat = (times, body) => expression("controls_repeat_ext", {}, { TIMES: times, DO: body },
  "for (var repeatIndex = 0; repeatIndex < " + times.code + "; repeatIndex++) {\n" + indent(body.code) + "\n}");
const count = (name, end, body) => expression("controls_for", { VAR: { name } }, { FROM: number(0), TO: end, BY: number(1), DO: body },
  "for (var " + name + " = 0; " + name + " <= " + end.code + "; " + name + "++) {\n" + indent(body.code) + "\n}");
const jump = (x, y = number(0)) => expression("bot_jump", {}, { X: x, Y: y }, "bot.jump(" + x.code + ", " + y.code + ");");
// Put the final action after repeat so Move right never leaves the farm.
const row = (action, width = number(3)) => chain(
  repeat(width.block.type === "math_number" ? number(width.block.fields.NUM - 1) : minus(width, number(1)),
    chain(action, cmd("right"))), action);
const wholeFarm = action => count("y", minus(global("rows"), number(1)),
  count("x", minus(global("columns"), number(1)), chain(jump(variable("x"), variable("y")), action)));
const care = () => chain(cmd("till"), plant("wheat"), cmd("water"));
const define = (name, body, params = [], returns = null) => ({
  block: { type: returns ? "procedures_defreturn" : "procedures_defnoreturn", fields: { NAME: name },
    extraState: { params: params.map(name => ({ name })) },
    inputs: { ...(body ? { STACK: input(body) } : {}), ...(returns ? { RETURN: input(returns) } : {}) } },
  code: "function " + name + "(" + params.join(", ") + ") {\n" + (body ? indent(body.code) + "\n" : "") +
    (returns ? "  return " + returns.code + ";\n" : "") + "}",
});
const call = (name, args = [], returns = false) => ({
  block: { type: returns ? "procedures_callreturn" : "procedures_callnoreturn",
    extraState: { name, ...(args.length ? { params: ["crop"] } : {}) },
    inputs: Object.fromEntries(args.map((item, i) => ["ARG" + i, input(item)])) },
  code: name + "(" + args.map(item => item.code).join(", ") + ")" + (returns ? "" : ";"),
});
const program = (definition, body) => ({ ...body, blocks: [definition.block, body.block], code: definition.code + "\n" + body.code });
const readyHarvest = () => iff(cmd("is_harvestable"), cmd("harvest"));

export function lessonAnswer(key, actions = [], harvestReady = false) {
  switch (key) {
    case "intro_run": return cmd("right");
    case "intro_build": return cmd("down");
    case "intro_say": return cmd("say");
    case "intro_sequence": return chain(cmd("left"), cmd("right"));
    case "tut_2": return cmd(!actions.includes("till") ? "till" : !actions.includes("plant") ? "plant" : !actions.includes("water") || !harvestReady ? "water" : "harvest");
    case "shop_seed_0": return commandExample("shop", "buy_seed");
    case "farm_two_0": return chain(cmd("till"), plant("wheat"), cmd("right"), cmd("till"), plant("wheat"));
    case "intro_loop": return repeat(number(2), chain(cmd("left"), cmd("right")));
    case "loop_row_0": return row(chain(cmd("till"), plant("wheat")));
    case "loop_water_0": return row(cmd("water"));
    case "crop_wheat_1": return row(cmd("harvest"));
    case "cs_check_0": return say(cmd("is_planted"));
    case "if_ready_0": return readyHarvest();
    case "cs_if_0": return iff(not(cmd("is_planted")), plant("wheat"));
    case "if_else_0": {
      const choice = iff(cmd("is_harvestable"), cmd("harvest"), cmd("water"));
      return chain(choice, cmd("right"), choice);
    }
    case "if_row_0": return row(readyHarvest());
    case "cs_cleanup_0": return iff(cmd("is_dead"), cmd("destroy"));
    case "cs_grid_0": return say(global("rows"));
    case "shop_land_0": return commandExample("shop", "buy_column");
    case "loop_size_0": return row(cmd("water"), global("columns"));
    case "shop_upgrade_0": return commandExample("shop", "upgrade_bot_move");
    case "var_set_0": return chain(set("count", number(0)), say(variable("count")));
    case "var_change_0": return chain(set("count", number(0)), repeat(number(3), change("count")), say(variable("count")));
    case "var_harvest_0": return chain(set("harvested", number(0)), row(iff(cmd("is_harvestable"), chain(cmd("harvest"), change("harvested")))), say(variable("harvested")));
    case "var_crop_0": return chain(set("crop", text("corn")), plant(variable("crop")));
    case "logic_compare_0": return iff(compare(commandExample("inventory", "seed"), number(0)), plant("wheat"));
    case "logic_and_0": return iff(expression("logic_operation", { OP: "AND" }, { A: cmd("is_tilled"), B: not(cmd("is_planted")) },
      "bot.is_tilled() && !bot.is_planted()"), plant("wheat"));
    case "cs_random_0": return iff(compare(value("math_randint", { LOWER: 1, UPPER: 2 }, "randint(1, 2)"), number(1), "EQ"), plant("wheat"), plant("corn"));
    case "cs_jump_0": return chain(set("count", number(0)), repeat(number(3), chain(jump(variable("count")), change("count"))));
    case "cs_wait_0": return expression("controls_whileUntil", { MODE: "WHILE" },
      { BOOL: not(cmd("is_harvestable")), DO: cmd("wait") }, "while (!bot.is_harvestable()) {\n  bot.wait(1);\n}");
    case "for_count_0": return count("i", minus(global("columns"), number(1)), jump(variable("i")));
    case "loop_farm_0": return wholeFarm(cmd("water"));
    case "fn_define_0": return program(define("care_for_tile", care()), call("care_for_tile"));
    case "fn_reuse_0": return program(define("care_for_tile", care()), wholeFarm(call("care_for_tile")));
    case "fn_param_0": return program(define("plant_row", row(chain(cmd("till"), plant(variable("crop"))), global("columns")), ["crop"]), call("plant_row", [text("corn")]));
    case "fn_return_0": return program(define("is_empty_tile", null, [], not(cmd("is_planted"))), say(call("is_empty_tile", [], true)));
    case "list_crops_0": {
      const list = expression("lists_create_with", {}, { ADD0: text("wheat"), ADD1: text("corn"), ADD2: text("rice") }, '["wheat", "corn", "rice"]');
      list.block.extraState = { itemCount: 3 };
      const item = expression("lists_getIndex", { MODE: "GET", WHERE: "FROM_START" },
        { VALUE: variable("crops"), AT: expression("math_arithmetic", { OP: "ADD" }, { A: variable("i"), B: number(1) }, "i + 1") }, "crops[i]");
      return chain(set("crops", list), count("i", number(2), chain(jump(variable("i")), cmd("till"), plant(item))));
    }
    case "hazard_bug_0": return wholeFarm(iff(cmd("is_bug"), cmd("kill_bug")));
    case "hazard_fire_0": return wholeFarm(iff(cmd("is_fire"), cmd("extinguish")));
    default:
      if (key.startsWith("crop_")) return chain(cmd("till"), plant(key.slice(5, -2)), cmd("water"));
      throw Error("Missing lesson answer: " + key);
  }
}

export function lessonFocus(key) {
  if (key.startsWith("shop_")) return { category: "Shop", blockType: key === "shop_seed_0" ? "shop_buy_seed" : key === "shop_land_0" ? "shop_buy_column" : "shop_upgrade_bot_move" };
  if (key.startsWith("fn_")) return { category: "Functions", blockType: key === "fn_return_0" ? "procedures_defreturn" : "procedures_defnoreturn" };
  if (key.startsWith("var_") || key === "cs_jump_0") return { category: "Variables", blockType: key === "var_change_0" ? "math_change" : "variables_set" };
  if (key === "list_crops_0") return { category: "Arrays", blockType: "lists_create_with" };
  if (key === "cs_grid_0" || key === "cs_random_0") return { category: "Math", blockType: key === "cs_grid_0" ? "global_rows" : "math_randint" };
  if (["cs_check_0", "cs_cleanup_0", "hazard_bug_0", "hazard_fire_0"].includes(key)) return { category: "Check",
    blockType: { cs_check_0: "bot_check_planted", cs_cleanup_0: "bot_is_dead", hazard_bug_0: "bot_is_bug", hazard_fire_0: "bot_is_fire" }[key] };
  if (key.startsWith("if_") || key === "cs_if_0" || key.startsWith("logic_")) return { category: "Logic",
    blockType: key === "logic_and_0" ? "logic_operation" : key === "logic_compare_0" ? "logic_compare" : key === "cs_if_0" ? "logic_negate" : "controls_if" };
  if (key.includes("loop") || ["for_count_0", "cs_wait_0", "crop_wheat_1"].includes(key)) return { category: "Loops",
    blockType: key === "cs_wait_0" ? "controls_whileUntil" : key === "for_count_0" || key === "loop_farm_0" ? "controls_for" : "controls_repeat_ext" };
  if (key === "farm_two_0" || key === "tut_2" || key.startsWith("crop_")) return { category: "Farm", blockType: "bot_plant" };
  return { category: "Bot", blockType: key === "intro_say" ? "bot_say" : key === "intro_build" ? "bot_down" : "bot_right" };
}

export function lessonWhy(key) {
  if (key.startsWith("fn_")) return "A function gives reusable steps a name.";
  if (key.startsWith("var_")) return "A variable remembers a value for later steps.";
  if (key === "cs_wait_0") return "while checks again before each repeat.";
  if (key === "list_crops_0") return "Lists keep values in order. Blockly starts at 1; JavaScript starts at 0.";
  if (key === "logic_and_0") return "and needs both answers to be true. or needs only one.";
  if (["loop_row_0", "loop_water_0", "crop_wheat_1", "loop_size_0", "if_row_0", "var_harvest_0"].includes(key))
    return "Repeat the first tiles. Handle the last without moving off-farm.";
  if (key.startsWith("if_") || key.startsWith("logic_") || key === "cs_if_0") return "if runs its inside blocks when the answer is true.";
  return "Connected blocks run in order, from top to bottom.";
}
