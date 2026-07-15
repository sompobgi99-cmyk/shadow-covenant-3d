// Deterministic challenge rules. Daily remains archived for a possible future return.
const CHALLENGE_NATIVE_RANDOM=Math.random;
const CHALLENGE_REWARD_KEY='sc3_challenge_rewards_v1';
let activeChallengeMode='standard';
let activeChallengeSeed=0;
let activeChallengeRules=[];
let challengeRandomActive=false;

const WEEKLY_ARENA={stage:4,minibossAt:240,duoAt:480,overtimeAt:600,bossAt:720};

const CHALLENGE_RULES=[
  {id:'armored',name:'Iron Host',desc:'Enemy HP +15%',hp:1.15},
  {id:'furious',name:'Red Tempo',desc:'Enemy ATK and speed +10%',atk:1.10,speed:1.10},
  {id:'swarm',name:'Crowded Grave',desc:'Enemy waves +15%',spawn:1.15},
  {id:'glass',name:'Glass Oath',desc:'Player max HP -10%',playerHp:0.90},
  {id:'famine',name:'Dry Chalice',desc:'Healing -20%',heal:0.80},
  {id:'bounty',name:'Gilded Peril',desc:'XP and gold +35%, enemy ATK +5%',reward:1.35,atk:1.05},
  {id:'elite',name:'Noble Hunt',desc:'Elite chance rises',elite:0.035}
];
function challengeHash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function challengePrng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function dailyChallengeKey(date){const d=date||new Date();return d.toISOString().slice(0,10);}
function weeklyChallengeKey(date){const d=date||new Date(),u=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));u.setUTCDate(u.getUTCDate()+4-(u.getUTCDay()||7));const y=new Date(Date.UTC(u.getUTCFullYear(),0,1));const w=Math.ceil((((u-y)/86400000)+1)/7);return u.getUTCFullYear()+'-W'+String(w).padStart(2,'0');}
function challengeKey(mode){return mode==='weekly'?weeklyChallengeKey():dailyChallengeKey();}
function challengeConfig(mode){
  mode=mode==='weekly'?'weekly':'standard';
  if(mode==='standard')return {mode,key:'',seed:0,rules:[],scoreMul:1,reward:0};
  const key=challengeKey(mode),seed=challengeHash('shadow-covenant:'+mode+':'+key),rand=challengePrng(seed),pool=CHALLENGE_RULES.slice(),rules=[];
  const count=mode==='weekly'?3:2;
  while(rules.length<count&&pool.length)rules.push(pool.splice(Math.floor(rand()*pool.length),1)[0]);
  return {mode,key,seed,rules,scoreMul:mode==='weekly'?1.30:1.15,reward:mode==='weekly'?300:60};
}
function setActiveChallengeMode(mode){
  const cfg=challengeConfig(mode);activeChallengeMode=cfg.mode;activeChallengeSeed=cfg.seed;activeChallengeRules=cfg.rules.slice();return cfg;
}
function weeklyArenaActive(){return activeChallengeMode==='weekly';}
function weeklyBossType(){
  const pool=(typeof BOSS_TYPES!=='undefined'?BOSS_TYPES:[]).filter(b=>!b.final);
  return pool.length?pool[activeChallengeSeed%pool.length]:null;
}
function challengeHas(id){return activeChallengeRules.some(r=>r.id===id);}
function challengeRuleMul(field){return activeChallengeRules.reduce((v,r)=>v*Number(r[field]||1),1);}
function challengeEnemyHpMul(){return challengeRuleMul('hp');}
function challengeEnemyAtkMul(){return challengeRuleMul('atk');}
function challengeEnemySpeedMul(){return challengeRuleMul('speed');}
function challengeHealMul(){return challengeRuleMul('heal');}
function challengeRewardMul(){return challengeRuleMul('reward');}
function challengeSpawnMul(){return challengeRuleMul('spawn');}
function challengeEliteBonus(){return activeChallengeRules.reduce((v,r)=>v+Number(r.elite||0),0);}
function challengeScoreMul(){return challengeConfig(activeChallengeMode).scoreMul;}
function applyChallengeToPlayer(p){
  const hp=challengeRuleMul('playerHp');
  if(hp!==1){p.maxHp=Math.max(1,Math.round(p.maxHp*hp));p.hp=Math.min(p.hp,p.maxHp);}
  const reward=challengeRewardMul();if(reward!==1){p.xpMul*=reward;p.goldMul*=reward;}
}
function startChallengeRandom(){
  if(activeChallengeMode==='standard'){stopChallengeRandom();return;}
  const rand=challengePrng(activeChallengeSeed);Math.random=rand;challengeRandomActive=true;
}
function stopChallengeRandom(){if(challengeRandomActive)Math.random=CHALLENGE_NATIVE_RANDOM;challengeRandomActive=false;}
function challengeRunMode(){return activeChallengeMode==='weekly'?'weekly':'standard';}
function challengeSummary(){const cfg=challengeConfig(activeChallengeMode);return cfg.mode==='standard'?'Standard':cfg.mode.toUpperCase()+' '+cfg.key+' · '+cfg.rules.map(r=>r.name).join(' + ');}
function loadChallengeRewardState(){try{const state=JSON.parse(localStorage.getItem(CHALLENGE_REWARD_KEY)||'{}');return state&&typeof state==='object'?state:{};}catch(_){return {};}}
function saveChallengeRewardState(state){try{localStorage.setItem(CHALLENGE_REWARD_KEY,JSON.stringify(state||{}));}catch(_){}}
function exportChallengeRewardProgress(){return {...loadChallengeRewardState()};}
function importChallengeRewardProgress(remote){
  if(!remote||typeof remote!=='object')return false;
  const local=loadChallengeRewardState();let changed=false;
  for(const [id,at] of Object.entries(remote)){
    if(!/^(daily:\d{4}-\d{2}-\d{2}|weekly:\d{4}-W\d{2})$/.test(id))continue;
    const parsed=Date.parse(at);if(!Number.isFinite(parsed))continue;
    if(!local[id]||parsed<Date.parse(local[id])){local[id]=new Date(parsed).toISOString();changed=true;}
  }
  if(changed)saveChallengeRewardState(local);return changed;
}
function challengeRewardClaimed(mode,key){return !!loadChallengeRewardState()[mode+':'+key];}
function awardChallengeReward(){
  const cfg=challengeConfig(activeChallengeMode);if(cfg.mode==='standard'||!won||challengeRewardClaimed(cfg.mode,cfg.key))return 0;
  const state=loadChallengeRewardState();state[cfg.mode+':'+cfg.key]=new Date().toISOString();saveChallengeRewardState(state);
  if(typeof addSoulCoins==='function')addSoulCoins(cfg.reward,'challenge_'+cfg.mode,{immediateSync:true});
  showToast(cfg.mode.toUpperCase()+' COMPLETE · +'+cfg.reward+' Soul Coins',3);return cfg.reward;
}
