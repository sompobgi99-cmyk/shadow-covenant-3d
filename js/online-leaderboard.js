const ONLINE_LEADERBOARD = {
  apiEndpoint: '/api/leaderboard',
  supabaseUrl: '',
  supabaseAnonKey: '',
  table: 'leaderboard',
  limit: 8,
};

function onlineLeaderboardReady(){
  return !!ONLINE_LEADERBOARD.apiEndpoint || !!(ONLINE_LEADERBOARD.supabaseUrl && ONLINE_LEADERBOARD.supabaseAnonKey);
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

function onlineScorePayload(entry, includeBuild){
  const payload = {
    player_name: entry.name,
    country_code: entry.country_code || entry.country || 'TH',
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
  if(includeBuild) payload.build = entry.build || window.SHADOW_BUILD_VERSION || '';
  return payload;
}

async function saveOnlineScore(entry){
  if(!onlineLeaderboardReady()) return { skipped:true };
  if(ONLINE_LEADERBOARD.apiEndpoint){
    const apiRes = await fetch(ONLINE_LEADERBOARD.apiEndpoint, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(onlineScorePayload(entry, true)),
    });
    if(apiRes.ok) return { ok:true };
    if(apiRes.status===426 && typeof showToast==='function') showToast('New version available - reload to rank', 3);
    if(!ONLINE_LEADERBOARD.supabaseUrl || !ONLINE_LEADERBOARD.supabaseAnonKey) throw new Error('Online leaderboard save failed: '+apiRes.status);
  }
  const res = await fetch(onlineEndpoint(), {
    method:'POST',
    headers: onlineHeaders(),
    body: JSON.stringify(onlineScorePayload(entry, false)),
  });
  if(!res.ok) throw new Error('Online leaderboard save failed: '+res.status);
  return { ok:true };
}

async function loadOnlineLeaderboard(){
  if(!onlineLeaderboardReady()) return [];
  if(ONLINE_LEADERBOARD.apiEndpoint){
    const apiRes = await fetch(ONLINE_LEADERBOARD.apiEndpoint+'?limit='+encodeURIComponent(ONLINE_LEADERBOARD.limit));
    if(apiRes.ok){
      const data = await apiRes.json();
      return (data.rows || []).map(r=>({
        name: r.player_name || 'Player',
        country_code: r.country_code || 'TH',
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
    if(!ONLINE_LEADERBOARD.supabaseUrl || !ONLINE_LEADERBOARD.supabaseAnonKey) return [];
  }
  const q = '?select=player_name,country_code,character,score,kills,time,won,level,stage,damage,items,created_at&order=score.desc&limit='+ONLINE_LEADERBOARD.limit;
  const res = await fetch(onlineEndpoint(q), { headers: onlineHeaders() });
  if(!res.ok) throw new Error('Online leaderboard load failed: '+res.status);
  const rows = await res.json();
  return rows.map(r=>({
    name: r.player_name || 'Player',
    country_code: r.country_code || 'TH',
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
