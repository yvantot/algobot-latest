import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { createCommandAPI } from "../src/game/global/command-api.js";
import {documentationEntries,filterDocumentation,insertionProblem,recommendedCommands,commandExample} from "../src/game/global/documentation.js";
const data={bot_farm_actions:{water:{definition:"Water soil. More details.",is_unlocked:true},harvest:{is_unlocked:true}},bot_movement:{right:{is_unlocked:true},jump:{is_unlocked:false}},bot_checks:{is_harvestable:{is_unlocked:false}},syntax:{if:{is_unlocked:true}}};
const quests={a:{title:"Movement",rewards:{unlocks:["jump"]}}};
test("the shop variable reference calls the supported seed purchase API",()=>{
 const calls=[];
 const api=createCommandAPI({robot:{},shop:{buyPlants:(...args)=>calls.push(args)}});
 const source=fs.readFileSync(new URL("../src/game/global/global.js",import.meta.url),"utf8");
 const DOCUMENT_DATA=vm.runInNewContext(source.slice(source.indexOf("export const DOCUMENT_DATA")).replace("export const DOCUMENT_DATA", "const DOCUMENT_DATA")+"\nDOCUMENT_DATA;",{getWeatherArtwork:name=>name});
 const entry=documentationEntries(DOCUMENT_DATA,{}).find(entry=>entry.id==="globals/shop");
 vm.runInNewContext(entry.code,{shop:api.shop});
 assert.deepEqual(calls,[["wheat",1]]);
});
test("name search combines category and availability without searching prose",()=>{
 const entries=documentationEntries(data,quests);
 assert.equal(filterDocumentation(entries," BOT.WATER ","all","unlocked").length,1);
 assert.equal(filterDocumentation(entries,"soil","all","all").length,0);
 assert.equal(filterDocumentation(entries,"jump","bot_movement","locked")[0].requirement,"Movement");
 assert.equal(filterDocumentation(entries,"jump","bot_farm_actions","all").length,0);
});
test("multi-command examples cannot insert a locked dependency",()=>{
 const entries=documentationEntries(data,quests);
 assert.match(insertionProblem(entries.find(e=>e.name==="if"),entries),/is_harvestable/);
 assert.equal(insertionProblem(entries.find(e=>e.name==="water"),entries),"");
});
test("recommendations use active mission commands and block conditions have valid inputs",()=>{
 const entries=documentationEntries(data,quests);
 assert.deepEqual(recommendedCommands({tip:"Use bot.water to water the plant."},entries).map(e=>e.name),["water"]);
 assert.deepEqual(Object.keys(commandExample("syntax","if").block.inputs),["IF0","DO0"]);
});
