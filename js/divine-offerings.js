// Divine Offering: one active covenant power selected before a run.
const DIVINE_OFFERING_COOLDOWN = 90;
const DIVINE_OFFERING_OPENING_COOLDOWN = 30;
const DIVINE_OFFERING_COOLDOWNS = Object.freeze({
  astra:80,
  veyra:75,
  morvane:90,
  solarius:90,
  nhal:120,
  serapha:120,
  fenrir:100,
  tharos:105,
  eirene:120,
  midas:120
});
const DIVINE_OFFERING_LAST_KEY = 'sc3_divine_offering_v1';
const DIVINE_OFFERING_STATE_KEY = 'sc3_divine_offerings_owned_v1';
const DIVINE_OFFERING_PRICE = 1500;
const DIVINE_SCALING_DAMAGE_IDS = new Set(['astra','veyra','morvane','solarius','nhal']);

const DIVINE_OFFERINGS = [
  { id:'astra', name:'Astra', title:'Blade Saint', rune:'⚔', color:0xf2cf72, icon:0,
    cost:'HP ปัจจุบัน 12%', effect:'ดาบวิญญาณฟันเป็นคลื่น 6 ชั้นรอบตัว', short:'ล้างฝูง · ระยะกลาง' },
  { id:'veyra', name:'Veyra', title:'Storm Mother', rune:'ϟ', color:0x82cfff, icon:1,
    cost:'XP ในหลอดปัจจุบัน 8%', effect:'ฟ้าผ่า 12 เป้าหมายต่อเนื่อง 4 รอบ', short:'ล็อกเป้า · คริติคอลได้' },
  { id:'morvane', name:'Morvane', title:'Lord of Graves', rune:'☠', color:0x8be08f, icon:2,
    cost:'วิญญาณศัตรู 20 ดวง', effect:'เรียกวิญญาณนักรบช่วยโจมตี 18 วินาที', short:'กองทัพชั่วคราว' },
  { id:'solarius', name:'Solarius', title:'Golden Judge', rune:'☀', color:0xffd45c, icon:3,
    cost:'ทองที่ถืออยู่ 15%', effect:'พิพากษาทั้งสนาม ดาเมจเพิ่มตามทองที่ถวาย', short:'กวาดสนาม · ชะงักบอส' },
  { id:'nhal', name:'Nhal', title:'The Devouring Void', rune:'●', color:0x9b5cff, icon:4,
    cost:'Max HP 5% ตลอดรัน', effect:'หลุมดำดูดศัตรู 8 วินาทีแล้วระเบิด', short:'รวมฝูง · ความเสี่ยงสะสม' },
  { id:'serapha', name:'Serapha', title:'Phoenix Queen', rune:'♨', color:0xff6848, icon:5,
    cost:'HP ลดเหลือ 1', effect:'อมตะและเผาศัตรู 4 วินาที จากนั้นฟื้น HP 35%', short:'พลิกสถานการณ์' },
  { id:'fenrir', name:'Fenrir', title:'Moonbound Hunter', rune:'◢', color:0xa9c4ff, icon:6,
    cost:'Armor ลดครึ่งหนึ่ง 12 วินาที', effect:'เดินเร็ว 40% ยิงเร็ว 35% และคริติคอล +25%', short:'เร่งดาเมจใส่บอส' },
  { id:'tharos', name:'Tharos', title:'Iron Colossus', rune:'⬡', color:0xb7c7d8, icon:7,
    cost:'ใช้ Dash ไม่ได้ 15 วินาที', effect:'โล่วิญญาณ 40% Max HP พร้อมสะท้อนดาเมจ', short:'รับแรงปะทะ' },
  { id:'eirene', name:'Eirene', title:'Keeper of Time', rune:'◷', color:0x74f0e4, icon:8,
    cost:'อาวุธหยุดยิง 3 วินาที', effect:'หยุดศัตรู 5 วินาที แล้วเร่งโจมตี 200% นาน 8 วินาที', short:'ตั้งหลัก · ระเบิดดาเมจ' },
  { id:'midas', name:'Midas', title:'Laughing Trickster', rune:'?', color:0xff9ad8, icon:9,
    cost:'สุ่มเสียทอง HP หรือ XP', effect:'สุ่ม Jackpot, พลัง, เปลี่ยนมอนเป็นทอง หรือ Mimic', short:'เสี่ยงโชคเต็มรูปแบบ' }
];

let selectedDivineOfferingId = localStorage.getItem(DIVINE_OFFERING_LAST_KEY) || '';
let activeDivineOfferingId = selectedDivineOfferingId;
const divineDelayed = [];
const divineVisualFx = [];
const divineTexturePool = new Map();

function acquireDivineTexture(key,base){
  const pool=divineTexturePool.get(key);
  if(pool&&pool.length){ const map=pool.pop(); map.offset.set(0,0); return map; }
  const map=base.clone();
  map.magFilter=THREE.NearestFilter; map.minFilter=THREE.NearestFilter; map.generateMipmaps=false;
  map.repeat.set(1/6,1); map.offset.set(0,0); map.needsUpdate=true; map._divinePoolKey=key;
  return map;
}

function releaseDivineVisual(f){
  if(!f||!f.mesh) return;
  scene.remove(f.mesh);
  const mat=f.mesh.material, map=mat&&mat.map;
  if(mat){ mat.map=null; mat.dispose(); }
  if(map&&map._divinePoolKey){
    const key=map._divinePoolKey, pool=divineTexturePool.get(key)||[];
    if(pool.length<14){ pool.push(map); divineTexturePool.set(key,pool); }
    else map.dispose();
  }
}

function clearDivineVisualFx(){
  for(const f of divineVisualFx) releaseDivineVisual(f);
  divineVisualFx.length=0;
}

function spawnDivineVisual(key,x,z,size,life,opts){
  opts=opts||{};
  const base=tex[key];
  if(!base) return null;
  const limit=IS_MOBILE?16:28;
  while(divineVisualFx.length>=limit) releaseDivineVisual(divineVisualFx.shift());
  const map=acquireDivineTexture(key,base);
  let mesh;
  if(opts.upright){
    const mat=new THREE.SpriteMaterial({map,color:0xffffff,transparent:true,opacity:0.96,alphaTest:0.04,depthWrite:false,blending:THREE.AdditiveBlending});
    mesh=new THREE.Sprite(mat); mesh.center.set(0.5,opts.centerY==null?0.15:opts.centerY);
  } else {
    const mat=new THREE.MeshBasicMaterial({map,color:0xffffff,transparent:true,opacity:0.94,alphaTest:0.04,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
    mesh=new THREE.Mesh(EFFECT_PLANE_GEO,mat); mesh.rotation.z=opts.rotation||0;
  }
  mesh.scale.set(size,size,1);
  mesh.position.set(x,groundHeight(x,z)+(opts.upright?0.08:0.22),z);
  scene.add(mesh);
  const f={key,x,z,size,life,max:life,t:0,frames:6,fps:opts.fps||12,loop:!!opts.loop,upright:!!opts.upright,
    followPlayer:!!opts.followPlayer,vx:opts.vx||0,vz:opts.vz||0,grow:opts.grow==null?0.12:opts.grow,until:opts.until||null,map,mesh};
  divineVisualFx.push(f); return f;
}

function updateDivineVisualFx(dt){
  for(let i=divineVisualFx.length-1;i>=0;i--){
    const f=divineVisualFx[i]; f.t+=dt; f.life-=dt;
    if(f.until && !f.until()) f.life=0;
    if(f.life<=0){ releaseDivineVisual(f); divineVisualFx.splice(i,1); continue; }
    if(f.followPlayer && player){ f.x=player.x; f.z=player.z; }
    f.x+=f.vx*dt; f.z+=f.vz*dt;
    const p=Math.min(1,f.t/f.max);
    let frame=f.loop ? Math.floor(f.t*f.fps)%f.frames : Math.min(f.frames-1,Math.floor(p*f.frames));
    let shieldRatio=1;
    if(f.key==='fx_divine_tharos' && player){
      shieldRatio=Math.max(0,Math.min(1,(player.divineShield||0)/Math.max(1,player.divineShieldMax||1)));
      frame=Math.min(f.frames-1,Math.floor((1-shieldRatio)*f.frames));
    }
    f.map.offset.x=frame/f.frames;
    const scale=f.size*(1+f.grow*p);
    f.mesh.scale.set(scale,scale,1);
    f.mesh.position.set(f.x,groundHeight(f.x,f.z)+(f.upright?0.08:0.22),f.z);
    f.mesh.material.opacity=Math.min(1,f.loop?0.92:Math.min(p*5,(1-p)*3))*0.96*(f.key==='fx_divine_tharos'?(0.48+shieldRatio*0.52):1);
  }
}

function divineOfferingById(id){ return DIVINE_OFFERINGS.find(o=>o.id===id) || null; }
function activeDivineOffering(){ return divineOfferingById(activeDivineOfferingId); }
function divineOfferingCooldown(id){ return DIVINE_OFFERING_COOLDOWNS[id] || DIVINE_OFFERING_COOLDOWN; }
function divineOfferingDamageScale(id,target){
  if(!DIVINE_SCALING_DAMAGE_IDS.has(id)) return 1;
  const stageMul=mapStage>=3?2.0:mapStage>=2?1.4:1;
  const overtimeMul=Math.sqrt(Math.max(1,typeof overtimeTier==='function'?overtimeTier():1));
  const bossMul=target&&target.isBoss?(id==='veyra'?1.5:id==='astra'?1.25:1):1;
  return stageMul*overtimeMul*bossMul;
}
function divineOfferingScalingText(id){
  if(!DIVINE_SCALING_DAMAGE_IDS.has(id)) return '';
  const en=typeof gameLang==='function'&&gameLang()==='en';
  const boss=id==='veyra'?' · Boss x1.5':id==='astra'?' · Boss x1.25':'';
  return en
    ? `Damage scaling: Map 1 x1.0 · Map 2 x1.4 · Map 3 x2.0 · Overtime √tier${boss}`
    : `ดาเมจตามด่าน: Map 1 x1.0 · Map 2 x1.4 · Map 3 x2.0 · Overtime √ระดับ${boss}`;
}
function loadDivineOfferingState(){
  try{ const parsed=JSON.parse(localStorage.getItem(DIVINE_OFFERING_STATE_KEY)||'{}'); return {owned:parsed&&parsed.owned&&typeof parsed.owned==='object'?parsed.owned:{}}; }
  catch(_){ return {owned:{}}; }
}
function saveDivineOfferingState(state){ try{ localStorage.setItem(DIVINE_OFFERING_STATE_KEY,JSON.stringify(state||{owned:{}})); }catch(_){} }
function isDivineOfferingOwned(id){ return !!(loadDivineOfferingState().owned||{})[id]; }
function exportDivineOfferingProgress(){ return loadDivineOfferingState(); }
function importDivineOfferingProgress(remote){
  if(!remote||typeof remote!=='object') return false;
  const local=loadDivineOfferingState(), owned=remote.owned&&typeof remote.owned==='object'?remote.owned:{}; let changed=false;
  for(const [id,at] of Object.entries(owned)){ if(!divineOfferingById(id)||local.owned[id]) continue; local.owned[id]=at||new Date().toISOString(); changed=true; }
  if(changed) saveDivineOfferingState(local);
  return changed;
}
function unlockAllDivineOfferingsForTesting(){
  const state=loadDivineOfferingState();
  for(const o of DIVINE_OFFERINGS) if(!state.owned[o.id]) state.owned[o.id]=new Date().toISOString();
  saveDivineOfferingState(state); return Object.keys(state.owned).length;
}
function divineHex(color){ return '#'+Number(color||0xffffff).toString(16).padStart(6,'0'); }
function divineIconStyle(o){
  const col=o.icon%5, row=Math.floor(o.icon/5);
  return `--deity-color:${divineHex(o.color)};--deity-x:${col*25}%;--deity-y:${row*100}%`;
}

function openDivineOfferingSelect(){
  if(!isDivineOfferingOwned(selectedDivineOfferingId)) selectedDivineOfferingId='';
  buildDivineOfferingSelect();
  const panel=document.getElementById('offeringselect');
  if(panel) panel.style.display='flex';
}

function buildDivineOfferingSelect(){
  const wrap=document.getElementById('offeringcards');
  const summary=document.getElementById('offeringsummary');
  if(!wrap || !summary) return;
  wrap.innerHTML='';
  for(const o of DIVINE_OFFERINGS){
    const owned=isDivineOfferingOwned(o.id);
    const card=document.createElement('button');
    card.type='button';
    card.className='offeringcard'+(o.id===selectedDivineOfferingId?' selected':'')+(owned?' owned':' locked');
    card.style.cssText=divineIconStyle(o);
    card.innerHTML=`<span class="deityportrait"><i>${o.rune}</i><img src="${assetSrc(`assets/sprites/deity_${o.id}.png`)}" alt="" onerror="this.style.display='none'"></span><span class="deitycopy"><b>${o.name}</b><em>${o.title}</em><small>${owned?'บูชา: '+o.cost:'ซื้อ '+DIVINE_OFFERING_PRICE.toLocaleString()+' Soul Coins'}</small><p>${owned?o.effect:'เทพองค์นี้ยังไม่ถูกปลดล็อก'}</p></span>`;
    card.onclick=()=>{ if(owned){ selectedDivineOfferingId=o.id; buildDivineOfferingSelect(); } else buyDivineOffering(o.id); };
    wrap.appendChild(card);
  }
  const o=divineOfferingById(selectedDivineOfferingId), state=loadDivineOfferingState(), ownedCount=Object.keys(state.owned||{}).filter(id=>divineOfferingById(id)).length;
  summary.innerHTML=o
    ? `<span style="color:${divineHex(o.color)}">${o.rune}</span><div><b>${o.name}, ${o.title}</b><small>${o.short} · Cooldown ${divineOfferingCooldown(o.id)}s · Soul Coins ${soulCoins().toLocaleString()}</small></div>`
    : `<span>◇</span><div><b>No Divine Offering</b><small>Soul Coins ${soulCoins().toLocaleString()} · ซื้อแล้ว ${ownedCount}/${DIVINE_OFFERINGS.length}</small></div>`;
}

function buyDivineOffering(id){
  const o=divineOfferingById(id); if(!o) return false;
  if(isDivineOfferingOwned(id)){ selectedDivineOfferingId=id; buildDivineOfferingSelect(); return true; }
  const coins=soulCoins();
  if(coins<DIVINE_OFFERING_PRICE){ showToast('Soul Coins ไม่พอ: ต้องมี '+DIVINE_OFFERING_PRICE.toLocaleString(),2.4); return false; }
  setSoulCoins(coins-DIVINE_OFFERING_PRICE); markSoulCoinSpendGuard(soulCoins());
  const state=loadDivineOfferingState(); state.owned[id]=new Date().toISOString(); saveDivineOfferingState(state);
  selectedDivineOfferingId=id;
  if(typeof syncCriticalPlayerProgress==='function') syncCriticalPlayerProgress('divine_purchase');
  else if(typeof queueOnlineAchievementSync==='function') queueOnlineAchievementSync('divine_purchase');
  showToast('ปลดล็อกเทพ '+o.name+' สำเร็จ',2.8); buildDivineOfferingSelect(); return true;
}

function confirmDivineOffering(){
  activeDivineOfferingId=isDivineOfferingOwned(selectedDivineOfferingId)?selectedDivineOfferingId:'';
  try{ localStorage.setItem(DIVINE_OFFERING_LAST_KEY,activeDivineOfferingId); }catch(_){ }
  const panel=document.getElementById('offeringselect');
  if(panel) panel.style.display='none';
  beginSelectedRun();
}

function initDivineOfferingUi(){
  const start=document.getElementById('offeringstart');
  const hud=document.getElementById('offeringhud');
  if(start) start.onclick=confirmDivineOffering;
  const none=document.getElementById('offeringnone');
  if(none) none.onclick=()=>{ selectedDivineOfferingId=''; buildDivineOfferingSelect(); };
  if(hud) hud.onclick=()=>useDivineOffering();
}

function resetDivineOfferingForRun(p){
  divineDelayed.length=0;
  clearDivineVisualFx();
  if(!p) return;
  p.divineOfferingId=activeDivineOfferingId;
  p.offeringCd=DIVINE_OFFERING_OPENING_COOLDOWN;
  p.divineSouls=0;
  p.divineUses=0;
  p.divineDamage=0;
  p.divineShield=0;
  p.divineShieldMax=0;
}

function gainDivineSoul(){
  if(player && player.divineOfferingId==='morvane') player.divineSouls=Math.min(99,(player.divineSouls||0)+1);
}

function divineTargets(range,count){
  if(typeof nearestEnemies!=='function') return [];
  return nearestEnemies(player.x,player.z,range,count).map(v=>v&&v.e?v.e:v).filter(e=>e&&e.alive);
}

function divineDamage(e,amount,color){
  if(!e || !e.alive) return;
  const before=e.hp;
  const id=(player&&player.divineOfferingId)||activeDivineOfferingId;
  const scaledAmount=amount*divineOfferingDamageScale(id,e)*(player&&player.divineInterventionPower||1);
  dealEnemyDamage(e,scaledAmount,color,e.x-player.x,e.z-player.z,0,true,{item:'divine_'+id});
  if(player) player.divineDamage=(player.divineDamage||0)+Math.max(0,before-e.hp);
}

function divinePulse(delay,fn){ divineDelayed.push({t:Math.max(0,delay),fn}); }

function offeringReadyReason(o){
  if(!o) return 'ไม่ได้เลือกเทพ';
  if(!player || !started || paused || userPaused || gameOver || won) return 'ยังใช้ไม่ได้';
  if((player.offeringCd||0)>0) return `คูลดาวน์ ${Math.ceil(player.offeringCd)} วินาที`;
  if(o.id==='morvane' && (player.divineSouls||0)<20) return `ต้องการวิญญาณอีก ${20-(player.divineSouls||0)} ดวง`;
  if(o.id==='solarius' && player.gold<1) return 'ต้องมีทองอย่างน้อย 1';
  return '';
}

function useDivineOffering(){
  const o=activeDivineOffering();
  if(!o){ showToast('รันนี้ไม่ได้เลือกเทพบูชา',1.5); return false; }
  const reason=offeringReadyReason(o);
  if(reason){ showToast(reason,1.5); return false; }
  player.offeringCd=divineOfferingCooldown(o.id);
  player.divineUses=(player.divineUses||0)+1;
  sfx('levelup');
  spawnObjectPulse(player.x,player.z,o.color,4.6,0.55);
  spawnBurst(player.x,player.z,o.color,18,0.9);
  spawnDmg(player.x,player.z,o.name.toUpperCase(),o.color,true,'guard');

  if(o.id==='astra'){
    player.hp=Math.max(1,player.hp-Math.max(1,Math.round(player.hp*0.12)));
    for(let wave=0;wave<6;wave++) divinePulse(wave*0.12,()=>{
      const radius=2.4+wave*1.25;
      if(wave===0) spawnDivineVisual('fx_divine_astra',player.x,player.z,11.5,0.95,{rotation:Math.PI/8,grow:0.12});
      spawnRing(player.x,player.z,o.color,radius*1.35,0.28);
      for(const e of enemies.slice()) if(e.alive && Math.hypot(e.x-player.x,e.z-player.z)<=radius+e.r) divineDamage(e,16+player.level*1.8,o.color);
    });
  } else if(o.id==='veyra'){
    player.xp=Math.max(0,Math.floor(player.xp*0.92));
    for(let round=0;round<4;round++) divinePulse(round*0.18,()=>{
      for(const e of divineTargets(24,12)){ spawnObjectPulse(e.x,e.z,o.color,1.8,0.24); divineDamage(e,20+player.level*2.2,o.color); }
    });
  } else if(o.id==='morvane'){
    player.divineSouls-=20;
    player.divineGraveT=18;
    player.divineGraveTick=0;
  } else if(o.id==='solarius'){
    const offered=Math.max(1,Math.floor(player.gold*0.15));
    player.gold=Math.max(0,player.gold-offered);
    const dmg=22+player.level*2.0+Math.min(240,offered*2.4);
    spawnDivineVisual('fx_divine_solarius',player.x,player.z,10.5,1.15,{upright:true,centerY:0.05,grow:0.05});
    for(const target of divineTargets(28,4)) spawnDivineVisual('fx_divine_solarius',target.x,target.z,3.6,0.86,{upright:true,centerY:0.04,grow:0.08});
    for(const e of enemies.slice()) if(e.alive){ divineDamage(e,dmg,o.color); if(e.isBoss) e.slowT=Math.max(e.slowT||0,1.2); }
    spawnObjectPulse(player.x,player.z,o.color,18,0.75);
  } else if(o.id==='nhal'){
    const loss=Math.max(1,Math.round(player.maxHp*0.05));
    player.maxHp=Math.max(20,player.maxHp-loss); player.hp=Math.min(player.hp,player.maxHp);
    player.divineVoidT=8; player.divineVoidTick=0;
    spawnDivineVisual('fx_divine_nhal',player.x,player.z,12.5,8,{loop:true,followPlayer:true,fps:10,grow:0.08});
  } else if(o.id==='serapha'){
    player.hp=1; player.invuln=Math.max(player.invuln,4);
    player.divinePhoenixT=4; player.divinePhoenixTick=0; player.divinePhoenixHeal=true;
    spawnDivineVisual('fx_divine_serapha',player.x,player.z,7.8,4,{upright:true,followPlayer:true,loop:true,fps:11,grow:0.06});
  } else if(o.id==='fenrir'){
    player.divineFenrirT=12; player.divineFenrirApplied=true;
    player.armorMul*=0.5; player.divineSpeedBoost=0.40; player.rateMul*=1.35; player.critChance+=0.25;
  } else if(o.id==='tharos'){
    player.divineDashLockT=15;
    player.divineShieldMax=Math.round(player.maxHp*0.40);
    player.divineShield=player.divineShieldMax;
    spawnDivineVisual('fx_divine_tharos',player.x,player.z,5.4,15,{upright:true,followPlayer:true,loop:true,fps:8,grow:0.02,until:()=>!!(player&&player.divineShield>0)});
    spawnObjectPulse(player.x,player.z,o.color,5.2,0.65);
  } else if(o.id==='eirene'){
    player.divineWeaponLockT=3; player.divineTimeStopT=5; player.divineTimeBurstPending=true;
    spawnDivineVisual('fx_divine_eirene',player.x,player.z,7.2,5,{upright:true,centerY:0.24,followPlayer:true,loop:true,fps:9,grow:0.03});
    for(const e of enemies) if(e.alive) e.slowT=Math.max(e.slowT||0,5);
  } else if(o.id==='midas'){
    const costRoll=Math.floor(Math.random()*3);
    if(costRoll===0) player.gold=Math.max(0,player.gold-Math.ceil(player.gold*0.12));
    else if(costRoll===1) player.hp=Math.max(1,player.hp-Math.ceil(player.hp*0.15));
    else player.xp=Math.max(0,Math.floor(player.xp*0.90));
    const roll=Math.random();
    if(roll<0.28){ const gain=80+mapStage*70+player.level*4; player.gold+=gain; showToast('MIDAS JACKPOT +'+gain+' gold',2.4); }
    else if(roll<0.53){ player.pickupDmgBoost=Math.max(player.pickupDmgBoost||0,0.55); player.pickupDmgTimer=Math.max(player.pickupDmgTimer||0,18); player.speedBoost=Math.max(player.speedBoost||0,0.35); player.speedBoostTimer=Math.max(player.speedBoostTimer||0,18); showToast('MIDAS BLESSING: POWER + SPEED',2.4); }
    else if(roll<0.80){ let changed=0; for(const e of enemies.slice()){ if(!e.alive||e.isBoss||changed>=12) continue; e.alive=false; killEnemy(e); player.gold+=4+mapStage*2; changed++; } showToast('MIDAS TRANSMUTED '+changed+' enemies',2.4); }
    else { spawnMimicChest(player.x+3,player.z,Math.min(2,mapStage)); showToast('Midas is laughing. MIMIC!',2.4); }
  }
  return true;
}

function tryDivineShield(amount,src){
  if(!player || !(player.divineShield>0)) return amount;
  const blocked=Math.min(player.divineShield,Math.max(0,amount));
  player.divineShield-=blocked;
  spawnDmg(player.x,player.z,'DIVINE GUARD',0xb7c7d8,false,'guard');
  if(src&&src.alive && blocked>0) divineDamage(src,blocked*0.45,0xb7c7d8);
  if(player.divineShield<=0){ spawnObjectPulse(player.x,player.z,0xb7c7d8,3.8,0.35); showToast('Tharos shield shattered',1.4); }
  return Math.max(0,amount-blocked);
}

function updateDivineOffering(dt){
  if(!player) return;
  updateDivineVisualFx(dt);
  if(player.offeringCd>0) player.offeringCd=Math.max(0,player.offeringCd-dt);
  if(player.divineInterventionT>0){
    player.divineInterventionT=Math.max(0,player.divineInterventionT-dt);
    if(player.divineInterventionT<=0) player.divineInterventionPower=1;
  }
  for(let i=divineDelayed.length-1;i>=0;i--){ const d=divineDelayed[i]; d.t-=dt; if(d.t<=0){ divineDelayed.splice(i,1); d.fn(); } }

  if(player.divineGraveT>0){
    player.divineGraveT-=dt; player.divineGraveTick-=dt;
    if(player.divineGraveTick<=0){ player.divineGraveTick=0.55; for(const e of divineTargets(18,3)){
      const a=Math.atan2(e.z-player.z,e.x-player.x), sx=player.x+Math.cos(a+Math.PI/2)*0.7, sz=player.z+Math.sin(a+Math.PI/2)*0.7;
      spawnDivineVisual('fx_divine_morvane',sx,sz,2.7,0.62,{upright:true,vx:(e.x-sx)/0.62,vz:(e.z-sz)/0.62,grow:-0.08});
      spawnBurst(e.x,e.z,0x8be08f,5,0.5); divineDamage(e,13+player.level*1.25,0x8be08f);
    } }
  }
  if(player.divineVoidT>0){
    player.divineVoidT-=dt; player.divineVoidTick-=dt;
    for(const e of enemies){ if(!e.alive) continue; const dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz)||1; if(d<13){ e.kx+=(dx/d)*8*dt; e.kz+=(dz/d)*8*dt; } }
    if(player.divineVoidTick<=0){ player.divineVoidTick=0.5; spawnRing(player.x,player.z,0x9b5cff,12,0.42); for(const e of divineTargets(13,40)) divineDamage(e,9+player.level*0.9,0x9b5cff); }
    if(player.divineVoidT<=0){ spawnObjectPulse(player.x,player.z,0x9b5cff,13,0.8); for(const e of divineTargets(14,60)) divineDamage(e,34+player.level*3,0x9b5cff); }
  }
  if(player.divinePhoenixT>0){
    player.divinePhoenixT-=dt; player.divinePhoenixTick-=dt;
    if(player.divinePhoenixTick<=0){ player.divinePhoenixTick=0.32; spawnRing(player.x,player.z,0xff6848,4.5,0.25); for(const e of divineTargets(4.5,30)) divineDamage(e,7+player.level*0.75,0xff6848); }
    if(player.divinePhoenixT<=0 && player.divinePhoenixHeal){ player.divinePhoenixHeal=false; player.hp=Math.min(healCap(player),player.hp+scaledHeal(player.maxHp*0.35)); spawnDivineVisual('fx_divine_serapha',player.x,player.z,9.2,0.9,{upright:true,centerY:0.08,grow:0.16}); spawnDmg(player.x,player.z,'REBORN',0xffd06a,true,'guard'); }
  }
  if(player.divineFenrirT>0){
    player.divineFenrirT-=dt;
    if(player.divineFenrirT<=0 && player.divineFenrirApplied){ player.divineFenrirApplied=false; player.armorMul/=0.5; player.divineSpeedBoost=0; player.rateMul/=1.35; player.critChance=Math.max(0,player.critChance-0.25); }
  }
  if(player.divineDashLockT>0) player.divineDashLockT=Math.max(0,player.divineDashLockT-dt);
  if(player.divineWeaponLockT>0) player.divineWeaponLockT=Math.max(0,player.divineWeaponLockT-dt);
  if(player.divineTimeStopT>0){
    player.divineTimeStopT=Math.max(0,player.divineTimeStopT-dt);
    if(player.divineTimeStopT<=0 && player.divineTimeBurstPending){ player.divineTimeBurstPending=false; player.divineTimeBurstT=8; player.rateMul*=3; spawnDivineVisual('fx_divine_eirene',player.x,player.z,8.2,0.95,{upright:true,centerY:0.24,grow:0.18}); spawnObjectPulse(player.x,player.z,0x74f0e4,10,0.65); showToast('EIRENE: TIME SURGE',1.8); }
  }
  if(player.divineTimeBurstT>0){ player.divineTimeBurstT-=dt; if(player.divineTimeBurstT<=0){ player.divineTimeBurstT=0; player.rateMul/=3; } }
}

function updateDivineOfferingHud(){
  const el=document.getElementById('offeringhud'); if(!el || !player) return;
  el.style.display=(started&&!gameOver&&!won)?'grid':'none';
  const o=activeDivineOffering(); const cd=Math.max(0,player.offeringCd||0);
  if(!o){ el.style.display='none'; return; }
  const reason=offeringReadyReason(o);
  el.style.setProperty('--deity-color',divineHex(o.color));
  el.classList.toggle('ready',!reason);
  el.classList.toggle('cooling',cd>0);
  let resource='';
  if(o.id==='morvane') resource=`${player.divineSouls||0}/20 souls`;
  else if(o.id==='tharos' && player.divineShield>0) resource=`Shield ${Math.ceil(player.divineShield)}`;
  el.innerHTML=`<span class="offeringhudicon">${o.rune}</span><b>${cd>0?Math.ceil(cd)+'s':(reason||'บูชา [Q]')}</b><small>${o.name}${resource?' · '+resource:''}</small>`;
}

function divineOfferingSummaryHtml(){
  if(!player) return '';
  const o=activeDivineOffering();
  if(!o) return `<section class="summarydivine"><h3>Divine Offering</h3><div class="summaryline"><b>No Offering</b><span>ไม่ได้บูชาเทพในรันนี้</span></div></section>`;
  return `<section class="summarydivine"><h3>Divine Offering</h3><div class="summaryline"><i style="color:${divineHex(o.color)}">${o.rune}</i><b>${o.name}, ${o.title}</b><span>${player.divineUses||0} uses<small>${Math.round(player.divineDamage||0)} damage</small></span></div></section>`;
}
