import { lessonAnswer, lessonFocus, lessonWhy } from "./quest-lessons.js";
import { QUEST_DATA } from "./quests.js";

export function diagnoseMission(context = {}) {
  const { blocks = [], code = "", seeds = {}, tile, x = 0, columns = Infinity, lastError = "" } = context;
  const floating = blocks.find(b => !b.parent && !b.type.startsWith("procedures_def") && blocks.filter(b => !b.parent && !b.type.startsWith("procedures_def")).length > 1);
  if (floating) return "A block is floating. Snap it under your other blocks.";
  const loops = blocks.filter(b => b.type.startsWith("controls_repeat") || b.type === "controls_for" || b.type === "controls_whileUntil");
  if (loops.some(b => !b.hasBody)) return "Your loop is empty. Move the action blocks inside.";
  const crop = code.match(/bot\.plant\(["']([^"']+)["']\)/)?.[1];
  if (crop && !(seeds[crop] > 0)) return "Buy " + crop + " seeds from Shop before planting.";
  if (crop && tile?.planted && !/is_planted|destroy|harvest/.test(code)) return "This tile has a crop. Move to an empty tile.";
  if (crop && tile && !tile.tilled && !/bot\.till/.test(code)) return "Add Prepare soil before Plant.";
  if (x >= columns - 1 && /bot\.right/.test(code)) return "Your robot is at the edge. Start on the left.";
  if (/crop type/i.test(lastError)) return 'Use a crop name, such as "wheat", with quotes.';
  if (/not defined/i.test(lastError)) return "Set your variable before using it. Check its spelling.";
  if (/loop condition|too many steps/i.test(lastError)) return "Change the value inside your loop so it can stop.";
  if (/out of bounds/i.test(lastError)) return "Move inside the farm. Row and column numbers start at 0.";
  if (/already tilled/i.test(lastError)) return "This soil is ready. Remove the extra Prepare soil block.";
  if (/not tilled|till the soil first/i.test(lastError)) return "Add Prepare soil before Plant or Water soil.";
  if (/already watered/i.test(lastError)) return "The soil is wet. Wait for it to dry.";
  if (/not fully grown/i.test(lastError)) return "Water the crop. Harvest when Is the crop ready? says true.";
  if (/crop is dead/i.test(lastError)) return "Use Remove crop to clear this spoiled crop.";
  if (/already planted/i.test(lastError)) return "Move to an empty tile before planting.";
  if (/insufficient resources/i.test(lastError)) return "Buy seeds from Shop before planting.";
  if (/locked/i.test(lastError)) return "Collect the earlier quest reward to unlock this command.";
  if (/no bug|no fire/i.test(lastError)) return "Check for trouble first. Put the action inside if.";
  if (/plant the soil first/i.test(lastError)) return "Plant a seed before using this action.";
  return "";
}

function incomplete(answer) {
  const result = structuredClone(answer);
  let missing = false;
  function removeSlot(block) {
    if (!block || missing) return;
    for (const name of ["DO0", "DO", "VALUE", "TEXT", "CROP", "RETURN"]) {
      if (block.inputs?.[name]) {
        delete block.inputs[name]; missing = true; return;
      }
    }
    if (block.next) { delete block.next; missing = true; }
  }
  removeSlot(result.block);
  if (result.blocks) {
    result.blocks = result.blocks.map(block => { removeSlot(block); return block; });
  }
  if (!missing) {
    result.block = { type: "bot_say" };
    delete result.blocks;
  }
  const lines = answer.code.split("\n");
  const at = Math.max(0, lines.findIndex(line => /bot\.(plant|water|harvest|say|right|down|destroy|wait|jump)|return /.test(line)));
  lines[at] = "// YOUR TURN: fill in this step.";
  result.code = lines.join("\n");
  result.changeLine = at + 1;
  return result;
}

export function missionHint(key, level = 0, actions = [], harvestReady = false, context = {}) {
  const answer = lessonAnswer(key, actions, harvestReady);
  const focus = lessonFocus(key);
  const stage = Math.max(0, Math.min(3, level));
  const diagnostic = diagnoseMission(context);
  const message = stage === 0 ? "Look in " + focus.category + "." :
    stage === 1 ? QUEST_DATA[key].tip :
    stage === 2 ? "Fill the empty slot. What step belongs there?" : "Build these steps, then press Start.";
  const content = stage < 2 ? { block: null, code: "// " + (diagnostic || message) } :
    stage === 2 ? incomplete(answer) : { ...answer, code: "// " + lessonWhy(key) + "\n" + answer.code };
  return { ...content, ...focus, level: stage, message, diagnostic, why: stage === 3 ? lessonWhy(key) : null };
}

export function recordMissionHint(tracker, key, editor, level, example) {
  tracker.recordHintShown(example.code, "requested_quest_hint", { mission: key, editor, level: Math.min(level, 3) });
}
