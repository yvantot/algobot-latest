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

test("every mission hint builds real Blockly blocks and generates text code",()=>{
  const source=fs.readFileSync(new URL('../src/components/BlockBased.svelte',import.meta.url),'utf8');
  const context=vm.createContext({Blockly,javascriptGenerator,registerInspectionBlocks,registerMessageBlocks,cropDropdown:()=>['wheat','corn','rice','potato','sugarcane','tomato'].map(name=>[name,name])});
  const functions=source.slice(source.indexOf('  function registerBlocks()'),source.indexOf('  function isBlockUnlocked('));
  vm.runInContext(functions+'\nregisterBlocks();registerGenerators();',context);
  const quests=fs.readFileSync(new URL('../src/game/global/quests.js',import.meta.url),'utf8');
  const keys=[...quests.matchAll(/^  "([^"]+)": \{/gm)].map(match=>match[1]);
  assert.equal(keys.length,22);
  for(const key of keys)for(let level=0;level<4;level++){
    const example=missionHint(key,level,['till','plant','water'],true);
    const workspace=new Blockly.Workspace();
    try {
      Blockly.serialization.blocks.append(example.block,workspace);
      const code=javascriptGenerator.workspaceToCode(workspace);
      assert.ok(code.trim(),key);
      assert.ok(example.code.trim(),key);
      assert.doesNotThrow(()=>new vm.Script(code),key);
    }finally{workspace.dispose();}
  }
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
