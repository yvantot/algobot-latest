<script>
  import { onMount, tick } from "svelte";
  import { game, farm_grid_index as grid } from "../../src/game/game.js";
  import { k } from "../../src/lib/kaplay.js";
  import { QUEST_DATA } from "../../src/game/global/quests.js";
  import { tutorialPolicy } from "../../src/game/global/tutorial.js";
  import { CropStates } from "../../src/game/global/enum.js";
  import { addCrop } from "../../src/game/components-kaplay/crop.js";
  import { spawnBugEvent, spawnFireEvent, spawnRainEvent, destroyFarmEvents } from "../../src/game/event.js";
  import { QUEST_STATE, QUEST_FEEDBACK, TUTORIAL, ONBOARDING, robots, currentQuest, chooseQuest, trackQuest, finishIntroduction } from "../../src/components/global.svelte.js";
  import QuestHUD from "../../src/components/QuestHUD.svelte";
  import QuestFeedback from "../../src/components/QuestFeedback.svelte";
  import PlayerInfo from "../../src/components/PlayerInfo.svelte";

  let ready = $state(false), showHUD = $state(true), running = $state(false), results = $state([]);
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const flush = async () => { await tick(); await tick(); };
  async function removeHUD() {
    showHUD = false; await flush();
    const deadline = Date.now() + 3000;
    while (document.querySelector('[aria-label="Current mission"]') && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    check(!document.querySelector('[aria-label="Current mission"]'), "quest HUD outro did not finish");
    await flush();
  }
  function cleanFarm() {
    destroyFarmEvents(grid);
    for (const tile of grid.values()) {
      tile.bug?.destroy(); tile.crop?.cropDestroy("test_cleanup");
    }
  }
  async function select(key) {
    await removeHUD(); cleanFarm();
    let before = true;
    for (const [id, quest] of Object.entries(QUEST_DATA)) {
      if (id === key) before = false;
      Object.assign(QUEST_STATE[id], { progress: before ? quest.goal : 0, is_completed: before, is_claimed: before });
    }
    chooseQuest(QUEST_DATA[key].optional ? key : null);
    finishIntroduction(); QUEST_FEEDBACK.queue = [];
    showHUD = true; await flush();
    // Use the same reset control as a player, including the HUD's dependency wiring.
    const reset = [...document.querySelectorAll("button")].find(button => button.textContent === "Reset lesson tiles");
    check(reset, "Reset lesson tiles control is missing"); reset.click(); await flush();
    check(grid.lessonActive, "lesson protection did not start");
    // Reset jumps the robot home asynchronously; let that animation finish
    // before pausing simulation or a subsequent reset is correctly rejected.
    k.debug.timeScale = 1;
    const deadline = Date.now() + 5000;
    while (!robots[0].is_available && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    k.debug.timeScale = 0;
    check(robots[0].is_available, "reset robot movement did not finish");
    const crop = grid.get("0-0").crop ?? (grid.get("0-0").crop = addCrop(grid, "wheat", 0, 0));
    crop.matureNow();
    const remaining = crop.spoilage_remaining;
    crop.advanceGrowth(1);
    check(crop.spoilage_remaining === remaining, "lesson crop spoiled while protected");
    for (const spawn of [spawnBugEvent, spawnFireEvent, spawnRainEvent]) {
      check(spawn(grid, 100).reason === "lesson_practice", "lesson did not block a scheduled event");
    }
    return crop;
  }
  function released(crop) {
    check(!grid.lessonActive, "farm event protection remained active");
    check([...grid.values()].every(tile => !tile.lesson && !tile.lessonBug && !tile.lessonFire), "lesson ownership remained on a tile");
    const remaining = crop.spoilage_remaining;
    crop.advanceGrowth(1);
    check(crop.spoilage_remaining === remaining - 1, "spoilage countdown did not resume");
    crop.advanceGrowth(crop.spoilage_remaining);
    check(crop.crop_state === CropStates.DEAD, "crop did not spoil after its remaining lifetime");
  }
  async function runChecks() {
    running = true; results = [];
    async function scenario(name, run) {
      try { await run(); results = [...results, "PASS: " + name]; }
      catch (error) { results = [...results, "FAIL: " + name + ": " + error.message]; throw error; }
    }
    try {
      await scenario("Completion releases protection before reward collection", async () => {
        const crop = await select("loop_water_0");
        trackQuest("loop_water_0", QUEST_DATA.loop_water_0.goal, { program: true }); await flush();
        check(QUEST_STATE.loop_water_0.is_completed && !QUEST_STATE.loop_water_0.is_claimed, "expected completed, unclaimed quest");
        released(crop);
      });
      await scenario("Switching from an optional lesson releases protection", async () => {
        const crop = await select("fn_return_0");
        chooseQuest(null); await flush();
        check(currentQuest() === "list_crops_0", "did not return to required quest");
        released(crop);
      });
      for (const [key, field] of [["hazard_bug_0", "bug"], ["hazard_fire_0", "fire"]]) {
        await scenario(key + " completion removes practice hazards", async () => {
          const crop = await select(key);
          check([...grid.values()].some(tile => tile[field]), "practice hazard was not created");
          trackQuest(key, QUEST_DATA[key].goal, { program: true }); await flush();
          released(crop);
          check([...grid.values()].every(tile => !tile[field]), "practice hazard survived release");
        });
      }
      await scenario("Removing the quest HUD releases protection", async () => {
        const crop = await select("loop_water_0");
        await removeHUD(); released(crop);
      });
      await scenario("Rain, pests, and fire can start after protection ends", async () => {
        cleanFarm();
        for (const tile of grid.values()) if (tile.soil) {
          tile.soil.till();
          tile.crop = addCrop(grid, "wheat", tile.soil.grid_x, tile.soil.grid_y, CropStates.HARVESTABLE);
        }
        check(spawnRainEvent(grid, 100).applied, "rain remained blocked");
        destroyFarmEvents(grid);
        check(spawnBugEvent(grid, 100).bugs?.length > 0, "pests remained blocked");
        for (const tile of grid.values()) tile.bug?.destroy();
        check(spawnFireEvent(grid, 100).applied, "fire remained blocked");
        destroyFarmEvents(grid);
      });
      await scenario("Tutorial protection remains until Start farming", async () => {
        TUTORIAL.active = true; tutorialPolicy.protected = true;
        QUEST_FEEDBACK.queue = []; QUEST_FEEDBACK.hazardsPending = true;
        const crop = grid.get("0-0").crop;
        const remaining = crop.spoilage_remaining;
        crop.advanceGrowth(1);
        check(crop.spoilage_remaining === remaining, "tutorial protection ended early");
        await flush();
        const start = [...document.querySelectorAll("button")].find(button => button.textContent === "Start farming");
        check(start, "Start farming control is missing"); start.click(); await flush();
        check(!TUTORIAL.active && !tutorialPolicy.protected && !QUEST_FEEDBACK.hazardsPending, "tutorial protection remained active");
        released(crop);
      });
    } catch { /* Each failed scenario records its own visible result. */ }
    finally { running = false; }
  }
  onMount(() => {
    game();
    const timer = setInterval(() => {
      if (!grid.get("0-0")?.soil?.exists() || !robots[0]?.is_available) return;
      ONBOARDING.startClicked = true; k.debug.timeScale = 0; ready = true; clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  });
</script>

<main>
  <h1>Protection lifecycle verification</h1>
  <p>Isolated fixture. No participant collection. Simulation paused for deterministic lifecycle checks.</p>
  <button disabled={!ready || running} onclick={runChecks}>{running ? "Checking…" : "Run protection checks"}</button>
  <ul aria-live="polite">{#each results as result}<li>{result}</li>{/each}</ul>
</main>
{#if ready}
  <div class="hud">{#if showHUD}<QuestHUD/>{/if}</div>
  <QuestFeedback/><PlayerInfo/>
{/if}
<style>
  main{position:relative;z-index:11000;padding:16px;background:white;color:#17251b;font:16px sans-serif;max-width:850px}
  h1{font-size:22px}button{padding:8px;border:1px solid #334155}li{margin-top:8px}.hud{position:fixed;right:8px;top:100px;width:360px}
</style>
