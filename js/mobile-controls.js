// Mobile touch controls: virtual joystick, dash, and interact.
(function(){
  function isTouch(){ return ('ontouchstart' in window) || (navigator.maxTouchPoints||0) > 0; }
  if (!isTouch()) return;

  document.body.classList.add('touch');
  window.touchMove = { active:false, x:0, z:0 };

  const joy = document.createElement('div');
  joy.id = 'mjoy';
  joy.setAttribute('aria-label', 'Move');

  const knob = document.createElement('div');
  knob.id = 'mjoyknob';
  joy.appendChild(knob);

  const dash = document.createElement('button');
  dash.id = 'mdash';
  dash.className = 'mbtn';
  dash.type = 'button';
  dash.textContent = 'DASH';
  dash.setAttribute('aria-label', 'Dash');

  const fbtn = document.createElement('button');
  fbtn.id = 'mf';
  fbtn.className = 'mbtn';
  fbtn.type = 'button';
  fbtn.textContent = 'F';
  fbtn.setAttribute('aria-label', 'Interact');

  document.body.appendChild(joy);
  document.body.appendChild(dash);
  document.body.appendChild(fbtn);

  const R = 42;
  let joyId = null, cx = 0, cy = 0;
  function setMove(active,x,z){ window.touchMove.active=active; window.touchMove.x=x; window.touchMove.z=z; }
  function findTouch(list){ for (let i=0;i<list.length;i++) if (list[i].identifier===joyId) return list[i]; return null; }
  function moveKnob(x,y){
    let dx=x-cx, dy=y-cy; const d=Math.hypot(dx,dy)||1, cl=Math.min(d,R);
    const nx=dx/d, ny=dy/d;
    knob.style.transform='translate('+(nx*cl)+'px,'+(ny*cl)+'px)';
    setMove(true, nx, ny);
  }
  function resetJoy(){
    joyId=null;
    knob.style.transform='translate(0,0)';
    setMove(false,0,0);
  }

  joy.addEventListener('touchstart', e=>{
    e.preventDefault();
    const t=e.changedTouches[0]; joyId=t.identifier;
    const r=joy.getBoundingClientRect(); cx=r.left+r.width/2; cy=r.top+r.height/2;
    moveKnob(t.clientX,t.clientY);
  }, {passive:false});

  window.addEventListener('touchmove', e=>{
    if (joyId===null) return;
    const t=findTouch(e.changedTouches); if(!t) return;
    e.preventDefault(); moveKnob(t.clientX,t.clientY);
  }, {passive:false});

  function endJoy(e){
    if (joyId===null) return;
    const t=findTouch(e.changedTouches); if(!t) return;
    resetJoy();
  }
  window.addEventListener('touchend', endJoy);
  window.addEventListener('touchcancel', endJoy);
  window.addEventListener('contextmenu', e=>{ if(document.body.classList.contains('touch')) e.preventDefault(); });

  dash.addEventListener('touchstart', e=>{
    e.preventDefault();
    if (typeof resumeAudio==='function') resumeAudio();
    if (typeof tryDash==='function') tryDash();
  }, {passive:false});

  fbtn.addEventListener('touchstart', e=>{
    e.preventDefault();
    const shop=document.getElementById('shop');
    if (shop && shop.style.display==='flex'){ if(typeof closeShop==='function') closeShop(); }
    else if (typeof activateNearby==='function') activateNearby();
  }, {passive:false});

  function tick(){
    let playing=false;
    try { playing = !!(started && !gameOver && !won && !paused && !userPaused); } catch(e){ playing=false; }
    document.body.classList.toggle('playing', playing);
    if (!playing) resetJoy();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
