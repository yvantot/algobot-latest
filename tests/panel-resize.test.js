import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
test("resizing uses measured panel width and stops reacting after release or disposal",()=>{
 const listeners=new Map();let dispose;
 const source=fs.readFileSync(new URL("../src/components/interface.svelte.js",import.meta.url),"utf8").replace(/^import .*;\r?\n/gm,"").replaceAll("export function","function");
 const context=vm.createContext({$state:x=>x,onDestroy:fn=>dispose=fn,window:{innerWidth:1200,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)}});
 vm.runInContext(source+";var resize=createResizable();",context);
 const resize=context.resize;
 resize.startResize({button:0,clientX:500,preventDefault(){},currentTarget:{parentElement:{getBoundingClientRect:()=>({width:380})}}});
 listeners.get("mousemove")({clientX:480});assert.equal(resize.width,400);
 listeners.get("mouseup")();assert.equal(resize.width,400);assert.equal(listeners.size,0);
 dispose();assert.equal(listeners.size,0);
});

test("pointer resizing captures the handle, releases on cancel, and supports keyboard adjustment",()=>{
 const listeners=new Map();let captured;
 const source=fs.readFileSync(new URL("../src/components/interface.svelte.js",import.meta.url),"utf8").replace(/^import .*;\r?\n/gm,"").replaceAll("export function","function");
 const context=vm.createContext({$state:x=>x,onDestroy(){},window:{innerWidth:1200,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)}});
 vm.runInContext(source+";var resize=createResizable();",context);
 const target={setPointerCapture:id=>captured=id,parentElement:{getBoundingClientRect:()=>({width:400})}};
 context.resize.startResize({button:0,pointerId:7,clientX:500,preventDefault(){},currentTarget:target});
 assert.equal(captured,7);listeners.get("pointermove")({clientX:450});assert.equal(context.resize.width,450);
 listeners.get("pointercancel")();assert.equal(listeners.size,0);assert.equal(context.resize.is_resizing,false);
 context.resize.resizeKey({key:"ArrowRight",preventDefault(){},currentTarget:target});assert.equal(context.resize.width,380);
});
