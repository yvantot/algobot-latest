<script>
  import Inventory from "./Inventory.svelte";
  import TextBased from "./TextBased.svelte";
  import BlockBased from "./BlockBased.svelte";
  import Document from "./Document.svelte";
  import Shop from "./Shop.svelte";
  import Quest from "./Quest.svelte";
  import QuestHUD from "./QuestHUD.svelte";
  import PlayerInfo from "./PlayerInfo.svelte";
  import LevelReward from "./LevelReward.svelte";
  import ResearchTree from "./ResearchTree.svelte";
  import FarmPersonalize from "./FarmPersonalize.svelte";
  import HelpModal from "./HelpModal.svelte";
  import OnboardingModal from "./OnboardingModal.svelte";
  import DidYouKnowPopup from "./DidYouKnowPopup.svelte";
  import UnlockFlyOverlay from "./UnlockFlyOverlay.svelte";
  import EventBanner from "./EventBanner.svelte";
  import { createResizable, panelIn, panelOut } from "./interface.svelte.js";
  import { ModalTypes } from "../game/global/enum.js";
  import { Modals, triggerDidYouKnow } from "./global.svelte";
  import GameDevTools from "./GameDevTools.svelte";
  import DDADashboard from "./DDADashboard.svelte";
  import { k } from "../lib/kaplay.js";
  import { onMount } from "svelte";

  let { onReturnMenu } = $props();

  let Editors = { BLOCK: 0, TEXT: 1 };
  let Menus = {
    NONE: -1,
    COMMAND: 0,
    DOCUMENT: 1,
    QUEST: 2,
    SHOP: 3,
    RESEARCH: 4,
    HELP: 5,
  };

  const menuButtons = [
    {
      id: Menus.COMMAND,
      title: "Command Editor",
      description: "Write code or build block commands to control your bot.",
      icon: "/sprites/icon_command.png",
      alt: "command",
    },
    {
      id: Menus.DOCUMENT,
      title: "Documentation",
      description: "View syntax guides, reference docs, and function manuals.",
      icon: "/sprites/icon_document.png",
      alt: "document",
    },
    {
      id: Menus.QUEST,
      title: "Quests",
      description: "Track level objectives, active tasks, and rewards.",
      icon: "/sprites/icon_quest.png",
      alt: "quest",
    },
    {
      id: Menus.RESEARCH,
      title: "Research Tree",
      description: "Unlock new technologies, algorithms, and bot abilities.",
      icon: "/sprites/icon_skilltree.png",
      alt: "research tree",
    },
    {
      id: Menus.SHOP,
      title: "Shop",
      description: "Purchase seeds, items, and farm upgrades.",
      icon: "/sprites/icon_shop.png",
      alt: "shop",
    },
  ];

  let current_menu = $state(Menus.COMMAND);
  let current_editor = $state(Editors.BLOCK);
  let showOnboarding = $state(false);
  let showConfirmReturn = $state(false);

  let game_speed = $state(k.debug.timeScale);
  let camera_scale = $state(1);

  onMount(() => {
    const isHidden = localStorage.getItem("algobot_hide_onboarding") === "true";
    if (!isHidden) {
      showOnboarding = true;
    }
  });

  $effect(() => {
    k.debug.timeScale = game_speed;
    k.setCamScale(camera_scale);
  });

  function toggleEditor() {
    current_editor =
      current_editor === Editors.TEXT ? Editors.BLOCK : Editors.TEXT;
  }

  function toggleMenu(menu) {
    if (menu === Menus.SHOP && current_menu !== Menus.SHOP) {
      triggerDidYouKnow("shop");
    }
    current_menu = current_menu === menu ? Menus.NONE : menu;
  }
</script>

<div class="fixed h-[97vh] top-2 right-2 bottom-2 overflow-hidden rounded-lg">
  <GameDevTools />
  <DDADashboard />
  <LevelReward />
  <FarmPersonalize />
  <OnboardingModal bind:isOpen={showOnboarding} />
  <DidYouKnowPopup />
  <UnlockFlyOverlay />
  <EventBanner />

  <div class="fixed bottom-2 left-2 flex gap-2">
    <div class="flex flex-col items-center gap-2 text-white">
      <p
        class="text-center w-fit outline-2 outline-[#F2E0CF] font-bold text-sm bg-[#ab7440] rounded-lg p-2 px-8 border-b-4 border-[#7c552f]"
      >
        Zoom: {(camera_scale * 100).toFixed(0)}%
      </p>
      <div
        class="flex rounded-lg backdrop-brightness-70 justify-center w-fit p-1"
      >
        <button
          onclick={() => (camera_scale = Math.max(camera_scale - 0.2, 0.4))}
          class="cursor-pointer"
        >
          <img
            class="hover:scale-110 transition-transform w-12 h-12"
            src="/sprites/icon_zoomout.png"
            alt="zoom out"
          />
        </button>
        <button
          onclick={() => (camera_scale = Math.min(camera_scale + 0.2, 1.4))}
          class="cursor-pointer"
        >
          <img
            class="hover:scale-110 transition-transform w-12 h-12"
            src="/sprites/icon_zoomin.png"
            alt="zoom in"
          />
        </button>
        <button onclick={() => (camera_scale = 1)} class="cursor-pointer">
          <img
            class="hover:scale-110 transition-transform w-12 h-12"
            src="/sprites/icon_zoomdefault.png"
            alt="zoom default"
          />
        </button>
      </div>
    </div>
    <div class="flex flex-col items-center gap-2 text-white">
      <p
        class="text-center w-1/2 outline-2 outline-[#F2E0CF] font-bold text-sm bg-[#ab7440] rounded-lg p-2 border-b-4 border-[#7c552f]"
      >
        Speed: {game_speed * 100}%
      </p>
      <div
        class="flex rounded-lg backdrop-brightness-70 justify-center w-fit p-1"
      >
        <button onclick={() => (game_speed = 0.3)}>
          <img
            class="hover:scale-110 transition-transform w-12 h-12"
            src="/sprites/icon_backwarder.png"
            alt="backward"
          />
        </button>
        <button onclick={() => (game_speed = 0.7)}>
          <img
            class="hover:scale-110 transition-transform w-12 h-12"
            src="/sprites/icon_backward.png"
            alt="backward"
          />
        </button>
        <button
          onclick={() => {
            game_speed = game_speed > 0 ? 0 : 1;
          }}
        >
          <img
            class="hover:scale-110 transition-transform w-12 h-12"
            src="/sprites/icon_{game_speed > 0 ? 'pause' : 'play'}.png"
            alt="backward"
          />
        </button>
        <button onclick={() => (game_speed = 2)}>
          <img
            class="hover:scale-110 transition-transform w-12 h-12"
            src="/sprites/icon_fastforward.png"
            alt="backward"
          />
        </button>
        <button onclick={() => (game_speed = 4)}>
          <img
            class="hover:scale-110 transition-transform w-12 h-12"
            src="/sprites/icon_fastforwarder.png"
            alt="backward"
          />
        </button>
      </div>
    </div>
  </div>

  <div class="flex gap-2 top-4 left-4 fixed">
    <div class="flex flex-col gap-4 items-start">
      <div class="flex gap-4">
        <PlayerInfo />
        <div class="pt-2 flex items-center gap-1">
          {#each menuButtons as btn}
            <button
              class="cursor-pointer group relative"
              onclick={() => toggleMenu(btn.id)}
            >
              <img
                class="hover:scale-110 transition-transform w-12 h-12 {current_menu ===
                btn.id
                  ? 'brightness-125 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] scale-105'
                  : ''}"
                src={btn.icon}
                alt={btn.alt}
              />
              <div
                class="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 opacity-0 group-hover:opacity-100 transition-all duration-150 transform translate-y-1 group-hover:translate-y-0"
              >
                <div
                  class="w-48 bg-gray-100 text-slate-700 border-2 border-slate-500 rounded-lg p-2.5 text-center relative shadow-2xl"
                >
                  <p
                    class="font-bold text-slate-800 text-[11px] border-b border-slate-300 pb-0.5 mb-1 font-mono uppercase tracking-wide"
                  >
                    {btn.title}
                  </p>
                  <p
                    class="text-[10px] text-slate-600 leading-snug font-medium"
                  >
                    {btn.description}
                  </p>

                  <!-- Tooltip Arrow pointing up -->
                  <div
                    class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-500"
                  ></div>
                  <div
                    class="absolute bottom-full left-1/2 -translate-x-1/2 -mb-0.5 border-4 border-transparent border-b-gray-100"
                  ></div>
                </div>
              </div>
            </button>
          {/each}

          <!-- Help Button ( ? Square Badge ) -->
          <button
            class="cursor-pointer group relative"
            onclick={() => toggleMenu(Menus.HELP)}
          >
            <img
              class="hover:scale-110 transition-transform w-12 h-12 {current_menu ===
              Menus.HELP
                ? 'brightness-125 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] scale-105'
                : ''}"
              src="/sprites/icon_help.png"
              alt="help"
              onerror={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling.style.display = "flex";
              }}
            />
            <div
              class="hidden hover:scale-110 transition-transform w-12 h-12 bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-xl rounded-lg items-center justify-center border-b-4 border-amber-700 shadow-md"
            >
              ?
            </div>
            <div
              class="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 opacity-0 group-hover:opacity-100 transition-all duration-150 transform translate-y-1 group-hover:translate-y-0"
            >
              <div
                class="w-48 bg-gray-100 text-slate-700 border-2 border-slate-500 rounded-lg p-2.5 text-center relative shadow-2xl"
              >
                <p
                  class="font-bold text-slate-800 text-[11px] border-b border-slate-300 pb-0.5 mb-1 font-mono uppercase tracking-wide"
                >
                  Help & Guide
                </p>
                <p class="text-[10px] text-slate-600 leading-snug font-medium">
                  Learn game controls, shortcuts, and gameplay tips.
                </p>

                <!-- Tooltip Arrow pointing up -->
                <div
                  class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-500"
                ></div>
                <div
                  class="absolute bottom-full left-1/2 -translate-x-1/2 -mb-0.5 border-4 border-transparent border-b-gray-100"
                ></div>
              </div>
            </div>
          </button>

          <!-- Return to Start Menu Button ( M Square Badge with Confirmation Modal ) -->
          {#if onReturnMenu}
            <button
              class="cursor-pointer group relative ml-1"
              onclick={() => (showConfirmReturn = true)}
            >
              <img
                class="hover:scale-110 transition-transform w-12 h-12"
                src="/sprites/icon_home.png"
                alt="start menu"
                onerror={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling.style.display = "flex";
                }}
              />
              <div
                class="hidden hover:scale-110 transition-transform w-12 h-12 bg-slate-700 hover:bg-slate-600 text-slate-100 font-black text-xl rounded-lg items-center justify-center border-b-4 border-slate-900 shadow-md"
              >
                M
              </div>
              <div
                class="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 opacity-0 group-hover:opacity-100 transition-all duration-150 transform translate-y-1 group-hover:translate-y-0"
              >
                <div
                  class="w-48 bg-gray-100 text-slate-700 border-2 border-slate-500 rounded-lg p-2.5 text-center relative shadow-2xl"
                >
                  <p
                    class="font-bold text-slate-800 text-[11px] border-b border-slate-300 pb-0.5 mb-1 font-mono uppercase tracking-wide"
                  >
                    Start Menu
                  </p>
                  <p
                    class="text-[10px] text-slate-600 leading-snug font-medium"
                  >
                    Return to the main menu.
                  </p>

                  <!-- Tooltip Arrow pointing up -->
                  <div
                    class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-500"
                  ></div>
                  <div
                    class="absolute bottom-full left-1/2 -translate-x-1/2 -mb-0.5 border-4 border-transparent border-b-gray-100"
                  ></div>
                </div>
              </div>
            </button>
          {/if}
        </div>
      </div>
      <div class="flex gap-16 items-start">
        <Inventory />
        <QuestHUD
          onOpenQuestMenu={() => toggleMenu(Menus.QUEST)}
          onOpenBlockEditor={() => {
            current_menu = Menus.COMMAND;
            current_editor = Editors.BLOCK;
          }}
        />
      </div>
    </div>
  </div>

  <div class="flex gap-2">
    <!-- Command editor panel -->
    {#if Menus.COMMAND === current_menu}
      <div in:panelIn out:panelOut class="relative">
        <button
          class="absolute top-2 left-2 z-10 bg-gray-300 border-2 border-gray-400"
          onclick={toggleEditor}
        >
          {#if current_editor === Editors.BLOCK}
            <!-- Show Text icon (switch TO text) -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="20px"
              viewBox="0 -960 960 960"
              width="20px"
              fill="#666666"
            >
              <path
                d="M280-160v-520H80v-120h520v120H400v520H280Zm360 0v-320H520v-120h360v120H760v320H640Z"
              />
            </svg>
          {:else}
            <!-- Show Block icon (switch TO block) -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="20px"
              viewBox="0 -960 960 960"
              width="20px"
              fill="#666666"
            >
              <path
                d="M440-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h240v720Zm-80-80v-560H200v560h160Zm160-320v-320h240q33 0 56.5 23.5T840-760v240H520Zm80-80h160v-160H600v160Zm-80 480v-320h320v240q0 33-23.5 56.5T760-120H520Zm80-80h160v-160H600v160ZM360-480Zm240-120Zm0 240Z"
              />
            </svg>
          {/if}
        </button>

        {#if current_editor === Editors.TEXT}
          <TextBased />
        {:else}
          <BlockBased />
        {/if}
      </div>
    {/if}

    {#if current_menu === Menus.DOCUMENT}
      <div in:panelIn out:panelOut>
        <Document />
      </div>
    {:else if current_menu === Menus.QUEST}
      <div in:panelIn out:panelOut>
        <Quest />
      </div>
    {:else if current_menu === Menus.SHOP}
      <div in:panelIn out:panelOut>
        <Shop />
      </div>
    {:else if current_menu === Menus.RESEARCH}
      <div in:panelIn out:panelOut>
        <ResearchTree />
      </div>
    {:else if current_menu === Menus.HELP}
      <div in:panelIn out:panelOut>
        <HelpModal onClose={() => toggleMenu(Menus.NONE)} />
      </div>
    {/if}
  </div>
</div>

<!-- Return to Start Menu Confirmation Modal -->
{#if showConfirmReturn}
  <div
    class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none"
  >
    <div
      class="w-full max-w-sm bg-gray-100 border-4 border-slate-500 rounded-xl p-5 text-slate-700 space-y-4 shadow-2xl"
    >
      <div
        class="flex justify-between items-center border-b-2 border-slate-300 pb-2"
      >
        <h3 class="font-bold text-sm text-slate-800 uppercase">
          Return to Start Menu
        </h3>
        <button
          onclick={() => (showConfirmReturn = false)}
          class="text-slate-500 hover:text-slate-800 font-bold text-xs cursor-pointer"
          >✕</button
        >
      </div>

      <p
        class="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-300"
      >
        Are you sure you want to return to the Start Menu? Any unsaved progress
        will be lost.
      </p>

      <div class="flex justify-end gap-2 pt-1">
        <button
          onclick={() => (showConfirmReturn = false)}
          class="px-4 py-1.5 bg-gray-300 hover:bg-gray-400 text-slate-800 font-bold rounded-lg text-xs border border-slate-400 cursor-pointer transition-colors"
        >
          Cancel
        </button>

        <button
          onclick={() => {
            showConfirmReturn = false;
            if (onReturnMenu) onReturnMenu();
          }}
          class="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs shadow cursor-pointer transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  button {
    border-radius: 0.2rem;
    padding: 0.2rem;
  }
</style>
