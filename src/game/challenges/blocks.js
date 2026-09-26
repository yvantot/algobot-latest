import { challengeCommands } from "./modes.js";
import { BLOCK_LABELS } from "../../blockly/labels.js";
import * as Blockly from "blockly";
import "blockly/blocks";
import { JavascriptGenerator, javascriptGenerator, Order } from "blockly/javascript";
import { registerInspectionBlocks, inspectionToolbox } from "../global/inspection-blocks.js";
import { registerMessageBlocks, messageToolbox, MESSAGE_COMMANDS } from "../global/message-blocks.js";

export function createChallengeWorkspace(element, task = {}) {
  const names = [...new Set([...challengeCommands(task),...(task.practice?[]:["say","columns","rows"]),...(task.randomLesson?["randint"]:[])])];
  const definitions = names.filter(name=>!name.startsWith("crop_")&&!MESSAGE_COMMANDS.includes(name)).map(name => {
    const output = name.startsWith("is_") || ["columns","rows","randint"].includes(name);
    const inputs = name==="randint"?["MIN","MAX"]:name==="jump"?["X","Y"]:["say","wait","plant"].includes(name)?["VALUE"]:[];
    return { type: `assessment_${name}`, message0: `${BLOCK_LABELS[name] ?? name.replaceAll("_", " ")}${inputs.map((_,i)=>` %${i+1}`).join("")}`,
      ...(inputs.length ? { args0: inputs.map(name=>({type:"input_value",name})) } : {}),
      ...(output ? { output: ["columns","rows","randint"].includes(name) ? "Number" : "Boolean" } : { previousStatement: null, nextStatement: null }),
      colour: output ? 160 : 210, tooltip: name.replaceAll("_", " "), helpUrl: "" };
  });
  for (const definition of definitions) if (!Blockly.Blocks[definition.type]) Blockly.defineBlocksWithJsonArray([definition]);
  const generator = new JavascriptGenerator();
  Object.assign(generator.forBlock, javascriptGenerator.forBlock);
  registerInspectionBlocks(Blockly,generator);
  registerMessageBlocks(Blockly,generator);
  for(const name of names.filter(name=>!name.startsWith("crop_")&&!MESSAGE_COMMANDS.includes(name))) generator.forBlock[`assessment_${name}`]=(block,gen)=>{
    const inputs=name==="randint"?["MIN","MAX"]:name==="jump"?["X","Y"]:["say","wait","plant"].includes(name)?["VALUE"]:[];
    const args=inputs.map(key=>gen.valueToCode(block,key,Order.NONE)||(name==="plant"?'"corn"':name==="say"?'""':"1"));
    const code=["columns","rows","randint"].includes(name)?`${name}(${args.join(", ")})`:`bot.${name}(${args.join(", ")})`;
    return name.startsWith("is_")||["columns","rows","randint"].includes(name)?[code,Order.FUNCTION_CALL]:code+";\n";
  };
  const block = type => ({ kind: "block", type,
    ...(type === "controls_repeat_ext" ? {inputs:{TIMES:{shadow:{type:"math_number",fields:{NUM:2}}}}} : {}),
    ...(type === "controls_repeat" ? {fields:{TIMES:2}} : {}),
  });
  const all = prefix => Object.keys(Blockly.Blocks).filter(type=>type.startsWith(prefix) && generator.forBlock[type]).map(block);
  const workspace = Blockly.inject(element, {
    toolbox: { kind: "categoryToolbox", contents: [
      { kind: "category", name: "Bot", colour: 210, contents: definitions.map(d => ({...block(d.type),
        ...(d.type==="assessment_randint"?{inputs:{MIN:{shadow:{type:"math_number",fields:{NUM:1}}},MAX:{shadow:{type:"math_number",fields:{NUM:10}}}}}:{}),
        ...(d.type==="assessment_wait"?{inputs:{VALUE:{shadow:{type:"math_number",fields:{NUM:1}}}}}:{}),
        ...(d.type==="assessment_plant"?{inputs:{VALUE:{shadow:{type:"text",fields:{TEXT:task.defaultCrop ?? "corn"}}}}}:{}),
        ...(d.type==="assessment_jump"?{inputs:{X:{shadow:{type:"math_number",fields:{NUM:0}}},Y:{shadow:{type:"math_number",fields:{NUM:0}}}}}:{}),
      })) },
      ...(names.some(name=>name.startsWith("crop_"))?[{kind:"category",name:"Crop readings",colour:160,contents:inspectionToolbox()}]:[]),
      ...(names.includes("send")?[{kind:"category",name:"Messages",colour:210,contents:messageToolbox()}]:[]),
      { kind: "category", name: "Loops", colour: 120, contents: task.playMode === "freestyle" ? all("controls_").filter(item=>!item.type.startsWith("controls_if")) : [block("controls_repeat_ext"), block("controls_for"),block("controls_whileUntil")] },
      { kind: "category", name: "If", colour: 210, contents: task.playMode === "freestyle" ? [block("controls_if"),...all("logic_")] : [block("controls_if"), block("logic_compare"), block("logic_boolean"),block("logic_operation"),block("logic_negate")] },
      { kind: "category", name: "Math", colour: 230, contents: task.playMode === "freestyle" ? all("math_").filter(item=>!["math_randint","math_randfloat"].includes(item.type)) : [block("math_number"), block("math_arithmetic"),...(task.kind?[block("math_single")]:[])] },
      ...(task.playMode === "freestyle" ? [{kind:"category",name:"Lists",colour:260,contents:all("lists_")},{kind:"category",name:"Functions",colour:290,custom:"PROCEDURE"}] : []),
      { kind: "category", name: "Variables", colour: 330, custom: "VARIABLE" },
      { kind: "category", name: "Text", colour: 160, contents: task.playMode === "freestyle" ? all("text").filter(item=>! ["text_print","text_prompt_ext","text_prompt"].includes(item.type)) : [block("text")] },
    ].filter(category=>!task.categories || task.categories.includes(category.name)) },
    media: "/blockly/media/", trashcan: true, scrollbars: true,
    zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 1.5, minScale: 0.5 },
    move: { scrollbars: true, drag: true, wheel: true },
  });
  return { workspace, source: () => generator.workspaceToCode(workspace), resize: () => Blockly.svgResize(workspace), dispose: () => workspace.dispose() };
}
