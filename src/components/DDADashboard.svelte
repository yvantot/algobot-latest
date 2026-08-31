<script>
  import { mlAgent } from "../game/ml/agent.js";
  import { dda } from "../game/ml/dda.js";
  import { telemetry, CS1_STAGES } from "../game/ml/telemetry.js";
  import { dataLogger } from "../game/ml/data-logger.js";

  const CS1_STAGE_LABELS = {
    1: "Sequential Algorithm",
    2: "Conditional Algorithm",
    3: "Looping / Iteration",
    4: "Greedy Algorithm",
    5: "State Optimization",
  };

  const ACTION_COLORS = {
    0: "#64748b", // Normal, slate
    1: "#3b82f6", // Scaffold, blue
    2: "#ef4444", // Challenge, red
    3: "#f59e0b", // Greedy Guide, amber
    4: "#8b5cf6", // State Optimization, violet
  };

  let { visible = $bindable(false) } = $props();
  let position = $state({ x: 420, y: 20 });
  let size = $state({ w: 320, h: 560 });

  let proficiency = $state(0.5);
  let actionId = $state(0);
  let qValues = $state([0, 0, 0, 0, 0]);
  let frustration = $state(0);
  let flow = $state(0.5);
  let stage = $state(1);
  let ddaState = $state(null);
  let agentMode = $state("bootstrap");
  let sessionCount = $state(0);
  let replaySize = $state(0);

  // Poll DDA + telemetry state every 2 seconds for dashboard display
  $effect(() => {
    const interval = setInterval(() => {
      proficiency = mlAgent.predictedProficiency;
      actionId = mlAgent.lastAction;
      qValues = mlAgent.predictedQValues || [0, 0, 0, 0, 0];
      frustration = telemetry.frustrationScore;
      flow = telemetry.flowScore;
      stage = telemetry.currentStage;
      ddaState = dda.getDDAState();
      agentMode = mlAgent.mode || "bootstrap";
      sessionCount = dataLogger.getSessionCount();
      replaySize = mlAgent.replayBuffer?.length || 0;
    }, 2000);
    return () => clearInterval(interval);
  });

  function colorBar(val) {
    if (val < 0.33) return "#ef4444";
    if (val < 0.66) return "#f59e0b";
    return "#22c55e";
  }

  function drag(node) {
    let moving = false;
    let startX, startY, initialX, initialY;

    function onPointerDown(e) {
      if (
        e.target.closest("button") ||
        e.target.closest("input") ||
        e.target.closest("select")
      )
        return;
      moving = true;
      startX = e.clientX;
      startY = e.clientY;
      initialX = position.x;
      initialY = position.y;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    }

    function onPointerMove(e) {
      if (!moving) return;
      position = {
        x: Math.max(0, initialX + (e.clientX - startX)),
        y: Math.max(0, initialY + (e.clientY - startY)),
      };
    }

    function onPointerUp() {
      moving = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    node.addEventListener("pointerdown", onPointerDown);
    return {
      destroy() {
        node.removeEventListener("pointerdown", onPointerDown);
      },
    };
  }
</script>

{#if visible}
  <div
    use:drag
    class="fixed z-[9998] flex flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-950/97 text-white shadow-2xl backdrop-blur-md"
    style:left="{position.x}px"
    style:top="{position.y}px"
    style:width="{size.w}px"
    style:height="{size.h}px"
  >
    <!-- Header -->
    <div
      class="flex cursor-grab items-center justify-between bg-gray-900 px-4 py-2 active:cursor-grabbing select-none shrink-0"
    >
      <div class="flex items-center gap-2">
        <div
          class="h-2 w-2 rounded-full {agentMode === 'ml'
            ? 'bg-emerald-400'
            : 'bg-amber-400'}"
        ></div>
        <span
          class="text-sm font-black uppercase tracking-tighter text-gray-300"
          >DDA Research Panel</span
        >
        <span
          class="text-[9px] px-1.5 py-0.5 rounded font-bold {agentMode === 'ml'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}"
        >
          {agentMode === "ml" ? "ML Mode" : "Bootstrap"}
        </span>
      </div>
      <button
        onclick={() => (visible = false)}
        class="text-gray-500 hover:text-white cursor-pointer font-bold text-sm"
        title="Close DDA Panel">✕</button
      >
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-3 custom-scrollbar text-sm space-y-3">
      <!-- Session Info -->
      <div
        class="flex justify-between text-sm text-gray-400 bg-gray-900/60 p-2 rounded border border-gray-800"
      >
        <span>Sessions: {sessionCount}</span>
        <span>Replay: {replaySize}</span>
        <span class="font-mono">{telemetry.participantId}</span>
      </div>

      <!-- CS1 Curriculum Stage -->
      <div class="flex flex-col gap-1">
        <span
          class="text-gray-500 uppercase text-[9px] font-bold tracking-wider"
          >CS1 Stage</span
        >
        <div class="flex items-center gap-2">
          <span class="text-amber-300 font-bold">Stage {stage}:</span>
          <span class="text-white">{CS1_STAGE_LABELS[stage] ?? "Unknown"}</span>
        </div>
      </div>

      <!-- Student Proficiency -->
      <div class="flex flex-col gap-1">
        <div class="flex justify-between items-center">
          <span
            class="text-gray-500 uppercase text-[9px] font-bold tracking-wider"
            >Proficiency (LSTM)</span
          >
          <span class="font-bold" style="color: {colorBar(proficiency)}"
            >{(proficiency * 100).toFixed(1)}%</span
          >
        </div>
        <div class="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            class="h-2 rounded-full transition-all duration-500"
            style="width: {proficiency * 100}%; background-color: {colorBar(
              proficiency,
            )}"
          ></div>
        </div>
      </div>

      <!-- Frustration Score -->
      <div class="flex flex-col gap-1">
        <div class="flex justify-between items-center">
          <span
            class="text-gray-500 uppercase text-[9px] font-bold tracking-wider"
            >Frustration Index</span
          >
          <span class="font-bold" style="color: {colorBar(1 - frustration)}"
            >{(frustration * 100).toFixed(1)}%</span
          >
        </div>
        <div class="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div
            class="h-1.5 rounded-full transition-all duration-500"
            style="width: {frustration * 100}%; background-color: {colorBar(
              1 - frustration,
            )}"
          ></div>
        </div>
      </div>

      <!-- Flow Score -->
      <div class="flex flex-col gap-1">
        <div class="flex justify-between items-center">
          <span
            class="text-gray-500 uppercase text-[9px] font-bold tracking-wider"
            >Flow Score</span
          >
          <span class="font-bold" style="color: {colorBar(flow)}"
            >{(flow * 100).toFixed(1)}%</span
          >
        </div>
        <div class="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div
            class="h-1.5 rounded-full transition-all duration-500"
            style="width: {flow * 100}%; background-color: {colorBar(flow)}"
          ></div>
        </div>
      </div>

      <!-- Active DDA Action -->
      {#if ddaState}
        <div
          class="flex flex-col gap-1 border border-gray-800 rounded-lg p-2 bg-gray-900/60"
        >
          <span
            class="text-gray-500 uppercase text-[9px] font-bold tracking-wider"
            >Active DDA Action (DQN)</span
          >
          <span
            class="font-bold"
            style="color: {ACTION_COLORS[actionId] ?? '#fff'}"
            >{ddaState.actionName}</span
          >
          <div
            class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm text-gray-300 mt-1"
          >
            <span>Growth: ×{ddaState.growthMultiplier.toFixed(1)}</span>
            <span>Spoilage: ×{ddaState.spoilageMultiplier.toFixed(1)}</span>
            <span>Bugs: ×{ddaState.bugSpawnMultiplier.toFixed(1)}</span>
            <span>Fire: ×{ddaState.fireSpawnMultiplier.toFixed(1)}</span>
          </div>
        </div>
      {/if}

      <!-- DQN Q-Values -->
      <div class="flex flex-col gap-1">
        <span
          class="text-gray-500 uppercase text-[9px] font-bold tracking-wider"
          >DQN Q-Values</span
        >
        <div class="flex flex-col gap-0.5">
          {#each qValues as q, i}
            {@const labels = [
              "Normal",
              "Scaffold",
              "Challenge",
              "Greedy Guide",
              "State Opt.",
            ]}
            <div class="flex items-center gap-2">
              <span
                class="text-[9px] w-20 shrink-0"
                style="color: {i === actionId ? ACTION_COLORS[i] : '#94a3b8'}"
                >{labels[i]}</span
              >
              <div class="flex-1 bg-gray-800 rounded h-1 overflow-hidden">
                <div
                  class="h-1 rounded transition-all"
                  style="width: {Math.max(
                    0,
                    Math.min(100, (q + 1) * 50),
                  )}%; background-color: {i === actionId
                    ? ACTION_COLORS[i]
                    : '#475569'}"
                ></div>
              </div>
              <span class="text-[9px] text-gray-400 w-10 text-right"
                >{q.toFixed(2)}</span
              >
            </div>
          {/each}
        </div>
      </div>

      <!-- Telemetry Counters -->
      <div
        class="border-t border-gray-800 pt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm text-gray-300"
      >
        <span>Steps: {telemetry.totalInterpreterSteps}</span>
        <span>Errors: {telemetry.errorCount}</span>
        <span>Resets: {telemetry.resetCount}</span>
        <span>Checks: {telemetry.checkBeforeActionCount}</span>
        <span
          >Loops: {telemetry.forLoopExecutions +
            telemetry.whileLoopExecutions}</span
        >
        <span>Harvests: {telemetry.cropsHarvestedFresh}</span>
        <span>Code Runs: {telemetry.codeRunCount}</span>
        <span
          >Success Rate: {telemetry.codeRunCount > 0
            ? (
                (telemetry.codeRunSuccessCount / telemetry.codeRunCount) *
                100
              ).toFixed(0)
            : 0}%</span
        >
        <span>Hints: {telemetry.hintsShown}</span>
        <span>Quests Done: {telemetry.questsCompleted}</span>
      </div>

      <!-- Active Hint from DDA -->
      {#if ddaState?.activeHint}
        <div
          class="bg-blue-950/80 border border-blue-500/40 rounded p-2 text-sm text-blue-200"
        >
          {ddaState.activeHint}
        </div>
      {/if}
    </div>

    <!-- Drag Footer -->
    <div
      class="bg-gray-900/30 p-1 text-[8px] text-gray-600 text-center border-t border-gray-800/50 shrink-0 select-none"
    >
      DRAG TO MOVE
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
