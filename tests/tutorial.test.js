import test from "node:test";
import assert from "node:assert/strict";
import { activeQuest, movementQuest, createMovementTracker } from "../src/game/global/tutorial.js";

test("movement missions require return trips in one execution, and loops require two trips", () => {
  const left = { direction: "left", runId: "run-1", fromX: 1, fromY: 1, x: 0, y: 1 };
  const right = { direction: "right", runId: "run-1", fromX: 0, fromY: 1, x: 1, y: 1 };
  let credit = createMovementTracker();
  assert.equal(credit("intro_sequence", right), 0, "right cannot start the trip");
  assert.equal(credit("intro_sequence", left), 0);
  assert.equal(credit("intro_sequence", {...right, runId: "run-2"}), 0, "separate runs cannot finish a trip");
  assert.equal(credit("intro_sequence", left), 0);
  assert.equal(credit("intro_sequence", {...right, fromY: 2, y: 2}), 0, "must return from the same tile");
  assert.equal(credit("intro_sequence", left), 0);
  assert.equal(credit("intro_sequence", right), 2);
  credit = createMovementTracker();
  assert.equal(credit("intro_loop", left), 0);
  assert.equal(credit("intro_loop", right), 0, "one trip is not two trips");
  assert.equal(credit("intro_loop", left), 0);
  assert.equal(credit("intro_loop", right), 2);
  credit = createMovementTracker();
  credit("intro_loop", left); credit("intro_loop", right);
  credit(null, right);
  assert.equal(credit("intro_loop", left), 0);
  assert.equal(credit("intro_loop", right), 0, "ineligible movements interrupt the loop objective");
});

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
  assert.equal(movementQuest("intro_build", { authored: true, direction: "down" }), "intro_build");
  assert.equal(movementQuest("intro_build", { authored: true, direction: "right" }), null);
  assert.equal(movementQuest("intro_loop", { authored: true }), null);
  assert.equal(movementQuest("intro_loop", { inLoop: true }), "intro_loop");
  assert.equal(movementQuest("tut_2", { inLoop: true }), null);
});

test("required tutorial ends with farming; loop remains a later mission", async()=>{
  const {INTRO_QUESTS}=await import('../src/game/global/tutorial.js');
  assert.equal(INTRO_QUESTS.at(-1),'tut_2');
  assert.equal(INTRO_QUESTS.includes('intro_loop'),false);
});
