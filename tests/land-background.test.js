import test from "node:test";
import assert from "node:assert/strict";
import {addLandBackground} from "../src/game/land-background.js";

test("both soil and shadow grow by one cell per purchased row and column",()=>{
 const engine={pos:(x,y)=>({x,y}),rect:(width,height)=>({width,height}),color:color=>({color}),anchor:anchor=>({anchor}),layer:layer=>({layer}),add:parts=>Object.assign({},...parts)};
 const farm={rows:3,columns:3,tile_size:64,gap:12,grid_origin:{x:100,y:200},bg_soil:"#abc"};
 const before=addLandBackground(engine,farm), after=addLandBackground(engine,{...farm,rows:4,columns:4});
 for(let i=0;i<2;i++){assert.equal(after[i].width-before[i].width,76);assert.equal(after[i].height-before[i].height,76);assert.equal(after[i].x,before[i].x);assert.equal(after[i].y,before[i].y);}
 assert.equal(farm.rows,3);assert.equal(farm.columns,3);
});
