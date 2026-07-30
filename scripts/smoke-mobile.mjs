import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(baseUrl) {
  const started = Date.now();
  while (Date.now() - started < 12000) {
    try {
      const response = await fetch(`${baseUrl}/version.json`, { cache: "no-store" });
      if (response.ok) return;
    } catch (_) {}
    await wait(250);
  }
  throw new Error("mobile smoke dev server did not start");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const { chromium } = await import("playwright-core");
const version = JSON.parse(await readFile("version.json", "utf8")).version;
const port = await freePort();
const server = spawn(process.execPath, ["scripts/dev-server.mjs", String(port)], {
  stdio: ["ignore", "ignore", "pipe"],
  windowsHide: true,
});
const serverErrors = [];
server.stderr.on("data", (chunk) => serverErrors.push(chunk.toString()));

let browser;
try {
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl);
  const executablePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  browser = await chromium.launch({ headless: true, executablePath });

  for (const profile of [
    { name: "portrait", width: 390, height: 844 },
    { name: "landscape", width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: profile.width, height: profile.height },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("Failed to load resource")) errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
    });
    await page.addInitScript((buildVersion) => {
      localStorage.setItem("sc3_howto_seen_v1", "1");
      localStorage.setItem("sc3_whats_new_seen_build_v1", buildVersion);
      localStorage.setItem("sc3_start_mode_v1", "guest");
      localStorage.setItem("sc3_player_name_v1", "Mobile Smoke");
      localStorage.setItem("sc3_run_setup_v1", JSON.stringify({
        difficulty: "normal",
        pacts: [],
        itemBans: [],
        challenge: "standard",
      }));
    }, version);
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.locator("#title").waitFor({ state: "visible", timeout: 15000 });

    if (profile.name === "portrait") {
      const rotateVisible = await page.locator("#rotate").isVisible();
      assert(rotateVisible, "portrait mobile view must show the rotate-device overlay");
      assert(errors.length === 0, `portrait mobile console errors: ${errors.join(" | ")}`);
      await page.close();
      continue;
    }

    const title = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      playVisible: !!document.querySelector("#playbtn")?.getClientRects().length,
    }));
    assert(!title.overflow, "landscape title screen overflows horizontally");
    assert(title.playVisible, "landscape title screen is missing the Play button");

    if (await page.locator("#authchoice").isVisible().catch(() => false)) {
      await page.locator("#guestchoice").click();
    }
    if (await page.locator("#playbtn").isDisabled()) {
      await page.evaluate(() => chooseGuestStart());
    }
    await page.locator("#playbtn").click();
    await page.locator("#runsetup").waitFor({ state: "visible", timeout: 8000 });
    const setup = await page.evaluate(() => {
      const panel = document.querySelector("#runsetup .runsetuppanel") || document.querySelector("#runsetup");
      const rect = panel.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        fitsWidth: rect.width <= innerWidth + 1,
        startVisible: !!document.querySelector("#runstartconfigured")?.getClientRects().length,
      };
    });
    assert(!setup.overflow && setup.fitsWidth, "mobile Run Setup overflows the landscape viewport");
    assert(setup.startVisible, "mobile Run Setup is missing its Start button");

    await page.locator("#runstartconfigured").click();
    if (await page.locator("#firsthelp").isVisible().catch(() => false)) {
      await page.locator("#firsthelpstart").click();
    }
    await page.locator("#c").waitFor({ state: "visible", timeout: 12000 });
    await page.waitForTimeout(800);
    await page.locator("#pausebtn").click();
    await page.locator("#pause").waitFor({ state: "visible", timeout: 5000 });
    const pause = await page.evaluate(() => {
      const panel = document.querySelector("#pause .pausepanel") || document.querySelector("#pause");
      const rect = panel.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        fits: rect.width <= innerWidth + 1 && rect.height <= innerHeight + 1,
        resumeVisible: !!document.querySelector("#resumebtn")?.getClientRects().length,
      };
    });
    assert(!pause.overflow && pause.fits, "mobile Pause menu does not fit the landscape viewport");
    assert(pause.resumeVisible, "mobile Pause menu is missing Resume");
    assert(errors.length === 0, `landscape mobile console errors: ${errors.join(" | ")}`);
    await page.close();
  }

  console.log("Mobile smoke passed: portrait rotation, landscape title, Run Setup, gameplay, and Pause.");
} finally {
  if (browser) await browser.close();
  server.kill();
  if (serverErrors.length) process.stderr.write(serverErrors.join(""));
}
