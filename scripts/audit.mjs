import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const spriteDir = path.join(root, "assets", "sprites");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function stripAssetQuery(file) {
  return String(file || "").split("?")[0];
}

function assetPath(file) {
  return path.join(spriteDir, stripAssetQuery(file));
}

function assetExists(file) {
  return !!file && fs.existsSync(assetPath(file));
}

function findLiteral(source, name) {
  const marker = `const ${name}`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Could not find ${name}`);
  const eq = source.indexOf("=", start);
  if (eq < 0) throw new Error(`Could not find ${name} assignment`);
  let i = eq + 1;
  while (/\s/.test(source[i])) i++;
  const open = source[i];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  if (!close) throw new Error(`${name} is not an object/array literal`);
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "/" && next === "/") {
      lineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return source.slice(eq + 1, i + 1).trim();
    }
  }
  throw new Error(`Could not parse ${name}`);
}

function evaluateLiteral(source, name) {
  const literal = findLiteral(source, name);
  return vm.runInNewContext(`(${literal})`, {}, { timeout: 1000 });
}

function pngSize(file) {
  const buf = fs.readFileSync(assetPath(file));
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function checkManifestAsset(key, file) {
  if (!file) return fail(`MANIFEST.${key} has no file`);
  if (!assetExists(file)) return fail(`Missing sprite for MANIFEST.${key}: ${stripAssetQuery(file)}`);
}

function checkIcon(manifest, owner, key) {
  if (!key) return fail(`${owner} has no icon`);
  const file = manifest[key] || `${key}.png`;
  if (!assetExists(file)) fail(`${owner} icon missing: ${key} -> ${stripAssetQuery(file)}`);
}

function checkGrid(file, cols, rows, owner) {
  if (!assetExists(file)) return fail(`${owner} sheet missing: ${stripAssetQuery(file)}`);
  const size = pngSize(file);
  if (!size) return fail(`${owner} sheet is not a valid PNG: ${stripAssetQuery(file)}`);
  if (size.width % cols !== 0 || size.height % rows !== 0) {
    fail(`${owner} sheet dimensions ${size.width}x${size.height} do not divide by ${cols}x${rows}: ${stripAssetQuery(file)}`);
  }
}

const errors = [];
const warnings = [];

const dataSource = read("js/game-data.js");
const combatSource = read("js/combat.js");
const runtimeSource = read("js/game-runtime.js");
const systemsSource = read("js/game-systems.js");
const indexSource = read("index.html");
const cssSource = read("css/game.css");
const leaderboardSource = read("netlify/functions/leaderboard.mts");
const leaderboardMigration = read("supabase/migrations/20260710_leaderboard_runs.sql");
const versionJson = JSON.parse(read("version.json"));

const manifest = evaluateLiteral(dataSource, "MANIFEST");
const enemyTypes = evaluateLiteral(dataSource, "ENEMY_TYPES");
const minibossTypes = evaluateLiteral(dataSource, "MINIBOSS_TYPES");
const bossTypes = evaluateLiteral(dataSource, "BOSS_TYPES");
const weapons = evaluateLiteral(combatSource, "WEAPON_TYPES");
const items = evaluateLiteral(combatSource, "ITEMS");
const upgrades = evaluateLiteral(runtimeSource, "UPGRADES");
const relics = evaluateLiteral(runtimeSource, "RELICS");
const sheets = evaluateLiteral(runtimeSource, "SHEETS");
const characters = evaluateLiteral(runtimeSource, "CHARACTERS");
const bossSkills = evaluateLiteral(systemsSource, "BOSS_SKILLS");
const minibossSkills = evaluateLiteral(systemsSource, "MB_SKILLS");
const skillTable = evaluateLiteral(systemsSource, "SK");

if (!runtimeSource.includes("'title.meta.heroes':'{count} นักล่า'") || !runtimeSource.includes("'title.meta.heroes':'{count} hunters'")) {
  fail("title hero count must be rendered from CHARACTERS instead of a hardcoded number");
}
if (!runtimeSource.includes("Object.keys(CHARACTERS).length") || !runtimeSource.includes("guideContentSummary(kind)")) {
  fail("title and Guide content summaries must read from live game data");
}
if (!indexSource.includes('data-content-count="characters"') || !indexSource.includes('data-content-count="maps"')) {
  fail("index title metadata must use dynamic content-count placeholders");
}
if (!cssSource.includes("assets/ui/title-covenant.webp")) fail("title screen must use the optimized WebP background");
for (const key of ["map2_ground", "map2_border_wall", "map3_ground", "map3_border_wall", "floor_challenge_treasure"]) {
  if (!String(manifest[key] || "").endsWith(".webp")) fail(`MANIFEST.${key} must use its lossless WebP asset`);
}

const htmlBuild = (indexSource.match(/SHADOW_BUILD_VERSION='([^']+)'/) || [])[1];
const apiBuild = (leaderboardSource.match(/REQUIRED_BUILD\s*=\s*"([^"]+)"/) || [])[1];
if (!versionJson.version) fail("version.json has no version");
if (htmlBuild !== versionJson.version) fail(`index.html build ${htmlBuild || "(missing)"} does not match version.json ${versionJson.version}`);
if (apiBuild !== versionJson.version) fail(`leaderboard REQUIRED_BUILD ${apiBuild || "(missing)"} does not match version.json ${versionJson.version}`);
if (!leaderboardSource.includes('SUPABASE_SERVICE_ROLE_KEY') || !leaderboardSource.includes('insertPostgresRows') || !leaderboardSource.includes('storage: "postgres"')) {
  fail("leaderboard function must use server-side Supabase Postgres storage");
}
if (!leaderboardMigration.includes("dedupe_key text not null unique") || !leaderboardMigration.includes("enable row level security") || !leaderboardMigration.includes("revoke all on table public.leaderboard_runs from anon, authenticated")) {
  fail("leaderboard migration must include atomic dedupe and locked-down RLS");
}
if (!runtimeSource.includes("const APP_VERSION = window.SHADOW_BUILD_VERSION || 'dev';")) {
  fail("game-runtime.js APP_VERSION must read window.SHADOW_BUILD_VERSION so the reload prompt can clear after refresh");
}

const derivedManifest = { ...manifest };
const setManifest = (key, file) => {
  if (!(key in derivedManifest)) derivedManifest[key] = file;
};
const addUnit = (sprite, withWalk) => {
  setManifest(sprite, `${sprite}.png`);
  setManifest(`${sprite}_8dir`, `${sprite}_8dir.png`);
  if (withWalk) setManifest(`${sprite}_walk`, `${sprite}_walk.png`);
};
const staticOnly = new Set([
  "enemy_grave_arbalist",
  "enemy_mire_hexer",
  "enemy_rift_needler",
  "enemy_doom_cantor",
  "enemy_covenant_warder",
]);
for (const e of enemyTypes) addUnit(e.sprite, !staticOnly.has(e.sprite));
for (const e of minibossTypes) addUnit(e.sprite, true);
for (const e of bossTypes) setManifest(`${e.sprite}_8dir`, `${e.sprite}_8dir.png`);

for (const [key, file] of Object.entries(derivedManifest)) checkManifestAsset(key, file);

const weaponEntries = Object.entries(weapons);
for (const [key, weapon] of weaponEntries) {
  checkIcon(derivedManifest, `weapon ${key}`, weapon.icon);
  if (weapon.hidden) continue;
  if (!weapon.evolveTo) fail(`base weapon ${key} has no evolveTo`);
  if (!weapon.evolveTome) fail(`base weapon ${key} has no evolveTome`);
  if (weapon.evolveTo && !weapons[weapon.evolveTo]) fail(`base weapon ${key} evolves to missing weapon ${weapon.evolveTo}`);
  if (weapon.evolveTo && weapons[weapon.evolveTo] && !weapons[weapon.evolveTo].hidden) fail(`evolved weapon ${weapon.evolveTo} is not hidden`);
  if (weapon.evolveTome && !upgrades.some((u) => u.id === weapon.evolveTome)) fail(`base weapon ${key} uses missing evolve tome ${weapon.evolveTome}`);
}

for (const item of items) checkIcon(derivedManifest, `item ${item.id || item.name}`, item.icon);
for (const tome of upgrades) checkIcon(derivedManifest, `tome ${tome.id}`, tome.icon);
for (const relic of relics) checkIcon(derivedManifest, `relic ${relic.id}`, relic.icon);

for (const [key, character] of Object.entries(characters)) {
  const sheet = sheets[character.sheet];
  if (!sheet) {
    fail(`character ${key} references missing sheet ${character.sheet}`);
    continue;
  }
  for (const state of ["walk", "idle"]) {
    if (!sheet[state]) {
      fail(`character ${key} sheet ${character.sheet} missing ${state}`);
      continue;
    }
    const file = derivedManifest[sheet[state].key];
    if (!file) fail(`character ${key} ${state} manifest key missing: ${sheet[state].key}`);
    else checkGrid(file, sheet[state].cols, sheet[state].rows, `character ${key} ${state}`);
  }
  const portraitKey = character.portrait || key;
  const portraitFile = `char_${portraitKey}_portrait.png`;
  if (!assetExists(portraitFile)) warn(`character ${key} portrait missing direct file: ${portraitFile}`);
}

for (const enemy of [...enemyTypes, ...minibossTypes]) {
  const dirFile = derivedManifest[`${enemy.sprite}_8dir`];
  if (dirFile && assetExists(dirFile)) checkGrid(dirFile, 1, 8, `${enemy.name} 8-dir`);
  const walkFile = derivedManifest[`${enemy.sprite}_walk`];
  if (walkFile && assetExists(walkFile)) {
    const size = pngSize(walkFile);
    if (!size) fail(`${enemy.name} walk sheet is not a valid PNG`);
    else if (size.width % 4 !== 0) fail(`${enemy.name} walk sheet width ${size.width} is not divisible by 4`);
  }
}
for (const boss of bossTypes) {
  const dirFile = derivedManifest[`${boss.sprite}_8dir`];
  if (dirFile) checkGrid(dirFile, 1, 8, `${boss.name} 8-dir`);
}

for (const boss of bossTypes) {
  if (!bossSkills[boss.sprite]) fail(`boss ${boss.name} has no BOSS_SKILLS entry`);
}
for (const mini of minibossTypes) {
  if (!minibossSkills[mini.sprite]) fail(`miniboss ${mini.name} has no MB_SKILLS entry`);
}
for (const [owner, names] of Object.entries({ ...bossSkills, ...minibossSkills })) {
  for (const name of names) {
    if (!skillTable[name]) fail(`${owner} references missing skill ${name}`);
  }
}

const spriteFiles = fs.readdirSync(spriteDir).filter((file) => /\.(png|webp)$/i.test(file));
const spriteBytes = spriteFiles.reduce((sum, file) => sum + fs.statSync(path.join(spriteDir, file)).size, 0);
const deferredUnits = new Set(enemyTypes.filter((e) => (e.tier || 0) > 0).flatMap((e) => [e.sprite, `${e.sprite}_8dir`, `${e.sprite}_walk`]));
const isBootLazy = (key) => key.startsWith("map2_") || key.startsWith("map3_")
  || key.startsWith("floor_challenge_") || key.startsWith("prop_challenge_")
  || key.startsWith("boss_") || key.startsWith("miniboss_") || key.startsWith("pet_")
  || /^char_.+_(walk|idle|portrait)$/.test(key)
  || key === "obj_normal_portal" || key === "obj_challenge_gate" || deferredUnits.has(key);
const bootFiles = new Set(Object.entries(derivedManifest).filter(([key]) => !isBootLazy(key)).map(([, file]) => stripAssetQuery(file)));
const bootSpriteBytes = [...bootFiles].reduce((sum, file) => sum + (assetExists(file) ? fs.statSync(assetPath(file)).size : 0), 0);
const titleAsset = path.join(root, "assets", "ui", "title-covenant.webp");
const initialVisualBytes = bootSpriteBytes + (fs.existsSync(titleAsset) ? fs.statSync(titleAsset).size : 0);

console.log(`Audit: ${Object.keys(derivedManifest).length} manifest assets, ${weaponEntries.length} weapons, ${items.length} items, ${enemyTypes.length} enemies, ${minibossTypes.length} minibosses, ${bossTypes.length} bosses.`);
console.log(`Sprites: ${spriteFiles.length} PNG/WebP files, ${(spriteBytes / 1024 / 1024).toFixed(2)} MB.`);
console.log(`Initial visual payload estimate: ${(initialVisualBytes / 1024 / 1024).toFixed(2)} MB (${bootFiles.size} boot textures + title).`);
if (initialVisualBytes > 6 * 1024 * 1024) warn(`Initial visual payload exceeds 6 MB: ${(initialVisualBytes / 1024 / 1024).toFixed(2)} MB`);
if (warnings.length) {
  console.warn(`Warnings (${warnings.length}):`);
  for (const message of warnings) console.warn(`- ${message}`);
}
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}
console.log("Audit passed.");
