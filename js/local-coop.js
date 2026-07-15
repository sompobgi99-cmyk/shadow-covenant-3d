// Local two-player support. P1 uses the normal controls; P2 uses IJKL.
// Kept behind a feature flag until the mode is ready for release.
const LOCAL_COOP_ENABLED=false;
let localCoopRequested=false;
let coopPlayer=null;

function localCoopActive(){ return !!(LOCAL_COOP_ENABLED&&localCoopRequested&&coopPlayer); }
function coopEnemyHpMul(){ return LOCAL_COOP_ENABLED&&localCoopRequested?1.8:1; }
function clearLocalCoop(){
  if(!coopPlayer) return;
  if(coopPlayer.anim&&coopPlayer.anim.grid){
    const current=coopPlayer.spr&&coopPlayer.spr.material&&coopPlayer.spr.material.map;
    for(const st of [coopPlayer.anim.walk,coopPlayer.anim.idle])if(st&&st.map&&st.map!==current)st.map.dispose();
  }
  if(coopPlayer.spr){scene.remove(coopPlayer.spr);freeObj(coopPlayer.spr);}
  if(coopPlayer.sh) removeShadow(coopPlayer.sh);
  if(coopPlayer.hpbar){scene.remove(coopPlayer.hpbar);freeObj(coopPlayer.hpbar);}
  coopPlayer=null;
}
function initLocalCoop(){
  clearLocalCoop();
  if(!LOCAL_COOP_ENABLED||!localCoopRequested||!player||!player.spr) return null;
  const spr=player.spr.clone();
  spr.material=player.spr.material.clone();
  let anim=null;
  if(player.anim&&player.anim.grid){
    const copy=st=>{const map=st.map.clone();map.needsUpdate=true;return {...st,map};};
    anim={grid:true,walk:copy(player.anim.walk),idle:copy(player.anim.idle),dirRows:player.anim.dirRows.slice()};
    spr.material.map=anim.idle.map;
  }else if(spr.material.map){spr.material.map=spr.material.map.clone();spr.material.map.needsUpdate=true;}
  spr.material.color.setHex(0x9fe8ff); spr.center.set(0.5,0);
  const sh=makeShadow(0.68),hpbar=makePlayerHealthBar();scene.add(spr);scene.add(sh);
  coopPlayer={x:1.8,z:0,hp:player.maxHp,maxHp:player.maxHp,def:Math.max(3,player.def),spd:player.spd,
    gold:0,alive:true,down:false,reviveT:0,invuln:1,fireT:0.25,dir:0,face:1,moving:false,spr,sh,hpbar,bw:spr.scale.x,bh:spr.scale.y,born:gameTime,flash:0,tint:0x9fe8ff,anim};
  return coopPlayer;
}
function coopEnemyTarget(e){
  if(!localCoopActive()||!coopPlayer.alive||coopPlayer.down) return player;
  if(player.coopDown) return coopPlayer;
  const p1=(player.x-e.x)*(player.x-e.x)+(player.z-e.z)*(player.z-e.z);
  const p2=(coopPlayer.x-e.x)*(coopPlayer.x-e.x)+(coopPlayer.z-e.z)*(coopPlayer.z-e.z);
  return p2<p1?coopPlayer:player;
}
function hurtCoopPlayer(amt,dx,dz,force,src,kind){
  const p=coopPlayer;if(!p||!p.alive||p.down||p.invuln>0) return;
  const r=Math.max(1,Math.round(amt*100/(100+p.def*4)));
  p.hp-=r;p.invuln=0.42;
  spawnDmg(p.x,p.z,r,0x68dfff,false,'playerhit');
  if(p.hp<=0){
    p.hp=0;p.down=true;p.reviveT=0;
    showToast('P2 DOWN - stand nearby for 3 seconds',2.8);
    spawnObjectPulse(p.x,p.z,0x57cfff,4.8,0.55);
    if(player.coopDown){p.alive=false;player.alive=false;recordDeathCause();}
  }
}
function downMainPlayerForCoop(){
  if(!localCoopActive()||!coopPlayer.alive||coopPlayer.down) return false;
  player.hp=0;player.coopDown=true;player.coopReviveT=0;player.invuln=999;
  showToast('P1 DOWN - P2 must stand nearby for 3 seconds',2.8);
  spawnObjectPulse(player.x,player.z,0xff6f91,4.8,0.55);
  return true;
}
function reviveCoopTarget(target,label){
  target.down=false;target.coopDown=false;target.reviveT=0;target.coopReviveT=0;
  target.hp=Math.max(1,Math.round(target.maxHp*0.40));target.invuln=2;
  spawnObjectPulse(target.x,target.z,0x8fffd0,5.2,0.65);spawnBurst(target.x,target.z,0x8fffd0,22,0.9);
  showToast(label+' REVIVED',2.2);
}
function updateLocalCoop(dt){
  const p=coopPlayer;if(!localCoopActive()||!p) return;
  if(p.invuln>0)p.invuln-=dt;
  let mx=0,mz=0;if(keys.KeyI)mz-=1;if(keys.KeyK)mz+=1;if(keys.KeyJ)mx-=1;if(keys.KeyL)mx+=1;
  p.moving=!!(mx||mz)&&!p.down;
  if(p.moving){
    const len=Math.hypot(mx,mz)||1;mx/=len;mz/=len;p.dir=dirIndex(-mx,mz);p.face=mx<0?-1:mx>0?1:p.face;
    const nx=clamp(p.x+mx*p.spd*dt,-MAP_BOUND,MAP_BOUND),nz=clamp(p.z+mz*p.spd*dt,-MAP_BOUND,MAP_BOUND);
    if(!blocked(nx,p.z))p.x=nx;if(!blocked(p.x,nz))p.z=nz;
  }
  if(!p.down){
    p.fireT-=dt;
    if(p.fireT<=0){
      p.fireT=Math.max(0.28,0.78/(player.rateMul||1));
      const hit=nearestEnemies(p.x,p.z,12,1)[0],e=hit&&(hit.e||hit);
      if(e&&e.alive){
        const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz)||1;
        const ox=player.x,oz=player.z,os=player.projScale;
        player.x=p.x;player.z=p.z;player.projScale=0.72;
        spawnProjectile(dx/d,dz/d,{dmg:Math.round((8+player.level*1.25)*(player.dmgMul||1)),speed:14,life:1.0,pierce:1,color:0x8fe8ff,shape:'shard',sourceKey:'coop_support'});
        player.x=ox;player.z=oz;player.projScale=os;
      }
    }
    for(const pk of pickups){
      if(!pk.alive||pk.type!=='gold'||Math.hypot(pk.x-p.x,pk.z-p.z)>0.85)continue;
      pk.alive=false;p.gold+=Math.round(pk.value*(player.goldMul||1));
    }
  }
  const near=Math.hypot(player.x-p.x,player.z-p.z)<2.2;
  if(p.down&&near&&!player.coopDown){p.reviveT+=dt;if(p.reviveT>=3)reviveCoopTarget(p,'P2');}else if(p.down)p.reviveT=0;
  if(player.coopDown&&near&&!p.down){player.coopReviveT=(player.coopReviveT||0)+dt;if(player.coopReviveT>=3)reviveCoopTarget(player,'P1');}else if(player.coopDown)player.coopReviveT=0;
  const y=groundHeight(p.x,p.z);
  if(typeof animSprite==='function')animSprite(p,p.x,y,p.z,p.flash,0xff7777,p.moving);else p.spr.position.set(p.x,y,p.z);
  p.sh.position.set(p.x,y+0.02,p.z);
  p.spr.material.opacity=p.down?0.35:1;
  p.hpbar.visible=p.down||p.hp<p.maxHp;p.hpbar.position.set(p.x,y+p.bh+0.26,p.z);
  const fill=p.hpbar.userData.fill;fill.scale.x=1.18*Math.max(0,p.hp/p.maxHp);fill.material.color.setHex(p.down?0x777777:0x68dfff);
}
