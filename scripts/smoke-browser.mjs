import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl) {
  const started = Date.now();
  while (Date.now() - started < 12000) {
    try {
      const res = await fetch(`${baseUrl}/version.json`, { cache: "no-store" });
      if (res.ok) return;
    } catch (_) {}
    await wait(250);
  }
  throw new Error("dev server did not start");
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.addInitScript((buildVersion) => {
    localStorage.setItem("sc3_howto_seen_v1", "1");
    localStorage.setItem("sc3_whats_new_seen_build_v1", buildVersion);
    localStorage.setItem("sc3_start_mode_v1", "guest");
    localStorage.setItem("sc3_player_name_v1", "Smoke");
  }, version);
  await page.goto(`${baseUrl}/?smoke=1`, { waitUntil: "networkidle" });
  await page.waitForSelector("#title", { state: "visible", timeout: 15000 });

  const identityVisible = await page.locator("#identityOverlay").isVisible().catch(() => false);
  if (identityVisible) {
    await page.locator("#guestchoice").click();
  }

  await page.locator("#guestchoice").click().catch(() => {});
  const play = page.locator("#playbtn");
  await play.waitFor({ state: "visible", timeout: 12000 });
  await play.click();

  await page.locator("#nameconfirm").click();
  await page.locator(".ccard").first().click();
  const firstHelp = page.locator("#firsthelp");
  if (await firstHelp.isVisible().catch(() => false)) await page.locator("#firsthelpstart").click();
  await page.locator(".difficultycard.normal").click();

  await page.waitForTimeout(2500);
  await page.waitForSelector("#c", { state: "visible", timeout: 5000 });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Browser smoke passed on ${baseUrl}`);
} finally {
  if (browser) await browser.close();
  server.kill();
  if (serverErrors.join("").trim()) process.stderr.write(serverErrors.join(""));
}
