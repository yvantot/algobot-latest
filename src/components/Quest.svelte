<script>
  import { QUEST_DATA } from "../game/global/quests.js";
  import { QUEST_STATE, currentQuest, claimQuest } from "./global.svelte.js";
  import { CHALLENGES } from "../game/challenges/catalog.js";
  let { onChallenge = () => {}, challengeReady = false, challengeNotice = "" } = $props();
  let active = $derived(currentQuest());
</script>
<section class="path" aria-label="Mission path">
<header><img src="/sprites/bot_teacher.png" alt="Bot Teacher"/><div><h1>Quests & Mission Path</h1><p>Complete missions to unlock your next farming skill.</p></div></header>
  <section class="challenge-hub" aria-label="Challenge Farm">
    <h2>Challenge Farm</h2><p>A separate farm to test your code. Earn coins, EXP, and wheat seeds. Your own farm stays safe.</p>
    {#each CHALLENGES as task}
      <div class="challenge-card"><h2>{task.title}</h2><p>{task.description}</p><p class="small">{task.coins} coins · {task.exp} EXP · {task.seeds} wheat seeds</p>
      {#if !QUEST_STATE[task.prerequisite]?.is_claimed}<p class="small">Finish “{QUEST_DATA[task.prerequisite]?.title}” first.</p>
      {:else}<button onclick={() => onChallenge(task)} disabled={!challengeReady}>Enter challenge</button>{/if}</div>
    {/each}
    {#if !challengeReady}<p class="small">Finish your first farming lessons to take on Bot Teacher.</p>{/if}
    {#if challengeNotice}<p role="alert">{challengeNotice}</p>{/if}
  </section>
  <ol>
    {#each Object.entries(QUEST_DATA) as [key, quest]}
      {@const state = QUEST_STATE[key]}
      {@const locked = (quest.prereq || []).some(id => !QUEST_STATE[id]?.is_claimed)}
      <li class:active={key === active} class:locked aria-current={key === active ? "step" : undefined}>
        <span class="state">{state.is_claimed ? "COMPLETED" : state.is_completed ? "REWARD READY" : key === active ? "CURRENT MISSION" : locked ? "LOCKED" : "AVAILABLE"}</span>
        <h2>{quest.title}</h2><p>{quest.description}</p>
        {#if locked}<p class="small">Complete: {(quest.prereq || []).filter(id => !QUEST_STATE[id]?.is_claimed).map(id => QUEST_DATA[id]?.title).join(", ")}</p>{/if}
        {#if quest.rewards?.unlocks}<p class="small">Unlocks: {quest.rewards.unlocks.map(name => name.replaceAll("_", " ")).join(", ")}</p>{/if}
        {#if state.is_completed && !state.is_claimed}<button onclick={() => claimQuest(key)}>Collect reward</button>{/if}
      </li>
    {/each}
  </ol>
</section>
<style>
  .challenge-hub{margin-top:12px;padding:12px;background:#ecfdf5;border:2px solid #86b997;border-radius:8px}.challenge-card{padding:10px 0;border-top:1px solid #a7cbb4}.challenge-hub>h2{font-size:18px}.challenge-card p{font-size:14px}button:disabled{opacity:.5;cursor:not-allowed}
  .path{width:min(440px,90vw);height:95vh;overflow:auto;background:#f3f4f6;border:4px solid #64748b;border-radius:12px;color:#334155;padding:12px;box-shadow:0 8px 20px #0003}header{display:flex;gap:10px;align-items:center;border-bottom:2px solid #94a3b8;padding-bottom:10px}header img{width:40px;image-rendering:pixelated}h1{font-size:16px;font-weight:700}header p{color:#64748b;font-size:14px}h2{font-weight:bold;font-size:15px;margin:5px 0}p{font-size:13px;line-height:1.45;margin:5px 0}ol{padding:0;list-style:none;margin-top:14px;display:grid;gap:10px}li{padding:12px;border:2px solid #cbd5e1;background:white;border-radius:8px}li.active{border-color:#4ade80;background:#f0fdf4;box-shadow:inset 0 0 0 1px #86efac}.locked{background:#e5e7eb}.state{font-size:13px;font-weight:bold;letter-spacing:.06em;color:#475569}.active .state{color:#166534}.small{font-size:14px;color:#475569}button{background:#bbf7d0;color:#1e293b;border:2px solid #94a3b8;font-weight:bold;padding:8px 12px;border-radius:6px;cursor:pointer}button:focus-visible{outline:3px solid #16a34a;outline-offset:3px}
</style>
