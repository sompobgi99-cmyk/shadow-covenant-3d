let crescentTexture=null;
function getCrescentTexture(){
  if (crescentTexture) return crescentTexture;
  const cv=document.createElement('canvas'); cv.width=48; cv.height=24;
  const ctx=cv.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  const poly=(points,color)=>{
    ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0],points[i][1]);
    ctx.closePath(); ctx.fill();
  };
  poly([[3,20],[4,16],[7,12],[11,8],[16,5],[22,3],[28,3],[34,5],[39,8],[43,12],[46,17],[46,21],
        [43,21],[41,17],[37,13],[33,10],[28,8],[22,8],[17,10],[13,13],[10,16],[8,21]],'#7d1830');
  poly([[6,19],[8,14],[12,10],[17,7],[22,5],[28,5],[34,7],[39,11],[43,16],[44,20],
        [41,19],[38,15],[33,12],[28,10],[23,10],[18,12],[14,15],[11,20]],'#f04458');
  poly([[10,17],[13,12],[18,9],[23,7],[29,7],[35,10],[40,14],[43,18],
        [40,16],[35,12],[29,9],[23,9],[18,11],[14,14],[12,18]],'#ff9b8f');
  const edge=[[12,12],[14,10],[16,9],[18,8],[20,7],[23,6],[26,6],[29,7],[32,8],[34,9],[36,10],[38,12],[40,14]];
  ctx.fillStyle='#fff4d6';
  for(const [x,y] of edge) ctx.fillRect(x,y,2,2);
  ctx.fillStyle='#ff5166';
  ctx.fillRect(2,18,3,2); ctx.fillRect(6,10,2,2); ctx.fillRect(40,8,3,2);
  ctx.fillStyle='#ffd4b8';
  ctx.fillRect(1,14,2,2); ctx.fillRect(44,12,2,2);
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter;
  t.generateMipmaps=false; t.needsUpdate=true;
  crescentTexture=t;
  return t;
}
const pixelProjectileTextures=new Map();
function getPixelProjectileTexture(shape,color){
  const key=shape+'_'+color;
  if(pixelProjectileTextures.has(key)) return pixelProjectileTextures.get(key);
  const tall=shape==='smite', cv=document.createElement('canvas');
  cv.width=tall?16:32; cv.height=tall?48:16;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const base=new THREE.Color(color||0xffffff);
  const dark='#'+base.clone().multiplyScalar(0.42).getHexString();
  const mid='#'+base.getHexString();
  const light='#'+base.clone().lerp(new THREE.Color(0xffffff),0.68).getHexString();
  const px=(x,y,w,h,c)=>{ ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  if(shape==='orb'||shape==='doom'||shape==='soul'){
    px(5,6,2,4,dark); px(7,4,3,8,dark); px(10,3,6,10,dark); px(16,4,5,8,dark); px(21,6,3,4,dark);
    px(8,6,3,6,mid); px(11,4,7,8,mid); px(18,6,4,5,mid);
    px(12,5,5,5,light); px(14,4,3,2,'#ffffff');
    if(shape==='doom'){ px(3,7,4,2,mid); px(23,5,5,2,mid); px(25,10,4,2,dark); }
    if(shape==='soul'){ px(4,3,3,2,mid); px(2,1,2,2,light); px(22,12,3,2,mid); }
  } else if(shape==='shard'){
    px(3,7,6,2,dark); px(7,5,8,6,dark); px(13,3,8,10,dark); px(20,5,7,6,dark); px(27,7,3,2,dark);
    px(8,7,7,3,mid); px(14,5,8,6,mid); px(21,7,5,3,mid);
    px(15,6,5,3,light); px(18,5,3,2,'#ffffff');
  } else if(shape==='arrow'){
    px(2,7,20,2,dark); px(5,6,15,1,mid); px(5,9,15,1,mid);
    px(20,4,4,8,dark); px(23,3,7,10,dark); px(22,5,5,6,mid); px(25,6,4,4,light);
    px(2,5,4,2,mid); px(2,10,4,2,mid);
  } else if(shape==='smite'){
    px(6,1,4,46,dark); px(4,8,8,31,mid); px(6,4,5,37,light); px(8,2,2,35,'#ffffff');
    px(2,38,12,4,mid); px(0,43,16,3,dark); px(5,46,6,2,light);
  }
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter;
  t.generateMipmaps=false; t.needsUpdate=true;
  pixelProjectileTextures.set(key,t); return t;
}
function spawnProjectile(dx,dz,s){
  const sc=player.projScale||1;
  let m, hitRadius=0.4, noTrail=true, spin=0;
  if (s.shape==='crescent'){
    const mat=new THREE.SpriteMaterial({
      map:getCrescentTexture(), color:0xffffff, transparent:true, opacity:1,
      alphaTest:0.12, blending:THREE.NormalBlending, depthWrite:false
    });
    mat.rotation=-Math.atan2(dz,dx)-Math.PI/2;
    m=new THREE.Sprite(mat);
    m.scale.set(2.6*sc,1.3*sc,1);
    hitRadius=0.85; noTrail=true;
  } else {
    const shape=s.shape||'orb';
    const mat=new THREE.SpriteMaterial({
      map:getPixelProjectileTexture(shape,s.color), color:0xffffff,
      transparent:true, opacity:1, alphaTest:0.1, depthWrite:false
    });
    if(shape==='arrow'||shape==='shard') mat.rotation=-Math.atan2(dz,dx);
    m=new THREE.Sprite(mat);
    if(shape==='arrow') m.scale.set(1.15*sc,0.52*sc,1);
    else if(shape==='shard') m.scale.set(1.15*sc,0.58*sc,1);
    else if(shape==='doom') m.scale.set(1.05*sc,0.62*sc,1);
    else m.scale.set(0.82*sc,0.52*sc,1);
    hitRadius=shape==='arrow'?0.36:0.42;
    spin=shape==='soul'?7:shape==='orb'||shape==='doom'?3:0;
  }
  scene.add(m);
  projectiles.push({ x:player.x, z:player.z, dx, dz, dmg:s.dmg, pierce:s.pierce, speed:s.speed, life:s.life, scale:sc, color:s.color, hitRadius, noTrail, spin, alive:true, hit:new Set(), mesh:m });
}
function killEnemy(e){
  e.alive=false; kills++;
  sfx('kill');
  if (player.lifesteal) player.hp=Math.min(player.maxHp, player.hp+player.lifesteal);
  // per-kill item effects
  if (player._demonSoul) player.killDmgBonus = Math.min(1, (player.killDmgBonus||0) + 0.001*player._demonSoul);
  if (player._demonBlood && (player._demonBloodGained||0) < 200){
    const add=Math.min(0.5*player._demonBlood, 200-(player._demonBloodGained||0));
    player._demonBloodGained=(player._demonBloodGained||0)+add; player.maxHp+=add; player.hp+=add;
  }
  if (player._soulHarv && !e.isBoss) dropPickup(e.x, e.z, 'xp', Math.max(1, Math.round(e.xp*0.4*player._soulHarv)));
  if (e.behavior==='exploder'){
    spawnBurst(e.x, e.z, 0xff7a3a, 16, 1.3);
    const dx=player.x-e.x, dz=player.z-e.z, d=Math.hypot(dx,dz);
    if (d < 2.3) hurtPlayer(Math.round(e.atk*1.5),dx/(d||1),dz/(d||1),12);
  } else spawnBurst(e.x, e.z, e.isBoss?0xffd23f:0x9a6cff, e.isBoss?22:9, e.isBoss?1.4:0.8);
  // item drop — bosses & stage bosses only
  if (e.isBoss) {
    const item = e.isStageBoss ? rollItemDrop(true) : rollItemDrop();
    if (item) spawnGroundItem(e.x, e.z, item);
    score += e.isStageBoss ? 2000 : 500;
  } else if (e.elite) {
    score += 150;
  } else {
    score += Math.round(e.xp * 2);
  }
  const rm = rewardMul();
  if (e.isStageBoss){
    for (let i=0;i<14;i++) dropPickup(e.x, e.z, 'xp', Math.round(e.xp*rm));
    for (let i=0;i<24;i++) dropPickup(e.x, e.z, 'gold', Math.round(5*rm));
    const nextStage=mapStage+1;
    const finalStage=mapStage>=3;
    spawnObjectPulse(e.x,e.z,finalStage?0x7ce7ff:mapStage>=2?0x9a55ff:0x57e0ff,10,0.7); shake(0.5,0.4);
    altarToPortal(finalStage?'victory':'nextStage', finalStage?null:nextStage); boss=null;
    showToast(finalStage?'Final portal opened!':nextStage===3?'Portal to Void Citadel opened!':'Portal to Crimson Wastes opened!', 4);
  } else if (e.isBoss){
    for (let i=0;i<6;i++) dropPickup(e.x, e.z, 'xp', Math.round(e.xp*rm));
    for (let i=0;i<10;i++) dropPickup(e.x, e.z, 'gold', Math.round(3*rm));
  } else {
    dropPickup(e.x, e.z, 'xp', Math.round(e.xp*rm));
    dropPickup(e.x, e.z, 'gold', Math.max(1, Math.round(e.xp*0.3*rm)));
    // 5% chance to drop HP orb (8-15 HP)
    if (Math.random() < 0.05) dropPickup(e.x, e.z, 'hp', 8+Math.floor(Math.random()*8));
  }
}
function makeBorder(){
  const B=MAP_BOUND+0.9;
  const wallHeight=2.8;
  const preferredWidth=8.25;
  const count=Math.ceil((B*2)/preferredWidth);
  const wallWidth=(B*2)/count+0.22;
  const geometry=new THREE.PlaneGeometry(wallWidth,wallHeight);
  geometry.translate(0,wallHeight*0.5,0);
  borderMaterial=new THREE.MeshBasicMaterial({
    map:tex.border_wall,
    transparent:true,
    alphaTest:0.08,
    side:THREE.DoubleSide,
    depthWrite:true,
    fog:true
  });
  const addWall=(x,z,rotationY)=>{
    const wall=new THREE.Mesh(geometry,borderMaterial);
    wall.position.set(x,groundHeight(x,z),z);
    wall.rotation.y=rotationY;
    scene.add(wall);
  };
  for(let i=0;i<count;i++){
    const p=-B+wallWidth*0.5+i*((B*2)/count);
    addWall(p,-B,0);
    addWall(p,B,0);
    addWall(-B,p,Math.PI*0.5);
    addWall(B,p,Math.PI*0.5);
  }
}
function makeAltar(){
  let x,z,tries=0;
  do { x=(Math.random()*2-1)*MAP_BOUND*0.8; z=(Math.random()*2-1)*MAP_BOUND*0.8; tries++; }
  while (Math.hypot(x,z)<14 && tries<40);
  const g=new THREE.Group();
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.35,1.3,8), new THREE.MeshBasicMaterial({color:0x39324a}));
  ped.position.y=0.65; g.add(ped);
  const crystal=new THREE.Mesh(new THREE.IcosahedronGeometry(0.7,0), new THREE.MeshBasicMaterial({color:0xff4d66}));
  crystal.position.y=2.1; g.add(crystal);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,60,8), new THREE.MeshBasicMaterial({color:0xff4d66, transparent:true, opacity:0.28, depthWrite:false, fog:false}));
  beam.position.y=30; g.add(beam);
  let sprIcon=null;
  if (tex['obj_altar']){ sprIcon=billboard('obj_altar', 2.8); sprIcon.position.y=0; g.add(sprIcon); crystal.visible=false; ped.visible=false; }
  g.position.set(x, groundHeight(x,z), z); scene.add(g);
  altar={ x, z, state:'idle', group:g, crystal, beam, sprIcon };
}
function removeAltar(){ if(altar){ scene.remove(altar.group); altar=null; } }
function setAltarColor(hex){ if(!altar) return; altar.crystal.material.color.setHex(hex); altar.beam.material.color.setHex(hex); }
function updateAltar(dt){
  if(!altar) return;
  const vis = altar.state!=='boss';
  altar.beam.visible=vis;
  if (altar.sprIcon){ altar.sprIcon.visible=vis; }
  else { altar.crystal.rotation.y += dt*1.5; altar.crystal.position.y = 2.1 + Math.sin(gameTime*2)*0.18; altar.crystal.visible=vis; }
}
function summonBoss(){
  if (!altar || altar.state!=='idle' || boss) return;
  sfx('boss');
  const bosses=bossPool();
  const b = bosses[(Math.random()*bosses.length)|0];
  let spriteKey = b.sprite;                               // use dedicated boss art if loaded...
  if (!(DIR_SHEETS[spriteKey] && tex[DIR_SHEETS[spriteKey].key]))
    spriteKey = MINIBOSS_TYPES[(Math.random()*MINIBOSS_TYPES.length)|0].sprite;   // ...else recycle miniboss art
  const sc = atkTimeScale()*1.3*stageAtkMul();
  const H = b.h, hp = Math.round(b.hp*bossHpScale());
  const { spr, anim } = entitySprite(spriteKey, H);
  const sh = makeShadow(H*0.34); scene.add(spr); scene.add(sh);
  boss = { x:altar.x, z:altar.z+3, hp, maxHp:hp, atk:Math.round(b.atk*sc), spd:48*SPD_SCALE,
           xp:400, r:H*0.34, name:b.name, alive:true, cd:0, flash:0, isBoss:true, isStageBoss:true,
           behavior:'boss', kx:0, kz:0, atkCd:0, chargeCd:0, charging:0, patternCd:2.5, patternFlip:0, summonCd:6, final:b.final,
           bw:spr.scale.x, bh:spr.scale.y, born:gameTime, face:1, anim, spr, sh };
  if (mapStage>=3 && b.final) setupFinalBoss(boss);
  assignSkills(boss, BOSS_SKILLS[b.sprite] || ['ring','fan','summon']);
  enemies.push(boss); boss.aura=makeBossAura(b.final?0xff3355:0xffc84a, boss.r*2.05, b.final); boss.tint=0xfff1cf; altar.state='boss';
  spawnObjectPulse(boss.x,boss.z,b.final?0xff3355:0xffc84a,H*2.15,0.9);
  spawnBurst(boss.x,boss.z,b.final?0xff3355:0xffc84a,24,1.3); shake(0.48,0.34);
  showToast('\u26a0 '+b.name+' RISES', 2.5);
}
function altarToPortal(kind,nextStage){ if(!altar) return; altar.state='portal'; altar.portalKind=kind||'victory'; altar.nextStage=nextStage||null;
  if (altar.sprIcon && tex['obj_portal']){ altar.sprIcon.material.map=tex['obj_portal']; altar.sprIcon.material.needsUpdate=true; }
  setAltarColor(altar.portalKind==='nextStage'?0xff5638:0x57e0ff); }
function rewardMul(){ return Math.min(3, 1 + Math.max(0, stageTime()-RUN_TARGET)/150); }
const HUD_ARROWS=['\u2191','\u2197','\u2192','\u2198','\u2193','\u2199','\u2190','\u2196'];
function arrowTo(dx,dz){ const a=Math.atan2(dx,-dz); return HUD_ARROWS[(((Math.round(a/(Math.PI/4))%8)+8)%8)]; }
function spawnObject(type, tier){
  let x,z,t=0; do{ x=(Math.random()*2-1)*MAP_BOUND*0.85; z=(Math.random()*2-1)*MAP_BOUND*0.85; t++; } while(Math.hypot(x,z)<12 && t<40);
  let key,h;
  if (type==='chest'){ key=['chest_common','chest_rare','chest_epic'][tier]; h=1.1; }
  else if (type==='shrine'){ key=['obj_shrine_elite','obj_shrine_blood','obj_shrine_speed','obj_shrine_curse','obj_shrine_gamble'][tier]; h=2.2; }
  else { key='obj_merchant'; h=2.3; }
  const spr=billboard(key,h); spr.position.set(x, groundHeight(x,z), z); scene.add(spr);
  const gcol = type==='chest' ? [0xffcc66,0x66aaff,0xcc66ff][tier] : type==='shrine' ? [0x6ef0e0,0xff6060,0xffcc00,0x9966ff,0xff8844][tier] : 0xffd86a;
  const glow = makeObjectGlow(gcol, type==='chest'?0.9:1.2, type); glow.position.set(x, groundHeight(x,z), z);
  const beacon=type==='chest'?makeLootBeacon(gcol,tier):null;
  if(beacon) beacon.position.set(x,groundHeight(x,z)+0.1,z);
  interactables.push({ type, tier, x, z, used:false, spr, glow, beacon, baseW:spr.scale.x, baseH:spr.scale.y });
}
function makeWorldObjects(){
  for (const tier of [0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2]) spawnObject('chest', tier);
  for (let i=0;i<3;i++) spawnObject('shrine',Math.floor(Math.random()*5));
  spawnObject('merchant',0);
}
function clearWorldObjects(){ for(const o of interactables){ scene.remove(o.spr); if(o.glow) scene.remove(o.glow); if(o.beacon) scene.remove(o.beacon); } interactables.length=0; }
function spawnAddAt(x,z){
  const pool=enemyPool(); const t=pool[(Math.random()*pool.length)|0];
  const hpSc=normalHpScale(t.tier), atkSc=normalAtkScale(t.tier); const H=t.h; const { spr, anim } = entitySprite(t.sprite, H);
  const sh=makeShadow(H*0.32); scene.add(spr); scene.add(sh);
  enemies.push({ x:clamp(x,-MAP_BOUND,MAP_BOUND), z:clamp(z,-MAP_BOUND,MAP_BOUND), hp:t.hp*hpSc, maxHp:t.hp*hpSc, atk:Math.round(t.atk*atkSc), spd:t.spd*SPD_SCALE,
    xp:t.xp, r:H*0.32, name:t.name, alive:true, cd:0, flash:0, isBoss:false,
    behavior:behaviorFor(t.name), kx:0,kz:0, atkCd:1+Math.random(), chargeCd:1.5+Math.random()*2, charging:0,
    bw:spr.scale.x, bh:spr.scale.y, born:gameTime, face:1, anim, spr, sh });
}
function spawnElite(cx,cz){
  const pool=enemyPool(); const t=pool[(Math.random()*pool.length)|0];
  const hpSc=normalHpScale(t.tier), atkSc=normalAtkScale(t.tier); const a=Math.random()*Math.PI*2, d=2+Math.random()*3;
  const x=clamp(cx+Math.cos(a)*d,-MAP_BOUND,MAP_BOUND), z=clamp(cz+Math.sin(a)*d,-MAP_BOUND,MAP_BOUND);
  const H=t.h*1.3; const { spr, anim } = entitySprite(t.sprite, H);
  const sh=makeShadow(H*0.34); scene.add(spr); scene.add(sh);
  enemies.push({ x,z, hp:t.hp*hpSc*3.6, maxHp:t.hp*hpSc*3.6, atk:Math.round(t.atk*atkSc*1.4), spd:t.spd*SPD_SCALE,
    xp:t.xp*3, r:H*0.34, name:t.name+' Elite', alive:true, cd:0, flash:0, isBoss:false, elite:true, tint:0xff9af0,
    behavior:behaviorFor(t.name), kx:0,kz:0, atkCd:1+Math.random(), chargeCd:1.5+Math.random()*2, charging:0,
    bw:spr.scale.x, bh:spr.scale.y, born:gameTime, face:1, anim, spr, sh });
}
function activateNearby(){
  if (paused||userPaused||gameOver||won||!started) return;
  if (altar && altar.state==='idle' && Math.hypot(player.x-altar.x, player.z-altar.z)<3.0){ summonBoss(); return; }
  if (altar && altar.state==='portal' && Math.hypot(player.x-altar.x, player.z-altar.z)<2.6){
    if(altar.portalKind==='nextStage') transitionToStage(altar.nextStage || mapStage+1);
    else won=true;
    return;
  }
  let best=null, bd=2.8;
  for (const o of interactables){ if(o.used) continue; const d=Math.hypot(player.x-o.x, player.z-o.z); if(d<bd){ bd=d; best=o; } }
  if (!best) return;
  if (best.type==='chest') openChest(best);
  else if (best.type==='shrine') activateShrine(best);
  else if (best.type==='merchant') openShop(best);
}
function clearCombatActors(){
  for (const e of enemies){ scene.remove(e.spr); scene.remove(e.sh); if(e.aura) scene.remove(e.aura); }
  for (const p of projectiles) scene.remove(p.mesh);
  for (const sh of enemyShots) scene.remove(sh.mesh);
  for (const p of particles) scene.remove(p.mesh);
  for (const r of rings) scene.remove(r.mesh);
  for (const tr of trails) scene.remove(tr.mesh);
  for (const pk of pickups) scene.remove(pk.spr);
  for (const gi of groundItems) { if(gi.spr) scene.remove(gi.spr); if(gi.glow) scene.remove(gi.glow); }
  for (const a of afterimages) scene.remove(a.spr);
  for (const w of novaWaves) scene.remove(w.mesh);
  for (const f of slashFx) scene.remove(f.mesh);
  for (const d of dmgNums) d.el.remove();
  enemies.length=0; projectiles.length=0; enemyShots.length=0; particles.length=0; rings.length=0;
  trails.length=0; pickups.length=0; groundItems.length=0; afterimages.length=0; novaWaves.length=0; slashFx.length=0; dmgNums.length=0;
  boss=null; weaponSig=null; enemyGrid.clear();
}
function transitionToStage(stage){
  if(stage<=mapStage) return;
  clearCombatActors();
  clearWorldObjects();
  removeAltar();
  mapStage=stage;
  stageStartTime=gameTime;   // reset the per-stage clock (timer/OT/spawn density restart)
  clearWorldScenery();
  applyMapTheme();
  buildStageScenery(stage);
  player.x=0; player.z=0; player.kx=0; player.kz=0; player.knockX=0; player.knockZ=0;
  player.hp=Math.min(player.maxHp, player.hp+Math.round(player.maxHp*0.35));
  waveTimer=0; waveInterval=stage>=3?1.9:2.4; enemiesPerWave=stage>=3?6:4; maxEnemies=stage>=3?66:44;
  hordeRemaining=0; hordeSpawnTimer=0; hordeWarned=false; nextHordeAt=Math.max(nextHordeAt, gameTime+(stage>=3?75:90));
  nextMinibossAt=gameTime+(stage>=3?35:45); mbTimer=0; relocationCursor=0;
  makeAltar();
  makeWorldObjects();
  for(let i=0;i<(stage>=3?14:10);i++) spawnEnemy();
  spawnObjectPulse(player.x,player.z,stage>=3?0x9a55ff:0xff5638,9,0.8);
  spawnBurst(player.x,player.z,stage>=3?0x7ce7ff:0xff5a3a,28,1.2);
  shake(0.35,0.24);
  showToast((MAP_THEMES[stage] && MAP_THEMES[stage].name) || 'New Map',3);
  if(stage>=3 && altar){
    altar.x=0; altar.z=8;
    altar.group.position.set(altar.x,groundHeight(altar.x,altar.z),altar.z);
    summonBoss();
  }
}
function openChest(o){
  const cost=chestCost(o.tier);
  if (player.gold < cost){ showToast('ทองไม่พอ ('+cost+')', 1.2); return; }
  player.gold-=cost; chestsOpened++; o.used=true; scene.remove(o.spr); if(o.glow) scene.remove(o.glow); if(o.beacon) scene.remove(o.beacon);
  spawnBurst(o.x, o.z, 0xffd86a, 12, 0.8);
  sfx('chest');
  // item drop from chest (higher tier = better rates)
  const item = rollItemDrop(o.tier >= 2);
  if (item) spawnGroundItem(o.x, o.z, item);
  score += [50,100,150][o.tier]||50;
}
function activateShrine(o){
  o.used=true; scene.remove(o.spr); if(o.glow) scene.remove(o.glow); if(o.beacon) scene.remove(o.beacon);
  const type=o.tier; // 0=Elite,1=Blood,2=Speed,3=Curse,4=Gamble
  const names=['Elite Pack','Blood Shrine','Speed Shrine','Curse Shrine','Gamble Shrine'];
  const cols=[0x6ef0e0,0xff4444,0xffcc00,0x9966ff,0xff8844];
  showToast(names[type],1.5);
  sfx('shrine');
  spawnBurst(o.x,o.z,cols[type],14,0.9);
  // 1 second delay before effect
  setTimeout(()=>{
    switch(type){
      case 0: // Elite Pack
        for(let i=0;i<8;i++) spawnElite(o.x,o.z);
        break;
      case 1: // Blood Shrine — lose 30% HP, get boosted item
        player.hp=Math.max(1,Math.round(player.hp*0.7));
        player.flash=0.3;
        const bitem=rollItemDrop(true);
        if(bitem) spawnGroundItem(o.x,o.z,bitem);
        break;
      case 2: // Speed Shrine — +40% speed for 30s
        player.speedBoost=(player.speedBoost||0)+0.4;
        player.speedBoostTimer=(player.speedBoostTimer||0)+30;
        break;
      case 3: // Curse Shrine — harder enemies, +50% XP/Gold for rest of run
        player.cursed=(player.cursed||0)+0.20;
        player.xpMul*=1.5; player.goldMul*=1.5;
        showToast('+50% XP & Gold — but enemies are stronger!',2);
        break;
      case 4: // Gamble Shrine — 50/50: legendary item or 12 elites
        if(Math.random()<0.5){
          const lgd=ITEMS.filter(i=>i.rarity==='legendary');
          if(lgd.length) spawnGroundItem(o.x,o.z,lgd[(Math.random()*lgd.length)|0]);
          showToast('Lucky! Legendary item!',2);
        } else {
          for(let i=0;i<12;i++) spawnElite(o.x,o.z);
          showToast('Bad luck... 12 elites!',2);
        }
        break;
    }
  },1000);
}
function shopRerollCost(o){
  return Math.round(40*Math.pow(1.6,(o&&o.shopRerolls)||0));   // each reroll ramps steeply
}
function shopBuyMul(){ return Math.pow(1.18, shopPurchases); }   // every purchase this run raises all shop prices
function rollShopStock(o){
  o.shopOffers=[];
  const rerollMul = Math.pow(1.3, (o&&o.shopRerolls)||0);   // rerolled stock costs more each time
  for (let i = 0; i < 3; i++) {
    const shopItem = rollItemDrop();
    const base = 60+(shopItem&&shopItem.rarity==='legendary'?460:shopItem&&shopItem.rarity==='rare'?280:shopItem&&shopItem.rarity==='uncommon'?160:60);
    const stableBase = Math.round(base*rerollMul);
    if (shopItem) o.shopOffers.push({ name:shopItem.name, desc:shopItem.desc, icon:shopItem.icon, rarity:shopItem.rarity, isItem:true, item:shopItem, apply:()=>{ shopItem.apply(player); player.items.push(shopItem); }, base:stableBase, price:Math.round(stableBase*shopBuyMul()) });
  }
}
function openShop(o){
  currentShopMerchant=o;
  if(!o.shopOffers) rollShopStock(o);
  shopOffers=o.shopOffers;
  buildShop(); document.getElementById('shop').style.display='flex'; paused=true;
}
function buildShop(){
  const wrap=document.getElementById('shopcards'); wrap.innerHTML='';
  shopOffers.forEach((o,i)=>{ if(o.base!=null && !o.sold) o.price=Math.round(o.base*shopBuyMul()); const aff=player.gold>=o.price && !o.sold;
    const d=document.createElement('div'); d.className='card'; d.style.opacity=o.sold?0.4:1;
    const rc = o.rarity ? {common:'#7ecf5a',uncommon:'#5a9ecf',rare:'#cf5acf',legendary:'#cfc05a'}[o.rarity] : null;
    if (rc) d.style.borderColor = rc;
    d.innerHTML='<img src="assets/sprites/'+o.icon+'.png"><div class="nm">'+o.name+'</div><div class="ds">'+o.desc+'</div><div class="key" style="color:'+(aff?'#ffe08a':'#a55')+'">\u2b24 '+o.price+(o.sold?' \u2713':'')+'</div>';
    d.onclick=()=>buyOffer(i); wrap.appendChild(d); });
  document.getElementById('shopgold').textContent='\u2b24 '+player.gold;
  const rr=document.getElementById('shopreroll');
  if(rr && currentShopMerchant){
    const cost=shopRerollCost(currentShopMerchant), can=player.gold>=cost;
    rr.textContent='\u21bb Reroll \u2b24 '+cost;
    rr.className=can?'':'disabled';
  }
}
function rerollShop(){
  const m=currentShopMerchant;
  if(!m) return;
  const cost=shopRerollCost(m);
  if(player.gold<cost){ showToast('Not enough gold',1); buildShop(); return; }
  player.gold-=cost;
  m.shopRerolls=(m.shopRerolls||0)+1;
  rollShopStock(m);
  shopOffers=m.shopOffers;
  sfx('buy');
  spawnObjectPulse(m.x,m.z,0xffd86a,2.8,0.45);
  buildShop();
}
function buyOffer(i){
  const o=shopOffers[i];
  if(!o||o.sold||player.gold<o.price) return;
  player.gold-=o.price;
  sfx('buy');
  o.apply();
  if(o.isItem) player.itemCounts[o.item.name]=(player.itemCounts[o.item.name]||0)+1;
  o.sold=true;
  shopPurchases++;          // each buy raises prices on remaining/future stock
  buildShop();
}
function closeShop(){ document.getElementById('shop').style.display='none'; currentShopMerchant=null; paused=false; }
// ---- Boss/Miniboss skill system ----
function bossShot(e, a, dmgMul=1, ox=0, oz=0){
  spawnEnemyShot(e.x+ox,e.z+oz,Math.cos(a),Math.sin(a),Math.round(e.atk*dmgMul));
}
function bossRing(e, n, offset=0, dmgMul=1){
  for(let i=0;i<n;i++) bossShot(e,(i/n)*Math.PI*2+offset,dmgMul);
}
function bossFan(e, base, count, spread, dmgMul=1){
  const mid=(count-1)/2;
  for(let i=0;i<count;i++) bossShot(e,base+(i-mid)*spread,dmgMul);
}
function bossCross(e, offset=0, dmgMul=1){
  for(let i=0;i<4;i++) bossFan(e,offset+i*Math.PI*0.5,3,0.11,dmgMul);
}
function bossPlayerAngle(e){
  return Math.atan2(player.z-e.z, player.x-e.x);
}
const SK = {
  ring:    { cd:3.0, fn:(e)=>{ const n=16; for(let i=0;i<n;i++){const a=(i/n)*6.2832; spawnEnemyShot(e.x,e.z,Math.cos(a),Math.sin(a),e.atk);} e.flash=0.12; } },
  bigRing: { cd:3.4, fn:(e)=>{ const n=24; for(let i=0;i<n;i++){const a=(i/n)*6.2832; spawnEnemyShot(e.x,e.z,Math.cos(a),Math.sin(a),e.atk);} e.flash=0.12; } },
  fan:     { cd:2.6, fn:(e,nx,nz)=>{ const b=Math.atan2(nz,nx); for(let k=-2;k<=2;k++){const a=b+k*0.18; spawnEnemyShot(e.x,e.z,Math.cos(a),Math.sin(a),e.atk);} e.flash=0.12; } },
  spiral:  { cd:3.2, fn:(e)=>{ const n=18; for(let i=0;i<n;i++){const a=(i/n)*6.2832; spawnEnemyShot(e.x,e.z,Math.cos(a),Math.sin(a),e.atk); spawnEnemyShot(e.x,e.z,Math.cos(a+0.17),Math.sin(a+0.17),e.atk);} e.flash=0.12; } },
  scatter: { cd:2.4, fn:(e)=>{ for(let i=0;i<10;i++){const a=Math.random()*6.2832; spawnEnemyShot(e.x,e.z,Math.cos(a),Math.sin(a),e.atk);} e.flash=0.1; } },
  charge:  { cd:4.0, fn:(e,nx,nz)=>{ e.charging=0.5; e.cdx=nx; e.cdz=nz; e.flash=0.15; } },
  summon:  { cd:8.0, fn:(e)=>{ for(let i=0;i<2;i++){const a=Math.random()*6.2832; spawnAddAt(e.x+Math.cos(a)*3,e.z+Math.sin(a)*3);} showToast('☠ ลูกสมุน!',1); } },
  summon3: { cd:7.0, fn:(e)=>{ for(let i=0;i<3;i++){const a=Math.random()*6.2832; spawnAddAt(e.x+Math.cos(a)*3,e.z+Math.sin(a)*3);} showToast('☠ ลูกสมุน!',1); } },
  shock:   { cd:4.5, fn:(e)=>{ spawnRing(e.x,e.z,0xffaa44,4.8,0.5); spawnBurst(e.x,e.z,0xffaa44,14,1.3); const dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz); if(d<4.5) hurtPlayer(Math.round(e.atk*1.2),dx/(d||1),dz/(d||1),14,e); shake(0.32,0.22); e.flash=0.15; } },
  lob:     { cd:2.8, fn:(e,nx,nz)=>{ spawnEnemyShot(e.x,e.z,nx,nz,Math.round(e.atk*1.4)); e.flash=0.12; } },
  heal:    { cd:6.0, fn:(e)=>{ e.hp=Math.min(e.maxHp, e.hp+e.maxHp*0.06); spawnBurst(e.x,e.z,0x6affa0,8,0.8); } },
  shield:  { cd:7.0, fn:(e)=>{ e.shieldT=3; spawnBurst(e.x,e.z,0x8fd0ff,8,0.9); } },
  lichCross: { cd:3.2, fn:(e)=>{ const a=bossPlayerAngle(e); bossCross(e,a,1.05); bossRing(e,8,a+Math.PI/8,0.75); spawnBurst(e.x,e.z,0x8bd7ff,12,1.0); e.flash=0.16; } },
  lichPrison:{ cd:5.6, fn:(e)=>{ const a=bossPlayerAngle(e); for(let i=0;i<6;i++){ const side=i%2?-1:1, dist=1.8+(i*0.45); bossFan(e,a+side*0.95,3,0.07,0.9); bossShot(e,a+side*0.55,0.95,Math.cos(a+side*1.57)*dist,Math.sin(a+side*1.57)*dist); } spawnObjectPulse(player.x,player.z,0x8bd7ff,3.2,0.55); e.flash=0.14; } },
  behemothSlam:{ cd:4.4, fn:(e)=>{ spawnRing(e.x,e.z,0xffaa44,6.2,0.55); spawnBurst(e.x,e.z,0xffaa44,24,1.5); bossRing(e,18,0,0.95); const dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz); if(d<5.7) hurtPlayer(Math.round(e.atk*1.45),dx/(d||1),dz/(d||1),19,e); shake(0.48,0.34); e.flash=0.2; } },
  behemothQuake:{ cd:5.2, fn:(e)=>{ for(let i=0;i<3;i++){ const a=bossPlayerAngle(e)+i*0.42-0.42; const ox=Math.cos(a)*(2.3+i*1.5), oz=Math.sin(a)*(2.3+i*1.5); spawnRing(e.x+ox,e.z+oz,0xffd27a,2.5+i*0.7,0.42); bossFan(e,a,5+i*2,0.18,0.85); } shake(0.38,0.26); e.flash=0.16; } },
  reaperScythes:{ cd:3.1, fn:(e)=>{ const a=bossPlayerAngle(e); for(let i=0;i<7;i++){ const o=(i-3)*0.17; bossShot(e,a+Math.PI*0.5+o,0.9); bossShot(e,a-Math.PI*0.5-o,0.9); } bossFan(e,a,7,0.12,1.0); spawnBurst(e.x,e.z,0xff3f66,16,1.0); e.flash=0.16; } },
  reaperBlink:{ cd:5.0, fn:(e)=>{ const a=bossPlayerAngle(e); const side=Math.random()<0.5?-1:1; e.x=clamp(player.x-Math.cos(a)*3.2+Math.cos(a+side*1.57)*1.4,-MAP_BOUND,MAP_BOUND); e.z=clamp(player.z-Math.sin(a)*3.2+Math.sin(a+side*1.57)*1.4,-MAP_BOUND,MAP_BOUND); spawnBurst(e.x,e.z,0xff3f66,22,1.25); bossFan(e,a,9,0.13,0.95); shake(0.28,0.18); e.flash=0.22; } },
  wyrmBreath:{ cd:3.6, fn:(e)=>{ const a=bossPlayerAngle(e); bossFan(e,a,13,0.09,0.82); bossFan(e,a,7,0.16,1.05); spawnObjectPulse(e.x+Math.cos(a)*2.2,e.z+Math.sin(a)*2.2,0x8bd7ff,4.2,0.45); e.flash=0.16; } },
  wyrmMeteor:{ cd:5.4, fn:(e)=>{ const base=bossPlayerAngle(e); for(let i=0;i<10;i++){ const a=base+(i-4.5)*0.18, sx=e.x+Math.cos(a+Math.PI*0.5)*(i-4.5)*0.55, sz=e.z+Math.sin(a+Math.PI*0.5)*(i-4.5)*0.55; spawnEnemyShot(sx,sz,Math.cos(a),Math.sin(a),Math.round(e.atk*(i%3===0?1.15:0.88))); } bossRing(e,12,gameTime*0.7,0.72); spawnBurst(e.x,e.z,0x55ddff,18,1.1); e.flash=0.16; } },
  overlordStar:{ cd:3.8, fn:(e)=>{ const a=gameTime*0.9; bossRing(e,20,a,0.8); bossCross(e,a+Math.PI/8,1.0); bossFan(e,bossPlayerAngle(e),9,0.11,1.05); spawnObjectPulse(e.x,e.z,0x9a55ff,e.r*3.4,0.48); e.flash=0.2; } },
  overlordJudgment:{ cd:6.2, fn:(e)=>{ const a=bossPlayerAngle(e); for(let i=0;i<4;i++) bossFan(e,a+i*Math.PI*0.5,7,0.12,0.9); bossRing(e,28,a+Math.PI/28,0.78); if((e.finalPhase||3)<=2) for(let i=0;i<2;i++){ const q=a+(i?1:-1)*1.2; spawnAddAt(e.x+Math.cos(q)*5,e.z+Math.sin(q)*5); } spawnBurst(e.x,e.z,0xff3355,32,1.35); shake(0.42,0.3); e.flash=0.24; } },
};
const BOSS_SKILLS = {
  boss_lich:     ['lichCross','lichPrison','summon'],
  boss_behemoth: ['behemothSlam','behemothQuake','charge'],
  boss_reaper:   ['reaperScythes','reaperBlink','scatter'],
  boss_dragon:   ['wyrmBreath','wyrmMeteor','charge'],
  boss_overlord: ['overlordStar','overlordJudgment','summon3'],
};
const MB_SKILLS = {
  miniboss_colossus:      ['shock','charge'],
  miniboss_executioner:   ['charge','fan'],
  miniboss_horror:        ['scatter','ring'],
  miniboss_skeleton_lord: ['summon','fan'],
  miniboss_troll:         ['lob','heal'],
  miniboss_warden:        ['shield','ring'],
};
function setupFinalBoss(e){
  e.finalPhase=3;
  e.phaseHp=e.maxHp/3;
  e.hp=e.maxHp;
  e.phaseInvuln=0;
  e.phaseSummonDone={};
  e.finalPulseT=1.2;
  e.spd=42*SPD_SCALE;
  e.atk=Math.round(e.atk*1.18);
}
function spawnBossAddAt(cx,cz,type,stageBoss){
  const H=type.h*(stageBoss?0.9:0.82);
  const { spr, anim } = entitySprite(type.sprite, H);
  const sh=makeShadow(H*0.34); scene.add(spr); scene.add(sh);
  const hpMul=stageBoss?0.42:0.55;
  const atkMul=stageBoss?0.72:0.86;
  const add={ x:clamp(cx,-MAP_BOUND,MAP_BOUND), z:clamp(cz,-MAP_BOUND,MAP_BOUND),
    hp:Math.round(type.hp*bossHpScale()*hpMul), maxHp:Math.round(type.hp*bossHpScale()*hpMul),
    atk:Math.round(type.atk*atkTimeScale()*atkMul), spd:(type.spd||62)*SPD_SCALE,
    xp:stageBoss?180:type.xp, r:H*0.32, name:stageBoss?type.name+' Echo':type.name, alive:true, cd:0, flash:0,
    isBoss:true, isStageBoss:false, elite:!stageBoss, behavior:'chase', kx:0,kz:0, atkCd:0, chargeCd:0,
    charging:0, bw:spr.scale.x, bh:spr.scale.y, born:gameTime, face:1, anim, spr, sh };
  assignSkills(add, stageBoss ? (BOSS_SKILLS[type.sprite] || ['ring','fan']) : (MB_SKILLS[type.sprite] || ['ring','charge']));
  add.aura=makeBossAura(stageBoss?0x8bd7ff:0xff3f66, add.r*(stageBoss?1.85:1.65), false);
  add.tint=stageBoss?0xdcecff:0xffe3e8;
  enemies.push(add);
  spawnObjectPulse(add.x,add.z,stageBoss?0x8bd7ff:0xff3f66,H*1.6,0.7);
  return add;
}
function summonFinalBossWave(e,phase){
  const bossAdds = phase===2 ? 2 : 1;
  const miniAdds = phase===2 ? 3 : 4;
  const bossChoices=BOSS_TYPES.filter(b=>!b.final);
  for(let i=0;i<bossAdds;i++){
    const a=(i/bossAdds)*Math.PI*2+0.45;
    const t=bossChoices[(Math.random()*bossChoices.length)|0];
    spawnBossAddAt(e.x+Math.cos(a)*7,e.z+Math.sin(a)*7,t,true);
  }
  for(let i=0;i<miniAdds;i++){
    const a=(i/miniAdds)*Math.PI*2+1.0;
    const pool=minibossPool();
    const t=pool[(Math.random()*pool.length)|0];
    spawnBossAddAt(e.x+Math.cos(a)*10,e.z+Math.sin(a)*10,t,false);
  }
  for(let i=0;i<(phase===2?8:12);i++) spawnAddAt(e.x+(Math.random()*2-1)*9,e.z+(Math.random()*2-1)*9);
  spawnObjectPulse(e.x,e.z,phase===2?0x8bd7ff:0xff3355,11,0.9);
  spawnBurst(e.x,e.z,phase===2?0x8bd7ff:0xff3355,34,1.3);
  shake(0.45,0.34);
  showToast(phase===2?'OVERLORD IMMUNE - echoes answer!':'OVERLORD FINAL PHASE!',3);
}
function updateFinalBossPhase(e,dt){
  if(!e.final || !e.finalPhase) return;
  if(e.phaseInvuln>0){
    e.phaseInvuln-=dt;
    e.hp=Math.max(e.hp,e.phaseHp*(e.finalPhase-1)+1);
    e.flash=Math.max(e.flash,0.05);
  }
  const nextPhase = e.hp<=e.phaseHp*2 && e.finalPhase===3 ? 2 : e.hp<=e.phaseHp && e.finalPhase===2 ? 1 : e.finalPhase;
  if(nextPhase!==e.finalPhase){
    e.finalPhase=nextPhase;
    e.phaseInvuln=nextPhase===2?9:3.2;
    e.hp=Math.max(e.hp,e.phaseHp*(nextPhase-1)+1);
    e.spd*=nextPhase===2?1.12:1.18;
    e.atk=Math.round(e.atk*(nextPhase===2?1.1:1.16));
    e.skills = nextPhase===2 ? [SK.overlordStar,SK.bigRing,SK.scatter,SK.summon3,SK.charge].filter(Boolean) : [SK.overlordJudgment,SK.overlordStar,SK.spiral,SK.bigRing,SK.fan,SK.charge,SK.summon3].filter(Boolean);
    e.skillT=e.skills.map((s,i)=>0.4+i*0.42);
    summonFinalBossWave(e,nextPhase);
  }
  e.finalPulseT=(e.finalPulseT||0)-dt;
  if(e.finalPulseT<=0){
    e.finalPulseT=e.finalPhase===1?1.15:e.finalPhase===2?1.7:2.2;
    const color=e.finalPhase===1?0xff3355:e.finalPhase===2?0x8bd7ff:0x9a55ff;
    const n=e.finalPhase===1?10:e.finalPhase===2?7:5;
    for(let i=0;i<n;i++){
      const a=(i/n)*Math.PI*2+gameTime*0.7;
      spawnEnemyShot(e.x,e.z,Math.cos(a),Math.sin(a),Math.round(e.atk*(e.finalPhase===1?1.05:0.8)));
    }
    spawnObjectPulse(e.x,e.z,color,e.r*(e.finalPhase===1?4.6:3.6),0.45);
  }
}
function assignSkills(e, names){
  e.skills = (names||[]).map(n=>SK[n]).filter(Boolean);
  e.skillT = e.skills.map((s,i)=> 1.2 + i*0.9 + Math.random()*0.6);
}
function spawnTelegraph(e){
  const color=e.isStageBoss?0xffc84a:0xff3f66;
  const radius=Math.max(2.6,e.r*(e.isStageBoss?4.3:3.7));
  spawnRing(e.x,e.z,color,radius,0.58);
  spawnRing(e.x,e.z,0xffffff,radius*0.62,0.42);
  e.flash=Math.max(e.flash,0.16);
}
function runSkills(e, dt, nx, nz, d){
  const fast = e.hp < e.maxHp*0.5 ? 0.62 : 1;   // enrage -> faster skills
  if (e.castT>0){ e.castT-=dt; if (e.castT<=0 && e.castSkill) e.castSkill.fn(e, nx, nz, d); return; }
  for (let i=0;i<e.skills.length;i++){
    e.skillT[i] -= dt;
    if (e.skillT[i] <= 0){ e.castSkill=e.skills[i]; e.castT=e.isStageBoss?0.7:0.52; e.skillT[i]=e.skills[i].cd*fast; spawnTelegraph(e); break; }
  }
}
function dropPickup(x,z,type,value){
  const a=Math.random()*Math.PI*2, pop=1.5+Math.random()*1.5;
  let key;
  if (type==='gold') key='icon_gold';
  else if (type==='hp') key='icon_heal';
  else key='icon_xp';
  // create heal icon on demand
  if (type==='hp' && !tex.icon_heal) {
    const cv=document.createElement('canvas'); cv.width=16; cv.height=16;
    const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='#c03030'; ctx.fillRect(5,0,6,16); ctx.fillRect(0,5,16,6);
    ctx.fillStyle='#ff6060'; ctx.fillRect(6,1,4,14); ctx.fillRect(1,6,14,4);
    ctx.fillStyle='#fff'; ctx.fillRect(7,2,2,12); ctx.fillRect(2,7,12,2);
    const t=new THREE.CanvasTexture(cv);
    t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
    tex.icon_heal=t;
  }
  const spr=billboard(key, 0.55);
  scene.add(spr);
  pickups.push({ x:x+Math.cos(a)*0.3, z:z+Math.sin(a)*0.3, vx:Math.cos(a)*pop, vz:Math.sin(a)*pop, type, value, alive:true, homing:false, spr });
}
function collect(pk){ pk.alive=false; if(pk.type==='gold') player.gold+=Math.round(pk.value*player.goldMul); else if(pk.type==='hp') player.hp=Math.min(player.maxHp, player.hp+pk.value); else { let v=pk.value; if(player.echoChance && Math.random()<player.echoChance) v*=2; addXP(v); } }
function addXP(v){ player.xp += Math.round(v*player.xpMul); while(player.xp>=player.xpToNext){ levelUp(); } }
function levelUp(){
  if (player.level>=MAX_LEVEL){ player.xp=0; player.xpToNext=Infinity; return; }   // hard cap
  player.xp-=player.xpToNext; player.level++;
  player.xpToNext = player.level>=MAX_LEVEL ? Infinity : xpRequired(player.level);
  player.hp=Math.min(player.maxHp, player.hp+8);
  sfx('levelup');
  if (player.passive && player.passive.apply) player.passive.apply(player);   // character passive grows per level
  pendingUps++; if(!paused) openUpgradeChoice(); }
function hurtPlayer(amt,dx,dz,force,src){
  if(player.invuln>0) return;
  if(player.evade && Math.random()<Math.min(0.75,player.evade)) return;   // Slippery Ring dodge
  sfx('hurt');
  damageTaken += amt;
  // armor = percentage mitigation (stays useful as def scales), never below 1
  const r=Math.max(1, Math.round(amt*100/(100+player.def*5)));
  player.hp-=r; player.flash=0.12; player.invuln=0.4;
  // Mirror (reflect) + Spiky Shield (thorns) strike the attacker back
  if(src && src.alive && (player.thorns||player.reflect)){
    const back=(player.thorns||0)+(player.reflect?Math.round(r*player.reflect):0);
    if(back>0) dealEnemyDamage(src, back, 0xff5566, src.x-player.x, src.z-player.z, 0);
  }
  if(dx||dz){
    const d=Math.hypot(dx,dz)||1, f=force||7;
    player.knockX+=dx/d*f; player.knockZ+=dz/d*f;
  }
  shake(0.18,0.15);
  if(player.hp<=0){ player.hp=0; player.alive=false; }
}

function cull(arr){ for(let i=arr.length-1;i>=0;i--){ const o=arr[i]; if(!o.alive){ if(o.spr) scene.remove(o.spr); if(o.sh) scene.remove(o.sh); if(o.mesh) scene.remove(o.mesh); if(o.aura) scene.remove(o.aura); arr.splice(i,1); } } }

// ---------- view sync ----------
// Give billboards life: spawn pop-in, idle breathe/bob, facing flip, hit punch
function animSprite(o, x, y, z, flash, hitColor, moving) {
  const age = gameTime - o.born;
  const pop = age < 0.25 ? 0.45 + 0.55*(age/0.25) : 1;
  const br  = Math.sin(gameTime*4 + x*0.7 + z*0.3);
  const hit = flash > 0 ? 1.14 : 1;
  const flip = (o.anim && o.anim.grid) ? 1 : o.face;  // 8-dir art faces correctly; no mirror
  const isMob = !(o.anim && o.anim.grid);
  const walk = (moving && isMob) ? Math.abs(Math.sin(gameTime*9 + o.born*7)) : 0;
  o.spr.scale.set(o.bw * flip * pop * hit * (1 - br*0.03 - walk*0.05),
                  o.bh * pop * hit * (1 + br*0.04 + walk*0.10), 1);
  o.spr.position.set(x, y + Math.abs(br)*0.06 + walk*0.16, z);
  o.spr.material.color.setHex(flash > 0 ? hitColor : (o.tint||0xffffff));
  // 8-direction grid animation (walk while moving, idle otherwise)
  if (o.anim && o.anim.grid) {
    const st = moving ? o.anim.walk : o.anim.idle;
    if (o.spr.material.map !== st.map) { o.spr.material.map = st.map; o.spr.material.needsUpdate = true; }
    const row = o.anim.dirRows[o.dir || 0];
    const col = Math.floor(gameTime * st.fps) % st.cols;
    st.map.offset.x = col / st.cols;
    st.map.offset.y = 1 - (row + 1) / st.rows;   // UV origin is bottom-left; row 0 = top
  } else if (o.anim && o.anim.frames && o.spr.material.map) {
    const col = Math.floor(gameTime * o.anim.fps) % o.anim.frames;
    o.spr.material.map.offset.x = col / o.anim.frames;
  }
}

function syncMeshes() {
  const now=performance.now();
  const py = groundHeight(player.x, player.z);
  animSprite(player, player.x, py, player.z, player.flash, 0xff7777, player.moving);
  player.spr.material.opacity = (player.invuln>0 && (now*0.02|0)%2===0) ? 0.5 : 1;
  player.sh.position.set(player.x, py+0.02, player.z);
  if(playerLight) playerLight.position.set(player.x,py+2.4,player.z+1.2);
  for (const e of enemies){ const y=groundHeight(e.x,e.z);
    animSprite(e, e.x, y, e.z, e.flash, 0xffee66, true);
    e.sh.position.set(e.x,y+0.02,e.z);
    if (e.aura){
      e.aura.position.set(e.x,y,e.z);
      const pulse=0.4+Math.sin(gameTime*(e.isStageBoss?4.2:3.2)+e.x)*0.12;
      e.aura.children[0].material.opacity=pulse;
      e.aura.children[1].material.opacity=pulse*0.48;
      e.aura.children[0].rotation.z=gameTime*(e.isStageBoss?0.62:0.34);
      e.aura.children[1].rotation.z=-gameTime*(e.isStageBoss?0.88:0.48);
    } }
  for (const p of projectiles) p.mesh.position.set(p.x, groundHeight(p.x,p.z)+0.9, p.z);
  for (const sh of enemyShots) sh.mesh.position.set(sh.x, groundHeight(sh.x,sh.z)+0.9, sh.z);
  for (const pk of pickups){ const y=groundHeight(pk.x,pk.z); const bob=Math.sin(now*0.005+pk.x)*0.12;
    pk.spr.position.set(pk.x, y+0.5+bob, pk.z); }
  for(const o of interactables){
    if(o.used) continue;
    const y=groundHeight(o.x,o.z), pulse=Math.sin(gameTime*2.6+o.x*0.2);
    if(o.type==='chest'){
      o.spr.position.set(o.x,y+0.06+pulse*0.08,o.z);
      const scale=1+pulse*0.025; o.spr.scale.set(o.baseW*scale,o.baseH*scale,1);
      if(o.beacon){ o.beacon.position.set(o.x,y+0.04,o.z); o.beacon.material.opacity=0.3+0.16*(pulse*0.5+0.5); }
    }
    if(o.glow){
      o.glow.position.set(o.x,y,o.z);
      o.glow.children[0].rotation.z=gameTime*0.22;
      o.glow.children[1].rotation.z=-gameTime*0.34;
    }
  }
  // ground items bob
  for (const gi of groundItems) {
    if (gi.collected) continue;
    const y = groundHeight(gi.x, gi.z);
    const bob = Math.sin(gameTime*3.2 + gi.x*0.3) * 0.08;
    gi.spr.position.set(gi.x, y + 0.3 + bob, gi.z);
    gi.glow.position.set(gi.x, y + 0.05, gi.z);
    gi.glow.material.opacity = 0.3 + Math.sin(gameTime*4.5 + gi.z*0.4) * 0.15;
  }
}

let camGY = 0;   // smoothed ground elevation for the camera
let shakeT = 0, shakeMag = 0;
let camDist = 13;   // camera zoom
const cameraTarget=new THREE.Vector3();
function shake(duration, magnitude){
  shakeT = Math.max(shakeT, duration);
  shakeMag = Math.max(shakeMag, magnitude);
}
function updateCamera(dt) {
  const ang = 50*Math.PI/180, D = camDist;
  const gy = groundHeight(player.x, player.z);
  camGY += (gy - camGY) * (1 - Math.pow(0.03, dt));
  const tx=player.x, tz=player.z;
  cameraTarget.set(tx, camGY + Math.sin(ang)*D, tz + Math.cos(ang)*D);
  camera.position.lerp(cameraTarget, 1-Math.pow(0.001, dt));
  camera.lookAt(tx, camGY+1.0, tz);
  if (shakeT>0){ shakeT-=dt;
    camera.position.x += (Math.random()-0.5)*shakeMag*2;
    camera.position.z += (Math.random()-0.5)*shakeMag*2;
    if (shakeT<=0) shakeMag=0; }
}

let hudAccum=0;
function updateHUD(dt){
  updateDamageNumbers(dt);
  fpsAccum+=dt; fpsFrames++;
  if (fpsAccum>=0.5){ $('fps').textContent = `FPS ${Math.round(fpsFrames/fpsAccum)}`; fpsAccum=0; fpsFrames=0; }
  hudAccum+=dt;
  if(hudAccum<0.1 && !gameOver && !won) return;
  hudAccum=0;
  $('hpfill').style.transform = `scaleX(${Math.max(0,player.hp/player.maxHp)})`;
  $('hptext').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  if (player.level>=MAX_LEVEL || !isFinite(player.xpToNext)){
    $('xpfill').style.transform = 'scaleX(1)';
    $('xptext').textContent = `LV ${player.level}  MAX`;
  } else {
    $('xpfill').style.transform = `scaleX(${Math.min(1,player.xp/player.xpToNext)})`;
    $('xptext').textContent = `LV ${player.level}   ${player.xp}/${player.xpToNext}`;
  }
  $('gold').textContent = `⬤ ${player.gold}`;
  { const rdy=player.dashCd<=0; $('dash').textContent = rdy ? '⚡ DASH [Space]' : `⚡ ${player.dashCd.toFixed(1)}s`; $('dash').style.color = rdy ? '#7CE7FF' : '#5a5a66'; }
  { const st=stageTime();
    if (st < RUN_TARGET){ $('time').textContent = fmt(st); $('time').style.color='#ffcc00'; }
    else { $('time').textContent = '⚠ OT '+fmt(st-RUN_TARGET); $('time').style.color='#ff6a6a'; } }
  const trackedBoss=(boss&&boss.alive)?boss:enemies.find(e=>e.alive&&e.isBoss);
  if (trackedBoss){
    $('bossbar').style.display='block';
    const phase=trackedBoss.finalPhase||1;
    const phaseHp=trackedBoss.phaseHp||trackedBoss.maxHp;
    const phaseBase=trackedBoss.finalPhase ? phaseHp*(phase-1) : 0;
    const phasePct=trackedBoss.finalPhase ? Math.max(0,Math.min(1,(trackedBoss.hp-phaseBase)/phaseHp)) : Math.max(0,trackedBoss.hp/trackedBoss.maxHp);
    $('bossfill').style.transform=`scaleX(${phasePct})`;
    $('bossname').textContent=(trackedBoss.isStageBoss?'BOSS · ':'MINIBOSS · ')+trackedBoss.name+(trackedBoss.finalPhase?' · BAR '+trackedBoss.finalPhase+'/3'+(trackedBoss.phaseInvuln>0?' · IMMUNE':''):'');
  } else $('bossbar').style.display='none';
  if (altar && !(boss&&boss.alive) && !gameOver && !won){
    const dx=altar.x-player.x, dz=altar.z-player.z, d=Math.hypot(dx,dz);
    if (altar.state==='idle') $('altar').textContent = d<3 ? '⛧ [F] เรียกบอส' : `⛧ แท่นบอส ${Math.round(d)}m ${arrowTo(dx,dz)}`;
    else $('altar').textContent = d<2.6 ? '◯ เข้าวาป!' : `◯ วาป ${Math.round(d)}m ${arrowTo(dx,dz)}`;
    $('altar').style.display='block';
  } else $('altar').style.display='none';
  let ip='';
  if (started && !paused && !gameOver && !won){
    const gi = nearestGroundItem(player.x, player.z, 2.5);
    if (gi) {
      ip='[F] เก็บ '+gi.item.name+' ('+gi.item.rarity+')';
    } else {
      let best=null, bd=2.8;
      for (const o of interactables){ if(o.used) continue; const d=Math.hypot(player.x-o.x, player.z-o.z); if(d<bd){ bd=d; best=o; } }
      if (best){ if(best.type==='chest') ip='[F] เปิดหีบ ('+chestCost(best.tier)+')';
        else if(best.type==='shrine'){ const sn=['Elite','Blood','Speed','Curse','Gamble']; ip='[F] '+sn[best.tier||0]+' Shrine'; }
        else ip='[F] ร้านค้า'; }
    }
  }
  $('prompt').textContent=ip; $('prompt').style.display=ip?'block':'none';
  $('kills').textContent = `Kills: ${kills}`;
  $('enemies').textContent = `Enemies: ${enemies.length}`;
  $('biome').textContent = (MAP_THEMES[mapStage] && MAP_THEMES[mapStage].name) || BIOME_NAMES[currentTier()];
  $('charname').textContent = (CHARACTERS[player.char]||{}).name || '';
  $('toast').style.display = toastTimer>0 ? 'block' : 'none';
  updateWeaponHUD();
  updateTomeHUD();
  updateObjective();
  if (gameOver || won){ $('over').style.display='flex';
    $('overtitle').textContent = won ? 'VICTORY' : 'YOU DIED';
    $('overtitle').style.color = won ? '#7CE7FF' : '#e85b5b';
    $('overstats').textContent = `${won?'Cleared':'Survived'} ${fmt(gameTime)} · ${kills} kills · Lv ${player.level} · Score: ${score}`;
    renderRunRanking();
  } else $('over').style.display='none';
}

function fmt(seconds){
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}

function clamp(v,a,b){ return v<a?a:v>b?b:v; }

const LEADERBOARD_KEY = 'sc3_leaderboard';
function saveScore(){
  const character = (CHARACTERS[player.char]||{}).name || 'Unknown';
  const entry = { name:cleanPlayerName(playerName), character, score, kills, time: Math.floor(gameTime), won, level:player.level, stage:mapStage, damage:Math.round(damageTaken), items:player.items.length, date: new Date().toISOString() };
  let board = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
  board.push(entry);
  board.sort((a,b) => b.score - a.score);
  const rank = board.indexOf(entry) + 1;
  board = board.slice(0, 8);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board));
  entry.rank = rank;
  entry.personalBest = rank === 1;
  if(typeof saveOnlineScore==='function') saveOnlineScore(entry).then(()=>{ entry.onlineSaved=true; showLeaderboard(); }).catch(err=>console.warn(err.message||err));
  return entry;
}
function loadLeaderboard(){
  return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
}
function renderLeaderboard(board, source){
  const el = document.getElementById('leaderboard');
  if (!el) return;
  if (!board.length) {
    el.innerHTML='<div class="rankpanel empty"><div class="rankhead"><span>Ranking</span><b>No records</b></div><p>Finish a run to carve your name into the covenant.</p></div>';
    return;
  }
  const best=board[0];
  let h = `<div class="rankpanel"><div class="rankhead"><span>${source||'Ranking'}</span><b>${(best.score||0).toLocaleString()} pts</b></div><div class="rankrows">`;
  board.forEach((e,i) => {
    const cls=i<3?' top':'';
    const medal = ['I','II','III'][i] || String(i+1).padStart(2,'0');
    const result=e.won?'CLEAR':'FALL';
    const hero=e.character ? ' | '+e.character : '';
    h += `<div class="rankrow${cls}"><div class="rankno">${medal}</div><div class="rankwho"><b>${escHtml(e.name||'Player')}</b><span>${result}${hero} | ${fmt(e.time||0)} | ${e.kills||0} kills | Lv ${e.level||1}</span></div><div class="rankscore">${(e.score||0).toLocaleString()}</div></div>`;
  });
  h += '</div></div>';
  el.innerHTML = h;
}
function showLeaderboardLegacy(){
  const board = loadLeaderboard();
  const el = document.getElementById('leaderboard');
  if (!el || !board.length) { if(el) el.innerHTML=''; return; }
  let h = '<div style="color:#ffe08a;font-size:13px;margin-bottom:4px">🏆 Hall of Fame</div>';
  board.forEach((e,i) => {
    const medal = ['🥇','🥈','🥉','4','5'][i];
    h += `<div style="margin:2px 0">${medal} ${e.name} — ${e.score.toLocaleString()} pts</div>`;
  });
  el.innerHTML = h;
}
function showLeaderboard(){
  const board = loadLeaderboard();
  renderLeaderboard(board, (typeof onlineLeaderboardReady==='function' && onlineLeaderboardReady()) ? 'Local Ranking' : 'Ranking');
  if(typeof loadOnlineLeaderboard==='function' && typeof onlineLeaderboardReady==='function' && onlineLeaderboardReady()){
    loadOnlineLeaderboard().then(rows=>{ if(rows.length) renderLeaderboard(rows,'Online Ranking'); }).catch(err=>console.warn(err.message||err));
  }
}
function renderRunRanking(){
  let el=document.getElementById('overrank');
  if(!el){
    el=document.createElement('div');
    el.id='overrank';
    const stats=document.getElementById('overstats');
    if(stats && stats.parentNode) stats.parentNode.insertBefore(el, stats.nextSibling);
  }
  if(!el || !lastScoreEntry){ if(el) el.innerHTML=''; return; }
  const e=lastScoreEntry;
  const verdict=e.personalBest?'NEW BEST':'RUN SCORE';
  el.innerHTML=`<div class="runrank"><div><span>${escHtml(e.name)}</span><b>#${e.rank}</b></div><div><span>Score</span><b>${e.score.toLocaleString()}</b></div><div><span>Kills</span><b>${e.kills}</b></div><div><span>Time</span><b>${fmt(e.time)}</b></div><div><span>Damage</span><b>${e.damage}</b></div></div>`;
}
function restart(){
  for (const e of enemies){ scene.remove(e.spr); scene.remove(e.sh); if(e.aura) scene.remove(e.aura); }
  for (const p of projectiles) scene.remove(p.mesh);
  for (const a of afterimages) scene.remove(a.spr); afterimages.length=0;
  for (const sh of enemyShots) scene.remove(sh.mesh); enemyShots.length=0;
  for (const p of particles) scene.remove(p.mesh); particles.length=0;
  for (const r of rings) scene.remove(r.mesh); rings.length=0;
  for (const w of novaWaves) scene.remove(w.mesh); novaWaves.length=0;
  for (const f of slashFx) scene.remove(f.mesh); slashFx.length=0;
  for (const tr of trails) scene.remove(tr.mesh); trails.length=0;
  for (const d of dmgNums) d.el.remove(); dmgNums.length=0; weaponSig=null; tomeSig=null; objSig='';
  { const tw=document.getElementById('tomes'); if(tw) tw.innerHTML=''; }
  for (const pk of pickups) scene.remove(pk.spr);
  for (const gi of groundItems) { if(gi.spr) scene.remove(gi.spr); if(gi.glow) scene.remove(gi.glow); }
  groundItems.length = 0;
  enemies.length=0; projectiles.length=0; pickups.length=0;
  if(player.weapons) for(const w of player.weapons) if(w.orbs) w.orbs.forEach(o=>scene.remove(o.mesh));
  scene.remove(player.spr); scene.remove(player.sh);
  player = makePlayer();
  gameTime=0; stageStartTime=0; kills=0; gameOver=false; won=false; boss=null; mapStage=1; score=0; damageTaken=0; scoreFinalized=false; lastScoreEntry=null; applyMapTheme(); clearStageScenery();
  if(!worldScenery.length){ spawnTrees(40); buildScenery(); }
  waveTimer=0; waveInterval=3.2; enemiesPerWave=2; maxEnemies=18;
  nextHordeAt=240; hordeRemaining=0; hordeSpawnTimer=0; hordeNumber=0; hordeSpawned=0; hordeWarned=false; relocationCursor=0;
  mbTimer=0; nextMinibossAt=180; paused=false; pendingUps=0; userPaused=false;
  chestsOpened=0; shopPurchases=0;
  removeAltar(); makeAltar();
  clearWorldObjects(); makeWorldObjects();
  document.getElementById('pause').style.display='none'; document.getElementById('pausebtn').textContent='⏸';
  document.getElementById('levelup').style.display='none';
  for (let i=0;i<4;i++) spawnEnemy();
}
