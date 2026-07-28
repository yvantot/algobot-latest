<script>
  import { k } from "../lib/kaplay.js";
  import { onMount } from "svelte";
  import { getAudioVolumes, setCategoryVolume } from "../game/utils/sound.js";

  let { onStart } = $props();

  let activeModal = $state(null); // null | 'settings' | 'about'
  let pixelDensity = $state(1);
  let isExiting = $state(false);
  let volumes = $state({
    master: 1.0,
    music: 0.8,
    ambiance: 0.8,
    sfx: 1.0,
  });

  onMount(() => {
    pixelDensity = Number(localStorage.getItem("algobot_pixel_density") || 1);
    volumes = getAudioVolumes();
  });

  function handleStart() {
    if (isExiting) return;
    isExiting = true;
    setTimeout(() => {
      if (onStart) onStart();
    }, 380);
  }

  function updatePixelDensity(val) {
    pixelDensity = Number(val);
    localStorage.setItem("algobot_pixel_density", pixelDensity);
    if (k) {
      k.pixelDensity = pixelDensity;
    }
  }

  function handleVolumeChange(category, val) {
    const num = parseFloat(val);
    volumes[category] = num;
    setCategoryVolume(category, num);
  }
</script>

<div
  class="fixed inset-0 z-[9990] flex items-center justify-center bg-gray-900 text-slate-700 select-none transition-all duration-500 ease-in-out"
  class:opacity-0={isExiting}
  class:pointer-events-none={isExiting}
>
  <!-- Cover Art Background Container -->
  <div
    class="absolute inset-0 bg-cover bg-center transition-transform duration-500 ease-out"
    class:scale-105={isExiting}
    style="background-image: url('/sprites/art_cover.png');"
  ></div>

  <!-- Main Content Overlay -->
  <div
    class="relative z-10 flex flex-col items-center justify-center gap-6 h-full w-full p-6 mt-[30vh] transition-all duration-380 ease-out"
    class:translate-y-8={isExiting}
    class:scale-90={isExiting}
    class:opacity-0={isExiting}
  >
    <!-- Vertical 2.5D Wood Buttons -->
    <div class="flex flex-col gap-4 w-64">
      <button
        onclick={handleStart}
        class="wood-button-25d w-full py-3.5 text-base cursor-pointer text-center select-none"
      >
        Start Game
      </button>

      <button
        onclick={() => (activeModal = "settings")}
        class="wood-button-25d w-full py-3.5 text-base cursor-pointer text-center select-none"
      >
        Settings
      </button>

      <button
        onclick={() => (activeModal = "about")}
        class="wood-button-25d w-full py-3.5 text-base cursor-pointer text-center select-none"
      >
        About
      </button>
    </div>
  </div>

  <!-- Settings Modal (Resolution pixelDensity 1 & 2 + Sound On/Off) -->
  {#if activeModal === "settings"}
    <div
      class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
    >
      <div
        class="w-full max-w-md bg-gray-100 border-4 border-slate-500 rounded-xl p-5 text-slate-700 space-y-4 shadow-xl"
      >
        <div
          class="flex justify-between items-center border-b-2 border-slate-300 pb-2"
        >
          <h3 class="font-bold text-sm text-slate-800 uppercase">Settings</h3>
          <button
            onclick={() => (activeModal = null)}
            class="text-slate-500 hover:text-slate-800 font-bold text-sm cursor-pointer"
            >✕</button
          >
        </div>

        <div class="space-y-3 text-xs">
          <!-- KAPLAY Resolution (pixelDensity) -->
          <div
            class="flex justify-between items-center bg-gray-200 p-3 rounded-lg border border-slate-300"
          >
            <div>
              <p class="font-bold text-slate-800">Graphics Resolution</p>
              <p class="text-slate-600 text-[11px]">
                KAPLAY Canvas pixelDensity
              </p>
            </div>
            <div class="flex gap-1">
              <button
                onclick={() => updatePixelDensity(1)}
                class="px-2.5 py-1 font-bold rounded text-xs cursor-pointer border border-slate-400 transition-colors"
                class:bg-green-300={pixelDensity === 1}
                class:bg-gray-300={pixelDensity !== 1}>1 (Standard)</button
              >
              <button
                onclick={() => updatePixelDensity(2)}
                class="px-2.5 py-1 font-bold rounded text-xs cursor-pointer border border-slate-400 transition-colors"
                class:bg-green-300={pixelDensity === 2}
                class:bg-gray-300={pixelDensity !== 2}>2 (High / Crisp)</button
              >
            </div>
          </div>

          <!-- Sound & Volume Sliders -->
          <div
            class="bg-gray-200 p-3 rounded-lg border border-slate-300 space-y-3"
          >
            <div class="border-b border-slate-300 pb-1">
              <p
                class="font-bold text-slate-800 text-xs uppercase tracking-wide"
              >
                Sound & Audio Categories
              </p>
              <p class="text-slate-600 text-[11px]">
                Adjust volume sliders for master, music, ambiance, and SFX
              </p>
            </div>

            <!-- Master Volume -->
            <div class="space-y-1">
              <div
                class="flex justify-between items-center text-xs font-bold text-slate-800"
              >
                <span>Master Volume</span>
                <span class="font-mono text-slate-600"
                  >{Math.round(volumes.master * 100)}%</span
                >
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volumes.master}
                oninput={(e) =>
                  handleVolumeChange("master", e.currentTarget.value)}
                class="w-full accent-green-600 cursor-pointer h-1.5 bg-gray-300 rounded-lg"
              />
            </div>

            <!-- Music (Start Menu BGM) -->
            <div class="space-y-1">
              <div
                class="flex justify-between items-center text-xs font-bold text-slate-800"
              >
                <span>Music (Start Menu BGM)</span>
                <span class="font-mono text-slate-600"
                  >{Math.round(volumes.music * 100)}%</span
                >
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volumes.music}
                oninput={(e) =>
                  handleVolumeChange("music", e.currentTarget.value)}
                class="w-full accent-green-600 cursor-pointer h-1.5 bg-gray-300 rounded-lg"
              />
            </div>

            <!-- Ambiance (Farm Soundscape) -->
            <div class="space-y-1">
              <div
                class="flex justify-between items-center text-xs font-bold text-slate-800"
              >
                <span>Ambiance (Farm Soundscape)</span>
                <span class="font-mono text-slate-600"
                  >{Math.round(volumes.ambiance * 100)}%</span
                >
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volumes.ambiance}
                oninput={(e) =>
                  handleVolumeChange("ambiance", e.currentTarget.value)}
                class="w-full accent-green-600 cursor-pointer h-1.5 bg-gray-300 rounded-lg"
              />
            </div>

            <!-- Sound Effects (SFX & UI) -->
            <div class="space-y-1">
              <div
                class="flex justify-between items-center text-xs font-bold text-slate-800"
              >
                <span>Sound Effects (SFX & UI)</span>
                <span class="font-mono text-slate-600"
                  >{Math.round(volumes.sfx * 100)}%</span
                >
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volumes.sfx}
                oninput={(e) =>
                  handleVolumeChange("sfx", e.currentTarget.value)}
                class="w-full accent-green-600 cursor-pointer h-1.5 bg-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <button
          onclick={() => (activeModal = null)}
          class="w-full py-2 bg-gray-300 hover:bg-gray-400 font-bold rounded-lg text-xs text-slate-800 border border-slate-400 cursor-pointer"
          >Close</button
        >
      </div>
    </div>
  {/if}

  <!-- About Modal (Light Theme, Document.svelte aesthetic) -->
  {#if activeModal === "about"}
    <div
      class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
    >
      <div
        class="w-full max-w-lg bg-gray-100 border-4 border-slate-500 rounded-xl p-5 text-slate-700 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto custom-scrollbar"
      >
        <div
          class="flex justify-between items-center border-b-2 border-slate-300 pb-2"
        >
          <h3 class="font-bold text-sm text-slate-800 uppercase">
            About AlgoBot
          </h3>
          <button
            onclick={() => (activeModal = null)}
            class="text-slate-500 hover:text-slate-800 font-bold text-sm cursor-pointer"
            >✕</button
          >
        </div>

        <div class="space-y-3 text-xs leading-relaxed text-slate-700">
          <div class="bg-green-100 border-2 border-green-300 rounded-lg p-3">
            <h4 class="font-bold text-green-800 text-xs mb-1">
              Educational Purpose
            </h4>
            <p>
              AlgoBot is an educational game designed to introduce algorithmic
              logic, sequential execution, loops, and conditional reasoning to
              learners through farm simulation mechanics.
            </p>
          </div>

          <div
            class="bg-gray-200 p-3 rounded-lg border border-slate-300 space-y-1"
          >
            <h4 class="font-bold text-slate-800 text-xs">Research & Authors</h4>
            <p class="text-slate-600 italic">City College of Calamba</p>
            <p>
              Developed as an interactive learning tool for computing education
              and algorithmic problem solving.
            </p>
          </div>

          <div
            class="bg-gray-200 p-3 rounded-lg border border-slate-300 space-y-1"
          >
            <h4 class="font-bold text-slate-800 text-xs">
              Core Learning Objectives
            </h4>
            <ul class="list-disc list-inside space-y-0.5 text-slate-700">
              <li>Algorithmic sequencing & function execution</li>
              <li>Iterative logic with loops (For / While)</li>
              <li>Conditional branching (If / Else)</li>
              <li>Resource management & autonomous execution</li>
            </ul>
          </div>
        </div>

        <button
          onclick={() => (activeModal = null)}
          class="w-full py-2 bg-gray-300 hover:bg-gray-400 font-bold rounded-lg text-xs text-slate-800 border border-slate-400 cursor-pointer"
          >Close</button
        >
      </div>
    </div>
  {/if}
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border-radius: 10px;
  }

  .wood-button-25d {
    background: #b8753b;
    border-top: 2px solid #c8874a;
    border-bottom: 5px solid #6b3d1f;
    border-radius: 12px;
    color: #fff6e5;

    font-weight: 800;
    letter-spacing: 0.04em;
    box-shadow:
      0 6px 14px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      inset 0 -2px 0 rgba(0, 0, 0, 0.2);
    transition:
      transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.15s ease,
      background 0.15s ease,
      border-bottom-width 0.1s ease;
  }

  .wood-button-25d:hover {
    background: #8f5828;
    transform: translateY(-3px);
    box-shadow:
      0 10px 20px rgba(0, 0, 0, 0.55),
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      0 0 12px rgba(230, 160, 80, 0.2);
  }

  .wood-button-25d:active {
    transform: translateY(2px);
    border-bottom-width: 2px;
    box-shadow:
      0 3px 6px rgba(0, 0, 0, 0.4),
      inset 0 2px 5px rgba(0, 0, 0, 0.4);
  }
</style>
