<script>
 import DemoProgramPanel from "./DemoProgramPanel.svelte";
 import {onMount,onDestroy} from "svelte";
 import {fade,fly} from "svelte/transition";
 import {startLiveDemonstration} from "../game/global/live-demonstration.js";
 import {INTRODUCTION_STORY} from "../game/global/introduction-story.js";
 let {name,onClose}=$props();
 const action=$derived(name);
 const story=$derived(INTRODUCTION_STORY.find(step=>step.action===action));
 let purchase=$state(null),traversing=$state(false),working=$state(false);
 let controller,closeButton,ready=$state(false),error=$state(false),line=$state(-1),reduced=$state(false);
 function play(){controller?.dispose();ready=false;error=false;purchase=null;traversing=false;working=false;try{controller=startLiveDemonstration(update=>{if(update.purchase!==undefined)purchase=update.purchase;if(update.traversing)traversing=true;if(update.working!==undefined)working=update.working;if(update.ready!==undefined)ready=update.ready;if(update.line!==undefined)line=update.line;if(update.error)error=true;},{singleAction:action});}catch{error=true;ready=true;}}
 onMount(()=>{reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;closeButton?.focus();play();});
 onDestroy(()=>controller?.dispose());
</script>
<svelte:window onkeydown={event=>{if(event.key==="Escape"){event.stopImmediatePropagation();onClose();}}}/>
<section class="clay-menu live-cutscene" aria-label="Command demonstration" transition:fade={{duration:reduced?0:300}}>
 <button class="close" bind:this={closeButton} onclick={onClose}>Close example</button>
 {#if story?.code.some(command=>!command.startsWith("//"))}<DemoProgramPanel program={{bot:0,code:story.code}} {line} reduced={reduced} dynamicGrid={traversing} {working}/>{/if}
 {#if purchase}<div class="clay-shell purchase"><p>Try it on this practice farm. Your coins are safe.</p><button onclick={()=>controller?.purchase(purchase.id)}>{purchase.label}</button></div>{/if}
 {#if ready}<div class="clay-shell teacher" in:fly={{y:20,duration:reduced?0:300}}><img src="/sprites/bot_teacher.png" alt="Bot Teacher"/><div><h2>{story.title}</h2><p>{error?"The preview could not start. Close it to return to the reference example.":story.text}</p><p class="status" role="status">{error?"Preview unavailable":ready?"Example complete. Your farm and program are unchanged.":"Watch the robot and its highlighted command."}</p><button disabled={!ready} onclick={play}>Replay</button></div></div>{/if}
</section>
<style>.purchase{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);background:#f3f4f6;padding:16px;border:3px solid #64748b;border-radius:10px;text-align:center}.live-cutscene{font-size:16px;position:fixed;inset:0;z-index:10000;padding:18px;display:flex;flex-direction:column;justify-content:space-between;color:#334155;background:linear-gradient(#17251b44,transparent 30%,transparent 65%,#17251b55)}button{font:inherit;font-weight:bold;background:#bbf7d0;border:2px solid #64748b;border-radius:6px;padding:9px 14px;cursor:pointer}button:focus-visible{outline:3px solid #16a34a;outline-offset:3px}button:disabled{background:#e5e7eb;cursor:default}.close{align-self:flex-end}h2{font-size:16px;font-weight:bold}.teacher{margin-top:auto;align-self:center;width:min(850px,100%);background:#f3f4f6;border:4px solid #64748b;border-radius:12px;padding:16px;display:flex;gap:14px}.teacher img{width:60px;height:60px;image-rendering:pixelated}.teacher p{font-size:17px;margin:8px 0}.teacher .status{font-size:14px}@media(max-width:700px){.teacher img{display:none}.teacher{max-height:40vh;overflow:auto}}</style>
