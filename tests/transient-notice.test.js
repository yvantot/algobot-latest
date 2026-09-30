import test from "node:test";
import assert from "node:assert/strict";
import { createTransientNotice } from "../src/components/transient-notice.js";

test("mode notice expires and identical predictions do not make it reappear", () => {
  const shown = []; let callback; let count = 0;
  const notice = createTransientNotice(value => shown.push(value), {
    schedule(fn, duration) { callback = fn; count++; assert.equal(duration, 6500); return count; }, cancel() {},
  });
  assert.equal(notice.update("Challenge active"), true);
  callback();
  assert.equal(notice.update("Challenge active"), false);
  assert.deepEqual(shown, ["Challenge active", ""]);
  assert.equal(count, 1);
  notice.update("");
  assert.equal(notice.update("Challenge active"), true, "a new mode transition may notify again");
});

test("disposing a notice cancels its pending dismissal", () => {
  const canceled = [];
  const notice = createTransientNotice(() => {}, { schedule: () => 7, cancel: id => canceled.push(id) });
  notice.update("Hint"); notice.dispose();
  assert.equal(canceled.at(-1), 7);
});
