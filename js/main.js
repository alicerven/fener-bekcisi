/* Arayüz + ana döngü: menü, duraklatma, diyalog (daktilo efekti), bildirimler, HUD, ölçekleme, ayarlar. */
(() => {
  'use strict';
  const G = FB.Game, R = FB.Render, I = FB.Input, A = FB.Audio, W = FB.World;
  const $ = (s) => document.querySelector(s);
  const stage = $('#stage'), cv = $('#cv'), ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  /* ---------- ayarlar ---------- */
  const qs = new URLSearchParams(location.search);
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('fb-settings') || '{}'); } catch (e) {}
  const S = {
    lang: qs.get('lang') || saved.lang || ((navigator.language || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en'),
    sound: saved.sound !== false,
    music: saved.music !== false,
    ai: !!saved.ai,
    unlocked: Math.max(1, Math.min(FB.LEVELS.length, saved.unlocked | 0)), // açılmış bölüm sayısı
  };
  if (!FB.I18N[S.lang]) S.lang = 'en';
  // Video kaydı modu (?kayit=1): gerçek zamanlı döngü yok, oyun dışarıdan kare kare ilerletilir, sesler zaman damgasıyla kaydedilir.
  const KAYIT = qs.has('kayit');
  let simTime = 0;
  const audioLog = [];
  if (KAYIT) {
    A.play = (key) => { if (key) audioLog.push({ t: simTime, type: 'play', key, lang: S.lang }); };
    A.playIfIdle = (key) => { if (key) audioLog.push({ t: simTime, type: 'idle', key, lang: S.lang }); };
    A.stop = () => audioLog.push({ t: simTime, type: 'stop' });
    const st = document.createElement('style');
    st.textContent = 'html,body{overflow:visible!important;width:1280px;height:720px;display:block!important;margin:0;background:#05070f}#stage{position:absolute;left:64px;top:24px;box-shadow:0 0 0 1px #1b2233}';
    document.head.appendChild(st);
  }
  const save = () => { try { localStorage.setItem('fb-settings', JSON.stringify(S)); } catch (e) {} };
  const t = (k) => FB.I18N[S.lang][k];
  const line = (k) => FB.LINES[k][S.lang];

  // Web Audio ancak kullanıcı etkileşiminden sonra başlayabilir: ilk dokunuş/tuşta motoru aç
  const audioUp = () => { if (KAYIT || !FB.Synth) return; FB.Synth.ensure(); FB.Synth.setMusic(S.music); FB.Synth.setSfx(S.sound); };
  addEventListener('pointerdown', audioUp, { passive: true });
  addEventListener('keydown', audioUp);

  let mode = 'loading'; // loading | menu | play | paused | end
  let isTouch = matchMedia('(pointer: coarse)').matches;

  /* ---------- dil ve seçenekler ---------- */
  function applyLang() {
    document.documentElement.lang = S.lang;
    document.title = t('title') + (S.lang === 'tr' ? ' · The Lighthouse Keeper' : ' · Fener Bekçisi');
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $('#menu-controls').innerHTML = isTouch ? t('controlsTouch') : t('controls');
    const lang = (S.lang === 'tr' ? 'Türkçe' : 'English'), snd = `${t('sound')}: ${S.sound ? t('on') : t('off')}`;
    $('#btn-lang').textContent = $('#btn-lang2').textContent = `🌐 ${lang}`;
    $('#btn-sound').textContent = $('#btn-sound2').textContent = (S.sound ? '🔊 ' : '🔇 ') + snd;
    $('#btn-ai').textContent = `🧠 ${t('aiView')}: ${S.ai ? t('on') : t('off')}`;
    $('#btn-music').textContent = $('#btn-music2').textContent = `${S.music ? '🎵' : '🔕'} ${t('music')}: ${S.music ? t('on') : t('off')}`;
    renderChapters();
    A.setLang(S.lang); A.setOn(S.sound);
    if (FB.Synth && FB.Synth.running) { FB.Synth.setMusic(S.music); FB.Synth.setSfx(S.sound); }
    if (typer.key) { typer.full = line(typer.key); typer.shown = typer.full.length; renderDialog(); }
    hudCache = '';
  }
  const toggleLang = () => { S.lang = S.lang === 'tr' ? 'en' : 'tr'; save(); applyLang(); };
  const toggleSound = () => { S.sound = !S.sound; save(); applyLang(); };
  const toggleAI = () => { S.ai = !S.ai; save(); applyLang(); };
  const toggleMusic = () => { S.music = !S.music; save(); applyLang(); };
  // menüde bölüm düğmeleri (ilk bölümden sonra görünür)
  function renderChapters() {
    const box = $('#chapter-btns'); if (!box) return;
    if (S.unlocked < 2) { box.innerHTML = ''; return; }
    box.innerHTML = '';
    t('chapterShort').forEach((name, i) => {
      const b = document.createElement('button'); b.className = 'ch' + (i < S.unlocked - 1 ? ' done' : '');
      b.textContent = i < S.unlocked ? name : `${name} · ${t('locked')}`; b.disabled = i >= S.unlocked;
      b.onclick = () => start(i); box.appendChild(b);
    });
  }

  /* ---------- ekranlar ---------- */
  const screens = ['menu', 'pause', 'end', 'loading'];
  function setMode(m) {
    mode = m;
    screens.forEach((s) => { $('#scr-' + s).hidden = !(s === m || (s === 'pause' && m === 'paused')); });
    $('#hud').hidden = !(m === 'play' || m === 'paused');
    $('#touch').hidden = !(isTouch && m === 'play');
    if (m !== 'play') { $('#prompt').hidden = true; }
    if (m === 'end' || m === 'menu') { $('#toast').hidden = true; toastT = 0; }
    $('#dialog').hidden = !(m === 'play' && G.dialog);
    if (m === 'menu') setTimeout(() => $('#btn-start').focus(), 0);
    if (m === 'paused') setTimeout(() => $('#btn-resume').focus(), 0);
    if (m === 'end') setTimeout(() => ($('#btn-next').hidden ? $('#btn-again') : $('#btn-next')).focus(), 0);
    if (m === 'play' && document.activeElement) document.activeElement.blur();
  }
  // mod önce 'play' olmalı: reset() giriş diyaloğunu yayınlar ve diyalog sesi yalnızca oyun modunda çalınır
  // dönüşüm sahnesi: bir önceki bölümün son karesi küçülüp ışığa dönüşür, yeni (daha büyük) dünya açılır
  const trans = { t: 0, snap: null, active: false };
  let lastSnap = null;
  function start(levelIndex = 0, withTransition = false) {
    if (withTransition && lastSnap && (FB.LEVELS[levelIndex].tier || 1) > (G.L.tier || 1)) {
      audioUp(); A.stop(); G.reset(levelIndex); R.setLevel(); trans.t = 0; trans.snap = lastSnap; trans.active = true;
      mode = 'trans'; setMode('trans'); if (FB.Synth) FB.Synth.sfx.win();
      const bn = $('#banner'); bn.textContent = t('worldGrows'); bn.hidden = false; bn.style.animation = 'none'; void bn.offsetWidth; bn.style.animation = '';
      return;
    }
    audioUp(); A.stop(); mode = 'play'; G.reset(levelIndex); R.setLevel(); setMode('play');
    const bn = $('#banner'); bn.textContent = t('chapters')[G.levelIndex]; bn.hidden = false; bn.style.animation = 'none'; void bn.offsetWidth; bn.style.animation = '';
    clearTimeout(start.bt); start.bt = setTimeout(() => { bn.hidden = true; }, 2700);
    // dokunmatik cihazlarda tam ekran + yatay kilit dene (desteklenmeyen tarayıcılarda sessizce geçer)
    if (isTouch && !KAYIT && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
    }
  }
  function toMenu() { A.stop(); G.reset(G.levelIndex); R.setLevel(); typer.key = null; setMode('menu'); }

  /* ---------- diyalog: daktilo efekti ---------- */
  const typer = { key: null, full: '', shown: 0 };
  function renderDialog() {
    const box = $('#dialog');
    if (!typer.key || mode !== 'play') { box.hidden = true; return; }
    box.hidden = false;
    const who = FB.LINES[typer.key].who;
    box.querySelector('.who').textContent = who === 'nuri' ? t('nuri') : '';
    box.querySelector('.text').textContent = typer.full.slice(0, Math.floor(typer.shown));
    box.querySelector('.hint').textContent = typer.shown >= typer.full.length ? `${isTouch ? t('hintTouch') : 'E'} ▸ ${G.dialog.i + 1}/${G.dialog.keys.length}` : '';
  }
  G.on('dialog', (d) => {
    if (!d) { typer.key = null; renderDialog(); A.stop(); return; }
    typer.key = d.keys[d.i]; typer.full = line(typer.key); typer.shown = 0;
    if (mode === 'play') A.play(typer.key);
    renderDialog();
  });
  function onAction() {
    if (mode === 'menu') { start(0); return; }
    if (mode === 'end') { if ($('#btn-next').hidden) start(G.levelIndex); else start(G.levelIndex + 1, true); return; }
    if (mode !== 'play') return;
    if (G.dialog && typer.shown < typer.full.length) { typer.shown = typer.full.length; renderDialog(); return; }
    G.interact();
  }

  /* ---------- bildirim, vuruş, son ---------- */
  let toastT = 0;
  G.on('toast', (key) => { const el = $('#toast'); el.textContent = line(key); el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; toastT = 2.4; A.playIfIdle(key); });
  G.on('hit', () => { if (navigator.vibrate) navigator.vibrate(120); });
  G.on('end', (r) => {
    if (r === 'won') { lastSnap = FB.canvas(cv.width, cv.height); lastSnap.getContext('2d').drawImage(cv, 0, 0); }
    if (r === 'won') { S.unlocked = Math.max(S.unlocked, Math.min(FB.LEVELS.length, G.levelIndex + 2)); save(); renderChapters(); }
    $('#end-title').textContent = r === 'won' ? t('wonTitles')[G.levelIndex] : t('lost');
    $('#end-sub').textContent = r === 'won' ? t('wonSubs')[G.levelIndex] : t('lostSub');
    $('#btn-next').hidden = !(r === 'won' && G.hasNext);
    setTimeout(() => setMode('end'), r === 'won' ? 600 : 200);
  });

  /* ---------- HUD ---------- */
  let hudCache = '';
  function updateHUD() {
    const quest = t('questsByLevel')[G.levelIndex][Math.min(G.stage, 4)] + (G.stage === 1 ? ` (${G.got}/3)` : '');
    const shield = G.protect > 0 && mode === 'play' && !G.dialog ? Math.ceil(G.protect) : 0;
    const key = [S.lang, G.levelIndex, G.hearts, G.got, G.stage, S.ai, shield, G.enemies.map((e) => e.state).join()].join('|');
    if (key !== hudCache) {
      hudCache = key;
      $('#hud-hearts').textContent = '♥'.repeat(Math.max(0, G.hearts)) + '♡'.repeat(3 - Math.max(0, G.hearts));
      $('#hud-shards').textContent = `◆ ${t('items')[G.L.item]} ${G.got}/3` + (shield ? `   🛡 ${t('protected')} ${shield}` : '');
      $('#hud-quest').textContent = quest;
      const panel = $('#ai-panel'); panel.hidden = !(S.ai && (mode === 'play' || mode === 'paused'));
      const col = { DEVRIYE: '#a98bff', KOVALA: '#ff4d6a', ARA: '#ffb04d', DON: '#7fb2ff', KAC: '#d6f3ff', TOPLAN: '#ff7a4d' };
      panel.innerHTML = G.enemies.map((e) => `${t('enemy')} ${e.id}: <b style="color:${col[e.state]}">${t('states')[e.state]}</b>`).join('<br>');
    }
    // etkileşim ipucu
    const pr = $('#prompt');
    const lamp = mode === 'play' && !G.dialog && !G.over && !G.nearNuri() && G.nearLamp();
    const near = mode === 'play' && !G.dialog && !G.over && (G.nearNuri() || lamp || G.nearLighthouse());
    if (near) {
      const s = cv.clientWidth / R.size.w, label = G.nearNuri() ? t('talk') : lamp ? t('lamp') : (G.stage === 3 ? t('use') : '…');
      pr.innerHTML = `<kbd>${isTouch ? '●' : 'E'}</kbd>${label}`;
      pr.style.left = (G.player.x - R.cam.x) * s + 'px'; pr.style.top = (G.player.y - 13 - R.cam.y) * s + 'px'; pr.hidden = false;
    } else pr.hidden = true;
  }

  /* ---------- ölçekleme ---------- */
  function fit() {
    if (KAYIT) { stage.style.setProperty('--s', 3); return; }
    const sx = innerWidth / R.size.w, sy = innerHeight / R.size.h;
    let s = Math.min(sx, sy); if (s >= 2) s = Math.floor(s * 2) / 2; // yarım tam sayı adımları: pikseller net kalsın
    stage.style.setProperty('--s', s);
  }
  addEventListener('resize', fit);

  /* ---------- giriş bağlantıları ---------- */
  I.on('action', onAction);
  I.on('pause', () => { if (mode === 'play') { setMode('paused'); A.stop(); } else if (mode === 'paused') setMode('play'); });
  I.on('restart', () => { if (mode === 'end' || mode === 'paused') start(G.levelIndex); });
  I.on('ai', () => { if (mode === 'play' || mode === 'paused') toggleAI(); });
  $('#dialog').addEventListener('click', onAction);
  $('#btn-start').onclick = () => start(0);
  $('#btn-next').onclick = () => start(G.levelIndex + 1, true);
  $('#btn-music').onclick = $('#btn-music2').onclick = toggleMusic;
  // telefon dik tutulursa oyunu duraklat
  const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');
  const onOrient = () => { if (portrait.matches && mode === 'play') { setMode('paused'); A.stop(); } };
  portrait.addEventListener ? portrait.addEventListener('change', onOrient) : portrait.addListener(onOrient);
  $('#btn-resume').onclick = () => setMode('play');
  $('#btn-restart').onclick = () => start(G.levelIndex);
  $('#btn-again').onclick = () => start(G.levelIndex);
  $('#btn-menu').onclick = $('#btn-menu2').onclick = toMenu;
  $('#btn-lang').onclick = $('#btn-lang2').onclick = toggleLang;
  $('#btn-sound').onclick = $('#btn-sound2').onclick = toggleSound;
  $('#btn-ai').onclick = toggleAI;
  $('#btn-act').addEventListener('pointerdown', (e) => { e.preventDefault(); onAction(); });
  $('#btn-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); I.emit('pause'); });
  I.bindJoystick($('#joy'), $('#knob'));
  addEventListener('touchstart', () => { if (!isTouch) { isTouch = true; applyLang(); setMode(mode); } }, { passive: true });

  /* ---------- ana döngü ---------- */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    tick(dt);
  }
  function tick(dt) {
    simTime += dt;
    if (mode === 'loading') return;
    if (mode === 'trans') { drawTransition(dt); updateHUD(); return; }
    if (mode === 'play') {
      G.update(dt);
      if (typer.key && typer.shown < typer.full.length) { typer.shown = Math.min(typer.full.length, typer.shown + dt * 48); renderDialog(); }
    } else G.time += dt;
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('#toast').hidden = true; }
    R.draw(ctx, G, { ai: S.ai && mode !== 'menu' });
    updateHUD();
  }

  function drawTransition(dt) {
    trans.t += dt; G.time += dt;
    const tt = trans.t, SW = R.size.w, SH = R.size.h, ws = R.worldSize;
    ctx.imageSmoothingEnabled = true;
    if (tt < 1.5) {
      // eski dünya küçülür, etrafı ışıkla dolar
      const k = Math.min(1, tt / 1.5), sc = 1 - 0.62 * k * k;
      ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, SW, SH);
      const w = SW * sc, h = SH * sc;
      const gr = ctx.createRadialGradient(SW / 2, SH / 2, 0, SW / 2, SH / 2, SW * 0.7); gr.addColorStop(0, `rgba(255,230,160,${0.55 * k})`); gr.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, SW, SH);
      ctx.drawImage(trans.snap, (SW - w) / 2, (SH - h) / 2, w, h);
      ctx.fillStyle = `rgba(255,248,225,${Math.max(0, (tt - 1.1) / 0.4)})`; ctx.fillRect(0, 0, SW, SH);
    } else {
      // yeni dünyanın tamamı görünür, kamera oyuncuya yaklaşır
      const k = Math.min(1, (tt - 1.5) / 2.2), e = k * k * (3 - 2 * k);
      const fit = Math.min(SW / ws.w, SH / ws.h), zoom = fit + (1 - fit) * e;
      R.follow(G, true);
      const focus = { x: ws.w / 2 + (G.player.x - ws.w / 2) * e, y: ws.h / 2 + (G.player.y - ws.h / 2) * e };
      R.drawWorld(G, { full: true });
      R.present(ctx, G, { zoom, focus });
      const fl = Math.max(0, 1 - (tt - 1.5) / 0.6); if (fl > 0) { ctx.fillStyle = `rgba(255,248,225,${fl})`; ctx.fillRect(0, 0, SW, SH); }
      if (k >= 1) {
        trans.active = false; $('#banner').hidden = true; setMode('play');
        const bn = $('#banner'); bn.textContent = t('chapters')[G.levelIndex]; bn.hidden = false; bn.style.animation = 'none'; void bn.offsetWidth; bn.style.animation = '';
        clearTimeout(start.bt); start.bt = setTimeout(() => { bn.hidden = true; }, 2700);
        if (typer.key) { A.play(typer.key); renderDialog(); }
      }
    }
    ctx.imageSmoothingEnabled = false;
  }

  /* ---------- başlangıç ---------- */
  fit(); applyLang();
  FB.loadImages().then(() => {
    R.init(); G.reset(); typer.key = null; setMode('menu');
    if (KAYIT) { tick(0); const s = document.createElement('script'); s.src = 'video/yonetmen.js'; document.body.appendChild(s); }
    else requestAnimationFrame(frame);
  }).catch((e) => { $('#scr-loading').querySelector('p').textContent = '⚠ ' + e.message; });

  // video kaydı / otomatik testler için dış erişim
  window.__fb = {
    G, I, A, S, start, toMenu, setMode, get mode() { return mode; }, toggleLang, toggleAI,
    step: tick, audioLog, get simTime() { return simTime; },
    setLang(l) { if (S.lang !== l) toggleLang(); }, setAI(v) { if (S.ai !== v) toggleAI(); }, setSound(v) { if (S.sound !== v) toggleSound(); },
  };
})();
