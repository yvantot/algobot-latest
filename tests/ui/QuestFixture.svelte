<script>
  import { onMount, tick } from "svelte";
  import { game, farm_grid_index } from "../../src/game/game.js";
  import { TUTORIAL, QUEST_STATE, ONBOARDING, chooseQuest, robots, robots_state } from "../../src/components/global.svelte.js";
  import { QUEST_DATA } from "../../src/game/global/quests.js";
  import { DOCUMENT_DATA } from "../../src/game/global/global.js";
  import { lessonAnswer } from "../../src/game/global/quest-lessons.js";
  import { k } from "../../src/lib/kaplay.js";
  import BlockBased from "../../src/components/BlockBased.svelte";
  import TextBased from "../../src/components/TextBased.svelte";
  import QuestHUD from "../../src/components/QuestHUD.svelte";
  import Quest from "../../src/components/Quest.svelte";
  import GameDevTools from "../../src/components/GameDevTools.svelte";
  import PlayerInfo from "../../src/components/PlayerInfo.svelte";
  let ready = $state(false), mode = $state("blocks"), selected = $state("cs_cleanup_0");
  let editor = $state(), revision = $state(0), path = $state(false), compact = $state(false);
  function selectLesson() {
    let before = true;
    for (const [id, quest] of Object.entries(QUEST_DATA)) {
      if (id === selected) before = false;
      Object.assign(QUEST_STATE[id], { is_completed: before, is_claimed: before, progress: before ? quest.goal : 0 });
    }
    chooseQuest(QUEST_DATA[selected].optional ? selected : null);
    TUTORIAL.active = false;
    ONBOARDING.startClicked = true;
    for (const category of Object.values(DOCUMENT_DATA)) for (const item of Object.values(category)) item.is_unlocked = true;
    for (const state of robots_state) { state.text_code = ""; state.block_code = ""; state.blockly_xml = ""; }
    revision++;
  }
  async function loadAnswer() {
    const answer = lessonAnswer(selected);
    revision++;
    for (const state of robots_state) { state.text_code = ""; state.block_code = ""; state.blockly_xml = ""; }
    await tick();
    if (mode === "text") editor.insertExample(answer.code);
    else for (const block of answer.blocks ?? [answer.block]) editor.insertExample(block);
  }
  onMount(() => {
    game();
    const timer = setInterval(() => {
      if (!farm_grid_index.get("0-0")?.soil?.exists() || !robots[0]?.is_available) return;
      ready = true; selectLesson(); k.debug.timeScale = 3; clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  });
</script>
<header>
  <span>Quest verification. No participant data saved.</span>
  <label>Lesson <select bind:value={selected} onchange={selectLesson}>{#each Object.entries(QUEST_DATA) as [key, quest]}<option value={key}>{quest.title}</option>{/each}</select></label>
  <button onclick={() => { mode = mode === "blocks" ? "text" : "blocks"; revision++; }}>Editor: {mode}</button>
  <button onclick={loadAnswer}>Load test answer</button>
  <button onclick={() => path = !path}>Toggle mission path</button>
  <button onclick={() => compact = !compact}>Toggle narrow panel</button>
</header>
{#if ready}
  <GameDevTools/>
  <div class="player"><PlayerInfo/></div>
  <div class="editor">{#key revision}{#if mode === "blocks"}<BlockBased bind:this={editor}/>{:else}<TextBased bind:this={editor}/>{/if}{/key}</div>
  <div class="hud" style:width={compact ? "300px" : "360px"}><QuestHUD editorMode={mode} onOpenEditor={() => {}} onOpenQuestMenu={() => path = !path}/></div>
  {#if path}<div class="path"><Quest/></div>{/if}
{/if}
<style>
  header{position:fixed;inset:0 0 auto;z-index:9000;background:white;padding:8px;display:flex;gap:8px;flex-wrap:wrap;font:14px sans-serif}
  button,select{padding:6px;border:1px solid #64748b;background:#f3f4f6;color:#334155}
  .editor{position:fixed;right:4px;top:90px}.hud{position:fixed;left:8px;top:100px;max-height:80vh;overflow:auto}.path{position:fixed;left:380px;top:90px;z-index:8000}
  .player{position:fixed;right:8px;bottom:8px}
</style>
