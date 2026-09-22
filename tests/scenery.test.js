import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source=fs.readFileSync(new URL("../src/game/scenery.js",import.meta.url),"utf8").replace(/^import .*;\r?\n/gm,"").replaceAll("export function","function");
const context=vm.createContext({}); vm.runInContext(source,context);
const farm={grid_origin:{x:500,y:300},columns:3,rows:3,cell_size:76};
const bounds={left:-500,top:-500,right:2000,bottom:1200};
test("scenery stays deterministic while panning and grows no world-sized allocation",()=>{
 const a=context.sceneryTiles(bounds,farm), b=context.sceneryTiles({...bounds,left:-388},farm);
 const common=b.filter(t=>a.some(other=>other.x===t.x&&other.y===t.y));
 for(const tile of common)assert.deepEqual(tile,a.find(t=>t.x===tile.x&&t.y===tile.y));
 assert.ok(a.length<1000);
 const far=context.sceneryTiles({left:100000,top:100000,right:102500,bottom:101700},farm);assert.ok(far.length<1000);
});
test("farm expansion clears newly occupied scenery and all flowers sway",()=>{
 const grown={...farm,rows:8,columns:8};
 const tiles=context.sceneryTiles(bounds,grown);
 for(const t of tiles){assert.ok(t.x+40<=455||t.x-40>=1143||t.y+40<=255||t.y-40>=943); if(t.flower)assert.equal(t.sway,true);}
});
