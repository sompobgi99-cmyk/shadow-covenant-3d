import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, stat } from "node:fs/promises";

const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const freePort=()=>new Promise((resolve,reject)=>{const s=createServer();s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});s.on("error",reject);});
async function waitForServer(url){for(let i=0;i<48;i++){try{if((await fetch(url+"/version.json")).ok)return;}catch(_){}await wait(250);}throw new Error("dev server did not start");}

const {chromium}=await import("playwright-core");
const port=await freePort();
const baseUrl=`http://127.0.0.1:${port}`;
const runId=String(process.pid);
const server=spawn(process.execPath,["scripts/dev-server.mjs",String(port)],{stdio:["ignore","ignore","pipe"],windowsHide:true});
const serverErrors=[];server.stderr.on("data",chunk=>serverErrors.push(chunk.toString()));
let browser;
try{
  await waitForServer(baseUrl);
  await mkdir("outputs/weekly",{recursive:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"});
  for(const profile of [{name:"desktop",width:1440,height:900},{name:"mobile",width:844,height:390}]){
    const page=await browser.newPage({viewport:{width:profile.width,height:profile.height},isMobile:profile.name==="mobile",hasTouch:profile.name==="mobile"});
    const errors=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
    await page.addInitScript(()=>{localStorage.setItem("sc3_start_mode_v1","guest");localStorage.setItem("sc3_player_name_v1","Weekly Tester");localStorage.setItem("sc3_howto_seen_v1","1");});
    await page.goto(baseUrl,{waitUntil:"networkidle"});
    await page.waitForSelector("#title",{state:"visible",timeout:15000});
    const initial=await page.evaluate(async()=>{
      setActiveDifficulty("hard");setActivePacts([]);setActiveChallengeMode("weekly");
      await prefetchTextureKeys(characterTextureKeys(currentChar).concat(stageTextureKeys(4)));
      started=true;document.getElementById("title").style.display="none";restart();
      const envTypes=stageProps.filter(p=>p.env).map(p=>p.env.visualType).sort();
      return {stage:mapStage,theme:MAP_THEMES[mapStage].name,props:stageProps.length,objects:interactables.length,objectTypes:interactables.map(o=>o.type).sort(),breakables:breakables.length,envTypes,altar:[altar.x,altar.z],tiers:[...new Set(enemyPool().map(e=>e.tier))],pacts:activePactIds.length,textures:[!!tex.weekly_ground,!!tex.weekly_border_wall,!!tex.obj_weekly_obelisk,!!tex.obj_weekly_gate,!!tex.weekly_brazier,!!tex.weekly_void_rift,!!tex.weekly_power_conduit,!!tex.weekly_explosive_barrel,!!tex.weekly_healing_spring]};
    });
    if(initial.stage!==4||initial.theme!=="Covenant Crucible"||initial.props!==32||initial.objects!==8||initial.objectTypes.join(',')!=="chest,chest,chest,chest,chest,magnet_pillar,shrine,shrine"||initial.breakables!==4||initial.envTypes.join(',')!=="weekly_conduit,weekly_conduit,weekly_spring,weekly_void_rift,weekly_void_rift,weekly_void_rift"||initial.altar[0]!==0||initial.altar[1]!==-8||initial.tiers.join(',')!=="0"||initial.pacts!==0||initial.textures.some(v=>!v))throw new Error(`${profile.name} weekly setup failed: ${JSON.stringify(initial)}`);
    await wait(350);
    const shot=`outputs/weekly/weekly-${profile.name}-${runId}.png`;await page.screenshot({path:shot});
    if((await stat(shot)).size<12000)throw new Error(`${profile.name} screenshot is unexpectedly small`);
    if(profile.name==="desktop"){
      const environment=await page.evaluate(()=>{
        const conduit=stageProps.find(p=>p.env&&p.env.visualType==='weekly_conduit').env;
        player.x=0;player.z=0;updateEnvironmentalInteractions(0.016);const baseRate=wstats('bolt',1).rate;
        player.x=conduit.x;player.z=conduit.z;updateEnvironmentalInteractions(0.016);const conduitRate=wstats('bolt',1).rate;
        const spring=stageProps.find(p=>p.env&&p.env.visualType==='weekly_spring').env;
        player.hp=Math.max(1,player.maxHp-30);const hpBefore=player.hp,poolBefore=spring.healPool;
        player.x=spring.x;player.z=spring.z;updateEnvironmentalInteractions(1);
        const rift=stageProps.find(p=>p.env&&p.env.visualType==='weekly_void_rift').env;
        const target=enemies.find(e=>e.alive&&!e.isBoss);target.x=rift.x+2;target.z=rift.z;target.kx=0;target.kz=0;
        player.x=0;player.z=0;updateEnvironmentalInteractions(0.25);
        const first=breakables[0],second=breakables.find(b=>b!==first&&Math.hypot(b.x-first.x,b.z-first.z)<5.4);
        breakBreakable(first,0xff6b32);
        return {baseRate,conduitRate,hpBefore,hpAfter:player.hp,poolBefore,poolAfter:spring.healPool,enemyPull:target.kx,chainFuse:second&&second.chainFuse};
      });
      if(!(environment.conduitRate>environment.baseRate*1.3)||!(environment.hpAfter>environment.hpBefore)||!(environment.poolAfter<environment.poolBefore)||!(environment.enemyPull<0)||!(environment.chainFuse>0))throw new Error(`weekly environment failed: ${JSON.stringify(environment)}`);
      const milestones=await page.evaluate(async()=>{
        gameTime=240;updateWeeklyArena();const at4=enemies.filter(e=>e.alive&&e.isMiniboss).length;
        gameTime=480;updateWeeklyArena();const at8=enemies.filter(e=>e.alive&&e.isMiniboss).length;
        gameTime=600;const ot=overtimeTier();
        gameTime=720;updateWeeklyArena();const telegraphState=altar&&altar.state;
        await new Promise(resolve=>setTimeout(resolve,SPECIAL_SPAWN_DELAY_MS+100));
        const weeklyBoss=!!(boss&&boss.alive&&boss.weeklyBoss),bossOt=overtimeTier(),combatOt=otCombatPowerMul(),bossResist=boss&&boss.damageTakenMul;
        const bossName=boss&&boss.name;killEnemy(boss);
        return {at4,at8,ot,telegraphState,bossOt,combatOt,bossResist,weeklyBoss,bossName,portal:altar.portalKind,gate:altar.sprIcon&&altar.sprIcon.material.map===tex.obj_weekly_gate,endless:interactables.some(o=>o.type==="endless_door")};
      });
      if(milestones.at4!==1||milestones.at8!==3||milestones.ot!==2||milestones.telegraphState!=="summoning"||milestones.bossOt!==4||milestones.combatOt!==4||milestones.bossResist!==1||!milestones.weeklyBoss||milestones.portal!=="weeklyVictory"||!milestones.gate||milestones.endless)throw new Error(`weekly milestones failed: ${JSON.stringify(milestones)}`);
      await wait(200);await page.screenshot({path:`outputs/weekly/weekly-final-gate-${runId}.png`});
    }
    const viewport=await page.evaluate(()=>({w:innerWidth,h:innerHeight,canvas:[renderer.domElement.clientWidth,renderer.domElement.clientHeight],bodyOverflow:document.documentElement.scrollWidth>innerWidth+2}));
    if(viewport.canvas[0]<profile.width*0.9||viewport.canvas[1]<profile.height*0.8||viewport.bodyOverflow)throw new Error(`${profile.name} viewport failed: ${JSON.stringify(viewport)}`);
    if(errors.length)throw new Error(`${profile.name} console errors:\n${errors.join("\n")}`);
    await page.close();
  }
  console.log(`Weekly playtest passed on ${baseUrl}. Screenshots: outputs/weekly/`);
}finally{
  if(browser)await browser.close();server.kill();if(serverErrors.join("").trim())process.stderr.write(serverErrors.join(""));
}
