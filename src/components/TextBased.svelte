<script>
  import { robots, robots_state, ONBOARDING } from "./global.svelte.js";
  import { createInit } from "../game/global/interpreter.js";
  import { trackQuest, beginActiveQuest } from "./global.svelte.js";
  import { telemetry } from "../game/ml/telemetry.js";

  import { onMount } from "svelte";
  import { createBotTextEditor } from "../lib/bot-text-editor.js";
  import { isolateHistory } from "@codemirror/commands";
  export function targetName() { return `Bot ${selected_robot}`; }
  export function insertExample(code) {
    if (!view || robots_state[selected_robot]?.is_running) throw new Error("Stop this bot's program before inserting.");
    const at=view.state.selection.main.head, insert=`\n${code}\n`;
    view.dispatch({changes:{from:at,insert},selection:{anchor:at+insert.length},annotations:isolateHistory.of("full"),scrollIntoView:true});
  }

  import { createResizable } from "./interface.svelte.js";

  import { createCodeRunner } from "../game/global/code-runner.js";
  import { k } from "../lib/kaplay.js";

  const resize = createResizable();

  let view;
  let is_highlight = $state(true);
  let is_command_ready = $state(false);
  let startBtnRef = $state(null);
  let spotlightRect = $state(null);

  function updateEditorContent(newText) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newText },
    });
  }

  let selected_robot = $state(0);

  // Create interpreter for every robots
  $effect(() => {
    robots.forEach((bot, index) => {
      if (!robots_state[index]) {
        robots_state[index] = {
          robot: bot,
          text_code: `bot.say("Hello World!")`,
          block_code: ``,
          interpreter: null,
          is_running: false,
          interval: null,
        };
      }
    });
  });

  onMount(() => {
    setTimeout(() => (is_command_ready = true), 2000);
    view = createBotTextEditor({
      parent: document.getElementById("editor-container"),
      doc: robots_state[selected_robot]?.text_code || 'bot.say("Hello World!")',
      onChange(code) {
        if (robots_state[selected_robot]) { telemetry.recordCodeEdit(); robots_state[selected_robot].text_code=code; }
      },
    }).view;

    return () => {
      runner.dispose(); view.destroy(); view = null;
    };
  });

  function selectCode(start, end) {
    if (!view) return; start = Math.min(start, view.state.doc.length); end = Math.min(end, view.state.doc.length);

    view.dispatch({
      selection: { anchor: start, head: end },
      scrollIntoView: true,
    });
  }

  // Modified code from https://neil.fraser.name/software/JS-Interpreter/demos/line.html
  function createSelection(start, end) {
    if (!is_highlight) return;
    selectCode(start, end);
  }

  // Modified code from https://neil.fraser.name/software/JS-Interpreter/demos/line.html


  let is_running_all = $state(false);

  function handleResetAll() {
    robots_state.forEach((_, index) => {
      handleReset(index);
    });
  }

  function handleStartAll() {
    robots_state.forEach((_, index) => {
      if (!robots_state[index].is_running) {
        handleStart(index);
      }
    });
  }

  function handleStepAll() {
    robots_state.forEach((_, index) => {
      if (!robots_state[index].is_running) {
        handleStep(index);
      }
    });
  }

  // Modified code from https://neil.fraser.name/software/JS-Interpreter/demos/line.html
  const runner = createCodeRunner({
    states: robots_state,
    InterpreterClass: globalThis.Interpreter,
    telemetry,
    canStep: () => k.debug.timeScale > 0 && !ONBOARDING.isModalOpen && !document.hidden,
    prepare(index) {
      robots_state[index].onQuestEvent = trackQuest;
      beginActiveQuest();
      return robots_state[index].text_code;
    },
    init: (index) => createInit(robots_state[index].robot, null, trackQuest),
    highlight(index, node) {
      if (index === selected_robot && view) { if (node) createSelection(node.start, node.end); else selectCode(0, 0); }
    },
  });

  function handleStep(index) { runner.step(index); }
  function handleStart(index) {
    ONBOARDING.startClicked = true;
    runner.start(index);
  }
  function handleReset(index) { runner.reset(index); }
  function handleClear(index) {
    handleReset(index);
    robots_state[index].text_code = ``;
    if (index === selected_robot && view) {
      updateEditorContent(``);
    }
  }

  function handleClearAll() {
    robots_state.forEach((_, index) => {
      handleClear(index);
    });
  }

  // Onboarding spotlight: position the spotlight over the Start button
  $effect(() => {
    if (
      startBtnRef &&
      is_command_ready &&
      !ONBOARDING.startClicked &&
      !ONBOARDING.isModalOpen
    ) {
      const _ = resize.width;
      const updatePosition = () => {
        if (!startBtnRef) return;
        const rect = startBtnRef.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        spotlightRect = {
          left: rect.left - 8,
          top: rect.top - 8,
          width: rect.width + 16,
          height: rect.height + 16,
          labelTop: rect.top - 12,
          labelLeft: rect.left + rect.width / 2,
        };
      };

      updatePosition();
      const timer = setTimeout(updatePosition, 100);
      return () => clearTimeout(timer);
    } else {
      spotlightRect = null;
    }
  });
</script>

<div
  style="width: {resize.width}px;"
  class="command-panel relative text-slate-700 h-[95vh] flex flex-col w-[30vw] bg-gray-100 border-4 border-slate-500 rounded-xl shadow-xl overflow-hidden text-sm"
>
  <button type="button" class="command-resize" class:resizing-active={resize.is_resizing}
    aria-label="Resize Bot Command" onpointerdown={resize.startResize} onkeydown={resize.resizeKey}></button>
  <div class="py-2 border-b-2 border-slate-400">
    <h1 class="text-center font-bold text-base">Bot Command</h1>
  </div>

  <div>
    <div
      class="flex flex-wrap bg-slate-200 border-b-2 border-slate-400 shrink-0"
    >
      {#each robots as robot, index}
        <button
          onclick={() => {
            selected_robot = index;
            updateEditorContent(robots_state[selected_robot].text_code);
          }}
          class:opacity-100={selected_robot === index}
          class="opacity-80 border-r-2 border-slate-600 px-3 py-1 bg-[#262737] text-[#82F54C] flex-grow text-center cursor-pointer select-none bot-index-font"
          >BOT {robot.display_text}</button
        >
      {/each}
    </div>
  </div>

  <button
    class="hover:bg-gray-300"
    onclick={() => {
      selectCode(0, 0);
      is_highlight = !is_highlight;
    }}>Turn {is_highlight ? "off" : "on"} highlights</button
  >

  <div class="flex-1 bg-white min-h-0 overflow-y-auto">
    <div id="editor-container" class="w-full h-full bg-[#262b36]"></div>
  </div>

  <div
    class="p-2 bg-slate-200 border-t-2 border-slate-400 flex flex-col gap-2 shrink-0"
  >
    <div class="grid grid-cols-4 gap-2">
      {#if robots_state[selected_robot]}
        <button
          bind:this={startBtnRef}
          disabled={!is_command_ready}
          onclick={() => handleStart(selected_robot)}
          class={robots_state[selected_robot].is_running
            ? "btn-stop"
            : !ONBOARDING.startClicked
              ? "btn-start"
              : "btn-primary"}
          >{robots_state[selected_robot].is_running
            ? "⏹ Stop"
            : "▶ Start"}</button
        >
        <button
          onclick={() => handleStep(selected_robot)}
          class="btn-primary"
          disabled={!is_command_ready ||
            robots_state[selected_robot].is_running}>Step</button
        >
        <button
          disabled={!is_command_ready}
          onclick={() => handleReset(selected_robot)}
          class="btn-primary">Reset</button
        >
        <button
          disabled={!is_command_ready ||
            robots_state[selected_robot].is_running}
          onclick={() => handleClear(selected_robot)}
          class="btn-primary">Clear</button
        >
      {/if}
    </div>
  </div>
  {#if robots.length > 1}
    <div
      class="p-2 bg-slate-300 border-t-2 border-slate-400 flex flex-col gap-2 shrink-0"
    >
      <div class="grid grid-cols-4 gap-2">
        <button
          disabled={!is_command_ready}
          onclick={handleStartAll}
          class="btn-primary">{false ? "Stop All" : "Start All"}</button
        >
        <button
          disabled={!is_command_ready}
          onclick={handleStepAll}
          class="btn-primary">Step All</button
        >
        <button
          disabled={!is_command_ready}
          onclick={handleResetAll}
          class="btn-primary">Reset All</button
        >
        <button
          disabled={!is_command_ready}
          onclick={handleClearAll}
          class="btn-primary">Clear All</button
        >
      </div>
    </div>
  {/if}
</div>

{#if spotlightRect}
  <div
    class="spotlight-hole"
    style="left: {spotlightRect.left}px; top: {spotlightRect.top}px; width: {spotlightRect.width}px; height: {spotlightRect.height}px;"
  ></div>
  <div
    class="spotlight-label"
    style="left: {spotlightRect.labelLeft}px; top: {spotlightRect.labelTop}px;"
  >
    <div class="spotlight-bounce-wrapper">
      <div class="spotlight-label-bubble">
        👆 Click <strong>▶ Start</strong> to run your code!
      </div>
      <div class="spotlight-label-arrow"></div>
    </div>
  </div>
{/if}

<style>
.command-resize{position:absolute;left:0;top:44px;bottom:0;width:12px;z-index:100;padding:0;border:0;border-radius:0;background:transparent;cursor:ew-resize;touch-action:none}.command-resize:hover,.command-resize.resizing-active,.command-resize:focus-visible{background:#94a3b880}.command-resize:focus-visible{outline:2px solid #16a34a;outline-offset:-2px}
</style>
