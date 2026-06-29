import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PixelLabClient } from "@pixellab-code/pixellab";

function readArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (!value.startsWith("--")) {
      args._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith("--") ? argv[++i] : true;
  }
  return args;
}

function positiveInt(value, fallback, name) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  if (!Number.isInteger(parsed) || parsed < 8 || parsed > 512) {
    throw new Error(`${name} must be an integer from 8 to 512`);
  }
  return parsed;
}

function getClient() {
  const secret = process.env.PIXELLAB_SECRET || process.env.PIXELLAB_API_KEY;
  if (!secret) {
    throw new Error(
      "Set PIXELLAB_API_KEY or PIXELLAB_SECRET in your environment, then reopen the terminal."
    );
  }
  return new PixelLabClient(secret);
}

async function balance(client) {
  const result = await client.getBalance();
  const amount = result.usd ?? result.balance ?? 0;
  const currency = result.type === "usd" ? "USD" : result.currency || result.type || "";
  console.log(JSON.stringify({ connected: true, balance: amount, currency }, null, 2));
}

async function generate(client, args) {
  const description = args.description || args.prompt;
  if (!description) {
    throw new Error('Missing --description "pixel art description"');
  }

  const width = positiveInt(args.width, 64, "width");
  const height = positiveInt(args.height, 64, "height");
  const output = path.resolve(args.out || "assets/sprites/pixellab-generated.png");
  await fs.mkdir(path.dirname(output), { recursive: true });

  const response = await client.generateImagePixflux({
    description,
    imageSize: { width, height },
    negativeDescription:
      args.negative || "blurry, smooth painting, anti-aliased edges, text, watermark",
    noBackground: args.background !== "true",
    outline: args.outline || "single color black outline",
    shading: args.shading || "basic shading",
    detail: args.detail || "medium detail"
  });

  await response.image.saveToFile(output);
  console.log(JSON.stringify({ output, width, height }, null, 2));
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const command = args._[0];

  if (command === "balance") return balance(getClient());
  if (command === "generate") return generate(getClient(), args);

  console.log(`PixelLab helper

Commands:
  npm run pixellab:balance
  npm run pixellab:generate -- --description "dark knight" --width 64 --height 64 --out assets/sprites/dark-knight.png

Options:
  --negative <text>
  --outline <text>
  --shading <text>
  --detail <text>
  --background true
`);
}

main().catch((error) => {
  console.error(`PixelLab error: ${error.message}`);
  process.exitCode = 1;
});
