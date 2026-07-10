import { readdir } from "node:fs/promises";

const baseUrl = (process.argv[2] || "https://shadow-covenant-3d.netlify.app").replace(/\/+$/, "");
const files = (await readdir("assets/sprites"))
  .filter((name) => /^(enemy_|miniboss_|boss_).+\.png$/i.test(name))
  .sort();

const failures = [];
let cursor = 0;

async function worker() {
  while (cursor < files.length) {
    const file = files[cursor++];
    const url = `${baseUrl}/assets/sprites/${encodeURIComponent(file)}?asset-check=1`;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) failures.push({ file, status: response.status });
      else await response.body?.cancel();
    } catch (error) {
      failures.push({ file, error: String(error?.message || error) });
    }
  }
}

await Promise.all(Array.from({ length: 16 }, worker));

if (failures.length) {
  console.error(JSON.stringify({ checked: files.length, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Live enemy assets passed: ${files.length} files on ${baseUrl}`);
}
