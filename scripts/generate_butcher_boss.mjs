import fs from "node:fs/promises";
import path from "node:path";

const directions = [
  "south",
  "south-east",
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west"
];

const secret = process.env.PIXELLAB_SECRET || process.env.PIXELLAB_API_KEY;
if (!secret) throw new Error("Set PIXELLAB_API_KEY or PIXELLAB_SECRET.");

const baseUrl = process.env.PIXELLAB_BASE_URL || "https://api.pixellab.ai/v1";
const outDir = path.resolve(".tmp", "pixellab_butcher_rotations");
await fs.mkdir(outDir, { recursive: true });

async function postJson(endpoint, body) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`${endpoint} failed: ${JSON.stringify(data)}`);
  }
  if (!data.image?.base64) {
    throw new Error(`${endpoint} returned no image: ${JSON.stringify(data)}`);
  }
  return data.image;
}

async function saveImage(image, filePath) {
  await fs.writeFile(filePath, Buffer.from(image.base64, "base64"));
}

const description = [
  "a huge original demonic slaughterhouse boss, hulking muscular butcher fiend",
  "rusted iron executioner mask, horn-like metal crown, torn blood-stained leather apron",
  "one massive cleaver in one hand, chained meat hook in the other hand",
  "scarred red gray skin, glowing ember eyes, heavy boots, intimidating silhouette",
  "not a copyrighted character, unique dark gothic fantasy design",
  "16-bit SNES pixel art, gothic dark-fantasy boss monster, menacing",
  "3/4 low top-down view, single creature centered, feet at the bottom",
  "clean crisp pixels, transparent background, no ground, no shadow"
].join(", ");

const negativeDescription = [
  "Diablo, Blizzard, exact game character, logo, text, watermark",
  "cute, chibi, blurry, smooth painting, anti-aliased edges, extra limbs",
  "cropped feet, ground, shadow, background"
].join(", ");

const imageSize = { width: 128, height: 128 };
const seed = 4217;

console.log("Generating boss_butcher south...");
const base = await postJson("/generate-image-pixflux", {
  description,
  image_size: imageSize,
  negative_description: negativeDescription,
  text_guidance_scale: 8,
  no_background: true,
  outline: "single color black outline",
  shading: "medium shading",
  detail: "highly detailed",
  view: "low top-down",
  direction: "south",
  coverage_percentage: 82,
  seed
});

await saveImage(base, path.join(outDir, "south.png"));

for (const direction of directions.slice(1)) {
  console.log(`Rotating ${direction}...`);
  const rotated = await postJson("/rotate", {
    image_size: imageSize,
    from_image: base,
    from_view: "low top-down",
    to_view: "low top-down",
    from_direction: "south",
    to_direction: direction,
    image_guidance_scale: 5,
    seed
  });
  await saveImage(rotated, path.join(outDir, `${direction}.png`));
}

console.log(JSON.stringify({ outDir, directions, imageSize }, null, 2));
