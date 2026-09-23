<script>
  import { onMount } from "svelte";
  import * as Blockly from "blockly";
  let { code, line = -1 } = $props();
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
    let previous;
    code.forEach((command, index) => {
      if (command.startsWith("//")) { if (command.includes("Bot")) previous = null; return; }
      const name = command.match(/bot\.(\w+)/)?.[1];
      if (!name || !Blockly.Blocks[`bot_${name}`]) return;
      const block = workspace.newBlock(`bot_${name}`);
      if (name === "plant") block.setFieldValue("wheat", "TYPE");
      block.initSvg(); block.render();
      if (previous) previous.nextConnection.connect(block.previousConnection);
      else block.moveBy(15, 15 + (index > 2 ? 100 : 0));
      previous = block; ids.set(index, block.id);
    });
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
