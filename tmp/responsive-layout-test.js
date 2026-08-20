const { chromium } = require("C:/Users/vasilena.slavova/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const fs = require("fs");
const path = require("path");

const cases = [
  [390, 844], [768, 1024], [960, 900], [1024, 768],
  [1280, 800], [1366, 768], [1440, 900], [1920, 1080],
];
const outputDir = path.join(__dirname, "responsive-layout-results");
fs.mkdirSync(outputDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [];

  for (const [width, height] of cases) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto("http://localhost:8787/index.html", { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      localStorage.removeItem("walltopia.calculator.draft.v1");
      localStorage.removeItem("walltopia.calculator.solution.v1");
    });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForTimeout(350);

    const welcome = await page.evaluate(() => {
      const visible = (el) => !!el && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden";
      const short = document.querySelector(".tech-docs-short");
      const full = document.querySelector(".tech-docs-full");
      const masthead = document.querySelector(".masthead");
      const banner = document.querySelector(".calculator-welcome-banner");
      return {
        bodyOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        mastheadOverflowX: masthead.scrollWidth > masthead.clientWidth + 1,
        shortVisible: visible(short),
        fullVisible: visible(full),
        bannerInsideViewport: banner ? banner.getBoundingClientRect().right <= innerWidth + 1 : false,
      };
    });

    const option = page.locator('[data-result-option="single"]');
    await option.click();
    await page.waitForTimeout(120);
    const calculator = await page.evaluate(() => {
      const panel = document.querySelector(".panel");
      const results = document.querySelector(".results");
      const viewport = document.querySelector(".schematic-viewport, .attachment-viewport");
      const visibleChildren = panel ? [...panel.children].filter((el) => {
        const s = getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden";
      }) : [];
      const last = visibleChildren.at(-1);
      const panelBox = panel && panel.getBoundingClientRect();
      const resultBox = results && results.getBoundingClientRect();
      const viewportBox = viewport && viewport.getBoundingClientRect();
      return {
        bodyOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        panelExtraBottom: panelBox && last ? Math.round(panelBox.bottom - last.getBoundingClientRect().bottom) : null,
        panelHeight: panelBox ? Math.round(panelBox.height) : null,
        resultHeight: resultBox ? Math.round(resultBox.height) : null,
        viewportInsideResults: !!(viewportBox && resultBox
          && viewportBox.left >= resultBox.left - 1 && viewportBox.right <= resultBox.right + 1),
      };
    });

    const expectedFull = width <= 960 || width > 1350;
    const failures = [];
    if (welcome.bodyOverflowX) failures.push("welcome horizontal overflow");
    if (welcome.mastheadOverflowX) failures.push("header horizontal overflow");
    if (welcome.fullVisible !== expectedFull || welcome.shortVisible === expectedFull) failures.push("wrong Tech Docs label");
    if (!welcome.bannerInsideViewport) failures.push("welcome banner outside viewport");
    if (calculator.bodyOverflowX) failures.push("calculator horizontal overflow");
    if (!calculator.viewportInsideResults) failures.push("visualization outside results card");
    if (width > 960 && calculator.panelExtraBottom > 40) failures.push("excess input-panel whitespace");

    if (failures.length) {
      await page.screenshot({ path: path.join(outputDir, `${width}x${height}.png`), fullPage: true });
    }
    results.push({ viewport: `${width}x${height}`, welcome, calculator, failures });
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(outputDir, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (results.some((entry) => entry.failures.length)) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
