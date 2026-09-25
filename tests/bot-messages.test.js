import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as Blockly from "blockly";
import "blockly/blocks";
import { javascriptGenerator } from "blockly/javascript";
import { joinBotInbox } from "../src/game/global/bot-messages.js";
import { createCommandAPI } from "../src/game/global/command-api.js";
import { createInterpreterInit } from "../src/game/global/interpreter-bindings.js";
import { registerMessageBlocks } from "../src/game/global/message-blocks.js";

test("inboxes preserve order, false and zero; isolate farms and remove departed bots", () => {
  const farm=new Map(), a=joinBotInbox(farm,0), b=joinBotInbox(farm,1), other=joinBotInbox(new Map(),1);
  for (const value of [false,0,"ready"]) a.send(1,value);
  assert.equal(other.hasMessage(),false);
  assert.equal(b.hasMessage(),true);
  assert.deepEqual([b.receive(),b.receive(),b.receive(),b.receive()],[false,0,"ready",""]);
  assert.throws(()=>a.send(1,{}),/text/);
  assert.throws(()=>a.send(1,Infinity),/finite/);
  for(let i=0;i<32;i++)a.send(1,i);
  assert.throws(()=>a.send(1,"overflow"),/full/);
  b.leave(); assert.throws(()=>a.send(1,"gone"),/not on/);
  assert.equal(joinBotInbox(farm,1).hasMessage(),false);
});

test("main-game API and Blockly messages cross separate interpreter instances", () => {
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync("public/js-interpreter.js","utf8"),context);
  registerMessageBlocks(Blockly,javascriptGenerator);
  const workspace=new Blockly.Workspace();
  Blockly.serialization.blocks.append({type:"bot_send",inputs:{BOT:{shadow:{type:"math_number",fields:{NUM:1}}},MESSAGE:{shadow:{type:"text",fields:{TEXT:"Ready!"}}}}},workspace);
  const code=javascriptGenerator.workspaceToCode(workspace); workspace.dispose();
  const farm=new Map(), output=[];
  const runners=[0,1].map(id=>{
    const inbox=joinBotInbox(farm,id);
    const api=createCommandAPI({robot:{bot_index:id,sendMessage:inbox.send,hasMessage:inbox.hasMessage,receiveMessage:inbox.receive,sayText:text=>output.push(text)}});
    return new context.Interpreter(id===0?code:'if(bot.has_message()){bot.say(bot.receive());}',createInterpreterInit(api));
  });
  for(const runner of runners){let steps=0;while(runner.step())assert.ok(++steps<1000);}
  assert.deepEqual(output,["Ready!"]);
});

