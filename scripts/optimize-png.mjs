import { readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const roots = ["assets"];
const chunkSize = 60;

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) out.push(full);
  }
  return out;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.platform === "win32" ? `${cmd}.cmd` : cmd, args, { stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)));
    child.on("error", reject);
  });
}

let files = [];
for (const root of roots) files = files.concat(await walk(root));
files.sort();

let before = 0;
for (const file of files) before += (await stat(file)).size;

for (let i = 0; i < files.length; i += chunkSize) {
  const chunk = files.slice(i, i + chunkSize);
  await run("npx", ["-y", "oxipng-bin", "-o", "2", "--strip", "safe", ...chunk]);
}

let after = 0;
for (const file of files) after += (await stat(file)).size;

console.log(`Optimized ${files.length} PNG files`);
console.log(`Before: ${before.toLocaleString()} bytes`);
console.log(`After:  ${after.toLocaleString()} bytes`);
console.log(`Saved:  ${(before - after).toLocaleString()} bytes`);
