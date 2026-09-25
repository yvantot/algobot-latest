<script>
  import { onMount } from "svelte";
  import { game, farm_grid_index } from "../../src/game/game.js";
  import { TUTORIAL } from "../../src/components/global.svelte.js";
  let ready=$state(false);
  onMount(()=>{game();TUTORIAL.active=false;const timer=setInterval(()=>{if(farm_grid_index.get("0-0")?.soil?.exists()){ready=true;clearInterval(timer);}},50);return()=>clearInterval(timer);});
  import ChallengeFarm from "../../src/components/ChallengeFarm.svelte";
  import DidYouKnowPopup from "../../src/components/DidYouKnowPopup.svelte";
  import Challenges from "../../src/components/Challenges.svelte";
  import { CHALLENGES } from "../../src/game/challenges/catalog.js";
  let open=$state(true), task=$state(CHALLENGES[0]), submitted=$state(0), reward=$state(false);
</script>
<div style:visibility={open ? "hidden" : "visible"}><DidYouKnowPopup/></div>
<h1>Isolated challenge UI test · no participant data saved</h1>
<p>Submissions: {submitted} · Reward granted: {reward ? "yes" : "no"}</p>
{#each CHALLENGES as choice}<button onclick={()=>{task=choice;open=true;reward=false;}}>Open {choice.title}</button>{/each}
{#if !open}<Challenges challengeReady={true} onChallenge={choice=>{task=choice;open=true;reward=false;}} onClose={()=>{}}/>{/if}
{#if open&&ready}{#key task.id}<ChallengeFarm {task} onClose={()=>open=false} onSubmit={()=>submitted++} onReward={()=>{reward=true;return true;}} rewardAvailable={!reward}/>{/key}{/if}
