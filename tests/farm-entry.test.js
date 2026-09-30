import test from "node:test";
import assert from "node:assert/strict";
import { farmEntryScreen } from "../src/components/farm-entry.js";

const preferences = values => ({ getItem:key => values[key] ?? null });
test("fresh farms open the demonstration despite old browser visit and onboarding flags",()=>{
  for(const values of [{},{algobot_visited:"true"},{algobot_visited:"true",algobot_hide_onboarding:"true"}])
    assert.equal(farmEntryScreen(true,preferences(values)),"demonstration");
});
test("returning to the same farm shows onboarding until explicitly hidden",()=>{
  assert.equal(farmEntryScreen(false,preferences({})),"onboarding");
  assert.equal(farmEntryScreen(false,preferences({algobot_hide_onboarding:"true"})),null);
});
