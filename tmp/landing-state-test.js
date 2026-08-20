const { chromium } = require("C:/Users/vasilena.slavova/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("http://localhost:8787/index.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("walltopia.calculator.draft.v1");
    localStorage.removeItem("walltopia.calculator.solution.v1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);

  await page.locator('[data-result-option="single"]').click();
  await page.locator("#seg-units button", { hasText: "Metric" }).click();
  await page.locator("#seg-type button", { hasText: "Climbing wall" }).click();
  await page.locator("#chips-height button", { hasText: /^14$/ }).click();

  const before = await page.locator("#chips-height button", { hasText: /^14$/ }).getAttribute("aria-pressed");
  await page.locator("#calculator-home-link").click();
  const landingVisible = await page.locator(".calculator-welcome-banner").isVisible();
  const calculatorHighlightedOnLanding = await page.locator('.topnav a[href="index.html"]').getAttribute("aria-current");
  await page.locator('.topnav a[href="index.html"]').click();
  const selectedOptionsBeforeChoice = await page.locator('[data-result-option][aria-selected="true"]').count();
  const panelVisibleBeforeChoice = await page.locator(".panel").isVisible();
  const bannerVisibleInCalculator = await page.locator(".calculator-welcome-banner").count();
  await page.locator('[data-result-option="single"]').click();
  const after = await page.locator("#chips-height button", { hasText: /^14$/ }).getAttribute("aria-pressed");
  const panelVisibleAfterChoice = await page.locator(".panel").isVisible();

  const result = { before, landingVisible, calculatorHighlightedOnLanding, selectedOptionsBeforeChoice,
    panelVisibleBeforeChoice, bannerVisibleInCalculator, after, panelVisibleAfterChoice };
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (before !== "true" || !landingVisible || calculatorHighlightedOnLanding !== null
    || selectedOptionsBeforeChoice !== 0 || panelVisibleBeforeChoice || bannerVisibleInCalculator !== 0
    || after !== "true" || !panelVisibleAfterChoice) {
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
