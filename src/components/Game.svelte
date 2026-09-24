<script>
  import { attachCameraControls, snapZoom, clampFarmCamera } from "../game/camera-controls.js";
  import { CAMERA, CONFIG } from "../game/global/global.js";
  import { createTransientNotice } from "./transient-notice.js";
  import { fly } from "svelte/transition";
  import TutorialTarget from "./TutorialTarget.svelte";
  import QuestFeedback from "./QuestFeedback.svelte";
  import { tutorialPolicy } from "../game/global/tutorial.js";
  import { TUTORIAL, QUEST_FEEDBACK } from "./global.svelte.js";
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
  import FarmIntroduction from "./FarmIntroduction.svelte";
  import { farmEntryScreen } from "./farm-entry.js";
  import { preferences } from "../game/utils/preferences.js";
  import OnboardingModal from "./OnboardingModal.svelte";
  import DidYouKnowPopup from "./DidYouKnowPopup.svelte";
  import UnlockFlyOverlay from "./UnlockFlyOverlay.svelte";
  import EventBanner from "./EventBanner.svelte";
  import { createResizable, panelIn, panelOut } from "./interface.svelte.js";
  import { Modals, triggerDidYouKnow, ONBOARDING, beginActiveQuest, robots_state } from "./global.svelte.js";
  import GameDevTools from "./GameDevTools.svelte";
  import DDADashboard from "./DDADashboard.svelte";
  import { k } from "../lib/kaplay.js";
  import { onMount, onDestroy, tick } from "svelte";
  import DocumentationPreview from "./DocumentationPreview.svelte";
  import { telemetry } from "../game/ml/telemetry.js";
  import { eventScheduler } from "../game/ml/event-scheduler.js";
  import { mlAgent } from "../game/ml/agent.js";
  import { dataLogger } from "../game/ml/data-logger.js";
  import { dda } from "../game/ml/dda.js";
  import { stopCodeRuns } from "../game/global/code-runner.js";
  import { configureFarmEvents } from "../game/event.js";
  import { farm_grid_index } from "../game/game.js";

  let { onReturnMenu, isNewFarm = false } = $props();

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
      title: "Learning Progress",
      description: "Review practiced skills and choose what to learn next.",
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
  let docQuery=$state("");
  let docOpen=$state(false), docLoaded=$state(false), showDocEditor=$state(false), docPreview=$state(null);
  let blockEditor=$state(), textEditor=$state();
  let previewOpener, previewFocusTimer;
  async function closeDocPreview(){
    docPreview=null;
    await tick();
    clearTimeout(previewFocusTimer);
    previewFocusTimer=setTimeout(()=>{if(!docPreview&&docOpen)previewOpener?.focus();},350);
  }
  onDestroy(()=>clearTimeout(previewFocusTimer));
  function closeDocumentation(){ docOpen=false; document.getElementById("documentation-menu-button")?.focus(); }
  async function insertDocumentation(example, editor){
    current_editor=editor==="text"?Editors.TEXT:Editors.BLOCK;
    current_menu=Menus.COMMAND; showDocEditor=true; await tick();
    if(editor==="text")textEditor.insertExample(example.code);else blockEditor.insertExample(example.block);
  }
  let showOnboarding = $state(false);
  let showIntroduction = $state(false);
  let showDDADashboard = $state(false);
  let showConfirmReturn = $state(false);
  let activeHint = $state("");
  let storageWarning = $state("");

  let game_speed = $state(k.debug.timeScale);
  let camera_scale = $state(1);

  onMount(() => {
    let disposed = false;
    let saved = false;
    const detachCamera = attachCameraControls({canvas:document.getElementById("game"), engine:k, camera:CAMERA,
      enabled:() => !ONBOARDING.isModalOpen && !showConfirmReturn && !Object.values(Modals).some(Boolean),
      getFarm:() => CONFIG.FARM, getZoom:() => camera_scale, setZoom:value => camera_scale=value});
    const hintNotice = createTransientNotice(message => activeHint = message);
    let predictionTimer;
    let saveTimer;
    const entryScreen = farmEntryScreen(isNewFarm, preferences);
    showIntroduction = entryScreen === "demonstration";
    showOnboarding = entryScreen === "onboarding";
    let participantId = `p_${crypto.randomUUID()}`;
    try {
      participantId = localStorage.getItem("algobot_participant_id") || participantId;
      localStorage.setItem("algobot_participant_id", participantId);
    } catch {
      storageWarning = "Browser storage is unavailable. Export research data before closing this page.";
    }
    tutorialPolicy.protected = TUTORIAL.active;
    ONBOARDING.isModalOpen = showOnboarding || showIntroduction;
    const shouldRun = () => k.debug.timeScale > 0 && !ONBOARDING.isModalOpen && !document.hidden;
    configureFarmEvents(farm_grid_index, { shouldRun });
    const resumedStage = telemetry.currentStage;
    telemetry.resetSession();
    telemetry.setStage(resumedStage);
    mlAgent.resetSession();
    telemetry.setParticipantId(participantId);

    function saveSession() {
      if (saved) return;
      stopCodeRuns(robots_state, telemetry);
      mlAgent.endSession();
      saved = dataLogger.saveSessionLight();
    }
    window.addEventListener("beforeunload", saveSession);
    // Save independently of model loading so a slow fetch cannot block checkpoints.
    saveTimer = setInterval(() => {
      if (!dataLogger.saveSessionLight()) storageWarning = "Research data could not be saved. Export it before closing this page.";
    }, 30000);
    // Returning the cleanup synchronously is required by Svelte onMount.
    mlAgent.init().then(() => {
      if (disposed) return;
      eventScheduler.start({ shouldRun: () => shouldRun() && !TUTORIAL.active });
      predictionTimer = setInterval(() => {
        if (shouldRun() && !TUTORIAL.active) {
          mlAgent.updateAndPredict(telemetry.currentStage).then(() => {
            if (disposed) return;
            const nextHint = dda.activeHint || "";
            if (hintNotice.update(nextHint)) telemetry.recordHintShown(nextHint);
          }).catch(console.warn);
        }
      }, 5000);
    }).catch(console.warn);

    return () => {
      disposed = true;
      detachCamera();
      hintNotice.dispose();
      clearInterval(predictionTimer);
      clearInterval(saveTimer);
      window.removeEventListener("beforeunload", saveSession);
      eventScheduler.stop();
      configureFarmEvents(farm_grid_index, { shouldRun: () => false });
      saveSession();
      ONBOARDING.isModalOpen = false;
    };
  });
  $effect(() => {
    k.debug.timeScale = game_speed;
    k.setCamScale(camera_scale);
    clampFarmCamera(CAMERA, CONFIG.FARM);
    k.setCamPos(CAMERA.x, CAMERA.y);
  });

  $effect(() => {
    ONBOARDING.isModalOpen = showOnboarding || showIntroduction || !!docPreview || QUEST_FEEDBACK.hazardsPending || !!QUEST_FEEDBACK.queue[0]?.milestone;
  });

  function toggleEditor() {
    if (TUTORIAL.active) return;
    current_editor =
      current_editor === Editors.TEXT ? Editors.BLOCK : Editors.TEXT;
    // ML Pipeline: track editor mode as metadata (not ML feature)
    telemetry.recordEditorMode(
      current_editor === Editors.TEXT ? "text" : "blockly",
    );
  }

  function toggleMenu(menu) {
    if(menu===Menus.DOCUMENT){docOpen=!docOpen;docLoaded=true;showDocEditor=false;current_menu=Menus.COMMAND;return;}
    if(menu!==Menus.COMMAND)docOpen=false;
    if (menu === Menus.SHOP && current_menu !== Menus.SHOP) {
      triggerDidYouKnow("shop");
    }
    current_menu = current_menu === menu ? Menus.NONE : menu;
  }
</script>

<svelte:window onkeydown={e=>{if(e.key==="Escape"&&!docPreview&&docOpen){e.preventDefault();closeDocumentation();}}}/>
<div class:cutscene={showIntroduction||!!docPreview} class="fixed h-[97vh] top-2 right-2 bottom-2 overflow-hidden rounded-lg">
  {#if storageWarning}
    <div role="alert" class="fixed top-4 left-1/2 -translate-x-1/2 max-w-sm rounded-lg border-2 border-red-400 bg-white p-3 text-sm text-red-900 shadow-lg">{storageWarning}</div>
  {/if}
  {#if activeHint}
    <div role="status" in:fly={{y:30,duration:400}} out:fly={{y:30,duration:400}} class="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-sm rounded-lg border-2 border-amber-400 bg-amber-100 p-3 text-sm text-amber-950 shadow-lg">
      {activeHint}
    </div>
  {/if}
  <GameDevTools bind:showDDADashboard bind:gameSpeed={game_speed} />
  <DDADashboard bind:visible={showDDADashboard} />
  <LevelReward />
  <FarmPersonalize />
  <OnboardingModal bind:isOpen={showOnboarding} onClose={() => showOnboarding = false} />
  <FarmIntroduction bind:isOpen={showIntroduction} />
  {#if docPreview}<DocumentationPreview name={docPreview} onClose={closeDocPreview}/>{/if}
  <QuestFeedback />
  <TutorialTarget />
  <DidYouKnowPopup />
  <UnlockFlyOverlay />
  <EventBanner />

  <div class="fixed bottom-2 left-2 flex gap-2" title="Drag the farm to pan. Scroll over the farm to zoom.">
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
          onclick={() => (camera_scale = snapZoom(camera_scale - 0.1))}
          class="cursor-pointer"
        >
          <img
            class="hover:scale-110 transition-transform w-12 h-12"
            src="/sprites/icon_zoomout.png"
            alt="zoom out"
          />
        </button>
        <button
          onclick={() => (camera_scale = snapZoom(camera_scale + 0.1))}
          class="cursor-pointer"
        >
          <img
            class="hover:scale-110 transition-transform w-12 h-12"
            src="/sprites/icon_zoomin.png"
            alt="zoom in"
          />
        </button>
        <button title="Center farm" aria-label="Center farm" onclick={() => { camera_scale = 1; CAMERA.x = CONFIG.FARM.grid_origin.x + (CONFIG.FARM.columns * CONFIG.FARM.cell_size - CONFIG.FARM.gap) / 2; CAMERA.y = CONFIG.FARM.grid_origin.y + (CONFIG.FARM.rows * CONFIG.FARM.cell_size - CONFIG.FARM.gap) / 2; k.setCamPos(CAMERA.x,CAMERA.y); }} class="cursor-pointer">
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
          {#each menuButtons.filter(btn => !TUTORIAL.active || [Menus.COMMAND, Menus.DOCUMENT, Menus.QUEST, Menus.RESEARCH].includes(btn.id)) as btn}
            <button
              class="cursor-pointer group relative"
              id={btn.id === Menus.COMMAND ? "command-menu-button" : btn.id === Menus.DOCUMENT ? "documentation-menu-button" : undefined}
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
                    class="font-bold text-slate-800 text-[13px] border-b border-slate-300 pb-0.5 mb-1 font-mono uppercase tracking-wide"
                  >
                    {btn.title}
                  </p>
                  <p class="text-sm text-slate-600 leading-snug font-medium">
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
                  class="font-bold text-slate-800 text-[13px] border-b border-slate-300 pb-0.5 mb-1 font-mono uppercase tracking-wide"
                >
                  Help & Guide
                </p>
                <p class="text-sm text-slate-600 leading-snug font-medium">
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
                    class="font-bold text-slate-800 text-[13px] border-b border-slate-300 pb-0.5 mb-1 font-mono uppercase tracking-wide"
                  >
                    Start Menu
                  </p>
                  <p class="text-sm text-slate-600 leading-snug font-medium">
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
      <div class="flex gap-4 items-start" class:practice-layout={TUTORIAL.active}>
        <div class="inventory-slot"><Inventory /></div>
        <div class="quest-slot"><QuestHUD
          onOpenQuestMenu={() => toggleMenu(Menus.QUEST)}
          onOpenBlockEditor={() => {
            current_menu = Menus.COMMAND;
            current_editor = Editors.BLOCK;
          }}
        /></div>
      </div>
    </div>
  </div>

  <div class="reference-layout flex gap-2" class:docs-open={docOpen} class:show-editor={showDocEditor}>
    {#if docOpen}<button class="reference-switch" onclick={()=>showDocEditor=!showDocEditor}>{showDocEditor?"Back to reference":"Show editor"}</button>{/if}
    <!-- Command editor panel -->
    {#if Menus.COMMAND === current_menu || docOpen}
      <div in:panelIn out:panelOut class="relative editor-pane z-50">
        <button
          class="absolute top-2 left-4 z-[110] bg-gray-300 border-2 border-gray-400"
          disabled={TUTORIAL.active}
          title={TUTORIAL.active ? "Text coding unlocks after your first loop" : "Switch editor"}
          aria-label={current_editor === Editors.BLOCK ? "Switch to text editor" : "Switch to block editor"}
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

        <div class:hidden={current_editor!==Editors.TEXT}><TextBased bind:this={textEditor}/></div>
        <div class:hidden={current_editor!==Editors.BLOCK}><BlockBased bind:this={blockEditor}/></div>
      </div>
    {/if}

    {#if docLoaded}
      <div class="doc-pane" class:doc-hidden={!docOpen} inert={!docOpen}>
        <Document bind:query={docQuery} onClose={closeDocumentation} onInsert={insertDocumentation} targetName={editor=>(editor==="text"?textEditor:blockEditor)?.targetName()??"Bot 0"} onPreview={name=>{previewOpener=document.activeElement;stopCodeRuns(robots_state,telemetry);docPreview=name;}} />
      </div>
    {/if}
    {#if current_menu === Menus.QUEST}
      <div in:panelIn out:panelOut>
        <Quest />
      </div>
    {:else if current_menu === Menus.SHOP}
      <div in:panelIn out:panelOut>
        <Shop />
      </div>
    {:else if current_menu === Menus.RESEARCH}
      <div in:panelIn out:panelOut>
        <ResearchTree onClose={()=>toggleMenu(Menus.NONE)} onPractice={()=>toggleMenu(Menus.QUEST)} onReference={query=>{docQuery=query;docOpen=true;docLoaded=true;current_menu=Menus.COMMAND;}} onPreview={name=>{previewOpener=document.activeElement;stopCodeRuns(robots_state,telemetry);docPreview=name;}} />
      </div>
    {:else if current_menu === Menus.HELP}
      <div in:panelIn out:panelOut>
        <HelpModal onClose={() => toggleMenu(Menus.NONE)} onShowIntroduction={() => { stopCodeRuns(robots_state, telemetry); current_menu = Menus.NONE; showIntroduction = true; }} />
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
          class="text-slate-500 hover:text-slate-800 font-bold text-sm cursor-pointer"
          >✕</button
        >
      </div>

      <p
        class="text-sm text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-300"
      >
        Return to the Start Menu? Your farm will pause and can be resumed here. Reloading the page starts a new farm. Research data is stored separately when browser storage is available.
      </p>

      <div class="flex justify-end gap-2 pt-1">
        <button
          onclick={() => (showConfirmReturn = false)}
          class="px-4 py-1.5 bg-gray-300 hover:bg-gray-400 text-slate-800 font-bold rounded-lg text-sm border border-slate-400 cursor-pointer transition-colors"
        >
          Cancel
        </button>

        <button
          onclick={() => {
            showConfirmReturn = false;
            if (onReturnMenu) onReturnMenu();
          }}
          class="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm shadow cursor-pointer transition-colors"
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

  .cutscene > :global(*){visibility:hidden}
  .cutscene > :global(.live-cutscene){visibility:visible}
  .reference-switch{display:none;color:#334155}.doc-pane{margin-top:90px;transition:opacity 220ms,transform 220ms,visibility 220ms;transform-origin:top right}.doc-hidden{position:absolute;visibility:hidden;pointer-events:none;opacity:0;transform:translateY(12px) scale(.98)}.hidden{display:none}
  @media(prefers-reduced-motion:reduce){.doc-pane{transition:none}}
  @starting-style{.doc-pane{opacity:0;transform:translateY(12px) scale(.98)}}
  @media(max-width:1400px){.docs-open .editor-pane{display:none}.docs-open.show-editor .editor-pane{display:block}.docs-open.show-editor .doc-pane{display:none}.reference-switch{display:block;position:fixed;right:20px;bottom:12px;background:#bbf7d0;border:2px solid #64748b;z-index:70;padding:8px}.doc-pane{margin-top:110px}}
  .inventory-slot{width:112px;min-width:112px;flex-shrink:0}
  .quest-slot{width:300px;min-width:0}
  @media(max-width:1050px){
    .practice-layout{gap:12px}
    .quest-slot{width:250px}
  }
  @media(max-width:900px){
    .quest-slot{position:fixed;left:144px;top:108px;width:230px;z-index:60}
    .quest-slot :global(.mission){max-height:35vh;overflow:auto}
    .editor-pane{position:fixed;bottom:12px;right:12px}
    .editor-pane :global(.command-panel){height:48vh;max-width:calc(100vw - 24px)}
  }
  @media(max-width:480px){
    .quest-slot{left:132px;right:12px;width:auto}
  }
</style>
