import * as Blockly from "blockly";
import "blockly/blocks";
import { JavascriptGenerator, javascriptGenerator, Order } from "blockly/javascript";

export function createChallengeWorkspace(element) {
  const definitions = ["right", "left", "harvest", "say", "is_harvestable", "columns"].map(name => {
    const output = name === "is_harvestable" || name === "columns";
    return { type: `assessment_${name}`, message0: name === "say" ? "bot.say %1" : name === "columns" ? "columns()" : `bot.${name}()`,
      ...(name === "say" ? { args0: [{ type: "input_value", name: "VALUE" }] } : {}),
      ...(output ? { output: name === "columns" ? "Number" : "Boolean" } : { previousStatement: null, nextStatement: null }),
      colour: output ? 160 : 210, tooltip: name.replaceAll("_", " "), helpUrl: "" };
  });
  for (const definition of definitions) if (!Blockly.Blocks[definition.type]) Blockly.defineBlocksWithJsonArray([definition]);
  const generator = new JavascriptGenerator();
  Object.assign(generator.forBlock, javascriptGenerator.forBlock);
  for (const name of ["right", "left", "harvest"]) generator.forBlock[`assessment_${name}`] = () => `bot.${name}();\n`;
  generator.forBlock.assessment_say = (block, gen) => `bot.say(${gen.valueToCode(block, "VALUE", Order.NONE) || '""'});\n`;
  generator.forBlock.assessment_is_harvestable = () => ["bot.is_harvestable()", Order.FUNCTION_CALL];
  generator.forBlock.assessment_columns = () => ["columns()", Order.FUNCTION_CALL];
  const block = type => ({ kind: "block", type });
  const workspace = Blockly.inject(element, {
    toolbox: { kind: "categoryToolbox", contents: [
      { kind: "category", name: "Bot", colour: 210, contents: definitions.map(d => block(d.type)) },
      { kind: "category", name: "Loops", colour: 120, contents: [block("controls_repeat_ext"), block("controls_for")] },
      { kind: "category", name: "If", colour: 210, contents: [block("controls_if"), block("logic_compare"), block("logic_boolean")] },
      { kind: "category", name: "Math", colour: 230, contents: [block("math_number"), block("math_arithmetic")] },
      { kind: "category", name: "Variables", colour: 330, custom: "VARIABLE" },
      { kind: "category", name: "Text", colour: 160, contents: [block("text")] },
    ] },
    media: "/blockly/media/", trashcan: true, scrollbars: true,
    zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 1.5, minScale: 0.5 },
    move: { scrollbars: true, drag: true, wheel: true },
  });
  return { workspace, source: () => generator.workspaceToCode(workspace), resize: () => Blockly.svgResize(workspace), dispose: () => workspace.dispose() };
}
