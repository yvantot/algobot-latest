import test from "node:test";
import assert from "node:assert/strict";
import { activeQuest, movementQuest } from "../src/game/global/tutorial.js";

test("the next mission waits for its prerequisite reward", () => {
  const definitions = { first: {}, second: { prereq: ["first"] } };
  assert.equal(activeQuest(definitions, {}), "first");
  assert.equal(activeQuest(definitions, { first: { is_completed: true } }), undefined);
  assert.equal(activeQuest(definitions, { first: { is_completed: true, is_claimed: true } }), "second");
});

test("first movement must be authored, and later practice needs connected blocks or a loop", () => {
  assert.equal(movementQuest("intro_run", { authored: true, x: 1, y: 0 }), "intro_run");
  assert.equal(movementQuest("intro_run", { x: 0, y: 1 }), null);
  assert.equal(movementQuest("intro_run", { x: 1, y: 0 }), null);
  assert.equal(movementQuest("intro_sequence", { sequence: false }), null);
  assert.equal(movementQuest("intro_sequence", { sequence: true }), "intro_sequence");
  assert.equal(movementQuest("intro_build"), null);
  assert.equal(movementQuest("intro_build", { authored: true }), "intro_build");
  assert.equal(movementQuest("intro_loop", { authored: true }), null);
  assert.equal(movementQuest("intro_loop", { inLoop: true }), "intro_loop");
  assert.equal(movementQuest("tut_2", { inLoop: true }), null);
});
