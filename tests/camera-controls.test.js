import test from "node:test";
import assert from "node:assert/strict";
import { attachCameraControls, snapZoom, clampFarmCamera } from "../src/game/camera-controls.js";
function setup() {
 const listeners = new Map();
 const surface = name => ({ style:{}, addEventListener(type,fn){listeners.set(name+type,fn)}, removeEventListener(type){listeners.delete(name+type)},getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600}) });
 const canvas=surface("canvas"), win=surface("win"); let target=canvas, enabled=true, zoom=1;
 const camera={x:500,y:300};
 const engine={width:()=>1000,height:()=>600,vec2:(x,y)=>({x,y}),setCamPos(){},setCamScale(){}};
 const dispose=attachCameraControls({canvas,win,doc:{elementFromPoint:()=>target},engine,camera,enabled:()=>enabled,getZoom:()=>zoom,setZoom:value=>zoom=value});
 const emit=(where,type,props={})=>listeners.get(where+type)?.({pointerId:1,button:0,buttons:1,target:canvas,clientX:100,clientY:100,preventDefault(){},...props});
 return {camera,canvas,emit,dispose,listeners,getZoom:()=>zoom,overlay:()=>target={},disable:()=>enabled=false};
}
test("camera drags only after threshold and stops when the pointer crosses HTML",()=>{
 const h=setup(); h.emit("canvas","pointerdown"); h.emit("win","pointermove",{clientX:104}); assert.equal(h.camera.x,500);
 h.emit("win","pointermove",{clientX:120}); assert.equal(h.camera.x,480);
 h.overlay(); h.emit("win","pointermove",{clientX:150}); assert.equal(h.camera.x,480);
 h.dispose(); assert.equal(h.listeners.size,0);
});
test("HTML pointer-down and modal input cannot move or zoom the camera",()=>{
 const h=setup(); h.emit("canvas","pointerdown",{target:{}}); h.emit("win","pointermove",{clientX:150}); assert.equal(h.camera.x,500);
 h.disable(); h.emit("canvas","wheel",{deltaY:-100,deltaMode:0}); assert.equal(h.getZoom(),1);
 h.emit("canvas","pointerdown");h.emit("win","pointermove",{clientX:150});assert.equal(h.camera.x,500);
});
test("wheel zoom preserves the world point beneath the pointer and ignores Ctrl-wheel",()=>{
 const h=setup(); const before=h.camera.x+(100-500)/h.getZoom();
 h.emit("canvas","wheel",{deltaY:-100,deltaMode:0});
 assert.ok(h.getZoom()>1); assert.ok(Math.abs(h.camera.x+(100-500)/h.getZoom()-before)<1e-9);
 const zoom=h.getZoom();h.emit("canvas","wheel",{deltaY:-100,ctrlKey:true}); assert.equal(h.getZoom(),zoom);
});

test("zoom snaps to ten percent and stops at fifty and one hundred fifty percent",()=>{
 const h=setup();
 for(let i=0;i<30;i++) h.emit("canvas","wheel",{deltaY:-1});
 assert.equal(h.getZoom(),1.5);
 for(let i=0;i<30;i++) { h.emit("canvas","wheel",{deltaY:1}); assert.equal(h.getZoom(),snapZoom(h.getZoom())); }
 assert.equal(h.getZoom(),.5);
 h.emit("canvas","wheel",{deltaY:0}); assert.equal(h.getZoom(),.5);
 assert.equal(snapZoom(.79999999),.8);
});

test("camera bounds track the farm origin and expanded dimensions",()=>{
 const farm={grid_origin:{x:100,y:200},cell_size:80,rows:3,columns:3};
 assert.deepEqual(clampFarmCamera({x:-10000,y:10000},farm),{x:20,y:520});
 farm.rows=6; farm.columns=5;
 assert.deepEqual(clampFarmCamera({x:10000,y:10000},farm),{x:580,y:760});
});
