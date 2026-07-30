const fs = require('fs');
const path = require('path');

const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
}

const key = env.RETRODIFFUSION_API_KEY;
if (!key) throw new Error('RETRODIFFUSION_API_KEY is missing');

const body = {
  prompt: 'a fully visible female adult frost warden mage, elegant and battle-ready, slender athletic body, calm mature face, silver-blue braided hair, pale blue and silver frost robes with light armor plates, short blue cloak, holding a silver-blue magical frost staff with a glowing snowflake crystal, subtle icy particles, complete head fully visible with generous empty space above it, complete body and boots fully visible with generous empty space below, character scaled to fit inside the canvas, centered with clear margins on every side, no cropped body parts, no floating halo, no oversized accessories, no ground, no shadow, single character centered, transparent background, 16-bit SNES pixel art, gothic dark-fantasy heroine, 3/4 top-down view, clean crisp pixels',
  prompt_style: 'rd_pro__topdown',
  width: 160,
  height: 160,
  num_images: 1,
  remove_bg: true,
};

console.log('Calling RetroDiffusion...');
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 180000);
fetch('https://api.retrodiffusion.ai/v1/inferences', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-RD-Token': key },
  body: JSON.stringify(body),
  signal: controller.signal,
}).then(async (response) => {
  clearTimeout(timeout);
  console.log(`RetroDiffusion HTTP ${response.status}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`RetroDiffusion HTTP ${response.status}: ${text.slice(0, 500)}`);
  const data = JSON.parse(text);
  const image = data.base64_images?.[0] || data.images?.[0]?.base64 || data.image || data.output?.[0]?.base64;
  if (!image) throw new Error('RetroDiffusion returned no image');
  const outputDir = 'assets/character-bank/frost_warden';
  const outputPath = path.join(outputDir, 'frost_warden_topdown.png');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(String(image).replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log(JSON.stringify({ saved: true, model: data.model, cost: data.cost, bytes: fs.statSync(outputPath).size }));
}).catch((error) => {
  clearTimeout(timeout);
  if (error.name === 'AbortError') error = new Error('RetroDiffusion request timed out after 60 seconds');
  console.error(error.message);
  process.exitCode = 1;
});
