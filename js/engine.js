/* Motor: görseller, prosedürel sprite'lar, ses, giriş, dünya (çarpışma, görüş hattı, yol bulma). */
window.FB = window.FB || {};
(() => {
  'use strict';
  const T = 16;
  FB.T = T;

  /* ---------------- görseller ---------------- */
  FB.IMG = {};
  FB.loadImages = () => Promise.all([['town', 'assets/tiny-town.png'], ['dungeon', 'assets/tiny-dungeon.png']].map(([k, src]) =>
    new Promise((res, rej) => { const im = new Image(); im.onload = () => { FB.IMG[k] = im; res(); }; im.onerror = () => rej(new Error('Görsel yüklenemedi: ' + src)); im.src = src; })));

  // Kenney "packed" tilemap: 12 sütun, 16×16, aralıksız
  FB.spr = (ctx, sheet, idx, x, y, flip = false, src = null) => {
    const im = src || FB.IMG[sheet], sx = src ? 0 : (idx % 12) * T, sy = src ? 0 : Math.floor(idx / 12) * T;
    x = Math.round(x); y = Math.round(y);
    if (flip) { ctx.save(); ctx.translate(x + T, y); ctx.scale(-1, 1); ctx.drawImage(im, sx, sy, T, T, 0, 0, T, T); ctx.restore(); }
    else ctx.drawImage(im, sx, sy, T, T, x, y, T, T);
  };
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  FB.canvas = canvas;

  /* ---------------- prosedürel sprite'lar ---------------- */
  // Renklendirilmiş hayalet (Gölge) — her durum için bir renk
  FB.makeGhosts = () => {
    const cols = { DEVRIYE: '#7b4dff', KOVALA: '#ff3355', ARA: '#ff9a2e', DON: '#4d8dff' };
    const out = {};
    for (const [k, c] of Object.entries(cols)) {
      const cv = canvas(T, T), g = cv.getContext('2d');
      FB.spr(g, 'dungeon', 121, 0, 0);
      g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.55; g.fillStyle = c; g.fillRect(0, 0, T, T);
      out[k] = cv;
    }
    return out;
  };
  // Piksel piksel çizilen mercek parçası (7×9)
  FB.makeShard = () => {
    const cv = canvas(9, 11), g = cv.getContext('2d');
    const P = ['....a....', '...aba...', '..abcba..', '.abccdba.', 'abccddcba', '.abcdcba.', '..abcba..', '...aba...', '....a....'];
    const C = { a: '#0b3d5c', b: '#1fa3d6', c: '#7fe3ff', d: '#ffffff' };
    P.forEach((r, y) => [...r].forEach((ch, x) => { if (C[ch]) { g.fillStyle = C[ch]; g.fillRect(x, y + 1, 1, 1); } }));
    return cv;
  };
  // Fener: kayalık üstünde kırmızı-beyaz çizgili kule (16×32); lit = lamba yanıyor mu
  FB.makeLighthouse = (lit) => {
    const cv = canvas(16, 32), g = cv.getContext('2d');
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    // kayalar
    const rock = ['....aabbaa......', '..aabbbbbbaaa...', '.abbbccbbbbbbaa.', 'abbbbbbbccbbbbba', 'aabbbbbbbbbbbbaa'];
    rock.forEach((r, y) => [...r].forEach((ch, x) => { const c = { a: '#3a3f4a', b: '#6b7383', c: '#8f97a6' }[ch]; if (c) px(x, 27 + y, c); }));
    // kule gövdesi (y 10..27), aşağı doğru genişler
    for (let y = 10; y < 28; y++) {
      const half = 3 + Math.floor((y - 10) / 6), x0 = 8 - half, x1 = 8 + half - 1;
      const stripe = Math.floor((y - 10) / 4) % 2 === 0 ? '#e8e4dc' : '#c8323c';
      for (let x = x0; x <= x1; x++) px(x, y, x === x0 || x === x1 ? '#2a1d24' : (x === x0 + 1 ? '#ffffff22' : stripe));
      if (y === 21) { px(7, y, '#2a1d24'); px(8, y, '#2a1d24'); } // kapı üstü
      if (y > 21) { px(7, y, '#4a2a1a'); px(8, y, '#4a2a1a'); } // kapı
    }
    // balkon
    for (let x = 3; x <= 12; x++) { px(x, 9, '#2a1d24'); px(x, 8, x % 2 ? '#3d3d48' : '#2a1d24'); }
    // lamba odası
    for (let y = 4; y < 8; y++) for (let x = 5; x <= 10; x++) px(x, y, x === 5 || x === 10 ? '#2a1d24' : (lit ? (y === 5 && x === 7 ? '#ffffff' : '#ffd84d') : '#1c2433'));
    // çatı
    for (let y = 1; y < 4; y++) for (let x = 6 - y; x <= 9 + y; x++) px(x, y + 0, y === 3 || x === 6 - y || x === 9 + y ? '#2a1d24' : '#c8323c');
    px(7, 0, '#2a1d24'); px(8, 0, '#2a1d24');
    return cv;
  };
  // 3×5 piksel simgeler: ünlem ve soru işareti
  FB.drawGlyph = (ctx, ch, x, y, color) => {
    const G = { '!': ['.x.', '.x.', '.x.', '...', '.x.'], '?': ['xx.', '..x', '.x.', '...', '.x.'] }[ch];
    ctx.fillStyle = '#000'; G.forEach((r, j) => [...r].forEach((c, i) => { if (c === 'x') ctx.fillRect(x + i - 1, y + j, 3, 1); }));
    ctx.fillStyle = color; G.forEach((r, j) => [...r].forEach((c, i) => { if (c === 'x') ctx.fillRect(x + i, y + j, 1, 1); }));
  };

  /* ---------------- ses ---------------- */
  FB.Audio = (() => {
    let on = true, lang = 'tr', cur = null;
    function play(key) { if (!on || !key) return; stop(); const a = new Audio(`audio/${lang}/${key}.mp3`); cur = a; a.play().catch(() => {}); }
    function playIfIdle(key) { if (cur && !cur.paused && !cur.ended) return; play(key); }
    function stop() { if (cur) { cur.pause(); cur = null; } }
    return { play, playIfIdle, stop, setLang(l) { lang = l; }, setOn(v) { on = v; if (!v) stop(); }, get on() { return on; } };
  })();

  /* ---------------- giriş ---------------- */
  FB.Input = (() => {
    const keys = new Set(), handlers = {}, joy = { x: 0, y: 0, active: false };
    const emit = (ev) => (handlers[ev] || []).forEach((f) => f());
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      const inButton = e.target && e.target.tagName === 'BUTTON';
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k) && !inButton) e.preventDefault();
      if (!e.repeat) {
        if ((k === 'e' || k === ' ' || k === 'enter') && !inButton) emit('action');
        if (k === 'escape' || k === 'p') emit('pause');
        if (k === 'r') emit('restart');
        if (k === 'v') emit('ai');
      }
      keys.add(k);
    });
    addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => keys.clear());
    function dir() {
      if (joy.active) return { x: joy.x, y: joy.y };
      let x = 0, y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x--; if (keys.has('d') || keys.has('arrowright')) x++;
      if (keys.has('w') || keys.has('arrowup')) y--; if (keys.has('s') || keys.has('arrowdown')) y++;
      const l = Math.hypot(x, y); return l ? { x: x / l, y: y / l } : { x: 0, y: 0 };
    }
    // sanal joystick: taban öğesine dokunup sürükle
    function bindJoystick(base, knob) {
      let id = null, cx = 0, cy = 0, R = 1;
      const upd = (e) => {
        let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy);
        if (l > R) { dx = dx / l * R; dy = dy / l * R; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        const m = Math.hypot(dx, dy) / R; joy.active = true;
        if (m < 0.2) { joy.x = 0; joy.y = 0; } else { joy.x = dx / R; joy.y = dy / R; }
      };
      base.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; base.setPointerCapture(id); const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width / 2 - 8; upd(e); });
      base.addEventListener('pointermove', (e) => { if (e.pointerId === id) upd(e); });
      const end = (e) => { if (e.pointerId !== id) return; id = null; joy.active = false; joy.x = joy.y = 0; knob.style.transform = ''; };
      base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
    }
    return { keys, joy, dir, emit, bindJoystick, on(ev, f) { (handlers[ev] = handlers[ev] || []).push(f); } };
  })();

  /* ---------------- dünya ---------------- */
  FB.World = (() => {
    const M = FB.LEVEL.map, ROWS = M.length, COLS = M[0].length;
    const wall = (x, y) => y < 0 || y >= ROWS || x < 0 || x >= COLS || M[y][x] !== '.';
    const solidAt = (x, y) => wall(Math.floor(x / T), Math.floor(y / T));
    const collide = (x, y, r) => solidAt(x - r, y - r) || solidAt(x + r - 0.01, y - r) || solidAt(x - r, y + r - 0.01) || solidAt(x + r - 0.01, y + r - 0.01);
    const C = (cx, cy) => ({ x: cx * T + T / 2, y: cy * T + T / 2 });
    const tileOf = (o) => [Math.floor(o.x / T), Math.floor(o.y / T)];
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    // eksen eksen hareket; köşeye takılınca karo merkezine doğru hafifçe kaydır (köşe yardımı)
    function move(o, dx, dy) {
      let mx = false, my = false;
      if (dx && !collide(o.x + dx, o.y, o.r)) { o.x += dx; mx = true; }
      if (dy && !collide(o.x, o.y + dy, o.r)) { o.y += dy; my = true; }
      const s = Math.max(Math.abs(dx), Math.abs(dy));
      if (dx && !mx && !dy) { const cy = Math.floor(o.y / T) * T + T / 2, d = cy - o.y; if (Math.abs(d) > 0.1 && !collide(o.x + dx, cy, o.r)) o.y += Math.sign(d) * Math.min(Math.abs(d), s); }
      if (dy && !my && !dx) { const cx = Math.floor(o.x / T) * T + T / 2, d = cx - o.x; if (Math.abs(d) > 0.1 && !collide(cx, o.y + dy, o.r)) o.x += Math.sign(d) * Math.min(Math.abs(d), s); }
      return mx || my;
    }
    function los(a, b) { const d = dist(a, b), n = Math.ceil(d / 3); for (let i = 1; i < n; i++) { const t = i / n; if (solidAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; } return true; }
    function bfs(sx, sy, tx, ty) {
      if (sx === tx && sy === ty) return [];
      const prev = new Int16Array(ROWS * COLS).fill(-1), start = sy * COLS + sx, q = [start]; prev[start] = start;
      for (let h = 0; h < q.length; h++) {
        const c = q[h], x = c % COLS, y = (c / COLS) | 0;
        if (x === tx && y === ty) { const path = []; let k = c; while (k !== start) { path.push([k % COLS, (k / COLS) | 0]); k = prev[k]; } return path.reverse(); }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, ni = ny * COLS + nx; if (!wall(nx, ny) && prev[ni] < 0) { prev[ni] = c; q.push(ni); } }
      }
      return [];
    }
    return { M, ROWS, COLS, wall, solidAt, collide, move, los, bfs, C, tileOf, dist };
  })();
})();
