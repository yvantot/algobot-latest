<script>
  import { mlAgent } from "../game/ml/agent.js";
  import { dda } from "../game/ml/dda.js";
  import { telemetry, CS1_STAGES } from "../game/ml/telemetry.js";

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

  let visible = $state(false);
  let proficiency = $state(0.5);
  let actionId = $state(0);
  let qValues = $state([0, 0, 0, 0, 0]);
  let frustration = $state(0);
  let flow = $state(0.5);
  let stage = $state(1);
  let ddaState = $state(null);

  // Poll DDA + telemetry state every 2 seconds for dashboard display
  $effect(() => {
    const interval = setInterval(() => {
      proficiency = mlAgent.predictedProficiency;
      actionId = mlAgent.lastAction;
      qValues = mlAgent.predictedQValues;
      frustration = telemetry.frustrationScore;
      flow = telemetry.flowScore;
      stage = telemetry.currentStage;
      ddaState = dda.getDDAState();
    }, 2000);
    return () => clearInterval(interval);
  });

  function colorBar(val) {
    if (val < 0.33) return "#ef4444";
    if (val < 0.66) return "#f59e0b";
    return "#22c55e";
  }
</script>

<!-- Toggle Button -->
<button
  onclick={() => (visible = !visible)}
  class="fixed bottom-4 right-4 z-[9999] bg-slate-900 border border-slate-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-xl hover:bg-slate-700 transition-colors"
>
  DDA {visible ? "▲" : "▼"}
</button>

{#if visible}
  <div
    class="fixed bottom-14 right-4 z-[9998] bg-slate-900/95 backdrop-blur border-2 border-slate-600 rounded-xl shadow-2xl p-4 text-white w-72 text-xs flex flex-col gap-3"
  >
    <div
      class="flex justify-between items-center border-b border-slate-700 pb-2"
    >
      <h3 class="font-bold text-sm text-white flex items-center gap-1">
        🧠 DDA Research Panel
      </h3>
      <span class="text-[10px] text-slate-400">TF.js RNN + DQN</span>
    </div>

    <!-- CS1 Curriculum Stage -->
    <div class="flex flex-col gap-1">
      <span class="text-slate-400 uppercase text-[9px] font-bold tracking-wider"
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
          class="text-slate-400 uppercase text-[9px] font-bold tracking-wider"
          >Proficiency (LSTM)</span
        >
        <span class="font-bold" style="color: {colorBar(proficiency)}"
          >{(proficiency * 100).toFixed(1)}%</span
        >
      </div>
      <div class="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
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
          class="text-slate-400 uppercase text-[9px] font-bold tracking-wider"
          >Frustration Index</span
        >
        <span class="font-bold" style="color: {colorBar(1 - frustration)}"
          >{(frustration * 100).toFixed(1)}%</span
        >
      </div>
      <div class="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
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
          class="text-slate-400 uppercase text-[9px] font-bold tracking-wider"
          >Flow Score</span
        >
        <span class="font-bold" style="color: {colorBar(flow)}"
          >{(flow * 100).toFixed(1)}%</span
        >
      </div>
      <div class="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <div
          class="h-1.5 rounded-full transition-all duration-500"
          style="width: {flow * 100}%; background-color: {colorBar(flow)}"
        ></div>
      </div>
    </div>

    <!-- Active DDA Action -->
    {#if ddaState}
      <div class="flex flex-col gap-1 border border-slate-700 rounded-lg p-2">
        <span
          class="text-slate-400 uppercase text-[9px] font-bold tracking-wider"
          >Active DDA Action (DQN)</span
        >
        <span
          class="font-bold"
          style="color: {ACTION_COLORS[actionId] ?? '#fff'}"
          >{ddaState.actionName}</span
        >
        <div
          class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-slate-300 mt-1"
        >
          <span>🌱 Growth: ×{ddaState.growthMultiplier.toFixed(1)}</span>
          <span>🥀 Spoilage: ×{ddaState.spoilageMultiplier.toFixed(1)}</span>
          <span>🐛 Bugs: ×{ddaState.bugSpawnMultiplier.toFixed(1)}</span>
          <span>🔥 Fire: ×{ddaState.fireSpawnMultiplier.toFixed(1)}</span>
        </div>
      </div>
    {/if}

    <!-- DQN Q-Values -->
    <div class="flex flex-col gap-1">
      <span class="text-slate-400 uppercase text-[9px] font-bold tracking-wider"
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
            <div class="flex-1 bg-slate-700 rounded h-1 overflow-hidden">
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
            <span class="text-[9px] text-slate-400 w-10 text-right"
              >{q.toFixed(2)}</span
            >
          </div>
        {/each}
      </div>
    </div>

    <!-- Telemetry Counters -->
    <div
      class="border-t border-slate-700 pt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-slate-300"
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
    </div>

    <!-- Active Hint from DDA -->
    {#if ddaState?.activeHint}
      <div
        class="bg-blue-950/80 border border-blue-500/40 rounded p-2 text-[10px] text-blue-200"
      >
        {ddaState.activeHint}
      </div>
    {/if}
  </div>
{/if}
