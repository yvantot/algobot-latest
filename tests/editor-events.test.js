import test from "node:test";
import assert from "node:assert/strict";
import { isBlocklyProgramEdit } from "../src/game/ml/editor-events.js";

test("Blockly counts program changes but not selection, workspace loading or canvas positioning", () => {
  for (const type of ["create", "delete", "change", "var_rename"]) {
    assert.equal(isBlocklyProgramEdit({ type, recordUndo: true }), true);
    assert.equal(isBlocklyProgramEdit({ type, recordUndo: false }), false);
  }
  assert.equal(isBlocklyProgramEdit({ type: "selected", isUiEvent: true, recordUndo: true }), false);
  assert.equal(isBlocklyProgramEdit({ type: "move", recordUndo: true, oldCoordinate: {x:0,y:0}, newCoordinate:{x:20,y:20} }), false);
  assert.equal(isBlocklyProgramEdit({ type: "move", recordUndo: true, newParentId: "loop" }), true);
  assert.equal(isBlocklyProgramEdit({ type: "move", recordUndo: true, oldParentId: "loop" }), true);
});
