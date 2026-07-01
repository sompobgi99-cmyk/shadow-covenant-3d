// ---------- loop ----------
let frameN=0;
function frame() {
  frameN++;
  const dt = Math.min(clock.getDelta(), 0.05);
  if (started && !gameOver && !won && !paused && !userPaused) update(dt);
  syncMeshes();
  updateCamera(dt);
  if (composer){ try { composer.render(); } catch(e){ composer=null; renderer.render(scene, camera); } } else renderer.render(scene, camera);
  updateHUD(dt);
}

function update(dt) {
  gameTime += dt; player.runTime = gameTime;
  updateAltar(dt);
  if (globalPickupMagnet>0) globalPickupMagnet=Math.max(0, globalPickupMagnet-dt);

  if (player.dashCd > 0) player.dashCd -= dt;

  // shrine buffs
  if (player.speedBoostTimer > 0) { player.speedBoostTimer -= dt; if (player.speedBoostTimer <= 0) player.speedBoost = 0; }

  // input -> screen-aligned movement (W = away/-Z), equal speed all dirs
  let mx=0, mz=0;
  if (keys['KeyW']||keys['ArrowUp']) mz-=1;
  if (keys['KeyS']||keys['ArrowDown']) mz+=1;
  if (keys['KeyA']||keys['ArrowLeft']) mx-=1;
  if (keys['KeyD']||keys['ArrowRight']) mx+=1;
  if (window.touchMove && window.touchMove.active){ mx=window.touchMove.x; mz=window.touchMove.z; }   // mobile joystick
  player.moving = !!(mx||mz);
  if (player.moving){
    const l = Math.hypot(mx, mz); mx/=l; mz/=l;  // normalize (diagonals not faster)
    player.dir = dirIndex(-mx, mz);              // flip X so left/right match the sheet
    player.ldx = mx; player.ldz = mz;            // remember heading for dash
    if (mx) player.face = mx < 0 ? -1 : 1;
  }
  // movement (dash overrides normal speed), per-axis collision slide
  let moveX, moveZ;
  if (player.dashTime > 0){ player.dashTime -= dt; moveX = player.dashX*DASH_SPEED; moveZ = player.dashZ*DASH_SPEED;
    player.trailT -= dt; if (player.trailT <= 0){ spawnAfterimage(); player.trailT = 0.02; } }
  else if (player.moving){ const spd=player.spd*(1+(player.speedBoost||0)); moveX = mx*spd; moveZ = mz*spd; }
  if (moveX !== undefined){
    const nx = clamp(player.x + moveX*dt, -MAP_BOUND, MAP_BOUND);
    const nz = clamp(player.z + moveZ*dt, -MAP_BOUND, MAP_BOUND);
    if (!blocked(nx, player.z)) player.x = nx;
    if (!blocked(player.x, nz)) player.z = nz;
  }
  if (player.knockX || player.knockZ){
    const nx=clamp(player.x+player.knockX*dt,-MAP_BOUND,MAP_BOUND);
    const nz=clamp(player.z+player.knockZ*dt,-MAP_BOUND,MAP_BOUND);
    if(!blocked(nx,player.z)) player.x=nx; else player.knockX=0;
    if(!blocked(player.x,nz)) player.z=nz; else player.knockZ=0;
    const decay=Math.pow(0.012,dt);
    player.knockX*=decay; player.knockZ*=decay;
    if(Math.abs(player.knockX)<0.08) player.knockX=0;
    if(Math.abs(player.knockZ)<0.08) player.knockZ=0;
  }
  if (player.invuln>0) player.invuln-=dt;
  if (player.flash>0) player.flash-=dt;
  if (player.regen) player.hp = Math.min(healCap(player), player.hp + player.regen*dt);

  // standing-still item effects (Idle Juice tracked via stillT, Campfire heal)
  if (player.moving) player.stillT = 0; else player.stillT = (player.stillT||0) + dt;
  if (player._campfire && !player.moving) player.hp = Math.min(healCap(player), player.hp + 2*player._campfire*dt);
  // Energy Core: pulsing damage aura
  if (player._energyCore){
    player._energyTick = (player._energyTick||0) - dt;
    if (player._energyTick <= 0){ player._energyTick = 0.5;
      const r = 2.4 + 0.3*player._energyCore, dmg = 6*player._energyCore*(player.dmgMul||1);
      spawnRing(player.x, player.z, 0x66ddff, r*1.4, 0.3);
      forEachNearbyEnemy(player.x, player.z, r+1, e=>{ if(!e.alive) return;
        const dx=e.x-player.x, dz=e.z-player.z;
        if (dx*dx+dz*dz < (r+e.r)*(r+e.r)) dealEnemyDamage(e, dmg, 0x66ddff, dx, dz, 0, true); });
    }
  }

  rebuildEnemyGrid();

  // weapons — each on its own cooldown / orbit
  for (const w of player.weapons) updateWeapon(w, dt);

  // enemies chase
  const speedMul=enemySpeedMul();
  for (const e of enemies) {
    if (!e.alive) continue;
    // Dragonfire burn DoT + Ice Crystal slow
    if (e.burnT>0){
      e.burnT-=dt;
      const burnDamage=(e.final&&e.phaseInvuln>0)?0:e.burnDps*dt;
      const floor=(e.final&&e.finalPhase&&(e.finalPhase>1||e.phaseInvuln>0))?1:-Infinity;
      e.hp=Math.max(floor,e.hp-burnDamage);
      e.flash=Math.max(e.flash,0.04);
      if(e.hp<=0){ killEnemy(e); continue; }
    }
    if (e.slowT>0) e.slowT-=dt;
    const dx=player.x-e.x, dz=player.z-e.z, d=Math.hypot(dx,dz)||1;
    const nx=dx/d, nz=dz/d;
    let spd = e.spd;
    if (e.behavior==='charger'){
      e.chargeCd -= dt;
      if (e.charging>0){ e.charging-=dt; spd = e.spd*2.5; }
      else if (e.chargeCd<=0 && d<15 && d>5){ e.charging=0.5; const ja=(Math.random()-0.5)*0.5, jc=Math.cos(ja), js=Math.sin(ja); e.cdx=nx*jc-nz*js; e.cdz=nx*js+nz*jc; e.chargeCd=2.8+Math.random()*1.6; }
    } else if (e.behavior==='shooter'){
      e.atkCd -= dt;
      if (d < 10) spd = -e.spd*0.6;        // kite away when too close
      else if (d < 15) spd = e.spd*0.1;    // hold range
      if (e.atkCd<=0 && d<16){ spawnEnemyShot(e.x, e.z, nx, nz, e.atk); e.atkCd=1.8+Math.random()*0.8; }
    }
    if (e.behavior!=='charger' && e.charging>0){ e.charging-=dt; spd=e.spd*2.4; }
    if (e.shieldT>0) e.shieldT-=dt;
    if (e.final) updateFinalBossPhase(e, dt);
    if (e.skills && e.hp<e.maxHp*0.5) spd*=1.25;
    const sp = spd*speedMul*dt*(e.slowT>0?0.5:1);
    let dirx=nx, dirz=nz;
    if (e.charging>0 && e.cdx!==undefined){ dirx=e.cdx; dirz=e.cdz; }   // charge straight, no homing
    const mvx=dirx*sp, mvz=dirz*sp;
    if(e.isBoss){
      e.x=clamp(e.x+mvx,-MAP_BOUND,MAP_BOUND);
      e.z=clamp(e.z+mvz,-MAP_BOUND,MAP_BOUND);
      e.stuckT=0;
    } else {
      moveEnemyAroundObstacles(e,mvx,mvz,dt);
    }
    // knockback
    if (e.kx||e.kz){ const knx=e.x+e.kx*dt, knz=e.z+e.kz*dt;
      if(e.isBoss || !blocked(knx,e.z)) e.x=knx;
      if(e.isBoss || !blocked(e.x,knz)) e.z=knz;
      const dec=Math.pow(0.0001,dt); e.kx*=dec; e.kz*=dec;
      if(Math.abs(e.kx)<0.05)e.kx=0; if(Math.abs(e.kz)<0.05)e.kz=0; }
    e.x=clamp(e.x,-MAP_BOUND,MAP_BOUND); e.z=clamp(e.z,-MAP_BOUND,MAP_BOUND);
    { const pdx=e.x-player.x, pdz=e.z-player.z, pd=Math.hypot(pdx,pdz)||1, minD=e.r+0.55;
      if (pd<minD){ e.x+=pdx/pd*(minD-pd); e.z+=pdz/pd*(minD-pd); } }   // don't sit on top of player
    e.face = dx < 0 ? -1 : 1; e.dir = dirIndex(-nx, nz);
    if (e.cd>0) e.cd-=dt;
    if (e.relocateCd>0) e.relocateCd-=dt;
    if (e.flash>0) e.flash-=dt;
    if (e.skills) runSkills(e, dt, nx, nz, d);
    if (d < e.r+0.75 && e.cd<=0){
      hurtPlayer(e.atk,nx,nz,e.isBoss?13:e.elite?11:8.5,e);
      e.cd=e.isBoss?1.15:1.35;
      e.kx-=nx*1.2; e.kz-=nz*1.2;
    }
  }
  updateEnemyRelocation();
  // Spatial buckets keep separation near O(n) instead of comparing every pair.
  // One rebuild before the passes is enough — positions shift only slightly within them.
  rebuildEnemyGrid();
  for(let pass=0;pass<2;pass++){
    for (let i=0;i<enemies.length;i++){ const a=enemies[i]; if(!a.alive) continue;
      forEachNearbyEnemy(a.x,a.z,4,b=>{
        const j=b.gridIndex;
        if(j<=i) return;
        let ddx=b.x-a.x, ddz=b.z-a.z, dd=ddx*ddx+ddz*ddz, mr=(a.r+b.r)*0.92;
        if(dd<1e-4){ const ang=((i*37+j*71)%360)*Math.PI/180; ddx=Math.cos(ang)*0.02; ddz=Math.sin(ang)*0.02; dd=0.0004; }
        if(dd<mr*mr){ const di=Math.sqrt(dd), push=(mr-di)*0.52, ux=ddx/di, uz=ddz/di;
          const aw=b.isBoss?0.75:1, bw=a.isBoss?0.75:1, total=aw+bw;
          a.x-=ux*push*aw/total; a.z-=uz*push*aw/total;
          b.x+=ux*push*bw/total; b.z+=uz*push*bw/total; }
      });
    }
  }
  rebuildEnemyGrid();

  // projectiles
  for (const p of projectiles) {
    if (!p.alive) continue;
    p.x += p.dx*p.speed*dt; p.z += p.dz*p.speed*dt; p.life-=dt;
    if(p.spin && p.mesh.material) p.mesh.material.rotation+=p.spin*dt;
    if (!p.noTrail && frameN&1) spawnTrail(p.x, p.z, p.color||0xffffff, (p.scale||1)*0.9);
    if (p.life<=0){ p.alive=false; continue; }
    if (blocked(p.x, p.z)){ p.alive=false; continue; }   // hit scenery -> stop
    const hitRange=3+(p.hitRadius||0.4)*(p.scale||1);
    forEachNearbyEnemy(p.x,p.z,hitRange,e=>{
      if (!e.alive || p.hit.has(e)) return;
      const dx=p.x-e.x, dz=p.z-e.z;
      const radius=e.r+(p.hitRadius||0.4)*(p.scale||1);
      if (dx*dx+dz*dz < radius*radius) {
        p.hit.add(e);
        dealEnemyDamage(e, p.dmg, p.color, p.dx, p.dz, 4.5);
        if (p.hit.size > p.pierce){ p.alive=false; return false; }
      }
    });
  }

  // pickups (magnet + collect)
  for (const pk of pickups) {
    if (!pk.alive) continue;
    const dx=player.x-pk.x, dz=player.z-pk.z, rawDistance=Math.hypot(dx,dz);
    if (rawDistance < PICKUP_COLLECT){ collect(pk); continue; }
    const d=rawDistance||1;
    const forcedMagnet = pk.globalMagnet || (globalPickupMagnet>0 && (pk.type==='xp' || pk.type==='gold'));
    if (forcedMagnet || pk.homing || d < player.magnet){ pk.homing=true;
      const sp = forcedMagnet ? 34 : 8 + (1-Math.min(1,d/player.magnet))*10;
      pk.x += (dx/d)*sp*dt; pk.z += (dz/d)*sp*dt;
    } else { pk.x += pk.vx*dt; pk.z += pk.vz*dt; pk.vx*=0.9; pk.vz*=0.9; }
  }

  // Item drops are collected automatically within the player's magnet range.
  for(let i=groundItems.length-1;i>=0;i--){
    const gi=groundItems[i];
    if(gi.collected){ groundItems.splice(i,1); continue; }
    const dx=player.x-gi.x, dz=player.z-gi.z, rawDistance=Math.hypot(dx,dz);
    if(rawDistance<0.8){
      pickupItem(gi);
      groundItems.splice(i,1);
      continue;
    }
    const d=rawDistance||1;
    if(gi.homing || d<player.magnet){
      gi.homing=true;
      const speed=7+(1-Math.min(1,d/player.magnet))*9;
      gi.x+=(dx/d)*speed*dt;
      gi.z+=(dz/d)*speed*dt;
    }
  }

  // cull dead
  for (const sh of enemyShots){ if(!sh.alive) continue;
    sh.x+=sh.dx*sh.speed*dt; sh.z+=sh.dz*sh.speed*dt; sh.life-=dt;
    if (frameN%6===0) spawnTrail(sh.x, sh.z, 0xff5066, 0.7);
    if (sh.life<=0 || blocked(sh.x,sh.z)){ sh.alive=false; continue; }
    if ((sh.x-player.x)*(sh.x-player.x)+(sh.z-player.z)*(sh.z-player.z) < 0.55*0.55){ hurtPlayer(sh.dmg,sh.dx,sh.dz,6.5); sh.alive=false; spawnBurst(sh.x,sh.z,0xff5066,4,0.6); } }
  for (let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.life-=dt;
    if (p.life<=0){ scene.remove(p.mesh); freeObj(p.mesh); particles.splice(i,1); continue; }
    p.vy-=12*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; if(p.y<0.1){ p.y=0.1; p.vy*=-0.3; }
    p.mesh.position.set(p.x, groundHeight(p.x,p.z)+p.y, p.z); p.mesh.material.opacity=p.life/p.max; }
  for (let i=trails.length-1;i>=0;i--){ const tr=trails[i]; tr.life-=dt;
    if (tr.life<=0){ scene.remove(tr.mesh); freeObj(tr.mesh); trails.splice(i,1); continue; }
    const o=tr.life/tr.max;
    if (tr.core) tr.core.material.opacity=0.52*o;
    if (tr.glow) tr.glow.material.opacity=0.16*o;
    tr.mesh.scale.multiplyScalar(1+dt*1.8); }
  for (let i=rings.length-1;i>=0;i--){ const r=rings[i]; r.life-=dt;
    if (r.life<=0){ scene.remove(r.mesh); freeObj(r.mesh); rings.splice(i,1); continue; }
    const t=1-r.life/r.max, rad=0.5+(r.maxR-0.5)*t;
    r.mesh.scale.set(rad,rad,rad); r.mesh.material.opacity=0.85*(1-t); }
  for (let i=bossAoEs.length-1;i>=0;i--){ const a=bossAoEs[i]; a.t+=dt;
    const p=Math.min(1,a.t/a.delay);
    const pulse=0.86+Math.sin(gameTime*18)*0.08;
    const rad=a.radius*(0.38+0.62*p)*pulse;
    a.mesh.scale.set(rad,rad,rad);
    a.mesh.position.y=groundHeight(a.x,a.z)+0.16;
    a.mesh.material.opacity=0.18+0.42*p;
    if(a.core){
      a.core.scale.set(a.radius*(0.18+0.82*p),a.radius*(0.18+0.82*p),a.radius*(0.18+0.82*p));
      a.core.position.y=groundHeight(a.x,a.z)+0.18;
      a.core.material.opacity=0.10+0.26*p;
    }
    if(a.t<a.delay) continue;
    const dx=player.x-a.x, dz=player.z-a.z, dist=Math.hypot(dx,dz);
    if(dist<a.radius+0.45) hurtPlayer(a.damage,dx/(dist||1),dz/(dist||1),a.knock||12,a.src);
    spawnBossImpactFx(a.x,a.z,a.radius,a.color,a.impact);
    spawnRing(a.x,a.z,a.color,a.radius*1.65,0.36);
    spawnObjectPulse(a.x,a.z,a.color,a.radius*1.45,0.42);
    spawnBurst(a.x,a.z,a.color,Math.min(34,10+Math.round(a.radius*4)),1.1);
    shake(0.24+Math.min(0.25,a.radius*0.035),0.18);
    scene.remove(a.mesh); freeObj(a.mesh);
    if(a.core){ scene.remove(a.core); freeObj(a.core); }
    bossAoEs.splice(i,1);
  }
  for (let i=bossImpactFx.length-1;i>=0;i--){ const f=bossImpactFx[i]; f.t+=dt;
    const p=Math.min(1,f.t/f.life);
    const frame=Math.min(f.frames-1,Math.floor(p*f.frames));
    if(f.map) f.map.offset.x=frame/f.frames;
    const grow=1+p*0.24;
    f.mesh.scale.set(f.radius*grow,f.radius*grow,f.radius*grow);
    f.mesh.position.y=groundHeight(f.x,f.z)+0.2;
    f.mesh.material.opacity=(1-p)*0.92;
    if(f.t<f.life) continue;
    scene.remove(f.mesh); freeObj(f.mesh);
    bossImpactFx.splice(i,1);
  }
  for (let i=novaWaves.length-1;i>=0;i--){ const w=novaWaves[i];
    w.r += (w.speed||16)*dt; w.mesh.scale.set(w.r,w.r,w.r);
    const no=Math.max(0,1-w.r/w.maxR);
    if (w.ring) w.ring.material.opacity=0.9*no;
    if (w.wash) w.wash.material.opacity=0.16*no;
    forEachNearbyEnemy(w.x,w.z,w.r+1,e=>{ if(!e.alive||w.hit.has(e)) return;
      const dd=Math.hypot(e.x-w.x, e.z-w.z);
      if (Math.abs(dd-w.r) < e.r+0.6){ w.hit.add(e); dealEnemyDamage(e, w.dmg, w.color, e.x-w.x, e.z-w.z, 4); } });
    if (w.r>=w.maxR){ scene.remove(w.mesh); freeObj(w.mesh); novaWaves.splice(i,1); } }
  for (let i=slashFx.length-1;i>=0;i--){ const f=slashFx[i]; f.life-=dt;
    if (f.life<=0){ scene.remove(f.mesh); freeObj(f.mesh); slashFx.splice(i,1); continue; }
    if (f.sweep) f.mesh.rotation.y += f.sweep*dt;
    if (f.spin && f.mesh.material) f.mesh.material.rotation += f.spin*dt;
    if (f.grow && f.baseScale) {
      const t=1-f.life/f.max, s=1+f.grow*t;
      f.mesh.scale.set(f.baseScale.x*s, f.baseScale.y*s, f.baseScale.z*s);
    }
    if (f.mesh.material) f.mesh.material.opacity=(f.sweep?0.85:(f.fade||0.72))*(f.life/f.max);
    else if (f.mesh.children) for (const ch of f.mesh.children) if(ch.material) ch.material.opacity=(f.fade||0.72)*(f.life/f.max); }
  cull(enemies); cull(projectiles); cull(pickups); cull(enemyShots);
  for (let i=afterimages.length-1;i>=0;i--){ const a=afterimages[i]; a.life-=dt;
    if (a.life<=0){ scene.remove(a.spr); freeObj(a.spr); afterimages.splice(i,1); }
    else a.spr.material.opacity = 0.55*(a.life/a.max); }

  const profile=progressionProfile();
  maxEnemies=Math.min(320,profile.cap+(hordeRemaining>0?45:0));
  waveInterval=profile.interval;
  enemiesPerWave=profile.batch;

  // Normal pressure rises gradually; horde waves temporarily take over spawning.
  waveTimer += dt;
  if (hordeRemaining<=0 && waveTimer >= waveInterval) { waveTimer -= waveInterval;
    const n = Math.min(enemiesPerWave, maxEnemies-enemies.length);
    let rem=n; while(rem>0){ const c=Math.min(7, rem); spawnCluster(c); rem-=c; }
  }

  if(!hordeWarned && gameTime>=nextHordeAt-5 && gameTime<nextHordeAt){
    hordeWarned=true;
    showToast('HORDE INCOMING - 5',2.2);
  }
  if(gameTime>=nextHordeAt && hordeRemaining<=0){
    hordeNumber++;
    hordeRemaining=hordeSize(hordeNumber);
    hordeSpawned=0;
    hordeSpawnTimer=0;
    hordeWarned=false;
    nextHordeAt+=240;
    showToast('HORDE '+hordeNumber+' - SURVIVE!',3);
    shake(0.4,0.24);
  }
  if(hordeRemaining>0){
    hordeSpawnTimer-=dt;
    if(hordeSpawnTimer<=0 && enemies.length<maxEnemies){
      const count=Math.min(3,hordeRemaining,maxEnemies-enemies.length);
      if(count>0){
        spawnCluster(count);
        hordeRemaining-=count;
        hordeSpawned+=count;
        if(hordeNumber>=2 && hordeSpawned%12<count){
          const point=pointAroundPlayer(22,27,false);
          if(point) spawnElite(point.x,point.z);
        }
      }
      hordeSpawnTimer=0.42;
    }
  }
  mbTimer += dt;
  if(gameTime>=nextMinibossAt){
    spawnMiniboss();
    mbTimer=0;
    nextMinibossAt+=MINIBOSS_INTERVAL;
  }

  // enter portal -> win
  if (altar && altar.state==='portal' && Math.hypot(player.x-altar.x, player.z-altar.z) < 2.6) {
    if(altar.portalKind==='nextStage') transitionToStage(altar.nextStage || mapStage+1);
    else { won = true; finalizeScore(); sfx('win'); }
  }

  if (!player.alive) { gameOver = true; finalizeScore(); }
  if (toastTimer>0) toastTimer-=dt;
}
function finalizeScore(){
  if (scoreFinalized) return;
  scoreFinalized = true;
  score += Math.floor(gameTime);
  if (won && gameTime < 480) score = Math.round(score * 1.5);
  if (damageTaken <= 0) score = Math.round(score * 2);
  if (kills >= 500) score += 1000;
  if (player.items.length >= 10) score += 500;
  lastScoreEntry = saveScore();
}

function updateEnemyRelocation(){
  const count=enemies.length;
  if(!count) return;
  const checks=Math.min(5,count);
  for(let n=0;n<checks;n++){
    relocationCursor%=count;
    const e=enemies[relocationCursor++];
    if(!e||!e.alive||e.relocateCd>0||e.charging>0||e.castT>0) continue;
    const dx=e.x-player.x, dz=e.z-player.z;
    const limit=e.isBoss?52:42;
    if(dx*dx+dz*dz>limit*limit){
      relocateEnemyNearPlayer(e);
      break;
    }
  }
}

function nearestEnemies(x,z,range,count){
  const a=[];
  const rangeSq=range*range;
  forEachNearbyEnemy(x,z,range,e=>{
    const dx=e.x-x, dz=e.z-z, dSq=dx*dx+dz*dz;
    if(dSq<=rangeSq) a.push({e,d:Math.sqrt(dSq),x:e.x,z:e.z});
  });
  a.sort((p,q)=>p.d-q.d); return a.slice(0,count);
}
