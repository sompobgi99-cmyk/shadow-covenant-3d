// ---- Tunables (world units; 1 unit ~= one 2D tile) ----
const PLAYER_SPEED = 4.6;
const DASH_SPEED = 26, DASH_DUR = 0.18, DASH_CD = 2.2;   // dash/dodge
const SPD_SCALE = 1/28;          // enemy px/s -> units/s
const MAP_BOUND = 56;            // playable half-extent
const PICKUP_MAGNET = 3.0, PICKUP_COLLECT = 0.7;
// ---- Weapons (active; multiple, gained/leveled via the level-up choices) ----
const WEAPON_TYPES = {
  bolt:   { name:'Void Bolt',      icon:'wpn_bolt',     desc:'Bolts seek nearest foes',  mode:'aim',
            dmg:14, rate:1.8, range:11, count:1, pierce:1, speed:16, life:1.3, color:0xb98aff, shape:'orb', evolveTo:'boltX', evolveTome:'might' },
  spread: { name:'Hex Spread',     icon:'wpn_spread', desc:'Fan of shards forward',    mode:'spread',
            dmg:9, rate:1.3, range:9, count:2, pierce:0, speed:15, life:0.9, color:0x66ccff, arc:0.38, shape:'shard', evolveTo:'spreadX', evolveTome:'multishot' },
  nova:   { name:'Nova Burst',     icon:'wpn_nova',  desc:'Ring blast around you',    mode:'nova',
            dmg:14, rate:0.85, range:0, count:1, pierce:99, speed:12, life:0.6, color:0xffaa44, radius:2.8, evolveTo:'novaX', evolveTome:'celerity' },
  orbit:  { name:'Orbiting Skull', icon:'wpn_orbit', desc:'Skulls orbit, bonk, and guard hits',     mode:'orbit',
            dmg:6, count:2, color:0xff6688, orbitR:2.0, orbitSpd:3.2, tick:0.40, guardBlock:0.50, guardRecover:5.0, evolveTo:'orbitX', evolveTome:'precision' },
  arrow:  { name:"Hunter's Arrow",  icon:'wpn_arrow', desc:'Long piercing arrow',       mode:'aim',
            dmg:16, rate:1.2, range:15, count:1, pierce:3, speed:24, life:1.6, color:0x8ef06a, shape:'arrow', evolveTo:'arrowX', evolveTome:'velocity' },
  smite:  { name:'Holy Smite',      icon:'wpn_smite',  desc:'Divine strike from above',  mode:'smite',
            dmg:22, rate:0.9, range:10, count:1, pierce:2, speed:14, life:1.4, color:0xfff2c0, radius:1.6, evolveTo:'smiteX', evolveTome:'growth' },
  lightning:{ name:'Lightning Strike', icon:'wpn_lightning', desc:'Calls lightning onto single targets', mode:'smite',
            dmg:20, rate:1.15, range:11, count:1, pierce:1, speed:14, life:1.2, color:0x7ce7ff, radius:1.25, shape:'lightning' },
  dagger: { name:'Throwing Knives', icon:'wpn_dagger', desc:'Fast thrown daggers at nearby foes', mode:'aim',
            dmg:11, rate:2.4, range:10, count:2, pierce:1, speed:26, life:0.9, color:0xdde7ff, shape:'dagger' },
  bladewhirl:{ name:'Blade Wave',   icon:'wpn_bladewhirl',     desc:'Fires curved sword waves', mode:'slash',
            dmg:12, rate:1.8, range:3.6, count:1, pierce:1, speed:8, life:0.38, color:0xff5566, arc:0.45, shape:'crescent', evolveTo:'bladewhirlX', evolveTome:'swiftness' },
  soulspiral:{ name:'Soul Spiral',  icon:'wpn_soulspiral',  desc:'Rotating soul bolts',       mode:'spiral',
            dmg:8, rate:2.4, range:0, count:2, pierce:1, speed:13, life:1.4, color:0xb06aff, shape:'soul', evolveTo:'soulspiralX', evolveTome:'duration' },
  // evolved forms (hidden from the acquire pool)
  boltX:  { name:'Doom Bolt',      icon:'wpn_bolt_evolved',     desc:'Evolved: piercing barrage', mode:'aim', hidden:true,
            dmg:28, rate:2.4, range:13, count:2, pierce:4, speed:20, life:1.6, color:0xff66ff, shape:'doom' },
  spreadX:{ name:'Hex Storm',      icon:'wpn_spread_evolved', desc:'Evolved: shard storm',      mode:'spread', hidden:true,
            dmg:16, rate:1.6, range:11, count:5, pierce:2, speed:18, life:1.1, color:0x99eeff, arc:0.78, shape:'shard' },
  novaX:  { name:'Supernova',      icon:'wpn_nova_evolved',  desc:'Evolved: massive blast',    mode:'nova', hidden:true,
            dmg:24, rate:1.15, range:0, count:2, pierce:99, speed:15, life:0.8, color:0xffd24a, radius:4.5 },
  orbitX: { name:'Death Orbit',    icon:'wpn_orbit_evolved', desc:'Evolved: dual orbit and stronger guard',      mode:'orbit', hidden:true,
            dmg:13, count:4, color:0xff3366, orbitR:2.8, orbitSpd:4.2, tick:0.24, guardBlock:0.70, guardRecover:3.5 },
  arrowX: { name:'Tempest Volley', icon:'wpn_arrow_evolved', desc:'Evolved: storm of arrows',  mode:'aim', hidden:true,
            dmg:30, rate:1.7, range:18, count:3, pierce:6, speed:30, life:1.9, color:0xc8ff7a, shape:'arrow' },
  smiteX: { name:'Divine Judgment', icon:'wpn_smite_evolved', desc:'Evolved: heaven’s wrath', mode:'smite', hidden:true,
            dmg:40, rate:1.2, range:12, count:2, pierce:3, speed:14, life:1.4, color:0xffe9a0, radius:3.0 },
  bladewhirlX:{ name:'Tempest Blades', icon:'wpn_bladewhirl_evolved', desc:'Evolved: blade cyclone', mode:'slash', hidden:true,
            dmg:22, rate:2.4, range:4.6, count:3, pierce:3, speed:10, life:0.46, color:0xff7a88, arc:0.9, shape:'crescent' },
  soulspiralX:{ name:'Soul Tempest', icon:'wpn_soulspiral_evolved', desc:'Evolved: spectral maelstrom', mode:'spiral', hidden:true,
            dmg:16, rate:3.0, range:0, count:4, pierce:3, speed:15, life:1.7, color:0xcf8aff, shape:'soul' },
};
// ---- Items (pickup from enemy drops, stack unlimited) ----
const DROP_RATES = { common: 0.12, uncommon: 0.06, rare: 0.025, legendary: 0.005 };
const ITEMS = [
  // ═══════════════ 🟢 Common ═══════════════
  { id:'gym_sauce',   name:'Gym Sauce',      desc:'+10% Damage',              rarity:'common', icon:'item_gym_sauce',
    apply:p=>{ p.dmgMul*=1.10; } },
  { id:'oats',        name:'Oats',           desc:'+25 Max HP',               rarity:'common', icon:'item_oats',
    apply:p=>{ p.maxHp+=25; p.hp+=25; } },
  { id:'turbo_socks', name:'Turbo Socks',    desc:'+15% Move Speed',          rarity:'common', icon:'item_turbo_socks',
    apply:p=>{ p.spd*=1.15; } },
  { id:'time_brace',  name:'Time Bracelet',  desc:'+8% XP Gain',             rarity:'common', icon:'item_time_brace',
    apply:p=>{ p.xpMul*=1.08; } },
  { id:'gold_glove',  name:'Golden Glove',   desc:'+15% Gold',               rarity:'common', icon:'item_gold_glove',
    apply:p=>{ p.goldMul*=1.15; } },
  { id:'medkit',      name:'MedKit',         desc:'+0.5 HP/sec regen',       rarity:'common', icon:'item_medkit',
    apply:p=>{ p.regen+=0.5; } },
  { id:'battery',     name:'Battery',        desc:'+8% Attack Speed',        rarity:'common', icon:'item_battery',
    apply:p=>{ p.rateMul*=1.08; } },
  { id:'boss_buster', name:'Boss Buster',    desc:'+15% dmg to Boss/Elite',  rarity:'common', icon:'item_boss_buster',
    apply:p=>{ p._bossBuster=(p._bossBuster||0)+1; } },
  { id:'ice_crystal', name:'Ice Crystal',    desc:'+10% freeze on hit',      rarity:'common', icon:'item_ice_crystal',
    apply:p=>{ p.freezeChance=(p.freezeChance||0)+0.10; } },
  { id:'clover',      name:'Clover',         desc:'+7.5% Luck (better drops)', rarity:'common', icon:'item_clover',
    apply:p=>{ p.luck=(p.luck||0)+0.075; } },
  { id:'wrench',      name:'Wrench',         desc:'-8% chest cost per stack', rarity:'common', icon:'item_wrench',
    apply:p=>{ p._wrench=(p._wrench||0)+1; } },
  { id:'slip_ring',   name:'Slippery Ring',  desc:'+15% Evasion',            rarity:'common', icon:'item_slip_ring',
    apply:p=>{ p.evade=(p.evade||0)+0.15; } },
  // ═══════════════ 🔵 Uncommon ═══════════════
  { id:'backpack',    name:'Backpack',       desc:'+1 Projectile for all weapons', rarity:'uncommon', icon:'item_backpack',
    apply:p=>{ p.countBonus+=1; } },
  { id:'beer',        name:'Beer',           desc:'+20% Damage, -5% Max HP',  rarity:'uncommon', icon:'item_beer',
    apply:p=>{ p.dmgMul*=1.20; p.maxHp=Math.round(p.maxHp*0.95); p.hp=Math.min(p.hp,p.maxHp); } },
  { id:'brass_knuckle',name:'Brass Knuckles',desc:'+20% dmg to nearby enemies', rarity:'uncommon', icon:'item_brass_knuckle',
    apply:p=>{ p._brass=(p._brass||0)+1; } },
  { id:'echo_shard',  name:'Echo Shard',     desc:'+12% double XP drop',     rarity:'uncommon', icon:'item_echo_shard',
    apply:p=>{ p.echoChance=(p.echoChance||0)+0.12; } },
  { id:'campfire',    name:'Campfire',       desc:'Standing still = +2 HP/sec', rarity:'uncommon', icon:'item_campfire',
    apply:p=>{ p._campfire=(p._campfire||0)+1; } },
  { id:'leech_crystal',name:'Leeching Crystal',desc:'+50 Max HP, -50% regen', rarity:'uncommon', icon:'item_leech_crystal',
    apply:p=>{ p.maxHp+=50; p.hp+=50; p.regen*=0.5; } },
  { id:'demon_blood', name:'Demonic Blood',  desc:'+0.5 Max HP per kill (max 200)', rarity:'uncommon', icon:'item_demon_blood',
    apply:p=>{ p._demonBlood=(p._demonBlood||0)+1; } },
  { id:'idle_juice',  name:'Idle Juice',     desc:'+100% dmg after 3s still', rarity:'uncommon', icon:'item_idle_juice',
    apply:p=>{ p._idle=(p._idle||0)+1; } },
  { id:'thunder_mitts',name:'Thunder Mitts', desc:'10% lightning on hit (AoE)', rarity:'uncommon', icon:'item_thunder_mitts',
    apply:p=>{ p.thunderChance=(p.thunderChance||0)+0.10; } },
  { id:'credit_card', name:'Credit Card',    desc:'+2.5% dmg per chest opened', rarity:'uncommon', icon:'item_credit_card',
    apply:p=>{ p._creditCard=(p._creditCard||0)+1; } },
  // ═══════════════ 🟣 Rare ═══════════════
  { id:'beefy_ring',  name:'Beefy Ring',     desc:'+20% dmg per 100 Max HP', rarity:'rare', icon:'item_beefy_ring',
    apply:p=>{ p._beefy=(p._beefy||0)+1; } },
  { id:'spiky_shield',name:'Spiky Shield',   desc:'+2 Thorns per 1% Armor',  rarity:'rare', icon:'item_spiky_shield',
    apply:p=>{ p.thorns=(p.thorns||0)+Math.max(1,Math.round(p.def*2)); } },
  { id:'shatter_know',name:'Shattered Knowledge',desc:'+12% XP gain',        rarity:'rare', icon:'item_shatter_know',
    apply:p=>{ p.xpMul*=1.12; } },
  { id:'gamer_goggles',name:'Gamer Goggles', desc:'Up to +60% dmg when low HP', rarity:'rare', icon:'item_gamer_goggles',
    apply:p=>{ p._goggles=(p._goggles||0)+1; } },
  { id:'demon_soul',  name:'Demonic Soul',   desc:'+0.1% dmg per kill (max 100%)', rarity:'rare', icon:'item_demon_soul',
    apply:p=>{ p._demonSoul=(p._demonSoul||0)+1; } },
  { id:'mirror',      name:'Mirror',         desc:'Reflect 30% damage back',  rarity:'rare', icon:'item_mirror',
    apply:p=>{ p.reflect=(p.reflect||0)+0.30; } },
  { id:'slurp_gloves',name:'Slurp Gloves',   desc:'+7.5% Lifesteal on hit',  rarity:'rare', icon:'item_slurp_gloves',
    apply:p=>{ p.lifesteal+=2; } },
  { id:'eagle_claw',  name:'Eagle Claw',     desc:'+66% dmg to airborne',    rarity:'rare', icon:'item_eagle_claw',
    apply:p=>{ p._eagle=(p._eagle||0)+1; } },
  // ═══════════════ 🟡 Legendary ═══════════════
  { id:'big_bonk',    name:'Big Bonk',       desc:'2% chance = 20x damage',  rarity:'legendary', icon:'item_big_bonk',
    apply:p=>{ p.bonkChance=(p.bonkChance||0)+0.02; } },
  { id:'holy_book',   name:'Holy Book',      desc:'+100 HP, +50 HP Regen',   rarity:'legendary', icon:'item_holy_book',
    apply:p=>{ p.maxHp+=100; p.hp+=100; p.regen+=50; } },
  { id:'soul_harvester',name:'Soul Harvester',desc:'Kills drop bonus homing XP', rarity:'legendary', icon:'item_soul_harvester',
    apply:p=>{ p._soulHarv=(p._soulHarv||0)+1; } },
  { id:'spicy_meatball',name:'Spicy Meatball',desc:'25% explosion on hit (65% dmg)', rarity:'legendary', icon:'item_spicy_meatball',
    apply:p=>{ p.spicyChance=(p.spicyChance||0)+0.25; } },
  { id:'chonkplate',  name:'Chonkplate',     desc:'Overheal 75%, +20% Lifesteal', rarity:'legendary', icon:'item_chonkplate',
    apply:p=>{ p.overheal=(p.overheal||0)+0.75; p.lifesteal+=3; } },
  { id:'energy_core', name:'Energy Core',    desc:'Pulsing energy aura damages nearby', rarity:'legendary', icon:'item_energy_core',
    apply:p=>{ p._energyCore=(p._energyCore||0)+1; } },
  { id:'power_gloves',name:'Power Gloves',   desc:'8% blast + knockback', rarity:'legendary', icon:'item_power_gloves',
    apply:p=>{ p.blastChance=(p.blastChance||0)+0.08; p.knockbackMul=(p.knockbackMul||0)+0.5; } },
  { id:'dragonfire',  name:'Dragonfire',     desc:'15% fire on hit + burn DoT', rarity:'legendary', icon:'item_dragonfire',
    apply:p=>{ p.fireChance=(p.fireChance||0)+0.15; } },
];
const RARITY_COLORS = { common:0x7ecf5a, uncommon:0x5a9ecf, rare:0xcf5acf, legendary:0xcfc05a };
const RARITY_GLOW = { common:0x44ff44, uncommon:0x44aaff, rare:0xff44ff, legendary:0xffdd44 };
function wstats(key, lvl){
  const b = WEAPON_TYPES[key], s = Object.assign({}, b), k = lvl-1;
  s.dmg = Math.round(b.dmg * (1 + 0.15*k) * (player.dmgMul||1));
  const bonus=player.countBonus||0;
  if (b.mode === 'orbit'){
    s.count = b.count + Math.floor(k/2) + bonus;
    s.orbitR = b.orbitR * (1 + 0.055*k) * (player.rangeMul||1);
    s.tick = b.tick * Math.pow(0.90, k) / (player.rateMul||1);   // orbs hit faster per level + attack speed
  } else {
    const step=b.mode==='nova'||b.mode==='slash' ? 4 : 3;
    s.count = b.count + Math.floor(k/step) + bonus;
    s.rate  = b.rate * (1 + 0.06*k) * (player.rateMul||1);
    s.range = b.range * (player.rangeMul||1);
    s.life  = b.life * (player.lifeMul||1);
    s.areaLife = player.areaLifeMul||1;
    s.speed = b.speed * (player.projSpeedMul||1);
    if (b.radius) s.radius = b.radius * (1 + 0.055*k) * (player.rangeMul||1);
  }
  return s;
}
function makeWeapon(key){ return { key, lvl:1, cd:0, orbs:[] }; }

function syncOrbitGuard(w, s){
  const max=Math.max(0, s.count|0);
  if(w.guardActive==null){ w.guardActive=max; w.guardMax=max; w.guardCd=0; }
  if(w.guardMax!==max){
    const diff=max-(w.guardMax||0);
    w.guardActive=Math.max(0, Math.min(max, (w.guardActive||0)+Math.max(0,diff)));
    w.guardMax=max;
    if(w.guardActive>=max) w.guardCd=0;
  }
}

function trySkullGuard(amt, src){
  if((player.skullGuardHitCd||0)>0) return { blocked:false, amount:amt };
  let best=null, bestStats=null;
  for(const w of player.weapons||[]){
    const b=WEAPON_TYPES[w.key];
    if(!b || b.mode!=='orbit') continue;
    const s=wstats(w.key,w.lvl);
    syncOrbitGuard(w,s);
    if((w.guardActive||0)>0){ best=w; bestStats=s; break; }
  }
  if(!best) return { blocked:false, amount:amt };
  const b=WEAPON_TYPES[best.key]||{};
  const block=Math.max(0, Math.min(0.9, b.guardBlock||0.5));
  best.guardActive=Math.max(0,(best.guardActive||0)-1);
  best.guardCd=b.guardRecover||5;
  player.skullGuardHitCd=0.25;
  const color=best.key==='orbitX'?0xff335f:0xff7aa0;
  spawnRing(player.x, player.z, color, 2.4, 0.25);
  spawnBurst(player.x, player.z, color, best.key==='orbitX'?14:9, 0.85);
  if(src && src.alive && best.key==='orbitX'){
    dealEnemyDamage(src, Math.max(1, Math.round(bestStats.dmg*1.4)), color, src.x-player.x, src.z-player.z, 2.2, true);
  }
  return { blocked:true, amount:Math.max(1, Math.round(amt*(1-block))) };
}

// ---- Centralized damage: every weapon/proc routes through here ----
// Applies per-target item multipliers, shield, crits, knockback, on-hit procs.
function hitMul(e){
  let m = 1;
  if ((e.isBoss||e.elite) && player._bossBuster) m *= 1 + 0.15*player._bossBuster;
  if (player._beefy)   m *= 1 + 0.20*player._beefy*Math.floor(player.maxHp/100);
  if (player._goggles) m *= 1 + 0.60*player._goggles*(1-player.hp/player.maxHp);
  if (player._brass){ const dx=e.x-player.x, dz=e.z-player.z; if (dx*dx+dz*dz < 9) m *= 1 + 0.20*player._brass; }
  if (player._eagle && e.airborne) m *= 1 + 0.66*player._eagle;
  if (player._creditCard) m *= 1 + 0.025*player._creditCard*chestsOpened;
  if (player._idle && (player.stillT||0) > 3) m *= 1 + 1.0*player._idle;
  if (player.killDmgBonus) m *= 1 + player.killDmgBonus;
  return m;
}
function rollCrit(){
  const chance=Math.max(0, Math.min(0.75, player.critChance||0));
  if(chance<=0 || Math.random()>=chance) return { crit:false, mul:1 };
  return { crit:true, mul:Math.max(1, player.critDmg||1.5) };
}
function dealEnemyDamage(e, dmg, color, kx, kz, kbCap, noProc){
  if (!e.alive) return;
  let d = dmg * hitMul(e);
  if (player.bonkChance && Math.random() < player.bonkChance) d *= 20;   // Big Bonk
  const crit=rollCrit();
  if(crit.crit) d *= crit.mul;
  if (e.shieldT > 0) d *= 0.4;                                           // Warden shield
  d = Math.round(d);
  if(e.final && e.finalPhase){
    if(e.phaseInvuln>0) d = 0;
    const floor = (e.finalPhase>1 || e.phaseInvuln>0) ? 1 : -Infinity;
    e.hp = Math.max(floor, e.hp - d);
  } else {
    e.hp -= d;
  }
  e.flash = 0.08;
  spawnDmg(e.x, e.z, d, color, crit.crit && d > 0);
  if (kbCap){ const kd=Math.hypot(kx,kz)||1, kb=Math.min(kbCap, d*0.045/Math.max(0.5,e.r))*(player.knockbackMul||0);
    e.kx += kx/kd*kb; e.kz += kz/kd*kb; }
  spawnBurst(e.x, e.z, color, 3, 0.5);
  if (!noProc) onHitProcs(e, d, color);
  if (e.hp <= 0) killEnemy(e);
}
function onHitProcs(e, d, color){
  if (player.freezeChance && Math.random() < player.freezeChance) e.slowT = Math.max(e.slowT||0, 1.2);   // Ice Crystal
  if (player.fireChance && Math.random() < player.fireChance){ e.burnDps = Math.max(e.burnDps||0, d*0.20); e.burnT = 3; }  // Dragonfire
  if (player.thunderChance && Math.random() < player.thunderChance) aoeProc(e.x, e.z, 3.0, d*0.4, 0x9ad8ff);   // Thunder Mitts
  if (player.spicyChance && Math.random() < player.spicyChance) aoeProc(e.x, e.z, 2.5, d*0.65, 0xff7a3a);      // Spicy Meatball
  if (player.blastChance && Math.random() < player.blastChance) aoeProc(e.x, e.z, 2.2, d*0.5, 0xffd24a, true); // Power Gloves
}
function aoeProc(x, z, radius, dmg, color, knock){
  spawnRing(x, z, color, radius*1.6, 0.32);
  forEachNearbyEnemy(x, z, radius+1, e=>{
    if (!e.alive) return;
    const dx=e.x-x, dz=e.z-z;
    if (dx*dx+dz*dz < (radius+e.r)*(radius+e.r))
      dealEnemyDamage(e, dmg, color, dx, dz, knock?3:0, true);
  });
}
function fireAim(s){
  sfx('shoot');
  const t = nearestEnemies(player.x, player.z, s.range, s.count);
  for (let i=0;i<s.count;i++){
    let dx,dz; if (t[i]){ dx=t[i].x-player.x; dz=t[i].z-player.z; }
    else { const a=Math.random()*Math.PI*2; dx=Math.cos(a); dz=Math.sin(a); }
    const l=Math.hypot(dx,dz)||1; spawnProjectile(dx/l, dz/l, s);
  }
}
function fireSpread(s){
  sfx('shoot');
  const t = nearestEnemies(player.x, player.z, s.range, 1)[0];
  const base = t ? Math.atan2(t.z-player.z, t.x-player.x) : (player.face<0?Math.PI:0);
  for (let i=0;i<s.count;i++){ const a = base + (s.count>1 ? (i/(s.count-1)-0.5)*(s.arc||0.6) : 0);
    spawnProjectile(Math.cos(a), Math.sin(a), s); }
}
const novaWaves = [];
let pixelRingTexture=null;
function getPixelRingTexture(){
  if (pixelRingTexture) return pixelRingTexture;
  const gen=typeof getSpriteFrameTexture==='function' ? getSpriteFrameTexture('fx_nova_gen',2,4) : null;
  if(gen){ pixelRingTexture=gen; return gen; }
  const cv=document.createElement('canvas'); cv.width=32; cv.height=32;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  for(let y=0;y<32;y++) for(let x=0;x<32;x++){
    const dx=x-15.5, dy=y-15.5, d=Math.hypot(dx,dy);
    if(d>10.5 && d<14.5){
      const a=(Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2);
      if(((a/(Math.PI/12))|0)%2===0 || d<12.2){
        ctx.fillStyle=d>13?'#fff3c0':d>11.8?'#ffc45a':'#d96628';
        ctx.fillRect(x,y,1,1);
      }
    }
  }
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter;
  t.generateMipmaps=false; pixelRingTexture=t; return t;
}
function spawnNovaWave(x,z,maxR,dmg,color,areaLife){
  const geo=new THREE.PlaneGeometry(2,2); geo.rotateX(-Math.PI/2);
  const ring=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map:getPixelRingTexture(), color, transparent:true, opacity:1,
    alphaTest:0.08, side:THREE.DoubleSide, depthWrite:false
  }));
  const m=ring;
  m.position.set(x, groundHeight(x,z)+0.12, z); m.scale.setScalar(0.5); scene.add(m);
  novaWaves.push({ x, z, r:0.5, maxR, speed:16/(areaLife||1), dmg, color, hit:new Set(), mesh:m, ring, wash:null });
}
function fireNova(s){ sfx('shoot'); const n=s.count, R=s.radius||6;
  for(let i=0;i<n;i++) spawnNovaWave(player.x, player.z, R*(0.6+0.4*(i+1)/n), s.dmg, s.color, s.areaLife); }
function fireSpiral(s){ sfx('shoot'); const base=gameTime*4; for(let i=0;i<s.count;i++){ const a=base+(i/s.count)*Math.PI*2; spawnProjectile(Math.cos(a), Math.sin(a), s); } }
const slashFx=[];
function fireSlash(s){
  sfx('shoot');
  const target=nearestEnemies(player.x, player.z, s.range, 1)[0];
  let dx=player.ldx, dz=player.ldz;
  if (target){ dx=target.x-player.x; dz=target.z-player.z; }
  if (!dx && !dz){ dx=player.face||1; dz=0; }
  const len=Math.hypot(dx,dz)||1, base=Math.atan2(dz/len,dx/len);
  for(let i=0;i<s.count;i++){
    const a=base+(s.count>1?(i/(s.count-1)-0.5)*(s.arc||0.45):0);
    spawnProjectile(Math.cos(a),Math.sin(a),s);
  }
}
function fireSmite(s){
  sfx('shoot');
  const t=nearestEnemies(player.x, player.z, s.range||11, 1)[0];
  if (!t) return;
  const tx=t.x, tz=t.z, R=s.radius||2.4;
  forEachNearbyEnemy(tx,tz,R+1,e=>{ if(!e.alive) return;
    if (Math.hypot(e.x-tx, e.z-tz) < R+e.r) dealEnemyDamage(e, s.dmg, s.color, e.x-tx, e.z-tz, 3.5); });
  const bm=new THREE.Sprite(new THREE.SpriteMaterial({
    map:getPixelProjectileTexture(s.shape||'smite',s.color), color:0xffffff,
    transparent:true, alphaTest:0.08, depthWrite:false
  }));
  if(s.shape==='lightning'){
    bm.scale.set(1.05,6.2,1); bm.position.set(tx,3.45,tz);
  } else {
    bm.scale.set(1.35,5.4,1); bm.position.set(tx,3.05,tz);
  }
  const fxLife=(s.shape==='lightning'?0.18:0.28)*(s.areaLife||1);
  scene.add(bm); slashFx.push({ mesh:bm, life:fxLife, max:fxLife, grow:0.04, baseScale:bm.scale.clone(), fade:1 });
  if(s.shape==='lightning'){
    spawnRing(tx,tz,0xbff8ff,R*1.25,0.22*(s.areaLife||1));
    spawnBurst(tx,tz,0x9eefff,12,0.65);
  } else {
    spawnRing(tx,tz,s.color,R*1.8,0.45*(s.areaLife||1));
    spawnBurst(tx,tz,s.color,8,0.8);
  }
}
const WFIRE = { aim:fireAim, spread:fireSpread, nova:fireNova, spiral:fireSpiral, slash:fireSlash, smite:fireSmite };
function updateOrbit(w, s, dt){
  const b = WEAPON_TYPES[w.key] || WEAPON_TYPES.orbit;
  syncOrbitGuard(w,s);
  if((player.skullGuardHitCd||0)>0) player.skullGuardHitCd=Math.max(0,player.skullGuardHitCd-dt);
  if((w.guardActive||0)<(w.guardMax||s.count)){
    w.guardCd=(w.guardCd||b.guardRecover||5)-dt;
    if(w.guardCd<=0){
      w.guardActive=Math.min(w.guardMax||s.count,(w.guardActive||0)+1);
      w.guardCd=(w.guardActive<(w.guardMax||s.count))?(b.guardRecover||5):0;
      spawnBurst(player.x, player.z, b.color, 6, 0.45);
    }
  }
  while (w.orbs.length < s.count){
    const m = new THREE.Sprite(new THREE.SpriteMaterial({
      map:tex.wpn_orbit, color:b.color, transparent:true, alphaTest:0.2, depthWrite:false
    }));
    m.scale.set(0.82,0.82,1);
    scene.add(m); w.orbs.push({ mesh:m, hit:new Map() });
  }
  const n = w.orbs.length;
  for (let i=0;i<n;i++){
    const o = w.orbs[i];
    const active=i<(w.guardActive||0);
    o.mesh.visible=active;
    if(!active) continue;
    const evolved=w.key==='orbitX';
    const ring=evolved && (i%2===0) ? 0.62 : 1;
    const dir=evolved && (i%2===0) ? -1 : 1;
    const orbitCount=evolved ? Math.ceil(n/2) : n;
    const slot=evolved ? Math.floor(i/2) : i;
    const ang = gameTime*b.orbitSpd*dir + (slot/orbitCount)*Math.PI*2;
    const ox = player.x + Math.cos(ang)*s.orbitR*ring, oz = player.z + Math.sin(ang)*s.orbitR*ring;
    o.mesh.position.set(ox, groundHeight(ox,oz)+0.9, oz);
    forEachNearbyEnemy(ox,oz,1.6,e=>{ if(!e.alive) return;
      if (Math.hypot(ox-e.x, oz-e.z) < e.r+0.5 && (o.hit.get(e)||0) <= gameTime){
        o.hit.set(e, gameTime + (s.tick||b.tick));
        dealEnemyDamage(e, s.dmg, b.color, e.x-ox, e.z-oz, 3);
      } });
  }
}
function updateWeapon(w, dt){
  const b = WEAPON_TYPES[w.key], s = wstats(w.key, w.lvl);
  if (b.mode === 'orbit'){ updateOrbit(w, s, dt); return; }
  w.cd -= dt;
  if (w.cd <= 0){ w.cd = 1/s.rate; WFIRE[b.mode](s); }
}
function weaponChoices(){
  const out = [];
  const tomeName = id => { const u = (typeof UPGRADES!=='undefined') ? UPGRADES.find(x=>x.id===id) : null; return u ? u.name : id; };
  for (const key in WEAPON_TYPES){
    const t = WEAPON_TYPES[key]; if (t.hidden) continue;
    const hint = t.evolveTo ? ' · ★Evolve: '+tomeName(t.evolveTome)+' ×3 @Lv8' : '';
    const w = player.weapons.find(x=>x.key===key);
    if (w){ if (w.lvl < 8) out.push({ id:'w_'+key, name:t.name+' Lv'+(w.lvl+1), desc:t.desc+hint, icon:t.icon, apply:()=>{ w.lvl++; } }); }
    else if (player.weapons.length < MAX_WEAPONS){ out.push({ id:'w_'+key, name:'NEW: '+t.name, desc:t.desc+hint, icon:t.icon, apply:()=>{ player.weapons.push(makeWeapon(key)); } }); }
  }
  // weapon evolutions: maxed weapon + paired tome (x3)
  for (const w of player.weapons){
    const t = WEAPON_TYPES[w.key];
    if (t && t.evolveTo && w.lvl>=8 && !w.evolved && (player.tomeCount[t.evolveTome]||0) >= 3){
      const ev = WEAPON_TYPES[t.evolveTo];
      out.push({ id:'evo_'+w.key, name:'\u2605 EVOLVE: '+ev.name, desc:ev.desc, icon:ev.icon, apply:()=>{ w.key=t.evolveTo; w.evolved=true; } });
    }
  }
  return out;
}
