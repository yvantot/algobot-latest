import { BLOCK_LABELS } from "../../blockly/labels.js";
import * as Blockly from "blockly";
import "blockly/blocks";
import { JavascriptGenerator, javascriptGenerator, Order } from "blockly/javascript";
import { registerInspectionBlocks, inspectionToolbox } from "../global/inspection-blocks.js";
import { registerMessageBlocks, messageToolbox, MESSAGE_COMMANDS } from "../global/message-blocks.js";

export function createChallengeWorkspace(element, task = {}) {
  const names = [...(task.commands ?? ["right","left","harvest","is_harvestable"]),"say","columns"];
  const definitions = names.filter(name=>!name.startsWith("crop_")&&!MESSAGE_COMMANDS.includes(name)).map(name => {
    const output = name.startsWith("is_") || name === "columns";
    const inputs = name==="jump"?["X","Y"]:["say","wait","plant"].includes(name)?["VALUE"]:[];
    return { type: `assessment_${name}`, message0: `${BLOCK_LABELS[name] ?? name.replaceAll("_", " ")}${inputs.map((_,i)=>` %${i+1}`).join("")}`,
      ...(inputs.length ? { args0: inputs.map(name=>({type:"input_value",name})) } : {}),
      ...(output ? { output: name === "columns" ? "Number" : "Boolean" } : { previousStatement: null, nextStatement: null }),
      colour: output ? 160 : 210, tooltip: name.replaceAll("_", " "), helpUrl: "" };
  });
  for (const definition of definitions) if (!Blockly.Blocks[definition.type]) Blockly.defineBlocksWithJsonArray([definition]);
  const generator = new JavascriptGenerator();
  Object.assign(generator.forBlock, javascriptGenerator.forBlock);
  registerInspectionBlocks(Blockly,generator);
  registerMessageBlocks(Blockly,generator);
  for(const name of names.filter(name=>!name.startsWith("crop_")&&!MESSAGE_COMMANDS.includes(name))) generator.forBlock[`assessment_${name}`]=(block,gen)=>{
    const inputs=name==="jump"?["X","Y"]:["say","wait","plant"].includes(name)?["VALUE"]:[];
    const args=inputs.map(key=>gen.valueToCode(block,key,Order.NONE)||(name==="plant"?'"corn"':name==="say"?'""':"1"));
    const code=name==="columns"?"columns()":`bot.${name}(${args.join(", ")})`;
    return name.startsWith("is_")||name==="columns"?[code,Order.FUNCTION_CALL]:code+";\n";
  };
  const block = type => ({ kind: "block", type });
  const workspace = Blockly.inject(element, {
    toolbox: { kind: "categoryToolbox", contents: [
      { kind: "category", name: "Bot", colour: 210, contents: definitions.map(d => ({...block(d.type),
        ...(d.type==="assessment_wait"?{inputs:{VALUE:{shadow:{type:"math_number",fields:{NUM:1}}}}}:{}),
        ...(d.type==="assessment_plant"?{inputs:{VALUE:{shadow:{type:"text",fields:{TEXT:"corn"}}}}}:{}),
        ...(d.type==="assessment_jump"?{inputs:{X:{shadow:{type:"math_number",fields:{NUM:0}}},Y:{shadow:{type:"math_number",fields:{NUM:0}}}}}:{}),
      })) },
      ...(names.some(name=>name.startsWith("crop_"))?[{kind:"category",name:"Crop readings",colour:160,contents:inspectionToolbox()}]:[]),
      ...(names.includes("send")?[{kind:"category",name:"Messages",colour:210,contents:messageToolbox()}]:[]),
      { kind: "category", name: "Loops", colour: 120, contents: [block("controls_repeat_ext"), block("controls_for"),block("controls_whileUntil")] },
      { kind: "category", name: "If", colour: 210, contents: [block("controls_if"), block("logic_compare"), block("logic_boolean"),block("logic_operation"),block("logic_negate")] },
      { kind: "category", name: "Math", colour: 230, contents: [block("math_number"), block("math_arithmetic"),...(task.kind?[block("math_single")]:[])] },
      { kind: "category", name: "Variables", colour: 330, custom: "VARIABLE" },
      { kind: "category", name: "Text", colour: 160, contents: [block("text")] },
    ] },
    media: "/blockly/media/", trashcan: true, scrollbars: true,
    zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 1.5, minScale: 0.5 },
    move: { scrollbars: true, drag: true, wheel: true },
  });
  return { workspace, source: () => generator.workspaceToCode(workspace), resize: () => Blockly.svgResize(workspace), dispose: () => workspace.dispose() };
}
