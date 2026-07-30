import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const htmlPath = "index.html";
const source = readFileSync(htmlPath, "utf8");
const scriptPattern = /<script\s+src="(js\/[^"?]+\.js)(\?[^" ]*)"><\/script>/g;
const scripts = [...source.matchAll(scriptPattern)].map((match) => match[1]);

for (const file of scripts) {
  const output = file.replace(/\.js$/, ".min.js");
  execFileSync(npx, ["--yes", "terser", file, "--compress", "--comments", "false", "--output", output], { stdio: "inherit", shell: true });
}

const productionHtml = source.replace(scriptPattern, (_full, file, query) =>
  `<script src="${file.replace(/\.js$/, ".min.js")}${query}"></script>`
);
writeFileSync(htmlPath, productionHtml);
console.log(`Production minify complete: ${scripts.length} scripts, source maps disabled.`);
