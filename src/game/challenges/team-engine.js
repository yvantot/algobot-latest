import { createCommandAPI } from "../global/command-api.js";
import { createInterpreterInit } from "../global/interpreter-bindings.js";

export async function evaluateTeam(source, task, Interpreter, {world,signal,onCase,onAction,yieldControl}) {
  let programs;
  try { programs=JSON.parse(source).programs; } catch { throw Error("Give each bot its own program."); }
  if (!Array.isArray(programs) || programs.length!==2 || programs.some(code=>typeof code!=="string"||!code.trim())) throw Error("Both bots need a program.");
  const results=[];
  for(const [index,layout] of task.cases.entries()) {
    signal?.throwIfAborted(); world.reset(layout,task); onCase(index);
    const watered=new Set(), harvested=new Set(), announced=new Set(), received=new Set(), trace=[];
    let error=null, fatal=null, idleChecks=0;
    const movements=[new Map(),new Map()];
    try {
      const interpreters=world.robots.map((robot,id)=>{
        const api=createCommandAPI({robot,farmSize:()=>({columns:layout.length,rows:1})});
        const bot={say:api.bot.say};
        for(const name of task.commands) {
          if(["send","receive","has_message"].includes(name)) {
            bot[name]=(...args)=>{
              if(++idleChecks>80)throw Error("The team is waiting without doing any work. Check which bot sends the next message; use bot.wait in waiting loops.");
              const announcing=name==="send"&&id===0&&args[0]===1&&Number.isInteger(args[1])&&robot.readCrop("crop_value",args[1],0)>0;
              const value=api.bot[name](...args);
              if(name==="send"&&!value)throw Error("The message could not be sent. Check the bot number and inbox space.");
              if(announcing&&value)announced.add(robot.sentMessageId());
              const readyMessage=name==="receive"&&id===1&&announced.has(robot.messageReceipt()?.id);
              if(readyMessage)received.add(value);
              const event={bot:id,command:name,args,value,readyMessage};trace.push(event);onAction(event);return value;
            };
          } else {
            bot[name]=(...args)=>{
              const done=args.pop(),x=robot.grid_x;
              if((id===0&&name==="harvest")||(id===1&&name==="water")){fatal=`Bot ${id} took the other bot's job. Bot 0 waters; Bot 1 harvests.`;done(false);return;}
              api.bot[name](...args,value=>{
                if(signal?.aborted)return;
                if(!name.startsWith("is_")&&!value)fatal=`Bot ${id}: bot.${name} failed on tile ${x}.`;
                if(value&&["water","harvest"].includes(name)){idleChecks=0;movements.forEach(map=>map.clear());}
                if(["left","right","jump"].includes(name)){
                  const key=JSON.stringify([name,args,robot.grid_x,robot.grid_y]);
                  movements[id].set(key,(movements[id].get(key)??0)+1);
                  if(movements[id].get(key)>4)fatal=`Bot ${id} keeps moving without doing any farm work. Check its stopping condition.`;
                }
                if(value&&name==="water")watered.add(x);
                if(value&&name==="harvest")harvested.add(x);
                const event={bot:id,command:name,args,value,position:robot.grid_x};trace.push(event);onAction(event);done(value);
              });
            };
          }
        }
        const init=createInterpreterInit({bot,globals:api.globals,hooks:{},shop:{},inventory:{},console:{}});
        return new Interpreter(programs[id],(runner,scope)=>{
          init(runner,scope);runner.setProperty(scope,"Date",runner.UNDEFINED);
          runner.setProperty(runner.getProperty(scope,"Math"),"random",runner.createNativeFunction(()=>{throw Error("Use a repeatable plan without random numbers.");}));
        });
      });
        while(world.robots.some(bot=>!bot.is_available)){signal?.throwIfAborted();await yieldControl();}
      const steps=[0,0],finished=[false,false];
      while(!finished.every(Boolean)) {
        signal?.throwIfAborted();if(fatal)throw Error(fatal);
        for(const [id,runner] of interpreters.entries()) {
          for(let batch=0;batch<100&&!finished[id]&&runner.getStatus()!==Interpreter.Status.ASYNC;batch++) {
            if(++steps[id]>12000)throw Error(`Bot ${id} ran too many steps. Check its loop's stopping condition.`);
            finished[id]=!runner.step();
          }
        }
        await yieldControl();
      }
      if(fatal)throw Error(fatal);
    } catch(caught){if(signal?.aborted)throw caught;error=caught.message||String(caught);}
    // A received column must precede its harvest, not merely appear later.
    const delivered=new Set();let shared=true;
    for(const event of trace){
      if(event.readyMessage)delivered.add(event.value);
      if(event.command==="harvest"&&event.value&&!delivered.has(event.position))shared=false;
    }
    const checks={team_harvest:watered.size===layout.length&&harvested.size===layout.length,
      shared_work:shared&&received.size===layout.length&&harvested.size===layout.length,safe_and_finished:!error};
    results.push({checks,passed:Object.values(checks).every(Boolean),error,mistakes:error?1:0,trace});
  }
  return {results,passed:results.every(row=>row.passed),score:results.reduce((sum,row)=>sum+Object.values(row.checks).filter(Boolean).length,0),max_score:task.rules.length*task.cases.length};
}
