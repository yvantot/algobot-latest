import test from "node:test";
import assert from "node:assert/strict";
import { prepareLesson, releaseLesson, lessonTiles } from "../src/game/global/quest-setup.js";
import { CropStates, SoilStates } from "../src/game/global/enum.js";

function farm() {
  const grid = new Map(), size = { columns: 4, rows: 3 }, moves = [];
  for (let y=0;y<size.rows;y++) for(let x=0;x<size.columns;x++) grid.set(y+"-"+x,{
    soil:{soil_state:0,setSoilState(state){this.soil_state=state;},water(){this.wet=true;}},crop:null,
  });
  return { grid,size,moves,robot:{is_available:true,botJump:(...args)=>moves.push(args)},
    inventory:{crops:{},changeCrops(type,amount){this.crops[type]=(this.crops[type]||0)+amount;}},
    createCrop(x,y,state){return {crop_state:state,markDead(){this.crop_state=CropStates.DEAD;},cropDestroy(){grid.get(y+"-"+x).crop=null;}};},
    createBug(x,y){const tile=grid.get(y+"-"+x);return tile.bug={destroy(){tile.bug=null;}};},
    ignite(key){const tile=grid.get(key);return tile.fire={destroy(){tile.fire=null;}};},
  };
}
test("cleanup starts with a spoiled crop without waiting for a random event",()=>{
  const deps=farm();
  assert.equal(prepareLesson("cs_cleanup_0",deps).prepared,true);
  assert.equal(deps.grid.get("0-0").crop.crop_state,CropStates.DEAD);
  assert.deepEqual(deps.moves,[[0,0]]);
});
test("automatic setup preserves occupied tiles; explicit reset replaces only lesson tiles",()=>{
  const deps=farm();
  const existing=deps.createCrop(0,0,CropStates.HARVESTABLE);
  deps.grid.get("0-0").crop=existing;
  deps.grid.get("2-3").crop={keep:true};
  assert.equal(prepareLesson("farm_two_0",deps).prepared,false);
  assert.equal(deps.grid.get("0-0").crop,existing);
  assert.equal(prepareLesson("farm_two_0",{...deps,replace:true}).prepared,true);
  assert.equal(deps.grid.get("0-0").crop,null);
  assert.equal(deps.grid.get("0-0").soil.soil_state,SoilStates.INITIAL);
  assert.equal(deps.grid.get("2-3").crop.keep,true);
});
test("retry supplies a bounded seed floor instead of accumulating free packs",()=>{
  const deps=farm();
  prepareLesson("loop_row_0",deps);
  const first={...deps.inventory.crops};
  prepareLesson("loop_row_0",{...deps,replace:true});
  assert.deepEqual(deps.inventory.crops,first);
  assert.equal(first.wheat,3);
});
test("hazard practice seeds both ends and releases owned hazards",()=>{
  for(const [key,field] of [["hazard_bug_0","bug"],["hazard_fire_0","fire"]]){
    const deps=farm();
    prepareLesson(key,deps);
    assert.ok(deps.grid.get("0-0")[field]);
    assert.ok(deps.grid.get("2-3")[field]);
    assert.equal(deps.grid.lessonActive,true);
    releaseLesson(deps.grid);
    assert.equal(deps.grid.get("0-0")[field],null);
    assert.equal(deps.grid.get("2-3")[field],null);
    assert.equal(deps.grid.lessonActive,false);
    assert.ok([...deps.grid.values()].every(tile=>!tile.lesson));
  }
});
test("while lesson starts growing with water; farm setup follows dimensions",()=>{
  const deps=farm();
  prepareLesson("cs_wait_0",deps);
  assert.equal(deps.grid.get("0-0").crop.crop_state,CropStates.GROWING);
  assert.equal(deps.grid.get("0-0").soil.wet,true);
  assert.equal(lessonTiles("fn_reuse_0",{rows:4,columns:5}).length,20);
  assert.equal(lessonTiles("loop_size_0",{rows:4,columns:5}).length,5);
});
test("lesson setup does not race an in-flight bot action",()=>{
  const deps=farm();deps.robot.is_available=false;
  assert.equal(prepareLesson("cs_cleanup_0",{...deps,replace:true}).prepared,false);
  assert.equal(deps.moves.length,0);
  assert.equal(deps.grid.get("0-0").crop,null);
});
