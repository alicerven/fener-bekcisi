/* Prosedürel müzik + ses efektleri (Web Audio). Hiç ses dosyası yok, her şey anında sentezleniyor.
   Müzik: dalga sesi + yumuşak pad + gecikmeli arpej. Hava (mood): 'calm' (minör) / 'bright' (majör, fener yanınca).
   Kovalamaca sırasında kalp atışı katmanı eklenir. Konuşma sırasında müzik kısılır (duck).
   Tarayıcılar sesi kullanıcı etkileşimi olmadan başlatmaz: ilk tık/tuşta FB.Synth.ensure() çağrılır. */
window.FB = window.FB || {};
FB.Synth = (() => {
  'use strict';
  let ac = null, master, musicBus, duckGain, sfxBus, delaySend, noiseBuf;
  let musicOn = true, sfxOn = true, mood = 'calm', chase = 0, chaseTarget = 0;
  let nextBeat = 0, beat = 0, chordIdx = -1, heartNext = 0, padNodes = [];
  const CHORDS = {
    calm: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],   // Am F C G
    bright: [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]], // C G Am F
  };
  const ARP = [0, 1, 2, 1, 0, 2, 1, -1]; // -1: es
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function gain(v, to) { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
  function noise() { const s = ac.createBufferSource(); s.buffer = noiseBuf; return s; }

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC();
    master = gain(0.9, ac.destination);
    duckGain = gain(1, master);
    musicBus = gain(0, duckGain);
    sfxBus = gain(sfxOn ? 0.8 : 0, master);
    // müzik için yankı (feedback delay)
    const delay = ac.createDelay(1); delay.delayTime.value = 0.36;
    const fb = gain(0.38), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    delaySend = gain(0.5); delaySend.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(musicBus);
    // gürültü tamponu
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // dalga sesi: alçak geçiren filtreden geçmiş gürültü + yavaş dalgalanan ses seviyesi
    const sea = noise(); sea.loop = true;
    const seaLp = ac.createBiquadFilter(); seaLp.type = 'lowpass'; seaLp.frequency.value = 520;
    const seaGain = gain(0.05); const lfo = ac.createOscillator(); lfo.frequency.value = 0.09; const lfoAmt = gain(0.035);
    lfo.connect(lfoAmt); lfoAmt.connect(seaGain.gain); sea.connect(seaLp); seaLp.connect(seaGain); seaGain.connect(musicBus);
    sea.start(); lfo.start();
    setMusic(musicOn);
    nextBeat = ac.currentTime + 0.1;
    setInterval(schedule, 50);
  }

  /* ---------- müzik zamanlayıcısı ---------- */
  function pluck(freq, t, vol = 0.07) {
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const g = gain(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g); g.connect(musicBus); g.connect(delaySend); o.start(t); o.stop(t + 1.5);
  }
  function pad(chord, t, len) {
    padNodes.forEach((n) => { try { n.g.gain.cancelScheduledValues(t); n.g.gain.setTargetAtTime(0, t, 0.8); n.o.stop(t + 4); } catch (e) {} });
    padNodes = [];
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = mood === 'bright' ? 1400 : 850; lp.connect(musicBus);
    for (const m of chord) for (const det of [-6, 6]) {
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m - 12); o.detune.value = det;
      const g = gain(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.022, t + 1.6);
      o.connect(g); g.connect(lp); o.start(t); o.stop(t + len + 5); padNodes.push({ o, g });
    }
  }
  function heartbeat(t, amt) {
    for (const [dt, v] of [[0, 1], [0.18, 0.7]]) {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t + dt); o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.2);
      const g = gain(0); g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(0.35 * amt * v, t + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.28);
      o.connect(g); g.connect(duckGain); o.start(t + dt); o.stop(t + dt + 0.3);
    }
  }
  function schedule() {
    if (!ac) return;
    chase += (chaseTarget - chase) * 0.08;
    const bl = mood === 'bright' ? 0.42 : 0.5; // vuruş süresi (sn)
    while (nextBeat < ac.currentTime + 0.25) {
      const t = nextBeat;
      if (beat % 8 === 0) { chordIdx = (chordIdx + 1) % 4; pad(CHORDS[mood][chordIdx], t, bl * 8); }
      const step = ARP[beat % 8];
      if (step >= 0) { const ch = CHORDS[mood][chordIdx]; const oct = beat % 16 >= 8 && step === 2 ? 24 : 12; pluck(mtof(ch[step] + oct), t, mood === 'bright' ? 0.08 : 0.06); }
      nextBeat += bl; beat++;
    }
    if (chase > 0.05 && ac.currentTime >= heartNext) { heartbeat(ac.currentTime + 0.05, Math.min(1, chase)); heartNext = ac.currentTime + 0.78; }
  }

  /* ---------- ses efektleri ---------- */
  const can = () => ac && sfxOn;
  function tone(type, f0, f1, dur, vol, t = ac.currentTime, filterHz = 0) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = gain(0); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = o; if (filterHz) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterHz; o.connect(f); out = f; }
    out.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function burst(freq, q, dur, vol, t = ac.currentTime, sweepTo = 0) {
    const s = noise(); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = gain(0); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  let stepAlt = false;
  const sfx = {
    step() { if (!can()) return; stepAlt = !stepAlt; burst(stepAlt ? 700 : 900, 1.2, 0.06, 0.05); },
    pickup() { if (!can()) return; const t = ac.currentTime; [1047, 1319, 1568, 2093].forEach((f, i) => tone('sine', f, f, 0.5, 0.12, t + i * 0.06)); },
    lamp() { if (!can()) return; const t = ac.currentTime; burst(300, 0.8, 0.4, 0.12, t, 2400); tone('sine', 523, 523, 0.9, 0.08, t + 0.05); tone('sine', 784, 784, 0.9, 0.05, t + 0.12); },
    alert() { if (!can()) return; const t = ac.currentTime; tone('sawtooth', 233, 196, 0.35, 0.07, t, 1400); tone('sawtooth', 247, 208, 0.35, 0.06, t, 1400); },
    hit() { if (!can()) return; const t = ac.currentTime; tone('sine', 140, 40, 0.3, 0.45, t); burst(400, 0.6, 0.15, 0.2, t); },
    win() { if (!can()) return; const t = ac.currentTime; [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 1.6, 0.09, t + i * 0.09)); },
    lose() { if (!can()) return; tone('sawtooth', 330, 98, 1.2, 0.08, ac.currentTime, 900); },
    click() { if (!can()) return; tone('sine', 1500, 1500, 0.03, 0.04); },
  };

  function setMusic(on) { musicOn = on; if (ac) musicBus.gain.setTargetAtTime(on ? 0.55 : 0, ac.currentTime, 0.4); }
  function setSfx(on) { sfxOn = on; if (ac) sfxBus.gain.setTargetAtTime(on ? 0.8 : 0, ac.currentTime, 0.05); }
  function setMood(m) { if (mood !== m) { mood = m; beat = 0; chordIdx = -1; if (ac) nextBeat = ac.currentTime + 0.1; } }
  function duck(v) { if (ac) duckGain.gain.setTargetAtTime(v ? 0.35 : 1, ac.currentTime, 0.15); }
  function setChase(v) { chaseTarget = v ? 1 : 0; }
  return { ensure, setMusic, setSfx, setMood, duck, setChase, sfx, get running() { return !!ac; } };
})();
