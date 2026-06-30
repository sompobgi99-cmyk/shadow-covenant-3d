// ---- Mobile / touch controls (virtual joystick + Dash + F) ----
// Loaded last; self-contained. Only activates on touch devices. Feeds window.touchMove
// (read by the movement loop) and calls the existing tryDash()/activateNearby()/closeShop().
(function(){
  function isTouch(){ return ('ontouchstart' in window) || (navigator.maxTouchPoints||0) > 0; }
  if (!isTouch()) return;
  document.body.classList.add('touch');
  window.touchMove = { active:false, x:0, z:0 };

  // ---- build DOM ----
  const joy  = document.createElement('div');    joy.id='mjoy';
  const knob = document.createElement('div');    knob.id='mjoyknob'; joy.appendChild(knob);
  const dash = document.createElement('button'); dash.id='mdash'; dash.className='mbtn'; dash.textContent='»';
  const fbtn = document.createElement('button'); fbtn.id='mf';    fbtn.className='mbtn'; fbtn.textContent='F';
  document.body.appendChild(joy); document.body.appendChild(dash); document.body.appendChild(fbtn);

  // ---- joystick ----
  const R = 46;                      // knob travel radius (px)
  let joyId = null, cx = 0, cy = 0;
  function setMove(active,x,z){ window.touchMove.active=active; window.touchMove.x=x; window.touchMove.z=z; }
  function findTouch(list){ for (let i=0;i<list.length;i++) if (list[i].identifier===joyId) return list[i]; return null; }
  function moveKnob(x,y){
    let dx=x-cx, dy=y-cy; const d=Math.hypot(dx,dy)||1, cl=Math.min(d,R);
    const nx=dx/d, ny=dy/d;
    knob.style.transform='translate('+(nx*cl)+'px,'+(ny*cl)+'px)';
    setMove(true, nx, ny);           // screen up (dy<0) -> world -z, matches W; right -> +x, matches D
  }
  joy.addEventListener('touchstart', e=>{
    e.preventDefault(); const t=e.changedTouches[0]; joyId=t.identifier;
    const r=joy.getBoundingClientRect(); cx=r.left+r.width/2; cy=r.top+r.height/2;
    moveKnob(t.clientX,t.clientY);
  }, {passive:false});
  window.addEventListener('touchmove', e=>{
    if (joyId===null) return; const t=findTouch(e.changedTouches); if(!t) return;
    e.preventDefault(); moveKnob(t.clientX,t.clientY);
  }, {passive:false});
  function endJoy(e){
    if (joyId===null) return; const t=findTouch(e.changedTouches); if(!t) return;
    joyId=null; knob.style.transform='translate(0,0)'; setMove(false,0,0);
  }
  window.addEventListener('touchend', endJoy);
  window.addEventListener('touchcancel', endJoy);

  // ---- action buttons ----
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

  // ---- show controls only during active play ----
  function tick(){
    let playing=false;
    try { playing = !!(started && !gameOver && !won && !paused && !userPaused); } catch(e){ playing=false; }
    document.body.classList.toggle('playing', playing);
    if (!playing) setMove(false,0,0);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
