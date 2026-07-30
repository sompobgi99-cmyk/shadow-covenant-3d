(function(){
  let state={runId:'',token:'',issuedAt:0,expiresAt:0,status:'idle'};

  function makeRunId(){
    try{
      if(crypto&&typeof crypto.randomUUID==='function') return 'run_'+crypto.randomUUID();
    }catch(_){}
    return 'run_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12);
  }
  function snapshot(){
    return {...state};
  }
  async function start(config){
    const runId=makeRunId();
    state={runId,token:'',issuedAt:Date.now(),expiresAt:0,status:'requesting'};
    const clientId=typeof rankingClientId==='function'?rankingClientId():'';
    const payload={
      run_id:runId,
      client_id:clientId,
      difficulty_id:String(config&&config.difficultyId||'normal'),
      run_mode:String(config&&config.runMode||'standard'),
      challenge_key:String(config&&config.challengeKey||''),
      build:String(window.SHADOW_BUILD_VERSION||'')
    };
    try{
      const headers={'Content-Type':'application/json'};
      if(typeof getAuthAccessToken==='function'){
        const token=await getAuthAccessToken().catch(()=>null);
        if(token) headers.Authorization='Bearer '+token;
      }
      const res=await fetch('/api/run-session',{method:'POST',headers,body:JSON.stringify(payload)});
      if(!res.ok) throw new Error('Run session failed: '+res.status);
      const data=await res.json();
      if(state.runId!==runId) return snapshot();
      state={runId,token:String(data.token||''),issuedAt:Number(data.issued_at||Date.now()),expiresAt:Number(data.expires_at||0),status:data.token?'ready':'legacy'};
    }catch(error){
      if(state.runId===runId) state={...state,status:'legacy'};
      if(typeof reportClientEvent==='function') reportClientEvent('game_flow_error',String(error&&error.message||'Run session unavailable'),{feature:'run_session'});
    }
    return snapshot();
  }

  window.startOnlineRunSession=start;
  window.currentRunSession=snapshot;
})();
