(function(){
  const ONLINE_PROGRESS = {
    apiEndpoint: '/api/player-progress',
    debounceMs: 900,
  };
  const state = {
    loaded: false,
    syncing: false,
    lastError: '',
    lastSyncAt: '',
    timer: 0,
  };

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
    if(typeof exportAchievementProgress === 'function') return exportAchievementProgress();
    try {
      const raw = localStorage.getItem('sc3_achievements_v1');
      const parsed = raw ? JSON.parse(raw) : {};
      return { done: parsed && parsed.done ? parsed.done : {} };
    } catch (_) {
      return { done:{} };
    }
  }

  function applyRemote(done){
    if(typeof importAchievementProgress === 'function') return importAchievementProgress(done||{}, { silent:true });
    try {
      const current = localPayload();
      const merged = { done:{ ...(current.done||{}) } };
      for(const [id, at] of Object.entries(done||{})) if(!merged.done[id]) merged.done[id] = at;
      localStorage.setItem('sc3_achievements_v1', JSON.stringify(merged));
      return [];
    } catch (_) {
      return [];
    }
  }

  async function syncOnlineAchievements(reason){
    if(state.syncing) return { skipped:'busy' };
    if(typeof currentAuthUser !== 'function' || !currentAuthUser()) return { skipped:'guest' };
    state.syncing = true;
    state.lastError = '';
    try {
      const headers = await progressHeaders();
      if(!headers.Authorization) return { skipped:'no-token' };
      const remoteRes = await fetch(ONLINE_PROGRESS.apiEndpoint, { headers, cache:'no-store' });
      if(remoteRes.status === 404) return { skipped:'not-configured' };
      if(remoteRes.status === 401) throw new Error('Login expired');
      if(!remoteRes.ok) throw new Error('Progress load failed: '+remoteRes.status);
      const remote = await remoteRes.json();
      const imported = applyRemote(remote.done || {});
      const payload = localPayload();
      const saveRes = await fetch(ONLINE_PROGRESS.apiEndpoint, {
        method:'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if(!saveRes.ok) throw new Error('Progress save failed: '+saveRes.status);
      const saved = await saveRes.json();
      applyRemote(saved.done || {});
      state.loaded = true;
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
    }
  }

  function queueOnlineAchievementSync(reason){
    clearTimeout(state.timer);
    state.timer = setTimeout(()=>syncOnlineAchievements(reason || 'queued'), ONLINE_PROGRESS.debounceMs);
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
  window.queueOnlineAchievementSync = queueOnlineAchievementSync;
  window.progressSyncStatus = progressSyncStatus;
})();
