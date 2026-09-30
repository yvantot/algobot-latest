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

  let currentView = $state("MENU"); // 'MENU' | 'GAME'
  let savedFarm = $state(null);
  let hasSave = $state(false);
  let loading = $state(true);
  let menuError = $state("");
  let canRecover = $state(false);
  let isNewFarm = $state(false);

  onMount(() => {
    initGlobalUISounds();
    play_music_menu();
    inspectSave();
  });

  async function inspectSave() {
    loading = true;
    savedFarm = null; menuError = "";
    try {
      const root = await persistence.inspect();
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
  async function startGame(newGame = false, recover = false) {
    if (loading) return;
    loading = true; menuError = "";
    try {
      isNewFarm = newGame;
      await startPlaythrough({ newGame, recover });
      currentView = "GAME";
      k.debug.timeScale = 1;
      play_music_farm();
      if (!newGame) saveStatus.notice = "Farm restored. Programs are stopped; press Start when you are ready.";
    } catch (error) { menuError = error.message; }
    finally { loading = false; }
  }

  async function returnToMenu({ discard = false } = {}) {
    if (persistence.busy) { saveStatus.notice = "Wait for the current save to finish before leaving the farm."; return; }
    const speed = k.debug.timeScale;
    k.debug.timeScale = 0;
    try {
      if (!discard) await persistence.checkpoint();
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
    <StartMenu onStart={() => startGame(true)} onContinue={() => startGame()} onRecover={() => startGame(false, true)} onRetry={inspectSave} onExport={exportSave} {savedFarm} {hasSave} {loading} error={menuError} {canRecover} />
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
