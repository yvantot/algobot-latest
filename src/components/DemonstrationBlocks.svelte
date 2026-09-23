<script>
  import { onMount } from "svelte";
  import * as Blockly from "blockly";
  import { commandExample } from "../game/global/documentation.js";
  let { code, line = -1, repeat = 0, checkHarvest = false, dynamicGrid = false } = $props();
  let host, workspace = $state();
  const ids = new Map();
  const crops = new Map();
  onMount(() => {
    workspace = Blockly.inject(host, { readOnly: true, renderer: "zelos", scrollbars: true,
      zoom: { startScale: 1 }, sounds: false });
    const observer = new ResizeObserver(() => Blockly.svgResize(workspace));
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
      const columnLoop={type:"controls_for",fields:{VAR:{id:column}},inputs:{FROM:number(0),TO:limit("columns"),BY:number(1),DO:{block:jump}}};
      root={type:"controls_for",fields:{VAR:{id:row}},inputs:{FROM:number(0),TO:limit("rows"),BY:number(1),DO:{block:columnLoop}}};
    }
    if(root){
      if(repeat)root={type:"controls_for",fields:{VAR:{id:counter}},inputs:{FROM:{shadow:{type:"math_number",fields:{NUM:0}}},TO:{shadow:{type:"math_number",fields:{NUM:repeat-1}}},BY:{shadow:{type:"math_number",fields:{NUM:1}}},DO:{block:root}}};
      Blockly.serialization.blocks.append({...root,x:15,y:15},workspace);
      for(const [id,type] of crops){
        const field=workspace.getBlockById(id)?.getField("TYPE");
        field?.setOptions(["wheat","corn","rice","potato","tomato","sugarcane"].map(name=>[name,name]));field?.setValue(type);
      }
    }
    Blockly.svgResize(workspace);
  });
  $effect(() => { if (workspace) workspace.highlightBlock(ids.get(line) ?? null); });
</script>

<div class="blocks" bind:this={host} role="img" aria-label="Robot blocks: {dynamicGrid ? "For each row and column, jump to that tile" : code.filter(command => !command.startsWith('//')).join(' then ')}"></div>
{#if code.every(command => command.startsWith('//'))}<p>No blocks running. Watch the farm.</p>{/if}
<style>
  .blocks{height:220px;width:100%;background:white}p{font-size:15px;padding:10px 14px;margin:0;color:#475569}
  @media(max-width:700px){.blocks{height:150px}}
</style>
