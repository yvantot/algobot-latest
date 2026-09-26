<script>
  import {onMount,tick} from "svelte";
  import {fly} from "svelte/transition";
  import {dialogFocus} from "./dialog-focus.js";
  import {QUEST_DATA} from "../game/global/quests.js";
  import {practiceSetup,runPractice} from "../game/global/practice-missions.js";
  import {startChallengeFarm} from "../game/challenges/live-farm.js";
  import {createChallengeWorkspace} from "../game/challenges/blocks.js";
  import {missionHint,recordMissionHint} from "../game/global/mission-hints.js";
  import {telemetry} from "../game/ml/telemetry.js";
  import BlockPlacementGuide from "./BlockPlacementGuide.svelte";
  import BotTextEditor from "./BotTextEditor.svelte";
  import Confetti from "./Confetti.svelte";
  let {missionKey,onClose,onComplete,replay=false}=$props();
  const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mission=$derived(QUEST_DATA[missionKey]), setup=$derived(practiceSetup(missionKey));
  let viewport,host,world,editor,controller;
  let mode=$state("blocks"),source=$state(""),running=$state(false),tokens=$state([]),hint=$state.raw(null),hintLevel=$state(0),message=$state(mission.description),ready=$state(false);
  let done=$derived(tokens.length>=mission.goal);
  let disposed=false;
  onMount(()=>{
    try {
      world=startChallengeFarm(()=>viewport.getBoundingClientRect());
      resetFarm();editor=createChallengeWorkspace(host,setup.task);ready=true;
    } catch(error) { message=error.message; world?.dispose(); }
    const resize=new ResizeObserver(()=>{editor?.resize();world?.fit();});resize.observe(host);resize.observe(viewport);
    const fit=()=>world?.fit();window.addEventListener("resize",fit);
    return()=>{disposed=true;controller?.abort();resize.disconnect();window.removeEventListener("resize",fit);editor?.dispose();world?.dispose();};
  });
  function resetFarm(){world.reset(setup.layout,setup.task);if(setup.startX)world.robot.gridPlace(setup.startX,0);}
  async function switchMode(next){if(next==="text")source=editor.source();mode=next;await tick();editor.resize();}
  async function run(){
    running=true;controller=new AbortController();
    const runController=controller;
    try{
      await runPractice(mode==="blocks"?editor.source():source,missionKey,world,globalThis.Interpreter,{signal:runController.signal,
        onProgress:token=>{if(!runController.signal.aborted&&!tokens.includes(token)){tokens=[...tokens,token];hint=null;}},
        onAction:({name,value})=>{if(!name.startsWith("is_")&&!value)message="That action did not work. Check your tile and try again.";}
      });
      if(!disposed)message=done?"You did it! Ready to try this on your farm?":"Nice start! Keep going, or tap Need help?";
    }catch(error){if(!disposed&&!runController.signal.aborted)message=error.message;}
    finally{if(!disposed && controller===runController)running=false;}
  }
  function stop(){controller?.abort();controller=null;running=false;tokens=[];hint=null;resetFarm();message="Stopped. The practice farm is reset; your blocks are still here.";}
  function help(){
    const example=missionHint(missionKey,hintLevel,tokens,world.inspect()[0]?.ready);
    recordMissionHint(telemetry,missionKey,mode,hintLevel,example);hintLevel++;hint=example;
  }
  function finish(){disposed=true;controller?.abort();world?.dispose();if(done)onComplete(tokens);else onClose();}
</script>

<div class="practice" role="dialog" aria-modal="true" aria-label={mission.title} tabindex="-1" use:dialogFocus onscroll={()=>world?.fit()} onkeydown={event=>{if(event.key==="Escape"){event.stopPropagation();finish();}}} in:fly={{y:30,duration:reduced?0:300}} out:fly={{y:30,duration:reduced?0:250}}>
  <header><div><span>BOT TEACHER'S PRACTICE</span><h1>{mission.title}</h1></div><button onclick={finish}>Back to farm</button></header>
  <div class="layout">
    <div class="farm"><div class="viewport" bind:this={viewport}></div><div class="teacher"><img src="/sprites/bot_teacher.png" alt="Bot Teacher"/><p aria-live="polite">{message}</p></div>
      <progress max={mission.goal} value={tokens.length}></progress><p>{Math.min(tokens.length,mission.goal)} / {mission.goal}</p>
      {#if done}<h2>Practice complete!</h2><button class="primary" onclick={finish}>{replay?"Back to my farm":"Finish & collect reward"}</button><Confetti/>
      {:else}<button onclick={help} disabled={!ready}>Need help?</button><button disabled={running||!ready} onclick={()=>{tokens=[];hint=null;resetFarm();message=mission.description;}}>Reset practice farm</button>{/if}
      {#if hint}{#if mode==="blocks"}{#key hint}<BlockPlacementGuide mission={missionKey} example={hint}/>{/key}{:else}<pre><code>{hint.code}</code></pre>{/if}{/if}
      {#if missionKey==="tut_2"}<p>Water again when the soil dries. Wait for ripe wheat, then harvest. You can run one block at a time.</p>{/if}
    </div>
    <div class="program"><div class="tabs"><h2>Robot 0</h2><button disabled={running} aria-pressed={mode==="blocks"} onclick={()=>switchMode("blocks")}>Blocks</button><button disabled={running} aria-pressed={mode==="text"} onclick={()=>switchMode("text")}>Text</button></div>
      <div class="editor"><div class:hidden={mode!=="blocks"} class="blocks" bind:this={host}></div><div class:hidden={mode!=="text"} class="text"><BotTextEditor bind:value={source} commands={setup.task.commands.filter(name=>name!=="rows")} readOnly={running} label="Practice program"/></div></div>
      {#if running}<button onclick={stop}>Stop & edit</button>{:else}<button class="primary" disabled={!ready||done} onclick={run}>Start</button>{/if}
    </div>
  </div>
</div>
<style>
  .practice{position:fixed;inset:12px;z-index:1300;background:transparent;border:4px solid #64748b;border-radius:12px;padding:16px;color:#334155;overflow:auto;font-family:Quicksand,sans-serif}header,.tabs{display:flex;gap:12px;align-items:center;justify-content:space-between}header{border-bottom:2px solid #94a3b8;padding-bottom:12px}h1{font-size:23px;font-weight:800}h2{font-size:19px;font-weight:bold}header span{font-size:13px;font-weight:bold;color:#166534}.layout{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:14px}.farm{min-width:0}.viewport{height:300px;background:transparent}header{background:#f3f4f6;border-radius:8px;padding:12px}.farm> :not(.viewport){background:#f3f4f6;border-radius:8px;padding:8px}.teacher{display:flex;gap:12px;align-items:center}.teacher img{width:48px;height:auto;image-rendering:pixelated}p{font-size:16px;line-height:1.5}progress{width:100%;accent-color:#16a34a}button{background:#e5e7eb;border:2px solid #94a3b8;border-radius:7px;padding:9px 13px;margin:4px;font:inherit;font-weight:700;cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible{outline:3px solid #16a34a;outline-offset:2px}.primary{background:#bbf7d0}.program{background:#f3f4f6;padding:12px;border:2px solid #94a3b8;border-radius:10px;min-width:280px;resize:both;overflow:auto}.editor{position:relative;height:430px;min-height:250px}.blocks,.text{position:absolute;inset:0}.hidden{display:none}pre{white-space:pre-wrap;font-size:16px}.tabs button[aria-pressed="true"]{background:#bbf7d0}@media(max-width:850px){.layout{grid-template-columns:1fr}.viewport{height:230px;background:transparent}.farm{background:transparent}.editor{height:350px}}@media(prefers-reduced-motion:reduce){.practice{animation:none!important}}
</style>
