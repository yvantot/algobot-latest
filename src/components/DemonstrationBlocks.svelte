<script>
  import { onMount } from "svelte";
  import * as Blockly from "blockly";
  import { commandExample } from "../game/global/documentation.js";
  let { code, line = -1, repeat = 0, forever = false, job = null, checkHarvest = false, dynamicGrid = false, working = false, fit = false } = $props();
  let host, workspace = $state();
  const ids = new Map();
  const crops = new Map();
  onMount(() => {
    workspace = Blockly.inject(host, { readOnly: true, renderer: "zelos", scrollbars: true,
      zoom: { startScale: 1, minScale: .2, maxScale: 1 }, sounds: false });
    const observer = new ResizeObserver(() => { Blockly.svgResize(workspace); if(fit)workspace.zoomToFit(); });
    observer.observe(host);
    return () => { observer.disconnect(); workspace.dispose(); };
  });
  $effect(() => {
    if (!workspace) return;
    workspace.clear(); ids.clear(); crops.clear();
    let root, previous;
    const counter = repeat ? workspace.getVariableMap().createVariable("column").getId() : null;
    code.forEach((command, index) => {
      const match=command.match(/(bot|shop)\.(\w+)/);
      if(!match)return;
      const [,owner,name]=match;
      const category=owner==="shop"?"shop":["right","left","up","down"].includes(name)?"bot_movement":"bot_farm_actions";
      const example=commandExample(category,name);
      if(!example?.block)return;
      const state=structuredClone(example.block);
      state.id=Blockly.utils.idGenerator.genUid(); ids.set(index,state.id);
      if(name==="wait")state.inputs.AMOUNT.shadow.fields.NUM=Number(command.match(/\(([\d.]+)/)?.[1] ?? 3);
      if(name==="say")state.inputs.TEXT.shadow.fields.TEXT=command.match(/"([^"]*)"/)?.[1] ?? "Hello!";
      if(name==="plant"){crops.set(state.id,command.match(/"([^"]*)"/)?.[1]??"wheat");delete state.fields.TYPE;}
      let node=checkHarvest&&name==="harvest"?{type:"controls_if",inputs:{IF0:{block:{type:"bot_is_harvestable"}},DO0:{block:state}}}:state;
      if(repeat && name==="right")node={type:"controls_if",inputs:{IF0:{block:{type:"logic_compare",fields:{OP:"LT"},inputs:{A:{block:{type:"variables_get",fields:{VAR:{id:counter}}}},B:{shadow:{type:"math_number",fields:{NUM:repeat-1}}}}}},DO0:{block:state}}};
      if(previous)previous.next={block:node};else root=node;
      previous=node;
    });
    if(dynamicGrid){
      const number=value=>({shadow:{type:"math_number",fields:{NUM:value}}});
      const row=workspace.getVariableMap().createVariable("row").getId(), column=workspace.getVariableMap().createVariable("column").getId();
      const variable=id=>({block:{type:"variables_get",fields:{VAR:{id}}}});
      const limit=name=>({block:{type:"math_arithmetic",fields:{OP:"MINUS"},inputs:{A:{block:{type:"global_"+name}},B:number(1)}}});
      const jump={type:"bot_jump",id:Blockly.utils.idGenerator.genUid(),inputs:{X:variable(column),Y:variable(row)}};
      ids.set(2,jump.id);
      if(working){const till={type:"bot_till",id:Blockly.utils.idGenerator.genUid()};ids.set(3,till.id);jump.next={block:till};}
      const columnLoop={type:"controls_for",fields:{VAR:{id:column}},inputs:{FROM:number(0),TO:limit("columns"),BY:number(1),DO:{block:jump}}};
      root={type:"controls_for",fields:{VAR:{id:row}},inputs:{FROM:number(0),TO:limit("rows"),BY:number(1),DO:{block:columnLoop}}};
    }
    if(job){
      const num=value=>({shadow:{type:"math_number",fields:{NUM:value}}});
      const variable=id=>({block:{type:"variables_get",fields:{VAR:{id}}}});
      const row=workspace.getVariableMap().createVariable("row").getId(),column=workspace.getVariableMap().createVariable("column").getId();
      const not=name=>({block:{type:"logic_negate",inputs:{BOOL:{block:{type:name}}}}});
      const when=(condition,body)=>({type:"controls_if",inputs:{IF0:condition,DO0:{block:body}}});
      let body;
      if(job==="plant"){
        const till=when(not("bot_check_tilled"),{type:"bot_till"});
        till.next={block:{type:"bot_plant",fields:{TYPE:"wheat"}}};
        body=when(not("bot_check_planted"),till);
      }else if(job==="water"){
        body=when({block:{type:"bot_check_planted"}},when(not("bot_is_harvestable"),when(not("bot_check_watered"),{type:"bot_water"})));
      }else body=when({block:{type:"bot_is_harvestable"}},{type:"bot_harvest"});
      const jump={type:"bot_jump",inputs:{X:variable(column),Y:variable(row)},next:{block:body}};
      const columns={block:{type:"math_arithmetic",fields:{OP:"MINUS"},inputs:{A:{block:{type:"global_columns"}},B:num(1)}}};
      const visit={type:"controls_for",fields:{VAR:{id:column}},inputs:{FROM:num(0),TO:columns,BY:num(1),DO:{block:jump}}};
      root={type:"controls_for",fields:{VAR:{id:row}},inputs:{FROM:num(0),TO:num(1),BY:num(1),DO:{block:visit}}};
      const say=structuredClone(commandExample("bot_farm_actions","say").block);
      say.inputs.TEXT.shadow.fields.TEXT=job==="plant"?"Seeds coming through!":job==="water"?"Water delivery!":"Room for new crops!";
      say.next={block:root};root=say;
    }
    if(root){
      if(repeat)root={type:"controls_for",fields:{VAR:{id:counter}},inputs:{FROM:{shadow:{type:"math_number",fields:{NUM:0}}},TO:{shadow:{type:"math_number",fields:{NUM:repeat-1}}},BY:{shadow:{type:"math_number",fields:{NUM:1}}},DO:{block:root}}};
      if(forever)root={type:"controls_whileUntil",fields:{MODE:"WHILE"},inputs:{BOOL:{block:{type:"logic_boolean",fields:{BOOL:"TRUE"}}},DO:{block:root}}};
      Blockly.serialization.blocks.append({...root,x:15,y:15},workspace);
      for(const [id,type] of crops){
        const field=workspace.getBlockById(id)?.getField("TYPE");
        field?.setOptions(["wheat","corn","rice","potato","tomato","sugarcane"].map(name=>[name,name]));field?.setValue(type);
      }
    }
    Blockly.svgResize(workspace);
    if(fit)workspace.zoomToFit();
  });
  $effect(() => { if (workspace) workspace.highlightBlock(ids.get(line) ?? null); });
</script>

<div class="blocks" bind:this={host} role="img" aria-label="Robot blocks: {dynamicGrid ? "For each row and column, jump to that tile" : code.filter(command => !command.startsWith('//')).join(' then ')}"></div>
{#if code.every(command => command.startsWith('//'))}<p>No blocks running. Watch the farm.</p>{/if}
<style>
  .blocks{height:220px;width:100%;background:white}p{font-size:15px;padding:10px 14px;margin:0;color:#475569}
  @media(max-width:700px){.blocks{height:150px}}
</style>
