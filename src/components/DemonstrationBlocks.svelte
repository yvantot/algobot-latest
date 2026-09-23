<script>
  import { onMount } from "svelte";
  import * as Blockly from "blockly";
  import { commandExample } from "../game/global/documentation.js";
  let { code, line = -1, repeat = 0, checkHarvest = false } = $props();
  let host, workspace = $state();
  const ids = new Map();
  onMount(() => {
    workspace = Blockly.inject(host, { readOnly: true, renderer: "zelos", scrollbars: true,
      zoom: { startScale: 1 }, sounds: false });
    const observer = new ResizeObserver(() => Blockly.svgResize(workspace));
    observer.observe(host);
    return () => { observer.disconnect(); workspace.dispose(); };
  });
  $effect(() => {
    if (!workspace) return;
    workspace.clear(); ids.clear();
    let root, previous;
    code.forEach((command, index) => {
      const match=command.match(/(bot|shop)\.(\w+)/);
      if(!match)return;
      const [,owner,name]=match;
      const category=owner==="shop"?"shop":["right","left","up","down"].includes(name)?"bot_movement":"bot_farm_actions";
      const example=commandExample(category,name);
      if(!example?.block)return;
      const state=structuredClone(example.block);
      state.id=Blockly.utils.idGenerator.genUid(); ids.set(index,state.id);
      if(name==="wait")state.inputs.AMOUNT.shadow.fields.NUM=Number(command.match(/\((\d+)/)?.[1] ?? 3);
      if(name==="say")state.inputs.TEXT.shadow.fields.TEXT=command.match(/"([^"]*)"/)?.[1] ?? "Hello!";
      const node=checkHarvest&&name==="harvest"?{type:"controls_if",inputs:{IF0:{block:{type:"bot_is_harvestable"}},DO0:{block:state}}}:state;
      if(previous)previous.next={block:node};else root=node;
      previous=node;
    });
    if(root){
      if(repeat)root={type:"controls_repeat_ext",inputs:{TIMES:{shadow:{type:"math_number",fields:{NUM:repeat}}},DO:{block:root}}};
      Blockly.serialization.blocks.append({...root,x:15,y:15},workspace);
    }
    Blockly.svgResize(workspace);
  });
  $effect(() => { if (workspace) workspace.highlightBlock(ids.get(line) ?? null); });
</script>

<div class="blocks" bind:this={host} role="img" aria-label="Robot blocks: {code.filter(command => !command.startsWith('//')).join(' then ')}"></div>
{#if code.every(command => command.startsWith('//'))}<p>No blocks running. Watch the farm.</p>{/if}
<style>
  .blocks{height:220px;width:100%;background:white}p{font-size:15px;padding:10px 14px;margin:0;color:#475569}
  @media(max-width:700px){.blocks{height:150px}}
</style>
