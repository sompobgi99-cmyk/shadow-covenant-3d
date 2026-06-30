let scene, camera, renderer, clock, playerLight, hemiLight, sunLight, rimLight, borderMaterial;
const tex = {};
let player, ground;
const enemies = [], projectiles = [], pickups = [];
const obstacles = [];                       // solid scenery {x,z,r}
const worldScenery = [];                    // base map scenery that can be removed on stage changes
const stageProps = [];                      // scenery added/removed when changing maps
const ENEMY_GRID_SIZE = 4;
const enemyGrid = new Map();
function enemyGridKey(cx, cz){ return cx+','+cz; }
function rebuildEnemyGrid(){
  enemyGrid.clear();
  for (let i=0;i<enemies.length;i++){
    const e=enemies[i];
    if(!e.alive) continue;
    e.gridIndex=i;
    const cx=Math.floor(e.x/ENEMY_GRID_SIZE), cz=Math.floor(e.z/ENEMY_GRID_SIZE);
    const key=enemyGridKey(cx,cz);
    let bucket=enemyGrid.get(key);
    if(!bucket){ bucket=[]; enemyGrid.set(key,bucket); }
    bucket.push(e);
  }
}
function forEachNearbyEnemy(x,z,radius,visit){
  const minX=Math.floor((x-radius)/ENEMY_GRID_SIZE), maxX=Math.floor((x+radius)/ENEMY_GRID_SIZE);
  const minZ=Math.floor((z-radius)/ENEMY_GRID_SIZE), maxZ=Math.floor((z+radius)/ENEMY_GRID_SIZE);
  for(let cx=minX;cx<=maxX;cx++) for(let cz=minZ;cz<=maxZ;cz++){
    const bucket=enemyGrid.get(enemyGridKey(cx,cz));
    if(!bucket) continue;
    for(const e of bucket) if(e.alive && visit(e)===false) return false;
  }
  return true;
}
const afterimages = [];                     // dash trail ghosts
function spawnAfterimage(){
  const p = player.spr;
  const m = new THREE.SpriteMaterial({ map:p.material.map, color:0x7CE7FF, transparent:true, opacity:0.55, alphaTest:0.3, depthWrite:false, fog:true, blending:THREE.AdditiveBlending });
  const g = new THREE.Sprite(m);
  g.center.copy(p.center); g.scale.copy(p.scale); g.position.copy(p.position);
  scene.add(g); afterimages.push({ spr:g, life:0.28, max:0.28 });
}
const enemyShots = [];                      // enemy ranged projectiles
const particles = [];                       // hit/death bursts
const PARTICLE_GEO = new THREE.BoxGeometry(0.14,0.14,0.14);
const trails=[]; const TRAIL_GEO=new THREE.BoxGeometry(0.14,0.14,0.14);
const dmgNums=[];
const damageScreenPos=new THREE.Vector3();
function spawnDmg(x,z,amount,color){
  if (dmgNums.length>32) return;
  const el=document.createElement('div'); el.className='dn'; el.textContent=Math.round(amount);
  el.style.color='#'+('000000'+((color||0xffffff)>>>0).toString(16)).slice(-6);
  document.getElementById('dmg').appendChild(el);
  dmgNums.push({ el, x, z, t:0, life:0.65, ox:(Math.random()-0.5)*0.7 });
}
let weaponSig=null;
function updateWeaponHUD(){
  const sig = player.weapons.map(w=>w.key+w.lvl).join(',');
  if (sig===weaponSig) return; weaponSig=sig;
  const wrap=document.getElementById('weapons'); wrap.innerHTML='';
  for (let i=0;i<MAX_WEAPONS;i++){
    const w=player.weapons[i];
    const d=document.createElement('div');
    if (w){ const t=WEAPON_TYPES[w.key]||{}; d.className='wslot'+(w.evolved?' evo':''); d.title=t.name||w.key;
      d.innerHTML='<img src="assets/sprites/'+t.icon+'.png"><span>Lv'+w.lvl+'</span>'; }
    else { d.className='wslot empty'; d.title='ช่องอาวุธว่าง'; d.textContent='+'; }
    wrap.appendChild(d);
  }
}
let tomeSig=null;
function updateTomeHUD(){
  const tc=player.tomeCount||{};
  const ids=Object.keys(tc).filter(id=>tc[id]>0);
  const sig=ids.map(id=>id+tc[id]).join(',');
  if (sig===tomeSig) return; tomeSig=sig;
  const wrap=document.getElementById('tomes'); if(!wrap) return; wrap.innerHTML='';
  for (let i=0;i<MAX_TOMES;i++){
    const id=ids[i];
    const d=document.createElement('div');
    if (id){ const u=UPGRADES.find(x=>x.id===id)||{}; d.className='tslot'; d.title=(u.name||id)+' — '+(u.desc||'');
      d.innerHTML='<img src="assets/sprites/'+u.icon+'.png"><span>×'+tc[id]+'</span>'; }
    else { d.className='tslot empty'; d.title='ช่อง tome ว่าง'; d.textContent='+'; }
    wrap.appendChild(d);
  }
}
let objSig='';
function updateObjective(){
  const el=document.getElementById('objective'); if(!el) return;
  if(!started || gameOver || won){ el.style.display='none'; objSig=''; return; }
  el.style.display='block';
  // 3 steps map directly to altar.state: idle -> boss -> portal
  let cur=1; if(altar){ if(altar.state==='boss') cur=2; else if(altar.state==='portal') cur=3; }
  const bossName = boss ? boss.name : 'บอส';
  const finalStage = mapStage>=3;
  const steps=[
    'ไปแท่นบูชา · กด F เรียกบอส',
    'กำจัด '+bossName,
    finalStage ? 'เข้าวาป — ชนะ!' : 'เข้าวาปไปด่านต่อไป'
  ];
  const sig=mapStage+'|'+cur+'|'+bossName;
  if(sig===objSig) return; objSig=sig;
  let html='<div class="qhead">🎯 ด่าน '+mapStage+'/3</div>';
  steps.forEach((s,idx)=>{ const n=idx+1, cls=n<cur?'done':(n===cur?'active':'');
    const mark=n<cur?'✓':(n===cur?'▶':'○');
    html+='<div class="qstep '+cls+'">'+mark+' '+s+'</div>';
  });
  el.innerHTML=html;
}
function updateDamageNumbers(dt){
  for (let i=dmgNums.length-1;i>=0;i--){ const d=dmgNums[i]; d.t+=dt;
    if (d.t>=d.life){ d.el.remove(); dmgNums.splice(i,1); continue; }
    damageScreenPos.set(d.x+d.ox, 1.6+d.t*2.4, d.z).project(camera);
    d.el.style.left=((damageScreenPos.x*0.5+0.5)*innerWidth)+'px';
    d.el.style.top=((-damageScreenPos.y*0.5+0.5)*innerHeight)+'px';
    d.el.style.opacity=String(Math.max(0,1-d.t/d.life));
  }
}
function spawnTrail(x,z,color,scale,life){
  if(trails.length>=80) return;
  const m=new THREE.Group();
  const core=new THREE.Mesh(TRAIL_GEO, new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.52, blending:THREE.AdditiveBlending, depthWrite:false }));
  const glow=new THREE.Mesh(new THREE.SphereGeometry(0.18,8,8), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.16, blending:THREE.AdditiveBlending, depthWrite:false }));
  m.add(glow); m.add(core);
  m.scale.setScalar(scale||1); m.position.set(x, groundHeight(x,z)+0.9, z); scene.add(m);
  trails.push({ mesh:m, life:life||0.16, max:life||0.16, core, glow });
}
const rings = [];
function spawnRing(x, z, color, maxR, life){
  const geo=new THREE.PlaneGeometry(2,2); geo.rotateX(-Math.PI/2);
  const m=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map:getPixelRingTexture(), color, transparent:true, opacity:0.9,
    alphaTest:0.08, side:THREE.DoubleSide, depthWrite:false
  }));
  m.position.set(x, groundHeight(x,z)+0.12, z); scene.add(m);
  rings.push({ mesh:m, maxR:maxR||5, life:life||0.5, max:life||0.5 });
}
function spawnObjectPulse(x, z, color, maxR, life){
  const geo=new THREE.PlaneGeometry(2,2); geo.rotateX(-Math.PI/2);
  const m=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map:getEntityAuraTexture('object'), color, transparent:true, opacity:0.72,
    alphaTest:0.06, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending
  }));
  m.position.set(x, groundHeight(x,z)+0.13, z);
  m.rotation.z=Math.PI/4;
  scene.add(m);
  rings.push({ mesh:m, maxR:maxR||5, life:life||0.5, max:life||0.5 });
}
function spawnBurst(x, z, color, n, scl){
  const count=Math.min(n||7,Math.max(0,120-particles.length));
  for (let i=0;i<count;i++){ const a=Math.random()*Math.PI*2, sp=2+Math.random()*4;
    const m=new THREE.Mesh(PARTICLE_GEO, new THREE.MeshBasicMaterial({ color, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
    m.scale.setScalar(scl||1); scene.add(m);
    particles.push({ x, z, y:0.6, vx:Math.cos(a)*sp, vz:Math.sin(a)*sp, vy:2+Math.random()*3, life:0.5, max:0.5, mesh:m }); }
}
function spawnEnemyShot(x, z, dx, dz, dmg){
  const m=new THREE.Group();
  const glow=new THREE.Mesh(new THREE.SphereGeometry(0.34,10,10), new THREE.MeshBasicMaterial({ color:0xff5066, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending, depthWrite:false }));
  const core=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,8), new THREE.MeshBasicMaterial({ color:0xffb0bc, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false }));
  m.add(glow); m.add(core);
  scene.add(m); enemyShots.push({ x, z, dx, dz, speed:9, dmg, life:3, alive:true, mesh:m });
}
const SHOOTERS  = new Set(['Swamp Witch','Shadow Weaver','Dark Apostle','Toxic Spore','Abyssal Horror']);
const CHARGERS  = new Set(['Wraith','Dire Bat','Chaos Wisp','Willow Wisp','Rift Phantom','Nether Drake']);
const EXPLODERS = new Set(['Muck Slime','Oblivion Orb','Plague Rat','Bog Elemental']);
const AIRBORNE  = new Set(['Wraith','Dire Bat','Willow Wisp','Chaos Wisp','Rift Phantom','Nether Drake','Oblivion Orb']);   // Eagle Claw targets
function behaviorFor(name){ if(SHOOTERS.has(name))return'shooter'; if(CHARGERS.has(name))return'charger'; if(EXPLODERS.has(name))return'exploder'; return'chase'; }
function blocked(x, z){
  for (const o of obstacles){ const rr=o.r+0.42; if ((x-o.x)*(x-o.x)+(z-o.z)*(z-o.z) < rr*rr) return true; }
  return false;
}
function findOpenPosition(x,z,maxRadius){
  if(!blocked(x,z)) return {x,z};
  const limit=maxRadius||2.4;
  for(let radius=0.45;radius<=limit;radius+=0.45){
    const steps=Math.max(8,Math.ceil(radius*12));
    for(let i=0;i<steps;i++){
      const angle=(i/steps)*Math.PI*2;
      const nx=clamp(x+Math.cos(angle)*radius,-MAP_BOUND,MAP_BOUND);
      const nz=clamp(z+Math.sin(angle)*radius,-MAP_BOUND,MAP_BOUND);
      if(!blocked(nx,nz)) return {x:nx,z:nz};
    }
  }
  return null;
}
function pointAroundPlayer(minDistance,maxDistance,ignoreObstacles){
  for(let i=0;i<24;i++){
    const angle=Math.random()*Math.PI*2;
    const distance=minDistance+Math.random()*(maxDistance-minDistance);
    const x=clamp(player.x+Math.cos(angle)*distance,-MAP_BOUND+1,MAP_BOUND-1);
    const z=clamp(player.z+Math.sin(angle)*distance,-MAP_BOUND+1,MAP_BOUND-1);
    if(ignoreObstacles || !blocked(x,z)) return {x,z};
  }
  return findOpenPosition(
    clamp(player.x+minDistance,-MAP_BOUND+1,MAP_BOUND-1),
    clamp(player.z,-MAP_BOUND+1,MAP_BOUND-1),
    4
  );
}
function relocateEnemyNearPlayer(e){
  const point=pointAroundPlayer(e.isBoss?22:20,e.isBoss?28:26,e.isBoss);
  if(!point) return false;
  spawnBurst(e.x,e.z,e.isBoss?0xff5066:0x7655aa,e.isBoss?8:3,e.isBoss?0.8:0.35);
  e.x=point.x; e.z=point.z;
  e.kx=0; e.kz=0; e.stuckT=0; e.relocateCd=2;
  spawnBurst(e.x,e.z,e.isBoss?0xff5066:0x7655aa,e.isBoss?10:4,e.isBoss?0.9:0.4);
  return true;
}
function moveEnemyAroundObstacles(e,mvx,mvz,dt){
  const startX=e.x, startZ=e.z;
  const distance=Math.hypot(mvx,mvz);
  if(distance<=0) return false;
  const base=Math.atan2(mvz,mvx);
  if(!e.avoidSide) e.avoidSide=Math.random()<0.5?-1:1;
  const turns=[0,0.38*e.avoidSide,-0.38*e.avoidSide,0.78*e.avoidSide,-0.78*e.avoidSide,1.2*e.avoidSide,-1.2*e.avoidSide];
  for(const turn of turns){
    const nx=e.x+Math.cos(base+turn)*distance;
    const nz=e.z+Math.sin(base+turn)*distance;
    if(!blocked(nx,nz)){
      e.x=nx; e.z=nz;
      if(turn) e.avoidSide=turn>0?1:-1;
      break;
    }
  }
  const moved=(e.x-startX)*(e.x-startX)+(e.z-startZ)*(e.z-startZ)>0.000001;
  e.stuckT=moved?Math.max(0,(e.stuckT||0)-dt*2):(e.stuckT||0)+dt;
  if(e.stuckT>0.45){
    const open=findOpenPosition(e.x,e.z,Math.min(2.7,0.9+e.stuckT*1.5));
    if(open){
      e.x=open.x; e.z=open.z;
      e.stuckT=0;
      e.avoidSide*=-1;
      return true;
    }
  }
  return moved;
}
const keys = {};
let gameTime = 0, kills = 0, gameOver = false, score = 0, damageTaken = 0, scoreFinalized = false, lastScoreEntry = null;
let stageStartTime = 0;                       // gameTime when the current stage began
function stageTime(){ return gameTime - stageStartTime; }   // per-stage clock (resets each map)
function healCap(p){ return Math.round(p.maxHp*(1+(p.overheal||0))); }   // Chonkplate lets HP exceed max
// Overtime escalation: enemies get +45% HP & ATK for every 3 minutes spent in OT (unbounded).
function otPowerMul(){ const ot=stageTime()-RUN_TARGET; return ot<=0 ? 1 : 1 + 0.45*Math.floor(ot/180); }
let globalPickupMagnet = 0;
let waveTimer = 0, waveInterval = 3.2, enemiesPerWave = 2, maxEnemies = 18;
let nextHordeAt = 240, hordeRemaining = 0, hordeSpawnTimer = 0, hordeNumber = 0, hordeSpawned = 0, hordeWarned = false;
let relocationCursor = 0;
let mbTimer = 0;
let nextMinibossAt = 180;
const MINIBOSS_INTERVAL = 55;
const RUN_TARGET = 600;            // 10:00 clear target
let mapStage = 1;
let won = false, altar = null, boss = null;
let started = false;   // false until a character is chosen
let composer = null;   // bloom post-processing
const interactables = [];   // chests / shrines / merchant {type,tier,x,z,used,spr}
let chestsOpened = 0, shopOffers = [], currentShopMerchant = null, shopPurchases = 0;
const groundItems = [];     // dropped item pickups {x,z,item, spr,glow}
const CHEST_BASE=[40,100,220];
const PLAYER_NAME_KEY='sc3_player_name';
let playerName = localStorage.getItem(PLAYER_NAME_KEY) || 'Player';
function chestCost(tier){ const disc=Math.max(0.5, 1-0.08*((player&&player._wrench)||0)); return Math.round(CHEST_BASE[tier]*Math.pow(1.18, chestsOpened)*disc); }
let paused = false, pendingUps = 0, currentChoices = [];
let userPaused = false;
function buildPauseInfo(){
  const el=document.getElementById('pauseinfo'); if(!el) return;
  const C=CHARACTERS[player.char]||{};
  let h='<div class="piw">';
  for (const w of player.weapons){ const t=WEAPON_TYPES[w.key]; if(!t) continue;
    h+='<div class="piwslot'+(w.evolved?' evo':'')+'"><img src="assets/sprites/'+t.icon+'.png"><div class="pn">'+t.name+'</div><div class="pl">Lv '+w.lvl+'</div></div>'; }
  h+='</div><div class="pist">'+(C.name||'')+' \u00b7 Lv '+player.level+' \u00b7 HP '+Math.ceil(player.hp)+'/'+player.maxHp
    +' \u00b7 SPD '+player.spd.toFixed(1)+'</div>';
  // items list
  if (player.items.length) {
    h+='<div style="margin-top:8px;color:#ffe08a;font-size:12px">Items ('+player.items.length+')</div>';
    const counts={}; for(const it of player.items) counts[it.name]=(counts[it.name]||0)+1;
    for(const [name,n] of Object.entries(counts)){
      const it=player.items.find(i=>i.name===name);
      const rc={common:'Common',uncommon:'Uncommon',rare:'Rare',legendary:'Legendary'};
      h+='<div style="color:#cdbff0;font-size:11px">'+it.name+(n>1?' x'+n:'')+' - '+it.desc+'</div>';
    }
  }
  el.innerHTML=h;
}
function togglePause(){
  if (gameOver || paused) return;            // don't toggle during level-up
  userPaused = !userPaused;
  if (userPaused) buildPauseInfo();
  document.getElementById('pause').style.display = userPaused ? 'flex' : 'none';
  document.getElementById('pausebtn').textContent = userPaused ? '▶' : '⏸';
}
// Dash trigger shared by keyboard (Space) and the mobile Dash button.
function tryDash(){
  if (!started || paused || gameOver || won || player.dashCd>0 || player.dashTime>0) return;
  let dx=player.ldx, dz=player.ldz;
  if (!dx && !dz){ dx=player.face||1; dz=0; }
  const l=Math.hypot(dx,dz)||1; player.dashX=dx/l; player.dashZ=dz/l;
  player.dashTime=DASH_DUR; player.dashCd=DASH_CD;
  sfx('dash');
  player.invuln=Math.max(player.invuln, DASH_DUR+0.08);   // i-frames while dashing
}
function quitToTitle(){
  started=false; userPaused=false; paused=false; gameOver=false; won=false; pendingUps=0;
  for (const id of ['pause','shop','playersetup','select','over','levelup']) document.getElementById(id).style.display='none';
  document.getElementById('pausebtn').textContent='⏸';
  document.getElementById('title').style.display='flex';
  showLeaderboard();
  startTitleBGM();
}
function cleanPlayerName(v){
  return String(v||'').trim().replace(/\s+/g,' ').slice(0,18) || 'Player';
}
function openPlayerSetup(){
  closeGuide();
  document.getElementById('title').style.display='none';
  const box=document.getElementById('playersetup'), input=document.getElementById('playername');
  input.value=playerName;
  box.style.display='flex';
  setTimeout(()=>{ input.focus(); input.select(); },0);
}
function confirmPlayerName(){
  const input=document.getElementById('playername');
  playerName=cleanPlayerName(input.value);
  localStorage.setItem(PLAYER_NAME_KEY, playerName);
  document.getElementById('playersetup').style.display='none';
  buildSelect();
  document.getElementById('select').style.display='flex';
}
function buildSelect(){
  const wrap=document.getElementById('selcards'); wrap.innerHTML='';
  for (const key in CHARACTERS){
    const c=CHARACTERS[key], wpn=(WEAPON_TYPES[c.weapon]||{}).name||c.weapon;
    const d=document.createElement('div'); d.className='ccard';
    d.innerHTML='<img src="assets/sprites/char_'+key+'_portrait.png"><div class="cn">'+c.name+'</div><div class="cw">\u2694 '+wpn+'</div><div class="cp">'+c.passive.desc+'</div>';
    d.onclick=()=>selectCharacter(key);
    wrap.appendChild(d);
  }
}
function escHtml(s){
  return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function guideCard(img, name, desc, meta, cls){
  return '<div class="guidecard '+(cls||'')+'"><img src="'+img+'" loading="lazy"><div><b>'+escHtml(name)+'</b><p>'+escHtml(desc)+'</p>'+(meta?'<small>'+escHtml(meta)+'</small>':'')+'</div></div>';
}
function openGuide(kind){
  const guide=document.getElementById('guide'), body=document.getElementById('guidebody');
  if(!guide||!body) return;
  let title='คู่มือ', note='', cards='';
  if(kind==='characters'){
    title='ตัวละคร';
    note='อาวุธเริ่มต้นและ passive ที่โตตามเลเวล';
    cards=Object.keys(CHARACTERS).map(key=>{
      const c=CHARACTERS[key], w=WEAPON_TYPES[c.weapon]||{};
      const stats=c.stats||{};
      const statLine=[
        stats.maxHp?'HP '+stats.maxHp:null,
        stats.spd?'SPD '+stats.spd:null,
        stats.def?'DEF '+stats.def:null,
        stats.regen?'Regen '+stats.regen:null
      ].filter(Boolean).join(' / ');
      return guideCard('assets/sprites/char_'+key+'_portrait.png', c.name, (w.name||c.weapon)+' - '+c.passive.desc, statLine, 'character');
    }).join('');
  } else if(kind==='weapons'){
    title='อาวุธ';
    note='อาวุธที่เลือกได้ตอนอัปเลเวล และร่าง evolved';
    cards=Object.keys(WEAPON_TYPES).map(key=>{
      const w=WEAPON_TYPES[key];
      const meta=(w.hidden?'Evolved':'Base')+' / DMG '+(w.dmg||'-')+(w.rate?' / Rate '+w.rate:'')+(w.count?' / Count '+w.count:'');
      return guideCard('assets/sprites/'+w.icon+'.png', w.name, w.desc, meta, w.hidden?'rare':'');
    }).join('');
  } else if(kind==='tomes'){
    title='Tome';
    note='Passive upgrade เลือกได้สูงสุด 4 ชนิดต่อรัน แต่เก็บซ้ำเพื่อเพิ่มพลังได้';
    cards=UPGRADES.map(u=>
      guideCard('assets/sprites/'+u.icon+'.png', u.name, u.desc, 'Tome upgrade', 'uncommon')
    ).join('');
  } else {
    title='ไอเทม';
    note='ไอเทม stack ได้ เก็บซ้ำแล้วคูณความสามารถต่อเนื่อง';
    const order={common:0,uncommon:1,rare:2,legendary:3};
    cards=ITEMS.slice().sort((a,b)=>order[a.rarity]-order[b.rarity]||a.name.localeCompare(b.name)).map(it=>
      guideCard('assets/sprites/'+it.icon+'.png', it.name, it.desc, it.rarity, it.rarity)
    ).join('');
  }
  body.innerHTML='<div class="guidehead"><h2>'+escHtml(title)+'</h2><span>'+escHtml(note)+'</span></div><div class="guidegrid">'+cards+'</div>';
  guide.style.display='flex';
}
function closeGuide(){
  const guide=document.getElementById('guide');
  if(guide) guide.style.display='none';
}
function selectCharacter(key){
  currentChar=key;
  document.getElementById('select').style.display='none';
  document.getElementById('over').style.display='none';
  started=true; restart();
}
const UPGRADES = [
  { id:'might',    name:'Might',      desc:'+15% damage',        icon:'tomeic_might',     apply:()=>{ player.dmgMul*=1.15; } },
  { id:'vitality', name:'Vitality',   desc:'+25 max HP, heal',   icon:'tomeic_vitality',  apply:()=>{ player.maxHp+=25; player.hp=Math.min(healCap(player), player.hp+25); } },
  { id:'celerity', name:'Celerity',   desc:'+10% attack speed',  icon:'tomeic_celerity',  apply:()=>{ player.rateMul*=1.10; } },
  { id:'precision',name:'Precision',  desc:'+25% range',         icon:'tomeic_precision', apply:()=>{ player.rangeMul*=1.25; } },
  { id:'multishot',name:'Multishot',  desc:'+1 projectile',      icon:'tomeic_multishot', apply:()=>{ player.countBonus+=1; } },
  { id:'swiftness',name:'Swiftness',  desc:'+6% move speed',     icon:'tomeic_swiftness', apply:()=>{ player.spd*=1.06; } },
  { id:'regen',    name:'Regen',      desc:'+0.8 HP/sec',        icon:'tomeic_regen',     apply:()=>{ player.regen+=0.8; } },
  { id:'magnet',   name:'Magnetism',  desc:'+30% pickup range',  icon:'tomeic_magnet', apply:()=>{ player.magnet*=1.3; } },
  { id:'exp',      name:'Experience', desc:'+15% XP gain',       icon:'tomeic_exp',apply:()=>{ player.xpMul*=1.15; } },
  { id:'greed',    name:'Greed',      desc:'+20% gold',          icon:'tomeic_greed',     apply:()=>{ player.goldMul*=1.2; } },
  { id:'fortitude',name:'Fortitude',  desc:'+5 armor',           icon:'tomeic_fortitude', apply:()=>{ player.def+=5; } },
  { id:'lifesteal',name:'Lifesteal',  desc:'+1 HP per kill',     icon:'tomeic_lifesteal',  apply:()=>{ player.lifesteal+=1; } },
  { id:'duration', name:'Persistence',desc:'+20% projectile life, +10% area duration',icon:'tomeic_duration',    apply:()=>{ player.lifeMul*=1.20; player.areaLifeMul*=1.10; } },
  { id:'velocity', name:'Velocity',   desc:'+20% projectile speed',icon:'tomeic_velocity',apply:()=>{ player.projSpeedMul*=1.2; } },
  { id:'growth',   name:'Growth',     desc:'+20% projectile size',icon:'tomeic_growth',     apply:()=>{ player.projScale*=1.2; } },
  { id:'impact',   name:'Impact',     desc:'+15% knockback',        icon:'tomeic_impact',   apply:()=>{ player.knockbackMul=(player.knockbackMul||0)+0.15; } },
];
const MAX_TOMES = 4;   // เลือก tome ได้สูงสุด 4 ชนิด (เก็บซ้อนได้ไม่จำกัด)
function openUpgradeChoice(){
  // Once 4 distinct tomes are taken, only offer those (level them up), no new tome types.
  const ownedTomes = Object.keys(player.tomeCount||{}).length;
  const tomePool = ownedTomes >= MAX_TOMES ? UPGRADES.filter(u=>player.tomeCount[u.id]) : UPGRADES;
  const pool=[...tomePool, ...weaponChoices()], pick=[];
  for(let i=0;i<3 && pool.length;i++) pick.push(pool.splice((Math.random()*pool.length)|0,1)[0]);
  currentChoices=pick;
  const c=document.getElementById('cards'); c.innerHTML='';
  pick.forEach((u,i)=>{ const d=document.createElement('div'); d.className='card';
    d.innerHTML='<img src="assets/sprites/'+u.icon+'.png"><div class="nm">'+u.name+'</div><div class="ds">'+u.desc+'</div><div class="key">[ '+(i+1)+' ]</div>';
    d.onclick=()=>pickUpgrade(i); c.appendChild(d); });
  paused=true; document.getElementById('levelup').style.display='flex';
}
function pickUpgrade(i){ if(!paused) return; const u=currentChoices[i]; if(!u) return; u.apply();
  if (u.id && !u.id.startsWith('w_') && !u.id.startsWith('evo_')) player.tomeCount[u.id]=(player.tomeCount[u.id]||0)+1;
  checkEvolveReady();
  document.getElementById('levelup').style.display='none';
  pendingUps--; if(pendingUps>0) openUpgradeChoice(); else paused=false; }
function skipUpgrade(){
  if(!paused || pendingUps<=0 || document.getElementById('levelup').style.display!=='flex') return;
  document.getElementById('levelup').style.display='none';
  pendingUps--;
  if(pendingUps>0) openUpgradeChoice(); else paused=false;
}
// Notify the player the moment a weapon meets its evolve requirement.
function checkEvolveReady(){
  for (const w of player.weapons){
    const t = WEAPON_TYPES[w.key];
    if (t && t.evolveTo && !w.evolved && !w.evoAnnounced && w.lvl>=8 && (player.tomeCount[t.evolveTome]||0)>=3){
      w.evoAnnounced = true;
      showToast('⚡ '+t.name+' พร้อม Evolve — เลือกการ์ด ★ ตอนอัพเลเวล!', 3.5);
      sfx('levelup');
    }
  }
}
function currentTier(){ return mapStage>=2 ? 2 : gameTime>=240 ? 2 : gameTime>=120 ? 1 : 0; }
function timeScale(){ return Math.min(10, 1 + gameTime/130); }
// ATK scales far slower than HP so late-game hits sting without one-shotting.
function atkTimeScale(){ return Math.min(2.4, 1 + gameTime/420); }
// Map 2+ ramps hard: enemies/minibosses/bosses get much tougher each stage.
function stageHpMul(){ return mapStage>=3 ? 4.8 : mapStage>=2 ? 2.7 : 1; }
function stageAtkMul(){ return mapStage>=3 ? 2.4 : mapStage>=2 ? 1.75 : 1; }
function normalHpScale(tier){ return timeScale()*1.10*[1,1.22,1.48][tier||0]*stageHpMul()*otPowerMul(); }
function normalAtkScale(tier){ return atkTimeScale()*[1,1.12,1.27][tier||0]*stageAtkMul()*otPowerMul(); }
function minibossHpScale(){ return timeScale()*1.35*(mapStage>=3 ? 5.0 : mapStage>=2 ? 2.9 : 1)*otPowerMul(); }
function bossHpScale(){ return timeScale()*1.45*(mapStage>=3 ? 5.8 : mapStage>=2 ? 3.1 : 1)*otPowerMul(); }
const MINIBOSS_SPEED_MUL = 1.18;
const BOSS_SPEED_MUL = 1.22;
const MAX_LEVEL = 40;
function xpRequired(level){
  const k=Math.max(0,level-1);
  // cubic ramp: gentle early, brutal near max level
  return Math.round(20 + 10*k + 4*k*k + 0.22*k*k*k);
}
function enemySpeedMul(){
  const ot = stageTime()-RUN_TARGET;
  const otSpd = ot>0 ? Math.min(0.75, 0.06*Math.floor(ot/180)) : 0;   // +6% speed per 3 min of OT (cap +75%)
  return 1 + Math.min(0.35, stageTime()/720) + otSpd;
}
function progressionProfile(){
  const st=stageTime();   // spawn density ramps fresh each stage
  const points=[
    [0,18,3.4,2],[60,28,3.0,3],[120,40,2.6,4],[240,60,2.1,5],
    [360,80,1.7,6],[480,105,1.35,8],[600,130,1.1,10]
  ];
  if(st>=600){
    const overtime=(st-600)/60;
    return {cap:Math.min(320,130+Math.round(overtime*45)),interval:Math.max(0.7,1.1-overtime*0.08),batch:Math.min(16,10+Math.floor(overtime*1.5))};
  }
  let a=points[0], b=points[1];
  for(let i=1;i<points.length;i++) if(st>=points[i][0]){ a=points[i]; b=points[Math.min(i+1,points.length-1)]; }
  const f=(st-a[0])/Math.max(1,b[0]-a[0]);
  return {
    cap:Math.round(a[1]+(b[1]-a[1])*f),
    interval:a[2]+(b[2]-a[2])*f,
    batch:Math.round(a[3]+(b[3]-a[3])*f)
  };
}
function hordeSize(number){
  if(number<=1) return 35;
  if(number===2) return 55;
  return Math.min(150,Math.round(55*Math.pow(1.2,number-2)));
}
let toastTimer = 0;
function showToast(message,duration){
  $('toast').textContent=message;
  toastTimer=duration||1.5;
}
let fpsAccum = 0, fpsFrames = 0;
const SHADOW_GEO = new THREE.CircleGeometry(0.5, 16);
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.32, depthWrite:false });
// ---- GPU memory: free per-instance geometry/material/texture when objects are removed ----
// Shared resources are flagged so freeObj() skips them. Cloned textures are freed only by the
// material that owns them (_ownsMap). Without this, long sessions leak GPU memory -> white screen.
SHADOW_GEO._shared = SHADOW_MAT._shared = PARTICLE_GEO._shared = TRAIL_GEO._shared = true;
function freeObj(obj){
  if(!obj || !obj.traverse) return;
  obj.traverse(n=>{
    if(n.geometry && !n.isSprite && !n.geometry._shared) n.geometry.dispose();
    const mat=n.material; if(!mat) return;
    const mats=Array.isArray(mat)?mat:[mat];
    for(const m of mats){ if(!m || m._shared) continue; if(m._ownsMap && m.map) m.map.dispose(); m.dispose(); }
  });
}

function groundHeight(x, z) { return 0; }   // flat map (no hills)
// vertical gradient sky used as scene background
const MAP_THEMES = {
  1: {
    name:'Bleakfield',
    sky:['#140d24','#2e1840','#5a2746','#7e3450'],
    fog:0x271436,
    clear:0x140d24,
    ground:0xffffff,
    groundKey:'px_ground',
    borderKey:'border_wall',
    hemiSky:0x8a82b8,
    hemiGround:0x181020,
    sun:0xb9c8ff,
    rim:0xd34b73,
    playerLight:0x8fb8ff
  },
  2: {
    name:'Crimson Wastes',
    sky:['#120609','#2a080d','#68171d','#b3392a'],
    fog:0x3b0c11,
    clear:0x120609,
    ground:0xffffff,
    groundKey:'map2_ground',
    borderKey:'map2_border_wall',
    hemiSky:0xff8a62,
    hemiGround:0x1a0707,
    sun:0xffb36a,
    rim:0xff3048,
    playerLight:0xff7658
  },
  3: {
    name:'Void Citadel',
    sky:['#050714','#10092a','#251058','#1a315f'],
    fog:0x12072d,
    clear:0x050714,
    ground:0xffffff,
    groundKey:'map3_ground',
    borderKey:'map3_border_wall',
    hemiSky:0x7a75ff,
    hemiGround:0x050414,
    sun:0x8bd7ff,
    rim:0x9a55ff,
    playerLight:0x62d9ff
  }
};
function skyTexture() {
  const cv=document.createElement('canvas'); cv.width=16; cv.height=256;
  const ctx=cv.getContext('2d');
  const g=ctx.createLinearGradient(0,0,0,256);
  const theme=MAP_THEMES[mapStage] || MAP_THEMES[1];
  g.addColorStop(0.0,theme.sky[0]); g.addColorStop(0.5,theme.sky[1]);
  g.addColorStop(0.8,theme.sky[2]); g.addColorStop(1.0,theme.sky[3]);
  ctx.fillStyle=g; ctx.fillRect(0,0,16,256);
  const t=new THREE.CanvasTexture(cv); t.encoding=THREE.sRGBEncoding; return t;
}
function applyMapTheme(){
  if(!scene) return;
  const theme=MAP_THEMES[mapStage] || MAP_THEMES[1];
  scene.background=skyTexture();
  scene.fog=new THREE.Fog(theme.fog, mapStage>=3 ? 28 : mapStage>=2 ? 34 : 42, mapStage>=3 ? 96 : mapStage>=2 ? 104 : 112);
  if(renderer) renderer.setClearColor(theme.clear);
  if(ground && ground.material){
    const groundTex=tex[theme.groundKey] || tex.px_ground;
    if(groundTex){
      groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
      groundTex.repeat.set(Math.round(170/2.5), Math.round(170/2.5));
      ground.material.map=groundTex;
      ground.material.needsUpdate=true;
    }
    if(ground.material.color) ground.material.color.setHex(theme.ground);
  }
  if(borderMaterial){
    const borderTex=tex[theme.borderKey] || tex.border_wall;
    if(borderTex){
      borderMaterial.map=borderTex;
      borderMaterial.needsUpdate=true;
    }
  }
  if(hemiLight){ hemiLight.color.setHex(theme.hemiSky); hemiLight.groundColor.setHex(theme.hemiGround); hemiLight.intensity=mapStage>=3 ? 1.12 : mapStage>=2 ? 1.05 : 0.9; }
  if(sunLight){ sunLight.color.setHex(theme.sun); sunLight.intensity=mapStage>=3 ? 0.86 : mapStage>=2 ? 0.78 : 0.68; }
  if(rimLight){ rimLight.color.setHex(theme.rim); rimLight.intensity=mapStage>=3 ? 0.88 : mapStage>=2 ? 0.72 : 0.42; }
  if(playerLight){ playerLight.color.setHex(theme.playerLight); playerLight.intensity=mapStage>=3 ? 0.95 : mapStage>=2 ? 0.86 : 0.7; }
}
// multi-stop height palette -> lush stylized terrain
function terrainColor(h){
  const stops=[[0x16241d,0.0],[0x24382b,0.30],[0x33493a,0.52],
               [0x404a4e,0.72],[0x55556a,0.88],[0x6e6a86,1.0]];
  const t=Math.min(1,Math.max(0,(h+2.9)/5.8));
  let a=stops[0], b=stops[stops.length-1];
  for(let i=0;i<stops.length-1;i++){ if(t>=stops[i][1] && t<=stops[i+1][1]){ a=stops[i]; b=stops[i+1]; break; } }
  const f=(t-a[1])/((b[1]-a[1])||1);
  return new THREE.Color(a[0]).lerp(new THREE.Color(b[0]), Math.min(1,Math.max(0,f)));
}

// ---------- boot ----------
const mgr = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(mgr);
let pendingTex = 0, bootDone = false;
function bootIfReady(){ if (!bootDone && pendingTex<=0){ bootDone = true; init(); } }
for (const [k,f] of Object.entries(MANIFEST)) {
  pendingTex++;
  loader.load(SP+f, (t) => {
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false; t.encoding = THREE.sRGBEncoding;
    tex[k] = t; pendingTex--; bootIfReady();
  }, undefined, () => {
    // Optional sprite missing — code already falls back to canvas/static art at use sites.
    pendingTex--; bootIfReady();
  });
}
mgr.onLoad = bootIfReady;
mgr.onError = (u) => console.warn('tex load fail', u);

function init() {
  document.getElementById('load').style.display = 'none';
  document.body.insertAdjacentHTML('beforeend','<div id="vig"></div>');
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth*innerHeight>2200000 ? 1.25 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x140d24);

  scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0x271436, 42, 112);

  camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.1, 600);

  hemiLight = new THREE.HemisphereLight(0x8a82b8, 0x181020, 0.9);
  scene.add(hemiLight);
  sunLight = new THREE.DirectionalLight(0xb9c8ff, 0.68);
  sunLight.position.set(20, 52, -10); scene.add(sunLight);
  rimLight = new THREE.DirectionalLight(0xd34b73, 0.42);
  rimLight.position.set(-22, 12, 18); scene.add(rimLight);
  playerLight = new THREE.PointLight(0x8fb8ff, 0.7, 12, 2);
  scene.add(playerLight);

  buildGround();
  applyMapTheme();
  spawnTrees(40);
  buildScenery();
  makeBorder();

  player = makePlayer();
  makeAltar();
  for (let i=0;i<4;i++) spawnEnemy();
  document.getElementById('title').style.display='flex';
  showLeaderboard();
  initAudio(); resumeAudio(); startTitleBGM();
  document.getElementById('playbtn').onclick = ()=>{ initAudio(); resumeAudio(); stopTitleBGM(); openPlayerSetup(); };
  document.getElementById('nameconfirm').onclick = confirmPlayerName;
  document.getElementById('playername').addEventListener('keydown', e=>{ if(e.code==='Enter') confirmPlayerName(); });
  document.querySelectorAll('.titlemenu button').forEach(btn=>btn.onclick=()=>openGuide(btn.dataset.guide));
  document.getElementById('guideclose').onclick = closeGuide;
  document.getElementById('guide').onclick = e=>{ if(e.target.id==='guide') closeGuide(); };

  addEventListener('resize', onResize);
  document.getElementById('pausebtn').onclick = togglePause;
  document.getElementById('shopreroll').onclick = rerollShop;
  document.getElementById('shopclose').onclick = closeShop;
  document.getElementById('skipupgrade').onclick = skipUpgrade;
  document.getElementById('homebtn').onclick = quitToTitle;
  addEventListener('wheel', (e)=>{ camDist = clamp(camDist + Math.sign(e.deltaY)*1.3, 13, 18); }, { passive:true });
  document.getElementById('quitbtn').onclick = quitToTitle;
  addEventListener('keydown', (e)=>{ if(!started){ return; } keys[e.code]=true;
    resumeAudio();
    if (paused && ['Digit1','Digit2','Digit3'].includes(e.code)){ pickUpgrade(+e.code.slice(5)-1); e.preventDefault(); return; }
    if (paused && (e.code==='Digit0'||e.code==='Numpad0'||e.code==='Backspace')){ skipUpgrade(); e.preventDefault(); return; }
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    if (e.code==='Space' && !e.repeat) tryDash();
    if ((e.code==='KeyP'||e.code==='Escape') && !e.repeat && !gameOver && !paused) togglePause();
    if (e.code==='KeyF' && !e.repeat){ if (document.getElementById('shop').style.display==='flex') closeShop(); else activateNearby(); }
    if (e.code==='KeyR' && (gameOver||won)) restart();
    if (e.code==='KeyC' && (gameOver||won)){ started=false; document.getElementById('select').style.display='none'; document.getElementById('over').style.display='none'; openPlayerSetup(); }
  });
  addEventListener('keyup', (e)=>{ keys[e.code]=false; });

  clock = new THREE.Clock();
  try {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.28, 0.88);
    composer.addPass(bloom);
  } catch(e){ composer=null; console.warn('bloom unavailable, plain render', e); }
  renderer.setAnimationLoop(frame);
}

function onResize(){
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth*innerHeight>2200000 ? 1.25 : 1.5));
  renderer.setSize(innerWidth,innerHeight);
  if (composer) composer.setSize(innerWidth,innerHeight);
}

// ---------- builders ----------
function buildGround() {
  const S = 170, N = 90;
  const t = tex['px_ground'];
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(Math.round(S/2.5), Math.round(S/2.5));   // ~2.5 world units per tile
  const geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  for (let i=0;i<pos.count;i++){ const x=pos.getX(i), z=pos.getZ(i); pos.setY(i, groundHeight(x,z)); }
  geo.computeVertexNormals();
  // bake slope shading into vertex colors so hills read (flat-top lit, slopes darker)
  const nrm=geo.attributes.normal, colors=[];
  const L=new THREE.Vector3(0.4,1,0.3).normalize();
  for (let i=0;i<nrm.count;i++){
    const d=Math.max(0, nrm.getX(i)*L.x + nrm.getY(i)*L.y + nrm.getZ(i)*L.z);
    const sh=0.55 + 0.45*d;
    colors.push(sh,sh,sh);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
  ground = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map:t, vertexColors:true, fog:true }));
  scene.add(ground);
}
function buildScenery() {
  const scatter=(key, n, h, minR, solidR)=>{
    for (let i=0;i<n;i++){
      const x=(Math.random()*2-1)*MAP_BOUND, z=(Math.random()*2-1)*MAP_BOUND;
      if (Math.hypot(x,z) < (minR||5)) continue;
      const s=billboard(key, h*(0.8+Math.random()*0.5));
      s.position.set(x, groundHeight(x,z), z); scene.add(s);
      let obstacle=null;
      if (solidR){ obstacle={ x, z, r:solidR }; obstacles.push(obstacle); }
      worldScenery.push({ spr:s, obstacle });
    }
  };
  scatter('px_rock', 20, 1.0, 6, 0.55);     // big rocks solid
  scatter('px_rock_small', 25, 0.7, 5);     // small rocks walkable
  scatter('px_grass', 140, 0.7, 4);
  scatter('px_mushroom', 30, 0.6, 5);
  scatter('px_wisp', 25, 0.5, 5);
  for (let i=0;i<45;i++){
    const x=(Math.random()*2-1)*MAP_BOUND, z=(Math.random()*2-1)*MAP_BOUND;
    if (Math.hypot(x,z) < 6) continue;
    const s=billboard(Math.random()<0.4?'px_bush_berry':'px_bush', 0.85+Math.random()*0.4);
    s.position.set(x, groundHeight(x,z), z); scene.add(s);
    worldScenery.push({ spr:s, obstacle:null });
  }
  let fl=0, guard=0;
  while (fl<100 && guard++<700){
    const cx=(Math.random()*2-1)*MAP_BOUND, cz=(Math.random()*2-1)*MAP_BOUND;
    if (Math.hypot(cx,cz) < 5) continue;
    const patch=1+(Math.random()*4|0);
    for (let j=0;j<patch && fl<100;j++){
      const x=cx+(Math.random()-0.5)*2.4, z=cz+(Math.random()-0.5)*2.4;
      if (Math.abs(x)>MAP_BOUND||Math.abs(z)>MAP_BOUND) continue;
      const s=billboard('px_flower', 0.55+Math.random()*0.25);
      s.position.set(x, groundHeight(x,z), z); scene.add(s); worldScenery.push({ spr:s, obstacle:null }); fl++;
    }
  }
  // ancient castle ruins (landmarks, sparse)
  scatter('px_ruin_rubble', 12, 0.85, 6);     // small rubble is visual-only to avoid invisible snagging
  scatter('px_ruin_wall',    6, 1.8, 8, 1.0);
  scatter('px_ruin_pillar',  5, 2.5, 7, 0.5);
  scatter('px_ruin_arch',    3, 3.0, 9);
  scatter('px_ruin_statue',  3, 2.3, 8, 0.5);
  // gravestones in little graveyard clusters
  for (let c=0;c<3;c++){
    const cx=(Math.random()*2-1)*MAP_BOUND*0.9, cz=(Math.random()*2-1)*MAP_BOUND*0.9;
    if (Math.hypot(cx,cz) < 8) continue;
    const rows=2+(Math.random()*2|0), cols=2+(Math.random()*3|0);
    for (let r=0;r<rows;r++) for (let k=0;k<cols;k++){
      const x=cx+(k-cols/2)*2.0+(Math.random()-0.5), z=cz+(r-rows/2)*2.4+(Math.random()-0.5);
      if (Math.abs(x)>MAP_BOUND||Math.abs(z)>MAP_BOUND||Math.hypot(x,z)<6) continue;
      const g=billboard('px_ruin_grave', 1.15+Math.random()*0.25);
      g.position.set(x, groundHeight(x,z), z); scene.add(g);
      const obstacle={ x, z, r:0.4 }; obstacles.push(obstacle); worldScenery.push({ spr:g, obstacle });
    }
  }
}
function clearWorldScenery(){
  for(const p of worldScenery){
    if(p.spr) scene.remove(p.spr);
    if(p.obstacle){
      const idx=obstacles.indexOf(p.obstacle);
      if(idx>=0) obstacles.splice(idx,1);
    }
  }
  worldScenery.length=0;
}
function clearStageScenery(){
  for(const p of stageProps){
    if(p.spr) scene.remove(p.spr);
    if(p.obstacle){
      const idx=obstacles.indexOf(p.obstacle);
      if(idx>=0) obstacles.splice(idx,1);
    }
  }
  stageProps.length=0;
}
function pixelPropTexture(key,w,h,draw){
  if(tex[key]) return;
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,w,h);
  draw(ctx,w,h);
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  tex[key]=t;
}
function ensureStagePropTextures(){
  pixelPropTexture('map2_blood_crystal',32,44,(c)=>{
    c.fillStyle='rgba(255,52,42,0.18)'; c.fillRect(5,3,22,34);
    c.fillStyle='#4b0710'; c.fillRect(13,9,7,29); c.fillRect(9,18,15,20); c.fillRect(7,38,19,4);
    c.fillStyle='#a91524'; c.fillRect(12,12,9,25); c.fillRect(10,22,12,12);
    c.fillStyle='#ff4f3f'; c.fillRect(15,5,4,31); c.fillRect(9,18,5,17); c.fillRect(21,21,4,14);
    c.fillStyle='#ffd0a2'; c.fillRect(16,7,2,13); c.fillRect(11,20,2,5);
    c.fillStyle='#24050a'; c.fillRect(8,41,17,3);
  });
  pixelPropTexture('map2_ember_spire',28,54,(c)=>{
    c.fillStyle='rgba(255,106,35,0.15)'; c.fillRect(4,5,20,42);
    c.fillStyle='#2a0908'; c.fillRect(9,14,10,37); c.fillRect(6,47,17,4);
    c.fillStyle='#5d1810'; c.fillRect(11,11,9,36);
    c.fillStyle='#b63819'; c.fillRect(13,8,6,32); c.fillRect(9,26,12,8);
    c.fillStyle='#ffb13b'; c.fillRect(14,3,4,23); c.fillRect(12,30,3,7);
    c.fillStyle='#fff0a5'; c.fillRect(15,5,2,10);
  });
  pixelPropTexture('map2_bone_totem',30,42,(c)=>{
    c.fillStyle='rgba(255,196,122,0.12)'; c.fillRect(5,5,20,30);
    c.fillStyle='#31110c'; c.fillRect(13,13,4,24); c.fillRect(7,35,16,4);
    c.fillStyle='#d7c09b'; c.fillRect(9,7,12,8); c.fillRect(7,18,16,4); c.fillRect(8,27,14,4);
    c.fillStyle='#fff1cf'; c.fillRect(11,8,3,5); c.fillRect(17,8,3,5); c.fillRect(10,19,9,2);
    c.fillStyle='#7d2118'; c.fillRect(12,15,7,3); c.fillRect(14,24,4,3);
  });
  pixelPropTexture('map2_crimson_brazier',34,34,(c)=>{
    c.fillStyle='rgba(255,74,38,0.22)'; c.fillRect(5,2,24,20);
    c.fillStyle='#1d0a09'; c.fillRect(8,19,18,5); c.fillRect(12,24,3,8); c.fillRect(20,24,3,8); c.fillRect(9,31,16,2);
    c.fillStyle='#6b2014'; c.fillRect(10,17,14,4);
    c.fillStyle='#ff6a23'; c.fillRect(13,9,4,9); c.fillRect(18,5,5,13); c.fillRect(10,12,4,7);
    c.fillStyle='#ffe179'; c.fillRect(15,10,2,5); c.fillRect(20,7,2,6);
  });
  pixelPropTexture('map2_lava_crack',42,18,(c)=>{
    c.fillStyle='rgba(255,76,26,0.16)'; c.fillRect(4,5,34,8);
    c.fillStyle='#2b0809'; c.fillRect(5,8,9,3); c.fillRect(13,6,8,4); c.fillRect(20,9,9,3); c.fillRect(29,6,7,3);
    c.fillStyle='#ff5b24'; c.fillRect(8,9,5,1); c.fillRect(15,8,8,1); c.fillRect(23,10,5,1); c.fillRect(30,7,4,1);
    c.fillStyle='#ffd278'; c.fillRect(17,8,3,1); c.fillRect(31,7,2,1);
  });
  pixelPropTexture('map2_blood_root',34,36,(c)=>{
    c.fillStyle='rgba(184,20,32,0.10)'; c.fillRect(5,9,24,20);
    c.fillStyle='#2b090d'; c.fillRect(15,8,5,23); c.fillRect(7,27,22,3);
    c.fillStyle='#6e1420'; c.fillRect(12,13,4,13); c.fillRect(20,15,4,11); c.fillRect(9,23,4,6); c.fillRect(24,23,4,5);
    c.fillStyle='#ff584c'; c.fillRect(16,10,2,8); c.fillRect(13,16,2,5); c.fillRect(21,18,2,5);
  });
  pixelPropTexture('map3_void_obelisk',30,58,(c)=>{
    c.fillStyle='rgba(116,86,255,0.18)'; c.fillRect(5,4,20,44);
    c.fillStyle='#080716'; c.fillRect(10,14,10,38); c.fillRect(7,50,16,5);
    c.fillStyle='#21114d'; c.fillRect(12,10,9,39);
    c.fillStyle='#5d48ff'; c.fillRect(14,6,5,34); c.fillRect(11,25,12,5);
    c.fillStyle='#9ff7ff'; c.fillRect(15,9,2,18); c.fillRect(13,27,8,1);
    c.fillStyle='#05030c'; c.fillRect(8,54,17,3);
  });
  pixelPropTexture('map3_rift_crystal',34,46,(c)=>{
    c.fillStyle='rgba(75,219,255,0.16)'; c.fillRect(5,4,24,34);
    c.fillStyle='#09091d'; c.fillRect(14,12,7,28); c.fillRect(9,38,18,4);
    c.fillStyle='#2546a8'; c.fillRect(12,17,12,21);
    c.fillStyle='#54d8ff'; c.fillRect(16,7,4,29); c.fillRect(9,23,5,13); c.fillRect(23,20,5,15);
    c.fillStyle='#e8feff'; c.fillRect(17,9,2,12); c.fillRect(25,22,1,5);
  });
  pixelPropTexture('map3_rune_shard',32,30,(c)=>{
    c.fillStyle='rgba(178,111,255,0.18)'; c.fillRect(5,7,22,16);
    c.fillStyle='#080712'; c.fillRect(10,12,12,12); c.fillRect(7,24,18,2);
    c.fillStyle='#2d1b62'; c.fillRect(12,9,11,14);
    c.fillStyle='#bc76ff'; c.fillRect(15,11,2,9); c.fillRect(12,16,9,2);
    c.fillStyle='#7ff7ff'; c.fillRect(18,13,2,2);
  });
  pixelPropTexture('map3_void_torch',28,44,(c)=>{
    c.fillStyle='rgba(104,214,255,0.16)'; c.fillRect(4,3,20,25);
    c.fillStyle='#070711'; c.fillRect(12,16,4,24); c.fillRect(8,39,13,3); c.fillRect(9,14,11,4);
    c.fillStyle='#3a2c92'; c.fillRect(10,13,9,4);
    c.fillStyle='#36dcff'; c.fillRect(12,5,4,11); c.fillRect(16,8,3,8);
    c.fillStyle='#f5feff'; c.fillRect(13,6,2,5);
  });
  pixelPropTexture('map3_chain_pylon',36,42,(c)=>{
    c.fillStyle='rgba(100,80,210,0.10)'; c.fillRect(5,8,26,25);
    c.fillStyle='#080711'; c.fillRect(8,27,6,11); c.fillRect(23,27,6,11); c.fillRect(7,37,23,3);
    c.fillStyle='#30206a'; c.fillRect(10,13,4,14); c.fillRect(24,13,4,14);
    c.fillStyle='#806cff'; c.fillRect(13,15,4,3); c.fillRect(17,18,4,3); c.fillRect(21,21,4,3);
    c.fillStyle='#77eaff'; c.fillRect(11,11,2,5); c.fillRect(25,11,2,5);
  });
  pixelPropTexture('map3_star_rift',42,32,(c)=>{
    c.fillStyle='rgba(64,216,255,0.15)'; c.fillRect(5,6,32,19);
    c.fillStyle='#090817'; c.fillRect(9,15,23,5);
    c.fillStyle='#4b38cc'; c.fillRect(12,13,16,3); c.fillRect(15,18,18,3);
    c.fillStyle='#65e9ff'; c.fillRect(16,14,13,2); c.fillRect(11,17,8,2); c.fillRect(26,19,5,1);
    c.fillStyle='#ffffff'; c.fillRect(21,14,2,2); c.fillRect(15,17,1,1); c.fillRect(30,19,1,1);
  });
}
function buildStageScenery(stage){
  clearStageScenery();
  if(stage<2) return;
  ensureStagePropTextures();
  const options=stage>=3 ? [
    {key:'map3_shard', h:2.5, solid:0.42, weight:0.10},
    {key:'map3_obelisk', h:2.9, solid:0.42, weight:0.09},
    {key:'map3_crystal', h:1.75, weight:0.12},
    {key:'map3_void_obelisk', h:3.1, solid:0.44, weight:0.10},
    {key:'map3_rift_crystal', h:1.95, weight:0.16},
    {key:'map3_rune_shard', h:1.15, weight:0.17},
    {key:'map3_void_torch', h:1.8, weight:0.11},
    {key:'map3_chain_pylon', h:1.7, weight:0.08},
    {key:'map3_star_rift', h:0.82, weight:0.07}
  ] : [
    {key:'map2_rock', h:2.15, solid:0.46, weight:0.10},
    {key:'map2_pillar', h:2.65, solid:0.38, weight:0.08},
    {key:'map2_crystal', h:1.55, weight:0.14},
    {key:'map2_blood_crystal', h:1.95, weight:0.15},
    {key:'map2_ember_spire', h:2.25, weight:0.12},
    {key:'map2_bone_totem', h:1.7, weight:0.10},
    {key:'map2_crimson_brazier', h:1.25, weight:0.12},
    {key:'map2_lava_crack', h:0.55, weight:0.11},
    {key:'map2_blood_root', h:1.45, weight:0.08}
  ];
  const pick=()=>{
    const total=options.reduce((sum,opt)=>sum+opt.weight,0);
    let r=Math.random()*total;
    for(const opt of options){ r-=opt.weight; if(r<=0) return opt; }
    return options[options.length-1];
  };
  const avoidRadius=stage>=3 ? 18 : 10;
  const canPlace=(x,z,choice)=>Math.abs(x)<MAP_BOUND*0.95 && Math.abs(z)<MAP_BOUND*0.95 && Math.hypot(x,z)>avoidRadius && (!choice.solid || !blocked(x,z));
  const addProp=(x,z,choice)=>{
    if(!canPlace(x,z,choice)) return false;
    const spr=billboard(choice.key, choice.h*(0.82+Math.random()*0.38));
    spr.position.set(x, groundHeight(x,z), z);
    scene.add(spr);
    const obstacle=choice.solid ? {x,z,r:choice.solid} : null;
    if(obstacle) obstacles.push(obstacle);
    stageProps.push({spr, obstacle});
    return true;
  };
  let placed=0;
  const clusterCount=stage>=3 ? 18 : 22;
  const clusterSize=stage>=3 ? 5 : 6;
  for(let i=0;i<clusterCount;i++){
    const angle=(i/clusterCount)*Math.PI*2+Math.random()*0.35;
    const dist=(stage>=3 ? 23 : 15)+Math.random()*(stage>=3 ? 43 : 48);
    const cx=Math.cos(angle)*dist, cz=Math.sin(angle)*dist;
    for(let j=0;j<clusterSize;j++){
      const a=Math.random()*Math.PI*2, d=Math.random()*(stage>=3 ? 5.2 : 6.4);
      if(addProp(cx+Math.cos(a)*d, cz+Math.sin(a)*d, pick())) placed++;
    }
  }
  const ringCount=stage>=3 ? 38 : 42;
  for(let i=0;i<ringCount;i++){
    const angle=(i/ringCount)*Math.PI*2+Math.random()*0.08;
    const dist=(stage>=3 ? 28 : 20)+(i%3)*10+Math.random()*4;
    if(addProp(Math.cos(angle)*dist, Math.sin(angle)*dist, pick())) placed++;
  }
  if(stage>=3){
    const landmarks=['map3_void_obelisk','map3_chain_pylon','map3_void_torch','map3_rift_crystal'];
    for(let i=0;i<12;i++){
      const a=(i/12)*Math.PI*2;
      const key=landmarks[i%landmarks.length];
      const choice=options.find(opt=>opt.key===key) || pick();
      if(addProp(Math.cos(a)*38, Math.sin(a)*38, choice)) placed++;
    }
  }
  let guard=0;
  const target=stage>=3 ? 155 : 190;
  while(placed<target && guard++<1800){
    const x=(Math.random()*2-1)*MAP_BOUND*0.92, z=(Math.random()*2-1)*MAP_BOUND*0.92;
    const choice=pick();
    if(addProp(x,z,choice)) placed++;
  }
}

function billboard(key, height) {
  const mat = new THREE.SpriteMaterial({ map: tex[key], transparent:true, alphaTest:0.4, depthWrite:true });
  const s = new THREE.Sprite(mat);
  const ar = tex[key] ? (tex[key].image.width / tex[key].image.height) : 1;
  s.center.set(0.5, 0);              // pivot at feet
  s.scale.set(height*ar, height, 1);
  return s;
}
function ensureMagnetPillarTexture(){
  if (tex.obj_magnet_pillar) return;
  const cv=document.createElement('canvas'); cv.width=32; cv.height=48;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,32,48);
  ctx.fillStyle='rgba(18,10,28,0.95)'; ctx.fillRect(9,12,14,31);
  ctx.fillStyle='#2d2144'; ctx.fillRect(7,40,18,5); ctx.fillRect(10,9,12,5);
  ctx.fillStyle='#5f4f86'; ctx.fillRect(12,14,8,25);
  ctx.fillStyle='#b8fff2'; ctx.fillRect(14,4,4,18); ctx.fillRect(8,12,16,3);
  ctx.fillStyle='#52e7d1'; ctx.fillRect(15,5,2,16); ctx.fillRect(9,13,14,1);
  ctx.fillStyle='rgba(82,231,209,0.42)'; ctx.fillRect(5,8,22,2); ctx.fillRect(3,19,26,2); ctx.fillRect(6,30,20,2);
  ctx.fillStyle='#fffbd0'; ctx.fillRect(15,7,2,5);
  ctx.fillStyle='rgba(120,255,230,0.28)'; ctx.fillRect(2,6,28,28);
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  tex.obj_magnet_pillar=t;
}

function makeShadow(r){ const m=new THREE.Mesh(SHADOW_GEO, SHADOW_MAT); m.rotation.x=-Math.PI/2; m.scale.set(r,r,r); return m; }
function makePlayerHealthBar(){
  const g=new THREE.Group();
  const bg=new THREE.Sprite(new THREE.SpriteMaterial({ color:0x0b0610, transparent:true, opacity:0.78, depthTest:false, depthWrite:false }));
  bg.scale.set(1.34,0.16,1); bg.renderOrder=20; g.add(bg);
  const fill=new THREE.Sprite(new THREE.SpriteMaterial({ color:0x58e070, transparent:true, opacity:0.95, depthTest:false, depthWrite:false }));
  fill.center.set(0,0.5); fill.position.x=-0.59; fill.scale.set(1.18,0.08,1); fill.renderOrder=21; g.add(fill);
  g.visible=false; g.userData={ fill };
  scene.add(g); return g;
}
const entityAuraTextures=new Map();
function getEntityAuraTexture(kind){
  if(entityAuraTextures.has(kind)) return entityAuraTextures.get(kind);
  const cv=document.createElement('canvas'); cv.width=64; cv.height=64;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const cx=32, cy=32;
  if(kind==='boss'){
    ctx.strokeStyle='rgba(255,255,255,0.95)';
    ctx.lineWidth=3;
    for(let i=0;i<20;i++){
      const a=(i/20)*Math.PI*2;
      const r=25+(i%2)*3;
      const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r;
      ctx.fillStyle=i%2?'rgba(255,255,255,0.75)':'rgba(255,255,255,0.45)';
      ctx.fillRect(Math.round(x)-1,Math.round(y)-1,3,3);
    }
    ctx.beginPath(); ctx.arc(cx,cy,24,0,Math.PI*2); ctx.stroke();
    ctx.lineWidth=1; ctx.beginPath(); ctx.arc(cx,cy,15,0,Math.PI*2); ctx.stroke();
  } else {
    ctx.fillStyle='rgba(255,255,255,0.95)';
    ctx.fillRect(30,8,4,48);
    ctx.fillRect(8,30,48,4);
    ctx.fillRect(20,20,24,24);
    ctx.globalAlpha=0.45;
    ctx.fillRect(27,13,10,38);
    ctx.fillRect(13,27,38,10);
    ctx.globalAlpha=0.22;
    ctx.fillRect(24,6,16,52);
    ctx.fillRect(6,24,52,16);
  }
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  entityAuraTextures.set(kind,t); return t;
}
function makeBossAura(color, rad, final){
  const g=new THREE.Group();
  const geo=new THREE.PlaneGeometry(rad*3.6,rad*3.6); geo.rotateX(-Math.PI/2);
  const outer=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map:getEntityAuraTexture('boss'), color, transparent:true, opacity:final?0.76:0.58,
    alphaTest:0.06, side:THREE.DoubleSide, depthWrite:false
  }));
  outer.position.y=0.06; g.add(outer);
  const inner=new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
    map:getEntityAuraTexture('boss'), color:0xffffff, transparent:true, opacity:final?0.22:0.14,
    alphaTest:0.08, side:THREE.DoubleSide, depthWrite:false
  }));
  inner.scale.setScalar(0.62); inner.position.y=0.08; inner.rotation.z=Math.PI/8; g.add(inner);
  scene.add(g); return g;
}
function makeObjectGlow(color, rad, type){
  const g=new THREE.Group();
  const base=type==='chest'?1.0:type==='shrine'?1.2:1.08;
  const geo=new THREE.PlaneGeometry(rad*2.4*base,rad*2.4*base); geo.rotateX(-Math.PI/2);
  const foot=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map:getEntityAuraTexture('object'), color, transparent:true,
    opacity:type==='chest'?0.34:0.42, alphaTest:0.05, side:THREE.DoubleSide,
    depthWrite:false, blending:THREE.AdditiveBlending
  }));
  foot.position.y=0.045; g.add(foot);
  const core=new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
    map:getEntityAuraTexture('object'), color:0xffffff, transparent:true,
    opacity:type==='chest'?0.10:0.16, alphaTest:0.08, side:THREE.DoubleSide,
    depthWrite:false, blending:THREE.AdditiveBlending
  }));
  core.scale.setScalar(0.46); core.position.y=0.065; core.rotation.z=Math.PI/4; g.add(core);
  scene.add(g); return g;
}

const lootBeaconTextures=new Map();
function getLootBeaconTexture(color){
  if(lootBeaconTextures.has(color)) return lootBeaconTextures.get(color);
  const cv=document.createElement('canvas'); cv.width=8; cv.height=32;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const c=new THREE.Color(color), mid='#'+c.getHexString(), light='#'+c.clone().lerp(new THREE.Color(0xffffff),0.72).getHexString();
  ctx.fillStyle=mid; ctx.globalAlpha=0.18; ctx.fillRect(1,2,6,29);
  ctx.globalAlpha=0.48; ctx.fillRect(2,5,4,25);
  ctx.globalAlpha=0.9; ctx.fillStyle=light; ctx.fillRect(3,8,2,20);
  ctx.globalAlpha=1; ctx.fillRect(2,2,4,3); ctx.fillRect(1,0,2,2); ctx.fillRect(5,0,2,2);
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  lootBeaconTextures.set(color,t); return t;
}
function makeLootBeacon(color,tier){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({
    map:getLootBeaconTexture(color), color:0xffffff, transparent:true, opacity:0.72,
    alphaTest:0.04, depthWrite:false
  }));
  s.center.set(0.5,0); s.scale.set(0.28+tier*0.06,2.0+tier*0.35,1);
  scene.add(s); return s;
}

// ---- Sprite-sheet walk animations ----
// Horizontal strip: N frames in a row. Drop the PNG in assets/sprites/, add it
// to MANIFEST, and list it here as baseSpriteKey -> {sheet, frames, fps}.
// Until the sheet image loads, the entity uses its single static sprite.
const WALK_SHEETS = { 'enemy_abyssal_horror':{sheet:'enemy_abyssal_horror_walk',frames:4,fps:7}, 'enemy_blight_treant':{sheet:'enemy_blight_treant_walk',frames:4,fps:7}, 'enemy_bog_elemental':{sheet:'enemy_bog_elemental_walk',frames:4,fps:7}, 'enemy_bog_fiend':{sheet:'enemy_bog_fiend_walk',frames:4,fps:7}, 'enemy_bone_stalker':{sheet:'enemy_bone_stalker_walk',frames:4,fps:7}, 'enemy_chaos_wisp':{sheet:'enemy_chaos_wisp_walk',frames:4,fps:7}, 'enemy_crypt_spider':{sheet:'enemy_crypt_spider_walk',frames:4,fps:7}, 'enemy_cursed_knight':{sheet:'enemy_cursed_knight_walk',frames:4,fps:7}, 'enemy_dark_apostle':{sheet:'enemy_dark_apostle_walk',frames:4,fps:7}, 'enemy_dire_bat':{sheet:'enemy_dire_bat_walk',frames:4,fps:7}, 'enemy_fen_stalker':{sheet:'enemy_fen_stalker_walk',frames:4,fps:7}, 'enemy_grave_robber':{sheet:'enemy_grave_robber_walk',frames:4,fps:7}, 'enemy_leech_swarm':{sheet:'enemy_leech_swarm_walk',frames:4,fps:7}, 'enemy_marsh_lurker':{sheet:'enemy_marsh_lurker_walk',frames:4,fps:7}, 'enemy_muck_slime':{sheet:'enemy_muck_slime_walk',frames:4,fps:7}, 'enemy_nether_drake':{sheet:'enemy_nether_drake_walk',frames:4,fps:7}, 'enemy_oblivion_orb':{sheet:'enemy_oblivion_orb_walk',frames:4,fps:7}, 'enemy_plague_rat':{sheet:'enemy_plague_rat_walk',frames:4,fps:7}, 'enemy_rift_phantom':{sheet:'enemy_rift_phantom_walk',frames:4,fps:7}, 'enemy_rot_hound':{sheet:'enemy_rot_hound_walk',frames:4,fps:7}, 'enemy_shade':{sheet:'enemy_shade_walk',frames:4,fps:7}, 'enemy_shadow_weaver':{sheet:'enemy_shadow_weaver_walk',frames:4,fps:7}, 'enemy_swamp_witch':{sheet:'enemy_swamp_witch_walk',frames:4,fps:7}, 'enemy_toxic_spore':{sheet:'enemy_toxic_spore_walk',frames:4,fps:7}, 'enemy_void_reaper':{sheet:'enemy_void_reaper_walk',frames:4,fps:7}, 'enemy_void_walker':{sheet:'enemy_void_walker_walk',frames:4,fps:7}, 'enemy_willow_wisp':{sheet:'enemy_willow_wisp_walk',frames:4,fps:7}, 'enemy_wraith':{sheet:'enemy_wraith_walk',frames:4,fps:7}, 'miniboss_colossus':{sheet:'miniboss_colossus_walk',frames:4,fps:7}, 'miniboss_executioner':{sheet:'miniboss_executioner_walk',frames:4,fps:7}, 'miniboss_horror':{sheet:'miniboss_horror_walk',frames:4,fps:7}, 'miniboss_skeleton_lord':{sheet:'miniboss_skeleton_lord_walk',frames:4,fps:7}, 'miniboss_troll':{sheet:'miniboss_troll_walk',frames:4,fps:7}, 'miniboss_warden':{sheet:'miniboss_warden_walk',frames:4,fps:7} };  // enemy 4-frame walk strips
const DIR_SHEETS = { 'enemy_shade':{key:'enemy_shade_8dir',cols:1,rows:8,fps:1},'enemy_bone_stalker':{key:'enemy_bone_stalker_8dir',cols:1,rows:8,fps:1},'enemy_wraith':{key:'enemy_wraith_8dir',cols:1,rows:8,fps:1},'enemy_dire_bat':{key:'enemy_dire_bat_8dir',cols:1,rows:8,fps:1},'enemy_rot_hound':{key:'enemy_rot_hound_8dir',cols:1,rows:8,fps:1},'enemy_cursed_knight':{key:'enemy_cursed_knight_8dir',cols:1,rows:8,fps:1},'enemy_plague_rat':{key:'enemy_plague_rat_8dir',cols:1,rows:8,fps:1},'enemy_marsh_lurker':{key:'enemy_marsh_lurker_8dir',cols:1,rows:8,fps:1},'enemy_swamp_witch':{key:'enemy_swamp_witch_8dir',cols:1,rows:8,fps:1},'enemy_crypt_spider':{key:'enemy_crypt_spider_8dir',cols:1,rows:8,fps:1},'enemy_bog_fiend':{key:'enemy_bog_fiend_8dir',cols:1,rows:8,fps:1},'enemy_leech_swarm':{key:'enemy_leech_swarm_8dir',cols:1,rows:8,fps:1},'enemy_willow_wisp':{key:'enemy_willow_wisp_8dir',cols:1,rows:8,fps:1},'enemy_fen_stalker':{key:'enemy_fen_stalker_8dir',cols:1,rows:8,fps:1},'enemy_blight_treant':{key:'enemy_blight_treant_8dir',cols:1,rows:8,fps:1},'enemy_muck_slime':{key:'enemy_muck_slime_8dir',cols:1,rows:8,fps:1},'enemy_bog_elemental':{key:'enemy_bog_elemental_8dir',cols:1,rows:8,fps:1},'enemy_void_walker':{key:'enemy_void_walker_8dir',cols:1,rows:8,fps:1},'enemy_abyssal_horror':{key:'enemy_abyssal_horror_8dir',cols:1,rows:8,fps:1},'enemy_nether_drake':{key:'enemy_nether_drake_8dir',cols:1,rows:8,fps:1},'enemy_rift_phantom':{key:'enemy_rift_phantom_8dir',cols:1,rows:8,fps:1},'enemy_oblivion_orb':{key:'enemy_oblivion_orb_8dir',cols:1,rows:8,fps:1},'enemy_dark_apostle':{key:'enemy_dark_apostle_8dir',cols:1,rows:8,fps:1},'miniboss_executioner':{key:'miniboss_executioner_8dir',cols:1,rows:8,fps:1},'miniboss_horror':{key:'miniboss_horror_8dir',cols:1,rows:8,fps:1},'miniboss_skeleton_lord':{key:'miniboss_skeleton_lord_8dir',cols:1,rows:8,fps:1},'miniboss_troll':{key:'miniboss_troll_8dir',cols:1,rows:8,fps:1},'miniboss_warden':{key:'miniboss_warden_8dir',cols:1,rows:8,fps:1},'enemy_grave_robber':{key:'enemy_grave_robber_8dir',cols:1,rows:8,fps:1},'enemy_toxic_spore':{key:'enemy_toxic_spore_8dir',cols:1,rows:8,fps:1},'enemy_chaos_wisp':{key:'enemy_chaos_wisp_8dir',cols:1,rows:8,fps:1},'enemy_shadow_weaver':{key:'enemy_shadow_weaver_8dir',cols:1,rows:8,fps:1},'enemy_void_reaper':{key:'enemy_void_reaper_8dir',cols:1,rows:8,fps:1},'miniboss_colossus':{key:'miniboss_colossus_8dir',cols:1,rows:8,fps:1},'boss_lich':{key:'boss_lich_8dir',cols:1,rows:8,fps:1},'boss_behemoth':{key:'boss_behemoth_8dir',cols:1,rows:8,fps:1},'boss_reaper':{key:'boss_reaper_8dir',cols:1,rows:8,fps:1},'boss_dragon':{key:'boss_dragon_8dir',cols:1,rows:8,fps:1},'boss_overlord':{key:'boss_overlord_8dir',cols:1,rows:8,fps:1} };  // PixelLab 8-dir rotations
// Auto-fill DIR/WALK sheet configs from the rosters (only missing keys; guarded by tex[] at use sites).
[].concat(ENEMY_TYPES, MINIBOSS_TYPES, BOSS_TYPES).forEach(t=>{ if(!DIR_SHEETS[t.sprite]) DIR_SHEETS[t.sprite]={key:t.sprite+'_8dir',cols:1,rows:8,fps:1}; });
[].concat(ENEMY_TYPES, MINIBOSS_TYPES).forEach(t=>{ if(!WALK_SHEETS[t.sprite]) WALK_SHEETS[t.sprite]={sheet:t.sprite+'_walk',frames:4,fps:7}; });
// 8-direction grid sheets: rows = direction, cols = animation frame.
// dirRows maps movement direction index -> sheet row.
// dir index: 0=S 1=SE 2=E 3=NE 4=N 5=NW 6=W 7=SW  (matches PixelLab row order here)
const SHEETS = {
  player: {
    walk: { key:'player_walk', cols:6, rows:8, fps:10 },
    idle: { key:'player_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  sorceress: {
    walk: { key:'char_sorceress_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_sorceress_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  templar: {
    walk: { key:'char_templar_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_templar_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  necromancer: {
    walk: { key:'char_necromancer_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_necromancer_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  slayer: {
    walk: { key:'char_slayer_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_slayer_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  huntress: {
    walk: { key:'char_huntress_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_huntress_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  ranger: {
    walk: { key:'char_ranger_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_ranger_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
  priestess: {
    walk: { key:'char_priestess_walk', cols:6, rows:8, fps:10 },
    idle: { key:'char_priestess_idle', cols:4, rows:8, fps:6 },
    dirRows: [0,7,6,5,4,3,2,1],
  },
};

// ---- Playable characters: signature weapon + base stats + per-level passive ----
// (add SHEETS.<sheet> entries when the char_<key>_walk/idle sheets exist; falls back to paladin art)
const CHARACTERS = {
  paladin:     { name:'Paladin',     sheet:'player',      weapon:'bolt',
                 stats:{}, passive:{ desc:'+0.4 HP regen / lv', apply:p=>{ p.regen += 0.4; } } },
  huntress:    { name:'Huntress',    sheet:'huntress',    weapon:'spread',
                 stats:{ maxHp:70, spd:5.8 }, passive:{ desc:'+3.5% attack speed / lv', apply:p=>{ p.rateMul *= 1.035; } } },
  sorceress:   { name:'Sorceress',   sheet:'sorceress',   weapon:'nova',
                 stats:{ maxHp:65 }, passive:{ desc:'+3.5% damage / lv', apply:p=>{ p.dmgMul *= 1.035; } } },
  templar:     { name:'Templar',     sheet:'templar',     weapon:'orbit',
                 stats:{ maxHp:110, spd:5.2, def:7 }, passive:{ desc:'+5 max HP / lv', apply:p=>{ p.maxHp += 5; p.hp += 5; } } },
  ranger:      { name:'Ranger',      sheet:'ranger',      weapon:'arrow',
                 stats:{ maxHp:75, spd:5.6, magnet:4.4 }, passive:{ desc:'+1.5% move speed / lv', apply:p=>{ p.spd *= 1.015; } } },
  necromancer: { name:'Necromancer', sheet:'necromancer', weapon:'soulspiral',
                 stats:{ maxHp:75 }, passive:{ desc:'+3% XP gain / lv', apply:p=>{ p.xpMul *= 1.03; } } },
  slayer:      { name:'Slayer',      sheet:'slayer',      weapon:'bladewhirl',
                 stats:{ maxHp:75 }, passive:{ desc:'+2.5% damage / lv', apply:p=>{ p.dmgMul *= 1.025; } } },
  priestess:   { name:'Priestess',   sheet:'priestess',   weapon:'smite',
                 stats:{ maxHp:95, regen:0.4 }, passive:{ desc:'+0.3 regen & heal / lv', apply:p=>{ p.regen += 0.3; p.hp=Math.min(healCap(p),p.hp+10); } } },
};
let currentChar = 'paladin';
const MAX_WEAPONS = 3;   // signature + 2
function dirIndex(mx, mz){ return ((Math.round(Math.atan2(mx, mz)/(Math.PI/4)))%8+8)%8; }

function animBillboard(sheetKey, height, frames) {
  const base = tex[sheetKey];
  const t = base.clone(); t.needsUpdate = true;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = 1 / frames; t.offset.x = 0;
  const mat = new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.4, depthWrite: true });
  mat._ownsMap = true;   // cloned strip texture -> free on removal
  const s = new THREE.Sprite(mat);
  const ar = (base.image.width / frames) / base.image.height;  // single-frame aspect
  s.center.set(0.5, 0);
  s.scale.set(height * ar, height, 1);
  return s;
}

// Returns { spr, anim }. Uses the walk sheet if available, else the static sprite.
function entitySprite(baseKey, height) {
  const D = DIR_SHEETS[baseKey];
  if (D && tex[D.key]) {
    const st = makeGridState(D);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: st.map, transparent:true, alphaTest:0.4, depthWrite:true }));
    spr.material._ownsMap = true;   // each enemy clones its own 8-dir texture -> free on death
    const base = tex[D.key];
    const ar = (base.image.width/D.cols) / (base.image.height/D.rows);
    spr.center.set(0.5, 0); spr.scale.set(height*ar, height, 1);
    return { spr, anim: { grid:true, walk:st, idle:st, dirRows:[0,7,6,5,4,3,2,1] } };
  }
  const w = WALK_SHEETS[baseKey];
  if (w && tex[w.sheet]) return { spr: animBillboard(w.sheet, height, w.frames), anim: { frames: w.frames, fps: w.fps } };
  return { spr: billboard(baseKey, height), anim: null };
}

function makeGridState(c) {
  const t = tex[c.key].clone(); t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1/c.cols, 1/c.rows);
  return { map:t, cols:c.cols, rows:c.rows, fps:c.fps };
}

function makePlayer() {
  const C = CHARACTERS[currentChar] || CHARACTERS.paladin;
  const cfg = SHEETS[C.sheet] || SHEETS.player;
  let spr, anim = null;
  if (cfg && tex[cfg.walk.key]) {
    const walk = makeGridState(cfg.walk);
    const idle = tex[cfg.idle.key] ? makeGridState(cfg.idle) : walk;
    spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: walk.map, transparent:true, alphaTest:0.4, depthWrite:true }));
    const base = tex[cfg.walk.key];
    const ar = (base.image.width/cfg.walk.cols) / (base.image.height/cfg.walk.rows);
    const H = 1.7; spr.center.set(0.5, 0); spr.scale.set(H*ar, H, 1);
    anim = { grid:true, walk, idle, dirRows: cfg.dirRows };
  } else {
    spr = billboard('player', 1.7);
  }
  const sh = makeShadow(0.72);
  const hpbar = makePlayerHealthBar();
  scene.add(spr); scene.add(sh);
  const p = { x:0, z:0, hp:80, maxHp:80, def:5, spd:PLAYER_SPEED,
           level:1, xp:0, xpToNext:xpRequired(1), gold:0, alive:true, moving:false, dir:0,
           invuln:0, flash:0, hpBarUntil:0, cd:0, runTime:0, dashTime:0, dashCd:0, dashX:0, dashZ:0, ldx:0, ldz:0, knockX:0, knockZ:0, trailT:0, magnet:PICKUP_MAGNET, regen:0, xpMul:1, goldMul:1, dmgMul:1, rateMul:1, rangeMul:1, countBonus:0, lifesteal:0, knockbackMul:0, lifeMul:1, areaLifeMul:1, projSpeedMul:1, projScale:1, tomeCount:{}, weapons:[makeWeapon(C.weapon)], items:[], itemCounts:{}, char:currentChar, passive:C.passive, bw:spr.scale.x, bh:spr.scale.y, born:0, face:1, anim, spr, sh, hpbar };
  const st = C.stats || {};
  if (st.maxHp!=null){ p.maxHp=st.maxHp; p.hp=st.maxHp; }
  if (st.spd!=null)   p.spd=st.spd;
  if (st.def!=null)   p.def=st.def;
  if (st.magnet!=null)p.magnet=st.magnet;
  if (st.regen!=null) p.regen=st.regen;
  return p;
}

function pickupItem(gi){
  if(gi.collected) return;
  gi.collected = true;
  const it = gi.item;
  it.apply(player);
  player.items.push(it);
  player.itemCounts[it.name]=(player.itemCounts[it.name]||0)+1;
  sfx('pickup');
  if (gi.spr) scene.remove(gi.spr);
  score += ({common:100,uncommon:200,rare:300,legendary:500})[it.rarity]||100;
  if (gi.glow) scene.remove(gi.glow);
  showToast('📦 '+it.name+' ('+it.rarity+')', 1.5);
}
function spawnGroundItem(x, z, item){
  const col = RARITY_COLORS[item.rarity]||0xffffff;
  // use canvas-generated icon texture (fallback until PixelLab sprites exist)
  let sprTex = tex[item.icon];
  if (!sprTex) { sprTex = makeItemIconTex(item); tex[item.icon] = sprTex; }
  const mat = new THREE.SpriteMaterial({ map: sprTex, transparent: true, alphaTest: 0.1, depthWrite: true });
  const spr = new THREE.Sprite(mat);
  spr.center.set(0.5, 0);
  spr.scale.set(0.55, 0.55, 1);
  spr.position.set(x, groundHeight(x,z)+0.3, z);
  scene.add(spr);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getPixelRingTexture(), color: RARITY_GLOW[item.rarity]||0xffffff,
    transparent: true, opacity: 0.45, alphaTest: 0.06, depthWrite: false
  }));
  glow.scale.set(1.4, 1.4, 1);
  glow.position.set(x, groundHeight(x,z)+0.05, z);
  scene.add(glow);
  groundItems.push({ x, z, item, spr, glow, collected:false, homing:false });
}
function rollItemDrop(boosted){
  const luck = 1 + (player.luck||0);
  const r = Math.random();
  let rarity = null;
  if (boosted) {
    if (r < 0.08*luck) rarity = 'legendary';
    else if (r < 0.30*luck) rarity = 'rare';
    else if (r < 0.60*luck) rarity = 'uncommon';
    else rarity = 'common';
  } else {
    if (r < 0.02*luck) rarity = 'legendary';
    else if (r < 0.10*luck) rarity = 'rare';
    else if (r < 0.25*luck) rarity = 'uncommon';
    else rarity = 'common';
  }
  if (!rarity) rarity = 'common'; // guaranteed drop, fallback to common
  const pool = ITEMS.filter(i => i.rarity === rarity);
  if (!pool.length) return null;
  return pool[(Math.random()*pool.length)|0];
}
function nearestGroundItem(x, z, range){
  let best = null, bd = range || 2.0;
  for (const gi of groundItems) {
    if (gi.collected) continue;
    const d = Math.hypot(x-gi.x, z-gi.z);
    if (d < bd) { bd = d; best = gi; }
  }
  return best;
}
function enemyPool(){
  if(mapStage>=3) return ENEMY_TYPES.filter(e=>e.tier>=2);
  if(mapStage>=2) return ENEMY_TYPES.filter(e=>e.tier>=1);
  const tier=currentTier();
  return ENEMY_TYPES.filter(e=>e.tier<=tier);
}
function minibossPool(){
  if(mapStage>=3){
    const names=new Set(['Horror','Skeleton Lord','Warden']);
    return MINIBOSS_TYPES.filter(e=>names.has(e.name));
  }
  if(mapStage>=2){
    const names=new Set(['Executioner','Horror','Skeleton Lord','Warden']);
    return MINIBOSS_TYPES.filter(e=>names.has(e.name));
  }
  const names=new Set(['Colossus','Troll','Executioner']);
  return MINIBOSS_TYPES.filter(e=>names.has(e.name));
}
function bossPool(){
  // THE OVERLORD (final boss) only on the final stage — overtime no longer forces it on early stages.
  if(mapStage>=3) return [BOSS_TYPES[BOSS_TYPES.length-1]];
  if(mapStage>=2) return BOSS_TYPES.filter(b=>['Soul Reaper','Void Wyrm','Abyssal Behemoth'].includes(b.name));
  return BOSS_TYPES.filter(b=>!b.final && ['Lich King','Abyssal Behemoth'].includes(b.name));
}
function spawnEnemy(t, px, pz) {
  if (enemies.length >= maxEnemies) return;
  if (!t){ const pool=enemyPool(); t=pool[(Math.random()*pool.length)|0]; }
  let x, z;
  if (px!==undefined){ x=clamp(px,-MAP_BOUND,MAP_BOUND); z=clamp(pz,-MAP_BOUND,MAP_BOUND); }
  else { const ang=Math.random()*Math.PI*2, d=24+Math.random()*6; x=clamp(player.x+Math.cos(ang)*d,-MAP_BOUND,MAP_BOUND); z=clamp(player.z+Math.sin(ang)*d,-MAP_BOUND,MAP_BOUND); }
  const hpSc=normalHpScale(t.tier), atkSc=normalAtkScale(t.tier);
  const { spr, anim } = entitySprite(t.sprite, t.h);
  const sh = makeShadow(t.h*0.32);
  scene.add(spr); scene.add(sh);
  const cursedMul = 1 + (player.cursed||0);
  enemies.push({ x, z, hp:t.hp*hpSc, maxHp:t.hp*hpSc, atk:Math.round(t.atk*atkSc*cursedMul), spd:t.spd*SPD_SCALE,
                 xp:t.xp, r:t.h*0.32, name:t.name, alive:true, cd:0, flash:0, isBoss:false, behavior:behaviorFor(t.name), airborne:AIRBORNE.has(t.name), kx:0, kz:0, atkCd:1+Math.random(), chargeCd:1.5+Math.random()*2, charging:0, bw:spr.scale.x, bh:spr.scale.y, born:gameTime, face:1, anim, spr, sh });
}
function spawnCluster(count){
  const pool=enemyPool(); const t=pool[(Math.random()*pool.length)|0];
  const center=pointAroundPlayer(22,28,false);
  if(!center) return;
  const cx=center.x, cz=center.z;
  for(let i=0;i<count;i++){
    const a=(i/Math.max(1,count))*Math.PI*2+Math.random()*0.35;
    const r=1.2+Math.sqrt(i)*0.9;
    spawnEnemy(t, cx+Math.cos(a)*r, cz+Math.sin(a)*r);
  }
}

function spawnMiniboss() {
  const pool=minibossPool();
  const t = pool[(Math.random()*pool.length)|0];
  const ang = Math.random()*Math.PI*2, d = 26;
  const x = clamp(player.x + Math.cos(ang)*d, -MAP_BOUND, MAP_BOUND);
  const z = clamp(player.z + Math.sin(ang)*d, -MAP_BOUND, MAP_BOUND);
  const hpSc=minibossHpScale(), atkSc=atkTimeScale()*1.15*stageAtkMul()*otPowerMul();
  const { spr, anim } = entitySprite(t.sprite, t.h);
  const sh = makeShadow(t.h*0.34);
  scene.add(spr); scene.add(sh);
  enemies.push({ x, z, hp:t.hp*hpSc, maxHp:t.hp*hpSc, atk:Math.round(t.atk*atkSc), spd:t.spd*SPD_SCALE*MINIBOSS_SPEED_MUL,
                 xp:t.xp, r:t.h*0.30, name:t.name, alive:true, cd:0, flash:0, isBoss:true, behavior:'chase', kx:0, kz:0, atkCd:0, chargeCd:0, charging:0, bw:spr.scale.x, bh:spr.scale.y, born:gameTime, face:1, anim, spr, sh });
  assignSkills(enemies[enemies.length-1], MB_SKILLS[t.sprite] || ['ring','charge']);
  { const mb=enemies[enemies.length-1]; mb.aura=makeBossAura(0xff3f66, mb.r*1.85, false); mb.tint=0xffe3e8; }
  spawnObjectPulse(x,z,0xff3f66,t.h*1.8,0.75); spawnBurst(x,z,0xff6a82,18,1.0); shake(0.22,0.16);
  showToast('\u26a0 ' + t.name + ' appears!', 2.0);
}

// low-poly 3D gothic trees — 5 variants (haunted twilight)
function leafMat(hex, vary){ return new THREE.MeshStandardMaterial({ color:new THREE.Color(hex).multiplyScalar(0.78+Math.random()*(vary||0.4)), roughness:1, flatShading:true }); }
function glowMat(hex, inten){ return new THREE.MeshStandardMaterial({ color:0x0b0b14, emissive:new THREE.Color(hex), emissiveIntensity:(inten||1.0), roughness:1, flatShading:true }); }
function blob(mat, r, x, y, z){ const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0), mat); m.position.set(x,y,z); m.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3); return m; }
function makeTree() {
  const g = new THREE.Group();
  const type = Math.floor(Math.random()*5);
  let trunkH = 1.0 + Math.random()*0.8, trunkR = 0.22, barkHex = 0x33251e;
  if (type===2){ trunkH = 1.6 + Math.random()*0.8; trunkR = 0.13; barkHex = 0x474038; }   // tall dead
  const barkMat = new THREE.MeshStandardMaterial({ color:new THREE.Color(barkHex).multiplyScalar(0.8+Math.random()*0.4), roughness:1, flatShading:true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkR*0.6, trunkR, trunkH, 6), barkMat);
  trunk.position.y = trunkH/2; g.add(trunk);

  if (type===0) {                            // gnarled dark oak
    const mat = leafMat(0x2b4632, 0.4);
    g.add(blob(mat,0.95,0,trunkH+0.5,0)); g.add(blob(mat,0.62,0.4,trunkH+0.2,0.2));
    g.add(blob(mat,0.6,-0.34,trunkH+0.38,-0.22)); g.add(blob(mat,0.6,0.06,trunkH+0.95,0));
  } else if (type===1) {                     // dark pine
    const mat = leafMat(0x1e3a32, 0.35);
    for (const [r,y,h] of [[0.92,trunkH+0.1,1.0],[0.72,trunkH+0.75,0.88],[0.48,trunkH+1.4,0.7]])
      { const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,7), mat); m.position.y=y; g.add(m); }
  } else if (type===2) {                     // dead twisted — leaning, gnarled branches reaching up
    g.rotation.z = (Math.random()-0.5)*0.2;
    for (let i=0;i<6;i++){
      const len = 0.7 + Math.random()*0.9;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, len, 5), barkMat);
      const a = Math.random()*6.28;
      br.position.set(Math.cos(a)*0.13, trunkH*0.6 + i*0.16, Math.sin(a)*0.13);
      br.rotation.set((Math.random()*0.5+0.15)*Math.cos(a), a, (Math.random()*0.5+0.15)*Math.sin(a)*-1);
      g.add(br);
    }
  } else if (type===3) {                     // weeping willow (dark, drooping)
    const mat = leafMat(0x33402c, 0.4);
    g.add(blob(mat,0.7,0,trunkH+0.4,0));
    for (let i=0;i<6;i++){ const a=(i/6)*Math.PI*2; const d=new THREE.Mesh(new THREE.IcosahedronGeometry(0.3,0), mat);
      d.position.set(Math.cos(a)*0.7, trunkH+0.05, Math.sin(a)*0.7); d.scale.set(0.6,1.55,0.6); g.add(d); }
  } else {                                   // glowing spore tree (eerie)
    const mat = leafMat(0x24332e, 0.3);
    g.add(blob(mat,0.8,0,trunkH+0.45,0)); g.add(blob(mat,0.55,0.35,trunkH+0.2,0.2));
    const gm = glowMat(Math.random()<0.5?0x4fe0d8:0x9a6cff, 1.0);
    for (let i=0;i<6;i++){ const a=Math.random()*6.28, rad=0.4+Math.random()*0.4;
      const gb=new THREE.Mesh(new THREE.IcosahedronGeometry(0.12,0), gm);
      gb.position.set(Math.cos(a)*rad, trunkH+0.3+Math.random()*0.6, Math.sin(a)*rad); g.add(gb); }
  }
  const sc = 0.85 + Math.random()*0.6; g.scale.set(sc, sc, sc); g.rotation.y = Math.random()*6.28;
  return g;
}
// dark thorny bush, sometimes glowing berries
function makeBush() {
  const g = new THREE.Group();
  const mat = leafMat(0x2c4030, 0.4);
  const n = 2 + (Math.random()*3|0);
  for (let i=0;i<n;i++){ const r=0.4+Math.random()*0.35;
    g.add(blob(mat, r, (Math.random()-0.5)*0.7, r*0.75, (Math.random()-0.5)*0.7)); }
  if (Math.random()<0.45){ const gm=glowMat(Math.random()<0.5?0x6affa0:0x9a6cff, 0.9);
    for (let i=0;i<4;i++){ const b=new THREE.Mesh(new THREE.SphereGeometry(0.07,6,6), gm);
      b.position.set((Math.random()-0.5)*0.8, 0.35+Math.random()*0.5, (Math.random()-0.5)*0.8); g.add(b); } }
  const sc=0.8+Math.random()*0.6; g.scale.set(sc,sc,sc); return g;
}
// will-o-wisp orb OR pale mushroom cluster (replaces bright flowers)
function makeFlower() {
  const g = new THREE.Group();
  if (Math.random()<0.6) {                   // will-o-wisp
    const h=0.4+Math.random()*0.6;
    const hue=[0x4fe0d8,0x9a6cff,0x6affa0][(Math.random()*3)|0];
    const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(0.12+Math.random()*0.06,0), glowMat(hue,1.15));
    orb.position.y=h; g.add(orb);
  } else {                                   // pale mushroom cluster
    const capCol=[0x7a5a8a,0x4f7a76,0x8a8a9a][(Math.random()*3)|0];
    const n=1+(Math.random()*3|0);
    for (let i=0;i<n;i++){ const hh=0.18+Math.random()*0.22; const ox=(Math.random()-0.5)*0.4, oz=(Math.random()-0.5)*0.4;
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.045,hh,5), new THREE.MeshStandardMaterial({ color:0xc7c0d2, roughness:1 }));
      stem.position.set(ox,hh/2,oz); g.add(stem);
      const cap=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6), new THREE.MeshStandardMaterial({ color:capCol, emissive:new THREE.Color(capCol).multiplyScalar(0.35), roughness:1 }));
      cap.scale.y=0.6; cap.position.set(ox,hh,oz); g.add(cap); }
  }
  const sc=0.85+Math.random()*0.6; g.scale.set(sc,sc,sc); g.rotation.y=Math.random()*6.28; return g;
}
function spawnTrees(n) {
  const clusters=[];
  for (let i=0;i<13;i++) clusters.push({ cx:(Math.random()*2-1)*MAP_BOUND*0.9, cz:(Math.random()*2-1)*MAP_BOUND*0.9 });
  let placed=0, guard=0;
  while (placed<n && guard++<n*6){
    const cl=clusters[(Math.random()*clusters.length)|0];
    const x=cl.cx+(Math.random()*2-1)*9, z=cl.cz+(Math.random()*2-1)*9;
    if (Math.abs(x)>MAP_BOUND || Math.abs(z)>MAP_BOUND) continue;
    if (Math.hypot(x,z) < 7) continue;
    const r=Math.random();
    const key = r<0.30?'px_tree_pine' : r<0.60?'px_tree_oak' : r<0.78?'px_tree_willow' : r<0.92?'px_tree_dead' : 'px_tree_spore';
    const spr = billboard(key, 2.3+Math.random()*1.0);
    spr.position.set(x, groundHeight(x,z), z);
    scene.add(spr);
    const obstacle={ x, z, r:0.45 };
    obstacles.push(obstacle);
    worldScenery.push({ spr, obstacle });
    placed++;
  }
}
