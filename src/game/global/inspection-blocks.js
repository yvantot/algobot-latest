import { CROP_READINGS } from "./crop-inspection.js";

export function registerInspectionBlocks(Blockly, generator) {
  for (const name of CROP_READINGS) {
    const type = `bot_${name}`;
    if (!Blockly.Blocks[type]) Blockly.defineBlocksWithJsonArray([{
      type, message0: `bot.${name} column %1 row %2`,
      args0: [{type:"input_value",name:"X",check:"Number"},{type:"input_value",name:"Y",check:"Number"}],
      inputsInline:true, output:name === "crop_type" ? "String" : "Number", colour:160,
      tooltip:name === "crop_value" ? "Current coin value if ready; 0 otherwise."
        : name === "crop_time_left" ? "Seconds until spoilage if ready; -1 otherwise." : "Crop name; empty text if no living crop.",
    }]);
    generator.forBlock[type] = (block, gen) => [`bot.${name}(${gen.valueToCode(block,"X",0)||0}, ${gen.valueToCode(block,"Y",0)||0})`, 2];
  }
}

export const inspectionToolbox = () => CROP_READINGS.map(name => ({
  kind:"block", type:`bot_${name}`,
  inputs:{
    X:{shadow:{type:"math_number",fields:{NUM:0}}},
    Y:{shadow:{type:"math_number",fields:{NUM:0}}},
  },
}));
