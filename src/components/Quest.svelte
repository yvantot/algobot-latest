<script>
  import { QUEST_DATA } from "../game/global/quests.js";
  import { QUEST_STATE, currentQuest, claimQuest } from "./global.svelte.js";
  let active = $derived(currentQuest());
</script>
<section class="path" aria-label="Mission path">
  <h1>Your mission path</h1><p>Learn the basics, repeat with loops, then make decisions with conditions.</p>
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
  .path{width:min(440px,90vw);height:95vh;overflow:auto;background:#f5f0df;border:3px solid #60755c;border-radius:10px;color:#263c32;padding:20px}h1{font-size:24px;font-weight:800}h2{font-weight:bold;font-size:17px;margin:5px 0}p{font-size:14px;line-height:1.45;margin:5px 0}ol{padding-left:24px;margin-top:18px}li{padding:12px;margin-bottom:10px;border:2px solid #c2c9b6;border-radius:7px}li.active{border-color:#315936;background:#e1edcf}.locked{background:#e6e5dc}.state{font-size:10px;font-weight:bold;letter-spacing:.08em}.small{font-size:12px}button{background:#315936;color:white;padding:9px;border-radius:5px;cursor:pointer}button:focus-visible{outline:3px solid #aa620d;outline-offset:3px}
</style>
