<script>
  import { onMount, tick } from "svelte";
  import { fly, fade } from "svelte/transition";
  import { createChallengeWorkspace } from "../game/challenges/blocks.js";
  import { evaluateChallenge } from "../game/challenges/engine.js";
  import { panelIn, panelOut } from "./interface.svelte.js";

  let { task, onSubmit, onClose, onReward, rewardAvailable = true } = $props();
  let host, dialog, editor, controller;
  let mode = $state("blocks"), source = $state(""), independent = $state(false);
  let running = $state(false), result = $state(null), error = $state(""), reward = $state(false);
  let caseIndex = $state(0), frame = $state({ position: 0, crops: [], message: "Bot 0 starts on the first tile." });
  let textEdited = false, disposed = false;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  onMount(() => {
    frame.crops = task.cases[0].map(x => x ? "ready" : "young");
    const opener = document.activeElement;
    dialog.focus();
    try { editor = createChallengeWorkspace(host); } catch (e) { error = e.message; mode = "text"; }
    const observer = new ResizeObserver(() => editor?.resize());
    observer.observe(host);
    return () => { disposed = true; controller?.abort(); observer.disconnect(); editor?.dispose(); opener?.focus(); };
  });

  async function switchMode(value) {
    if (value === "text" && !textEdited && editor) source = editor.source();
    mode = value;
    await tick(); editor?.resize();
  }
  async function run() {
    error = ""; reward = false;
    let code;
    try { code = mode === "blocks" ? editor.source() : source; } catch (e) { error = e.message; return; }
    if (!code.trim()) { error = "Add some commands first, then run your program."; return; }
    running = true; result = null; controller = new AbortController();
    try {
      const outcome = await evaluateChallenge(code, task, globalThis.Interpreter, { signal: controller.signal });
      if (disposed) return;
      onSubmit(outcome, code, mode, independent);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      for (let i = 0; i < outcome.results.length; i++) {
        caseIndex = i;
        for (const step of outcome.results[i].trace) {
          if (disposed) return;
          frame = step; await wait(reduced ? 40 : 360);
        }
        await wait(reduced ? 40 : 550);
      }
      if (!disposed) result = outcome;
    } catch (e) { if (!disposed) error = e.message; }
    finally { if (!disposed) running = false; }
  }
  function collect() { reward = onReward(); }
  function exitChallenge() { disposed = true; controller?.abort(); onClose(); }
  function keys(event) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); exitChallenge(); }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), input, textarea, [tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
</script>

<div class="challenge-cover" in:fade={{duration:180}} out:fade={{duration:220}}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="challenge-panel" role="dialog" aria-modal="true" aria-labelledby="challenge-title" tabindex="-1" bind:this={dialog} onkeydown={keys} in:panelIn out:panelOut>
    <header><img src="/sprites/bot_teacher.png" alt="Bot Teacher"/><div><p class="eyebrow">Challenge Farm · your main farm is paused</p><h1 id="challenge-title">{task.title}</h1></div><button class="back" onclick={exitChallenge}>Back to farm</button></header>
    <p class="brief">{task.description} Crops stay still here: no growing, spoilage, weather, or hints. Your program starts fresh on each of the three test rows.</p>
    <div class="challenge-body">
      <div class="field-side">
        <h2>{running ? "Watching your program" : "Test rows"} · {caseIndex + 1} of {task.cases.length}</h2>
        <div class="case-picker" aria-label="Preview test rows">{#each task.cases as layout, i}<button disabled={running} aria-pressed={caseIndex===i} onclick={() => {caseIndex=i;frame={position:0,crops:layout.map(x=>x?"ready":"young"),message:"Bot 0 starts on the first tile."};}}>Row {i+1} · {layout.length} tiles</button>{/each}</div>
        <div class="field" style={`--tiles:${frame.crops.length}`}>
          {#each frame.crops as crop, i}<div class="tile"><span class="tile-number">{i+1}</span>{#if crop!=="empty"}<img class="crop" src={`/sprites/wheat_${crop==="ready"?"harvestable":"young"}.png`} alt={crop==="ready"?"Ready wheat":"Young wheat"} out:fly={{y:-18,duration:250}}/>{/if}</div>{/each}
          <div class="robot" style={`left:calc(${frame.position} * 100% / ${frame.crops.length})`}><img src="/sprites/bot_default.png" alt="Robot 0"/><span>0</span></div>
        </div>
        <p class="speech">{frame.message}</p>
        <div class="goals"><h2>Each row is worth 3 points</h2><ul><li>Visit every tile.</li><li>Harvest every ready crop.</li><li>Finish without harvesting a young crop or moving past the edge.</li></ul><p>All three rows passed? Collect {task.coins} coins, {task.exp} EXP, and {task.seeds} wheat seeds. One reward per challenge on this farm.</p></div>
        {#if result}<div class="result" role="status" in:fly={{y:15,duration:350}} out:fade><h2>{result.passed ? "Every row passed!" : "Try another approach"} · {result.score}/{result.max_score}</h2>{#each result.results as row, i}<p>Row {i+1}: {Object.values(row.checks).filter(Boolean).length}/3 — {row.passed?"All goals met":row.error || (!row.checks.visited_every_tile?"Some tiles were not visited":!row.checks.harvested_all_ready?"Ready crops were left behind":"Check your harvests and the row edge")}</p>{/each}{#if result.passed && rewardAvailable && !reward}<button onclick={collect}>Collect farm rewards</button>{/if}</div>{/if}
        {#if reward}<div class="reward" role="status" in:fly={{y:30,duration:550}} out:fly={{y:-20,duration:300}}><img src="/sprites/icon_coin.png" alt=""/><strong>+{task.coins} coins · +{task.exp} EXP<br/>+{task.seeds} wheat seeds</strong><p>Sent to your farm!</p><button onclick={exitChallenge}>Return to my farm</button></div>{/if}
      </div>
      <div class="program-side"><div class="program-header"><h2>Robot 0 program</h2><div><button disabled={running} aria-pressed={mode==="blocks"} onclick={()=>switchMode("blocks")}>Blockly</button><button disabled={running} aria-pressed={mode==="text"} onclick={()=>switchMode("text")}>Text code</button></div></div>
        <div class="code-area" class:editing-disabled={running}><div class:hidden={mode!=="blocks"} class="blockly-host" bind:this={host}></div>{#if mode==="text"}<textarea aria-label="Challenge JavaScript program" bind:value={source} oninput={()=>textEdited=true} disabled={running} spellcheck="false" placeholder="Write your bot commands here..."></textarea>{/if}</div>
        <p class="api">Available: bot.right(), bot.left(), bot.harvest(), bot.is_harvestable(), bot.say(value), columns(), rows(). Loops and if statements work too.</p>
        <label class="independent"><input type="checkbox" bind:checked={independent} disabled={running}/> I wrote this program myself, without outside hints or copied code.</label>
        <p class="research-note">Your first submitted program supplies the task score for the study. You can keep trying after feedback. Leaving before submitting records an unfinished attempt.</p>
        {#if error}<p class="error" role="alert">{error}</p>{/if}<button class="run" onclick={run} disabled={running}>{running?"Running on all three rows…":result?"Try my program again":"Run on all three rows"}</button>
      </div>
    </div>
  </div>
</div>

<style>
  .challenge-cover{position:fixed;inset:0;z-index:190;background:#354e34e8;display:grid;place-items:center;padding:16px;color:#334155}.challenge-panel{width:min(1200px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:#f3f4f6;border:4px solid #64748b;border-radius:12px;box-shadow:0 12px 35px #0005;padding:20px}header{display:flex;align-items:center;gap:14px;border-bottom:2px solid #94a3b8;padding-bottom:12px}header img{width:48px;image-rendering:pixelated}h1{font-size:24px;font-weight:800}h2{font-size:18px;font-weight:700}p,li,label{font-size:16px;line-height:1.5}.eyebrow{font-size:14px;color:#475569}.back{margin-left:auto}.brief{margin:14px 0}.challenge-body{display:grid;grid-template-columns:1fr 1.1fr;gap:20px}.field-side{min-width:0;position:relative}.case-picker{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 55px}.field{display:grid;grid-template-columns:repeat(var(--tiles),1fr);position:relative;margin:0 0 15px;padding-top:12px}.tile{position:relative;aspect-ratio:1;background:#b98555;border:3px solid #815637;border-radius:8px;box-shadow:0 5px #634426}.tile-number{position:absolute;bottom:2px;right:5px;font-size:12px;color:#fff}.crop{position:absolute;width:90%;height:105%;object-fit:contain;bottom:10%;left:5%;image-rendering:pixelated}.robot{position:absolute;top:-35px;width:calc(100% / var(--tiles));text-align:center;transition:left 300ms ease-in-out;pointer-events:none}.robot img{width:50px;image-rendering:pixelated;display:inline}.robot span{position:absolute;left:50%;top:16px;transform:translateX(-50%);font-size:13px;color:#bbf7d0}.speech{min-height:48px;text-align:center;padding:10px;background:white;border:2px solid #94a3b8;border-radius:8px}.goals{margin-top:16px}.goals ul{padding-left:20px;list-style:disc}.goals p{margin-top:12px}.program-side{min-width:0;border:3px solid #94a3b8;border-radius:8px;background:white;padding:12px}.program-header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px}.code-area{height:310px;min-height:200px;max-height:55vh;resize:vertical;overflow:hidden;position:relative;border:1px solid #94a3b8}.blockly-host{height:100%;width:100%}.hidden{display:none}.editing-disabled{pointer-events:none;opacity:.8}textarea{resize:none;width:100%;height:100%;padding:12px;font:16px/1.6 monospace;background:#f8fafc;color:#1e293b}.api,.research-note{font-size:14px;color:#475569;margin:10px 0}.independent{display:flex;align-items:flex-start;gap:8px;margin-top:12px}.independent input{margin-top:5px;width:18px;height:18px;flex-shrink:0}button{font:inherit;background:#e2e8f0;border:2px solid #94a3b8;border-radius:6px;padding:8px 12px;cursor:pointer;font-weight:700}button:hover:not(:disabled){background:#dcfce7}button[aria-pressed=true],.run,.result button,.reward button{background:#bbf7d0;border-color:#64748b}button:disabled{opacity:.55;cursor:wait}button:focus-visible,textarea:focus-visible,input:focus-visible{outline:3px solid #15803d;outline-offset:3px}.run{width:100%}.error{color:#991b1b;margin:8px 0}.result{padding:12px;background:#f0fdf4;border:2px solid #86b997;border-radius:8px;margin-top:12px}.result p{font-size:14px;margin:6px 0}.reward{padding:16px;background:#fef3c7;border:3px solid #b88b32;border-radius:10px;margin-top:12px;text-align:center}.reward img{width:36px;image-rendering:pixelated;display:inline-block;vertical-align:middle;margin-right:10px}.reward strong{font-size:20px}.reward button{margin-top:12px}@media(max-width:800px){.challenge-body{grid-template-columns:1fr}.challenge-panel{padding:12px}h1{font-size:20px}.challenge-cover{padding:8px}header{flex-wrap:wrap}.code-area{height:300px}.field{max-width:480px;margin-left:auto;margin-right:auto}}@media(prefers-reduced-motion:reduce){.robot{transition:none}}
</style>
