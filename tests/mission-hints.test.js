import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as Blockly from "blockly";
import "blockly/blocks";
import { javascriptGenerator } from "blockly/javascript";
import { missionHint, recordMissionHint } from "../src/game/global/mission-hints.js";
import { TelemetryTracker } from "../src/game/ml/telemetry.js";
import { registerInspectionBlocks } from "../src/game/global/inspection-blocks.js";
import { registerMessageBlocks } from "../src/game/global/message-blocks.js";
import { QUEST_DATA } from "../src/game/global/quests.js";
import { diagnoseMission } from "../src/game/global/mission-hints.js";

test("every mission hint builds real Blockly blocks and generates text code",()=>{
  const source=fs.readFileSync(new URL('../src/components/BlockBased.svelte',import.meta.url),'utf8');
  const context=vm.createContext({Blockly,javascriptGenerator,registerInspectionBlocks,registerMessageBlocks,cropDropdown:()=>['wheat','corn','rice','potato','sugarcane','tomato'].map(name=>[name,name])});
  const functions=source.slice(source.indexOf('  function registerBlocks()'),source.indexOf('  function isBlockUnlocked('));
  vm.runInContext(functions+'\nregisterBlocks();registerGenerators();',context);
  const keys=Object.keys(QUEST_DATA);
  assert.equal(keys.length,44);
  for(const key of keys)for(let level=0;level<4;level++){
    const example=missionHint(key,level,['till','plant','water'],true);
    assert.ok(example.message);
    if(level < 2) {
      assert.equal(example.block,null);
      assert.ok(example.code.startsWith("//"));
      continue;
    }
    const workspace=new Blockly.Workspace();
    try {
      for(const block of example.blocks ?? [example.block]) Blockly.serialization.blocks.append(block,workspace);
      const code=javascriptGenerator.workspaceToCode(workspace);
      assert.ok(code.trim(),key);
      assert.ok(example.code.trim(),key);
      assert.doesNotThrow(()=>new vm.Script(code),key);
      if (key === "cs_check_0" && level === 3) {
        assert.match(code, /bot.say\(\(*bot.is_planted\(\)\)+/);
        assert.doesNotMatch(code, /is_harvestable/);
      }
      if (key === "cs_if_0" && level === 3) {
        assert.match(code, /if\s*\(\(*!\(*bot.is_planted\(\)\)+/);
        assert.match(code, /bot.plant\(['"]wheat['"]\)/);
        assert.doesNotMatch(code, /bot.harvest/);
      }
    }finally{workspace.dispose();}
  }
});

test("hints escalate without revealing the answer on the first clicks", () => {
  assert.equal(missionHint("intro_run", 2).block.type, "bot_right");
  for (const key of Object.keys(QUEST_DATA)) {
    const shape = missionHint(key, 2), answer = missionHint(key, 3);
    assert.ok(shape.code.includes("YOUR TURN"), key);
    assert.ok(shape.changeLine > 0, key);
    assert.ok(answer.why, key);
    assert.deepEqual(missionHint(key, 99), answer);
  }
});

test("hints diagnose the student's program before general advice", () => {
  assert.match(diagnoseMission({ blocks:[{type:"bot_plant"},{type:"bot_right"}] }), /floating/);
  assert.match(diagnoseMission({ blocks:[{type:"controls_repeat_ext",hasBody:false}] }), /loop is empty/);
  assert.match(diagnoseMission({ code:'bot.plant("corn");',seeds:{} }), /corn seeds/);
  assert.match(diagnoseMission({ code:'bot.plant("wheat");',seeds:{wheat:1},tile:{tilled:false} }), /Prepare soil/);
  assert.match(diagnoseMission({ code:"bot.right();",x:2,columns:3 }), /edge/);
  assert.match(diagnoseMission({ lastError:"count is not defined" }), /variable/);
});

test("replayed visual and text mission hints both enter exported help counters",()=>{
  const tracker=new TelemetryTracker();
  const example=missionHint('intro_loop');
  for(const editor of ['blocks','blocks','text'])recordMissionHint(tracker,'intro_loop',editor,2,example);
  assert.equal(tracker.requestedHints,3);
  const events=tracker.rawEvents.filter(event=>event.event==='hint_shown');
  assert.equal(events.length,3);
  assert.deepEqual(events.map(event=>event.editor),['blocks','blocks','text']);
  tracker.collectionEnabled=true;
  tracker.setCollectionContext({phase:'gameplay',game_speed:1,robot_count:1});
  tracker.sampleCollection();
  assert.equal(tracker.collectionSnapshots.at(-1).counters.requested_hints,3);
});
