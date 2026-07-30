const fs = require('fs');
const path = require('path');

const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
}
const key = env.RETRODIFFUSION_API_KEY;
if (!key) throw new Error('RETRODIFFUSION_API_KEY is missing');

const directions = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const outputDir = 'assets/character-bank/frost_warden/walk';
fs.mkdirSync(outputDir, { recursive: true });

async function generate(direction, checkCost = false) {
  const input = fs.readFileSync(`assets/character-bank/frost_warden/starts/${direction}.png`).toString('base64');
  const payload = {
    width: 80,
    height: 80,
    prompt: 'a clean readable walking cycle, alternate the legs and gently swing the staff, keep the exact same character design, same proportions, same outfit and staff, feet stay grounded, no particles, no spell effects, no glow, no extra objects',
    prompt_style: 'rd_advanced_animation__walking',
    num_images: 1,
    frames_duration: 8,
    return_spritesheet: true,
    input_image: input,
  };
  if (checkCost) payload.check_cost = true;
  const response = await fetch('https://api.retrodiffusion.ai/v1/inferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RD-Token': key },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${direction}: HTTP ${response.status}: ${text.slice(0, 400)}`);
  const data = JSON.parse(text);
  if (checkCost) return data;
  const image = data.base64_images?.[0];
  if (!image) throw new Error(`${direction}: no spritesheet returned`);
  const file = path.join(outputDir, `${direction}.png`);
  fs.writeFileSync(file, Buffer.from(image, 'base64'));
  console.log(`saved ${direction}`);
}

async function main() {
  console.log('Checking cost for 8 walking directions...');
  const estimate = await generate('south', true);
  console.log(JSON.stringify({ per_direction: estimate.balance_cost, estimated_total: Number(estimate.balance_cost || 0) * 8 }));
  for (const direction of directions) await generate(direction);
  console.log('Generated all 8 walking directions.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
