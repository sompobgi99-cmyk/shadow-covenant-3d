// Mobile touch controls: FLOATING virtual joystick (touch anywhere on the left), dash, and interact.
(function(){
  function isTouch(){ return ('ontouchstart' in window) || (navigator.maxTouchPoints||0) > 0; }
  function isMobilePlayLayout(){
    const shortSide=Math.min(innerWidth||0, innerHeight||0);
    const longSide=Math.max(innerWidth||0, innerHeight||0);
    return isTouch() && shortSide <= 700 && longSide <= 1200;
  }
  if (!isMobilePlayLayout()) return;

  document.body.classList.add('touch');
  if (typeof window.updateRankToggleLabel === 'function') window.updateRankToggleLabel();
  window.touchMove = { active:false, x:0, z:0 };

  const joy = document.createElement('div');
  joy.id = 'mjoy';
  joy.setAttribute('aria-label', 'Move');

  const knob = document.createElement('div');
  knob.id = 'mjoyknob';
  joy.appendChild(knob);

  const dash = document.createElement('button');
  dash.id = 'mdash'; dash.className = 'mbtn'; dash.type = 'button';
  dash.textContent = 'DASH'; dash.setAttribute('aria-label', 'Dash');

  const fbtn = document.createElement('button');
  fbtn.id = 'mf'; fbtn.className = 'mbtn'; fbtn.type = 'button';
  fbtn.textContent = 'F'; fbtn.setAttribute('aria-label', 'Interact');

  const hud = document.createElement('button');
  hud.id = 'mhud'; hud.className = 'mbtn'; hud.type = 'button';
  hud.setAttribute('aria-label', 'Toggle HUD');

  document.body.appendChild(joy);
  document.body.appendChild(dash);
  document.body.appendChild(fbtn);
  document.body.appendChild(hud);

  const HUD_KEY = 'sc3_mobile_hud_mode';
  const HUD_MODES = ['full','compact','min'];
  let hudMode = 'compact';
  try{ hudMode = localStorage.getItem(HUD_KEY) || hudMode; }catch(_){}
  if (!HUD_MODES.includes(hudMode)) hudMode = 'compact';
  function applyHudMode(){
    document.body.classList.toggle('hud-full', hudMode==='full');
    document.body.classList.toggle('hud-compact', hudMode==='compact');
    document.body.classList.toggle('hud-min', hudMode==='min');
    hud.textContent = hudMode==='full' ? 'HUD' : (hudMode==='compact' ? 'HUD-' : 'MIN');
    hud.title = hudMode==='full' ? 'HUD full' : (hudMode==='compact' ? 'HUD compact' : 'HUD minimal');
  }
  applyHudMode();
  hud.addEventListener('touchstart', e=>{
    e.preventDefault(); e.stopPropagation();
    hudMode = HUD_MODES[(HUD_MODES.indexOf(hudMode)+1)%HUD_MODES.length];
    try{ localStorage.setItem(HUD_KEY, hudMode); }catch(_){}
    applyHudMode();
    if (typeof showToast === 'function') showToast('HUD: '+hudMode.toUpperCase(), 1.1);
  }, {passive:false});

  const R = 46;                        // knob travel radius (px)
  let joyId = null, ox = 0, oy = 0;    // active touch id + floating origin (where the finger landed)

  function setMove(active,x,z){ window.touchMove.active=active; window.touchMove.x=x; window.touchMove.z=z; }
  function findTouch(list){ for (let i=0;i<list.length;i++) if (list[i].identifier===joyId) return list[i]; return null; }
  function moveKnob(x,y){
    let dx=x-ox, dy=y-oy; const d=Math.hypot(dx,dy)||1, cl=Math.min(d,R);
    const nx=dx/d, ny=dy/d;                 // direction (screen up = -z, matches W; right = +x)
    knob.style.transform='translate('+(nx*cl)+'px,'+(ny*cl)+'px)';
    setMove(true, nx, ny);
  }
  function showJoy(x,y){ ox=x; oy=y; joy.style.left=x+'px'; joy.style.top=y+'px'; joy.classList.add('active'); knob.style.transform='translate(0,0)'; }
  function hideJoy(){ joyId=null; joy.classList.remove('active'); knob.style.transform='translate(0,0)'; setMove(false,0,0); }

  function isPlaying(){ try { return !!(started && !gameOver && !won && !paused && !userPaused); } catch(e){ return false; } }
  function onUi(el){ while(el && el!==document.body){ if(el.tagName==='BUTTON' || el.id==='mdash' || el.id==='mf' || el.id==='mhud') return true; el=el.parentElement; } return false; }

  // Floating joystick: any touch that starts on the left ~55% (not on a button) becomes the stick origin.
  window.addEventListener('touchstart', e=>{
    if (joyId!==null || !isPlaying()) return;
    const t=e.changedTouches[0]; if(!t) return;
    if (onUi(t.target)) return;                    // let dash / F / pause handle their own touch
    if (t.clientX > innerWidth*0.55) return;       // right side is reserved for action buttons
    joyId=t.identifier; showJoy(t.clientX,t.clientY); moveKnob(t.clientX,t.clientY);
    e.preventDefault();
  }, {passive:false});

  window.addEventListener('touchmove', e=>{
    if (joyId===null) return;
    const t=findTouch(e.changedTouches); if(!t) return;
    e.preventDefault(); moveKnob(t.clientX,t.clientY);
  }, {passive:false});

  function endJoy(e){ if(joyId===null) return; const t=findTouch(e.changedTouches); if(!t) return; hideJoy(); }
  window.addEventListener('touchend', endJoy);
  window.addEventListener('touchcancel', endJoy);
  window.addEventListener('contextmenu', e=>{ if(document.body.classList.contains('touch')) e.preventDefault(); });

  dash.addEventListener('touchstart', e=>{
    e.preventDefault(); e.stopPropagation();
    if (typeof resumeAudio==='function') resumeAudio();
    if (typeof tryDash==='function') tryDash();
  }, {passive:false});

  fbtn.addEventListener('touchstart', e=>{
    e.preventDefault(); e.stopPropagation();
    const shop=document.getElementById('shop');
    if (shop && shop.style.display==='flex'){ if(typeof closeShop==='function') closeShop(); }
    else if (typeof activateNearby==='function') activateNearby();
  }, {passive:false});

  // show action buttons only during active play; drop the stick if play ends
  function tick(){
    const playing=isPlaying();
    if (!playing && joyId!==null) hideJoy();
    document.body.classList.toggle('playing', playing);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
