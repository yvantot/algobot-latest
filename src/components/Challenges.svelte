<script>
  import {slide} from "svelte/transition";
  import {CHALLENGES,TIER_ORDER,challengeRules} from "../game/challenges/catalog.js";
  import ChallengeRewards from "./ChallengeRewards.svelte";
  let {onChallenge,challengeReady=false,challengeNotice="",completed=[],onClose}=$props();
  const reduced=typeof matchMedia!=="undefined"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  let selected=$state(null),tier=$state("All");
  const tasks=[...CHALLENGES].sort((a,b)=>TIER_ORDER.indexOf(a.tier)-TIER_ORDER.indexOf(b.tier));
  let visible=$derived(tasks.filter(task=>tier==="All"||task.tier===tier));
</script>
<section class="challenges" aria-label="Challenges menu">
  <header><img src="/sprites/icon_challenges.png" alt=""/><div><span>BOT TEACHER'S CHALLENGES</span><h1>Prove your farming skills</h1></div><button class="close" onclick={onClose} aria-label="Close Challenges">×</button></header>
  <div class="teacher"><img src="/sprites/bot_teacher.png" alt="Bot Teacher"/><p>Small farm. Big rewards. Pick your challenge and show me your best program!</p></div>
  <div class="progress"><strong>{completed.length} / {CHALLENGES.length} rewards earned</strong><span>Your main farm stays safe.</span></div>
  <label>Difficulty <select bind:value={tier}><option>All</option>{#each TIER_ORDER as value}<option>{value}</option>{/each}</select></label>
  {#if !challengeReady}<p class="locked">Finish your introductory tutorial missions to enter. You can explore the challenges now.</p>{/if}
  {#if challengeNotice}<p role="alert">{challengeNotice}</p>{/if}
  <ol>
    {#each visible as task}
      <li class:complete={completed.includes(task.id)}>
        <button class="task" aria-expanded={selected===task.id} aria-controls={task.id+"-details"} onclick={()=>selected=selected===task.id?null:task.id}>
          <span class="tier" class:expert={task.tier==="Expert"}>{task.tier}</span>
          <strong>{task.title}</strong><span class="status">{completed.includes(task.id)?"Reward earned":"+"+task.coins+" coins"} <span aria-hidden="true">{selected===task.id?"▴":"▾"}</span></span>
          <span class="concept">{task.skill}</span>
        </button>
        {#if selected===task.id}<div class="details" id={task.id+"-details"} transition:slide={{duration:reduced?0:200}}>
          <p>{task.description}</p><p class="skill">Practice: {task.skill}</p>
          <h2>To win, pass every rule on each test row</h2>
          <ul>{#each challengeRules(task) as rule}<li>{rule.label}</li>{/each}</ul>
          <ChallengeRewards {task}/>
          <button class="enter" disabled={!challengeReady} onclick={()=>onChallenge(task)}>{completed.includes(task.id)?"Play again":"Accept challenge"}</button>
          <p class="small">{completed.includes(task.id)?"Practice again. This farm has already earned the reward.":"One reward per challenge on this farm."}</p>
        </div>{/if}
      </li>
    {/each}
  </ol>
</section>
<style>
 .concept{flex:1 1 100%;font-size:14px;color:#475569}
 .challenges{width:min(480px,calc(100vw - 24px));max-height:92vh;overflow:auto;background:#f3f4f6;border:4px solid #64748b;border-radius:12px;color:#334155;padding:14px;box-shadow:0 8px 20px #0003;font-family:Quicksand,sans-serif}header{display:flex;align-items:center;gap:12px;padding-bottom:14px;border-bottom:2px solid #94a3b8}header>img{width:52px;height:52px;object-fit:contain;image-rendering:pixelated}header>div{flex:1;min-width:0}header span{font-size:12px;font-weight:bold;color:#166534}h1{font-size:21px;line-height:1.2;font-weight:800;margin:4px 0}button,select{font:inherit;color:inherit;border:2px solid #94a3b8;border-radius:6px;padding:9px;background:#e5e7eb;cursor:pointer}.close{font-size:22px;min-width:40px}.teacher{display:flex;gap:12px;align-items:center;margin:16px 0}.teacher img{width:48px;image-rendering:pixelated}p{font-size:15px;line-height:1.5;margin:8px 0}.progress{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px;padding:12px;background:#dcfce7;border:2px solid #86b997;border-radius:8px;margin-bottom:14px}.progress span{color:#475569}label{font-size:15px;font-weight:bold;display:flex;align-items:center;justify-content:space-between;gap:12px}select{background:white}.locked{background:#e5e7eb;padding:10px;border-radius:6px}ol{list-style:none;padding:0;display:grid;gap:12px;margin-top:16px}ol>li{border:2px solid #cbd5e1;border-radius:8px;background:white;overflow:hidden}ol>li.complete{border-color:#86b997}.task{display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%;text-align:left;border:0;border-radius:0;background:transparent;padding:14px}.task>strong{flex:1 1 160px;font-size:17px}.tier{font-size:12px;font-weight:800;padding:4px 8px;border:1px solid #86b997;border-radius:4px;background:#dcfce7;color:#166534}.tier.expert{background:#fef3c7;border-color:#d6b56c;color:#78350f}.status{font-size:13px;font-weight:bold;color:#475569}.details{padding:0 14px 14px}.details h2{font-size:15px;font-weight:bold;margin:14px 0 8px}.details ul{padding-left:20px;font-size:14px;line-height:1.6}.skill,.small{font-size:13px;color:#475569}.enter{background:#bbf7d0;width:100%;font-weight:bold}.enter:disabled{cursor:default;background:#e5e7eb}button:focus-visible,select:focus-visible{outline:3px solid #16a34a;outline-offset:2px}@media(prefers-reduced-motion:reduce){.details{transition-duration:0s!important}}
</style>
