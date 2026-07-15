(function(){
  const ONLINE_PROGRESS = {
    apiEndpoint: '/api/player-progress',
    debounceMs: 900,
  };
  const SOUL_MUTATION_QUEUE_KEY = 'sc3_soul_coin_mutations_v1';
  const SOUL_MUTATION_KEY_PREFIX = 'sc3_soul_coin_mutation_v2_';
  const state = {
    loaded: false,
    syncing: false,
    lastError: '',
    lastSyncAt: '',
    pendingReason: '',
    timer: 0,
    inFlightMutationId: '',
    dirty: false,
  };

  function mutationId(){
    try { if(crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID(); } catch (_) {}
    return 'm-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
  }

  function readMutationQueue(){
    try {
      const legacy=JSON.parse(localStorage.getItem(SOUL_MUTATION_QUEUE_KEY)||'[]');
      if(Array.isArray(legacy)) for(const entry of legacy){
        const id=String(entry&&entry.id||'').replace(/[^\w.-]/g,'').slice(0,80);
        const delta=Math.trunc(Number(entry&&entry.soulCoinDelta||0));
        if(id&&Number.isFinite(delta)&&delta!==0) localStorage.setItem(SOUL_MUTATION_KEY_PREFIX+id,JSON.stringify({id,soulCoinDelta:delta,createdAt:Date.now()}));
      }
      localStorage.removeItem(SOUL_MUTATION_QUEUE_KEY);
      const queue=[];
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        if(!key||!key.startsWith(SOUL_MUTATION_KEY_PREFIX)) continue;
        let entry=null;
        try { entry=JSON.parse(localStorage.getItem(key)||'null'); }
        catch (_) { localStorage.removeItem(key); i--; continue; }
        const id=String(entry&&entry.id||'').replace(/[^\w.-]/g,'').slice(0,80);
        const soulCoinDelta=Math.trunc(Number(entry&&entry.soulCoinDelta||0));
        const createdAt=Math.max(0,Math.trunc(Number(entry&&entry.createdAt||0)));
        if(id&&Number.isFinite(soulCoinDelta)&&soulCoinDelta!==0) queue.push({id,soulCoinDelta,createdAt});
      }
      return queue.sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id)).slice(0,200);
    } catch (_) { return []; }
  }

  function pendingSoulCoinDelta(){
    return readMutationQueue().reduce((sum,entry)=>sum+entry.soulCoinDelta,0);
  }

  function recordSoulCoinMutation(delta){
    delta=Math.trunc(Number(delta||0));
    if(!Number.isFinite(delta)||delta===0) return;
    const id=mutationId();
    try { localStorage.setItem(SOUL_MUTATION_KEY_PREFIX+id,JSON.stringify({id,soulCoinDelta:delta,createdAt:Date.now()})); } catch (_) {}
    state.dirty = true;
  }

  function acknowledgeSoulCoinMutation(id){
    try { localStorage.removeItem(SOUL_MUTATION_KEY_PREFIX+id); } catch (_) {}
  }

  function withProjectedCoins(progress){
    const projected={...(progress||{})};
    const remote=Math.max(0,Math.floor(Number(projected.soulCoins||0)));
    projected.soulCoins=Math.max(0,remote+pendingSoulCoinDelta());
    projected.forceSoulCoinBalance=true;
    return projected;
  }

  async function progressHeaders(){
    const headers = { 'Content-Type':'application/json' };
    if(typeof getAuthAccessToken === 'function'){
      try {
        const token = await getAuthAccessToken();
        if(token) headers.Authorization = 'Bearer '+token;
      } catch (_) {}
    }
    return headers;
  }

  function localPayload(){
    if(typeof exportPlayerProgress === 'function') return exportPlayerProgress();
    if(typeof exportAchievementProgress === 'function') return exportAchievementProgress();
    try {
      const raw = localStorage.getItem('sc3_achievements_v1');
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        done: parsed && parsed.done ? parsed.done : {},
        soulCoins: Math.max(0, parseInt(localStorage.getItem('sc3_soul_coins_v1')||'0', 10) || 0),
        pets: JSON.parse(localStorage.getItem('sc3_pets_v1') || '{"owned":{},"selected":""}'),
        divineOfferings: JSON.parse(localStorage.getItem('sc3_divine_offerings_owned_v1') || '{"owned":{}}'),
        challengeRewards: JSON.parse(localStorage.getItem('sc3_challenge_rewards_v1') || '{}'),
        mailbox: JSON.parse(localStorage.getItem('sc3_mailbox_v1') || '{"read":{},"claimed":{},"deleted":{}}'),
      };
    } catch (_) {
      return { done:{}, soulCoins:0, pets:{ owned:{}, selected:'' } };
    }
  }

  function applyRemote(progress, opts){
    progress = progress || {};
    if(typeof importPlayerProgress === 'function') {
      const result = importPlayerProgress(progress, { silent:true, ...(opts||{}) }) || {};
      return result.imported || [];
    }
    if(typeof importAchievementProgress === 'function') return importAchievementProgress(progress.done||{}, { silent:true });
    try {
      const current = localPayload();
      const merged = { done:{ ...(current.done||{}) } };
      for(const [id, at] of Object.entries(progress.done||{})) if(!merged.done[id]) merged.done[id] = at;
      localStorage.setItem('sc3_achievements_v1', JSON.stringify(merged));
      return [];
    } catch (_) {
      return [];
    }
  }

  async function syncOnlineAchievements(reason){
    if(state.syncing) {
      state.pendingReason = reason || state.pendingReason || 'queued';
      return { skipped:'busy' };
    }
    if(typeof currentAuthUser !== 'function' || !currentAuthUser()) return { skipped:'guest' };
    state.syncing = true;
    state.lastError = '';
    const queuedMutation=readMutationQueue()[0]||null;
    const requestMutation=queuedMutation||{id:mutationId(),soulCoinDelta:0};
    state.inFlightMutationId=requestMutation.id;
    try {
      const headers = await progressHeaders();
      if(!headers.Authorization) return { skipped:'no-token' };
      const remoteRes = await fetch(ONLINE_PROGRESS.apiEndpoint, { headers, cache:'no-store' });
      if(remoteRes.status === 404) return { skipped:'not-configured' };
      if(remoteRes.status === 401) throw new Error('Login expired');
      if(!remoteRes.ok) throw new Error('Progress load failed: '+remoteRes.status);
      const remote = await remoteRes.json();
      // Keep this device's current selection until its full state has been merged.
      // Ownership still imports immediately; the authoritative selection is applied after POST.
      const localBeforeMerge = localPayload();
      const keepLocalPetSelection = !!(localBeforeMerge.pets && localBeforeMerge.pets.selected);
      const imported = applyRemote(withProjectedCoins(remote), { authoritativeCoins:true, skipPetSelection:keepLocalPetSelection });
      const payload = localPayload();
      payload.mutation={ id:requestMutation.id, soulCoinDelta:requestMutation.soulCoinDelta };
      const saveRes = await fetch(ONLINE_PROGRESS.apiEndpoint, {
        method:'POST',
        headers,
        keepalive:true,
        body: JSON.stringify(payload),
      });
      if(!saveRes.ok) throw new Error('Progress save failed: '+saveRes.status);
      const saved = await saveRes.json();
      if(queuedMutation) acknowledgeSoulCoinMutation(requestMutation.id);
      applyRemote(withProjectedCoins(saved), { authoritativeCoins:true, skipPetSelection:false });
      state.loaded = true;
      state.dirty = readMutationQueue().length > 0;
      state.lastSyncAt = new Date().toISOString();
      if(imported && imported.length && typeof showToast === 'function') showToast('Cloud unlocks synced: '+imported.length, 2.4);
      if(typeof onAchievementProgressSynced === 'function') onAchievementProgressSynced(reason || 'sync');
      return { ok:true, imported: imported || [] };
    } catch (err) {
      state.lastError = (err && err.message) || 'Progress sync failed';
      if(reason === 'manual' && typeof showToast === 'function') showToast(state.lastError, 2.5);
      return { error: state.lastError };
    } finally {
      state.syncing = false;
      state.inFlightMutationId='';
      if(state.pendingReason) {
        const pending = state.pendingReason;
        state.pendingReason = '';
        queueOnlineAchievementSync(pending);
      } else if(readMutationQueue().length) {
        queueOnlineAchievementSync('coin_queue');
      }
    }
  }

  function queueOnlineAchievementSync(reason){
    state.dirty = true;
    clearTimeout(state.timer);
    state.timer = setTimeout(()=>syncOnlineAchievements(reason || 'queued'), ONLINE_PROGRESS.debounceMs);
  }

  function syncCriticalPlayerProgress(reason){
    state.dirty = true;
    clearTimeout(state.timer);
    state.timer = 0;
    return syncOnlineAchievements(reason || 'critical');
  }

  function progressSyncStatus(){
    if(typeof currentAuthUser !== 'function' || !currentAuthUser()) return 'Guest: บันทึกในเครื่องนี้';
    if(state.syncing) return 'Google: กำลัง sync unlock...';
    if(state.lastError) return 'Google: sync มีปัญหา ('+state.lastError+')';
    if(state.loaded) return 'Google: sync unlock แล้ว';
    return 'Google: รอ sync unlock';
  }

  window.onlineProgressState = state;
  window.syncOnlineAchievements = syncOnlineAchievements;
  window.syncCriticalPlayerProgress = syncCriticalPlayerProgress;
  window.queueOnlineAchievementSync = queueOnlineAchievementSync;
  window.progressSyncStatus = progressSyncStatus;
  window.recordSoulCoinMutation = recordSoulCoinMutation;
  window.pendingSoulCoinDelta = pendingSoulCoinDelta;

  window.addEventListener('pagehide',()=>{
    if((state.dirty || readMutationQueue().length) && typeof currentAuthUser==='function' && currentAuthUser()) {
      syncOnlineAchievements('pagehide');
    }
  });
})();
