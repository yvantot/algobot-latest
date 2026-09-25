import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
const hook=registerHooks({load(url,context,next){
  if(url.endsWith('/src/lib/kaplay.js'))return {format:'module',source:'export const k={};',shortCircuit:true};
  return next(url,context);
}});
const {createEditorLanguage}=await import('../src/lib/bot-text-editor.js');
hook.deregister();
function suggestions(text,commands){
  const context=new CompletionContext(EditorState.create({doc:text}),text.length,true);
  return createEditorLanguage(commands).completions.map(fn=>fn(context)).filter(Boolean);
}
test('challenge completions exclude shop, inventory and unavailable bot commands without quest locks',()=>{
  const commands=['right','harvest','is_harvestable'];
  assert.deepEqual(suggestions('bot.',commands)[0].options.map(o=>o.label).sort(),['harvest','is_harvestable','right','say']);
  for(const namespace of ['shop.','inventory.'])assert.equal(suggestions(namespace,commands).flatMap(r=>r.options).length,0);
  const globals=suggestions('',commands).flatMap(r=>r.options);
  for(const name of ['bot','columns','rows'])assert.ok(globals.some(o=>o.label===name));
  assert.ok(globals.every(o=>!o.detail?.includes('Locked')));
});
test('both editors complete partially typed members and main farm retains full command help',()=>{
  const partial=suggestions('bot.har',['harvest'])[0];
  assert.equal(partial.from,4);
  assert.ok(partial.options.some(o=>o.label==='harvest'));
  assert.ok(suggestions('shop.buy',null)[0].options.some(o=>o.label==='buy_row'));
  assert.ok(suggestions('bot.',null)[0].options.some(o=>o.label==='send'));
});
