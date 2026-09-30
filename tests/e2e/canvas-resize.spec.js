import { test, expect } from "@playwright/test";

test("farm canvas follows viewport expansion and contraction", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 504, height: 672 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "New Game", exact: true })).toBeEnabled();
  for (const size of [{ width: 1366, height: 768 }, { width: 800, height: 600 }]) {
    await page.setViewportSize(size);
    await expect.poll(() => page.locator("#game").evaluate(canvas => ({
      width: Math.round(canvas.getBoundingClientRect().width),
      height: Math.round(canvas.getBoundingClientRect().height),
    }))).toEqual(size);
  }
  expect(errors).toEqual([]);
});
