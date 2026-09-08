import { test, expect } from "@playwright/test";

test("landing explains WordLoop and loads the bundled font", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/WordLoop/);
  await expect(page.getByRole("heading", { name: /WordLoop/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "학습 흐름" })).toBeVisible();
  const font = await page.request.get("/fonts/PretendardVariable.woff2");
  expect(font.ok()).toBe(true);
  expect((await font.body()).length).toBeGreaterThan(1000);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px "Pretendard"'))).toBe(true);
});

test("skip link moves keyboard focus to the main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "본문으로 건너뛰기" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("auth failure gives a readable retry explanation", async ({ page }) => {
  await page.goto("/?auth=failed");
  await expect(page.locator("main").getByRole("alert")).toContainText("로그인을 완료하지 못했습니다");
});

test("setup keeps operator details behind a keyboard disclosure", async ({ page }) => {
  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: /학습 공간을/ })).toBeVisible();
  const details = page.locator("details");
  await expect(details).not.toHaveAttribute("open", "");
  await page.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await expect(page.locator("pre")).toContainText("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
});

test("private routes remain guarded without a session", async ({ page }) => {
  for (const route of ["/dashboard", "/words", "/study", "/stats"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/(setup|\?auth=required)$/);
  }
});

for (const width of [320, 390, 768, 1440]) {
  test(`public layouts fit a ${width}px viewport with reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of ["/", "/setup", "/missing-wordloop-page"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await page.locator("h1").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
    }
  });
}
