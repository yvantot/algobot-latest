import test from "node:test";
import assert from "node:assert/strict";
import {devInteger, inspectFarm, executeDevAction} from "../src/game/dev-console.js";

test("developer input rejects blank, fractional and out of range values",()=>{
 for(const value of ["",null,undefined,"oops",1.2,-1,21]) assert.throws(()=>devInteger(value,0,20,"Bots"));
 assert.equal(devInteger("3",0,20,"Bots"),3);
});
test("diagnostics contain plain tile data and omit off-farm placeholders",()=>{
 const crop={crop_type:"wheat",crop_health:10}; crop.self=crop;
 const grid=new Map([["0-0",{soil:{soil_state:2,water_remaining:.5},crop,bots:[{bot_index:2}],fire:{stage:1,age:9,isBurning:()=>true}}],["-1-0",{bug:{}}]]);
 const result=inspectFarm(grid);
 assert.equal(result.length,1); assert.equal(result[0].fire.stage,2);
 assert.deepEqual(result[0].bots,[2]); assert.doesNotThrow(()=>JSON.stringify(result));
 crop.crop_health=5; assert.equal(result[0].crop.health,10);
});
test("console awaits actions and distinguishes rejected events from success",async()=>{
 assert.deepEqual(await executeDevAction(async()=>({applied:false,reason:"tutorial_protected"})),{ok:false,message:"tutorial_protected"});
 assert.equal((await executeDevAction(()=>false)).ok,false);
 assert.deepEqual(await executeDevAction(()=>3),{ok:true,message:"3 affected"});
 await assert.rejects(()=>executeDevAction(async()=>{throw new Error("failure")}),/failure/);
});
