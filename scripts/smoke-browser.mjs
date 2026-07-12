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

  const coinSyncRegression = await page.evaluate(() => {
    const key = "sc3_soul_coins_v1";
    const original = localStorage.getItem(key);
    localStorage.setItem(key, "100");
    importPlayerProgress({ soulCoins:50, migrations:{ petRetroDeduct20260708:"2026-07-08T00:00:00.000Z" } }, { silent:true });
    const staleMarkerBalance = soulCoins();
    importPlayerProgress({ soulCoins:50, retroPetDeducted:50, migrations:{ petRetroDeduct20260708:"2026-07-08T00:00:00.000Z" } }, { silent:true });
    const activeDeductionBalance = soulCoins();
    if(original == null) localStorage.removeItem(key); else localStorage.setItem(key, original);
    return { staleMarkerBalance, activeDeductionBalance };
  });
  if (coinSyncRegression.staleMarkerBalance !== 100 || coinSyncRegression.activeDeductionBalance !== 50) {
    throw new Error(`Soul Coin sync regression: ${JSON.stringify(coinSyncRegression)}`);
  }
  const runCoinRewards = await page.evaluate(() => {
    const previous = { gameTime, mapStage, won, runBossKills, runMinibossKills, pactMultiplier };
    gameTime=600; mapStage=3; won=true; runBossKills=3; runMinibossKills=2; pactMultiplier=1;
    const fullClear=calcRunSoulCoins();
    gameTime=120; runBossKills=0; runMinibossKills=0;
    const fastClear=calcRunSoulCoins();
    gameTime=previous.gameTime; mapStage=previous.mapStage; won=previous.won; runBossKills=previous.runBossKills; runMinibossKills=previous.runMinibossKills; pactMultiplier=previous.pactMultiplier;
    return { fullClear:fullClear.total, fastClear:fastClear.total };
  });
  if (runCoinRewards.fullClear !== 99 || runCoinRewards.fastClear !== 50) {
    throw new Error(`Soul Coin reward calculation changed: ${JSON.stringify(runCoinRewards)}`);
  }
  const mailboxRegression = await page.evaluate(() => {
    const keys = [SOUL_COINS_STORAGE_KEY, SOUL_COIN_COMPENSATION_STORAGE_KEY, MAILBOX_STORAGE_KEY];
    const original = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
    localStorage.setItem(SOUL_COINS_STORAGE_KEY, "100");
    localStorage.removeItem(SOUL_COIN_COMPENSATION_STORAGE_KEY);
    localStorage.setItem(MAILBOX_STORAGE_KEY, '{"read":{},"claimed":{}}');
    const initialPending = mailboxPendingCount();
    selectMailbox("update_20260710_release");
    const newsPending = mailboxPendingCount();
    const firstClaim = claimMailboxReward("compensation_20260709");
    const afterFirst = soulCoins();
    const secondClaim = claimMailboxReward("compensation_20260709");
    const afterSecond = soulCoins();
    const claimed = !!loadMailboxState().claimed.compensation_20260709;
    const newClaim = claimMailboxReward("compensation_20260710");
    const afterNewClaim = soulCoins();
    const repeatedNewClaim = claimMailboxReward("compensation_20260710");
    const afterRepeatedNewClaim = soulCoins();
    const newClaimed = !!loadMailboxState().claimed.compensation_20260710;
    localStorage.setItem(MAILBOX_STORAGE_KEY, '{"read":{},"claimed":{}}');
    const legacyClaimed = !!loadMailboxState().claimed.compensation_20260709;
    for (const key of keys) {
      if (original[key] == null) localStorage.removeItem(key);
      else localStorage.setItem(key, original[key]);
    }
    updateMailboxBadge();
    return { initialPending, newsPending, firstClaim, secondClaim, afterFirst, afterSecond, claimed, newClaim, afterNewClaim, repeatedNewClaim, afterRepeatedNewClaim, newClaimed, legacyClaimed };
  });
  if (
    mailboxRegression.initialPending !== 3 ||
    mailboxRegression.newsPending !== 2 ||
    mailboxRegression.firstClaim !== true ||
    mailboxRegression.secondClaim !== false ||
    mailboxRegression.afterFirst !== 1100 ||
    mailboxRegression.afterSecond !== 1100 ||
    mailboxRegression.newClaim !== true ||
    mailboxRegression.afterNewClaim !== 2100 ||
    mailboxRegression.repeatedNewClaim !== false ||
    mailboxRegression.afterRepeatedNewClaim !== 2100 ||
    !mailboxRegression.newClaimed ||
    !mailboxRegression.claimed ||
    !mailboxRegression.legacyClaimed
  ) {
    throw new Error(`Mailbox reward regression: ${JSON.stringify(mailboxRegression)}`);
  }

  const bootTextures = await page.evaluate(() => ({
    map2: !!tex.map2_ground,
    map3: !!tex.map3_ground,
    deferredHero: !!tex.char_sorceress_walk,
    deferredEnemy: !!tex.enemy_bog_fiend_walk,
  }));
  if (Object.values(bootTextures).some(Boolean)) {
    throw new Error(`Lazy textures loaded during boot: ${JSON.stringify(bootTextures)}`);
  }
  const enemyTextureRegression = await page.evaluate(async () => {
    const fallback = entitySprite("enemy_bog_fiend", 1.8);
    scene.add(fallback.spr);
    const fallbackVisible = !!(fallback.spr && fallback.spr.material && fallback.spr.material.map);
    const fallbackUsesBootArt = fallback.spr.material.map !== tex.enemy_bog_fiend;
    const room = CHALLENGE_ROOMS.find(item => item.id === "soul_trial");
    const roomKeys = challengeRoomTextureKeys(room, 2);
    await prefetchTextureKeys(roomKeys);
    await Promise.resolve();
    const result = {
      fallbackVisible,
      fallbackUsesBootArt,
      fallbackHydrated: fallback.spr.material.map === tex.enemy_bog_fiend,
      includesCrossTier: roomKeys.includes("enemy_void_walker_8dir"),
      crossTierLoaded: !!tex.enemy_void_walker_8dir,
      deferredLoaded: !!tex.enemy_bog_fiend_8dir,
    };
    scene.remove(fallback.spr);
    return result;
  });
  if (Object.values(enemyTextureRegression).some(value => value !== true)) {
    throw new Error(`Enemy texture regression: ${JSON.stringify(enemyTextureRegression)}`);
  }
  const enemyVisualRoster = await page.evaluate(async () => {
    await prefetchTextureKeys(ENEMY_TYPES.flatMap(enemy => unitTextureKeys(enemy.sprite)));
    const missing = [];
    for (const enemy of ENEMY_TYPES) {
      const visual = entitySprite(enemy.sprite, enemy.h);
      const map = visual.spr && visual.spr.material && visual.spr.material.map;
      if (!map || !map.image || !map.image.width || !map.image.height) missing.push(enemy.name);
    }
    return { total: ENEMY_TYPES.length, missing };
  });
  if (enemyVisualRoster.total !== 28 || enemyVisualRoster.missing.length) {
    throw new Error(`Enemy visual roster failed: ${JSON.stringify(enemyVisualRoster)}`);
  }
  const scenePropRegression = await page.evaluate(async () => {
    const prop = billboard("map3_obelisk", 2.9);
    scene.add(prop);
    const fallbackVisible = !!prop.material.map;
    const fallbackBeforeLoad = prop.material.map !== tex.map3_obelisk;
    await prefetchTextureKeys(["map3_obelisk"]);
    await Promise.resolve();
    const hydrated = prop.material.map === tex.map3_obelisk;
    const challenge = billboard("prop_challenge_merchant_1", 2.1);
    scene.add(challenge);
    const challengeFallbackVisible = !!challenge.material.map;
    await prefetchTextureKeys(["prop_challenge_merchant_1"]);
    await Promise.resolve();
    const challengeHydrated = challenge.material.map === tex.prop_challenge_merchant_1;
    scene.remove(prop);
    scene.remove(challenge);
    return { fallbackVisible, fallbackBeforeLoad, hydrated, challengeFallbackVisible, challengeHydrated };
  });
  if (Object.values(scenePropRegression).some(value => value !== true)) {
    throw new Error(`Scene prop texture regression: ${JSON.stringify(scenePropRegression)}`);
  }
  const selectedHeroReady = await page.evaluate(async () => {
    await prefetchTextureKeys(characterTextureKeys("sorceress"));
    return !!tex.char_sorceress_walk && !!tex.char_sorceress_idle;
  });
  if (!selectedHeroReady) throw new Error("Selected character animation textures did not lazy-load");

  const identityVisible = await page.locator("#identityOverlay").isVisible().catch(() => false);
  if (identityVisible) {
    await page.locator("#guestchoice").click();
  }

  await page.locator("#guestchoice").click().catch(() => {});
  await page.evaluate(() => openGuide("pets"));
  await page.locator("#guide").waitFor({ state: "visible", timeout: 5000 });
  if (await page.locator("#guide [data-pet-buy], #guide [data-pet-box-open]").count()) throw new Error("Pet Guide still contains purchase controls");
  if (await page.locator("#guide [data-open-soul-market='pets']").count() !== 1) throw new Error("Pet Guide is missing its Soul Market link");
  await page.evaluate(() => openGuide("divine"));
  if (await page.locator("#guide .guidegrid.divine .guidecard").count() !== 10) throw new Error("Divine Guide does not list all ten spirits");
  if (await page.locator("#guide [data-open-soul-market='divine']").count() !== 1) throw new Error("Divine Guide is missing its market link");
  await page.evaluate(() => closeGuide());
  const marketButton = page.locator("#marketbtn");
  await marketButton.waitFor({ state: "visible", timeout: 8000 });
  await marketButton.click();
  await page.locator("#soulmarket").waitFor({ state: "visible", timeout: 5000 });
  await page.locator("#marketclose").click({timeout:5000});
  await page.locator("#soulmarket").waitFor({ state: "hidden", timeout: 5000 });
  const play = page.locator("#playbtn");
  await play.waitFor({ state: "visible", timeout: 12000 });
  await play.click();
  await page.locator("#runsetup").waitFor({ state: "visible", timeout: 8000 });
  if (await page.locator("#soulmarket").isVisible()) throw new Error("Soul Market opened from the Start button");
  await page.locator("#runstartconfigured").click();
  const firstHelp = page.locator("#firsthelp");
  if (await firstHelp.isVisible().catch(() => false)) await page.locator("#firsthelpstart").click();

  await page.waitForTimeout(2500);
  await page.waitForSelector("#c", { state: "visible", timeout: 5000 });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Browser smoke passed on ${baseUrl}`);
} finally {
  if (browser) await browser.close();
  server.kill();
  if (serverErrors.join("").trim()) process.stderr.write(serverErrors.join(""));
}
