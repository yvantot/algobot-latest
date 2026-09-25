<script>
  import { onMount } from "svelte";
  import { createBotTextEditor } from "../lib/bot-text-editor.js";

  let { value = $bindable(""), commands = null, readOnly = false, label = "Robot JavaScript program", onEdit = () => {} } = $props();
  let host, editor = $state.raw(null), syncing = false;
  onMount(() => {
    editor = createBotTextEditor({parent:host,doc:value,commands,readOnly,label,onChange(code){
      if (!syncing) { value=code; onEdit(); }
    }});
    const mounted=editor;
    const observer=new ResizeObserver(()=>mounted.view.requestMeasure());
    observer.observe(host);
    return ()=>{observer.disconnect();mounted.view.destroy();editor=null;};
  });
  $effect(()=>{
    if(editor && editor.view.state.doc.toString()!==value){
      syncing=true;
      try{editor.view.dispatch({changes:{from:0,to:editor.view.state.doc.length,insert:value}});}
      finally{syncing=false;}
    }
  });
  $effect(()=>{editor?.setReadOnly(readOnly);});
</script>

<div class="editor" bind:this={host}></div>

<style>
  .editor{height:100%;min-width:0;text-align:left}
</style>
