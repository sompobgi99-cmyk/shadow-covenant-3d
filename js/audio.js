// ---- Sound Effects (Web Audio API, procedural, no external files) ----
let audioCtx = null;
function initAudio() {
  if (audioCtx) return;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
}
function resumeAudio() { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }
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
    const o = audioCtx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(80, t+0.05);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.06);
    o.connect(g); o.start(t); o.stop(t+0.06);
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
    const o = audioCtx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(150, t); o.frequency.setValueAtTime(80, t+0.1);
    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.2);
    o.connect(g); o.start(t); o.stop(t+0.2);
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
