<script>
  import { onMount } from "svelte";
  import { game, farm_grid_index } from "../../src/game/game.js";
  import { TUTORIAL, QUEST_STATE, ONBOARDING } from "../../src/components/global.svelte.js";
  import { QUEST_DATA } from "../../src/game/global/quests.js";
  import BlockBased from "../../src/components/BlockBased.svelte";
  import QuestHUD from "../../src/components/QuestHUD.svelte";
  import HelpModal from "../../src/components/HelpModal.svelte";
  import FarmIntroduction from "../../src/components/FarmIntroduction.svelte";
  import PracticeFarm from "../../src/components/PracticeFarm.svelte";
  import {PRACTICE_MISSIONS} from "../../src/game/global/practice-missions.js";
  let practice=$state(null);
  let editorMode=$state("blocks");
  let ready=$state(false),help=$state(false),open=$state(false),lesson=$state("basics"),completed=$state([]);
  function choose(key) {
    let before=true;
    for(const id of Object.keys(QUEST_DATA)) {
      if(id===key)before=false;
      QUEST_STATE[id].is_completed=before;QUEST_STATE[id].is_claimed=before;
    }
    TUTORIAL.active=key.startsWith("intro_")&&key!=="intro_loop";
    ONBOARDING.startClicked=true;
  }
  onMount(()=>{game();const timer=setInterval(()=>{if(farm_grid_index.get("0-0")?.soil?.exists()){ready=true;choose("intro_loop");clearInterval(timer);}},50);return()=>clearInterval(timer);});
</script>
<div style="position:fixed;top:0;left:0;z-index:9000;background:white;padding:8px">
  No participant data saved.
  {#each Object.keys(QUEST_DATA) as key}<button onclick={()=>choose(key)}>{key}</button>{/each}
  <button onclick={()=>help=!help}>Help</button><button onclick={()=>editorMode=editorMode==="blocks"?"text":"blocks"}>Hint mode: {editorMode}</button>
</div>
{#if ready}
  <div style="position:fixed;right:4px;top:40px"><BlockBased/></div>
  <div style="position:fixed;left:8px;top:65px;width:360px;max-height:85vh;overflow:auto"><QuestHUD {editorMode} onOpenBlockEditor={()=>{}} onOpenQuestMenu={()=>{}}/></div>
  {#if help}<div style="position:fixed;left:380px;top:45px"><HelpModal completedDemos={completed} onClose={()=>help=false} onShowIntroduction={id=>{lesson=id;open=true;help=false;}}/></div>{/if}
  <FarmIntroduction bind:isOpen={open} {lesson} rewardAvailable={!completed.includes(lesson)} onComplete={id=>completed.push(id)}/>
{/if}

<div style="position:fixed;bottom:0;left:0;z-index:9001;background:white">{#each PRACTICE_MISSIONS as key}<button onclick={()=>practice=key}>Practice {key}</button>{/each}</div>
{#if practice}{#key practice}<PracticeFarm missionKey={practice} onClose={()=>practice=null} onComplete={()=>practice=null}/>{/key}{/if}
