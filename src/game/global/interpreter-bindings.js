// JS-Interpreter uses function.length to place its completion callback. Keep
// fixed arities here; a rest-argument async binding silently loses arguments.
const asyncArities = {
  wait: 1, jump: 2, left: 0, right: 0, down: 0, up: 0,
  till: 0, water: 0, plant: 1, harvest: 0, destroy: 0,
  kill_bug: 0, extinguish: 0,
  is_dead: 0, is_tilled: 0, is_watered: 0, is_planted: 0,
  is_harvestable: 0, is_bug: 0, is_fire: 0,
};

function asyncBinding(command, arity) {
  if (arity === 2) return function (first, second, callback) { command(first, second, callback); };
  if (arity === 1) return function (first, callback) { command(first, callback); };
  return function (callback) { command(callback); };
}

export function createInterpreterInit(api, workspace = null) {
  return function init(interpreter, globalObject) {
    const bindNative = (object, name, fn) => interpreter.setProperty(object, name, interpreter.createNativeFunction(fn));
    for (const [name, fn] of Object.entries(api.globals)) bindNative(globalObject, name, fn);
    for (const [name, fn] of Object.entries(api.hooks)) bindNative(globalObject, name, fn);
    bindNative(globalObject, "highlightBlock", id => {
      api.hooks.__highlightBlock?.(id);
      // Highlighting is a UI observer; switching editors may dispose its old
      // workspace while a robot command is still completing.
      try { workspace?.highlightBlock(id == null ? "" : String(id)); } catch { /* editor disposed */ }
    });

    for (const name of ["bot", "shop", "inventory", "console"]) {
      const object = interpreter.nativeToPseudo({});
      interpreter.setProperty(globalObject, name, object);
      for (const [key, command] of Object.entries(api[name])) {
        if (name === "bot" && Object.hasOwn(asyncArities, key)) {
          interpreter.setProperty(object, key, interpreter.createAsyncFunction(asyncBinding(command, asyncArities[key])));
        } else {
          bindNative(object, key, command);
        }
      }
    }
  };
}
