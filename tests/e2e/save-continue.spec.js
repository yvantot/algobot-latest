import { test, expect } from "@playwright/test";

async function readSave(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open("algobot-playthrough-v1", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const root = await new Promise((resolve, reject) => { const r = db.transaction("state").objectStore("state").get("root"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    db.close(); return root;
  });
}
async function fresh(page, fixture = false) {
  await page.goto(fixture ? "/tests/ui/persistence.html" : "/");
  await expect(page.getByRole("button", { name: "New Game", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "New Game", exact: true }).click();
  await expect.poll(async () => (await readSave(page))?.active?.payload.bots.length).toBe(1);
  await expect(page.getByRole("button", { name: "New Game", exact: true })).toHaveCount(0);
}
test("New Game saves a farm and Continue survives a real reload", async ({ page }) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await fresh(page);
  const original = (await readSave(page)).active;
  await page.reload();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Game", exact: true })).toHaveCount(0);
  expect((await readSave(page)).active.playthroughId).toBe(original.playthroughId);
  expect(errors).toEqual([]);
});
test("New Game cancel preserves the slot, confirmation creates a fresh playthrough", async ({ page }) => {
  await fresh(page); const original = (await readSave(page)).active;
  await page.reload();
  await page.getByRole("button", { name: "New Game", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await readSave(page)).active.playthroughId).toBe(original.playthroughId);
  await page.getByRole("button", { name: "New Game", exact: true }).click();
  await page.getByRole("button", { name: "Replace farm", exact: true }).click();
  await expect.poll(async () => (await readSave(page)).active.playthroughId).not.toBe(original.playthroughId);
  expect((await readSave(page)).active.payload.economy.coins).toBe(50);
});
test("OWNER-1 changing a study participant blocks Continue without relabeling the save", async ({ page }) => {
  await page.goto("/?study_participant=A");
  await page.getByRole("button", { name: "New Game", exact: true }).click();
  await expect.poll(async () => (await readSave(page))?.active?.owner.participantId).toBe("A");
  await page.goto("/?study_participant=B");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("different participant");
  expect((await readSave(page)).active.owner.participantId).toBe("A");
  expect(await page.evaluate(() => localStorage.getItem("algobot_participant_id"))).toBe("A");
});

async function closeDemo(page) {
  const close = page.getByRole("button", { name: "Close demo", exact: true });
  if (await close.count()) { await close.click(); await expect(close).toHaveCount(0); }
}
test("crop ownership, programs, economy and all crop types survive closure without offline growth", async ({ page }) => {
  await fresh(page, true); await closeDemo(page);
  const saved = await page.evaluate(async () => {
    const { k, persistence, farm_grid_index, addCrop, INVENTORY, PLAYER_DATA, robots_state, Personalize } = window.saveTesting;
    k.debug.timeScale = 0;
    const types = ["wheat", "corn", "rice", "potato", "sugarcane", "tomato"];
    for (let i = 0; i < types.length; i++) {
      const x = i % 3, y = Math.floor(i / 3), tile = farm_grid_index.get(`${y}-${x}`);
      tile.soil.till(); tile.crop = addCrop(farm_grid_index, types[i], x, y); tile.soil.water();
    }
    INVENTORY.coins = 123; PLAYER_DATA.exp = 245; Personalize.FARM_NAME = "Reload farm";
    robots_state[0].text_code = 'bot.say("saved text");';
    await persistence.checkpoint(); return persistence.current;
  });
  await page.addInitScript(() => { const now = Date.now; Date.now = () => now() + 2 * 86400000; });
  await page.reload(); await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Game", exact: true })).toHaveCount(0);
  const restored = await page.evaluate(async () => {
    const { k, captureWorld } = window.saveTesting; k.debug.timeScale = 0; return captureWorld();
  });
  expect(restored.economy.coins).toBe(123); expect(restored.economy.exp).toBe(245);
  expect(restored.personalize.FARM_NAME).toBe("Reload farm");
  expect(restored.bots[0].program.text_code).toBe('bot.say("saved text");');
  for (let i = 0; i < 6; i++) {
    expect(restored.tiles[i].crop.id).toBe(saved.payload.tiles[i].crop.id);
    expect(restored.tiles[i].soil.owner).toBe(restored.tiles[i].crop.id);
    expect(restored.tiles[i].soil.water).toBeGreaterThan(.5);
    expect(restored.tiles[i].crop.state).toBe("_young");
  }
});
test("a second tab cannot replace an actively owned farm", async ({ page, context }) => {
  await fresh(page); const original = (await readSave(page)).active.playthroughId;
  const other = await context.newPage(); await other.goto("/");
  await other.getByRole("button", { name: "New Game", exact: true }).click();
  await other.getByRole("button", { name: "Replace farm", exact: true }).click();
  await expect(other.getByRole("alert")).toContainText("Another tab");
  expect((await readSave(page)).active.playthroughId).toBe(original);
});
test("real IndexedDB quota/abort failure retains the committed farm and retries", async ({ page }) => {
  await fresh(page, true); await closeDemo(page);
  const result = await page.evaluate(async () => {
    const { persistence, INVENTORY } = window.saveTesting;
    await persistence.checkpoint(); const before = persistence.current.payload.economy.coins;
    persistence.storage.fault = stage => { if (stage === "after-write") throw new DOMException("Injected quota", "QuotaExceededError"); };
    INVENTORY.coins = before + 100;
    let code;
    try { await persistence.checkpoint(); } catch (error) { code = error.code; }
    persistence.storage.fault = () => {};
    const retained = (await persistence.storage.read()).active.payload.economy.coins;
    await persistence.checkpoint();
    return { before, retained, after: persistence.current.payload.economy.coins, code };
  });
  expect(result.retained).toBe(result.before); expect(result.code).toBe("quota");
  expect(result.after).toBe(result.before + 100);
});
test("every quest round-trips through actual engine reconstruction without reward replay", async ({ page }) => {
  test.setTimeout(120000); await fresh(page, true); await closeDemo(page);
  const result = await page.evaluate(async () => {
    const { persistence, captureWorld, restoreWorld, QUEST_DATA, k } = window.saveTesting;
    k.debug.timeScale = 0; persistence.busy = true;
    const base = captureWorld(); let count = 0;
    try {
      for (const [key, quest] of Object.entries(QUEST_DATA)) for (const phase of [0, 1, 2]) {
        const saved = structuredClone(base);
        saved.quests[key] = { progress: phase ? quest.goal : 0, is_completed: phase > 0, is_claimed: phase === 2 };
        await restoreWorld(saved);
        const actual = captureWorld();
        if (JSON.stringify(actual.quests[key]) !== JSON.stringify(saved.quests[key]) || actual.economy.coins !== saved.economy.coins || actual.economy.exp !== saved.economy.exp) throw Error(`${key}:${phase} did not round-trip`);
        count++;
      }
    } finally { persistence.busy = false; }
    return count;
  });
  expect(result).toBe(44 * 3);
});

test("RESEARCH-1/2 interrupted assessment is recorded once in its original session", async ({ page }) => {
  await fresh(page, true); await closeDemo(page);
  const original = await page.evaluate(async () => {
    const t = window.saveTesting;
    t.k.debug.timeScale = 0;
    const result = await t.assessmentTransition("opened", () => ({ assessment: t.openChallenge(t.telemetry, t.CHALLENGES[0], true) }));
    return result.assessment;
  });
  for (let i = 0; i < 2; i++) {
    await page.reload(); await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("button", { name: "New Game", exact: true })).toHaveCount(0);
  }
  const root = await readSave(page), assessment = root.research.assessments[original.assessment_id];
  expect(assessment.session_id).toBe(original.session_id);
  expect(assessment.status).toBe("abandoned"); expect(assessment.reward_claimed).toBe(false);
  expect(Object.keys(root.research.operations).filter(key => key === `interrupted:${original.assessment_id}`)).toHaveLength(1);
});
test("RESEARCH-1 reward failure rolls back, retry commits once and reload preserves payout", async ({ page }) => {
  await fresh(page, true); await closeDemo(page);
  const paid = await page.evaluate(async () => {
    const t = window.saveTesting; t.k.debug.timeScale = 0;
    const task = t.CHALLENGES[0];
    const { assessment } = await t.assessmentTransition("opened", () => ({ assessment: t.openChallenge(t.telemetry, task, true) }));
    await t.assessmentTransition("scored", () => {
      t.submitChallenge(t.telemetry, assessment, { score: 1, max_score: 1, passed: true, results: [] }, "test", "text");
      return { assessment };
    });
    const before = t.INVENTORY.coins;
    const claim = () => t.assessmentTransition("reward", () => ({ assessment, granted: t.claimChallengeReward(t.telemetry, assessment, () => t.INVENTORY.changeCoins(90), t.farmChallengeRewards) }));
    t.persistence.storage.fault = stage => { if (stage === "after-write") throw Error("Injected failure"); };
    let failed = false; try { await claim(); } catch { failed = true; }
    t.persistence.storage.fault = () => {};
    const rolledBack = t.INVENTORY.coins;
    const first = await claim(), duplicate = await claim();
    return { before, failed, rolledBack, first: first.granted, duplicate: duplicate.granted, total: t.INVENTORY.coins, id: assessment.assessment_id };
  });
  expect(paid.failed).toBe(true); expect(paid.rolledBack).toBe(paid.before);
  expect(paid.first).toBe(true); expect(paid.duplicate).toBe(false); expect(paid.total).toBe(paid.before + 90);
  await page.reload(); await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Game", exact: true })).toHaveCount(0);
  const root = await readSave(page);
  expect(root.active.payload.economy.coins).toBe(paid.total);
  expect(root.research.assessments[paid.id].reward_claimed).toBe(true);
});
test("engine endurance keeps bot and soil counts bounded through 100 restores and 50 new farms", async ({ page }) => {
  test.setTimeout(120000); await fresh(page, true); await closeDemo(page);
  const counts = await page.evaluate(async () => {
    const t = window.saveTesting; t.k.debug.timeScale = 0; t.persistence.busy = true;
    const saved = t.captureWorld(); const results = [];
    try {
      for (let i = 0; i < 150; i++) {
        if (i < 100) await t.restoreWorld(saved); else await t.newWorld();
        const roots = t.k.get();
        results.push({ bots: roots.filter(o => o.bot_index !== undefined).length, soils: [...t.farm_grid_index.values()].filter(tile => tile.soil).length, roots: roots.length });
      }
    } finally { t.persistence.busy = false; }
    return results;
  });
  expect(counts.every(c => c.bots === 1 && c.soils === 9)).toBe(true);
  expect(Math.max(...counts.map(c => c.roots)) - Math.min(...counts.map(c => c.roots))).toBeLessThan(5);
});

test("menu and confirmation fit a phone and support keyboard cancellation", async ({ page }, testInfo) => {
  await fresh(page); await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ["Continue", "New Game", "Settings", "About"]) {
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390); expect(box.y + box.height).toBeLessThanOrEqual(844);
  }
  await page.screenshot({ path: testInfo.outputPath("menu-mobile.png") });
  const newGame = page.getByRole("button", { name: "New Game", exact: true });
  await newGame.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("confirmation-mobile.png") });
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(newGame).toBeFocused();
});

test("concurrent assessment clicks cannot roll back an in-flight reward", async ({ page }) => {
  await fresh(page, true); await closeDemo(page);
  const result = await page.evaluate(async () => {
    const t = window.saveTesting;
    const { assessment } = await t.assessmentTransition("opened", () => ({ assessment: t.openChallenge(t.telemetry, t.CHALLENGES[0], true) }));
    const before = t.INVENTORY.coins;
    const first = t.assessmentTransition("scored", () => { t.INVENTORY.coins += 10; return { assessment }; });
    let code;
    try { await t.assessmentTransition("scored", () => { throw Error("Second mutation must not execute"); }); } catch (error) { code = error.code; }
    await first;
    return { before, after: t.INVENTORY.coins, saved: t.persistence.current.payload.economy.coins, code };
  });
  expect(result.code).toBe("busy"); expect(result.after).toBe(result.before + 10); expect(result.saved).toBe(result.after);
});

test("corrupt checkpoint supports diagnostic export and explicit previous-save recovery", async ({ page }) => {
  await fresh(page, true); await closeDemo(page);
  await page.evaluate(async () => {
    const p = window.saveTesting.persistence; await p.checkpoint(); p.ready = false;
    await p.storage.transaction(root => { root.active.payload.economy.coins = -1; });
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Invalid economy");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Export save", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("algobot-save-diagnostic.json");
  await page.getByRole("button", { name: "Recover previous save", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Game", exact: true })).toHaveCount(0);
  const root = await readSave(page);
  expect(root.active.recoveryGeneration).toBe(1); expect(root.active.payload.economy.coins).toBeGreaterThanOrEqual(0);
  expect(root.active.payload.exclusions).toContain("checkpoint_recovery");
});

test("future-version checkpoints are preserved and never silently reset", async ({ page }) => {
  await fresh(page, true);
  await page.evaluate(async () => {
    const p = window.saveTesting.persistence; p.ready = false;
    await p.tail; await p.storage.transaction(root => { root.active.schemaVersion = 999; });
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("newer game version");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  expect((await readSave(page)).active.schemaVersion).toBe(999);
});

test("denied IndexedDB shows a retryable error without entering an unsaved farm", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "indexedDB", { value: undefined }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("does not allow farm storage");
  await page.getByRole("button", { name: "New Game", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("does not allow farm storage");
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeEnabled();
});

test("multiple bots, Blockly XML, inboxes and pest clocks survive engine reconstruction", async ({ page }) => {
  await fresh(page, true); await closeDemo(page);
  const result = await page.evaluate(async () => {
    const t = window.saveTesting; t.k.debug.timeScale = 0; t.persistence.busy = true;
    try {
      const p = t.captureWorld();
      p.bots.push({ ...structuredClone(p.bots[0]), index: 1, x: 2, y: 1 });
      p.bots[1].program.block_xml = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="math_number"><field name="NUM">7</field></block></xml>';
      p.inboxes = { nextId: 1, inboxes: [[0, []], [1, [{ id: 1, sender: 0, value: "ready" }]]] };
      p.pests = [{ id: "pest-test", x: 2, y: 2, motion: null, reservation: "2-2", config: { damage: 2, attack_interval: 1, move_interval: 2, jump_duration: .5, stationary: true, lesson: false }, attackRemaining: .4, moveRemaining: 1.3, exposureAge: 2.1, spawned_at: Date.now() }];
      await t.restoreWorld(p);
      return { saved: p, restored: t.captureWorld(), running: t.robots_state.map(bot => bot.is_running) };
    } finally { t.persistence.busy = false; }
  });
  expect(result.restored.bots).toEqual(result.saved.bots); expect(result.restored.inboxes).toEqual(result.saved.inboxes);
  expect(result.restored.pests).toEqual(result.saved.pests); expect(result.running).toEqual([false, false]);
});

test("restored Water the row lesson absorbs water and releases protection on completion", async ({ page }) => {
  await fresh(page, true); await closeDemo(page);
  const result = await page.evaluate(async () => {
    const t = window.saveTesting; t.k.debug.timeScale = 0; t.persistence.busy = true;
    try {
      const p = t.captureWorld(); p.tutorial.active = false;
      for (const [key, quest] of Object.entries(t.QUEST_DATA)) {
        if (key === "loop_water_0") break;
        if (!quest.optional) p.quests[key] = { progress: quest.goal, is_completed: true, is_claimed: true };
      }
      await t.restoreWorld(p);
      const tile = t.farm_grid_index.get("0-0"); tile.soil.till();
      tile.crop = t.addCrop(t.farm_grid_index, "wheat", 0, 0); tile.soil.water();
      tile.lesson = "row-young"; t.farm_grid_index.lessonQuest = "loop_water_0"; t.farm_grid_index.lessonActive = true;
      await t.restoreWorld(t.captureWorld());
      const restored = t.farm_grid_index.get("0-0");
      restored.crop.advanceGrowth(.25);
      const absorbing = restored.crop.absorbing_water, water = restored.soil.water_remaining;
      const finished = t.captureWorld();
      finished.quests.loop_water_0 = { progress: 3, is_completed: true, is_claimed: false };
      await t.restoreWorld(finished);
      return { absorbing, water, lesson: t.farm_grid_index.get("0-0").lesson, active: t.farm_grid_index.lessonActive };
    } finally { t.persistence.busy = false; }
  });
  expect(result.absorbing).toBe(true); expect(result.water).toBeLessThan(1);
  expect(result.lesson).toBeNull(); expect(result.active).toBe(false);
});

test("20 by 20 farm with 20 bots records capture and commit costs", async ({ page }, testInfo) => {
  await fresh(page, true); await closeDemo(page);
  const result = await page.evaluate(async () => {
    const t = window.saveTesting; t.k.debug.timeScale = 0; t.persistence.busy = true;
    const p = t.captureWorld(); p.rows = p.columns = 20;
    p.tiles = Array.from({ length: 400 }, (_, i) => ({ ...structuredClone(p.tiles[0]), x: i % 20, y: Math.floor(i / 20) }));
    p.bots = Array.from({ length: 20 }, (_, i) => ({ ...structuredClone(p.bots[0]), index: i, x: i, program: { text_code: 'bot.say("saved code");\n'.repeat(500), block_xml: "<xml></xml>" } }));
    await t.restoreWorld(p); t.persistence.busy = false;
    const samples = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now(); t.persistence.envelope(t.captureWorld()); samples.push(performance.now() - start);
    }
    const start = performance.now(); await t.persistence.checkpoint();
    return { captureValidationMs: samples, commitMs: performance.now() - start, bytes: new TextEncoder().encode(JSON.stringify(t.persistence.current)).length, bots: t.captureWorld().bots.length, tiles: t.captureWorld().tiles.length };
  });
  expect(result.bots).toBe(20); expect(result.tiles).toBe(400);
  await testInfo.attach("performance.json", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
  console.log("SAVE_PERFORMANCE", JSON.stringify(result));
});
