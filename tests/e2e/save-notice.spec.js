import { test, expect } from "@playwright/test";

test("routine saves fade, failures remain actionable, and retry confirmation fades", async ({ page }) => {
  await page.goto("/tests/ui/save-notice.html");
  const notice = page.getByRole("status", { name: "Farm save status" });
  await expect(notice).toContainText("Farm saved");
  await expect(notice).toHaveCount(0, { timeout: 6000 });
  await page.getByRole("button", { name: "Fail save" }).click();
  await expect(notice).toContainText("Could not save");
  await expect(notice).not.toContainText("Farm saved");
  await page.clock.install();
  await page.clock.fastForward(10000);
  await expect(notice).toBeVisible();
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(notice).toContainText("Farm saved");
  await page.clock.fastForward(4000);
  await expect(notice).toHaveCount(0);
});

for (const width of [390, 1280]) test(`activity notice fits the right edge at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tests/ui/save-notice.html");
  await page.getByRole("button", { name: "Activity notice" }).click();
  const notice = page.getByRole("status", { name: "Farm save status" });
  await expect(notice).toContainText("Activity was not saved");
  await expect(notice).not.toContainText("Farm saved");
  const bounds = await notice.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(12);
  expect(Math.round(bounds.x + bounds.width)).toBe(width - 12);
  await page.screenshot({ path: testInfo.outputPath(`save-notice-${width}.png`) });
  await notice.getByRole("button", { name: "Dismiss" }).focus();
  await page.keyboard.press("Enter");
  await expect(notice).toHaveCount(0);
});
