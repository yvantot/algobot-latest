<script>
 import { onMount } from "svelte";
 import { slide } from "svelte/transition";
 import { DOCUMENT_DATA,CROP_DATA } from "../game/global/global.js";
 import { QUEST_DATA } from "../game/global/quests.js";
 import { currentQuest,UNLOCK_VERSION,TUTORIAL } from "./global.svelte.js";
 import { DOC_CATEGORIES,documentationEntries,filterDocumentation,insertionProblem,recommendedCommands } from "../game/global/documentation.js";
 import DocumentationBlocks from "./DocumentationBlocks.svelte";
 let {onClose,onInsert,targetName,onPreview}=$props();
 let query=$state(""),category=$state("all"),availability=$state("all"),selected=$state(""),mode=$state("text"),recent=$state([]),message=$state("");
 let width=$state(400),reduced=$state(false),search,timer;
 const entries=$derived.by(()=>{UNLOCK_VERSION.count;return documentationEntries(DOCUMENT_DATA,QUEST_DATA);});
 const results=$derived(filterDocumentation(entries,query,category,availability));
 const filtering=$derived(!!query.trim()||category!=="all"||availability!=="all");
 const recommended=$derived(recommendedCommands(QUEST_DATA[currentQuest()],entries));
 const common=$derived(entries.filter(e=>["right","till","plant","water","harvest"].includes(e.name)&&e.category.startsWith("bot_")));
 const recentEntries=$derived(recent.map(id=>entries.find(e=>e.id===id)).filter(Boolean));
 onMount(()=>{reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;search?.focus();return()=>clearTimeout(timer);});
 function notify(text){message=text;clearTimeout(timer);timer=setTimeout(()=>message="",3500);}
 function open(entry){selected=selected===entry.id?"":entry.id;mode="text";if(selected)recent=[entry.id,...recent.filter(id=>id!==entry.id)].slice(0,5);}
 async function copy(code){try{await navigator.clipboard.writeText(code);notify("Copied");}catch{notify("Copy failed. Select and copy the example text.");}}
 async function insert(entry,editor){try{const reason=insertionProblem(entry,entries);if(reason)throw new Error(reason);if(editor==="text"&&TUTORIAL.active)throw new Error("Text coding unlocks after your first loop.");await onInsert(entry.example,editor);notify(`Inserted into ${targetName(editor)}. Undo in the editor to remove it.`);}catch(error){notify(error.message);}}
 function reset(){query="";category="all";availability="all";}
 function resize(node){let start;const move=e=>{if(start)width=Math.max(320,Math.min(540,start.width+start.x-e.clientX));};const stop=()=>start=null;const down=e=>{start={x:e.clientX,width};node.setPointerCapture(e.pointerId);};node.addEventListener("pointerdown",down);node.addEventListener("pointermove",move);node.addEventListener("pointerup",stop);node.addEventListener("pointercancel",stop);return{destroy(){node.removeEventListener("pointerdown",down);node.removeEventListener("pointermove",move);node.removeEventListener("pointerup",stop);node.removeEventListener("pointercancel",stop);}};}
</script>
{#snippet cards(items)}
 {#each items as entry (entry.id)}
  <article class:chosen={selected===entry.id} class:locked={!entry.unlocked}>
   <div class="entry-title">{#if entry.icon}<img src={entry.icon} alt=""/>{/if}<h3>{entry.fullName}</h3><span>{entry.unlocked?"Unlocked":"Locked"}</span></div>
   <p>{entry.summary}</p>
   {#if entry.code}<pre><code>{entry.code.split("\n").slice(0,3).join("\n")}{entry.code.split("\n").length>3?"\n…":""}</code></pre>{/if}
   {#if !entry.unlocked}<p class="requirement">{entry.requirement?`Complete: ${entry.requirement}`:"Not yet unlocked."}</p>{/if}
   <button aria-expanded={selected===entry.id} onclick={()=>open(entry)}>{selected===entry.id?"Hide details":"Details"}</button>
   {#if selected===entry.id}<div class="details" transition:slide={{duration:reduced?0:200}}>
    {#if entry.code}
     <div class="actions"><button aria-pressed={mode==="text"} onclick={()=>mode="text"}>Text</button><button aria-pressed={mode==="blocks"} disabled={!entry.example?.block} onclick={()=>mode="blocks"}>Blockly</button></div>
     {#if mode==="blocks"&&entry.example?.block}{#key entry.id}<DocumentationBlocks block={entry.example.block}/>{/key}{:else}<pre role="region" aria-label="Text example" tabindex="0"><code>{entry.code}</code></pre>{/if}
     {#if !entry.example?.block}<p class="small">This reference has no insertion example.</p>{/if}
     <button onclick={()=>copy(entry.code)}>Copy code</button>
     <p class="small">Blockly: {targetName("blocks")} · Text: {targetName("text")}</p>
     <div class="actions"><button class="primary" disabled={!!insertionProblem(entry,entries)} onclick={()=>insert(entry,"blocks")}>Insert into Blockly</button><button disabled={!!insertionProblem(entry,entries)||TUTORIAL.active} onclick={()=>insert(entry,"text")}>Insert into text</button></div>
     {#if insertionProblem(entry,entries)}<p class="small">{insertionProblem(entry,entries)}</p>{/if}
     {#if TUTORIAL.active}<p class="small">Text coding unlocks after your first loop.</p>{/if}
    {/if}
    {#if entry.arguments}<h4>Arguments</h4><pre>{entry.arguments}</pre>{/if}
    {#if entry.note}<h4>Remember</h4><p>{entry.note}</p>{/if}
    {#if entry.category==="crops"&&CROP_DATA[entry.name]}{@const stats=CROP_DATA[entry.name]}<p>Health: {stats.health} · Coins: {stats.reward} · EXP: {stats.exp}<br/>Growth: {stats.duration}s · Spoilage: {stats.spoilage_time}s</p>{#if entry.strength}<p><strong>Strength:</strong> {entry.strength}</p>{/if}{#if entry.weakness}<p><strong>Weakness:</strong> {entry.weakness}</p>{/if}{/if}
    {#if ["bot_movement/right","bot_farm_actions/plant","bot_farm_actions/water","bot_farm_actions/harvest","bot_farm_actions/extinguish"].includes(entry.id)}<button onclick={()=>onPreview(entry.name)}>Watch example</button>{/if}
   </div>{/if}
  </article>
 {/each}
{/snippet}
<section class="documentation" style:width="{width}px" aria-label="Documentation">
 <button class="resize" aria-label="Resize documentation" use:resize onkeydown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();width=Math.max(320,Math.min(540,width+(e.key==="ArrowLeft"?20:-20)));}}}></button>
 <header><img src="/sprites/bot_teacher.png" alt="Bot Teacher"/><h1>Documentation</h1><button aria-label="Close documentation" onclick={onClose}>✕</button></header>
 <div class="search"><input bind:this={search} bind:value={query} aria-label="Search command names" placeholder="Search commands…"/><button onclick={()=>query=""} aria-label="Clear search">Clear</button></div>
 <div class="filters"><label>Category<select bind:value={category}><option value="all">All categories</option>{#each Object.entries(DOC_CATEGORIES) as [id,label]}<option value={id}>{label}</option>{/each}</select></label><label>Availability<select bind:value={availability}><option value="all">All</option><option value="unlocked">Unlocked</option><option value="locked">Locked</option></select></label></div>
 {#if message}<p class="feedback" role="status">{message}</p>{/if}
 <div class="results">
  {#if filtering}<div class="results-title"><h2>{results.length} results</h2><button onclick={reset}>Clear filters</button></div>{@render cards(results)}{#if !results.length}<p>No commands match “{query}” with these filters.</p>{/if}
  {:else}
   {#if recommended.length}<h2>For your current mission</h2><p class="small">{QUEST_DATA[currentQuest()]?.title}</p>{@render cards(recommended)}{/if}
   <h2>Common commands</h2>{@render cards(common.filter(e=>!recommended.some(r=>r.id===e.id)))}
   {#if recentEntries.length}<h2>Recently viewed</h2><div class="actions">{#each recentEntries as entry}<button onclick={()=>{category=entry.category;query=entry.fullName;selected=entry.id;}}>{entry.fullName}</button>{/each}</div>{/if}
   <h2>Browse categories</h2><div class="actions">{#each Object.entries(DOC_CATEGORIES) as [id,label]}<button onclick={()=>category=id}>{label}</button>{/each}</div>
  {/if}
 </div>
</section>
<style>
 pre,code{user-select:text;font-family:"Courier Prime",monospace}
 .documentation{position:relative;display:flex;flex-direction:column;gap:10px;height:min(78vh,850px);max-width:calc(100vw - 24px);padding:12px;background:#f3f4f6;border:4px solid #64748b;border-radius:12px;color:#334155;box-shadow:0 8px 20px #0003;font-size:13px}header{display:flex;align-items:center;gap:10px;border-bottom:2px solid #94a3b8;padding-bottom:10px}header img{width:40px;image-rendering:pixelated}header h1{flex:1;font-size:16px;font-weight:700}.search,.filters,.actions,.results-title{display:flex;gap:8px}.actions{flex-wrap:wrap}.search input{min-width:0;flex:1}.filters label{flex:1;min-width:0;font-size:12px}.filters select{display:block;width:100%;margin-top:4px}input,select,button{font:inherit;border:2px solid #94a3b8;border-radius:6px;padding:8px;background:#fff}button{cursor:pointer;background:#e5e7eb;font-weight:600}button:disabled{cursor:not-allowed;color:#475569;background:#e5e7eb}button.primary,button[aria-pressed=true]{background:#bbf7d0}button:focus-visible,input:focus-visible,select:focus-visible,pre:focus-visible{outline:3px solid #16a34a;outline-offset:3px}.results{overflow:auto;min-height:0;padding:2px 4px 4px 2px}.results-title{align-items:center;justify-content:space-between}h2{font-size:14px;font-weight:700;margin:12px 0 8px}article{padding:10px;border:2px solid #cbd5e1;border-radius:8px;background:#fff;margin:8px 0}article.chosen{background:#f0fdf4;border-color:#4ade80}article.locked{background:#e5e7eb}.entry-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.entry-title img{width:32px;height:32px;object-fit:contain;image-rendering:pixelated}h3{font-family:"Courier Prime",monospace;font-size:15px;font-weight:700;overflow-wrap:anywhere;flex:1}.entry-title span,.small{font-size:12px;color:#475569}p{line-height:1.45;margin:8px 0}pre{font-family:"Courier Prime",monospace;background:#f3f4f6;border:1px solid #cbd5e1;border-radius:6px;padding:8px;overflow:auto;font-size:13px;margin:8px 0}h4{font-weight:bold;margin-top:10px}.details{margin-top:10px}.requirement{font-size:12px;font-weight:600}.feedback{background:#dcfce7;padding:8px;border-radius:6px;margin:0}.resize{position:absolute;left:-7px;top:60px;bottom:20px;width:8px;padding:0;border:0;background:transparent;cursor:ew-resize;touch-action:none}@media(max-width:1100px){.documentation{height:60vh;width:min(400px,calc(100vw - 24px))!important}.resize{display:none}}
</style>
