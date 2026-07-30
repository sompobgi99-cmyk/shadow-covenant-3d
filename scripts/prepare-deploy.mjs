import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";


const root = process.cwd();
const dist = path.resolve(root, "dist");
const sourceVersion = JSON.parse(await readFile(path.join(root, "version.json"), "utf8")).version;
const runtimeAssetSource = (
  await Promise.all(
    (await readdir(path.join(root, "js")))
      .filter((name) => name.endsWith(".js") && !name.endsWith(".min.js"))
      .map((name) => readFile(path.join(root, "js", name), "utf8"))
  )
).join("\n");
if (path.dirname(dist) !== path.resolve(root) || path.basename(dist) !== "dist") {
  throw new Error(`Unsafe deploy output path: ${dist}`);
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of ["index.html", "version.json", "mail-admin.html"]) {
  await cp(path.join(root, file), path.join(dist, file));
}
for (const directory of ["css", "lib"]) {
  await cp(path.join(root, directory), path.join(dist, directory), { recursive: true });
}

await mkdir(path.join(dist, "js"), { recursive: true });
for (const entry of await readdir(path.join(root, "js"), { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".js") || entry.name.endsWith(".min.js")) continue;
  await cp(path.join(root, "js", entry.name), path.join(dist, "js", entry.name));
}

for (const directory of ["sprites", "ui"]) {
  await cp(
    path.join(root, "assets", directory),
    path.join(dist, "assets", directory),
    {
      recursive: true,
      filter: (source) => {
        const relative = path.relative(path.join(root, "assets"), source).replaceAll("\\", "/");
        if (!relative) return true;
        if (/(?:^|\/)(?:pipeline|character-bank)(?:\/|$)/.test(relative)) return false;
        if (/_source\.png$/i.test(relative)) return false;
        if (/^sprites\/fx-signature\/.+\.png$/i.test(relative)) return false;
        if (/\.png$/i.test(source)) {
          const webpSource = source.replace(/\.png$/i, ".webp");
          if (existsSync(webpSource) && runtimeAssetSource.includes(path.basename(webpSource))) return false;
        }
        return true;
      },
    }
  );
}

const comicTarget = path.join(dist, "assets", "character-comics");
await mkdir(comicTarget, { recursive: true });
for (const entry of await readdir(path.join(root, "assets", "character-comics"), { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".webp")) continue;
  await cp(
    path.join(root, "assets", "character-comics", entry.name),
    path.join(comicTarget, entry.name)
  );
}

async function filesUnder(directory) {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...await filesUnder(file));
    else if (entry.isFile()) out.push(file);
  }
  return out;
}

const releaseHash = createHash("sha256");
for (const file of [
  ...await filesUnder(dist),
  ...await filesUnder(path.join(root, "netlify")),
].sort()) {
  releaseHash.update(path.relative(root, file).replaceAll("\\", "/"));
  releaseHash.update(await readFile(file));
}
const releaseVersion = `${sourceVersion}-${releaseHash.digest("hex").slice(0, 10)}`;
const distIndexPath = path.join(dist, "index.html");
const distIndex = await readFile(distIndexPath, "utf8");
if (!distIndex.includes(sourceVersion)) {
  throw new Error(`Source version ${sourceVersion} was not found in the deploy index`);
}
await writeFile(distIndexPath, distIndex.replaceAll(sourceVersion, releaseVersion));
await writeFile(path.join(dist, "version.json"), `${JSON.stringify({ version: releaseVersion }, null, 2)}\n`);

console.log(`Deploy bundle prepared: ${releaseVersion} (runtime files plus optimized WebP comics only).`);
