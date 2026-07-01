// ---- Sound Effects (Web Audio API, procedural, no external files) ----
let audioCtx = null;
const sfxLast = {};
function initAudio() {
  if (audioCtx) return;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
}
function resumeAudio() { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }
function sfxAllowed(type, gap){
  const now = audioCtx ? audioCtx.currentTime : 0;
  if (sfxLast[type] && now - sfxLast[type] < gap) return false;
  sfxLast[type] = now;
  return true;
}
function noiseHit(t, dur, freq, q, vol){
  const len = Math.max(1, Math.floor(audioCtx.sampleRate*dur));
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i=0;i<len;i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 2);
  const s = audioCtx.createBufferSource(); s.buffer = buf;
  const f = audioCtx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.setValueAtTime(q, t);
  const g = audioCtx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t+dur);
  s.connect(f); f.connect(g); g.connect(audioCtx.destination); s.start(t);
}
function sfx(type) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const g = audioCtx.createGain();
  g.connect(audioCtx.destination);
  
  if (type === 'shoot') {
    const o = audioCtx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(800, t); o.frequency.exponentialRampToValueAtTime(200, t+0.06);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.08);
    o.connect(g); o.start(t); o.stop(t+0.08);
  } else if (type === 'hit') {
    if(!sfxAllowed('hit',0.035)) return;
    noiseHit(t, 0.055, 1550, 5.5, 0.11);
    const o = audioCtx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(120, t+0.05);
    g.gain.setValueAtTime(0.075, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.065);
    o.connect(g); o.start(t); o.stop(t+0.07);
  } else if (type === 'crit') {
    if(!sfxAllowed('crit',0.08)) return;
    noiseHit(t, 0.06, 2600, 7, 0.12);
    [880,1320].forEach((f,i)=>{
      const o = audioCtx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(f, t+i*0.018); o.frequency.exponentialRampToValueAtTime(f*0.56, t+i*0.018+0.07);
      const gg = audioCtx.createGain(); gg.gain.setValueAtTime(0.055, t+i*0.018); gg.gain.exponentialRampToValueAtTime(0.001, t+i*0.018+0.09);
      o.connect(gg); gg.connect(audioCtx.destination); o.start(t+i*0.018); o.stop(t+i*0.018+0.095);
    });
  } else if (type === 'kill') {
    const o = audioCtx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(100, t+0.15);
    g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.18);
    o.connect(g); o.start(t); o.stop(t+0.18);
    // sub layer
    const o2 = audioCtx.createOscillator(); o2.type = 'sine';
    o2.frequency.setValueAtTime(120, t); o2.frequency.exponentialRampToValueAtTime(40, t+0.2);
    const g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.15, t); g2.gain.exponentialRampToValueAtTime(0.001, t+0.22);
    o2.connect(g2); g2.connect(audioCtx.destination); o2.start(t); o2.stop(t+0.22);
  } else if (type === 'pickup') {
    const o = audioCtx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(600, t); o.frequency.setValueAtTime(900, t+0.05); o.frequency.setValueAtTime(1200, t+0.1);
    g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.18);
    o.connect(g); o.start(t); o.stop(t+0.18);
  } else if (type === 'levelup') {
    [600,750,900,1100,1350].forEach((f,i) => {
      const o = audioCtx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f, t+i*0.06);
      const gg = audioCtx.createGain(); gg.gain.setValueAtTime(0.08, t+i*0.06); gg.gain.exponentialRampToValueAtTime(0.001, t+i*0.06+0.12);
      o.connect(gg); gg.connect(audioCtx.destination); o.start(t+i*0.06); o.stop(t+i*0.06+0.12);
    });
  } else if (type === 'dash') {
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate*0.15, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    const s = audioCtx.createBufferSource(); s.buffer = buf;
    const f = audioCtx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(2000, t); f.frequency.exponentialRampToValueAtTime(400, t+0.15);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.15);
    s.connect(f); f.connect(g); s.start(t);
  } else if (type === 'hurt') {
    if(!sfxAllowed('hurt',0.12)) return;
    noiseHit(t, 0.09, 620, 3.2, 0.16);
    const o = audioCtx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(72, t+0.16);
    g.gain.setValueAtTime(0.13, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.18);
    o.connect(g); o.start(t); o.stop(t+0.19);
  } else if (type === 'guard') {
    if(!sfxAllowed('guard',0.08)) return;
    noiseHit(t, 0.045, 3200, 8, 0.08);
    [760,1520].forEach((f,i)=>{
      const o = audioCtx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f, t+i*0.01); o.frequency.exponentialRampToValueAtTime(f*1.25, t+i*0.01+0.08);
      const gg = audioCtx.createGain(); gg.gain.setValueAtTime(0.06, t+i*0.01); gg.gain.exponentialRampToValueAtTime(0.001, t+i*0.01+0.12);
      o.connect(gg); gg.connect(audioCtx.destination); o.start(t+i*0.01); o.stop(t+i*0.01+0.13);
    });
  } else if (type === 'boss') {
    const o = audioCtx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(40, t); o.frequency.linearRampToValueAtTime(80, t+1.5);
    g.gain.setValueAtTime(0.18, t); g.gain.linearRampToValueAtTime(0.12, t+0.8); g.gain.exponentialRampToValueAtTime(0.001, t+2);
    o.connect(g); o.start(t); o.stop(t+2);
  } else if (type === 'shrine') {
    const o = audioCtx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(300, t); o.frequency.setValueAtTime(500, t+0.1); o.frequency.setValueAtTime(400, t+0.25); o.frequency.setValueAtTime(600, t+0.35);
    g.gain.setValueAtTime(0.12, t); g.gain.setValueAtTime(0.1, t+0.2); g.gain.exponentialRampToValueAtTime(0.001, t+0.5);
    o.connect(g); o.start(t); o.stop(t+0.5);
  } else if (type === 'chest') {
    [500,650,800].forEach((f,i) => {
      const o = audioCtx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(f, t+i*0.08);
      const gg = audioCtx.createGain(); gg.gain.setValueAtTime(0.07, t+i*0.08); gg.gain.exponentialRampToValueAtTime(0.001, t+i*0.08+0.15);
      o.connect(gg); gg.connect(audioCtx.destination); o.start(t+i*0.08); o.stop(t+i*0.08+0.15);
    });
  } else if (type === 'buy') {
    const o = audioCtx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(800, t); o.frequency.setValueAtTime(1000, t+0.06);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.15);
    o.connect(g); o.start(t); o.stop(t+0.15);
  } else if (type === 'win') {
    [400,500,600,800,1000,1200].forEach((f,i) => {
      const o = audioCtx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f, t+i*0.1);
      const gg = audioCtx.createGain(); gg.gain.setValueAtTime(0.08, t+i*0.1); gg.gain.exponentialRampToValueAtTime(0.001, t+i*0.1+0.2);
      o.connect(gg); gg.connect(audioCtx.destination); o.start(t+i*0.1); o.stop(t+i*0.1+0.2);
    });
  }
}

// ---- Title BGM (procedural ambient, loop) ----
let titleBgm = null;
function startTitleBGM() {
  if (!audioCtx || titleBgm) return;
  const now = audioCtx.currentTime;
  const masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0.06, now);
  masterGain.connect(audioCtx.destination);
  
  // Deep drone layer
  const drone = audioCtx.createOscillator(); drone.type = 'sine';
  drone.frequency.setValueAtTime(55, now);
  const dg = audioCtx.createGain(); dg.gain.setValueAtTime(0.25, now);
  drone.connect(dg); dg.connect(masterGain); drone.start(now);

  // Slow pulse
  const pulse = audioCtx.createOscillator(); pulse.type = 'sine';
  pulse.frequency.setValueAtTime(110, now);
  const pg = audioCtx.createGain();
  pg.gain.setValueAtTime(0, now);
  pg.gain.linearRampToValueAtTime(0.15, now+2);
  pg.gain.linearRampToValueAtTime(0.02, now+5);
  pg.gain.linearRampToValueAtTime(0.12, now+8);
  pulse.connect(pg); pg.connect(masterGain); pulse.start(now);

  // High shimmer
  const shimmer = audioCtx.createOscillator(); shimmer.type = 'sine';
  shimmer.frequency.setValueAtTime(880, now);
  const sg = audioCtx.createGain();
  sg.gain.setValueAtTime(0, now);
  sg.gain.linearRampToValueAtTime(0.06, now+3);
  sg.gain.linearRampToValueAtTime(0.01, now+6);
  sg.gain.linearRampToValueAtTime(0.05, now+9);
  shimmer.connect(sg); sg.connect(masterGain); shimmer.start(now);

  // Wind texture
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate*10, audioCtx.sampleRate);
  const d2 = buf.getChannelData(0);
  for (let i=0;i<d2.length;i++) d2[i] = (Math.random()*2-1) * 0.03 * (0.5+0.5*Math.sin(i*0.002));
  const wind = audioCtx.createBufferSource(); wind.buffer = buf; wind.loop = true;
  const wf = audioCtx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.setValueAtTime(200, now);
  const wg = audioCtx.createGain(); wg.gain.setValueAtTime(0.12, now);
  wind.connect(wf); wf.connect(wg); wg.connect(masterGain); wind.start(now);

  titleBgm = { masterGain, drone, pulse, shimmer, wind, dg, pg, sg, wg, wf };
}
function stopTitleBGM() {
  if (!titleBgm) return;
  try {
    titleBgm.masterGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime+0.5);
    setTimeout(() => {
      try { titleBgm.drone.stop(); } catch(e){}
      try { titleBgm.pulse.stop(); } catch(e){}
      try { titleBgm.shimmer.stop(); } catch(e){}
      try { titleBgm.wind.stop(); } catch(e){}
    }, 600);
  } catch(e){}
  titleBgm = null;
}
