import { commandExample } from "./documentation.js";

const command = name => commandExample(name.startsWith("is_") ? "bot_checks" : name === "jump" ? "bot_movement" : "bot_farm_actions", name);
const chain = examples => {
  const nodes = examples.map(example => structuredClone(example.block));
  nodes.slice(0,-1).forEach((node,index) => node.next = {block:nodes[index+1]});
  return {block:nodes[0],code:examples.map(example=>example.code).join("\n")};
};
const sayValue = example => ({block:{type:"bot_say",inputs:{TEXT:{block:example.block}}},code:`bot.say(${example.code.replace(/;$/,"")});`});
const condition = (check, action) => ({block:{type:"controls_if",inputs:{IF0:{block:command(check).block},DO0:{block:command(action).block}}},code:`if (bot.${check}()) {\n  bot.${action}();\n}`});

export function missionHint(key, level = 0, actions = [], harvestReady = false) {
  if (key.startsWith("crop_")) {
    const crop=key.slice(5,-2);
    const plant={block:{type:"bot_plant",fields:{TYPE:crop}},code:`bot.plant("${crop}");`};
    return [command("till"),plant,command("water"),condition("is_harvestable","harvest")][Math.min(level,3)];
  }
  switch(key) {
    case "intro_run": return command("right");
    case "intro_build": return command("down");
    case "intro_say": return command("say");
    case "intro_sequence": return chain([command("left"),command("right")]);
    case "tut_2": return command(!actions.includes("till")?"till":!actions.includes("plant")?"plant":!actions.includes("water")||!harvestReady?"water":"harvest");
    case "intro_loop": return {block:{type:"controls_repeat_ext",inputs:{TIMES:{shadow:{type:"math_number",fields:{NUM:2}}},DO:{block:chain([command("left"),command("right")]).block}}},code:"for (var i = 0; i < 2; i++) {\n  bot.left();\n  bot.right();\n}"};
    case "cs_check_0": return sayValue(command("is_planted"));
    case "cs_if_0": return {block:{type:"controls_if",inputs:{
      IF0:{block:{type:"logic_negate",inputs:{BOOL:{block:command("is_planted").block}}}},
      DO0:{block:command("plant").block}}},
      code:'if (!bot.is_planted()) {\n  bot.plant("wheat");\n}'};
    case "cs_grid_0": return sayValue(commandExample("globals","rows"));
    case "cs_jump_0": return command("jump");
    case "cs_cleanup_0": return condition("is_dead","destroy");
    case "cs_wait_0": return command("wait");
    case "cs_random_0": return sayValue(commandExample("globals","randint"));
    case "shop_seed_0": return commandExample("shop","buy_seed");
    case "shop_land_0": return commandExample("shop",level%2?"buy_column":"buy_row");
    case "shop_upgrade_0": return commandExample("shop","upgrade_bot_move");
    default: throw Error(`Missing visual mission hint: ${key}`);
  }
}

export function recordMissionHint(tracker, key, editor, level, example) {
  tracker.recordHintShown(example.code,"requested_quest_hint",{mission:key,editor,level});
}
