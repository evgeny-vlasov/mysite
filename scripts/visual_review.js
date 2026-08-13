"use strict";

const path = require("path");
const playwrightModule = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = require(playwrightModule);

const baseUrl = process.env.SITE_URL || "http://127.0.0.1:8765";
const outputDir = path.resolve(__dirname, "..", "artifacts", "visual-review");

async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];

  const desktop = await browser.newContext({ viewport: { width: 1366, height: 1280 }, deviceScaleFactor: 1 });
  const desktopPage = await desktop.newPage();
  desktopPage.on("console", (message) => {
    if (message.type() === "error") errors.push(`desktop console: ${message.text()}`);
  });
  desktopPage.on("pageerror", (error) => errors.push(`desktop page: ${error.message}`));
  await desktopPage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await assert((await desktopPage.locator("h1").count()) === 1, "Homepage must contain exactly one h1");
  await assert(await desktopPage.locator("img:not([alt])").count() === 0, "All images need alt attributes");
  await assert(await desktopPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "Desktop horizontal overflow detected");
  await desktopPage.keyboard.press("Tab");
  await assert(await desktopPage.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== "none"), "Keyboard focus is not visibly outlined");
  await desktopPage.evaluate(() => document.activeElement.blur());
  await desktopPage.screenshot({ path: path.join(outputDir, "desktop-hero.png"), fullPage: false });
  await desktopPage.locator("#along-the-way").scrollIntoViewIfNeeded();
  await desktopPage.screenshot({ path: path.join(outputDir, "desktop-story-credibility.png"), fullPage: false });

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mobilePage = await mobile.newPage();
  mobilePage.on("console", (message) => {
    if (message.type() === "error") errors.push(`mobile console: ${message.text()}`);
  });
  mobilePage.on("pageerror", (error) => errors.push(`mobile page: ${error.message}`));
  await mobilePage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await assert(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "390px horizontal overflow detected");
  await mobilePage.screenshot({ path: path.join(outputDir, "mobile-390-hero.png"), fullPage: false });

  const menuButton = mobilePage.locator("[data-menu-toggle]");
  await menuButton.click();
  await assert(await menuButton.getAttribute("aria-expanded") === "true", "Mobile menu did not open");
  await mobilePage.screenshot({ path: path.join(outputDir, "mobile-390-navigation.png"), fullPage: false });
  await mobilePage.keyboard.press("Escape");
  await assert(await menuButton.getAttribute("aria-expanded") === "false", "Escape did not close mobile menu");
  await menuButton.click();
  await mobilePage.locator("[data-site-nav] a[href='#teaching']").click();
  await assert(await menuButton.getAttribute("aria-expanded") === "false", "Navigation did not close mobile menu");

  await mobilePage.locator("#contact").scrollIntoViewIfNeeded();
  await mobilePage.screenshot({ path: path.join(outputDir, "mobile-390-contact.png"), fullPage: false });

  await mobilePage.setViewportSize({ width: 360, height: 800 });
  await mobilePage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await assert(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "360px horizontal overflow detected");

  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await assert(await reducedPage.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior === "auto"), "Reduced-motion scroll behavior is not disabled");

  const errorResponse = await desktop.request.get(`${baseUrl}/404.html`);
  await assert(errorResponse.ok(), "404.html did not load successfully");

  for (const [pagePath, fragment] of [["about.html", "#story"], ["contacts.html", "#contact"], ["cv.html", "#along-the-way"]]) {
    const response = await desktop.request.get(`${baseUrl}/${pagePath}`);
    await assert(response.ok(), `${pagePath} did not load successfully`);
    await desktopPage.goto(`${baseUrl}/${pagePath}`, { waitUntil: "networkidle" });
    await assert(desktopPage.url().endsWith(`/${fragment}`), `${pagePath} did not direct to ${fragment}`);
  }

  await reduced.close();
  await mobile.close();
  await desktop.close();
  await browser.close();

  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Visual QA passed: desktop 1366px; mobile 390px and 360px; menu, Escape, navigation, reduced motion, compatibility pages, console, and overflow.");
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
