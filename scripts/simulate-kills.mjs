// Sanity-check the server's dynamic kills envelope for long Overtime runs.
// This intentionally uses the same progression constants as leaderboard.mts.
function plausibleKillsCap({time, stage=3, difficulty_id='hard', run_mode='standard', pact_ids=[]}){
  const seconds=Math.max(0,Math.floor(time||0));
  const minutes=Math.max(1,Math.ceil(seconds/60));
  const legacyPace=run_mode==='weekly'?1200:difficulty_id==='hard'?1100:900;
  const legacyCap=1000+minutes*legacyPace+Math.max(0,minutes-10)*500+stage*400+(run_mode==='weekly'?2500:0);
  const segments=[[0,60,3.4,2],[60,120,3,3],[120,240,2.6,4],[240,360,2.1,5],[360,480,1.7,6],[480,600,1.35,8]];
  let expected=0;
  for(const [start,end,interval,batch] of segments) expected+=Math.max(0,Math.min(seconds,end)-start)/interval*batch;
  const ravenous=pact_ids.includes('ravenous_horde');
  const otSeconds=Math.max(0,seconds-600), step=run_mode==='weekly'?60:45;
  for(let cursor=0;cursor<otSeconds;){
    const tier=2+Math.floor(cursor/step), span=Math.min(step,otSeconds-cursor);
    const batch=Math.min(96,10*tier), interval=Math.max(.25,1.1/tier);
    expected+=span/interval*batch*(ravenous?1.22:1);
    cursor+=span;
  }
  expected+=stage*400+(run_mode==='weekly'?2500:0);
  return Math.ceil(Math.max(legacyCap,expected*(ravenous?1.65:1.5)));
}

const cases=[
  {label:'Hard 10m',time:600,pact_ids:[]},
  {label:'Hard 20m + all Pact',time:1200,pact_ids:['blood_moon','glass_soul','cursed_economy','no_mercy','ravenous_horde']},
  {label:'Hard 30m + all Pact',time:1800,pact_ids:['blood_moon','glass_soul','cursed_economy','no_mercy','ravenous_horde']},
  {label:'Hard 60m + all Pact',time:3600,pact_ids:['blood_moon','glass_soul','cursed_economy','no_mercy','ravenous_horde']},
];
for(const item of cases){
  const cap=plausibleKillsCap(item);
  console.log(`${item.label}: cap=${cap.toLocaleString()} · 200k=${cap>=200000?'accepted':'rejected'}`);
}
