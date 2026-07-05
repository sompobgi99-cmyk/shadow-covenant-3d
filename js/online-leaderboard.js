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
async function onlineApiHeaders(){
  const headers = { 'Content-Type':'application/json' };
  if(typeof getAuthAccessToken === 'function'){
    try {
      const token = await getAuthAccessToken();
      if(token) headers.Authorization = 'Bearer '+token;
    } catch (_) {}
  }
  return headers;
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
    score_before_penalty: entry.scoreBeforePenalty|0,
    death_penalty_percent: entry.deathPenaltyPercent|0,
    death_penalty_amount: entry.deathPenaltyAmount|0,
    death_penalty_reason: entry.deathPenaltyReason || '',
    kills: entry.kills|0,
    time: entry.time|0,
    won: !!entry.won,
    level: entry.level|0,
    stage: entry.stage|0,
    damage: entry.damage|0,
    items: entry.items|0,
    difficulty_id: entry.difficultyId || 'normal',
    difficulty_name: entry.difficultyName || 'Normal',
    difficulty_multiplier: Number(entry.difficultyMultiplier || 1),
    pact_ids: Array.isArray(entry.pactIds) ? entry.pactIds : [],
    pact_multiplier: Number(entry.pactMultiplier || 1),
    pact_label: entry.pactLabel || '',
    pact_count: entry.pactCount || (Array.isArray(entry.pactIds) ? entry.pactIds.length : 0),
  };
  if(includeBuild) payload.build = entry.build || window.SHADOW_BUILD_VERSION || '';
  return payload;
}

async function saveOnlineScore(entry){
  if(!onlineLeaderboardReady()) return { skipped:true };
  if(ONLINE_LEADERBOARD.apiEndpoint){
    const apiRes = await fetch(ONLINE_LEADERBOARD.apiEndpoint, {
      method:'POST',
      headers: await onlineApiHeaders(),
      body: JSON.stringify(onlineScorePayload(entry, true)),
    });
    if(apiRes.ok) {
      let data = {};
      try { data = await apiRes.json(); } catch (_) {}
      return { ok:true, verified:!!data.verified, duplicate:!!data.duplicate };
    }
    if(apiRes.status===426 && typeof showToast==='function') showToast('New version available - reload to rank', 3);
    if(apiRes.status===401 && typeof showToast==='function') showToast('Login expired - score saved as local only', 3);
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
        scoreBeforePenalty: r.score_before_penalty || r.score || 0,
        deathPenaltyPercent: r.death_penalty_percent || 0,
        deathPenaltyAmount: r.death_penalty_amount || 0,
        deathPenaltyReason: r.death_penalty_reason || '',
        kills: r.kills || 0,
        time: r.time || 0,
        won: !!r.won,
        level: r.level || 1,
        stage: r.stage || 1,
        damage: r.damage || 0,
        items: r.items || 0,
        difficultyId: r.difficulty_id || 'normal',
        difficultyName: r.difficulty_name || 'Normal',
        difficultyMultiplier: r.difficulty_multiplier || 1,
        pactIds: r.pact_ids || [],
        pactMultiplier: r.pact_multiplier || 1,
        pactLabel: r.pact_label || '',
        pactCount: r.pact_count || ((r.pact_ids || []).length),
        date: r.created_at,
        verified: !!r.verified,
        online: true,
      }));
    }
    if(!ONLINE_LEADERBOARD.supabaseUrl || !ONLINE_LEADERBOARD.supabaseAnonKey) return [];
  }
  const q = '?select=player_name,country_code,character,score,score_before_penalty,death_penalty_percent,death_penalty_amount,death_penalty_reason,kills,time,won,level,stage,damage,items,difficulty_id,difficulty_name,difficulty_multiplier,pact_ids,pact_multiplier,pact_label,pact_count,created_at&order=score.desc&limit='+ONLINE_LEADERBOARD.limit;
  const res = await fetch(onlineEndpoint(q), { headers: onlineHeaders() });
  if(!res.ok) throw new Error('Online leaderboard load failed: '+res.status);
  const rows = await res.json();
  return rows.map(r=>({
    name: r.player_name || 'Player',
    country_code: r.country_code || 'TH',
    character: r.character || 'Unknown',
    score: r.score || 0,
    scoreBeforePenalty: r.score_before_penalty || r.score || 0,
    deathPenaltyPercent: r.death_penalty_percent || 0,
    deathPenaltyAmount: r.death_penalty_amount || 0,
    deathPenaltyReason: r.death_penalty_reason || '',
    kills: r.kills || 0,
    time: r.time || 0,
    won: !!r.won,
    level: r.level || 1,
    stage: r.stage || 1,
    damage: r.damage || 0,
    items: r.items || 0,
    difficultyId: r.difficulty_id || 'normal',
    difficultyName: r.difficulty_name || 'Normal',
    difficultyMultiplier: r.difficulty_multiplier || 1,
    pactIds: r.pact_ids || [],
    pactMultiplier: r.pact_multiplier || 1,
    pactLabel: r.pact_label || '',
    pactCount: r.pact_count || ((r.pact_ids || []).length),
    date: r.created_at,
    verified: !!r.verified,
    online: true,
  }));
}
