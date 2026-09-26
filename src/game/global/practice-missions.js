import { createCommandAPI } from "./command-api.js";
import { createInterpreterInit } from "./interpreter-bindings.js";

export const PRACTICE_MISSIONS = ["intro_run","intro_build","intro_say","intro_sequence","tut_2","intro_loop","cs_check_0","cs_if_0","cs_grid_0","cs_jump_0","cs_cleanup_0","cs_wait_0","cs_random_0"];
export const isPracticeMission = key => PRACTICE_MISSIONS.includes(key);
export function practiceSetup(key) {
  const empty = () => ({type:null,state:"empty"});
  const layout = [empty(),empty(),empty()];
  const task = {commands:["left","right","say"], rows:1, kind:"practice", defaultCrop:"wheat", practice:true, categories:["Bot"]};
  if(key === "intro_run") task.commands=["right"];
  if(key === "intro_build") { task.rows=2; layout.push(empty(),empty(),empty()); task.commands=["down"]; }
  if(key === "intro_say") task.commands=["say"];
  if(key === "tut_2") { layout[0]={type:null,state:"bare"};task.kind="sequence";task.commands=["till","plant","water","harvest","wait","is_harvestable"]; }
  if(key === "cs_check_0") {layout[1]={type:"wheat",state:"young"};task.commands=["say","is_planted","left","right"];}
  if(key === "cs_if_0") task.commands=["is_planted","plant"];
  if(key === "cs_cleanup_0") {layout[0]={type:"wheat",state:"dead"};task.commands=["is_dead","destroy"];}
  if(key === "cs_jump_0") task.commands=["jump"];
  if(key === "cs_wait_0") task.commands=["wait"];
  if(key === "cs_grid_0") task.commands=["say","rows"];
  if(key === "cs_random_0") task.randomLesson=true;
  if(["intro_say","tut_2","cs_if_0"].includes(key))task.categories.push("Text");
  if(["tut_2","intro_loop","cs_jump_0","cs_wait_0","cs_random_0"].includes(key))task.categories.push("Math");
  if(key === "intro_loop")task.categories.push("Loops");
  if(["cs_if_0","cs_cleanup_0"].includes(key))task.categories.push("If");
  return {layout,task,startX:["intro_sequence","intro_loop"].includes(key)?1:0};
}

function contains(node, predicate) {
  if(!node || typeof node!=="object") return false;
  return predicate(node) || Object.values(node).some(value=>Array.isArray(value)?value.some(child=>contains(child,predicate)):contains(value,predicate));
}
const calls = (node,name) => contains(node,item=>item.type==="CallExpression" && item.callee?.object?.name==="bot" && Object.values(item.callee).some(value=>value?.name===name));

// Runs on the same robot actions as the main farm. Only the lesson's own
// progress is observed; no main-farm rewards, counters or challenge labels.
export async function runPractice(source, key, world, Interpreter, {signal,onProgress=()=>{},onAction=()=>{},yieldControl=()=>new Promise(resolve=>setTimeout(resolve,16))}={}) {
  if(typeof Interpreter!=="function") throw Error("The code runner is still loading.");
  if(!source.trim()) throw Error("Add a block first, then press Start.");
  const robot=world.robot, setup=practiceSetup(key);
  const api=createCommandAPI({robot,farmSize:()=>({columns:3,rows:setup.task.rows})});
  let actions=0,steps=0,lastCheck=null,lastNumber=null;
  const moves=[], signals=new Set();
  const progress=(token)=>{if(!signals.has(token)){signals.add(token);onProgress(token);}};
  let runner;
  const bot={};
  for(const name of setup.task.commands.filter(name=>!["say","rows"].includes(name))) bot[name]=(...args)=>{
    const callback=args.pop();
    const frames=runner?.getStateStack() ?? [];
    const inLoop=frames.some(frame=>["ForStatement","WhileStatement","DoWhileStatement"].includes(frame.node?.type));
    const inPlantCondition=frames.some(frame=>frame.node?.type==="IfStatement"&&calls(frame.node.test,"is_planted"));
    const inDeadCondition=frames.some(frame=>frame.node?.type==="IfStatement"&&calls(frame.node.test,"is_dead"));
    if(++actions>100) throw Error("That loop is taking too long. Stop and check how it ends.");
    api.bot[name](...args,value=>{
      if(signal?.aborted)return;
      onAction({name,value});
      if(name==="is_planted") lastCheck=value;
      if(value) {
        if(key==="tut_2" && ["till","plant","water","harvest"].includes(name) && (name!=="plant"||args[0]==="wheat") && (name!=="harvest"||value==="wheat")) progress(name);
        if(key==="intro_run"&&name==="right")progress("right");
        if(key==="intro_build"&&name==="down")progress("down");
        if(key==="cs_jump_0"&&name==="jump")progress("jump");
        if(key==="cs_wait_0"&&name==="wait"&&Number(args[0])>0)progress("wait");
        if(key==="cs_cleanup_0"&&name==="destroy"&&inDeadCondition)progress("destroy");
        if(key==="cs_if_0"&&name==="plant"&&args[0]==="wheat"&&inPlantCondition)progress("plant");
        if(["intro_sequence","intro_loop"].includes(key)){
          if(key==="intro_loop"&&!inLoop)moves.length=0;
          else moves.push(name);
          if(key==="intro_sequence"&&moves.slice(-2).join()==="left,right"){progress("left");progress("right");}
          if(key==="intro_loop"&&moves.slice(-4).join()==="left,right,left,right"&&inLoop){progress("trip-1");progress("trip-2");}
        }
      }
      callback(value);
    });
  };
  bot.say=value=>{
    api.bot.say(value);
    if(key==="intro_say"&&String(value).trim())progress("say");
    if(key==="cs_check_0"&&typeof value==="boolean"&&value===lastCheck){progress(String(value));lastCheck=null;}
    if(key==="cs_grid_0"&&lastNumber!==null&&value===lastNumber)progress("rows");
    if(key==="cs_random_0"&&value===lastNumber)progress("random");
  };
  const globals={...api.globals,rows:()=>lastNumber=api.globals.rows(),randint:(a,b)=>lastNumber=api.globals.randint(a,b),randfloat:(a,b)=>lastNumber=api.globals.randfloat(a,b)};
  runner=new Interpreter(source,createInterpreterInit({bot,globals,shop:{},inventory:{},console:{},hooks:{}}));
  while(!robot.is_available){signal?.throwIfAborted();await yieldControl();}
  while(true){
    signal?.throwIfAborted();
    if(runner.getStatus()===Interpreter.Status.ASYNC){await yieldControl();continue;}
    if(++steps>8000)throw Error("This loop needs an ending. Change it, then try again.");
    if(!runner.step())break;
    if(steps%500===0)await yieldControl();
  }
}
