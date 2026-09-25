import { createCommandAPI } from "../global/command-api.js";
import { createInterpreterInit } from "../global/interpreter-bindings.js";
import { bestRouteValue } from "./scenarios.js";

export async function evaluateScenario(source, task, Interpreter, {world,signal,onCase,onAction,yieldControl}) {
  const results = [];
  for (const [index, layout] of task.cases.entries()) {
    signal?.throwIfAborted();
    const robot = world.reset(layout, task);
    const api = createCommandAPI({robot,farmSize:()=>({columns:layout.length,rows:1})});
    const trace=[], harvested=new Set(), treatments=new Map();
    const initialValues=layout.map((_,x)=>robot.readCrop("crop_value",x,0));
    const optimum=task.kind === "planning" ? bestRouteValue(initialValues,task.budget) : 0;
    let used=0, earned=0, calls=0, sensorCalls=0, fatal=null, error=null, loops=0, conditions=0, greedy=true;
    const repeated=new Map();let progress=world.progress?.();
    let interpreter;
    const loopWatered=new Set(), conditionalTreatments=new Map();
    const budget=task.kind === "planning" ? task.budget : task.kind === "irrigation" ? 2*layout.length-1 : Infinity;
    const bot={say:value=>api.bot.say(String(value).slice(0,120))};
    for (const name of task.commands) {
      if (name.startsWith("crop_")) {
        bot[name]=(x,y)=>{
          if(++sensorCalls>1200)throw Error("Too many checks. Stop your loop when the plan is ready.");
          return robot.readCrop(name,x,y);
        };
        continue;
      }
      bot[name]=(...args)=>{
        const done=args.pop();
        if(++calls>(task.kind==="sequence"?600:120)){fatal="Too many actions. Check where your loop stops.";done(false);return;}
        const x=robot.grid_x, check=name.startsWith("is_");
        const cost=check?0:name==="jump"?Math.abs(args[0]-x):1;
        if (!Number.isFinite(cost) || used+cost>budget) {fatal="That action goes over the work-step budget. Choose a shorter plan.";done(false);return;}
        if (task.kind==="sequence" && name==="plant" && args[0]!=="corn") {fatal="This order is for corn. Plant corn on each tile.";done(false);return;}
        const valueBefore=robot.readCrop("crop_value",x,0);
        const frames=interpreter?.getStateStack() ?? [];
        const inLoop=frames.some(frame=>["ForStatement","WhileStatement","DoWhileStatement","ForInStatement"].includes(frame.node?.type));
        const inCondition=frames.some(frame=>frame.node?.type==="IfStatement");
        if(name==="harvest" && task.kind==="greedy") {
          const priorities=layout.map((_,i)=>{
            const seconds=robot.readCrop("crop_time_left",i,0);
            return seconds>0?robot.readCrop("crop_value",i,0)/seconds:0;
          });
          if(priorities[x]+1e-9<Math.max(...priorities))greedy=false;
        }
        api.bot[name](...args,value=>{
          if(signal?.aborted)return;
          if(!check)used+=cost;
          if(!check&&!value)fatal=`bot.${name} failed on tile ${x}. Check the crop and soil before acting.`;
          const nextProgress=world.progress?.();
          if(nextProgress!==progress){repeated.clear();progress=nextProgress;}
          const key=JSON.stringify([name,args,robot.grid_x,robot.grid_y,value]);
          repeated.set(key,(repeated.get(key)??0)+1);
          if(repeated.get(key)>4)fatal="Your program repeats the same work without changing the farm. Check what should end the loop.";
          if(value&&!check){
            if(["harvest","water","destroy"].includes(name))treatments.set(x,name);
            if(inCondition&&["harvest","water","destroy"].includes(name))conditionalTreatments.set(x,name);
            if(inLoop&&name==="water")loopWatered.add(x);
            if(name==="harvest"){harvested.add(x);earned+=valueBefore;}
          }
          const event={command:name,args,value,position:robot.grid_x,work_steps:used,earned};
          trace.push(event);onAction(event);done(value);
        });
      };
    }
    onCase(index);
    onAction({command:"start",work_steps:0,earned:0,budget:Number.isFinite(budget)?budget:null});
    try {
      while(!robot.is_available){signal?.throwIfAborted();await yieldControl();}
      const init=createInterpreterInit({bot,globals:{columns:api.globals.columns,rows:api.globals.rows},hooks:{},shop:{},inventory:{},console:{}});
      interpreter=new Interpreter(source,(runner,scope)=>{
        init(runner,scope); runner.setProperty(scope,"Date",runner.UNDEFINED);
        runner.setProperty(runner.getProperty(scope,"Math"),"random",runner.createNativeFunction(()=>{throw Error("Use the same plan for every test farm, without random numbers.");}));
      });
      let steps=0;
      while(true){
        signal?.throwIfAborted(); if(fatal)throw Error(fatal);
        if(interpreter.getStatus()===Interpreter.Status.ASYNC){await yieldControl();continue;}
        if(++steps>(task.kind==="sequence"?20000:8000))throw Error("Too many steps. Check your loop's stopping condition.");
        const before=interpreter.getStateStack().at(-1);
        const more=interpreter.step(), after=interpreter.getStateStack().at(-1);
        if(before?.node?.type==="IfStatement"&&after!==before&&after?.node!==before.node.test)conditions++;
        if(["ForStatement","WhileStatement","DoWhileStatement","ForInStatement"].includes(before?.node?.type)&&after!==before&&after?.node===before.node.body)loops++;
        if(!more)break;
        if(steps%1000===0)await yieldControl();
      }
    } catch(caught){if(signal?.aborted)throw caught;error=caught.message||String(caught);}
    const checks={};
    if(task.kind==="sequence") {
      checks.grew_corn=harvested.size===layout.length;
    }
    if(task.kind==="clinic") {
      checks.treated_every_crop=layout.every((tile,x)=>treatments.get(x)===(tile.state==="ready"?"harvest":tile.state==="dead"?"destroy":"water"));
      checks.used_condition=task.actionLinkedSyntax?layout.every((tile,x)=>conditionalTreatments.get(x)===(tile.state==="ready"?"harvest":tile.state==="dead"?"destroy":"water")):conditions>0;
    }
    if(task.kind==="irrigation") {
      checks.watered_every_crop=world.inspect().every(tile=>tile.watered);
      checks.used_loop=task.actionLinkedSyntax?loopWatered.size===layout.length:loops>0;checks.within_budget=used<=budget&&!fatal;
    }
    if(task.kind==="greedy"){checks.harvested_every_crop=harvested.size===layout.length;checks.greedy_order=greedy&&harvested.size===layout.length;}
    if(task.kind==="planning"){checks.best_yield=Math.abs(earned-optimum)<1e-9;checks.within_budget=used<=budget&&!fatal;}
    checks.safe_and_finished=!error;
    if(task.requireYield&&earned===0)for(const key of Object.keys(checks))checks[key]=false;
    results.push({checks,passed:Object.values(checks).every(Boolean),error,mistakes:error?1:0,trace,
      ...(task.kind==="planning"?{earned,optimal_value:optimum,work_steps:used}:{} )});
    if (task.kind === "planning") {
      onAction({command:"pests_arrive",work_steps:used,earned});
      await world.pestEnding?.({signal,yieldControl});
      onAction({command:"pests_finished",work_steps:used,earned});
    }
  }
  return {results,passed:results.every(row=>row.passed),score:results.reduce((n,row)=>n+Object.values(row.checks).filter(Boolean).length,0),max_score:task.rules.length*task.cases.length};
}
