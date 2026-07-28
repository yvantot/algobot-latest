// import { EditorView, basicSetup } from "codemirror";
// import { autocompletion } from "@codemirror/autocomplete";
// import { javascriptLanguage } from "@codemirror/lang-javascript"; // Use the language, not the function
// import { oneDark } from "@codemirror/theme-one-dark";

// function customCompletions(context) {
// 	let word = context.matchBefore(/\w*/);
// 	if (!word || (word.from == word.to && !context.explicit)) return null;

// 	// Only these will show up in the dropdown
// 	const options = [
// 		{ label: "moveForward", type: "function" },
// 		{ label: "turnLeft", type: "function" },
// 		{ label: "bot", type: "variable" },
// 	];

// 	return {
// 		from: word.from,
// 		options: options,
// 	};
// }

// export default function createEditor(parentId) {
// 	return new EditorView({
// 		doc: "function moveBot() {\n  bot.moveForward();\n}",
// 		extensions: [
// 			basicSetup,
// 			oneDark,
// 			// 1. Add the core JS language support (syntax highlighting)
// 			javascriptLanguage,
// 			// 2. Override completions globally
// 			autocompletion({
// 				override: [customCompletions],
// 			}),
// 		],
// 		parent: document.getElementById(parentId),
// 	});
// }
