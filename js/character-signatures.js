// ---- Character Signature Effects ----
// Every hero gets one small "wow" proc tied to their signature weapon family.
// Kuro Raijin keeps the Cursed Eye Mark + Raijin Wraith as the only multi-stage system.
// Central rules:
//  - triggers check player.char AND weapon family (evolved forms included)
//  - all proc damage uses noProc:true and meta {item:'sig_*'} so run summary stays clean
//  - one shared internal-cooldown store per run (player._sig.cds)
//  - no new Mark systems (Kuro-exclusive)

const SIGNATURE_CDS = {
  paladin:6, templar:5, ranger:4, huntress:4, sorceress:5, stormcaller:5,
  assassin:5, priestess:6, necromancer:5, slayer:5, it_support:5, striker:4, bamboo_man:6, frost_warden:4
};
// Manifest texture keys per hero — used to prefetch only the selected hero's
// FX at run start (the rest warm in the background; call sites all have fallbacks).
const SIGNATURE_FX_KEYS = {
  paladin:['fx_sig_aegis_of_light'],
  templar:['fx_sig_oathbone_shockwave'],
  ranger:['fx_sig_true_shot'],
  huntress:[],
  sorceress:['fx_sig_lingering_flame'],
  stormcaller:['fx_sig_overcharge'],
  assassin:['fx_sig_shadow_veil'],
  priestess:['fx_sig_radiant_wave'],
  necromancer:['fx_sig_vengeful_soul'],
  slayer:[],
  it_support:['fx_sig_lan_surge'],
  striker:['fx_sig_perfect_kick'],
  bamboo_man:['fx_sig_bonus_sprout'],
  kuro_raijin:[]
};
function signatureFxKeysFor(charKey){ return SIGNATURE_FX_KEYS[charKey]||[]; }
const SIGNATURE_STAT_NAMES = {
  sig_paladin:'Aegis of Light', sig_oathbone:'Oathbone Shockwave', sig_ranger:'Echo Arrow',
  sig_huntress:'True Shot', sig_sorceress:'Lingering Flame', sig_stormcaller:'Overcharge',
  sig_assassin:'Shadow Veil', sig_priestess:'Radiant Wave', sig_necromancer:'Vengeful Soul',
  sig_slayer:'Fury', sig_it_support:'LAN Surge', sig_striker:'Perfect Kick', sig_bamboo:'Bonus Sprout', sig_frost_warden:'Glacial Verdict'
};
const SIGNATURE_INFO = {
  paladin:     { th:'Shield Toss ปะทะศัตรูสะสมครบ 3 ตัว → โล่แสงลดดาเมจที่ได้รับ 15% นาน 3 วิ (CD 6 วิ)',
                 en:'Every 3 Shield Toss hits: gain a light shield (-15% damage taken) for 3s (CD 6s)' },
  templar:     { th:'Orbiting Skull โจมตีสะสมครบ 5 ครั้ง → คลื่นกระแทกเล็กผลักศัตรูรอบตัว (CD 5 วิ)',
                 en:'Every 5 Orbiting Skull hits: release a small knockback shockwave (CD 5s)' },
  ranger:      { th:'ลูกธนูโดนเป้า มีโอกาส 12% ยิงลูกเสริมใส่ศัตรูที่ใกล้ที่สุด (CD 4 วิ)',
                 en:'Arrow hits have a 12% chance to fire a bonus arrow at the nearest enemy (CD 4s)' },
  huntress:    { th:'ยิงเป้าหมายเดิมครบ 3 ครั้ง → นัดถัดไปคริติคอลการันตี (CD 4 วิ)',
                 en:'Hit the same target 3 times: your next hit is a guaranteed critical (CD 4s)' },
  sorceress:   { th:'คลื่น Nova โดนศัตรู 3 ตัวขึ้นไป → ทิ้งเปลวไฟบนพื้นเผาศัตรู (CD 5 วิ)',
                 en:'Nova waves that hit 3+ enemies leave a burning patch on the ground (CD 5s)' },
  stormcaller: { th:'คริติคอลสะสมครบ 5 ครั้ง → Lightning Strike นัดถัดไปโจมตีเป้าเพิ่ม +1 (CD 5 วิ)',
                 en:'Every 5 critical hits: your next Lightning Strike hits +1 target (CD 5s)' },
  assassin:    { th:'ฆ่าศัตรูด้วยคริติคอล → อมตะ 0.4 วิ (CD 5 วิ)',
                 en:'Critical kills grant 0.4s of invulnerability (CD 5s)' },
  priestess:   { th:'ฟื้นเลือดจริงสะสมครบ 25 HP → ปล่อยคลื่นแสงทำดาเมจรอบตัว (CD 6 วิ)',
                 en:'Every 25 HP actually healed: release a radiant damage wave (CD 6s)' },
  necromancer: { th:'ศัตรูตายใกล้ตัวมีโอกาส 10% ปล่อยวิญญาณพุ่งใส่ศัตรูที่ใกล้ที่สุด (CD 5 วิ)',
                 en:'Enemies dying nearby have a 10% chance to release a vengeful soul at the nearest foe (CD 5s)' },
  slayer:      { th:'ฆ่าศัตรูสะสม 30 (Elite/Miniboss นับ 5) → Fury ความเร็วโจมตี +8% นาน 4 วิ',
                 en:'Every 30 kills (elites count as 5): gain Fury, +8% attack speed for 4s' },
  it_support:  { th:'แทงโดนศัตรู 4 ตัวในครั้งเดียว → ปล่อยไฟฟ้าสาย LAN ใส่เป้าหมายถัดไป (CD 5 วิ)',
                 en:'Stab 4 enemies in one attack: zap the next nearest target with LAN surge (CD 5s)' },
  striker:     { th:'ลูกบอลชิ่งสะสมครบ 3 ครั้ง → ลูกถัดไปเป็น Perfect Kick แรงขึ้นและชิ่งเพิ่ม (CD 4 วิ)',
                 en:'Every 3 accumulated bounces: the next ball is a Perfect Kick, stronger with +1 bounce (CD 4s)' },
  bamboo_man:  { th:'หน่อไม้หลักแทงศัตรูครบ 5 ตัว → งอกหน่อโบนัสเพิ่ม 1 จุด (CD 6 วิ)',
                 en:'Main bamboo patches hitting 5 enemies sprout 1 bonus patch (CD 6s)' },
  frost_warden:{ th:'Frost Familiar โจมตีศัตรูไม่ซ้ำกันครบ 6 ตัว -> เรียกหอกน้ำแข็งลงพื้นที่ แช่แข็งศัตรูรอบจุดตก (CD 4 วิ)',
                 en:'Frost Familiar hits 6 different enemies: call down a Glacial Verdict that freezes the area (CD 4s)' },
  kuro_raijin: { th:'Cursed Eye: Mark เป้าหมายด้วยคริติคอล และเรียก Raijin Wraith เมื่อคริซ้ำ (เอกลักษณ์เฉพาะตัว)',
                 en:'Cursed Eye: crits Mark targets; repeated crits summon the Raijin Wraith (unique multi-stage kit)' }
};

function signatureDesc(charKey){
  const info=SIGNATURE_INFO[charKey];
  if(!info) return '';
  return (typeof gameLang==='function'&&gameLang()==='en') ? info.en : info.th;
}

function sigState(){
  if(!player._sig) player._sig={ cds:{}, count:0, huntWindowUntil:0, novaUntil:0, novaSet:null,
    stabUntil:0, stabSet:null, bambooSet:null, frostUntil:0, frostSet:null, healAccum:0, prevHp:null,
    furyUntil:0, furyActive:false, shieldUntil:0, shieldFxAt:0, flames:[] };
  return player._sig;
}
function sigReady(){ return (sigState().cds[player.char]||0)<=gameTime; }
function sigTrigger(){ sigState().cds[player.char]=gameTime+(SIGNATURE_CDS[player.char]||5); }
function sigMeta(meta){
  if(!meta) return false;
  return String(meta.item||'').startsWith('sig_') || String(meta.weapon||'').startsWith('sig_');
}
function sigFamilyHit(meta, base){
  return !!(meta && meta.weapon && typeof weaponMatchesFamily==='function' && weaponMatchesFamily(meta.weapon, base));
}
function sigGlacialVerdict(target){
  const w=(player.weapons||[]).find(x=>weaponMatchesFamily(x.key,'frost_familiar'));
  const dmg=Math.max(1,Math.round((w?wstats(w.key,w.lvl).dmg:16)*1.20));
  const radius=2.4;
  if(!spawnSignatureFx('glacial_verdict',target.x,target.z,2.3,0.48,0x9cecff)) spawnRing(target.x,target.z,0x9cecff,3.5,0.34);
  spawnBurst(target.x,target.z,0xc8f5ff,12,0.72);
  spawnDmg(target.x,target.z,'GLACIAL VERDICT',0x9cecff,false,'critproc');
  forEachNearbyEnemy(target.x,target.z,radius+1,e=>{
    if(!e.alive) return;
    const dx=e.x-target.x, dz=e.z-target.z;
    if(dx*dx+dz*dz<(radius+e.r)*(radius+e.r)){
      e.slowT=Math.max(e.slowT||0,1.2*(player.freezeDurationMul||1));
      dealEnemyDamage(e,dmg,0x9cecff,dx,dz,2.5,true,{item:'sig_frost_warden'});
    }
  });
  recordRunItem('sig_frost_warden',{procs:1});
  sfx('guard');
}

// ---- per-effect helpers ----
function sigShockwave(){
  const dmg=Math.max(1,Math.round(6+player.level*0.8));
  if(!spawnSignatureFx('oathbone_shockwave',player.x,player.z,3.6,0.42,0xd8c07a)) spawnRing(player.x,player.z,0xd8c07a,4.6,0.32);
  spawnBurst(player.x,player.z,0xd8c07a,10,0.7);
  spawnDmg(player.x,player.z,'OATH',0xd8c07a,false,'critproc');
  recordRunItem('sig_oathbone',{ procs:1 });
  forEachNearbyEnemy(player.x,player.z,4.2,e=>{
    if(!e.alive) return;
    const dx=e.x-player.x, dz=e.z-player.z;
    if(dx*dx+dz*dz<(3.2+e.r)*(3.2+e.r)) dealEnemyDamage(e,dmg,0xd8c07a,dx,dz,3,true,{ item:'sig_oathbone' });
  });
  sfx('guard');
}
function sigBonusArrow(){
  const w=(player.weapons||[]).find(x=>weaponMatchesFamily(x.key,'arrow'));
  if(!w) return false;
  const s=wstats(w.key,w.lvl);
  const t=nearestEnemies(player.x,player.z,s.range||15,1)[0];
  if(!t) return false;
  const dx=t.x-player.x, dz=t.z-player.z, l=Math.hypot(dx,dz)||1;
  spawnProjectile(dx/l,dz/l,Object.assign({},s,{
    dmg:Math.max(1,Math.round(s.dmg*0.6)), count:1, baseCount:1, pierce:Math.min(2,s.pierce||1),
    sourceKey:'sig_ranger'
  }));
  if(!spawnSignatureFx('true_shot',t.x,t.z,1.25,0.36,0x8ef06a)) spawnDmg(player.x,player.z,'ECHO',0x8ef06a,false,'critproc');
  spawnDmg(player.x,player.z,'ECHO',0x8ef06a,false,'critproc');
  recordRunItem('sig_ranger',{ procs:1 });
  return true;
}
function sigLanSurge(excludeSet){
  let best=null, bd=Infinity;
  forEachNearbyEnemy(player.x,player.z,9,e=>{
    if(!e.alive || (excludeSet&&excludeSet.has(e))) return;
    const d=(e.x-player.x)*(e.x-player.x)+(e.z-player.z)*(e.z-player.z);
    if(d<bd){ bd=d; best=e; }
  });
  if(!best && excludeSet){ for(const e of excludeSet){ if(e.alive){ best=e; break; } } }
  if(!best) return false;
  const dmg=Math.max(1,Math.round(10+player.level*1.2));
  if(!spawnSignatureFx('lan_surge',best.x,best.z,1.8,0.42,0x64d7ff)) spawnRing(best.x,best.z,0x64d7ff,1.8,0.2);
  spawnBurst(best.x,best.z,0x64d7ff,8,0.6);
  spawnDmg(player.x,player.z,'LAN SURGE',0x64d7ff,false,'critproc');
  dealEnemyDamage(best,dmg,0x64d7ff,best.x-player.x,best.z-player.z,2,true,{ item:'sig_it_support' });
  recordRunItem('sig_it_support',{ procs:1 });
  sfx('crit');
  return true;
}
function sigVengefulSoul(corpse){
  let best=null, bd=Infinity;
  forEachNearbyEnemy(corpse.x,corpse.z,12,e=>{
    if(!e.alive) return;
    const d=(e.x-corpse.x)*(e.x-corpse.x)+(e.z-corpse.z)*(e.z-corpse.z);
    if(d>0.04 && d<bd){ bd=d; best=e; }
  });
  if(!best) return false;
  const w=(player.weapons||[]).find(x=>weaponMatchesFamily(x.key,'soulspiral'));
  const baseDmg=w?Math.round(wstats(w.key,w.lvl).dmg*0.6):Math.round(8+player.level);
  const dx=best.x-corpse.x, dz=best.z-corpse.z, l=Math.hypot(dx,dz)||1;
  const ox=player.x, oz=player.z;
  try {
    player.x=corpse.x; player.z=corpse.z;   // spawnProjectile fires from player position
    spawnProjectile(dx/l,dz/l,{ dmg:Math.max(1,baseDmg), pierce:1, speed:14, life:1.1,
      color:0xb06aff, shape:'soul', sourceKey:'sig_necromancer', skillSizeMul:0.85 });
  } finally {
    player.x=ox; player.z=oz;
  }
  if(!spawnSignatureFx('vengeful_soul',corpse.x,corpse.z,1.35,0.48,0xb06aff)) spawnBurst(corpse.x,corpse.z,0xb06aff,7,0.55);
  recordRunItem('sig_necromancer',{ procs:1 });
  return true;
}
function sigRadiantWave(){
  const dmg=Math.max(1,Math.round(8+player.level));
  if(!spawnSignatureFx('radiant_wave',player.x,player.z,4.2,0.52,0xfff2c0)) spawnRing(player.x,player.z,0xfff2c0,5.6,0.4);
  spawnBurst(player.x,player.z,0xfff2c0,12,0.8);
  spawnDmg(player.x,player.z,'RADIANCE',0xfff2c0,false,'critproc');
  recordRunItem('sig_priestess',{ procs:1 });
  forEachNearbyEnemy(player.x,player.z,5,e=>{
    if(!e.alive) return;
    const dx=e.x-player.x, dz=e.z-player.z;
    if(dx*dx+dz*dz<(4+e.r)*(4+e.r)) dealEnemyDamage(e,dmg,0xfff2c0,dx,dz,2,true,{ item:'sig_priestess' });
  });
  sfx('levelup');
}
function sigFlamePatch(x,z){
  const s=sigState();
  if(s.flames.length>=3) s.flames.shift();
  s.flames.push({ x, z, r:2.0, life:2.4, tick:0 });
  if(!spawnSignatureFx('lingering_flame',x,z,2.0,0.75,0xff7a3a)) spawnRing(x,z,0xff7a3a,2.6,0.35);
  spawnBurst(x,z,0xff7a3a,10,0.7);
  recordRunItem('sig_sorceress',{ procs:1 });
}
function sigBonusBambooPatch(x,z){
  const w=(player.weapons||[]).find(k=>weaponMatchesFamily(k.key,'bamboo_spikes'));
  if(!w) return false;
  const bonusAlive=bambooPatches.filter(b=>b.alive&&b.sourceKey==='sig_bamboo').length;
  if(bonusAlive>=2) return false;
  const s=wstats(w.key,w.lvl);
  spawnBambooPatch(x,z,Object.assign({},s,{ sourceKey:'sig_bamboo', dmg:Math.max(1,Math.round(s.dmg*0.6)) }),0);
  spawnSignatureFx('bonus_sprout',x,z,1.7,0.62,0xa8e36a);
  spawnDmg(x,z,'SPROUT',0xa8e36a,false,'critproc');
  recordRunItem('sig_bamboo',{ procs:1 });
  return true;
}

// ---- hooks (called from combat.js / game-systems.js / game-loop.js) ----
function signatureOnEnemyHit(e, dmg, isCrit, meta, noProc){
  // Secondary/proc damage must not advance a Signature counter.
  if(!player || !player.alive || !e) return;
  e._sigLastCrit=!!isCrit;
  if(noProc || sigMeta(meta)) return;
  const ch=player.char, s=sigState();
  if(ch==='paladin'){
    if(!sigFamilyHit(meta,'shieldtoss')) return;
    s.count++;
    if(s.count>=3 && sigReady()){
      s.count=0; sigTrigger();
      s.shieldUntil=gameTime+3;
      if(!spawnSignatureFx('aegis_of_light',player.x,player.z,2.8,0.62,0xbfe8ff)) spawnRing(player.x,player.z,0xbfe8ff,3.0,0.3);
      spawnDmg(player.x,player.z,'AEGIS',0xbfe8ff,false,'guard');
      recordRunItem('sig_paladin',{ procs:1 });
      sfx('guard');
    }
  } else if(ch==='templar'){
    if(!sigFamilyHit(meta,'orbit')) return;
    s.count++;
    if(s.count>=5 && sigReady()){ s.count=0; sigTrigger(); sigShockwave(); }
  } else if(ch==='ranger'){
    if(!sigFamilyHit(meta,'arrow') || !sigReady()) return;
    if(signatureRandom()<0.12 && sigBonusArrow()) sigTrigger();
  } else if(ch==='huntress'){
    if(!sigFamilyHit(meta,'spread')) return;
    if(gameTime>(e._sigHuntAt||0)) e._sigHunt=0;
    e._sigHunt=(e._sigHunt||0)+1;
    e._sigHuntAt=gameTime+2;
    if(e._sigHunt>=3 && sigReady()){
      e._sigHunt=0; sigTrigger();
      // Only the next Spread-family hit may consume this guaranteed crit.
      player._sigGuaranteedCritFamily='spread';
      spawnDmg(player.x,player.z,'TRUE SHOT',0x66ccff,false,'critproc');
      recordRunItem('sig_huntress',{ procs:1 });
    }
  } else if(ch==='sorceress'){
    if(!sigFamilyHit(meta,'nova')) return;
    if(gameTime>s.novaUntil){ s.novaUntil=gameTime+0.5; s.novaSet=new Set(); }
    s.novaSet.add(e);
    if(s.novaSet.size>=3 && sigReady()){ sigTrigger(); sigFlamePatch(e.x,e.z); s.novaSet.clear(); }
  } else if(ch==='stormcaller'){
    if(!isCrit) return;
    s.count++;
    if(s.count>=5 && sigReady()){
      s.count=0; sigTrigger();
      player._sigOvercharge=1;
      if(!spawnSignatureFx('overcharge',player.x,player.z,2.4,0.46,0x7ce7ff)) spawnBurst(player.x,player.z,0x7ce7ff,10,0.7);
      spawnDmg(player.x,player.z,'OVERCHARGE',0x7ce7ff,false,'critproc');
      recordRunItem('sig_stormcaller',{ procs:1 });
    }
  } else if(ch==='it_support'){
    if(!sigFamilyHit(meta,'toolstab')) return;
    if(gameTime>s.stabUntil){ s.stabUntil=gameTime+0.3; s.stabSet=new Set(); }
    s.stabSet.add(e);
    if(s.stabSet.size>=4 && sigReady()){ sigTrigger(); sigLanSurge(s.stabSet); s.stabSet.clear(); }
  } else if(ch==='bamboo_man'){
    if(!sigFamilyHit(meta,'bamboo_spikes')) return;
    if(!s.bambooSet) s.bambooSet=new Set();
    s.bambooSet.add(e);
    if(s.bambooSet.size>=5 && sigReady()){
      if(sigBonusBambooPatch(e.x,e.z)) sigTrigger();
      s.bambooSet.clear();
    }
  } else if(ch==='frost_warden'){
    if(!sigFamilyHit(meta,'frost_familiar')) return;
    if(gameTime>s.frostUntil){ s.frostUntil=gameTime+1.5; s.frostSet=new Set(); }
    s.frostSet.add(e);
    if(s.frostSet.size>=6 && sigReady()){
      s.frostSet.clear(); sigTrigger(); sigGlacialVerdict(e);
    }
  }
}

function signatureOnKill(e){
  if(!player || !player.alive || !e) return;
  const ch=player.char, s=sigState();
  e._sigHunt=0;
  e._sigHuntAt=0;
  if(ch==='assassin'){
    if(e._sigLastCrit && sigReady()){
      sigTrigger();
      player.invuln=Math.max(player.invuln||0,0.4);
      if(!spawnSignatureFx('shadow_veil',player.x,player.z,2.2,0.48,0x9a8cff) && typeof spawnAfterimage==='function') spawnAfterimage(0x9a8cff);
      spawnDmg(player.x,player.z,'VANISH',0x9a8cff,false,'guard');
      recordRunItem('sig_assassin',{ procs:1 });
    }
  } else if(ch==='slayer'){
    s.count+=((e.isBoss&&e.elite)||e.elite)?5:1;
    if(s.count>=30 && sigReady()){
      s.count=0; sigTrigger();
      if(!s.furyActive){ s.furyActive=true; player.rateMul*=1.08; }
      s.furyUntil=gameTime+4;
      spawnDmg(player.x,player.z,'FURY',0xff5566,false,'critproc');
      spawnRing(player.x,player.z,0xff5566,2.6,0.28);
      recordRunItem('sig_slayer',{ procs:1 });
    }
  } else if(ch==='necromancer'){
    const dx=e.x-player.x, dz=e.z-player.z;
    if(dx*dx+dz*dz>36 || !sigReady()) return;
    if(signatureRandom()<0.10 && sigVengefulSoul(e)) sigTrigger();
  }
}

function signatureOnRicochet(p){
  if(!player || player.char!=='striker' || !p) return;
  if(p.sourceKey && String(p.sourceKey).startsWith('sig_')) return;
  if(!(p.shape==='football')) return;
  const s=sigState();
  s.count++;
  if(s.count>=3 && sigReady()){
    s.count=0; sigTrigger();
    player._sigPerfectKick=1;
    spawnDmg(player.x,player.z,'PERFECT KICK READY',0xf2f0d8,false,'critproc');
  }
}

function signatureModifyProjectile(p){
  if(!player || !p) return;
  if(player.char==='striker' && player._sigPerfectKick && p.shape==='football' && !(String(p.sourceKey||'').startsWith('sig_'))){
    player._sigPerfectKick=0;
    p.dmg=Math.max(1,Math.round(p.dmg*1.5));
    p.bouncesLeft=(p.bouncesLeft||0)+1;
    p.trailScale=(p.trailScale||0.34)*1.6;
    p.trailEvery=1; p.noTrail=false;
    if(!spawnSignatureFx('perfect_kick',player.x,player.z,1.8,0.42,0xffd86a)) spawnBurst(player.x,player.z,0xffd86a,8,0.6);
    recordRunItem('sig_striker',{ procs:1 });
  }
}

function signatureModifyWeaponFire(w, s){
  if(!player || !w || !s) return s;
  if(player.char==='stormcaller' && player._sigOvercharge && weaponMatchesFamily(w.key,'lightning')){
    player._sigOvercharge=0;
    return Object.assign({},s,{ count:(s.count||1)+1 });
  }
  return s;
}

function signatureModifyPlayerDamage(amt){
  if(!player || player.char!=='paladin' || amt<=0) return amt;
  const s=sigState();
  if(s.shieldUntil>gameTime){
    if(gameTime>s.shieldFxAt){ s.shieldFxAt=gameTime+0.3; spawnDmg(player.x,player.z,'AEGIS',0xbfe8ff,false,'guard'); }
    return Math.max(1,Math.round(amt*0.85));
  }
  return amt;
}

function updateSignatures(dt){
  if(!player || !player.alive) return;
  const s=sigState();
  // Priestess: count only HP actually gained
  if(player.char==='priestess'){
    if(s.prevHp!=null && player.hp>s.prevHp) s.healAccum+=player.hp-s.prevHp;
    s.prevHp=player.hp;
    if(s.healAccum>=25 && sigReady()){ s.healAccum-=25; sigTrigger(); sigRadiantWave(); }
  } else s.prevHp=player.hp;
  // Slayer fury expiry (multiplicative revert, no stacking)
  if(s.furyActive && gameTime>=s.furyUntil){ s.furyActive=false; player.rateMul/=1.08; }
  // Sorceress lingering flames
  for(let i=s.flames.length-1;i>=0;i--){
    const f=s.flames[i];
    f.life-=dt; f.tick-=dt;
    if(f.tick<=0){
      f.tick=0.45;
      spawnRing(f.x,f.z,0xff7a3a,f.r*1.15,0.18);
      forEachNearbyEnemy(f.x,f.z,f.r+1,e=>{
        if(!e.alive) return;
        const dx=e.x-f.x, dz=e.z-f.z;
        if(dx*dx+dz*dz<(f.r+e.r)*(f.r+e.r)){
          e.sigBurnT=Math.max(e.sigBurnT||0,1.2);
          e.sigBurnDps=Math.max(e.sigBurnDps||0,5+player.level*0.6);
        }
      });
    }
    if(f.life<=0) s.flames.splice(i,1);
  }
}
