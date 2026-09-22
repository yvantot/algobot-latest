import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as Blockly from "blockly";
import "blockly/blocks";
import {javascriptGenerator} from "blockly/javascript";
import {commandExample} from "../src/game/global/documentation.js";

const source=fs.readFileSync(new URL("../src/components/BlockBased.svelte",import.meta.url),"utf8");
const definitions=source.slice(source.indexOf("  function registerBlocks()"),source.indexOf("  const BLOCK_UNLOCK_MAP"));
vm.runInNewContext(`${definitions}\nregisterBlocks();registerGenerators();`,{Blockly,javascriptGenerator,cropDropdown:()=>[["wheat","wheat"]]});
const samples={bot_movement:["up","down","left","right","jump"],bot_farm_actions:["till","water","plant","harvest","destroy","kill_bug","extinguish","say","wait"],bot_checks:["is_tilled","is_watered","is_planted","is_harvestable","is_bug","is_fire","is_dead"],globals:["rows","columns","randint","randfloat"],shop:["buy_seed","buy_row","buy_column","upgrade_bot_action","upgrade_bot_move","upgrade_bot_check"],inventory:["seed","coin"],syntax:["if","for"]};
function trace(code){const calls=[];const api=new Proxy({}, {get:(_,name)=>(...args)=>{calls.push([name,...args]);return true;}});vm.runInNewContext(code,{bot:api,shop:api,inventory:api,rows:()=>3,columns:()=>3,randint:()=>1,randfloat:()=>1,highlightBlock:()=>{}},{timeout:1000});return calls;}
test("insertable Blockly examples generate behavior equivalent to their text",()=>{
 for(const [category,names] of Object.entries(samples))for(const name of names){
  const example=commandExample(category,name),workspace=new Blockly.Workspace();
  try{Blockly.serialization.blocks.append(example.block,workspace);const generated=javascriptGenerator.workspaceToCode(workspace);assert.deepEqual(trace(generated),trace(example.code),`${category}/${name}`);}finally{workspace.dispose();}
 }
});
