import test from "node:test";
import assert from "node:assert/strict";
import {learningProgress} from "../src/game/global/learning-progress.js";
import {DOCUMENTATION_PREVIEWS} from "../src/game/global/documentation-previews.js";
import {INTRODUCTION_STORY} from "../src/game/global/introduction-story.js";
test("learning progress follows completed missions and highlights the active skill",()=>{
 const rows=learningProgress({intro_run:{is_completed:true}},"intro_build");
 assert.equal(rows[0].completed,1);assert.equal(rows[0].current,true);assert.equal(rows[1].completed,0);
});
test("every documentation preview targets an existing demonstration chapter",()=>{
 for(const action of Object.values(DOCUMENTATION_PREVIEWS))assert.ok(INTRODUCTION_STORY.some(step=>step.action===action),action);
 assert.equal(INTRODUCTION_STORY.at(-1).code.length,0);
});
