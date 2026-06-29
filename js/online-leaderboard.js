const ONLINE_LEADERBOARD = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  table: 'leaderboard',
  limit: 8,
};

function onlineLeaderboardReady(){
  return !!(ONLINE_LEADERBOARD.supabaseUrl && ONLINE_LEADERBOARD.supabaseAnonKey);
}

function onlineHeaders(){
  return {
    apikey: ONLINE_LEADERBOARD.supabaseAnonKey,
    Authorization: 'Bearer '+ONLINE_LEADERBOARD.supabaseAnonKey,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
}

function onlineEndpoint(query){
  const base = ONLINE_LEADERBOARD.supabaseUrl.replace(/\/+$/,'')+'/rest/v1/'+ONLINE_LEADERBOARD.table;
  return base + (query || '');
}

function onlineScorePayload(entry){
  return {
    player_name: entry.name,
    character: entry.character || entry.hero || 'Unknown',
    score: entry.score|0,
    kills: entry.kills|0,
    time: entry.time|0,
    won: !!entry.won,
    level: entry.level|0,
    stage: entry.stage|0,
    damage: entry.damage|0,
    items: entry.items|0,
  };
}

async function saveOnlineScore(entry){
  if(!onlineLeaderboardReady()) return { skipped:true };
  const res = await fetch(onlineEndpoint(), {
    method:'POST',
    headers: onlineHeaders(),
    body: JSON.stringify(onlineScorePayload(entry)),
  });
  if(!res.ok) throw new Error('Online leaderboard save failed: '+res.status);
  return { ok:true };
}

async function loadOnlineLeaderboard(){
  if(!onlineLeaderboardReady()) return [];
  const q = '?select=player_name,character,score,kills,time,won,level,stage,damage,items,created_at&order=score.desc&limit='+ONLINE_LEADERBOARD.limit;
  const res = await fetch(onlineEndpoint(q), { headers: onlineHeaders() });
  if(!res.ok) throw new Error('Online leaderboard load failed: '+res.status);
  const rows = await res.json();
  return rows.map(r=>({
    name: r.player_name || 'Player',
    character: r.character || 'Unknown',
    score: r.score || 0,
    kills: r.kills || 0,
    time: r.time || 0,
    won: !!r.won,
    level: r.level || 1,
    stage: r.stage || 1,
    damage: r.damage || 0,
    items: r.items || 0,
    date: r.created_at,
    online: true,
  }));
}
