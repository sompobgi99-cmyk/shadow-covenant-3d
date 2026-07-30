const fs = require('fs');
const path = require('path');

const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
}
const key = env.RETRODIFFUSION_API_KEY;
if (!key) throw new Error('RETRODIFFUSION_API_KEY is missing');

const input = fs.readFileSync('assets/character-bank/frost_warden/frost_warden_walk_start.png').toString('base64');
const payload = {
  width: 80,
  height: 80,
  prompt: 'slow, clear walking cycle, alternating legs and gently swinging the frost staff, keep the same character design, same proportions, same outfit, feet stay grounded, clean readable game sprite animation',
  prompt_style: 'rd_advanced_animation__walking',
  num_images: 1,
  frames_duration: 8,
  return_spritesheet: true,
  input_image: input,
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
  console.log('Checking walking animation cost...');
  const estimate = await call({ check_cost: true });
  console.log(JSON.stringify({ balance_cost: estimate.balance_cost, style: payload.prompt_style }));
  console.log('Generating walking animation...');
  const data = await call();
  const image = data.base64_images?.[0];
  if (!image) throw new Error('RetroDiffusion returned no walking spritesheet');
  const output = path.join('assets/character-bank/frost_warden', 'frost_warden_walk_test.png');
  fs.writeFileSync(output, Buffer.from(image, 'base64'));
  console.log(JSON.stringify({ saved: output, model: data.model, balance_cost: data.balance_cost, bytes: fs.statSync(output).size }));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
