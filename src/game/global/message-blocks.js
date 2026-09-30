export const MESSAGE_COMMANDS = ["send", "has_message", "receive"];

export function registerMessageBlocks(Blockly, generator) {
  for (const name of MESSAGE_COMMANDS) {
    const type = `bot_${name}`;
    if (!Blockly.Blocks[type]) Blockly.defineBlocksWithJsonArray([{
      type, message0: name === "send" ? "Send to Bot %1 message %2" : name === "has_message" ? "Is there a message?" : "Read next message",
      ...(name === "send" ? {
        args0:[{type:"input_value",name:"BOT",check:"Number"},{type:"input_value",name:"MESSAGE"}],
        previousStatement:null,nextStatement:null,
      } : {output:name === "has_message" ? "Boolean" : null}),
      colour:210, tooltip:name === "send" ? "Send a message to another bot on this farm."
        : name === "receive" ? "Take the oldest message from this bot's inbox. Empty text if there is none."
        : "Is a message waiting in this bot's inbox?",
    }]);
    generator.forBlock[type] = (block, gen) => name === "send"
      ? `bot.send(${gen.valueToCode(block,"BOT",0)||0}, ${gen.valueToCode(block,"MESSAGE",0)||'""'});\n`
      : [`bot.${name}()`, 2];
  }
}

export const messageToolbox = () => MESSAGE_COMMANDS.map(name => ({
  kind:"block",type:`bot_${name}`,
  ...(name === "send" ? {inputs:{BOT:{shadow:{type:"math_number",fields:{NUM:1}}},MESSAGE:{shadow:{type:"text",fields:{TEXT:"Ready!"}}}}} : {}),
}));
