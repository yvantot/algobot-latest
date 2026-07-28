<script>
	import { CONFIG, TYPE_COLORS } from "../game/global/global";
	import { robots, robots_state } from "./global.svelte.js";
	import { DOCUMENT_DATA, INVENTORY } from "../game/global/global.js";
	import { buyLand, buyUpgrade, buyPlants } from "../game/global/shop.js";
	import { createInit } from "../game/global/interpreter.js";
	import { trackQuest } from "./global.svelte.js";

	import { onMount } from "svelte";
	import { autocompletion } from "@codemirror/autocomplete";
	import { EditorView, basicSetup } from "codemirror";
	import { javascript } from "@codemirror/lang-javascript";
	import { oneDark } from "@codemirror/theme-one-dark";
	import { hoverTooltip } from "@codemirror/view";

	import { createResizable } from "./interface.svelte.js";

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
		  <div class="overflow-hidden flex flex-col bg-[#39404f] border-2 border-slate-400 rounded-lg p-2 gap-2 text-xs text-white">
			${!keyword[word].is_unlocked ? '<div class="bg-red-800 border border-red-500 text-white font-bold p-1 text-[11px] rounded text-center">🔒 LOCKED (Unlock via Quest)</div>' : ""}
			<div class="flex gap-2 items-center justify-between">
			  <p class="font-bold" style="font-family: 'Courier Prime'">${keyword[word].name}</p>
			  <p class="font-bold p-1 px-2 text-xs bg-[#262b36] rounded scale-90" style=${"color:" + TYPE_COLORS[keyword[word].type]}>${keyword[word].type}</p>
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
				detail: item.detail
					? `${item.detail} 🔒 (Locked)`
					: `🔒 (Locked)`,
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
					text_code: `bot.say("Hello, world!")`,
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
			doc:
				robots_state[selected_robot]?.text_code ||
				`bot.say("Hello, world!")`,
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
					if (update.docChanged) {
						robots_state[selected_robot].text_code =
							update.state.doc.toString();
					}
				}),
			],
			parent: document.getElementById("editor-container"),
		});

		return () => {
			view.destroy(); // Cleanup on component destroy
		};
	});

	function selectCode(start, end) {
		if (!view) return;

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
	function isLine(stack) {
		var state = stack[stack.length - 1];
		var node = state.node;
		var type = node.type;

		if (type !== "VariableDeclaration" && type.substr(-9) !== "Statement") {
			// Current node is not a statement.
			return false;
		}

		if (type === "BlockStatement") {
			// Not a 'line' by most definitions.
			return false;
		}

		if (
			type === "VariableDeclaration" &&
			stack[stack.length - 2].node.type === "ForStatement"
		) {
			// This 'var' is not a line: for (var i = 0; ...)
			return false;
		}

		if (isLine.oldStack_[isLine.oldStack_.length - 1] === state) {
			// Never repeat the same statement multiple times.
			// Typically a statement is stepped into and out of.
			return false;
		}

		if (
			isLine.oldStack_.indexOf(state) !== -1 &&
			type !== "ForStatement" &&
			type !== "WhileStatement" &&
			type !== "DoWhileStatement"
		) {
			// Don't revisit a statement on the stack (e.g. 'if') when exiting.
			// The exception is loops.
			return false;
		}

		isLine.oldStack_ = stack.slice();
		return true;
	}

	isLine.oldStack_ = [];

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
	function handleStep(index) {
		if (!robots_state[index].interpreter)
			robots_state[index].interpreter = new Interpreter(
				robots_state[index].text_code,
				createInit(robots_state[index].robot, null, trackQuest),
			);

		var stack = robots_state[index].interpreter.getStateStack();
		var step_again = !isLine(stack);

		if (stack.length > 0) {
			const node = stack[stack.length - 1].node;
			if (node && node.type === "ForStatement")
				trackQuest("cs_loop_0", 1);
			if (node && node.type === "IfStatement") trackQuest("cs_if_0", 1);
		}

		try {
			var ok = robots_state[index].interpreter.step();
		} finally {
			if (!ok) {
				handleReset(index);
				step_again = false;
			}
		}

		if (step_again) {
			try {
				handleStep(index);
			} catch (error) {
				null;
			}
		} else {
			if (index === selected_robot) {
				// Only call createSelection when we've landed on a line
				var stack = robots_state[index].interpreter.getStateStack();
				if (stack.length) {
					var node = stack[stack.length - 1].node;
					createSelection(node.start, node.end);
				}
			}
		}
	}

	function handleStart(index) {
		robots_state[index].interpreter = new Interpreter(
			robots_state[index].text_code,
			createInit(robots_state[index].robot, null, trackQuest),
		);
		robots_state[index].is_running = !robots_state[index].is_running;

		clearInterval(robots_state[index].interval);

		if (robots_state[index].is_running) {
			robots_state[index].interval = setInterval(() => {
				if (robots_state[index].is_running) {
					handleStep(index);
				}
			}, 0);
		}
	}
	function handleReset(index) {
		robots_state[index].interpreter = null;
		robots_state[index].is_running = false;
		if (index === selected_robot) selectCode(0, 0);
	}
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
						updateEditorContent(
							robots_state[selected_robot].text_code,
						);
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
		<div class="grid grid-cols-3 gap-2">
			{#if robots_state[selected_robot]}
				<button
					disabled={!is_command_ready}
					onclick={() => handleStart(selected_robot)}
					class="btn-primary"
					>{robots_state[selected_robot].is_running
						? "Stop"
						: "Start"}</button
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
			{/if}
		</div>
	</div>
	{#if robots.length > 1}
		<div
			class="p-2 bg-slate-300 border-t-2 border-slate-400 flex flex-col gap-2 shrink-0"
		>
			<div class="grid grid-cols-3 gap-2">
				<button
					disabled={!is_command_ready}
					onclick={handleStartAll}
					class="btn-primary"
					>{false ? "Stop All" : "Start All"}</button
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
			</div>
		</div>
	{/if}
</div>
