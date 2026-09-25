import test from "node:test";
import assert from "node:assert/strict";
import { CHALLENGES, ALL_CHALLENGES, challengeMaxScore } from "../src/game/challenges/catalog.js";

test("retired challenges and superseded corn rubrics remain importable but are absent from the board",()=>{
  const retired=["ready-row-v3","changing-row-v3","field-patrol-v1","corn-sequence-v1","corn-row-v1","storm-planner-v1"];
  assert.equal(CHALLENGES.length,10);
  for(const id of retired){
    assert.ok(!CHALLENGES.some(task=>task.id===id),id);
    assert.ok(ALL_CHALLENGES.some(task=>task.id===id),id);
  }
  assert.equal(new Set(ALL_CHALLENGES.map(task=>task.id)).size,ALL_CHALLENGES.length);
  assert.equal(challengeMaxScore(ALL_CHALLENGES.find(task=>task.id==='corn-sequence-v1')),3);
  assert.equal(challengeMaxScore(CHALLENGES.find(task=>task.id==='corn-sequence-v2')),2);
});
