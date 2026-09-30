import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as Blockly from "blockly";
import "blockly/blocks";
import { javascriptGenerator } from "blockly/javascript";
import { registerInspectionBlocks } from "../src/game/global/inspection-blocks.js";
import { registerMessageBlocks } from "../src/game/global/message-blocks.js";
import { createCommandAPI } from "../src/game/global/command-api.js";
import { createInterpreterInit } from "../src/game/global/interpreter-bindings.js";
import { createCodeRunner } from "../src/game/global/code-runner.js";
import { PROGRAM_QUESTS } from "../src/game/global/quest-program.js";
import { lessonAnswer } from "../src/game/global/quest-lessons.js";
import { QUEST_DATA } from "../src/game/global/quests.js";
import { prepareLesson } from "../src/game/global/quest-setup.js";
import { SoilStates, CropStates } from "../src/game/global/enum.js";

const context = vm.createContext({ console, setTimeout, clearTimeout });
vm.runInContext(fs.readFileSync(new URL("../public/js-interpreter.js",import.meta.url),"utf8"),context);
const InterpreterClass = context.Interpreter;
const source=fs.readFileSync(new URL("../src/components/BlockBased.svelte",import.meta.url),"utf8");
const blocksContext=vm.createContext({Blockly,javascriptGenerator,registerInspectionBlocks,registerMessageBlocks,
  cropDropdown:()=>["wheat","corn","rice","potato","sugarcane","tomato"].map(name=>[name,name])});
vm.runInContext(source.slice(source.indexOf("  function registerBlocks()"),source.indexOf("  function isBlockUnlocked(")) +
  "\nregisterBlocks();registerGenerators();",blocksContext);

function runQuest(key, code, columns = 4, random = () => .1) {
  const size = { columns, rows:3 }, grid = new Map(), awards = [], errors = [], output = [];
  const inventory = { crops:{wheat:100,corn:100,rice:100},changeCrops(type,amount){this.crops[type]=(this.crops[type]||0)+amount;} };
  for(let y=0;y<size.rows;y++) for(let x=0;x<size.columns;x++) grid.set(y+"-"+x,{
    soil:{soil_state:SoilStates.INITIAL,setSoilState(state){this.soil_state=state;},water(){return true;}},crop:null,
  });
  const tile = () => grid.get(robot.grid_y+"-"+robot.grid_x);
  const done = (cb, result) => { if(result === false) { robot.executionErrorCount++;errors.push("action failed"); } cb(result); };
  const robot = { grid_x:0,grid_y:0,is_available:true,executionErrorCount:0,
    sayText:value=>output.push(value),
    botJump(x,y,cb=()=>{}) { const valid=grid.has(y+"-"+x);if(valid){this.grid_x=x;this.grid_y=y;}done(cb,valid); },
    botTill(cb){const valid=tile().soil.soil_state===SoilStates.INITIAL;if(valid)tile().soil.soil_state=SoilStates.READY;done(cb,valid);},
    botPlant(type,cb){const valid=!tile().crop && tile().soil.soil_state!==SoilStates.INITIAL && inventory.crops[type]>0;
      if(valid)tile().crop={crop_type:type,crop_state:CropStates.YOUNG};done(cb,valid);},
    botWater(cb){done(cb,tile().soil.soil_state!==SoilStates.INITIAL);},
    botHarvest(cb){const crop=tile().crop,valid=crop?.crop_state===CropStates.HARVESTABLE;if(valid)tile().crop=null;done(cb,valid?crop.crop_type:false);},
    botDestroy(cb){const valid=!!tile().crop;tile().crop=null;done(cb,valid);},
    botWait(_seconds,cb){if(tile().crop)tile().crop.crop_state=CropStates.HARVESTABLE;done(cb,true);},
    botKillBug(cb){const valid=!!tile().bug;tile().bug=null;done(cb,valid);},
    botExtinguish(cb){const valid=!!tile().fire;tile().fire=null;done(cb,valid);},
    checkPlanted:cb=>cb(!!tile().crop),checkTilled:cb=>cb(tile().soil.soil_state!==SoilStates.INITIAL),
    isHarvestable:cb=>cb(tile().crop?.crop_state===CropStates.HARVESTABLE),
    checkDead:cb=>cb(tile().crop?.crop_state===CropStates.DEAD),
    isBug:cb=>cb(!!tile().bug),checkFire:cb=>cb(!!tile().fire),
  };
  prepareLesson(key,{grid,size,robot,inventory,replace:true,
    createCrop:(x,y,state)=>({crop_type:"wheat",crop_state:state,markDead(){this.crop_state=CropStates.DEAD;}}),
    createBug:(x,y)=>grid.get(y+"-"+x).bug={destroy(){}},ignite:key=>grid.get(key).fire={destroy(){}},
  });
  const api=createCommandAPI({robot,inventory,farmSize:()=>size,random});
  const telemetry={recordCodeRun(){},recordError:message=>errors.push(message),recordIfCondition(){},recordLoopExecution(){}};
  const states=[{robot,onQuestEvent:(id,amount,action)=>{if(action?.program)awards.push(id);}}];
  const runner=createCodeRunner({states,InterpreterClass,telemetry,prepare:()=>code,
    init:()=>createInterpreterInit(api),schedule:()=>1,unschedule(){}});
  runner.start(0);
  for(let i=0;i<10000 && states[0].interpreter;i++)runner.step(0);
  assert.equal(states[0].interpreter,null,"run must end");
  return {awards,errors,output,trace:robot.questTrace};
}

for(const mode of ["text","blocks"])test("every "+mode+" lesson answer earns its intended quest",()=>{
  for(const key of PROGRAM_QUESTS) {
    const answer=lessonAnswer(key);
    const workspace=new Blockly.Workspace();
    let code=answer.code;
    try {
      if(mode==="blocks"){
        for(const block of answer.blocks??[answer.block])Blockly.serialization.blocks.append(block,workspace);
        code=javascriptGenerator.workspaceToCode(workspace);
      }
      const result=runQuest(key,code);
      assert.deepEqual(result.errors,[],key+"\n"+code);
      assert.ok(result.awards.includes(key),key+"\n"+code+"\nawarded "+result.awards.join(",")+"\n"+JSON.stringify(result.trace.events.map(e=>({name:e.name,result:e.result,stack:e.stack.map(n=>n.type),call:!!e.call}))));
    }finally{workspace.dispose();}
  }
});

test("farm-sized loops work after buying rows or columns",()=>{
  for(const key of ["loop_size_0","for_count_0","loop_farm_0","fn_reuse_0","fn_param_0"])
    assert.ok(runQuest(key,lessonAnswer(key).code,5).awards.includes(key),key);
});
test("random lesson accepts either outcome",()=>{
  assert.ok(runQuest("cs_random_0",lessonAnswer("cs_random_0").code,4,()=>.99).awards.includes("cs_random_0"));
});
test("dead code, detached actions and hardcoded outputs do not prove concepts",()=>{
  const cases={
    var_set_0:"var count=0;bot.say(0);",
    var_change_0:"var count=3;for(var i=0;i<3;i++){}bot.say(count);",
    var_crop_0:'var crop="corn";bot.plant("corn");',
    fn_define_0:'function care(){bot.till();bot.plant("wheat");bot.water();}bot.till();bot.plant("wheat");bot.water();',
    if_ready_0:"if(false){bot.is_harvestable();}bot.harvest();",
    loop_water_0:"for(var i=0;i<3;i++){}bot.water();bot.right();bot.water();bot.right();bot.water();",
    cs_cleanup_0:"bot.destroy();",
    cs_wait_0:"bot.wait(1);",
    cs_jump_0:"bot.jump(0,0);bot.jump(1,0);bot.jump(2,0);",
    for_count_0:"var i=0;while(i<columns()){bot.jump(i,0);i++;}",
    logic_compare_0:'if(inventory.seeds("wheat") > -1){bot.plant("wheat");}',
    cs_random_0:'if(randint(1,2)===1){bot.plant("corn");}else{bot.plant("wheat");}',
  };
  for(const [key,code] of Object.entries(cases))assert.ok(!runQuest(key,code).awards.includes(key),key);
});
