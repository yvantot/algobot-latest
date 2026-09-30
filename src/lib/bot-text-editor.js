import { DOCUMENT_DATA, TYPE_COLORS } from "../game/global/global.js";
import { autocompletion } from "@codemirror/autocomplete";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { hoverTooltip } from "@codemirror/view";

export function createBotTextEditor({parent, doc="", commands=null, readOnly=false, label="Robot JavaScript program", onChange=()=>{}}) {
  const customSelectionTheme = EditorView.theme(
    {
      ".cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "#fff81a !important",
        opacity: "1",
      },
    },
    { dark: true },
  );

  const { completions, keywordHoverTooltip } = createEditorLanguage(commands);
  const editable = new Compartment();
  const view = new EditorView({parent, doc, extensions:[
    basicSetup, customSelectionTheme, javascript({typescript:false}), oneDark,
    keywordHoverTooltip, EditorView.lineWrapping,
    EditorView.contentAttributes.of({'aria-label':label}),
    EditorView.theme({'&':{height:'100%',fontSize:'16px'},'.cm-scroller':{overflow:'auto'},
      '.cm-scroller, .cm-scroller *':{fontFamily:'"Courier Prime", "Courier New", monospace'}}),
    editable.of(EditorState.readOnly.of(readOnly)),
    autocompletion({override:completions}),
    EditorView.updateListener.of(update=>{if(update.docChanged)onChange(update.state.doc.toString());}),
  ]});
  return {view,setReadOnly(value){view.dispatch({effects:editable.reconfigure(EditorState.readOnly.of(value))});}};
}

export function createEditorLanguage(commands=null) {
  const global_ac = [];
  const bot_ac = [];
  const inventory_ac = [];
  const shop_ac = [];


  const keyword = {};

  for (const main of Object.keys(DOCUMENT_DATA)) {
    for (const key of Object.keys(DOCUMENT_DATA[main])) {
      if (commands && !(main.startsWith("bot_") ? commands.includes(key) || key === "say" : main === "syntax" || main === "globals" && ["bot", "rows", "columns"].includes(key))) continue;
      const original = DOCUMENT_DATA[main][key];
      const data = commands ? {...original, is_unlocked:true} : original;
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

          global_ac.push({
            label: key,
            type: data.type,
            detail: data.arguments,
          });
          break;
        }
        case "functions": {

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
    const nodeBefore = context.matchBefore(/\binventory\.\w*$/);
    if (!nodeBefore) return null;

    return {
      from: nodeBefore.from + 10,
      options: formatOptions(inventory_ac),
      validFor: /^\w*$/,
    };
  }

  function shopCompletions(context) {
    const nodeBefore = context.matchBefore(/\bshop\.\w*$/);
    if (!nodeBefore) return null;

    return {
      from: nodeBefore.from + 5,
      options: formatOptions(shop_ac),
      validFor: /^\w*$/,
    };
  }

  function botCompletions(context) {
    const nodeBefore = context.matchBefore(/\bbot\.\w*$/);
    if (!nodeBefore) return null;

    return {
      from: nodeBefore.from + 4,
      options: formatOptions(bot_ac),
      validFor: /^\w*$/,
    };
  }


  return {completions:[myCompletions,botCompletions,shopCompletions,inventoryCompletions],keywordHoverTooltip};
}
