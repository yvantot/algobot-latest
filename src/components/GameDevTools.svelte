<script>
  import { onMount } from "svelte";
  import {
    addFarmbot,
    addBug,
    addCrop,
    addSoilToGrid,
  } from "../game/components-kaplay/components";
  import {
    robots,
    QUEST_STATE,
    claimQuest,
    triggerDidYouKnow,
    DID_YOU_KNOW_STATE,
  } from "./global.svelte";
  import { QUEST_DATA } from "../game/global/quests.js";
  import {
    CONFIG,
    PLAYER_DATA,
    INVENTORY,
    SHOP_DATA,
    CROP_DATA,
  } from "../game/global/global";
  import { CropTypes, SoilStates, CropStates } from "../game/global/enum.js";
  import { buyLand, buyUpgrade, buyPlants } from "../game/global/shop.js";
  import { farm_grid_index } from "../game/game";

  let isVisible = $state(false);
  let position = $state({ x: 20, y: 20 });
  let size = $state({ w: 380, h: 580 });
  let activeTab = $state("world");
  let log = $state([]);
  let questKey = $state(Object.keys(QUEST_DATA)[0]);
  let questAmt = $state(1);

  // Bot tab state
  let botIndex = $state(0);
  let botSayText = $state("Hello!");
  let botPlantCrop = $state(CropTypes.WHEAT);
  let botJumpX = $state(0);
  let botJumpY = $state(0);

  // Batch tab state
  let batchCrop = $state(CropTypes.WHEAT);
  let batchBugCount = $state(3);

  // Inspect tab state
  let inspectX = $state(0);
  let inspectY = $state(0);
  let inspectFilter = $state("all"); // "all", "crop", "bug", "bot"

  const TABS = [
    { id: "world",   label: "World"   },
    { id: "player",  label: "Player"  },
    { id: "quests",  label: "Quests"  },
    { id: "bot",     label: "Bot"     },
    { id: "batch",   label: "Batch"   },
    { id: "inspect", label: "Inspect" },
  ];

  const CROP_ICONS = {
    [CropTypes.WHEAT]:     "[W]",
    [CropTypes.CORN]:      "[C]",
    [CropTypes.RICE]:      "[R]",
    [CropTypes.POTATO]:    "[P]",
    [CropTypes.SUGARCANE]: "[S]",
    [CropTypes.TOMATO]:    "[T]",
  };

  const SOIL_STATE_NAMES = {
    [SoilStates.INITIAL]: "INITIAL (0)",
    [SoilStates.READY]:   "READY (1)",
    [SoilStates.WATERED]: "WATERED (2)",
  };

  onMount(() => {
    const handleKeydown = (e) => {
      if (e.key === "\\") isVisible = !isVisible;
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  function push(msg, color = "text-gray-300") {
    const ts = new Date().toLocaleTimeString("en", { hour12: false });
    log = [{ ts, msg, color }, ...log].slice(0, 80);
  }

  function run(label, fn, color = "text-gray-200") {
    try {
      fn();
      push(`✓ ${label}`, color);
    } catch (e) {
      push(`✗ ${label}: ${e.message}`, "text-red-400");
    }
  }

  function drag(node) {
    let moving = false;
    const onMouseDown = (e) => {
      const isResizeHandle =
        e.offsetX > node.offsetWidth - 20 && e.offsetY > node.offsetHeight - 20;
      if (e.target.closest("button, input, select") || isResizeHandle) return;
      moving = true;
    };
    const onMouseMove = (e) => {
      if (moving)
        position = { x: position.x + e.movementX, y: position.y + e.movementY };
    };
    const onMouseUp = () => (moving = false);
    node.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return {
      destroy: () => {
        node.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      },
    };
  }

  // Helpers
  function randomCell() {
    const x = Math.floor(Math.random() * CONFIG.FARM.columns);
    const y = Math.floor(Math.random() * CONFIG.FARM.rows);
    return { x, y };
  }

  function firstBot() {
    return robots[0] ?? null;
  }

  function getBot(idx) {
    const b = robots[idx] ?? null;
    if (!b) throw new Error(`No bot at index ${idx}`);
    return b;
  }

  /** Iterate all valid grid cells */
  function allCells() {
    const cells = [];
    for (let y = 0; y < CONFIG.FARM.rows; y++)
      for (let x = 0; x < CONFIG.FARM.columns; x++) cells.push({ x, y });
    return cells;
  }

  function getTile(x, y) {
    return farm_grid_index.get(`${y}-${x}`);
  }

  // ── Batch helpers ───────────────────────────────────────────────────────────

  function batchTillAll() {
    let count = 0;
    for (const { x, y } of allCells()) {
      const tile = getTile(x, y);
      if (!tile) continue;
      const { soil } = tile;
      if (soil && soil.soil_state === SoilStates.INITIAL) {
        soil.setSoilState(SoilStates.READY);
        count++;
      }
    }
    return count;
  }

  function batchWaterAll() {
    let count = 0;
    for (const { x, y } of allCells()) {
      const tile = getTile(x, y);
      if (!tile) continue;
      const { soil } = tile;
      if (soil && soil.soil_state === SoilStates.READY) {
        soil.setSoilState(SoilStates.WATERED);
        count++;
      }
    }
    return count;
  }

  function batchPlantAll(type) {
    let count = 0;
    for (const { x, y } of allCells()) {
      const tile = getTile(x, y);
      if (!tile) continue;
      const { soil, crop } = tile;
      if (
        !crop &&
        soil &&
        (soil.soil_state === SoilStates.READY ||
          soil.soil_state === SoilStates.WATERED)
      ) {
        if (INVENTORY.crops[type] <= 0) {
          push(`Ran out of ${type} seeds`, "text-red-400");
          break;
        }
        const newCrop = addCrop(farm_grid_index, type, x, y);
        farm_grid_index.set(`${y}-${x}`, { ...tile, crop: newCrop });
        INVENTORY.changeCrops(type, -1);
        count++;
      }
    }
    return count;
  }

  function batchHarvestAll() {
    let count = 0;
    for (const { x, y } of allCells()) {
      const tile = getTile(x, y);
      if (!tile?.crop) continue;
      const { crop } = tile;
      if (crop.crop_state === CropStates.HARVESTABLE) {
        crop.harvest();
        count++;
      }
    }
    return count;
  }

  function batchDestroyAll() {
    let count = 0;
    for (const { x, y } of allCells()) {
      const tile = getTile(x, y);
      if (!tile?.crop) continue;
      if (!tile.crop.absorbing_water) {
        tile.crop.cropDestroy();
        count++;
      }
    }
    return count;
  }

  function batchResetSoil() {
    let count = 0;
    for (const { x, y } of allCells()) {
      const tile = getTile(x, y);
      if (!tile?.soil) continue;
      // Destroy crop first if any
      if (tile.crop && !tile.crop.absorbing_water) {
        tile.crop.cropDestroy();
      }
      tile.soil.setSoilState(SoilStates.INITIAL);
      count++;
    }
    return count;
  }

  function batchInstantGrow() {
    let count = 0;
    for (const { x, y } of allCells()) {
      const tile = getTile(x, y);
      if (!tile?.crop) continue;
      const { crop } = tile;
      if (
        crop.crop_state !== CropStates.HARVESTABLE &&
        crop.crop_state !== CropStates.DEAD
      ) {
        crop.crop_state = CropStates.HARVESTABLE;
        crop.sprite = `${crop.crop_type}${CropStates.HARVESTABLE}`;
        // Also reset soil to READY so the crop doesn't keep absorbing water
        const { soil } = tile;
        if (soil && soil.soil_state === SoilStates.WATERED) {
          crop.absorbing_water = false;
        }
        count++;
      }
    }
    return count;
  }

  function batchKillAllBugs() {
    let count = 0;
    for (const { x, y } of allCells()) {
      const tile = getTile(x, y);
      if (!tile?.bug) continue;
      tile.bug.bugDestroy();
      count++;
    }
    return count;
  }

  function batchDeadAll() {
    let count = 0;
    for (const { x, y } of allCells()) {
      const tile = getTile(x, y);
      if (!tile?.crop) continue;
      const { crop } = tile;
      if (crop.crop_state !== CropStates.DEAD) {
        crop.crop_state = CropStates.DEAD;
        crop.sprite = `${crop.crop_type}${CropStates.DEAD}`;
        count++;
      }
    }
    return count;
  }

  function getGridEntries() {
    if (!farm_grid_index) return [];
    const entries = [];
    for (const [key, data] of farm_grid_index.entries()) {
      if (!data) continue;
      const { soil, crop, bug, bots } = data;
      const hasCrop = !!crop;
      const hasBug = !!bug;
      const hasBots = Array.isArray(bots) && bots.length > 0;

      if (inspectFilter === "crop" && !hasCrop) continue;
      if (inspectFilter === "bug" && !hasBug) continue;
      if (inspectFilter === "bot" && !hasBots) continue;

      entries.push({ key, data, soil, crop, bug, bots });
    }
    return entries;
  }
</script>

{#snippet btn(label, color = "text-gray-200", cb)}
  <button
    onclick={() => cb && cb()}
    class="rounded bg-gray-800 px-2 py-1 text-left text-xs transition-colors hover:bg-gray-700 active:scale-95 cursor-pointer {color}"
    >{label}</button
  >
{/snippet}

{#snippet sec(title)}
  <h3
    class="mt-3 mb-1 text-[9px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800 pb-1"
  >
    {title}
  </h3>
{/snippet}

{#snippet cropSelect(label, bind_val, on_change)}
  <select
    value={bind_val}
    onchange={(e) => on_change(e.target.value)}
    class="rounded bg-gray-800 px-2 py-1 text-xs text-white border border-gray-700 cursor-pointer flex-1"
  >
    {#each Object.values(CropTypes) as crop}
      <option value={crop}>{crop}</option>
    {/each}
  </select>
{/snippet}

{#if isVisible}
  <div
    use:drag
    class="fixed z-[9999] flex flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-950/97 text-white shadow-2xl backdrop-blur-md"
    style:left="{position.x}px"
    style:top="{position.y}px"
    style:width="{size.w}px"
    style:height="{size.h}px"
    style:resize="both"
  >
    <!-- Header -->
    <div
      class="flex cursor-grab items-center justify-between bg-gray-900 px-4 py-2 active:cursor-grabbing select-none shrink-0"
    >
      <div class="flex items-center gap-2">
        <div class="h-2 w-2 rounded-full bg-gray-400"></div>
        <span
          class="text-[10px] font-black uppercase tracking-tighter text-gray-300"
          >Dev Console</span
        >
        <span class="text-[9px] text-gray-600">[ \ ] to toggle</span>
      </div>
      <button
        onclick={() => (isVisible = false)}
        class="text-gray-500 hover:text-white cursor-pointer">✕</button
      >
    </div>

    <!-- Tabs -->
    <div class="flex shrink-0 border-b border-gray-800 bg-gray-900/60 overflow-x-auto">
      {#each TABS as tab}
        <button
          onclick={() => (activeTab = tab.id)}
          class="flex-1 py-1.5 px-2 text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap {activeTab ===
          tab.id
            ? 'bg-gray-800 text-white'
            : 'text-gray-500 hover:text-gray-300'}">{tab.label}</button
        >
      {/each}
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-3 custom-scrollbar text-xs space-y-1">
      <!-- WORLD TAB -->
      {#if activeTab === "world"}
        {@render sec("Spawn Entity")}
        <div class="grid grid-cols-2 gap-1">
          {@render btn("Spawn Bot", "text-gray-200", () =>
            run("Spawn Bot", () => {
              const { x, y } = randomCell();
              addFarmbot(robots.length, farm_grid_index, x, y);
            }),
          )}
          {@render btn("Spawn Bug", "text-gray-200", () =>
            run("Spawn Bug", () => {
              addBug(farm_grid_index);
            }),
          )}
        </div>

        {@render sec("Seeds & Resources")}
        <div class="grid grid-cols-2 gap-1">
          {#each Object.values(CropTypes) as crop}
            {@render btn(
              `${crop} +10`,
              "text-gray-200",
              () =>
                run(`${crop} +10`, () => {
                  INVENTORY.crops[crop] += 10;
                  INVENTORY.updateUI();
                }),
            )}
          {/each}
          {@render btn("Coins +500", "text-gray-200", () =>
            run("Coins +500", () => INVENTORY.changeCoins(500)),
          )}
          {@render btn("Coins +9999", "text-gray-200", () =>
            run("Coins +9999", () => INVENTORY.changeCoins(9999)),
          )}
        </div>

        {@render sec("Shop Unlocks")}
        <div class="grid grid-cols-2 gap-1">
          {#each Object.values(CropTypes) as crop}
            {@render btn(`Unlock ${crop}`, "text-gray-200", () =>
              run(`Unlock ${crop}`, () => {
                if (SHOP_DATA.seeds[crop])
                  SHOP_DATA.seeds[crop].unlocked = true;
              }),
            )}
          {/each}
          {@render btn("Unlock All Shop Items", "text-gray-200", () =>
            run("Unlock all shop", () => {
              for (const cat of Object.values(SHOP_DATA))
                for (const item of Object.values(cat)) item.unlocked = true;
            }),
          )}
        </div>

        {@render sec("Bot Speed (All Bots)")}
        <div class="grid grid-cols-3 gap-1">
          {@render btn("Turbo Speed", "text-gray-200", () =>
            run("Turbo speed", () => {
              for (const r of robots) {
                if (r) {
                  r.botmove_duration = 0.05;
                  r.botact_duration = 0.05;
                  r.botcheck_duration = 0.05;
                }
              }
            }),
          )}
          {@render btn("Slow Speed", "text-gray-200", () =>
            run("Slow speed", () => {
              for (const r of robots) {
                if (r) {
                  r.botmove_duration = 2;
                  r.botact_duration = 2;
                  r.botcheck_duration = 1;
                }
              }
            }),
          )}
          {@render btn("Reset Speed", "text-gray-200", () =>
            run("Reset speed", () => {
              for (const r of robots) {
                if (r) {
                  r.botmove_duration = CONFIG.BOT.move_duration;
                  r.botact_duration = CONFIG.BOT.action_duration;
                  r.botcheck_duration = CONFIG.BOT.check_duration;
                }
              }
            }),
          )}
        </div>

        {@render sec("Did You Know? Popups")}
        <div class="grid grid-cols-2 gap-1">
          {@render btn("Spoilage Tip", "text-gray-200", () =>
            run("Tip: Spoilage", () => {
              DID_YOU_KNOW_STATE.shown.spoilage = false;
              triggerDidYouKnow("spoilage");
            }),
          )}
          {@render btn("Soil Tip", "text-gray-200", () =>
            run("Tip: Soil", () => {
              DID_YOU_KNOW_STATE.shown.soil = false;
              triggerDidYouKnow("soil");
            }),
          )}
          {@render btn("Bugs Tip", "text-gray-200", () =>
            run("Tip: Bugs", () => {
              DID_YOU_KNOW_STATE.shown.bugs = false;
              triggerDidYouKnow("bugs");
            }),
          )}
          {@render btn("Shop Tip", "text-gray-200", () =>
            run("Tip: Shop", () => {
              DID_YOU_KNOW_STATE.shown.shop = false;
              triggerDidYouKnow("shop");
            }),
          )}
          {@render btn("Freshness Tip", "text-gray-200", () =>
            run("Tip: Freshness", () => {
              DID_YOU_KNOW_STATE.shown.freshness = false;
              triggerDidYouKnow("freshness");
            }),
          )}
          {@render btn("Seed Drop Tip", "text-gray-200", () =>
            run("Tip: Seed Drop", () => {
              DID_YOU_KNOW_STATE.shown.seed_drop = false;
              triggerDidYouKnow("seed_drop");
            }),
          )}
          {@render btn("Corn Synergy Tip", "text-gray-200", () =>
            run("Tip: Corn Synergy", () => {
              DID_YOU_KNOW_STATE.shown.corn_synergy = false;
              triggerDidYouKnow("corn_synergy");
            }),
          )}
          {@render btn("Sugarcane Tip", "text-gray-200", () =>
            run("Tip: Sugarcane", () => {
              DID_YOU_KNOW_STATE.shown.sugarcane = false;
              triggerDidYouKnow("sugarcane");
            }),
          )}
          {@render btn("Bot Check Tip", "text-gray-200", () =>
            run("Tip: Bot Check", () => {
              DID_YOU_KNOW_STATE.shown.bot_check = false;
              triggerDidYouKnow("bot_check");
            }),
          )}
          {@render btn("Out of Bounds Tip", "text-gray-200", () =>
            run("Tip: Out of Bounds", () => {
              DID_YOU_KNOW_STATE.shown.out_of_bounds = false;
              triggerDidYouKnow("out_of_bounds");
            }),
          )}
          {@render btn("Bug Damage Tip", "text-gray-200", () =>
            run("Tip: Bug Damage", () => {
              DID_YOU_KNOW_STATE.shown.bug_damage = false;
              triggerDidYouKnow("bug_damage");
            }),
          )}
        </div>
        {@render btn("Reset All Tip History", "text-gray-200", () =>
          run("Reset Tip History", () => {
            DID_YOU_KNOW_STATE.shown = {};
            DID_YOU_KNOW_STATE.activeTip = null;
          }),
        )}

        <!-- PLAYER TAB -->
      {:else if activeTab === "player"}
        {@render sec("Experience")}
        <div class="grid grid-cols-2 gap-1">
          {@render btn("+10 EXP", "text-gray-200", () =>
            run("+10 EXP", () => PLAYER_DATA.changeExp(10)),
          )}
          {@render btn("+100 EXP", "text-gray-200", () =>
            run("+100 EXP", () => PLAYER_DATA.changeExp(100)),
          )}
          {@render btn("+500 EXP", "text-gray-200", () =>
            run("+500 EXP", () => PLAYER_DATA.changeExp(500)),
          )}
          {@render btn("Level Up", "text-gray-200", () =>
            run("Level Up", () =>
              PLAYER_DATA.changeExp(100 - (PLAYER_DATA.exp % 100)),
            ),
          )}
        </div>

        {@render sec("State Info")}
        <div class="rounded bg-gray-900 p-2 text-[10px] font-mono space-y-0.5 border border-gray-800">
          <p class="text-gray-400">
            Level: <span class="text-white">{PLAYER_DATA.getLevel()}</span>
          </p>
          <p class="text-gray-400">
            EXP: <span class="text-white">{PLAYER_DATA.exp}</span>
          </p>
          <p class="text-gray-400">
            Coins: <span class="text-white">{INVENTORY.coins}</span>
          </p>
          {#each Object.values(CropTypes) as crop}
            <p class="text-gray-400">
              {crop}:
              <span class="text-white">{INVENTORY.crops[crop]}</span>
            </p>
          {/each}
          <p class="text-gray-400">
            Bots alive: <span class="text-white"
              >{robots.filter(Boolean).length}</span
            >
          </p>
          <p class="text-gray-400">
            Farm: <span class="text-white"
              >{CONFIG.FARM.rows}×{CONFIG.FARM.columns}</span
            >
          </p>
        </div>

        {@render sec("Reset")}
        {@render btn("Reset All Progress", "text-red-400", () =>
          run("Reset progress", () => {
            PLAYER_DATA.exp = 0;
            PLAYER_DATA.updateUI();
            INVENTORY.coins = 0;
            INVENTORY.changeCoins(0);
            for (const crop of Object.values(CropTypes))
              INVENTORY.crops[crop] = 0;
            INVENTORY.updateUI();
            push("Progress reset", "text-red-400");
          }),
        )}

        <!-- QUESTS TAB -->
      {:else if activeTab === "quests"}
        {@render sec("Progress a Quest")}
        <div class="flex gap-1 mb-1">
          <select
            bind:value={questKey}
            class="flex-1 rounded bg-gray-800 px-2 py-1 text-xs text-white border border-gray-700 cursor-pointer"
          >
            {#each Object.entries(QUEST_DATA) as [key, data]}
              <option value={key}>{data.title}</option>
            {/each}
          </select>
        </div>
        <div class="flex gap-1">
          <input
            type="number"
            bind:value={questAmt}
            min="1"
            max="999"
            class="w-16 rounded bg-gray-800 px-2 py-1 text-xs border border-gray-700 text-white"
          />
          {@render btn("Add Progress", "text-gray-200", () =>
            run(`Quest: +${questAmt} to ${questKey}`, () => {
              const state = QUEST_STATE[questKey];
              if (!state) throw new Error("Quest not found");
              state.progress = Math.min(
                state.progress + Number(questAmt),
                QUEST_DATA[questKey].goal,
              );
              if (state.progress >= QUEST_DATA[questKey].goal)
                state.is_completed = true;
            }),
          )}
          {@render btn("Complete", "text-gray-200", () =>
            run(`Complete ${questKey}`, () => {
              const state = QUEST_STATE[questKey];
              if (!state) throw new Error("Quest not found");
              state.progress = QUEST_DATA[questKey].goal;
              state.is_completed = true;
            }),
          )}
          {@render btn("Claim", "text-gray-200", () =>
            run(`Claim ${questKey}`, () => claimQuest(questKey)),
          )}
        </div>

        {@render sec("Bulk Actions")}
        <div class="grid grid-cols-2 gap-1">
          {@render btn("Complete All", "text-gray-200", () =>
            run("Complete all quests", () => {
              for (const key of Object.keys(QUEST_DATA)) {
                QUEST_STATE[key].progress = QUEST_DATA[key].goal;
                QUEST_STATE[key].is_completed = true;
              }
            }),
          )}
          {@render btn("Claim All", "text-gray-200", () =>
            run("Claim all quests", () => {
              for (const key of Object.keys(QUEST_DATA)) claimQuest(key);
            }),
          )}
          {@render btn("Reset All", "text-red-400", () =>
            run("Reset all quests", () => {
              for (const key of Object.keys(QUEST_DATA)) {
                QUEST_STATE[key].progress = 0;
                QUEST_STATE[key].is_completed = false;
                QUEST_STATE[key].is_claimed = false;
              }
            }),
          )}
        </div>

        {@render sec("Quest Status")}
        <div
          class="rounded bg-gray-900 p-2 text-[10px] font-mono space-y-0.5 max-h-40 overflow-y-auto border border-gray-800"
        >
          {#each Object.entries(QUEST_DATA) as [key, data]}
            {@const state = QUEST_STATE[key]}
            <div class="flex justify-between items-center">
              <span class="text-gray-400 truncate max-w-[160px]"
                >{data.title}</span
              >
              <span class="text-gray-300">
                {state?.is_claimed
                  ? "Claimed"
                  : state?.is_completed
                    ? "Done"
                    : `${state?.progress ?? 0}/${data.goal}`}
              </span>
            </div>
          {/each}
        </div>

        <!-- BOT TAB -->
      {:else if activeTab === "bot"}
        <!-- Bot Selector -->
        {@render sec("Target Bot")}
        <div class="flex gap-1 items-center mb-1">
          <span class="text-[10px] text-gray-500">Bot Index:</span>
          <input
            type="number"
            bind:value={botIndex}
            min="0"
            max={Math.max(0, robots.filter(Boolean).length - 1)}
            class="w-14 rounded bg-gray-800 px-2 py-1 text-xs border border-gray-700 text-white"
          />
          <span class="text-[10px] text-gray-400 italic">
            {robots.filter(Boolean).length} bot(s) active
          </span>
        </div>

        <!-- Movement -->
        {@render sec("Movement")}
        <div class="grid grid-cols-3 gap-1">
          <div></div>
          {@render btn("Up", "text-gray-200", () =>
            run("bot.up", () => {
              const b = getBot(botIndex);
              b.botJump(b.grid_x, b.grid_y - 1);
            }),
          )}
          <div></div>
          {@render btn("Left", "text-gray-200", () =>
            run("bot.left", () => {
              const b = getBot(botIndex);
              b.botJump(b.grid_x - 1, b.grid_y);
            }),
          )}
          {@render btn("Down", "text-gray-200", () =>
            run("bot.down", () => {
              const b = getBot(botIndex);
              b.botJump(b.grid_x, b.grid_y + 1);
            }),
          )}
          {@render btn("Right", "text-gray-200", () =>
            run("bot.right", () => {
              const b = getBot(botIndex);
              b.botJump(b.grid_x + 1, b.grid_y);
            }),
          )}
        </div>

        <!-- Jump to coordinates -->
        <div class="flex gap-1 items-center mt-1">
          <span class="text-[10px] text-gray-500 shrink-0">Jump to x:</span>
          <input
            type="number"
            bind:value={botJumpX}
            min="0"
            max={CONFIG.FARM.columns - 1}
            class="w-12 rounded bg-gray-800 px-1 py-1 text-xs border border-gray-700 text-white"
          />
          <span class="text-[10px] text-gray-500">y:</span>
          <input
            type="number"
            bind:value={botJumpY}
            min="0"
            max={CONFIG.FARM.rows - 1}
            class="w-12 rounded bg-gray-800 px-1 py-1 text-xs border border-gray-700 text-white"
          />
          {@render btn("Go", "text-gray-200", () =>
            run(`bot.jump(${botJumpX},${botJumpY})`, () => {
              getBot(botIndex).botJump(Number(botJumpX), Number(botJumpY));
            }),
          )}
        </div>

        <!-- Farm Actions -->
        {@render sec("Farm Actions")}
        <div class="grid grid-cols-2 gap-1">
          {@render btn("Till", "text-gray-200", () =>
            run("bot.till", () => getBot(botIndex).botTill()),
          )}
          {@render btn("Water", "text-gray-200", () =>
            run("bot.water", () => getBot(botIndex).botWater()),
          )}
          {@render btn("Harvest", "text-gray-200", () =>
            run("bot.harvest", () => getBot(botIndex).botHarvest()),
          )}
          {@render btn("Destroy", "text-red-400", () =>
            run("bot.destroy", () => getBot(botIndex).botDestroy()),
          )}
          {@render btn("Kill Bug", "text-gray-200", () =>
            run("bot.killBug", () => getBot(botIndex).botKillBug()),
          )}
        </div>

        <!-- Plant with crop selector -->
        {@render sec("Plant Crop")}
        <div class="flex gap-1">
          {@render cropSelect("Crop", botPlantCrop, (v) => (botPlantCrop = v))}
          {@render btn("Plant", "text-gray-200", () =>
            run(`bot.plant(${botPlantCrop})`, () => {
              getBot(botIndex).botPlant(botPlantCrop);
            }),
          )}
        </div>

        <!-- Say text -->
        {@render sec("Say Text")}
        <div class="flex gap-1">
          <input
            type="text"
            bind:value={botSayText}
            placeholder="Message..."
            class="flex-1 rounded bg-gray-800 px-2 py-1 text-xs border border-gray-700 text-white"
          />
          {@render btn("Say", "text-gray-200", () =>
            run("bot.say", () => {
              getBot(botIndex).sayText(botSayText);
            }),
          )}
        </div>

        <!-- Bot State -->
        {@render sec("All Bot States")}
        <div class="rounded bg-gray-900 p-2 text-[10px] font-mono space-y-1 border border-gray-800">
          {#each robots.filter(Boolean) as bot, i}
            {@const isTarget = i === botIndex}
            <div
              class="rounded px-1 py-0.5 {isTarget
                ? 'bg-gray-800 border border-gray-700'
                : ''}"
            >
              <p class="text-gray-400">
                <span
                  class={isTarget ? "text-white font-bold" : "text-gray-400"}
                  >Bot {i}:</span
                >
                pos=<span class="text-gray-200">({bot.grid_x},{bot.grid_y})</span>
                move=<span class="text-gray-300">{bot.botmove_duration}s</span>
                act=<span class="text-gray-300">{bot.botact_duration}s</span>
                chk=<span class="text-gray-300">{bot.botcheck_duration}s</span
                >
                avail=<span
                  class={bot.is_available ? "text-gray-300" : "text-red-400"}
                  >{bot.is_available}</span
                >
              </p>
            </div>
          {:else}
            <p class="text-gray-600 italic">No bots spawned.</p>
          {/each}
        </div>

        <!-- BATCH TAB -->
      {:else if activeTab === "batch"}
        <p class="text-[9px] text-gray-500 mb-1">
          Directly manipulates the game state, no bot animation.
        </p>

        <!-- Soil Actions -->
        {@render sec("Soil")}
        <div class="grid grid-cols-2 gap-1">
          {@render btn("Till All Soil", "text-gray-200", () =>
            run("Batch: till all", () => {
              const n = batchTillAll();
              push(`  → Tilled ${n} cells`, "text-gray-300");
            }),
          )}
          {@render btn("Water All Tilled", "text-gray-200", () =>
            run("Batch: water all", () => {
              const n = batchWaterAll();
              push(`  → Watered ${n} cells`, "text-gray-300");
            }),
          )}
          {@render btn("Till + Water All", "text-gray-200", () =>
            run("Batch: till+water", () => {
              const t = batchTillAll();
              const w = batchWaterAll();
              push(`  → ${t} tilled, ${w} watered`, "text-gray-300");
            }),
          )}
          {@render btn("Reset All Soil", "text-red-400", () =>
            run("Batch: reset soil", () => {
              const n = batchResetSoil();
              push(`  → Reset ${n} tiles to initial`, "text-red-400");
            }),
          )}
        </div>

        <!-- Plant Actions -->
        {@render sec("Plant")}
        <div class="flex gap-1 mb-1">
          {@render cropSelect("Crop", batchCrop, (v) => (batchCrop = v))}
        </div>
        <div class="grid grid-cols-2 gap-1">
          {@render btn("Plant All (Tilled)", "text-gray-200", () =>
            run(`Batch: plant ${batchCrop}`, () => {
              const n = batchPlantAll(batchCrop);
              push(`  → Planted ${n} ${batchCrop}`, "text-gray-300");
            }),
          )}
          {@render btn("Till+Water+Plant", "text-gray-200", () =>
            run(`Batch: full setup ${batchCrop}`, () => {
              const t = batchTillAll();
              const w = batchWaterAll();
              const p = batchPlantAll(batchCrop);
              push(
                `  → ${t} tilled, ${w} watered, ${p} planted`,
                "text-gray-300",
              );
            }),
          )}
        </div>

        <!-- Crop Actions -->
        {@render sec("Crop Actions")}
        <div class="grid grid-cols-2 gap-1">
          {@render btn("Instant Grow All", "text-gray-200", () =>
            run("Batch: instant grow", () => {
              const n = batchInstantGrow();
              push(`  → ${n} crops set to harvestable`, "text-gray-300");
            }),
          )}
          {@render btn("Harvest All", "text-gray-200", () =>
            run("Batch: harvest all", () => {
              const n = batchHarvestAll();
              push(`  → Harvested ${n} crops`, "text-gray-300");
            }),
          )}
          {@render btn("Kill All Crops", "text-red-400", () =>
            run("Batch: destroy all crops", () => {
              const n = batchDestroyAll();
              push(`  → Destroyed ${n} crops`, "text-red-400");
            }),
          )}
          {@render btn("Rot All Crops", "text-red-400", () =>
            run("Batch: rot all", () => {
              const n = batchDeadAll();
              push(`  → Rotted ${n} crops`, "text-red-400");
            }),
          )}
        </div>

        <!-- Full pipeline -->
        {@render sec("Full Pipeline")}
        <div class="grid grid-cols-1 gap-1">
          {@render btn(
            "Till + Water + Plant + Instant Grow",
            "text-gray-200",
            () =>
              run(`Batch: full pipeline ${batchCrop}`, () => {
                const t = batchTillAll();
                const w = batchWaterAll();
                const p = batchPlantAll(batchCrop);
                const g = batchInstantGrow();
                push(
                  `  → ${t} tilled, ${w} watered, ${p} planted, ${g} grown`,
                  "text-gray-300",
                );
              }),
          )}
          {@render btn("Full Pipeline + Harvest", "text-gray-200", () =>
            run(`Batch: plant+harvest ${batchCrop}`, () => {
              const t = batchTillAll();
              const w = batchWaterAll();
              const p = batchPlantAll(batchCrop);
              const g = batchInstantGrow();
              const h = batchHarvestAll();
              push(
                `  → ${t} tilled, ${w} watered, ${p} planted, ${g} grown, ${h} harvested`,
                "text-gray-300",
              );
            }),
          )}
        </div>

        <!-- Bug Actions -->
        {@render sec("Bugs")}
        <div class="flex gap-1 items-center mb-1">
          <span class="text-[10px] text-gray-500 shrink-0">Count:</span>
          <input
            type="number"
            bind:value={batchBugCount}
            min="1"
            max="20"
            class="w-14 rounded bg-gray-800 px-2 py-1 text-xs border border-gray-700 text-white"
          />
          {@render btn(
            `Spawn ${batchBugCount} Bugs`,
            "text-gray-200",
            () =>
              run(`Batch: spawn ${batchBugCount} bugs`, () => {
                for (let i = 0; i < batchBugCount; i++) addBug(farm_grid_index);
                push(`  → Spawned ${batchBugCount} bugs`, "text-gray-300");
              }),
          )}
        </div>
        {@render btn("Kill All Bugs", "text-red-400", () =>
          run("Batch: kill all bugs", () => {
            const n = batchKillAllBugs();
            push(`  → Killed ${n} bugs`, "text-red-400");
          }),
        )}

        <!-- INSPECT TAB -->
      {:else if activeTab === "inspect"}
        {@render sec("Single Tile Inspector")}
        <div class="flex gap-1 items-center mb-1">
          <span class="text-[10px] text-gray-500 shrink-0">Key:</span>
          <span class="text-[10px] text-gray-400">y:</span>
          <input
            type="number"
            bind:value={inspectY}
            min="0"
            max={CONFIG.FARM.rows - 1}
            class="w-12 rounded bg-gray-800 px-1 py-1 text-xs border border-gray-700 text-white"
          />
          <span class="text-[10px] text-gray-400">x:</span>
          <input
            type="number"
            bind:value={inspectX}
            min="0"
            max={CONFIG.FARM.columns - 1}
            class="w-12 rounded bg-gray-800 px-1 py-1 text-xs border border-gray-700 text-white"
          />
          <span class="text-[10px] text-gray-400 font-mono">[{inspectY}-{inspectX}]</span>
        </div>

        {@const tileData = getTile(inspectX, inspectY)}
        <div class="rounded bg-gray-900 p-2 text-[10px] font-mono space-y-1 border border-gray-800">
          {#if tileData}
            <div>
              <span class="text-gray-500">Key:</span> <span class="text-white font-bold">{inspectY}-{inspectX}</span>
            </div>
            <div>
              <span class="text-gray-500">Soil State:</span> 
              <span class="text-white">{tileData.soil ? (SOIL_STATE_NAMES[tileData.soil.soil_state] ?? tileData.soil.soil_state) : "None"}</span>
            </div>
            <div>
              <span class="text-gray-500">Crop:</span>
              {#if tileData.crop}
                <span class={tileData.crop.crop_state === CropStates.DEAD ? "text-red-400 font-bold" : "text-white"}>
                  {tileData.crop.crop_type} ({tileData.crop.crop_state})
                </span>
                <div class="ml-2 text-gray-400 space-y-0.5 mt-0.5">
                  <p>Health: {tileData.crop.crop_health}</p>
                  <p>Freshness: {tileData.crop.freshness_state}</p>
                  <p>Water Absorbing: {tileData.crop.absorbing_water ? "Yes" : "No"}</p>
                </div>
              {:else}
                <span class="text-gray-500">None</span>
              {/if}
            </div>
            <div>
              <span class="text-gray-500">Bug:</span> 
              <span class={tileData.bug ? "text-red-400 font-bold" : "text-gray-500"}>
                {tileData.bug ? "ACTIVE BUG PRESENT" : "None"}
              </span>
            </div>
            <div>
              <span class="text-gray-500">Bots on Tile:</span>
              {#if Array.isArray(tileData.bots) && tileData.bots.length > 0}
                <span class="text-white font-bold">{tileData.bots.map(b => `Bot ${b.bot_index}`).join(", ")}</span>
              {:else}
                <span class="text-gray-500">None</span>
              {/if}
            </div>
          {:else}
            <p class="text-gray-500 italic">No entry in farm_grid_index for key {inspectY}-{inspectX}</p>
          {/if}
        </div>

        {@render sec("All farm_grid_index Entries")}
        <div class="flex gap-1 items-center mb-1">
          <span class="text-[10px] text-gray-500 shrink-0">Filter:</span>
          <select
            bind:value={inspectFilter}
            class="flex-1 rounded bg-gray-800 px-2 py-1 text-xs text-white border border-gray-700 cursor-pointer"
          >
            <option value="all">All Registered Entries</option>
            <option value="crop">With Crop Only</option>
            <option value="bug">With Bug Only</option>
            <option value="bot">With Bot Only</option>
          </select>
        </div>

        {@const entries = getGridEntries()}
        <div class="rounded bg-gray-900 p-2 text-[10px] font-mono space-y-1 max-h-56 overflow-y-auto border border-gray-800 custom-scrollbar">
          {#each entries as item}
            {@const yx = item.key.split("-")}
            <button
              onclick={() => { inspectY = Number(yx[0]); inspectX = Number(yx[1]); }}
              class="w-full text-left rounded p-1 hover:bg-gray-800 transition-colors border border-gray-800/80 cursor-pointer block space-y-0.5"
            >
              <div class="flex justify-between items-center">
                <span class="text-white font-bold">[{item.key}]</span>
                <span class="text-gray-500">Soil: {SOIL_STATE_NAMES[item.soil?.soil_state] ?? item.soil?.soil_state ?? "None"}</span>
              </div>
              <div class="flex gap-2 text-[9px]">
                {#if item.crop}
                  <span class={item.crop.crop_state === CropStates.DEAD ? "text-red-400 font-bold" : "text-gray-300"}>
                    Crop: {item.crop.crop_type} ({item.crop.crop_state})
                  </span>
                {/if}
                {#if item.bug}
                  <span class="text-red-400 font-bold">BUG</span>
                {/if}
                {#if Array.isArray(item.bots) && item.bots.length > 0}
                  <span class="text-gray-300">Bots: {item.bots.length}</span>
                {/if}
              </div>
            </button>
          {:else}
            <p class="text-gray-500 italic">No matching grid index entries found.</p>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Log -->
    <div
      class="shrink-0 border-t border-gray-800 bg-gray-900/80 px-3 py-2 max-h-28 overflow-y-auto custom-scrollbar"
    >
      <div class="flex justify-between items-center mb-1">
        <p class="text-[9px] font-bold uppercase text-gray-600">Log</p>
        <button
          onclick={() => (log = [])}
          class="text-[9px] text-gray-700 hover:text-gray-400 cursor-pointer"
          >Clear</button
        >
      </div>
      {#each log as entry}
        <p class="text-[9px] font-mono {entry.color}">
          <span class="text-gray-700">[{entry.ts}]</span>
          {entry.msg}
        </p>
      {:else}
        <p class="text-[9px] text-gray-700 italic">No actions yet.</p>
      {/each}
    </div>

    <div
      class="bg-gray-900/30 p-1 text-[8px] text-gray-600 text-center border-t border-gray-800/50 shrink-0"
    >
      DRAG TO MOVE · BOTTOM-RIGHT TO RESIZE · [ \ ] TOGGLE
    </div>
  </div>
{/if}

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #374151;
    border-radius: 10px;
  }
</style>
