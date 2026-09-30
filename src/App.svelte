<script>
  import DevTools from "./components/DevTools.svelte";
  import Game from "./components/Game.svelte";
  import StartMenu from "./components/StartMenu.svelte";
  import { onMount } from "svelte";
  import {
    initGlobalUISounds,
    play_music_menu,
    play_music_farm,
  } from "./game/utils/sound.js";
  import { k } from "./lib/kaplay.js";
  import { persistence, startPlaythrough, saveStatus } from "./game/persistence/runtime.svelte.js";
  import { validateSave } from "./game/persistence/schema.js";
  import { legacyResearchBytes } from "./game/persistence/legacy-research.js";

  let currentView = $state("MENU"); // 'MENU' | 'GAME'
  let savedFarm = $state(null);
  let hasSave = $state(false);
  let slotKnown = $state(false);
  let slotRevision = $state(null);
  let loading = $state(true);
  let menuError = $state("");
  let canRecover = $state(false);
  let isNewFarm = $state(false);
  let researchRecovery = $state(null);

  onMount(() => {
    initGlobalUISounds();
    play_music_menu();
    inspectSave();
  });

  async function inspectSave() {
    loading = true;
    savedFarm = null; menuError = ""; researchRecovery = null;
    slotKnown = false; slotRevision = null; hasSave = false; canRecover = false;
    try {
      const root = await persistence.inspect();
      slotKnown = true; slotRevision = root.revision;
      hasSave = !!root.active;
      canRecover = !!root.previous;
      if (root.active) savedFarm = validateSave(root.active);
    } catch (error) { menuError = error.message; }
    finally { loading = false; }
  }
  async function exportSave() {
    try {
      const root = await persistence.storage.read();
      const url = URL.createObjectURL(new Blob([JSON.stringify({ active: root.active, previous: root.previous, floor: root.floor }, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "algobot-save-diagnostic.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { menuError = error.message; }
  }
  function exportResearch() {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(legacyResearchBytes(localStorage), null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "algobot-research-backup.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { menuError = error.message; }
  }
  async function startGame(newGame = false, recover = false, recoverResearch = false, replacementRevision = hasSave ? slotRevision : null) {
    if (loading || newGame && !slotKnown) return;
    loading = true; menuError = "";
    try {
      isNewFarm = newGame;
      await startPlaythrough({ newGame, recover, recoverResearch, replacementRevision });
      researchRecovery = null;
      currentView = "GAME";
      k.debug.timeScale = 1;
      play_music_farm();
      if (!newGame) saveStatus.notice = "Farm restored. Programs are stopped; press Start when you are ready.";
    } catch (error) {
      await inspectSave();
      menuError = error.message;
      if (error.code === "legacy_research") researchRecovery = { newGame, recover, replacementRevision };
    }
    finally { loading = false; }
  }

  async function returnToMenu({ discard = false } = {}) {
    if (persistence.busy) { saveStatus.notice = "Wait for the current save to finish before leaving the farm."; return; }
    const speed = k.debug.timeScale;
    k.debug.timeScale = 0;
    try {
      if (!discard) await persistence.checkpoint({ required: true });
      persistence.ready = false;
      currentView = "MENU";
      play_music_menu();
      await inspectSave();
    } catch (error) {
      saveStatus.notice = `Could not save before returning: ${error.message} Your farm is still open.`;
      k.debug.timeScale = speed;
    }
  }
</script>

<div class="flex justify-center align-middle gap-4 h-screen">
  {#if currentView === "MENU"}
    <StartMenu onStart={() => startGame(true)} onContinue={() => startGame()} onRecover={() => startGame(false, true)} onRetry={inspectSave} onExport={exportSave} onExportResearch={exportResearch} canRecoverResearch={!!researchRecovery} onRecoverResearch={() => startGame(researchRecovery.newGame, researchRecovery.recover, true, researchRecovery.replacementRevision)} {savedFarm} {hasSave} {slotKnown} {loading} error={menuError} {canRecover} />
  {:else}
    <Game onReturnMenu={returnToMenu} {isNewFarm} />
  {/if}
</div>

<style>
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  * {
    color: #fafafa;
    font-size: 11px;
  }
</style>
