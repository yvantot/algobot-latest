import { test, expect } from "@playwright/test";

test("Finish keeps download available during a stalled upload", async ({ page }) => {
  await page.goto("/tests/ui/download.html?upload=pending");
  await page.getByRole("button", { name: "Test ready", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sending your data…", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Download data", exact: true }).click();
  await expect(page.getByText("Test download requests: 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Check your downloads", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("failed upload retries and successful upload still offers a local copy", async ({ page }) => {
  await page.goto("/tests/ui/download.html?upload=retry");
  await page.getByRole("button", { name: "Test ready", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Not sent yet", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try sending again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Data sent ✓", exact: true })).toBeVisible();
  await expect(page.getByText("Test upload requests: 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Download data", exact: true }).click();
  await expect(page.getByText("Test download requests: 1", { exact: true })).toBeVisible();
});

test("not-ready Finish never initiates upload", async ({ page }) => {
  await page.goto("/tests/ui/download.html?upload=ok");
  await page.getByRole("button", { name: "Test not ready", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Not ready yet", exact: true })).toBeVisible();
  await expect(page.getByText("Test upload requests: 0", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download data", exact: true })).toHaveCount(0);
});
