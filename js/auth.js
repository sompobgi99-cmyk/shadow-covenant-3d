(function(){
  const state = {
    ready: false,
    enabled: false,
    client: null,
    session: null,
    user: null,
    error: '',
  };

  function tt(key, fallback){
    return (typeof window.tr === 'function') ? window.tr(key) : fallback;
  }

  function html(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
  }

  function authConfigFromWindow(){
    const cfg = window.SUPABASE_CONFIG || {};
    const url = String(cfg.url || cfg.supabaseUrl || '').trim();
    const anonKey = String(cfg.anonKey || cfg.supabaseAnonKey || '').trim();
    return { enabled: !!(url && anonKey), url, anonKey };
  }

  async function loadAuthConfig(){
    const inline = authConfigFromWindow();
    if (inline.enabled) return inline;
    try {
      const res = await fetch('/api/auth-config', { cache:'no-store' });
      if (!res.ok) return { enabled:false, url:'', anonKey:'' };
      const cfg = await res.json();
      const url = String(cfg.url || '').trim();
      const anonKey = String(cfg.anonKey || '').trim();
      return { enabled: !!(cfg.enabled && url && anonKey), url, anonKey };
    } catch (_) {
      return { enabled:false, url:'', anonKey:'' };
    }
  }

  function displayName(user){
    if (!user) return 'Player';
    const meta = user.user_metadata || {};
    return meta.full_name || meta.name || meta.preferred_username || (user.email ? user.email.split('@')[0] : 'Player');
  }

  function setSession(session){
    state.session = session || null;
    state.user = (session && session.user) || null;
  }

  // OAuth can notify the app before the session token is immediately usable.
  // Retry progress loading after the callback settles so a new device does not
  // remain on its empty local save when the first request races the callback.
  function scheduleProgressSync(reason){
    if(!state.user || typeof syncOnlineAchievements !== 'function') return;
    [120, 900, 2500].forEach(delay=>setTimeout(()=>{
      if(state.user) syncOnlineAchievements(reason || 'auth_retry');
    }, delay));
  }

  function renderAuth(){
    const root = document.getElementById('authbar');
    if (!root) return;
    const status = document.getElementById('authstatus');
    const login = document.getElementById('loginbtn');
    const logout = document.getElementById('logoutbtn');
    const titleRoot = document.getElementById('titleauthbar');
    const titleStatus = document.getElementById('titleauthstatus');
    const titleLogin = document.getElementById('titleloginbtn');
    const titleLogout = document.getElementById('titlelogoutbtn');
    const googleChoice = document.getElementById('googlechoice');
    const googleInput = document.getElementById('startmode_google');
    const googleName = googleChoice && googleChoice.querySelector('.mode-name');
    const googleDesc = googleChoice && googleChoice.querySelector('.mode-desc');
    const setGoogleDisabled = (disabled) => {
      if (googleInput) googleInput.disabled = !!disabled;
      if (googleChoice && 'disabled' in googleChoice) googleChoice.disabled = !!disabled;
    };
    root.style.display = state.user ? 'flex' : 'none';
    const titleMode = (typeof getSelectedStartMode === 'function') ? getSelectedStartMode() : '';
    if (titleRoot) titleRoot.style.display = (state.user || (titleMode === 'guest' && state.enabled)) ? 'flex' : 'none';
    root.classList.toggle('signed', !!state.user);
    root.classList.toggle('disabled', !state.enabled);
    if (state.user) {
      const name = displayName(state.user);
      status.innerHTML = '<b>Verified</b> ' + html(name);
      if (titleStatus) titleStatus.innerHTML = '<b>' + html(tt('auth.verified','Verified')) + '</b> ' + html(name);
      if (titleLogin) titleLogin.style.display = 'none';
      if (googleChoice) {
        setGoogleDisabled(false);
        googleChoice.classList.add('signed');
        googleChoice.classList.remove('disabled');
        if (googleName) googleName.textContent = tt('start.verifiedBtn','Start as Verified');
        if (googleDesc) googleDesc.textContent = 'Verified: ' + name;
      }
      if (login) login.style.display = 'none';
      if (logout) logout.style.display = 'inline-flex';
      if (titleLogout) titleLogout.style.display = 'inline-flex';
    } else if (state.enabled) {
      status.innerHTML = '<b>Guest</b> ' + html((window.gameLang && window.gameLang()==='en') ? 'Login for verified ranking' : 'Login เพื่อ Ranking แบบ verified');
      if (titleStatus) titleStatus.innerHTML = '<b>Guest</b> ' + html(tt('auth.guestDevice','Saved on this device'));
      if (titleLogin) titleLogin.textContent = tt('auth.loginUpgrade','Switch to Google');
      if (titleLogin) titleLogin.style.display = titleMode === 'guest' ? 'inline-flex' : 'none';
      if (titleLogout) titleLogout.style.display = 'none';
      if (googleChoice) {
        setGoogleDisabled(false);
        googleChoice.classList.remove('signed');
        googleChoice.classList.remove('disabled');
        if (googleName) googleName.textContent = tt('auth.google','Sign in with Google');
        if (googleDesc) googleDesc.textContent = tt('auth.googleDesc','Save Ranking and Unlocks online');
      }
      if (login) login.style.display = googleChoice ? 'none' : 'inline-flex';
      if (logout) logout.style.display = 'none';
    } else {
      status.innerHTML = '<b>Guest</b> ' + html((window.gameLang && window.gameLang()==='en') ? 'Login setup not connected' : 'ยังไม่ได้เชื่อม Login');
      if (titleStatus) titleStatus.innerHTML = '<b>Guest</b> ' + html((window.gameLang && window.gameLang()==='en') ? 'Google is not ready' : 'Google ยังไม่พร้อม');
      if (titleLogin) titleLogin.style.display = 'none';
      if (titleLogout) titleLogout.style.display = 'none';
      if (googleChoice) {
        setGoogleDisabled(true);
        googleChoice.classList.remove('signed');
        googleChoice.classList.add('disabled');
        if (googleName) googleName.textContent = 'Google Login';
        if (googleDesc) googleDesc.textContent = (window.gameLang && window.gameLang()==='en') ? 'Not ready yet; Guest is available' : 'ยังไม่พร้อม ใช้ Guest ได้ก่อน';
      }
      if (login) login.style.display = 'none';
      if (logout) logout.style.display = 'none';
    }
    if (login) login.onclick = gameAuthLogin;
    if (logout) logout.onclick = gameAuthLogout;
    if (titleLogin) titleLogin.onclick = () => {
      if (typeof chooseGoogleStart === 'function') chooseGoogleStart();
      else gameAuthLogin();
    };
    if (titleLogout) titleLogout.onclick = gameAuthLogout;
    if (typeof updateStartFlow === 'function') updateStartFlow();
  }

  async function initGameAuth(){
    const cfg = await loadAuthConfig();
    const lib = window.supabase;
    if (!cfg.enabled || !lib || typeof lib.createClient !== 'function') {
      state.enabled = false;
      state.ready = true;
      state.error = cfg.enabled ? 'Supabase SDK is unavailable' : '';
      renderAuth();
      return state;
    }
    state.enabled = true;
    state.client = lib.createClient(cfg.url.replace(/\/+$/,''), cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
    state.client.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      renderAuth();
      if (state.user && typeof finishPendingAuthChoice === 'function') finishPendingAuthChoice();
      if (state.user && typeof applyRememberedLogin === 'function') applyRememberedLogin();
      scheduleProgressSync('auth');
      if (state.user && typeof flushPendingOnlineScores === 'function') setTimeout(() => flushPendingOnlineScores(), 250);
      if (typeof showLeaderboard === 'function') showLeaderboard();
    });
    try {
      const { data } = await state.client.auth.getSession();
      setSession(data && data.session);
    } catch (err) {
      state.error = (err && err.message) || 'Auth session failed';
    }
    state.ready = true;
    renderAuth();
    if (state.user && typeof finishPendingAuthChoice === 'function') finishPendingAuthChoice();
    if (state.user && typeof applyRememberedLogin === 'function') applyRememberedLogin();
    scheduleProgressSync('init');
    if (state.user && typeof flushPendingOnlineScores === 'function') setTimeout(() => flushPendingOnlineScores(), 250);
    return state;
  }

  async function gameAuthLogin(){
    if (!state.client) {
      if (typeof showToast === 'function') showToast('Login is not configured yet', 2.5);
      return;
    }
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await state.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error && typeof showToast === 'function') showToast(error.message || 'Login failed', 3);
  }

  async function gameAuthLogout(){
    if (!state.client) return;
    await state.client.auth.signOut();
    setSession(null);
    renderAuth();
    if (typeof resetStartChoiceAfterLogout === 'function') resetStartChoiceAfterLogout();
    if (typeof showLeaderboard === 'function') showLeaderboard();
  }

  async function getAuthAccessToken(){
    if (!state.client) return '';
    try {
      const { data } = await state.client.auth.getSession();
      setSession(data && data.session);
      renderAuth();
      return (state.session && state.session.access_token) || '';
    } catch (_) {
      return '';
    }
  }

  function currentAuthUser(){
    return state.user ? {
      id: state.user.id,
      name: displayName(state.user),
      email: state.user.email || '',
    } : null;
  }

  // Synchronous cached token for pagehide fast-path: no await allowed there,
  // so read the in-memory session directly (may be slightly stale — acceptable,
  // an expired token just means the keepalive POST 401s and the queued mutation
  // re-syncs on next launch).
  function getCachedAuthAccessToken(){
    return (state.session && state.session.access_token) || '';
  }

  window.gameAuthState = state;
  window.initGameAuth = initGameAuth;
  window.gameAuthLogin = gameAuthLogin;
  window.gameAuthLogout = gameAuthLogout;
  window.renderAuth = renderAuth;
  window.getAuthAccessToken = getAuthAccessToken;
  window.getCachedAuthAccessToken = getCachedAuthAccessToken;
  window.currentAuthUser = currentAuthUser;
})();
