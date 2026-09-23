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
  import { game } from "./game/game.js";
  import { k } from "./lib/kaplay.js";

  let currentView = $state("MENU"); // 'MENU' | 'GAME'
  let hasStartedGame = false;
  let isNewFarm = $state(false);

  onMount(() => {
    initGlobalUISounds();
    play_music_menu();
  });

  function startGame() {
    // Initializing Kaplay from this click satisfies browser audio-autoplay rules.
    isNewFarm = !hasStartedGame;
    if (!hasStartedGame) {
      game();
      hasStartedGame = true;
    }
    currentView = "GAME";
    k.debug.timeScale = 1;
    play_music_farm();
  }

  function returnToMenu() {
    k.debug.timeScale = 0;
    currentView = "MENU";
    play_music_menu();
  }
</script>

<div class="flex justify-center align-middle gap-4 h-screen">
  {#if currentView === "MENU"}
    <StartMenu onStart={startGame} />
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
