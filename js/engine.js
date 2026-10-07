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
    const cols = { DEVRIYE: '#7b4dff', KOVALA: '#ff3355', ARA: '#ff9a2e', DON: '#4d8dff', KAC: '#bfe9ff', TOPLAN: '#ff6a3d' };
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
  // Yağ kandili (9×11): bölüm 2'nin toplanan nesnesi
  FB.makeOil = () => {
    const cv = canvas(9, 11), g = cv.getContext('2d');
    const P = ['...aaa...', '..a...a..', '...bbb...', '..bcccb..', '.bccdccb.', '.bcdccccb', '.bcccccb.', '.bcccccb.', '..bcccb..', '...bbb...'];
    const C = { a: '#6b4420', b: '#3a2208', c: '#e0902a', d: '#ffe08a' };
    P.forEach((r, y) => [...r].forEach((ch, x) => { if (C[ch]) { g.fillStyle = C[ch]; g.fillRect(x, y + 1, 1, 1); } }));
    return cv;
  };
  // Sokak lambası (16×16): direk + fener başlığı; lit = yanıyor mu
  FB.makeLampPost = (lit) => {
    const cv = canvas(16, 16), g = cv.getContext('2d'), px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    px(7, 6, 2, 9, '#2a2f3a'); px(7, 6, 1, 9, '#4a5263');      // direk
    px(5, 14, 6, 2, '#2a2f3a');                                 // taban
    px(5, 1, 6, 1, '#1d222b'); px(4, 2, 8, 1, '#1d222b');       // başlık
    px(5, 3, 6, 3, '#1d222b');                                  // camın çerçevesi
    px(6, 3, 4, 3, lit ? '#ffd84d' : '#3a4256');                // cam
    if (lit) px(7, 4, 2, 1, '#ffffff');
    px(6, 6, 4, 1, '#1d222b');
    return cv;
  };
  // Parke taşı yol (16×16), iki varyasyon
  FB.makeCobble = (seed) => {
    const cv = canvas(16, 16), g = cv.getContext('2d');
    g.fillStyle = '#3d4250'; g.fillRect(0, 0, 16, 16);
    let s = seed * 9301 + 49297; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const rows = [[0, 5], [5, 5], [10, 6]];
    rows.forEach(([y, h], ri) => {
      let x = ri % 2 ? -3 : 0;
      while (x < 16) {
        const w = 4 + Math.floor(rnd() * 3), sh = 0x5a + Math.floor(rnd() * 18);
        g.fillStyle = `rgb(${sh},${sh + 4},${sh + 14})`; g.fillRect(x + 1, y + 1, w - 1, h - 1);
        g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(x + 1, y + 1, w - 1, 1);
        x += w;
      }
    });
    return cv;
  };
  // İskele tahtası (16×16)
  FB.makePier = () => {
    const cv = canvas(16, 16), g = cv.getContext('2d');
    g.fillStyle = '#7a5230'; g.fillRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y += 4) { g.fillStyle = '#5e3d22'; g.fillRect(0, y + 3, 16, 1); g.fillStyle = '#8f6440'; g.fillRect(0, y, 16, 1); }
    g.fillStyle = '#3e2814'; g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
    g.fillStyle = '#c9a26b'; [[3, 1], [11, 5], [6, 9], [12, 13]].forEach(([x, y]) => g.fillRect(x, y, 1, 1)); // çiviler
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
    // konuşma sırasında müziğin sesini kıs (FB.Synth varsa)
    const duck = (v) => { if (FB.Synth) FB.Synth.duck(v); };
    function play(key) {
      if (!on || !key) return; stop();
      const a = new Audio(`audio/${lang}/${key}.mp3`); cur = a;
      a.onended = () => { if (cur === a) { cur = null; duck(false); } };
      duck(true); a.play().catch(() => { duck(false); });
    }
    function playIfIdle(key) { if (cur && !cur.paused && !cur.ended) return; play(key); }
    function stop() { if (cur) { cur.pause(); cur = null; } duck(false); }
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
    // Bölümler arasında değişen durum. Bütün bölümler 24×14 karo.
    let M = FB.LEVELS[0].map, ROWS = M.length, COLS = M[0].length;
    const WALK = new Set(['.', '=', ':']);
    // ışığı ve görüşü kesen karolar (deniz yürünemez ama görüşü kesmez)
    const OPAQUE = new Set(['T', 'B', 'F', 'H', 'G', 'O']);
    const opaque = (x, y) => y < 0 || y >= ROWS || x < 0 || x >= COLS || OPAQUE.has(M[y][x]);
    let forbidden = new Uint8Array(ROWS * COLS); // yanan lambaların ışığı: Gölgeler giremez
    const wall = (x, y) => y < 0 || y >= ROWS || x < 0 || x >= COLS || !WALK.has(M[y][x]);
    const isForbidden = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && forbidden[y * COLS + x] === 1;
    const enemyWall = (x, y) => wall(x, y) || isForbidden(x, y);
    const solidAt = (x, y) => wall(Math.floor(x / T), Math.floor(y / T));
    const C = (cx, cy) => ({ x: cx * T + T / 2, y: cy * T + T / 2 });
    const tileOf = (o) => [Math.floor(o.x / T), Math.floor(o.y / T)];
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    // Gölgeler ışıklı karolara giremez; ama ışık tam üstlerinde yanarsa dışarı kaçabilsinler diye o anki karo hariç tutulur
    function blockedAt(o, px, py) {
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      if (wall(tx, ty)) return true;
      if (!o.enemy) return false;
      const [ox, oy] = tileOf(o);
      return isForbidden(tx, ty) && !isForbidden(ox, oy);
    }
    const collide = (o, x, y) => { const r = o.r; return blockedAt(o, x - r, y - r) || blockedAt(o, x + r - 0.01, y - r) || blockedAt(o, x - r, y + r - 0.01) || blockedAt(o, x + r - 0.01, y + r - 0.01); };
    // eksen eksen hareket; köşeye takılınca karo merkezine doğru hafifçe kaydır (köşe yardımı)
    function move(o, dx, dy) {
      let mx = false, my = false;
      if (dx && !collide(o, o.x + dx, o.y)) { o.x += dx; mx = true; }
      if (dy && !collide(o, o.x, o.y + dy)) { o.y += dy; my = true; }
      const s = Math.max(Math.abs(dx), Math.abs(dy));
      if (dx && !mx && !dy) { const cy = Math.floor(o.y / T) * T + T / 2, d = cy - o.y; if (Math.abs(d) > 0.1 && !collide(o, o.x + dx, cy)) o.y += Math.sign(d) * Math.min(Math.abs(d), s); }
      if (dy && !my && !dx) { const cx = Math.floor(o.x / T) * T + T / 2, d = cx - o.x; if (Math.abs(d) > 0.1 && !collide(o, cx, o.y + dy)) o.x += Math.sign(d) * Math.min(Math.abs(d), s); }
      return mx || my;
    }
    function los(a, b) { const d = dist(a, b), n = Math.ceil(d / 3); for (let i = 1; i < n; i++) { const t = i / n; if (opaque(Math.floor((a.x + (b.x - a.x) * t) / T), Math.floor((a.y + (b.y - a.y) * t) / T))) return false; } return true; }

    /* Görünürlük poligonu (2D gölgeler): (lx,ly)'deki ışığın r yarıçapında gördüğü alan.
       1) r içindeki opak karoların yalnızca ışığa bakan ve açık alana komşu kenarlarını topla, aynı hizadakileri birleştir
       2) her kenar ucuna (±küçük açı) ve çevre kutusunun köşelerine ışın gönder, en yakın kesişimi bul
       3) noktaları açıya göre sırala. Kesişimler duvarın 3 px içine uzatılır: ışığa bakan duvar yüzleri aydınlık görünür. */
    function visPoly(lx, ly, r) {
      const x0 = Math.max(0, Math.floor((lx - r) / T)), x1 = Math.min(COLS - 1, Math.floor((lx + r) / T));
      const y0 = Math.max(0, Math.floor((ly - r) / T)), y1 = Math.min(ROWS - 1, Math.floor((ly + r) / T));
      const segs = [];
      // yatay kenarlar (satır satır birleştirerek)
      for (let y = y0; y <= y1 + 1; y++) {
        let runA = -1, runB = -1;
        const flush = (ex) => { if (runA >= 0) segs.push([runA * T, y * T, ex * T, y * T]); runA = -1; };
        for (let x = x0; x <= x1 + 1; x++) {
          // üst kenar: (x,y) opak, (x,y-1) açık ve ışık yukarıda  |  alt kenar: (x,y-1) opak, (x,y) açık ve ışık aşağıda
          const top = x <= x1 && y <= y1 && opaque(x, y) && !opaque(x, y - 1) && ly < y * T;
          const bot = x <= x1 && y - 1 >= y0 && opaque(x, y - 1) && !opaque(x, y) && ly > y * T;
          const on = top || bot;
          if (on && runA < 0) runA = x; if (!on && runA >= 0) flush(x);
        }
        flush(x1 + 1);
      }
      // dikey kenarlar (sütun sütun birleştirerek)
      for (let x = x0; x <= x1 + 1; x++) {
        let runA = -1;
        const flush = (ey) => { if (runA >= 0) segs.push([x * T, runA * T, x * T, ey * T]); runA = -1; };
        for (let y = y0; y <= y1 + 1; y++) {
          const left = y <= y1 && x <= x1 && opaque(x, y) && !opaque(x - 1, y) && lx < x * T;
          const right = y <= y1 && x - 1 >= x0 && opaque(x - 1, y) && !opaque(x, y) && lx > x * T;
          const on = left || right;
          if (on && runA < 0) runA = y; if (!on && runA >= 0) flush(y);
        }
        flush(y1 + 1);
      }
      const bx0 = lx - r, by0 = ly - r, bx1 = lx + r, by1 = ly + r;
      segs.push([bx0, by0, bx1, by0], [bx1, by0, bx1, by1], [bx1, by1, bx0, by1], [bx0, by1, bx0, by0]);
      const angles = [];
      for (const [ax, ay, bx, by] of segs) for (const [px, py] of [[ax, ay], [bx, by]]) {
        const a = Math.atan2(py - ly, px - lx); angles.push(a - 0.0004, a, a + 0.0004);
      }
      const pts = [];
      for (const a of angles) {
        const dx = Math.cos(a), dy = Math.sin(a); let best = Infinity;
        for (const [ax, ay, bx, by] of segs) {
          const sx = bx - ax, sy = by - ay, den = dx * sy - dy * sx; if (Math.abs(den) < 1e-9) continue;
          const t = ((ax - lx) * sy - (ay - ly) * sx) / den, u = ((ax - lx) * dy - (ay - ly) * dx) / den;
          if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6 && t < best) best = t;
        }
        if (best < Infinity) { const ext = best + 3; pts.push([a, lx + dx * ext, ly + dy * ext]); }
      }
      pts.sort((p, q) => p[0] - q[0]);
      return pts;
    }
    // blocked: hangi karoların geçilemez olduğu (varsayılan: duvarlar; Gölgeler için enemyWall)
    function bfs(sx, sy, tx, ty, blocked = wall) {
      if (sx === tx && sy === ty) return [];
      const prev = new Int16Array(ROWS * COLS).fill(-1), start = sy * COLS + sx, q = [start]; prev[start] = start;
      for (let h = 0; h < q.length; h++) {
        const c = q[h], x = c % COLS, y = (c / COLS) | 0;
        if (x === tx && y === ty) { const path = []; let k = c; while (k !== start) { path.push([k % COLS, (k / COLS) | 0]); k = prev[k]; } return path.reverse(); }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, ni = ny * COLS + nx; if (!blocked(nx, ny) && prev[ni] < 0) { prev[ni] = c; q.push(ni); } }
      }
      return [];
    }
    // (sx,sy)'den her karoya adım sayısı (ulaşılamayanlar -1)
    function bfsField(sx, sy, blocked = wall) {
      const d = new Int16Array(ROWS * COLS).fill(-1), q = [sy * COLS + sx]; d[q[0]] = 0;
      for (let h = 0; h < q.length; h++) {
        const c = q[h], x = c % COLS, y = (c / COLS) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, ni = ny * COLS + nx; if (!blocked(nx, ny) && d[ni] < 0) { d[ni] = d[c] + 1; q.push(ni); } }
      }
      return d;
    }
    function setLevel(L) { M = L.map; ROWS = M.length; COLS = M[0].length; forbidden = new Uint8Array(ROWS * COLS); }
    // yanan lambaların çevresindeki 3×3 karoyu yasakla
    function setLights(lamps) {
      forbidden.fill(0);
      for (const l of lamps) if (l.lit) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = l.cx + dx, y = l.cy + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS) forbidden[y * COLS + x] = 1; }
    }
    return {
      get M() { return M; }, get ROWS() { return ROWS; }, get COLS() { return COLS; },
      wall, opaque, enemyWall, isForbidden, solidAt, collide, move, los, visPoly, bfs, bfsField, C, tileOf, dist, setLevel, setLights,
    };
  })();
})();
