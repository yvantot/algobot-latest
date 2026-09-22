import test from "node:test";
import assert from "node:assert/strict";
import { activeQuest, movementQuest } from "../src/game/global/tutorial.js";

test("the next mission waits for its prerequisite reward", () => {
  const definitions = { first: {}, second: { prereq: ["first"] } };
  assert.equal(activeQuest(definitions, {}), "first");
  assert.equal(activeQuest(definitions, { first: { is_completed: true } }), undefined);
  assert.equal(activeQuest(definitions, { first: { is_completed: true, is_claimed: true } }), "second");
});

test("prepared movement cannot satisfy the authored or loop missions", () => {
  assert.equal(movementQuest("intro_run"), "intro_run");
  assert.equal(movementQuest("intro_build"), null);
  assert.equal(movementQuest("intro_build", { authored: true }), "intro_build");
  assert.equal(movementQuest("intro_loop", { authored: true }), null);
  assert.equal(movementQuest("intro_loop", { inLoop: true }), "intro_loop");
  assert.equal(movementQuest("tut_2", { inLoop: true }), null);
});
