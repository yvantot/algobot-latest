// // Remove DecorationSet from here
// import { EditorView, Decoration } from "@codemirror/view";
// import { StateField, StateEffect } from "@codemirror/state";
// import { minimalSetup } from "codemirror"; // This is fine
// import { javascriptLanguage } from "@codemirror/lang-javascript";
// import { autocompletion } from "@codemirror/autocomplete";
// import { oneDark } from "@codemirror/theme-one-dark";

// // --- Highlighting Logic ---
// const setHighlight = StateEffect.define();

// const lineHighlightField = StateField.define({
// 	create() {
// 		return Decoration.none;
// 	},
// 	update(lines, tr) {
// 		lines = lines.map(tr.changes);
// 		for (let e of tr.effects) {
// 			if (e.is(setHighlight)) {
// 				lines = Decoration.set([Decoration.line({ class: "cm-active-line-exec" }).range(e.value)]);
// 			}
// 		}
// 		return lines;
// 	},
// 	provide: (f) => EditorView.decorations.from(f),
// });

// const highlightTheme = EditorView.baseTheme({
// 	".cm-active-line-exec": { backgroundColor: "rgba(255, 255, 0, 0.2)" },
// });

// // --- Custom Completion (Your Logic) ---
// function customCompletions(context) {
// 	let word = context.matchBefore(/\w*/);
// 	if (!word || (word.from == word.to && !context.explicit)) return null;
// 	return {
// 		from: word.from,
// 		options: [
// 			{ label: "moveForward", type: "function" },
// 			{ label: "turnLeft", type: "function" },
// 			{ label: "bot", type: "variable" },
// 		],
// 	};
// }

// export function createEditor(parent, doc) {
// 	return new EditorView({
// 		doc,
// 		parent,
// 		extensions: [minimalSetup, oneDark, javascriptLanguage, highlightTheme, lineHighlightField, autocompletion({ override: [customCompletions] })],
// 	});
// }

// export { setHighlight };
