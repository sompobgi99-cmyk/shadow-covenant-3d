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
  for (let i = 0; i < 48; i++) {
    try {
      if ((await fetch(`${baseUrl}/version.json`, { cache: "no-store" })).ok) return;
    } catch (_) {}
    await wait(250);
  }
  throw new Error("dist server did not start");
}

const { chromium } = await import("playwright-core");
const release = JSON.parse(await readFile("dist/version.json", "utf8")).version;
const port = await freePort();
const server = spawn(process.execPath, ["scripts/dev-server.mjs", String(port)], {
  env: { ...process.env, STATIC_ROOT: "dist" },
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
  const failures = [];
  const assetRequests = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.startsWith(baseUrl) && response.status() >= 400) failures.push(`${response.status()} ${url}`);
    if (url.includes("/assets/")) assetRequests.push(url);
  });
  page.on("pageerror", (error) => failures.push(error.message));
  await page.addInitScript((version) => {
    localStorage.setItem("sc3_howto_seen_v1", "1");
    localStorage.setItem("sc3_whats_new_seen_build_v1", version);
    localStorage.setItem("sc3_start_mode_v1", "guest");
    localStorage.setItem("sc3_player_name_v1", "Release Smoke");
  }, release);
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("#title").waitFor({ state: "visible", timeout: 15000 });
  const titleBackground = await page.evaluate(() => getComputedStyle(document.querySelector("#title")).backgroundImage);

  if (failures.length) throw new Error(`dist requests failed: ${failures.join(" | ")}`);
  if (!assetRequests.length) throw new Error("dist smoke observed no asset requests");
  if (!assetRequests.every((url) => url.includes(`scv=${encodeURIComponent(release)}`))) {
    const stale = assetRequests.filter((url) => !url.includes(`scv=${encodeURIComponent(release)}`)).slice(0, 5);
    throw new Error(`dist assets missing release cache key: ${stale.join(" | ")}`);
  }
  if (!titleBackground.includes("title-covenant.webp")) throw new Error("dist title background did not load");
  console.log(`Dist smoke passed on ${baseUrl} (${release}, ${assetRequests.length} asset requests).`);
} finally {
  if (browser) await browser.close();
  server.kill();
  if (serverErrors.length) process.stderr.write(serverErrors.join(""));
}
