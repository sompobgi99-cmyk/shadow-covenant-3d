const fs = require('fs');
const path = require('path');

const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
}
const key = env.RETRODIFFUSION_API_KEY;
if (!key) throw new Error('RETRODIFFUSION_API_KEY is missing');

const payload = {
  width: 80,
  height: 80,
  prompt: 'a female adult frost warden mage, consistent character shown in eight rotational directions, slender athletic body, silver-blue braided hair, pale blue and silver frost robes with light armor plates, short blue cloak, holding the same silver-blue magical frost staff with a snowflake crystal, full body, grounded feet, centered, consistent proportions and outfit in every direction, transparent background, clean crisp 16-bit SNES gothic dark-fantasy pixel art',
  prompt_style: 'rd_animation__8_dir_rotation',
  num_images: 1,
  return_spritesheet: true,
};

async function call(extra = {}) {
  const response = await fetch('https://api.retrodiffusion.ai/v1/inferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RD-Token': key },
    body: JSON.stringify({ ...payload, ...extra }),
    signal: AbortSignal.timeout(180000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`RetroDiffusion HTTP ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

(async () => {
  console.log('Checking cost for the correct 8-direction animation style...');
  const estimate = await call({ check_cost: true });
  console.log(JSON.stringify({ balance_cost: estimate.balance_cost, model: estimate.model, style: payload.prompt_style }));
  if (process.argv.includes('--estimate')) return;

  console.log('Generating one 8-direction rotation spritesheet...');
  const data = await call();
  const image = data.base64_images?.[0];
  if (!image) throw new Error('RetroDiffusion returned no spritesheet');
  const output = path.join('assets/character-bank/frost_warden', 'frost_warden_8dir_rotation.png');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, Buffer.from(image, 'base64'));
  console.log(JSON.stringify({ saved: output, model: data.model, balance_cost: data.balance_cost, bytes: fs.statSync(output).size }));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
