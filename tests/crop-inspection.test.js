import test from "node:test";
import assert from "node:assert/strict";
import { cropReading } from "../src/game/global/crop-inspection.js";
import { CropStates } from "../src/game/global/enum.js";
import { bestRouteValue } from "../src/game/challenges/scenarios.js";
import { createCommandAPI } from "../src/game/global/command-api.js";
import * as Blockly from "blockly";
import "blockly/blocks";
import { javascriptGenerator } from "blockly/javascript";
import { registerInspectionBlocks } from "../src/game/global/inspection-blocks.js";

test("crop inspection distinguishes ready, expiring, young, dead and empty tiles",()=>{
 const crop={crop_type:"corn",crop_state:CropStates.HARVESTABLE,crop_reward:5,crop_spoilage_time:10,spoilage_remaining:8};
 assert.equal(cropReading(crop,"crop_value"),5);assert.equal(cropReading(crop,"crop_time_left"),8);
 crop.spoilage_remaining=3;assert.equal(cropReading(crop,"crop_value"),2.5);
 crop.crop_state=CropStates.YOUNG;assert.equal(cropReading(crop,"crop_value"),0);assert.equal(cropReading(crop,"crop_time_left"),-1);assert.equal(cropReading(crop,"crop_type"),"corn");
 crop.crop_state=CropStates.DEAD;assert.equal(cropReading(crop,"crop_type"),"");assert.equal(cropReading(null,"crop_time_left"),-1);
});
test("student readings delegate to the robot and retain zero and negative sentinels",()=>{
 const calls=[];const api=createCommandAPI({robot:{readCrop(name,x,y){calls.push([name,x,y]);return name==="crop_time_left"?-1:0;}}});
 assert.equal(api.bot.crop_value(2,0),0);assert.equal(api.bot.crop_time_left(1,0),-1);
 assert.deepEqual(calls,[["crop_value",2,0],["crop_time_left",1,0]]);
});
test("planning oracle favors total future yield over the highest single crop",()=>{
 assert.equal(bestRouteValue([12,8,0,18],4),20);
 assert.equal(bestRouteValue([18,0,12,8],4),30);
 assert.equal(bestRouteValue([12,8,0,18],0),0);
});

test("crop-reading blocks generate valid student code with zero-based coordinates",()=>{
 registerInspectionBlocks(Blockly,javascriptGenerator);
 const workspace=new Blockly.Workspace();
 try {
  workspace.newBlock("bot_crop_value");
  assert.equal(javascriptGenerator.workspaceToCode(workspace).trim(),"bot.crop_value(0, 0);");
 } finally {workspace.dispose();}
});
