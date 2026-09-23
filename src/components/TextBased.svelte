<script>
  import { CONFIG, TYPE_COLORS } from "../game/global/global";
  import { robots, robots_state, ONBOARDING } from "./global.svelte.js";
  import { DOCUMENT_DATA, INVENTORY } from "../game/global/global.js";
  import { buyLand, buyUpgrade, buyPlants } from "../game/global/shop.js";
  import { createInit } from "../game/global/interpreter.js";
  import { trackQuest, beginActiveQuest } from "./global.svelte.js";
  import { telemetry } from "../game/ml/telemetry.js";

  import { onMount } from "svelte";
  import { isolateHistory } from "@codemirror/commands";
  export function targetName() { return `Bot ${selected_robot}`; }
  export function insertExample(code) {
    if (!view || robots_state[selected_robot]?.is_running) throw new Error("Stop this bot's program before inserting.");
    const at=view.state.selection.main.head, insert=`\n${code}\n`;
    view.dispatch({changes:{from:at,insert},selection:{anchor:at+insert.length},annotations:isolateHistory.of("full"),scrollIntoView:true});
  }
  import { autocompletion } from "@codemirror/autocomplete";
  import { EditorView, basicSetup } from "codemirror";
  import { javascript } from "@codemirror/lang-javascript";
  import { oneDark } from "@codemirror/theme-one-dark";
  import { hoverTooltip } from "@codemirror/view";

  import { createResizable } from "./interface.svelte.js";

  import { createCodeRunner } from "../game/global/code-runner.js";
  import { k } from "../lib/kaplay.js";

  const resize = createResizable();

  const customSelectionTheme = EditorView.theme(
    {
      ".cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "#fff81a !important",
        opacity: "1",
      },
    },
    { dark: true },
  );

  let view;
  let is_highlight = $state(true);
  let is_command_ready = $state(false);
  let startBtnRef = $state(null);
  let spotlightRect = $state(null);

  const global_ac = [];
  const bot_ac = [];
  const inventory_ac = [];
  const shop_ac = [];
  const global_keys = [];

  const keyword = {};

  // TODO: give Documentatiosen type
  // Figure out how to do custom syntax highlighting in CodeMirror
  for (const main of Object.keys(DOCUMENT_DATA)) {
    for (const key of Object.keys(DOCUMENT_DATA[main])) {
      const data = DOCUMENT_DATA[main][key];
      keyword[key] = { ...data, name: key };
      switch (main) {
        case "inventory": {
          inventory_ac.push({
            label: key,
            type: data.type,
            detail: data.arguments,
          });
          break;
        }
        case "shop":
          shop_ac.push({
            label: key,
            type: data.type,
            detail: data.arguments,
          });
          break;
        case "syntax":
        case "globals": {
          global_keys.push(key);
          global_ac.push({
            label: key,
            type: data.type,
            detail: data.arguments,
          });
          break;
        }
        case "functions": {
          global_keys.push(key);
          global_ac.push({
            label: key,
            type: data.type,
            detail: data.arguments,
          });
          break;
        }
        case "bot_movement":
        case "bot_farm_actions":
        case "bot_checks": {
          bot_ac.push({
            label: key,
            type: data.type,
            detail: data.arguments,
          });
          break;
        }
      }
    }
  }

  const keywordHoverTooltip = hoverTooltip((view, pos, side) => {
    let { from, to, text } = view.state.doc.lineAt(pos);

    let start = pos,
      end = pos;
    while (start > from && /[\w]/.test(text[start - from - 1])) start--;
    while (end < to && /[\w]/.test(text[end - from])) end++;
    if ((start == pos && side < 0) || (end == pos && side > 0)) return null;
    const word = text.slice(start - from, end - from);

    if (!keyword[word]) return null;

    return {
      pos: start,
      end: end,
      above: true,
      create(view) {
        let dom = document.createElement("div");

        dom.style.cssText = `
		  max-width: 25ch;
			`;

        dom.innerHTML = `
		  <div class="overflow-hidden flex flex-col bg-[#39404f] border-2 border-slate-400 rounded-lg p-2 gap-2 text-sm text-white">
			${!keyword[word].is_unlocked ? '<div class="bg-red-800 border border-red-500 text-white font-bold p-1 text-[13px] rounded text-center">🔒 LOCKED (Unlock via Quest)</div>' : ""}
			<div class="flex gap-2 items-center justify-between">
			  <p class="font-bold" style="font-family: 'Courier Prime'">${keyword[word].name}</p>
			  <p class="font-bold p-1 px-2 text-sm bg-[#262b36] rounded scale-90" style=${"color:" + TYPE_COLORS[keyword[word].type]}>${keyword[word].type}</p>
			</div>
			<div class="overflow-y-auto flex flex-col gap-2">
			  <p>${keyword[word].definition}</p>
			  ${
          keyword[word]?.note != null
            ? `
				<div class="bg-green-200 p-2 rounded-lg border-2 border-green-400">
				  <p class="text-green-800 font-bold">Remember!</p>
				  <p class="text-green-800">${keyword[word].note}</p>
				</div>
			  		`
            : ""
        }
			</div>
		  </div>
			  	`;

        return { dom };
      },
    };
  });

  function formatOptions(list) {
    return list.map((item) => {
      const data = keyword[item.label];
      const isUnlocked = data ? (data.is_unlocked ?? true) : true;
      if (isUnlocked) return item;
      return {
        ...item,
        detail: item.detail ? `${item.detail} 🔒 (Locked)` : `🔒 (Locked)`,
      };
    });
  }

  function myCompletions(context) {
    const word = context.matchBefore(/\w*/);

    const isAfterDot = context.matchBefore(/\.\w*/);
    if (isAfterDot) return null;

    if (!word || (word.from === word.to && !context.explicit)) return null;

    return {
      from: word.from,
      options: formatOptions(global_ac),
      filter: true,
    };
  }

  function inventoryCompletions(context) {
    const nodeBefore = context.matchBefore(/\binventory\./);
    if (!nodeBefore) return null;

    return {
      from: context.pos,
      options: formatOptions(inventory_ac),
      validFor: /^\w*$/,
    };
  }

  function shopCompletions(context) {
    const nodeBefore = context.matchBefore(/\bshop\./);
    if (!nodeBefore) return null;

    return {
      from: context.pos,
      options: formatOptions(shop_ac),
      validFor: /^\w*$/,
    };
  }

  function botCompletions(context) {
    const nodeBefore = context.matchBefore(/\bbot\./);
    if (!nodeBefore) return null;

    return {
      from: context.pos,
      options: formatOptions(bot_ac),
      validFor: /^\w*$/,
    };
  }

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
    view = new EditorView({
      doc: robots_state[selected_robot]?.text_code || `bot.say("Hello World!")`,
      extensions: [
        basicSetup,
        customSelectionTheme,
        javascript({ typescript: false, globalVars: global_keys }),
        oneDark,
        keywordHoverTooltip,
        EditorView.lineWrapping,
        autocompletion({
          override: [
            myCompletions,
            botCompletions,
            shopCompletions,
            inventoryCompletions,
          ],
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && robots_state[selected_robot]) { telemetry.recordCodeEdit();
            robots_state[selected_robot].text_code =
              update.state.doc.toString();
          }
        }),
      ],
      parent: document.getElementById("editor-container"),
    });

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
  class="text-slate-700 h-[95vh] bottom-4 flex flex-col w-[30vw] bg-gray-100 border-4 border-slate-500 rounded-xl shadow-xl overflow-hidden text-sm"
>
  <div
    role="separator"
    class="resize-handle {resize.is_resizing ? 'resizing-active' : ''}"
    onmousedown={resize.startResize}
  ></div>
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
