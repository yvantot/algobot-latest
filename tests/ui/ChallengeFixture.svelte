<script>
  import ChallengeFarm from "../../src/components/ChallengeFarm.svelte";
  import { CHALLENGES } from "../../src/game/challenges/catalog.js";
  let open=$state(true), task=$state(CHALLENGES[0]), submitted=$state(0), reward=$state(false);
</script>
<h1>Isolated challenge UI test · no participant data saved</h1>
<p>Submissions: {submitted} · Reward granted: {reward ? "yes" : "no"}</p>
{#each CHALLENGES as choice}<button onclick={()=>{task=choice;open=true;reward=false;}}>Open {choice.title}</button>{/each}
{#if open}<ChallengeFarm {task} onClose={()=>open=false} onSubmit={()=>submitted++} onReward={()=>{reward=true;return true;}} rewardAvailable={!reward}/>{/if}
