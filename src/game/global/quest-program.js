export const PROGRAM_QUESTS = new Set([
  "farm_two_0", "loop_row_0", "loop_water_0", "crop_wheat_1", "if_ready_0",
  "if_else_0", "if_row_0", "cs_cleanup_0", "loop_size_0", "var_set_0",
  "var_change_0", "var_harvest_0", "var_crop_0", "logic_compare_0", "logic_and_0",
  "cs_random_0", "cs_jump_0", "cs_wait_0", "for_count_0", "loop_farm_0",
  "fn_define_0", "fn_reuse_0", "fn_param_0", "fn_return_0", "list_crops_0",
  "hazard_bug_0", "hazard_fire_0",
]);
const loop = node => ["ForStatement", "WhileStatement", "DoWhileStatement", "ForInStatement"].includes(node?.type);
// The bundled interpreter minifies several ESTree field names. Keep its AST
// untouched, and share normalized node identities between execution frames.
export function normalizeQuestNode(node, cache) {
  if (!node || typeof node !== "object") return node;
  if (cache.has(node)) return cache.get(node);
  if (Array.isArray(node)) return node.map(child => normalizeQuestNode(child, cache));
  const aliases = { Ya:"property", fb:"computed", za:"init", J:"argument", sa:"params", ia:"declarations", pa:"expression", fa:"consequent" };
  const result = {};
  cache.set(node, result);
  for (const [key, value] of Object.entries(node)) {
    if (["O", "lb"].includes(key)) continue;
    result[aliases[key] ?? key] = normalizeQuestNode(value, cache);
  }
  return result;
}
export function contains(node, predicate) {
  if (!node || typeof node !== "object") return false;
  if (predicate(node)) return true;
  return Object.values(node).some(value => Array.isArray(value)
    ? value.some(child => contains(child, predicate)) : contains(value, predicate));
}
const callName = node => node?.type === "CallExpression"
  ? node.callee?.type === "Identifier" ? node.callee.name
    : node.callee?.object?.name + "." + node.callee?.property?.name : "";
const calls = (node, name) => contains(node, child => callName(child) === name);
const identifier = node => node?.type === "Identifier";
const inLoop = event => event.stack.some(loop);
const nested = event => event.stack.filter(loop).length >= 2;
const tileCount = events => new Set(events.map(e => e.x + "," + e.y)).size;
const sameTile = (a, b) => a.x === b.x && a.y === b.y;
const conditional = (event, sensor) => event.stack.some(node => node.type === "IfStatement" && calls(node.test, "bot." + sensor));

// Capture at dispatch: async callbacks can arrive after Stop or a new run.
export function captureQuestAction(robot, name, args) {
  const trace = robot.questTrace;
  if (!trace?.active) return () => {};
  const stack = trace.stack.slice();
  const event = { name, args: [...args], stack, x: robot.grid_x, y: robot.grid_y,
    call: [...stack].reverse().find(node => callName(node) === name) };
  return result => {
    if (!trace.active || robot.questTrace !== trace || trace.events.length >= 10000) return;
    trace.events.push({ ...event, result });
  };
}

export function completedProgramQuests(trace) {
  if (!trace) return [];
  const events = trace.events;
  const successful = name => events.filter(e => e.name === "bot." + name && e.result !== false);
  const plants = successful("plant"), water = successful("water"), harvest = successful("harvest");
  const says = successful("say");
  const reading = (event, sensor) => events.slice(0, events.indexOf(event)).findLast(e =>
    e.name === "bot." + sensor && sameTile(e, event));
  const checked = (event, sensor) => conditional(event, sensor) && reading(event, sensor)?.result === true;
  const size = trace.size ?? { columns: 3, rows: 3 };
  const executed = [...trace.executed];
  const assigned = (name, value) => executed.some(n =>
    (n.type === "VariableDeclaration" && n.declarations.some(d => d.id?.name === name && d.init?.value === value)) ||
    (n.type === "VariableDeclarator" && n.id?.name === name && n.init?.value === value) ||
    (n.type === "AssignmentExpression" && n.left?.name === name && n.right?.value === value));
  const saysVariable = (value, initial) => says.some(e => identifier(e.call?.arguments[0]) &&
    e.args[0] === value && (initial === undefined || assigned(e.call.arguments[0].name, initial)));
  const increments = (name, requireLoop = true) => trace.updates.filter(e => (!requireLoop || inLoop(e)) &&
    ((e.node.type === "UpdateExpression" && e.node.argument?.name === name && e.node.operator === "++") ||
    (e.node.type === "AssignmentExpression" && e.node.left?.name === name &&
      (e.node.operator === "+=" && e.node.right?.value === 1 ||
       e.node.operator === "=" && e.node.right?.operator === "+" && e.node.right.right?.value === 1 &&
       contains(e.node.right.left, n => n.type === "Identifier" && n.name === name)))));
  const counter = (value, requireHarvest = false) => says.some(e => {
    const name = e.call?.arguments[0]?.name;
    const changes = increments(name, !requireHarvest);
    return name && e.args[0] === value && assigned(name, 0) && changes.length >= value &&
      (!requireHarvest || harvest.length === value && changes.filter(change =>
        conditional(change, "is_harvestable") && harvest.some(h => sameTile(h, change))).length === value);
  });
  const row = (actions, count = 3) => tileCount(actions) >= count &&
    tileCount(actions.filter(inLoop)) >= Math.min(2, count) &&
    actions.every(e => e.y === actions[0].y);
  const usesColumns = (node, seen = new Set()) => calls(node, "columns") || contains(node, child => {
    if (!identifier(child) || seen.has(child.name)) return false;
    seen.add(child.name);
    return executed.some(n => n.type === "VariableDeclaration" && n.declarations.some(d =>
      d.id.name === child.name && usesColumns(d.init, seen)));
  });
  const dimensionLoop = actions => actions.some(e => e.stack.some(n => loop(n) && usesColumns(n.test)));
  const functionNames = new Set(executed.filter(n => n.type === "FunctionDeclaration").map(n => n.id.name));
  const userCall = event => event.stack.find(n => n.type === "CallExpression" && functionNames.has(callName(n)));
  const care = plants.filter(p => userCall(p) && ["till", "water"].every(name =>
    successful(name).some(e => sameTile(e, p) && userCall(e) === userCall(p))));
  const jump = successful("jump").filter(e => inLoop(e) && identifier(e.call?.arguments[0]));
  const allTiles = actions => size.columns > 0 && size.rows > 0 && tileCount(actions.filter(nested)) >= size.columns * size.rows;
  const awards = [];
  const award = (key, done, amount = 1) => { if (done) awards.push([key, amount]); };
  award("farm_two_0", tileCount(plants.filter(e => e.args[0] === "wheat" && !inLoop(e))) >= 2, 2);
  award("loop_row_0", row(plants.filter(e => e.args[0] === "wheat")), 3);
  award("loop_water_0", row(water), 3);
  award("crop_wheat_1", row(harvest.filter(e => e.result === "wheat")), 3);
  award("if_ready_0", harvest.some(e => checked(e, "is_harvestable")));
  award("if_else_0", harvest.some(e => checked(e, "is_harvestable") &&
    e.stack.some(n => n.type === "IfStatement" && n.alternate)) &&
    water.some(e => conditional(e, "is_harvestable") &&
      e.stack.some(n => n.type === "IfStatement" && n.alternate && contains(n.alternate, child => child === e.call))), 2);
  award("if_row_0", row(harvest.filter(e => checked(e, "is_harvestable"))), 3);
  award("cs_cleanup_0", successful("destroy").some(e => checked(e, "is_dead")));
  award("loop_size_0", row(water, size.columns) && dimensionLoop(water));
  award("var_set_0", saysVariable(0, 0));
  award("var_change_0", counter(3));
  award("var_harvest_0", counter(3, true) && row(harvest));
  award("var_crop_0", plants.some(e => e.args[0] === "corn" && identifier(e.call?.arguments[0]) &&
    assigned(e.call.arguments[0].name, "corn")));
  const seedCount = node => ["inventory.seed", "inventory.seeds"].includes(callName(node));
  award("logic_compare_0", plants.some(e => e.args[0] === "wheat" && e.stack.some(n => n.type === "IfStatement" &&
    contains(n.test, child => child.type === "BinaryExpression" &&
      (child.operator === ">" && seedCount(child.left) && child.right?.value === 0 ||
       child.operator === "<" && seedCount(child.right) && child.left?.value === 0)))));
  award("logic_and_0", plants.some(e => e.stack.some(n => n.type === "IfStatement" &&
    contains(n.test, child => child.type === "LogicalExpression" && child.operator === "&&") &&
    calls(n.test, "bot.is_tilled") && calls(n.test, "bot.is_planted")) &&
    reading(e, "is_tilled")?.result === true && reading(e, "is_planted")?.result === false));
  award("cs_random_0", plants.some(e => {
    const choice = events.slice(0, events.indexOf(e)).findLast(read => read.name === "randint");
    return choice?.args[0] === 1 && choice.args[1] === 2 &&
      e.args[0] === (choice.result === 1 ? "wheat" : "corn") &&
      e.stack.some(n => n.type === "IfStatement" && n.alternate && calls(n.test, "randint"));
  }));
  award("cs_jump_0", [0, 1, 2].every(x => jump.some(e => e.args[0] === x)));
  award("cs_wait_0", successful("wait").some(e => e.args[0] === 1 &&
    e.stack.some(n => n.type === "WhileStatement" && calls(n.test, "bot.is_harvestable"))) &&
    events.some(e => e.name === "bot.is_harvestable" && e.result === true));
  award("for_count_0", size.columns > 0 && new Set(jump.filter(e => e.stack.some(n => n.type === "ForStatement")).map(e => e.args[0])).size >= size.columns && dimensionLoop(jump));
  award("loop_farm_0", allTiles(water));
  award("fn_define_0", care.length > 0);
  award("fn_reuse_0", allTiles(care));
  award("fn_param_0", row(plants.filter(e => e.args[0] === "corn" && identifier(e.call?.arguments[0]) &&
    executed.some(n => n.type === "FunctionDeclaration" && n.params.some(p => p.name === e.call.arguments[0].name) &&
      contains(n.body, child => child === e.call)))));
  award("fn_return_0", says.some(e => typeof e.args[0] === "boolean" &&
    functionNames.has(callName(e.call?.arguments[0]))) &&
    executed.some(n => n.type === "ReturnStatement" && calls(n.argument, "bot.is_planted")));
  award("list_crops_0", ["wheat", "corn", "rice"].every((crop, i) => plants[i]?.args[0] === crop) &&
    tileCount(plants) >= 3 && plants.every(e => contains(e.call?.arguments[0], n => n.type === "MemberExpression" && n.computed)) &&
    executed.some(n => n.type === "ArrayExpression"));
  for (const [key, sensor, action] of [["hazard_bug_0", "is_bug", "kill_bug"], ["hazard_fire_0", "is_fire", "extinguish"]]) {
    award(key, successful(action).some(e => checked(e, sensor)) &&
      allTiles(events.filter(e => e.name === "bot." + sensor)));
  }
  return awards;
}
