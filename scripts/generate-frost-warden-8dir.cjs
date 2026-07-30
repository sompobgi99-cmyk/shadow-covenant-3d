const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
}
const key = env.RETRODIFFUSION_API_KEY;
if (!key) throw new Error('RETRODIFFUSION_API_KEY is missing');

const directions = [
  ['south', 'facing directly south, front-facing three-quarter view'],
  ['south-east', 'facing south-east, right side visible'],
  ['east', 'facing directly east, clear side profile'],
  ['north-east', 'facing north-east, back three-quarter view'],
  ['north', 'facing directly north, back view'],
  ['north-west', 'facing north-west, back three-quarter view'],
  ['west', 'facing directly west, clear side profile'],
  ['south-west', 'facing south-west, left side visible'],
];
const base = 'a fully visible female adult frost warden mage, slender athletic body, silver-blue braided hair, pale blue and silver frost robes with light armor plates, short blue cloak, holding a silver-blue magical frost staff with a snowflake crystal, compact silhouette matching a 64 pixel game sprite, feet grounded, complete head and body visible, centered with generous margins, no crop, no halo, no ground, no shadow, transparent background, 16-bit SNES pixel art, gothic dark-fantasy heroine, clean crisp pixels, '; 
const outDir = 'assets/character-bank/frost_warden';
fs.mkdirSync(outDir, { recursive: true });

async function generate([name, view]) {
  const response = await fetch('https://api.retrodiffusion.ai/v1/inferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RD-Token': key },
    body: JSON.stringify({ prompt: base + view, prompt_style: 'rd_pro__topdown', width: 64, height: 64, num_images: 1, remove_bg: true }),
    signal: AbortSignal.timeout(180000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status} ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const image = data.base64_images?.[0] || data.images?.[0]?.base64 || data.image || data.output?.[0]?.base64;
  if (!image) throw new Error(`${name}: response contained no image`);
  const file = path.join(outDir, `frost_warden_${name}.png`);
  fs.writeFileSync(file, Buffer.from(String(image).replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log(`saved ${name}`);
}

(async () => {
  console.log('Generating Frost Warden 8-direction preview...');
  for (const direction of directions) await generate(direction);
  execFileSync('python', ['scripts/assemble_character_preview.py', outDir, 'frost_warden', ...directions.map(([name]) => name)], { stdio: 'inherit' });
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
