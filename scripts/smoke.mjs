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

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

async function waitForServer(baseUrl) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < 12000) {
    try {
      await fetchText(`${baseUrl}/version.json`);
      return;
    } catch (err) {
      lastError = err;
      await wait(250);
    }
  }
  throw lastError || new Error("dev server did not start");
}

const version = JSON.parse(await readFile("version.json", "utf8")).version;
const port = await freePort();
const server = spawn(process.execPath, ["scripts/dev-server.mjs", String(port)], {
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let stderr = "";
server.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

try {
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl);
  const [html, runtime, leaderboard, authConfig, mailbox, mailAdmin] = await Promise.all([
    fetchText(`${baseUrl}/`),
    fetchText(`${baseUrl}/js/game-runtime.js?v=${encodeURIComponent(version)}`),
    fetchText(`${baseUrl}/api/leaderboard`),
    fetchText(`${baseUrl}/api/auth-config`),
    fetchText(`${baseUrl}/api/mailbox`),
    fetchText(`${baseUrl}/mail-admin.html`),
  ]);

  if (!html.includes(`SHADOW_BUILD_VERSION='${version}'`)) throw new Error("index build version mismatch");
  if (!html.includes(`game-runtime.js?v=${version}`)) throw new Error("runtime cache key mismatch");
  if (!runtime.includes("function init(")) throw new Error("runtime script did not load");

  const lb = JSON.parse(leaderboard);
  if (lb.required_build !== version) throw new Error("local leaderboard required_build mismatch");
  if (lb.storage !== "local-read-only") throw new Error("local leaderboard storage mode mismatch");
  JSON.parse(authConfig);
  const mailboxData = JSON.parse(mailbox);
  if (!Array.isArray(mailboxData.messages)) throw new Error("local mailbox response has no messages array");
  if (!mailAdmin.includes("Shadow Post Admin") || !mailAdmin.includes("x-mailbox-admin-key")) throw new Error("mailbox admin page contract missing");

  console.log(`Smoke passed on ${baseUrl} (${version})`);
} finally {
  server.kill();
  if (stderr.trim()) process.stderr.write(stderr);
}
