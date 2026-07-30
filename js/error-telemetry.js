(function(){
  const ENDPOINT='/api/client-events';
  const MAX_EVENTS=12;
  const seen=new Set();
  let sent=0;

  function cleanText(value,max){
    return String(value||'')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi,'Bearer [redacted]')
      .replace(/[?&](access_token|refresh_token|token)=[^&\s]+/gi,'?$1=[redacted]')
      .replace(/\s+/g,' ')
      .trim()
      .slice(0,max);
  }
  function report(kind,message,context){
    if(sent>=MAX_EVENTS) return false;
    const payload={
      kind:cleanText(kind,32),
      message:cleanText(message,500),
      context:context&&typeof context==='object'?context:{},
      build:String(window.SHADOW_BUILD_VERSION||'').slice(0,80),
      path:location.pathname.slice(0,120),
      viewport:[innerWidth,innerHeight],
      touch:matchMedia('(pointer:coarse)').matches,
      language:String(navigator.language||'').slice(0,16)
    };
    const signature=payload.kind+'|'+payload.message;
    if(!payload.kind||!payload.message||seen.has(signature)) return false;
    seen.add(signature);
    sent++;
    fetch(ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json','X-SC-Build':payload.build},
      keepalive:true,
      body:JSON.stringify(payload)
    }).catch(()=>{});
    return true;
  }

  window.reportClientEvent=report;
  window.addEventListener('error',event=>{
    const target=event.target;
    if(target&&target!==window){
      const source=target.currentSrc||target.src||target.href||target.tagName;
      report('asset_load','Resource failed to load',{source:cleanText(source,240)});
      return;
    }
    report('javascript_error',event.message||'Unknown script error',{
      file:cleanText(event.filename,180),
      line:Number(event.lineno||0),
      column:Number(event.colno||0)
    });
  },true);
  window.addEventListener('unhandledrejection',event=>{
    const reason=event.reason;
    report('unhandled_rejection',reason&&reason.message?reason.message:String(reason||'Unhandled promise rejection'),{});
  });
})();
