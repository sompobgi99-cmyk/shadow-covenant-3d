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
    localStorage.setItem("sc3_run_setup_v1", JSON.stringify({difficulty:"normal",pacts:[],itemBans:[],challenge:"standard"}));
  }, version);
  await page.goto(`${baseUrl}/?smoke=1`, { waitUntil: "networkidle" });
  await page.waitForSelector("#title", { state: "visible", timeout: 15000 });

  const roadmapSystemsRegression = await page.evaluate(() => {
    const archivedDaily=challengeConfig('daily'),weekly=challengeConfig('weekly');
    const challenge={
      dailyDisabled:archivedDaily.mode==='standard'&&archivedDaily.rules.length===0,
      weeklyRules:weekly.rules.length,
      weeklyScore:weekly.scoreMul,
    };
    setActiveChallengeMode('weekly');
    challenge.weeklyArena=weeklyArenaActive()&&WEEKLY_ARENA.stage===4&&WEEKLY_ARENA.minibossAt===240&&WEEKLY_ARENA.duoAt===480&&WEEKLY_ARENA.overtimeAt===600&&WEEKLY_ARENA.bossAt===720;
    challenge.weeklyTheme=MAP_THEMES[4]&&MAP_THEMES[4].name==='Covenant Crucible';
    challenge.weeklyBoss=!!weeklyBossType();
    const weeklySaved={difficulty:activeDifficultyId,stage:mapStage,time:gameTime,stageStart:stageStartTime,pacts:activePactIds.slice()};
    setActiveDifficulty('hard');mapStage=4;stageStartTime=0;gameTime=0;setActivePacts(['blood_moon']);
    const tier0=[...new Set(enemyPool().map(e=>e.tier))];
    gameTime=300;const tier1=[...new Set(enemyPool().map(e=>e.tier))];
    gameTime=500;const tier2=[...new Set(enemyPool().map(e=>e.tier))];
    gameTime=600;const otStart=overtimeTier();
    gameTime=720;const otBoss=overtimeTier(),combatOt=otCombatPowerMul();
    challenge.weeklyBalance=stageHpMul()===1.7&&stageAtkMul()===1.25&&overtimeStep()===60&&otStart===2&&otBoss===4&&combatOt===2.5&&activePactIds.length===0&&tier0.join(',')==='0'&&tier1.join(',')==='0,1'&&tier2.join(',')==='0,1,2';
    activeDifficultyId=weeklySaved.difficulty;mapStage=weeklySaved.stage;gameTime=weeklySaved.time;stageStartTime=weeklySaved.stageStart;activePactIds=weeklySaved.pacts;pactMultiplier=calcPactMultiplier(activePactIds);
    const previousRequested=localCoopRequested;
    localCoopRequested=true;
    const created=initLocalCoop();
    const coop={enabled:LOCAL_COOP_ENABLED,created:!!created,hpScale:coopEnemyHpMul(),active:localCoopActive()};
    clearLocalCoop();localCoopRequested=previousRequested;
    setActiveChallengeMode('weekly');startChallengeRandom();const seededA=[Math.random(),Math.random()];stopChallengeRandom();startChallengeRandom();const seededB=[Math.random(),Math.random()];stopChallengeRandom();challenge.seeded=seededA.join(',')===seededB.join(',');
    const challengeRewardOriginal=localStorage.getItem(CHALLENGE_REWARD_KEY);
    localStorage.removeItem(CHALLENGE_REWARD_KEY);
    challenge.rewardImported=importChallengeRewardProgress({'weekly:2026-W29':'2026-07-14T01:00:00.000Z','invalid:key':'2026-07-14T01:00:00.000Z'});
    const rewardState=exportChallengeRewardProgress();
    challenge.rewardCount=Object.keys(rewardState).length;challenge.invalidRewardIgnored=!rewardState['invalid:key'];
    if(challengeRewardOriginal==null)localStorage.removeItem(CHALLENGE_REWARD_KEY);else localStorage.setItem(CHALLENGE_REWARD_KEY,challengeRewardOriginal);
    setActiveChallengeMode('standard');
    const savedItemBans=activeItemBanIds.slice();
    const itemBanCandidates=ITEM_BAN_RARITIES.flatMap(r=>ITEMS.filter(i=>i.rarity===r&&isItemUnlocked(i.id)).slice(0,3).map(i=>i.id));
    const sanitizedItemBans=sanitizeItemBanIds(itemBanCandidates);
    setActiveItemBans(sanitizedItemBans,'standard');
    const itemBanCounts=Object.fromEntries(ITEM_BAN_RARITIES.map(r=>[r,activeItemBanIds.filter(id=>(ITEMS.find(i=>i.id===id)||{}).rarity===r).length]));
    const standardPoolsClean=ITEM_BAN_RARITIES.every(r=>availableItemPool(r).every(i=>!activeItemBanIds.includes(i.id))&&availableItemPool(r).length>=2);
    setActiveItemBans(sanitizedItemBans,'weekly');
    const weeklyItemBans=activeItemBanIds.length;
    activeItemBanIds=savedItemBans;
    renderRunSetup();
    const setup={challengeButtons:document.querySelectorAll('[data-run-challenge]').length,coopToggle:!!document.getElementById('runcooptoggle'),itemBanButton:!!document.querySelector('[data-run-picker="itemban"]'),itemBanCounts,itemBanLimits:Object.fromEntries(ITEM_BAN_RARITIES.map(r=>[r,itemBanLimit(r)])),standardPoolsClean,weeklyItemBans};
    const arbalistType=ENEMY_TYPES.find(e=>e.name==='Grave Arbalist'),fakeArbalist={name:'Grave Arbalist',x:0,z:0,atk:13,atkCd:0};
    const shotCount=enemyShots.length;enemyShoot(fakeArbalist,1,0);const arbalistShot=enemyShots.pop();
    const arbalist={tier:arbalistType&&arbalistType.tier,behavior:behaviorFor('Grave Arbalist'),dirSheet:DIR_SHEETS.enemy_grave_arbalist&&DIR_SHEETS.enemy_grave_arbalist.key,shot:enemyShots.length===shotCount&&!!arbalistShot,arrowParts:arbalistShot&&arbalistShot.mesh.children.length,attackCd:fakeArbalist.atkCd};
    if(arbalistShot){scene.remove(arbalistShot.mesh);freeObj(arbalistShot.mesh);}
    const restoredRoles={spider:behaviorFor('Crypt Spider'),knight:behaviorFor('Cursed Knight'),robber:behaviorFor('Grave Robber'),robberChallengeOnly:CHALLENGE_ONLY_ENEMIES.has('Grave Robber')};
    return {challenge,coop,setup,arbalist,restoredRoles};
  });
  if(
    !roadmapSystemsRegression.challenge.dailyDisabled ||
    roadmapSystemsRegression.challenge.weeklyRules !== 3 ||
    roadmapSystemsRegression.challenge.weeklyScore !== 1.3 ||
    !roadmapSystemsRegression.challenge.weeklyArena ||
    !roadmapSystemsRegression.challenge.weeklyTheme ||
    !roadmapSystemsRegression.challenge.weeklyBoss ||
    !roadmapSystemsRegression.challenge.weeklyBalance ||
    roadmapSystemsRegression.coop.enabled ||
    roadmapSystemsRegression.coop.created ||
    roadmapSystemsRegression.coop.hpScale !== 1 ||
    roadmapSystemsRegression.coop.active ||
    !roadmapSystemsRegression.challenge.seeded ||
    !roadmapSystemsRegression.challenge.rewardImported ||
    roadmapSystemsRegression.challenge.rewardCount !== 1 ||
    !roadmapSystemsRegression.challenge.invalidRewardIgnored ||
    roadmapSystemsRegression.setup.challengeButtons !== 2 ||
    !roadmapSystemsRegression.setup.itemBanButton ||
    Object.keys(roadmapSystemsRegression.setup.itemBanLimits).some(r=>roadmapSystemsRegression.setup.itemBanCounts[r]!==roadmapSystemsRegression.setup.itemBanLimits[r]) ||
    !roadmapSystemsRegression.setup.standardPoolsClean ||
    roadmapSystemsRegression.setup.weeklyItemBans!==0 ||
    roadmapSystemsRegression.setup.coopToggle ||
    roadmapSystemsRegression.arbalist.tier!==0 ||
    roadmapSystemsRegression.arbalist.behavior!=='shooter' ||
    roadmapSystemsRegression.arbalist.dirSheet!=='enemy_grave_arbalist_8dir' ||
    !roadmapSystemsRegression.arbalist.shot ||
    roadmapSystemsRegression.arbalist.arrowParts<3 ||
    !(roadmapSystemsRegression.arbalist.attackCd>1.4) ||
    roadmapSystemsRegression.restoredRoles.spider!=='hazard' ||
    roadmapSystemsRegression.restoredRoles.knight!=='guardian' ||
    roadmapSystemsRegression.restoredRoles.robber!=='thief' ||
    !roadmapSystemsRegression.restoredRoles.robberChallengeOnly
  ) throw new Error(`Roadmap systems regression: ${JSON.stringify(roadmapSystemsRegression)}`);

  const localLeaderboardRegression = await page.evaluate(() => {
    const original = localStorage.getItem(LEADERBOARD_KEY);
    localStorage.setItem(LEADERBOARD_KEY, '{broken-json');
    const brokenRows = readLocalLeaderboard();
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify([null, 7, { score:42, difficultyId:'normal', runMode:'standard' }]));
    const cleanRows = readLocalLeaderboard();
    if(original==null) localStorage.removeItem(LEADERBOARD_KEY); else localStorage.setItem(LEADERBOARD_KEY,original);
    return { brokenRows:brokenRows.length, cleanRows:cleanRows.length, score:cleanRows[0]&&cleanRows[0].score };
  });
  if(localLeaderboardRegression.brokenRows!==0 || localLeaderboardRegression.cleanRows!==1 || localLeaderboardRegression.score!==42){
    throw new Error(`Local leaderboard recovery regression: ${JSON.stringify(localLeaderboardRegression)}`);
  }

  const relicLocalizationRegression = await page.evaluate(() => {
    const original=localStorage.getItem(LANG_STORAGE_KEY);
    const anvil=RELICS.find(r=>r.id==='ancient_anvil');
    localStorage.setItem(LANG_STORAGE_KEY,'th'); const th=relicDesc(anvil);
    localStorage.setItem(LANG_STORAGE_KEY,'en'); const en=relicDesc(anvil);
    if(original==null)localStorage.removeItem(LANG_STORAGE_KEY);else localStorage.setItem(LANG_STORAGE_KEY,original);
    return {th,en};
  });
  if(!relicLocalizationRegression.th.includes('Tome 2') || !relicLocalizationRegression.en.includes('2 Tome')){
    throw new Error(`Relic localization regression: ${JSON.stringify(relicLocalizationRegression)}`);
  }

  const rankingRetryRegression = await page.evaluate(async () => {
    const queueKey = "sc3_pending_online_scores_v1";
    const originalQueue = localStorage.getItem(queueKey);
    const originalFetch = window.fetch;
    localStorage.removeItem(queueKey);
    let attempts = 0;
    window.fetch = async (_input, init = {}) => {
      if (String(init.method || "GET").toUpperCase() !== "POST") {
        return new Response(JSON.stringify({ rows:[] }), {
          status:200,
          headers:{ "Content-Type":"application/json" },
        });
      }
      attempts++;
      if (attempts === 1) throw new TypeError("Failed to fetch");
      return new Response(JSON.stringify({ ok:true, verified:false }), {
        status:200,
        headers:{ "Content-Type":"application/json" },
      });
    };
    const entry = {
      run_id:"smoke-ranking-retry",
      name:"Smoke",
      country_code:"TH",
      character:"Paladin",
      score:250000,
      scoreBeforePenalty:250000,
      kills:120,
      time:600,
      won:false,
      level:20,
      stage:2,
      damage:50,
      items:5,
      difficultyId:"normal",
      difficultyName:"Normal",
      difficultyMultiplier:1,
      pactIds:[],
      pactMultiplier:1,
      build:window.SHADOW_BUILD_VERSION,
    };
    let queuedError = false;
    try { await saveOnlineScore(entry); }
    catch (error) { queuedError = !!error.queued; }
    const pendingAfterFailure = JSON.parse(localStorage.getItem(queueKey) || "[]").length;
    const remainingAfterRetry = await flushPendingOnlineScores();
    const pendingAfterRetry = JSON.parse(localStorage.getItem(queueKey) || "[]").length;
    window.fetch = originalFetch;
    if (originalQueue == null) localStorage.removeItem(queueKey);
    else localStorage.setItem(queueKey, originalQueue);
    return { attempts, queuedError, pendingAfterFailure, remainingAfterRetry, pendingAfterRetry };
  });
  if (
    rankingRetryRegression.attempts !== 2 ||
    !rankingRetryRegression.queuedError ||
    rankingRetryRegression.pendingAfterFailure !== 1 ||
    rankingRetryRegression.remainingAfterRetry !== 0 ||
    rankingRetryRegression.pendingAfterRetry !== 0
  ) {
    throw new Error(`Ranking retry regression: ${JSON.stringify(rankingRetryRegression)}`);
  }

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
  const characterUnlockSyncRegression = await page.evaluate(() => {
    const original = localStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
    achievementStateCache = { done:{} };
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(achievementStateCache));
    const imported = importAchievementProgress({
      bamboo_craving:"2026-07-14T00:00:00.000Z",
      cursed_eye_trial:"2026-07-14T00:00:00.000Z",
    }, { silent:true });
    const result = {
      imported:imported.map(achievement=>achievement.id).sort(),
      bamboo:isCharacterUnlocked("bamboo_man"),
      kuro:isCharacterUnlocked("kuro_raijin"),
    };
    if(original == null) localStorage.removeItem(ACHIEVEMENT_STORAGE_KEY);
    else localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, original);
    achievementStateCache = null;
    return result;
  });
  if (
    characterUnlockSyncRegression.imported.join(",") !== "bamboo_craving,cursed_eye_trial" ||
    !characterUnlockSyncRegression.bamboo ||
    !characterUnlockSyncRegression.kuro
  ) {
    throw new Error(`Character unlock sync regression: ${JSON.stringify(characterUnlockSyncRegression)}`);
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
  const divineScalingRegression = await page.evaluate(() => {
    const previous = { mapStage, gameTime, stageStartTime, finalBossKilledAt };
    gameTime=0; stageStartTime=0; finalBossKilledAt=null;
    mapStage=1; const map1=divineOfferingDamageScale('astra',{isBoss:false});
    mapStage=2; const map2=divineOfferingDamageScale('nhal',{isBoss:false});
    mapStage=3; const map3VeyraBoss=divineOfferingDamageScale('veyra',{isBoss:true});
    const defensive=divineOfferingDamageScale('tharos',{isBoss:true});
    mapStage=1; gameTime=600; const overtime=divineOfferingDamageScale('astra',{isBoss:false});
    mapStage=previous.mapStage; gameTime=previous.gameTime; stageStartTime=previous.stageStartTime; finalBossKilledAt=previous.finalBossKilledAt;
    return { map1, map2, map3VeyraBoss, defensive, overtime };
  });
  if (
    divineScalingRegression.map1 !== 1 ||
    divineScalingRegression.map2 !== 1.4 ||
    divineScalingRegression.map3VeyraBoss !== 3 ||
    divineScalingRegression.defensive !== 1 ||
    Math.abs(divineScalingRegression.overtime-Math.sqrt(2)) > 0.000001
  ) {
    throw new Error(`Divine scaling regression: ${JSON.stringify(divineScalingRegression)}`);
  }
  const pickupVisualRegression = await page.evaluate(() => {
    ensurePickupIconTexture("icon_xp", "xp");
    ensurePickupIconTexture("icon_gold", "gold");
    const xp = tex.icon_xp;
    const gold = tex.icon_gold;
    const xpPixels = xp.image.getContext("2d").getImageData(0, 0, xp.image.width, xp.image.height).data;
    const goldPixels = gold.image.getContext("2d").getImageData(0, 0, gold.image.width, gold.image.height).data;
    let differentPixels = 0;
    for (let i = 0; i < xpPixels.length; i += 4) {
      if (xpPixels[i] !== goldPixels[i] || xpPixels[i + 1] !== goldPixels[i + 1] || xpPixels[i + 2] !== goldPixels[i + 2] || xpPixels[i + 3] !== goldPixels[i + 3]) differentPixels++;
    }
    return { xpWidth:xp.image.width, goldWidth:gold.image.width, xpV2:!!xp._pickupIconV2, goldV2:!!gold._pickupIconV2, differentPixels };
  });
  if (pickupVisualRegression.xpWidth !== 24 || pickupVisualRegression.goldWidth !== 24 || !pickupVisualRegression.xpV2 || !pickupVisualRegression.goldV2 || pickupVisualRegression.differentPixels < 80) {
    throw new Error(`Pickup visual regression: ${JSON.stringify(pickupVisualRegression)}`);
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
    const deleteUnclaimed = deleteMailboxMessage("compensation_20260712");
    const latestClaim = claimMailboxReward("compensation_20260712");
    const afterLatestClaim = soulCoins();
    const repeatedLatestClaim = claimMailboxReward("compensation_20260712");
    const afterRepeatedLatestClaim = soulCoins();
    const latestClaimed = !!loadMailboxState().claimed.compensation_20260712;
    const previousConfirm=window.confirm;
    window.confirm=()=>true;
    const deleteClaimed = deleteMailboxMessage("compensation_20260712");
    window.confirm=previousConfirm;
    const latestDeleted = !!loadMailboxState().deleted.compensation_20260712;
    const latestVisible = visibleMailboxMessages(loadMailboxState()).some(mail=>mail.id==='compensation_20260712');
    localStorage.setItem(MAILBOX_STORAGE_KEY, '{"read":{},"claimed":{}}');
    const legacyClaimed = !!loadMailboxState().claimed.compensation_20260709;
    for (const key of keys) {
      if (original[key] == null) localStorage.removeItem(key);
      else localStorage.setItem(key, original[key]);
    }
    updateMailboxBadge();
    return { initialPending, newsPending, firstClaim, secondClaim, afterFirst, afterSecond, claimed, newClaim, afterNewClaim, repeatedNewClaim, afterRepeatedNewClaim, newClaimed, latestClaim, afterLatestClaim, repeatedLatestClaim, afterRepeatedLatestClaim, latestClaimed, deleteUnclaimed, deleteClaimed, latestDeleted, latestVisible, legacyClaimed };
  });
  if (
    mailboxRegression.initialPending !== 4 ||
    mailboxRegression.newsPending !== 3 ||
    mailboxRegression.firstClaim !== true ||
    mailboxRegression.secondClaim !== false ||
    mailboxRegression.afterFirst !== 1100 ||
    mailboxRegression.afterSecond !== 1100 ||
    mailboxRegression.newClaim !== true ||
    mailboxRegression.afterNewClaim !== 2100 ||
    mailboxRegression.repeatedNewClaim !== false ||
    mailboxRegression.afterRepeatedNewClaim !== 2100 ||
    mailboxRegression.latestClaim !== true ||
    mailboxRegression.afterLatestClaim !== 3100 ||
    mailboxRegression.repeatedLatestClaim !== false ||
    mailboxRegression.afterRepeatedLatestClaim !== 3100 ||
    !mailboxRegression.latestClaimed ||
    mailboxRegression.deleteUnclaimed !== false ||
    mailboxRegression.deleteClaimed !== true ||
    !mailboxRegression.latestDeleted || mailboxRegression.latestVisible ||
    !mailboxRegression.newClaimed ||
    !mailboxRegression.claimed ||
    !mailboxRegression.legacyClaimed
  ) {
    throw new Error(`Mailbox reward regression: ${JSON.stringify(mailboxRegression)}`);
  }

  const bootTextures = await page.evaluate(() => ({
    map2: !!tex.map2_ground,
    map3: !!tex.map3_ground,
    weekly: !!tex.weekly_ground,
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
  if (enemyVisualRoster.total !== 32 || enemyVisualRoster.missing.length) {
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
  await page.evaluate(() => openGuide("items"));
  await page.locator("#guide").waitFor({ state: "visible", timeout: 5000 });
  if (!(await page.locator("#guide").innerText()).includes("Item Ban ก่อนเริ่มรัน")) throw new Error("Item Guide is missing Item Ban rules");
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
  if (await page.locator("#markettabs [data-market-tab]").count() !== 2) throw new Error("Soul Market should have exactly two tabs");
  const petOdds = await page.locator(".marketpetodds").innerText();
  if (!petOdds.includes("0.5%") || !petOdds.includes("5%") || !petOdds.includes("94.5%")) throw new Error("Pet Box odds are missing from the Pet tab");
  await page.locator("[data-market-tab='divine']").click();
  if (await page.locator(".marketgod").count() !== 10) throw new Error("Soul Market does not list all Divine Spirits");
  await page.locator("[data-market-divine-detail='astra']").click();
  await page.locator("#divinemarketdetail").waitFor({ state: "visible", timeout: 5000 });
  const divineDetailText = await page.locator("#divinemarketdetail").innerText();
  if (!divineDetailText.includes("Cooldown") || !divineDetailText.includes("1,500")) throw new Error("Locked Divine Spirit details are incomplete");
  await page.locator(".divinedetailclose").click();
  await page.locator("#marketclose").click({timeout:5000});
  await page.locator("#soulmarket").waitFor({ state: "hidden", timeout: 5000 });
  const play = page.locator("#playbtn");
  await play.waitFor({ state: "visible", timeout: 12000 });
  await play.click();
  await page.locator("#runsetup").waitFor({ state: "visible", timeout: 8000 });
  if (await page.locator("#soulmarket").isVisible()) throw new Error("Soul Market opened from the Start button");
  await page.locator('[data-run-picker="itemban"]').click();
  await page.locator('.itembanpicker').waitFor({state:'visible',timeout:5000});
  if(await page.locator('[data-itemban-rarity]').count()!==4) throw new Error('Item Ban picker must show four rarity tabs');
  const commonBanCards=page.locator('[data-itemban-id]');
  if(await commonBanCards.count()<6) throw new Error('Item Ban picker has too few Common items');
  await commonBanCards.nth(0).click();await commonBanCards.nth(1).click();await commonBanCards.nth(2).click();
  if(await page.locator('.runitembancard.selected').count()!==2) throw new Error('Item Ban rarity cap is not enforced at two items');
  await page.locator('#runpickerclose').click();
  if(!(await page.locator('.runsummarytext').innerText()).includes('Item Ban 2/')) throw new Error('Run summary does not show selected Item Bans');
  await page.locator("#runstartconfigured").click();
  const firstHelp = page.locator("#firsthelp");
  if (await firstHelp.isVisible().catch(() => false)) await page.locator("#firsthelpstart").click();

  await page.waitForTimeout(2500);
  await page.waitForSelector("#c", { state: "visible", timeout: 5000 });
  const activeItemBanRegression=await page.evaluate(()=>({count:activeItemBanIds.length,persisted:(JSON.parse(localStorage.getItem(RUN_SETUP_STORAGE_KEY)||'{}').itemBans||[]).length,clean:ITEM_BAN_RARITIES.every(r=>availableItemPool(r).every(i=>!activeItemBanIds.includes(i.id)))}));
  if(activeItemBanRegression.count!==2||activeItemBanRegression.persisted!==2||!activeItemBanRegression.clean) throw new Error(`Active Item Ban regression: ${JSON.stringify(activeItemBanRegression)}`);
  const combatInsightRegression = await page.evaluate(() => {
    const savedStats = {
      def:player.def, armorMul:player.armorMul, critChance:player.critChance,
      critDmg:player.critDmg, dashCdMul:player.dashCdMul,
    };
    Object.assign(player,{ def:10, armorMul:1.2, critChance:1.15, critDmg:1.5, dashCdMul:0.5 });
    const stats=computedPlayerStats(player);
    pauseInfoTab='overview'; buildPauseInfo();
    const overviewCards=document.querySelectorAll('#pauseinfo .pausestatcard').length;
    const tabs=document.querySelectorAll('#pauseinfo [data-pause-tab]').length;
    pauseInfoTab='offense'; buildPauseInfo();
    const offenseCards=document.querySelectorAll('#pauseinfo .pausestatcard').length;
    pauseInfoTab='loadout'; buildPauseInfo();
    const loadoutVisible=!!document.querySelector('#pauseinfo .pausegrid');
    const weaponStatRows=document.querySelectorAll('#pauseinfo .pwm').length;
    pauseInfoTab='overview';
    Object.assign(player,savedStats);

    const savedRunStats=runStats;
    const savedTime=gameTime;
    const savedStage=mapStage;
    resetRunStats(); mapStage=2; gameTime=100;
    recordPlayerHit(10,{name:'Grave Arbalist'},'projectile');
    gameTime=102;
    recordPlayerHit(20,{name:'Mire Hexer'},'aoe');
    const savedHp=player.hp; player.hp=0; recordDeathCause(); player.hp=savedHp;
    const damageTypes={...runStats.damageTakenByType};
    const hitCount=runStats.playerHits.length;
    const deathStatsRecorded=!!runStats.deathStats;

    const savedDifficulty=activeDifficultyId;
    const savedChallenge=challengeRoom;
    activeDifficultyId='normal'; challengeRoom=null; gameTime=120;
    const fake={name:'Bog Fiend',hp:100,maxHp:100,atk:10,spd:1,xp:10,r:0.4,bw:1,bh:1,sh:{r:0.4},isBoss:false};
    const eliteId=applyEnemyEliteModifier(fake,null,'hulking');
    const elite={ id:eliteId, hp:fake.hp, atk:fake.atk, speed:fake.spd, xp:fake.xp, radius:fake.r, aura:!!fake.aura };
    if(fake.aura){ scene.remove(fake.aura); freeObj(fake.aura); }
    const eliteMatrix={};
    for(const id of Object.keys(ENEMY_ELITE_MODIFIERS)){
      const unit={name:'Bog Fiend',hp:100,maxHp:100,atk:10,spd:1,xp:10,r:0.4,bw:1,bh:1,sh:{r:0.4},isBoss:false};
      const applied=applyEnemyEliteModifier(unit,null,id);
      eliteMatrix[id]={applied,hp:unit.hp,atk:unit.atk,spd:unit.spd,xp:unit.xp,opacity:unit.spr&&unit.spr.material?unit.spr.material.opacity:null};
      if(unit.aura){ scene.remove(unit.aura); freeObj(unit.aura); }
    }
    activeDifficultyId=savedDifficulty; challengeRoom=savedChallenge;
    runStats=savedRunStats; gameTime=savedTime; mapStage=savedStage;
    const bossIdentity={
      lich:['necroticOrb','soulDrain'].every(id=>BOSS_SKILLS.boss_lich.includes(id)),
      reaper:BOSS_SKILLS.boss_reaper.includes('reaperClone'),
      wyrm:BOSS_SKILLS.boss_dragon.includes('wyrmDive'),
      allSkills:Object.values(BOSS_SKILLS).flat().every(id=>!!SK[id]),
    };
    const savedWeapons=player.weapons;
    const synergyMatrix={};
    for(const syn of WEAPON_SYNERGIES){
      player.weapons=syn.pair.map(key=>makeWeapon(key));
      synergyMatrix[syn.id]=hasWeaponSynergy(syn.id);
    }
    player.weapons=[makeWeapon('bolt')];
    const boltSolo=wstats('bolt',1);
    player.weapons.push(makeWeapon('arrow'));
    const boltPaired=wstats('bolt',1);
    player.weapons=[makeWeapon('boltX'),makeWeapon('arrowX')];
    const evolvedPair=hasWeaponSynergy('rangers_focus');
    player.weapons=savedWeapons;
    const synergyStats={speedRatio:boltPaired.speed/boltSolo.speed,pierceGain:boltPaired.pierce-boltSolo.pierce,evolvedPair};
    const savedScale={projScale:player.projScale,rangeMul:player.rangeMul,weapons:player.weapons};
    player.projScale=3; player.rangeMul=3; player.weapons=[];
    const sizeRangeStats={
      novaEvolutionTome:WEAPON_TYPES.nova.evolveTome,
      bolt:wstats('bolt',1),
      stab:wstats('toolstab',1),
      nova:wstats('nova',1),
      smite:wstats('smite',1),
      orbit:wstats('orbit',1),
      bomb:wstats('bouncebomb',1)
    };
    spawnProjectile(1,0,sizeRangeStats.bolt);
    const runtimeBolt=projectiles.pop();
    sizeRangeStats.runtimeBolt={scale:runtimeBolt.scale};
    scene.remove(runtimeBolt.mesh); freeObj(runtimeBolt.mesh);
    if(runtimeBolt.chargeMesh){scene.remove(runtimeBolt.chargeMesh);freeObj(runtimeBolt.chargeMesh);}
    spawnStabProjectile(1,0,sizeRangeStats.stab);
    const runtimeStab=projectiles.pop();
    sizeRangeStats.runtimeStab={scale:runtimeStab.scale,width:runtimeStab.width,hitRadius:runtimeStab.hitRadius};
    scene.remove(runtimeStab.mesh); freeObj(runtimeStab.mesh);
    if(runtimeStab.chargeMesh){scene.remove(runtimeStab.chargeMesh);freeObj(runtimeStab.chargeMesh);}
    player.projScale=savedScale.projScale; player.rangeMul=savedScale.rangeMul; player.weapons=savedScale.weapons;
    const shrineSaved={
      hp:player.hp,maxHp:player.maxHp,dmgMul:player.dmgMul,rateMul:player.rateMul,
      shrineEnemySpeedMul:player.shrineEnemySpeedMul,armorMul:player.armorMul,
      spd:player.spd,goldMul:player.goldMul,tomeCount:{...player.tomeCount}
    };
    player.maxHp=100; player.hp=100; player.dmgMul=1;
    const shrineSacrifice=resolveShrineEffect(0,{x:0,z:0},{});
    const sacrificeResult={id:shrineSacrifice,maxHp:player.maxHp,hp:player.hp,dmgMul:player.dmgMul};
    player.rateMul=1; player.shrineEnemySpeedMul=1;
    const baseEnemySpeed=enemySpeedMul();
    const shrineSpeed=resolveShrineEffect(2,{x:0,z:0},{});
    const speedResult={id:shrineSpeed,rateMul:player.rateMul,enemySpeedRatio:enemySpeedMul()/baseEnemySpeed};
    player.maxHp=100; player.hp=100; player.dmgMul=1; player.tomeCount={};
    const shrineCurse=resolveShrineEffect(3,{x:0,z:0},{curseIndex:0,tomeIndex:0});
    const curseResult={result:shrineCurse,maxHp:player.maxHp,might:player.tomeCount.might||0,dmgMul:player.dmgMul};
    Object.assign(player,shrineSaved,{tomeCount:shrineSaved.tomeCount});
    const archetypeCases={
      berserker:{hp:40,maxHp:100,dmgMul:2,weapons:[]},
      crimson_priest:{hp:200,maxHp:200,lifestealPct:0.20,weapons:[]},
      storm_caller:{hp:100,maxHp:100,critChance:0.50,weapons:[makeWeapon('lightning')]},
      juggernaut:{hp:100,maxHp:100,def:20,armorMul:1,weapons:[makeWeapon('orbit')]},
      shadow_dancer:{hp:100,maxHp:100,evade:0.30,dashCdMul:0.50,weapons:[]},
      void_mage:{hp:100,maxHp:100,weapons:[makeWeapon('boltX'),makeWeapon('arrowX'),makeWeapon('novaX')]}
    };
    const archetypeMatrix={};
    for(const [id,p] of Object.entries(archetypeCases)) archetypeMatrix[id]=hasBuildArchetype(id,p);
    const savedWorldEvent=activeWorldEvent;
    activeWorldEvent={id:'blood_moon',t:10};
    const worldEvent={power:worldEventEnemyPowerMul(),xp:worldEventXpMul()};
    activeWorldEvent=savedWorldEvent;
    return { stats, overviewCards, tabs, offenseCards, loadoutVisible, weaponStatRows, damageTypes, hitCount, deathStatsRecorded, elite, eliteMatrix, bossIdentity, synergyMatrix, synergyStats, sizeRangeStats, shrine:{sacrificeResult,speedResult,curseResult}, archetypeMatrix, worldEvent };
  });
  const expectedMitigation=48/148;
  if (
    combatInsightRegression.stats.armor !== 12 ||
    Math.abs(combatInsightRegression.stats.damageReduction-expectedMitigation)>0.000001 ||
    combatInsightRegression.stats.critChance !== 1 ||
    Math.abs(combatInsightRegression.stats.critOverflow-0.15)>0.000001 ||
    Math.abs(combatInsightRegression.stats.critDamage-1.65)>0.000001 ||
    combatInsightRegression.stats.dashCooldown !== 1.1 ||
    combatInsightRegression.tabs !== 5 || combatInsightRegression.overviewCards < 8 ||
    combatInsightRegression.offenseCards < 8 || !combatInsightRegression.loadoutVisible || combatInsightRegression.weaponStatRows<1 ||
    combatInsightRegression.hitCount !== 2 || !combatInsightRegression.deathStatsRecorded || combatInsightRegression.damageTypes.Magic !== 30 ||
    combatInsightRegression.elite.id !== 'hulking' || combatInsightRegression.elite.hp !== 180 ||
    combatInsightRegression.elite.speed !== 0.8 || !combatInsightRegression.elite.aura ||
    Object.keys(combatInsightRegression.eliteMatrix).length !== 8 ||
    Object.entries(combatInsightRegression.eliteMatrix).some(([id,result])=>result.applied!==id) ||
    Object.values(combatInsightRegression.bossIdentity).some(value=>value!==true) ||
    Object.values(combatInsightRegression.synergyMatrix).some(value=>value!==true) ||
    Math.abs(combatInsightRegression.synergyStats.speedRatio-1.3)>0.000001 ||
    combatInsightRegression.synergyStats.pierceGain!==2 || !combatInsightRegression.synergyStats.evolvedPair ||
    combatInsightRegression.sizeRangeStats.novaEvolutionTome!=='growth' ||
    Math.abs(combatInsightRegression.sizeRangeStats.bolt.skillSizeMul-1.4)>0.000001 ||
    Math.abs(combatInsightRegression.sizeRangeStats.bolt.range-19.25)>0.000001 ||
    Math.abs(combatInsightRegression.sizeRangeStats.bolt.life-2.275)>0.000001 ||
    Math.abs(combatInsightRegression.sizeRangeStats.stab.skillSizeMul-1.6)>0.000001 ||
    Math.abs(combatInsightRegression.sizeRangeStats.stab.range-4.8)>0.000001 ||
    Math.abs(combatInsightRegression.sizeRangeStats.nova.radius-4.9)>0.000001 ||
    Math.abs(combatInsightRegression.sizeRangeStats.smite.radius-2.8)>0.000001 ||
    Math.abs(combatInsightRegression.sizeRangeStats.smite.range-16.5)>0.000001 ||
    Math.abs(combatInsightRegression.sizeRangeStats.orbit.orbitR-3.2)>0.000001 ||
    Math.abs(combatInsightRegression.sizeRangeStats.orbit.skillSizeMul-1.4)>0.000001 ||
    Math.abs(combatInsightRegression.sizeRangeStats.bomb.bounceRadius-12)>0.000001 ||
    Math.abs(combatInsightRegression.sizeRangeStats.bomb.impactRadius-2.1875)>0.000001 ||
    Math.abs(combatInsightRegression.sizeRangeStats.runtimeBolt.scale-1.4)>0.000001 ||
    combatInsightRegression.sizeRangeStats.runtimeStab.scale!==1 ||
    Math.abs(combatInsightRegression.sizeRangeStats.runtimeStab.width-0.576)>0.000001 ||
    Math.abs(combatInsightRegression.sizeRangeStats.runtimeStab.hitRadius-0.576)>0.000001 ||
    combatInsightRegression.shrine.sacrificeResult.id!=='elite_sacrifice' ||
    combatInsightRegression.shrine.sacrificeResult.maxHp!==70 || combatInsightRegression.shrine.sacrificeResult.hp!==70 ||
    combatInsightRegression.shrine.sacrificeResult.dmgMul!==1.25 ||
    combatInsightRegression.shrine.speedResult.id!=='time_warp' || combatInsightRegression.shrine.speedResult.rateMul!==1.25 ||
    Math.abs(combatInsightRegression.shrine.speedResult.enemySpeedRatio-1.2)>0.000001 ||
    combatInsightRegression.shrine.curseResult.maxHp!==85 || combatInsightRegression.shrine.curseResult.might!==1 ||
    combatInsightRegression.shrine.curseResult.dmgMul!==1.15 ||
    Object.keys(combatInsightRegression.archetypeMatrix).length!==6 ||
    Object.values(combatInsightRegression.archetypeMatrix).some(value=>value!==true) ||
    combatInsightRegression.worldEvent.power!==1.3 || combatInsightRegression.worldEvent.xp!==1.5
  ) {
    throw new Error(`Combat insight regression: ${JSON.stringify(combatInsightRegression)}`);
  }
  const progressMutationRegression = await page.evaluate(()=>{
    const prefix='sc3_soul_coin_mutation_v2_';
    const clear=()=>Object.keys(localStorage).filter(key=>key.startsWith(prefix)).forEach(key=>localStorage.removeItem(key));
    const count=()=>Object.keys(localStorage).filter(key=>key.startsWith(prefix)).length;
    clear();
    setSoulCoins(100,{remote:true});
    setSoulCoins(140);
    setSoulCoins(125);
    const beforeRemote={delta:pendingSoulCoinDelta(),queue:count()};
    setSoulCoins(80,{remote:true});
    const afterRemote={delta:pendingSoulCoinDelta(),queue:count()};
    clear();
    setSoulCoins(0,{remote:true});
    return {beforeRemote,afterRemote};
  });
  if(progressMutationRegression.beforeRemote.delta!==25 || progressMutationRegression.beforeRemote.queue!==2 ||
     progressMutationRegression.afterRemote.delta!==25 || progressMutationRegression.afterRemote.queue!==2){
    throw new Error(`Progress mutation queue regression: ${JSON.stringify(progressMutationRegression)}`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Browser smoke passed on ${baseUrl}`);
} finally {
  if (browser) await browser.close();
  server.kill();
  if (serverErrors.join("").trim()) process.stderr.write(serverErrors.join(""));
}
