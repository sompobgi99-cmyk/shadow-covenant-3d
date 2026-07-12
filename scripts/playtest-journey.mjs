import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, readFile } from "node:fs/promises";

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

async function pressPattern(page, seconds) {
  const keys = ["KeyD", "KeyS", "KeyA", "KeyW"];
  const started = Date.now();
  let i = 0;
  while (Date.now() - started < seconds * 1000) {
    const key = keys[i++ % keys.length];
    await page.keyboard.down(key);
    await page.waitForTimeout(850);
    await page.keyboard.up(key);
    await page.waitForTimeout(120);
  }
}

const { chromium } = await import("playwright-core");
const version = JSON.parse(await readFile("version.json", "utf8")).version;
const stabilitySeconds = Math.max(0, Number(process.env.JOURNEY_STABILITY_SECONDS || 24) || 0);
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
  await mkdir("outputs/playtest", { recursive: true });
  const executablePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.addInitScript((buildVersion) => {
    localStorage.setItem("sc3_howto_seen_v1", "1");
    localStorage.setItem("sc3_whats_new_seen_build_v1", buildVersion);
    localStorage.setItem("sc3_start_mode_v1", "guest");
    localStorage.setItem("sc3_player_name_v1", "Journey");
    localStorage.setItem("sc3_lang_v1", "th");
  }, version);

  await page.goto(`${baseUrl}/?journey=1`, { waitUntil: "networkidle" });
  await page.waitForSelector("#title", { state: "visible", timeout: 15000 });
  await page.locator("#guestchoice").click().catch(() => {});
  await page.locator("#playbtn").click();
  await page.locator("#runsetup").waitFor({ state: "visible", timeout: 8000 });
  await page.locator("#runstartconfigured").click();
  const firstHelp = page.locator("#firsthelp");
  if (await firstHelp.isVisible().catch(() => false)) await page.locator("#firsthelpstart").click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "outputs/playtest/01-map1.png" });

  await page.evaluate(() => {
    player.maxHp = 9999;
    player.hp = 9999;
    player.def = 999;
    player.regen = 999;
    player.dmgMul *= 6;
    player.rateMul *= 1.6;
    player.gold = 9999;
  });
  await pressPattern(page, 18);

  const map2 = await page.evaluate(async () => {
    await transitionToStage(2);
    return { mapStage, ground: !!tex.map2_ground, border: !!tex.map2_border_wall, enemies: enemies.length };
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "outputs/playtest/02-map2.png" });
  await pressPattern(page, 10);

  const challenge = await page.evaluate(async () => {
    await startChallengeRoom(CHALLENGE_ROOMS[0], 3);
    return { name: challengeRoom && challengeRoom.name, floor: !!tex.floor_challenge_treasure, props: challengeRoomVisuals.length };
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "outputs/playtest/03-challenge.png" });
  await pressPattern(page, 12);
  await page.evaluate(() => completeChallengeRoom(true));
  await page.waitForTimeout(1000);

  const map3 = await page.evaluate(async () => {
    await transitionToStage(3);
    return { mapStage, ground: !!tex.map3_ground, border: !!tex.map3_border_wall, boss: boss && boss.name, enemies: enemies.length };
  });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: "outputs/playtest/04-map3-boss.png" });
  await pressPattern(page, stabilitySeconds);

  const result = await page.evaluate(() => ({
    mapStage,
    challenge: challengeRoom && challengeRoom.name,
    boss: boss && boss.name,
    enemies: enemies.length,
    hp: player.hp,
    gameOver,
    won,
    lazyLoaded: {
      map2: !!tex.map2_ground,
      map3: !!tex.map3_ground,
      boss: !!tex.boss_overlord_8dir,
      pet: !!tex.pet_lumo_wisp_8dir,
    },
  }));

  if (errors.length) throw new Error(errors.join("\n"));
  if (!map2.ground || !map2.border) throw new Error(`Map 2 textures were not ready: ${JSON.stringify(map2)}`);
  if (!challenge.floor || challenge.props < 3) throw new Error(`Challenge visuals did not load: ${JSON.stringify(challenge)}`);
  if (!map3.ground || !map3.border || !map3.boss) throw new Error(`Map 3/boss did not initialize: ${JSON.stringify(map3)}`);
  if (result.gameOver) throw new Error(`Player died during journey: ${JSON.stringify(result)}`);
  console.log(JSON.stringify({ baseUrl, version, map2, challenge, map3, result }, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill();
  if (serverErrors.join("").trim()) process.stderr.write(serverErrors.join(""));
}
