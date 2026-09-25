<script>
  import { onMount, tick } from "svelte";
  import { fly, fade } from "svelte/transition";
  import { createChallengeWorkspace } from "../game/challenges/blocks.js";
  import { evaluateChallenge } from "../game/challenges/engine.js";
  import { startChallengeFarm } from "../game/challenges/live-farm.js";
  import { panelIn, panelOut } from "./interface.svelte.js";
  import {challengeRules} from "../game/challenges/catalog.js";
  import ChallengeRewards from "./ChallengeRewards.svelte";
  import Confetti from "./Confetti.svelte";

  let { task, onSubmit, onClose, onReward, onInterrupted = () => {}, rewardAvailable = true } = $props();
  let activeSource = null;
  let rules=$derived(challengeRules(task));
  let host, dialog, farmWindow, editor, world, controller, closingTimer;
  let mode = $state("blocks"), source = $state(""), running = $state(false), result = $state(null);
  let error = $state(""), reward = $state(false), caseIndex = $state(0), closing = $state(false), ready = $state(false);
  let speech = $state(task.description + (task.kind ? "" : " Every rule counts, not just the harvest!"));
  let mood = $state("welcome"), textEdited = false, disposed = false;
  let readings=$state([]), work=$state(null);
  function updateReadings() {
    if(!task.kind||!world?.robot)return;
    readings=task.cases[caseIndex].map((_,x)=>({x,type:world.robot.readCrop("crop_type",x,0),value:world.robot.readCrop("crop_value",x,0),seconds:world.robot.readCrop("crop_time_left",x,0)}));
  }
  onMount(() => {
    const opener = document.activeElement;
    dialog.focus();
    try {
      world = startChallengeFarm(() => farmWindow?.getBoundingClientRect());
      world.reset(task.cases[0],task); updateReadings();
      editor = createChallengeWorkspace(host,task); ready = true;
    } catch (e) { error = e.message; world?.dispose(); }
    const resize = new ResizeObserver(() => { editor?.resize(); world?.fit(); });
    resize.observe(host); resize.observe(farmWindow);
    const reposition = () => world?.fit();
    window.addEventListener("resize", reposition); dialog.addEventListener("scroll", reposition);
    return () => {
      stop(false); disposed = true; controller?.abort(); clearTimeout(closingTimer); resize.disconnect();
      window.removeEventListener("resize", reposition); dialog.removeEventListener("scroll", reposition);
      editor?.dispose(); world?.dispose(); opener?.focus();
    };
  });
  async function switchMode(value) {
    if (value === "text" && !textEdited && editor) source = editor.source();
    mode = value; await tick(); editor?.resize();
  }
  function preview(index) { caseIndex = index; work=null; world.reset(task.cases[index],task); updateReadings(); }
  async function run() {
    error = ""; reward = false;
    let code;
    try { code = mode === "blocks" ? editor.source() : source; } catch (e) { error = e.message; return; }
    if (!code.trim()) { speech = "Your robot is waiting for a plan. Give it a few blocks first!"; mood="think"; return; }
    running = true; result = null; mood="watch"; speech="All right, robot. Let's see that plan in action!";
    activeSource = code;
    controller = new AbortController();
    try {
      const outcome = await evaluateChallenge(code, task, globalThis.Interpreter, { world, signal: controller.signal, onCase: index => {caseIndex=index;updateReadings();},
        onAction:event=>{if(task.kind){work=event;updateReadings();}} });
      if (disposed || closing) return;
      activeSource = null;
      onSubmit(outcome, code, mode);
      result=outcome; mood=outcome.passed?"happy":"think";
      speech = task.kind ? outcome.passed ? "Now that's a plan! I might let you run MY farm next." : "The farm has a different idea! Look at the rules below to see what your plan missed."
        : outcome.passed ? "Well, look at you! Every ripe crop, every row. I may have to borrow YOUR farming plan."
        : outcome.results.some(row=>row.mistakes) ? "Hungry robot? Some crops weren't ready; or you wandered past the farm! Try checking before you act."
        : outcome.results.some(row=>row.error) ? "Your robot got tangled in its instructions. Check the message, then give it another go!"
        : "Sneaky wheat! You left some work behind. Make sure your bot visits the last tile too.";
    } catch (e) { if (!disposed && !closing && !controller.signal.aborted) error=e.message; }
    finally { activeSource=null; if (!disposed) running=false; }
  }
  function stop(reset=true) {
    if(!running||activeSource===null)return;
    onInterrupted(activeSource,mode); activeSource=null; controller?.abort();
    if(reset){world.reset(task.cases[caseIndex],task);updateReadings();}
    speech="Stopped! Your program is still here. Change the loop, then try again.";
    mood="think";
  }
  function collect() { reward=onReward(); if(reward){mood="happy";speech="A deal's a deal! Your farm rewards are ready.";} }
  function exitChallenge() {
    if(closing)return;
    stop(false); closing=true; controller?.abort();
    closingTimer=setTimeout(()=>{world?.dispose();onClose();},matchMedia("(prefers-reduced-motion: reduce)").matches?0:300);
  }
  function keys(event) {
    if(event.key==="Escape"){event.preventDefault();event.stopPropagation();exitChallenge();}
    if(event.key!=="Tab")return;
    const items=[...dialog.querySelectorAll('button:not(:disabled), textarea, [tabindex="0"]')].filter(el=>el.getClientRects().length);
    if(event.shiftKey&&(document.activeElement===items[0]||document.activeElement===dialog)){event.preventDefault();items.at(-1)?.focus();}
    else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0]?.focus();}
  }
</script>

<div class="live-challenge" role="dialog" aria-modal="true" aria-labelledby="challenge-title" tabindex="-1" bind:this={dialog} onkeydown={keys}>
  <div class="curtain" class:closing></div>
  <header in:fly={{y:-25,duration:300}} out:fade><div><span>BOT TEACHER'S CHALLENGE · {task.tier}</span><h1 id="challenge-title">{task.title}</h1></div><button onclick={exitChallenge} disabled={closing}>Back to farm</button></header>
  <div class="layout">
    <section class="farm-side">
      <div class="rounds">{#each task.cases as layout,i}<button disabled={running||!ready||closing} aria-pressed={caseIndex===i} onclick={()=>preview(i)}>Row {i+1}</button>{/each}<span>{running?"Your robot is working…":`One program. ${task.cases.length} test ${task.cases.length===1?"row":"rows"}.`}</span></div>
      <div class="farm-window" bind:this={farmWindow} aria-label="Live challenge farm"></div>
      {#if task.kind}
        <div class="scenario-status" aria-live="polite">
          <strong>{task.skill}</strong>
          {#if task.kind==="planning"}<p>Storm deadline: {work?.work_steps??0} / {task.budget} work steps · Collected value: {work?.earned??0}</p>{/if}
          {#if task.kind==="irrigation"}<p>Work steps: {work?.work_steps??0} / {2*task.cases[caseIndex].length-1}</p>{/if}
          {#if ["greedy","planning"].includes(task.kind)}
            <div class="readings">{#each readings as tile}<span>Tile {tile.x}: {tile.type||"empty"} · {tile.value} coins{#if task.kind==="greedy"} · {tile.seconds<0?"not ready":`${tile.seconds}s left`}{/if}</span>{/each}</div>
          {:else}<p>{task.kind==="sequence"?"Growth advances when bot.wait runs. Water each growth step.":"The crops stay in their test states while you plan."}</p>{/if}
        </div>
      {/if}
      <div class="teacher" in:panelIn out:panelOut><img class:happy={mood==="happy"} class:thinking={mood==="think"} src="/sprites/bot_teacher.png" alt="Bot Teacher"/><div><strong>Bot Teacher</strong>{#key speech}<p in:fly={{y:8,duration:220}}>{speech}</p>{/key}</div></div>
      {#if result}<div class="results" role="status" in:fly={{y:18,duration:350}}>
        <h2>{result.passed?"Challenge cleared!":"Not quite yet"} · {result.score}/{result.max_score}</h2>
        <div class="round-results">{#each result.results as row,i}<div class="row-result">
          <strong>Row {i+1}: {Object.values(row.checks).filter(Boolean).length}/{rules.length}</strong>
          {#if row.passed}<span>All rules passed!</span>{:else}<ul>{#each rules.filter(rule=>!row.checks[rule.key]) as rule}<li>{rule.label}</li>{/each}</ul>{/if}
          {#if row.error}<p>{row.error}</p>{/if}
          {#if row.optimal_value!==undefined}<p>Collected {row.earned} coins of a possible {row.optimal_value} in {row.work_steps} work steps.</p>{/if}
        </div>{/each}</div>
        {#if result.passed&&rewardAvailable&&!reward}<ChallengeRewards {task}/><button onclick={collect}>Collect my rewards</button>{/if}
      </div>{/if}
      {#if reward}<div class="reward" role="status" in:fly={{y:30,duration:500}} out:fly={{y:-20,duration:250}}><h2>Well earned, farmer!</h2><ChallengeRewards {task} collected/><button onclick={exitChallenge}>Back to my farm</button></div><Confetti/>{/if}
    </section>
    <section class="program" in:panelIn out:panelOut><div class="program-header"><h2>Robot 0</h2><div><button disabled={running||closing} aria-pressed={mode==="blocks"} onclick={()=>switchMode("blocks")}>Blockly</button><button disabled={running||closing} aria-pressed={mode==="text"} onclick={()=>switchMode("text")}>Text code</button></div></div>
      <div class="goal"><strong>Pass every rule on each test row</strong><ul>{#each rules as rule}<li>{rule.label}</li>{/each}</ul><span>{task.kind?"The same program runs on every test row. Tile numbers start at 0.":"Harvesting everything is not enough if a command fails."}</span></div>
      <div class="code-area" class:busy={running}><div class="blockly-host" class:hidden={mode!=="blocks"} bind:this={host}></div>{#if mode==="text"}<textarea aria-label="Challenge JavaScript program" bind:value={source} oninput={()=>textEdited=true} disabled={running} spellcheck="false" placeholder="Write your robot's plan…"></textarea>{/if}</div>
      <details><summary>Commands & rewards</summary><p>{(task.commands??["right","left","harvest","is_harvestable"]).map(name=>`bot.${name}(${name==="jump"||name.startsWith("crop_")?"column, row":name==="plant"?'"corn"':name==="wait"?"seconds":""})`).join(", ")}, bot.say(value), columns(), rows().</p><ChallengeRewards {task}/><p>One reward per challenge on this farm.</p></details>
      {#if running}<button class="stop" onclick={()=>stop()}>■ Stop & edit</button>{/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}<button class="run" onclick={run} disabled={running||!ready||closing}>{running?"Go, little robot!":result?"Try again":"Let's try my plan!"}</button>
    </section>
  </div>
</div>
<style>
  .scenario-status{background:#f3f4f6;border:2px solid #64748b;border-radius:8px;padding:12px;margin-bottom:12px;font-size:15px;line-height:1.5}.readings{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.readings span{background:white;border:1px solid #cbd5e1;padding:6px;border-radius:4px}
  .goal ul{padding-left:20px;font-size:14px;margin:8px 0}.goal>span{display:block;font-size:13px;color:#78350f}.row-result{flex:1 1 100%;padding:10px;background:white;border:1px solid #cbd5e1;border-radius:6px}.row-result>span{margin-left:12px;font-size:14px}.row-result ul{padding-left:20px;font-size:14px;margin:8px 0}.row-result p{font-size:14px}.stop{width:100%;margin-top:14px;background:#fee2e2;border-color:#b91c1c;color:#7f1d1d}
  .live-challenge{position:fixed;inset:0;z-index:10000;padding:18px;overflow:auto;color:#334155;background:linear-gradient(#17251b55,transparent 30%,transparent 60%,#17251b66)}header{display:flex;justify-content:space-between;align-items:center;gap:12px;color:white;text-shadow:0 1px 3px #0008;max-width:1300px;margin:auto}header span{font-size:13px;font-weight:bold}h1{font-size:24px;font-weight:800}h2{font-size:19px;font-weight:bold}.layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,44%);gap:20px;max-width:1300px;margin:20px auto}.farm-side{min-width:0}.rounds{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.rounds span{color:white;text-shadow:0 1px 3px #000;font-weight:bold}.farm-window{height:320px;pointer-events:none}.teacher,.program,.results,.reward{background:#f3f4f6;border:4px solid #64748b;border-radius:12px;padding:14px;box-shadow:0 6px 18px #0003}.teacher{display:flex;gap:12px;align-items:center}.teacher img{width:60px;image-rendering:pixelated;animation:nod .8s ease-in-out 2}.teacher strong{color:#166534;font-size:15px}.teacher p{font-size:17px;line-height:1.5;margin-top:4px}.teacher img.happy{animation:nod .5s ease-in-out 3}.teacher img.thinking{animation:tilt .7s ease-in-out 2}.program{min-width:0;height:fit-content}.program-header{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.goal{font-size:16px;line-height:1.5;margin:12px 0}.code-area{height:360px;min-height:210px;max-height:65vh;resize:vertical;overflow:hidden;border:1px solid #94a3b8}.blockly-host{width:100%;height:100%}.hidden{display:none}.busy{pointer-events:none;opacity:.8}textarea{width:100%;height:100%;resize:none;background:#f8fafc;color:#1e293b;padding:12px;font:16px/1.6 monospace}button{font:inherit;padding:9px 12px;border:2px solid #64748b;border-radius:7px;background:#e5e7eb;color:#334155;font-weight:bold;cursor:pointer;text-shadow:none}button:disabled{opacity:.6;cursor:default}button[aria-pressed=true],.run,.results button,.reward button{background:#bbf7d0}button:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid #16a34a;outline-offset:3px}.run{width:100%;margin-top:12px}.results,.reward{margin-top:12px}.results p,.error{color:#991b1b}.round-results{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0}.reward{background:#fef3c7;font-size:18px}.reward button{margin-top:10px}details{font-size:14px;margin-top:12px}details p{margin-top:8px;line-height:1.5}summary{cursor:pointer}.curtain{position:fixed;inset:0;background:#142016;z-index:10;pointer-events:none;opacity:0;animation:reveal .5s ease-out;transition:opacity .3s}.curtain.closing{opacity:1;animation:none}@keyframes reveal{from{opacity:1}to{opacity:0}}@keyframes nod{50%{transform:translateY(-7px) rotate(-4deg)}}@keyframes tilt{50%{transform:rotate(8deg)}}@media(max-width:800px){.layout{grid-template-columns:1fr}.farm-window{height:270px}.live-challenge{padding:12px}.code-area{height:300px}h1{font-size:20px}}@media(prefers-reduced-motion:reduce){.curtain,.teacher img,.teacher img.happy,.teacher img.thinking{animation:none;transition:none}}
</style>
