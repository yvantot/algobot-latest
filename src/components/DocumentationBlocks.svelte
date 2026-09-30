<script>
 import { onMount } from "svelte";
 import * as Blockly from "blockly";
 let {block}=$props(); let host; let error=$state("");
 onMount(()=>{let workspace;try{workspace=Blockly.inject(host,{readOnly:true,renderer:"zelos",scrollbars:true,zoom:{startScale:.8},sounds:false});Blockly.serialization.blocks.append(structuredClone(block),workspace);workspace.zoomToFit();}catch{error="Blockly preview unavailable. Use the text example.";}return()=>workspace?.dispose();});
</script>
<div class="preview" bind:this={host} aria-label="Blockly example"></div>{#if error}<p role="status">{error}</p>{/if}
<style>.preview{height:150px;width:100%;border:1px solid #94a3b8;border-radius:6px;overflow:hidden}p{font-size:14px}</style>
