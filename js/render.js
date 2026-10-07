/* Görüntü.
   Dünya, harita büyüklüğündeki bir tuvale (world) çizilir; kamera bu tuvalin 384×224'lük bir bölümünü ekrana yansıtır.
   SEVİYE 1 (bölüm 1): tek ekran, yuvarlak ışık delikleri.
   SEVİYE 2 (bölüm 2): kayan kamera, görünürlük poligonlarıyla gerçek 2D gölgeler, derinlik gölgeleri, parke taşı,
   ıslak zemin, yağmur, sis, suda titreşen ışık yansımaları, kenar karartması. */
window.FB = window.FB || {};
(() => {
  'use strict';
  const T = FB.T, W = FB.World;
  const SW = 384, SH = 224; // ekran (oyun pikseli)
  const STATE_COL = { DEVRIYE: '#a98bff', KOVALA: '#ff4d6a', ARA: '#ffb04d', DON: '#7fb2ff', KAC: '#d6f3ff', TOPLAN: '#ff7a4d' };
  let VW = SW, VH = SH, tier = 1;
  let world, wctx, ground, dark, dg, fog;
  let ghosts, shard, oil, lampOff, lampOn, pier, cobble, lhOff, lhOn;
  let wins = [];                 // pencere ışıkları (evlerden otomatik)
  const polys = new Map();       // sabit ışıkların görünürlük poligonları (önbellek)
  const cam = { x: 0, y: 0 };
  let lastT = 0, rain = [], splashes = [];
  const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const isWater = (x, y) => { const r = W.M[y]; const c = r && r[x]; return c === 'W' || c === 'L'; };

  // aynı harfin bitişik bölgesi → ev karosu seçimi için
  function regions(ch) {
    const seen = new Set(), out = [];
    for (let y = 0; y < W.ROWS; y++) for (let x = 0; x < W.COLS; x++) {
      if (W.M[y][x] !== ch || seen.has(x + ',' + y)) continue;
      const q = [[x, y]], cells = []; seen.add(x + ',' + y);
      while (q.length) { const [cx, cy] = q.pop(); cells.push([cx, cy]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny; if (W.M[ny] && W.M[ny][nx] === ch && !seen.has(k)) { seen.add(k); q.push([nx, ny]); } } }
      const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
      out.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
    }
    return out;
  }
  function houseTile(kind, r, x, y) {
    const w = r.x1 - r.x0 + 1, i = x - r.x0, j = y - r.y0, h = r.y1 - r.y0 + 1, red = kind === 'H';
    const pick = (l, m, rr) => (i === 0 ? l : i === w - 1 ? rr : m);
    if (j === h - 1) { const door = Math.floor((w - 1) / 2); if (red) return i === door ? 85 : 84; return i === door ? 89 : 88; }
    if (j === 0) return red ? pick(52, 53, 54) : pick(48, 49, 50);
    return red ? pick(64, 65, 66) : pick(60, 61, 62);
  }
  function fenceTile(x, y) {
    const f = (dx, dy) => W.M[y + dy] && W.M[y + dy][x + dx] === 'F';
    const l = f(-1, 0), r = f(1, 0), u = f(0, -1), d = f(0, 1);
    if (l || r) return l && r ? 45 : r ? 44 : 46;
    if (u || d) return 59;
    return 47;
  }
  // tekrarlanabilir sis dokusu (yumuşatılmış değer gürültüsü)
  function makeFog() {
    const n = 64, c = FB.canvas(n, n), g = c.getContext('2d'), img = g.createImageData(n, n);
    const grid = 8, v = [];
    for (let i = 0; i < grid * grid; i++) v.push(hash(i, 77));
    const at = (x, y) => v[((y % grid) + grid) % grid * grid + ((x % grid) + grid) % grid];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const fx = x / n * grid, fy = y / n * grid, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const val = (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
      const i = (y * n + x) * 4; img.data[i] = 120; img.data[i + 1] = 142; img.data[i + 2] = 178; img.data[i + 3] = Math.max(0, val - 0.4) * 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  FB.Render = {
    size: { w: SW, h: SH },
    get cam() { return cam; },
    get tier() { return tier; },
    get worldSize() { return { w: VW, h: VH }; },
    init() {
      ghosts = FB.makeGhosts(); shard = FB.makeShard(); oil = FB.makeOil(); lampOff = FB.makeLampPost(false); lampOn = FB.makeLampPost(true);
      pier = FB.makePier(); cobble = [FB.makeCobble(1), FB.makeCobble(2), FB.makeCobble(3)]; lhOff = FB.makeLighthouse(false); lhOn = FB.makeLighthouse(true);
      fog = makeFog();
      this.setLevel();
    },
    // bölüm değişince: tuvalleri boyutlandır, statik zemini çiz, pencere ışıklarını bul, önbellekleri temizle
    setLevel() {
      const L = FB.Game ? FB.Game.L : FB.LEVELS[0];
      tier = L.tier || 1; VW = W.COLS * T; VH = W.ROWS * T;
      for (const k of ['world', 'ground', 'dark']) {
        const c = { world, ground, dark }[k];
        if (!c || c.width !== VW || c.height !== VH) { const n = FB.canvas(VW, VH); if (k === 'world') world = n; if (k === 'ground') ground = n; if (k === 'dark') dark = n; }
      }
      wctx = world.getContext('2d'); wctx.imageSmoothingEnabled = false; dg = dark.getContext('2d');
      const g = ground.getContext('2d'); g.clearRect(0, 0, VW, VH);
      const houses = { H: regions('H'), G: regions('G') };
      wins = [];
      for (let y = 0; y < W.ROWS; y++) for (let x = 0; x < W.COLS; x++) {
        const ch = W.M[y][x], px = x * T, py = y * T;
        if (ch === 'W' || ch === 'L') continue;
        if (ch === '=') { g.drawImage(pier, px, py); continue; }
        if (ch === ':') { g.drawImage(cobble[Math.floor(hash(x, y) * 3)], px, py); continue; }
        const hv = hash(x, y); FB.spr(g, 'town', hv < 0.12 ? 1 : hv < 0.17 ? 2 : 0, px, py);
        if (ch === 'T') FB.spr(g, 'town', [16, 28, 4, 16][Math.floor(hash(y, x) * 4)], px, py);
        else if (ch === 'B') FB.spr(g, 'town', hash(y, x) < 0.5 ? 5 : 16, px, py);
        else if (ch === 'F') FB.spr(g, 'town', fenceTile(x, y), px, py);
        else if (ch === 'O') FB.spr(g, 'dungeon', 82, px, py);
        else if (ch === 'H' || ch === 'G') {
          const r = houses[ch].find((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1), tile = houseTile(ch, r, x, y);
          FB.spr(g, 'town', tile, px, py);
          if (tile === 84 || tile === 88) wins.push([px + 8, py + 9]);
        }
      }
      if (tier >= 2) {
        // derinlik: opak nesnelerin altına düşen yumuşak gölge şeridi
        for (let y = 0; y < W.ROWS - 1; y++) for (let x = 0; x < W.COLS; x++) {
          if (!W.opaque(x, y) || W.opaque(x, y + 1) || isWater(x, y + 1)) continue;
          const gr = g.createLinearGradient(0, (y + 1) * T, 0, (y + 1) * T + 7); gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.fillRect(x * T, (y + 1) * T, T, 7);
        }
        // ıslak gece: zemini serin ve koyu bir tonla boya, parke taşlarına su birikintileri ekle
        // (source-atop: yalnızca dolu piksellere uygula; 'multiply' boş deniz alanlarını da boyayıp denizi örtüyordu)
        g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(18,32,70,.30)'; g.fillRect(0, 0, VW, VH); g.globalCompositeOperation = 'source-over';
        for (let y = 0; y < W.ROWS; y++) for (let x = 0; x < W.COLS; x++) if (W.M[y][x] === ':' && hash(x * 7, y * 3) < 0.18) {
          const cx = x * T + 4 + hash(x, y * 9) * 8, cy = y * T + 5 + hash(y, x * 9) * 6;
          g.fillStyle = 'rgba(40,60,95,.55)'; g.beginPath(); g.ellipse(cx, cy, 4, 2, 0, 0, 7); g.fill();
          g.fillStyle = 'rgba(160,190,230,.35)'; g.fillRect(Math.round(cx - 2), Math.round(cy - 1), 2, 1);
        }
      }
      polys.clear(); rain = []; splashes = [];
      const G = FB.Game; if (G && G.player) { this.follow(G, true); }
    },
    // kamerayı oyuncuya yumuşakça getir (snap: anında)
    follow(G, snap) {
      const tx = Math.max(0, Math.min(VW - SW, G.player.x - SW / 2)), ty = Math.max(0, Math.min(VH - SH, G.player.y - SH / 2));
      const dt = Math.min(0.05, Math.max(0, G.time - lastT)); lastT = G.time;
      const k = snap ? 1 : 1 - Math.pow(0.0015, dt);
      cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    },

    /* ---------------- dünyayı çiz ---------------- */
    drawWorld(G, opts = {}) {
      const ctx = wctx, t = G.time, p = G.player, lh = G.lighthouse;
      // görüş alanı (performans için deniz yalnızca görünen kısımda çizilir)
      const vx0 = Math.max(0, Math.floor(cam.x / T) - 1), vx1 = Math.min(W.COLS - 1, Math.ceil((cam.x + SW) / T) + 1);
      const vy0 = Math.max(0, Math.floor(cam.y / T) - 1), vy1 = Math.min(W.ROWS - 1, Math.ceil((cam.y + SH) / T) + 1);
      const full = opts.full || tier < 2;
      const X0 = full ? 0 : vx0, X1 = full ? W.COLS - 1 : vx1, Y0 = full ? 0 : vy0, Y1 = full ? W.ROWS - 1 : vy1;
      ctx.fillStyle = tier >= 2 ? '#0f2a47' : '#123a5e'; ctx.fillRect(0, 0, VW, VH);
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
        if (!isWater(x, y)) continue;
        const px = x * T, py = y * T;
        ctx.fillStyle = tier >= 2 ? '#0f3a66' : '#1b4f80'; ctx.fillRect(px, py, T, T);
        for (let k = 0; k < 3; k++) {
          const ph = hash(x * 3 + k, y * 7) * 6.28, wx = (hash(x, y * 5 + k) * 12 + Math.sin(t * 1.2 + ph) * 2) | 0, wy = 3 + k * 5;
          ctx.fillStyle = k === 1 ? (tier >= 2 ? '#2a68a3' : '#3d7ab3') : (tier >= 2 ? '#1b5288' : '#2c6699'); ctx.fillRect(px + wx, py + wy, 4, 1);
        }
        if (x > 0 && !isWater(x - 1, y)) { ctx.fillStyle = '#9fd0ef'; for (let j = 0; j < T; j += 2) if (Math.sin(t * 2 + j + y) > 0.2) ctx.fillRect(px, py + j, 1 + (Math.sin(t * 3 + j) > 0.6 ? 1 : 0), 1); }
        if (y > 0 && !isWater(x, y - 1)) { ctx.fillStyle = '#9fd0ef'; for (let i = 0; i < T; i += 2) if (Math.sin(t * 2 + i + x) > 0.2) ctx.fillRect(px + i, py, 1, 1); }
        if (y < W.ROWS - 1 && !isWater(x, y + 1)) { ctx.fillStyle = '#9fd0ef'; for (let i = 0; i < T; i += 2) if (Math.sin(t * 2 + i + x) > 0.2) ctx.fillRect(px + i, py + T - 1, 1, 1); }
      }
      ctx.drawImage(ground, 0, 0);
      ctx.drawImage(G.won ? lhOn : lhOff, lh.x - 8, lh.y + 8 - 32);
      for (const l of G.lamps) ctx.drawImage(l.lit ? lampOn : lampOff, l.x - 8, l.y - 12);
      const itemImg = G.L.item === 'oil' ? oil : shard;
      for (const s of G.items) if (!s.taken) ctx.drawImage(itemImg, Math.round(s.x - 4), Math.round(s.y - 6 + Math.sin(t * 3 + s.phase) * 1.5));
      if (tier >= 2) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(Math.round(G.nuri.x - 4), Math.round(G.nuri.y + 5), 8, 2); }
      FB.spr(ctx, 'dungeon', 100, G.nuri.x - 8, G.nuri.y - 10, true);
      for (const e of G.enemies) {
        if (e.alpha <= 0) continue;
        ctx.globalAlpha = 0.85 * e.alpha; FB.spr(ctx, null, 0, e.x - 8, e.y - 10 + Math.sin(t * 4 + e.id) * 1.2, e.face < 0, ghosts[e.state]); ctx.globalAlpha = 1;
      }
      if (p && !(G.inv > 0 && Math.floor(t * 12) % 2)) {
        const bob = p.moving ? (Math.floor(p.walkT * 8) % 2 ? -1 : 0) : 0;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(Math.round(p.x - 4), Math.round(p.y + 5), 8, 2);
        FB.spr(ctx, 'dungeon', 88, p.x - 8, p.y - 10 + bob, p.face < 0);
        if (tier >= 2) { // elde fener
          const lx = Math.round(p.x + (p.face < 0 ? -6 : 4)), ly = Math.round(p.y - 2 + bob);
          ctx.fillStyle = '#2a1d24'; ctx.fillRect(lx, ly - 1, 3, 1); ctx.fillRect(lx, ly + 3, 3, 1);
          ctx.fillStyle = '#ffd84d'; ctx.fillRect(lx, ly, 3, 3); ctx.fillStyle = '#fff6c0'; ctx.fillRect(lx + 1, ly + 1, 1, 1);
        }
      }

      /* ---- karanlık + ışık ---- */
      const base = G.won ? Math.max(0.12, 0.88 - G.wonT * 0.22) : (tier >= 2 ? 0.88 : 0.86);
      dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, VW, VH);
      dg.fillStyle = tier >= 2 ? `rgba(5,9,28,${base})` : `rgba(4,6,20,${base})`; dg.fillRect(0, 0, VW, VH);
      dg.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, a = 1, poly = null) => {
        const gr = dg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        dg.fillStyle = gr; dg.beginPath();
        if (poly && poly.length > 2) { dg.moveTo(poly[0][1], poly[0][2]); for (let i = 1; i < poly.length; i++) dg.lineTo(poly[i][1], poly[i][2]); dg.closePath(); }
        else dg.arc(x, y, r, 0, 7);
        dg.fill();
      };
      const shadows = tier >= 2;
      const cached = (key, x, y, r) => { if (!shadows) return null; let pl = polys.get(key); if (!pl) { pl = W.visPoly(x, y, r); polys.set(key, pl); } return pl; };
      const inView = (x, y, r) => full || (x + r > cam.x && x - r < cam.x + SW && y + r > cam.y && y - r < cam.y + SH);
      if (p) { const r = (shadows ? 62 : 54) + Math.sin(t * 9) * 1.5 + Math.sin(t * 23) * 0.8; hole(p.x, p.y - 2, r, 1, shadows ? W.visPoly(p.x, p.y - 2, r + 2) : null); }
      hole(G.nuri.x, G.nuri.y, 30, 0.9, cached('nuri', G.nuri.x, G.nuri.y - 1, 32));
      wins.forEach(([wx, wy], i) => { if (inView(wx, wy, 24)) hole(wx, wy + (shadows ? 9 : 0), shadows ? 26 : 20, 0.75, cached('win' + i, wx, wy + 9, 28)); });
      for (const s of G.items) if (!s.taken) hole(s.x, s.y, 18, 0.8);
      G.lamps.forEach((l, i) => { if (!inView(l.x, l.y, 60)) return; if (l.lit) hole(l.x, l.y - 6, shadows ? 52 + Math.sin(t * 7 + l.cx) * 0.8 : 34 + Math.sin(t * 7 + l.cx) * 0.8, 1, cached('lamp' + i, l.x, l.y - 6, 54)); else hole(l.x, l.y - 6, 6, 0.35); });
      hole(lh.x, lh.y - 14, G.won ? 44 : 10, G.won ? 1 : 0.5);
      let beam = null;
      if (G.flareFx > 0) { const k = 1 - G.flareFx / 1.6, r = 30 + Math.sin(k * Math.PI) * 170; hole(G.nuri.x, G.nuri.y, r, 1, cached('flare', G.nuri.x, G.nuri.y - 1, 200)); }
      if (G.won) {
        const a = t * 1.1, ox = lh.x, oy = lh.y - 18, len = Math.max(VW, VH) * 1.2, sp = 0.22;
        beam = [ox, oy, ox + Math.cos(a - sp) * len, oy + Math.sin(a - sp) * len, ox + Math.cos(a + sp) * len, oy + Math.sin(a + sp) * len];
        const gr = dg.createRadialGradient(ox, oy, 0, ox, oy, len); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0.2)');
        dg.fillStyle = gr; dg.beginPath(); dg.moveTo(beam[0], beam[1]); dg.lineTo(beam[2], beam[3]); dg.lineTo(beam[4], beam[5]); dg.closePath(); dg.fill();
      }
      dg.globalCompositeOperation = 'source-over';
      if (shadows) { ctx.filter = 'blur(1.2px)'; ctx.drawImage(dark, 0, 0); ctx.filter = 'none'; } else ctx.drawImage(dark, 0, 0);

      /* ---- renkli ışımalar + suda yansımalar ---- */
      ctx.globalCompositeOperation = 'lighter';
      const glow = (x, y, r, c) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
      for (const [wx, wy] of wins) if (inView(wx, wy, 20)) glow(wx, wy, 14, 'rgba(255,160,60,.35)');
      const itemGlow = G.L.item === 'oil' ? 'rgba(255,170,60,.5)' : 'rgba(90,210,255,.45)';
      for (const s of G.items) if (!s.taken) glow(s.x, s.y, 12 + Math.sin(t * 3 + s.phase) * 2, itemGlow);
      for (const l of G.lamps) if (l.lit && inView(l.x, l.y, 40)) glow(l.x, l.y - 8, shadows ? 34 : 26, 'rgba(255,200,90,.22)');
      if (p) glow(p.x, p.y - 2, 40, 'rgba(255,190,90,.10)');
      glow(G.nuri.x, G.nuri.y, 18, 'rgba(255,190,90,.18)');
      if (G.flareFx > 0) { const k = 1 - G.flareFx / 1.6; glow(G.nuri.x, G.nuri.y, 30 + Math.sin(k * Math.PI) * 120, `rgba(255,220,130,${0.5 * (1 - k)})`); }
      if (G.won) {
        glow(lh.x, lh.y - 20, 30, 'rgba(255,230,140,.6)');
        ctx.fillStyle = 'rgba(255,230,150,.10)'; ctx.beginPath(); ctx.moveTo(beam[0], beam[1]); ctx.lineTo(beam[2], beam[3]); ctx.lineTo(beam[4], beam[5]); ctx.closePath(); ctx.fill();
      }
      if (shadows) {
        // ışık kaynaklarının sudaki titreşen yansıması: kaynağın altına doğru uzanan sıcak çizgiler
        const reflect = (x, y, strength, col) => {
          for (let k = 0; k < 9; k++) {
            const yy = y + 12 + k * 3, tx = Math.floor(x / T), ty = Math.floor(yy / T);
            if (!isWater(tx, ty)) continue;
            const w = Math.max(1, 6 - k * 0.5) * (0.7 + 0.3 * Math.sin(t * 5 + k * 1.7)), ox = Math.sin(t * 3 + k * 0.9 + x) * 1.6;
            ctx.fillStyle = `rgba(${col},${strength * (1 - k / 9)})`; ctx.fillRect(Math.round(x - w / 2 + ox), yy, Math.round(w), 1);
          }
        };
        for (const l of G.lamps) if (l.lit && inView(l.x, l.y, 60)) reflect(l.x, l.y - 6, 0.55, '255,205,110');
        for (const [wx, wy] of wins) if (inView(wx, wy, 60)) reflect(wx, wy, 0.3, '255,170,80');
        if (p) reflect(p.x, p.y - 2, 0.3, '255,215,130');
        reflect(G.nuri.x, G.nuri.y - 2, 0.35, '255,205,110');
        if (G.won) reflect(lh.x, lh.y - 20, 0.8, '255,235,160');
      }
      ctx.globalCompositeOperation = 'source-over';

      /* ---- karanlıkta da görünenler ---- */
      for (const e of G.enemies) {
        if (e.alpha <= 0) continue;
        const ex = Math.round(e.x - 8), ey = Math.round(e.y - 10 + Math.sin(t * 4 + e.id) * 1.2), c = STATE_COL[e.state];
        ctx.globalAlpha = e.alpha; ctx.fillStyle = c;
        const f = e.face < 0; ctx.fillRect(ex + (f ? 9 : 5), ey + 7, 2, 2); ctx.fillRect(ex + (f ? 5 : 9), ey + 7, 2, 2);
        if (e.state === 'KOVALA' || e.state === 'TOPLAN') FB.drawGlyph(ctx, '!', ex + 7, ey - 6, STATE_COL[e.state]);
        if (e.state === 'ARA') FB.drawGlyph(ctx, '?', ex + 7, ey - 6, '#ffb04d');
        ctx.globalAlpha = 1;
      }
      if (p && G.protect > 0 && !(G.protect < 1 && Math.floor(t * 10) % 2)) {
        const r = 10 + Math.sin(t * 6) * 1.2;
        ctx.strokeStyle = 'rgba(140,230,255,.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(p.x) + 0.5, Math.round(p.y - 3) + 0.5, r, 0, 7); ctx.stroke();
        ctx.fillStyle = 'rgba(140,230,255,.12)'; ctx.beginPath(); ctx.arc(p.x, p.y - 3, r, 0, 7); ctx.fill();
      }
      const bounce = Math.round(Math.sin(t * 5) * 1.5);
      if (G.stage === 0 || G.stage === 2) FB.drawGlyph(ctx, '!', G.nuri.x, G.nuri.y - 18 + bounce, '#ffd84d');
      if (G.stage === 3) FB.drawGlyph(ctx, '!', lh.x, lh.y - 30 + bounce, '#ffd84d');

      /* ---- yapay zekâ görünümü (V) ---- */
      if (opts.ai) {
        ctx.fillStyle = 'rgba(255,216,77,.12)'; ctx.strokeStyle = 'rgba(255,216,77,.35)';
        for (const l of G.lamps) if (l.lit) { ctx.fillRect((l.cx - 1) * T, (l.cy - 1) * T, 3 * T, 3 * T); ctx.strokeRect((l.cx - 1) * T + 0.5, (l.cy - 1) * T + 0.5, 3 * T - 1, 3 * T - 1); }
        for (const e of G.enemies) {
          if (e.alpha <= 0) continue;
          const c = STATE_COL[e.state];
          ctx.strokeStyle = c; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, e.y, 80, 0, 7); ctx.stroke();
          ctx.globalAlpha = 0.9; ctx.fillStyle = c;
          if (e.path) for (const [px, py] of e.path) ctx.fillRect(px * T + 7, py * T + 7, 2, 2);
          if (p && e.state === 'KOVALA' && W.los(e, p)) { ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]); }
          if (e.state === 'ARA' && e.last) ctx.strokeRect(e.last[0] * T + 2, e.last[1] * T + 2, 12, 12);
          ctx.globalAlpha = 1;
        }
      }
    },

    /* ---------------- ekrana yansıt ---------------- */
    // view.zoom < 1: dünyanın daha büyük kısmını göster (dönüşüm sahnesi); view.focus: odak noktası
    present(ctx, G, view = {}) {
      const zoom = view.zoom || 1, t = G.time;
      ctx.save();
      if (G.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 3), Math.round((Math.random() - 0.5) * 3));
      ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, SW, SH);
      if (zoom === 1) { ctx.imageSmoothingEnabled = false; ctx.drawImage(world, Math.round(cam.x), Math.round(cam.y), SW, SH, 0, 0, SW, SH); }
      else {
        const sw = Math.min(VW, SW / zoom), sh = Math.min(VH, SH / zoom), f = view.focus || { x: cam.x + SW / 2, y: cam.y + SH / 2 };
        const sx = Math.max(0, Math.min(VW - sw, f.x - sw / 2)), sy = Math.max(0, Math.min(VH - sh, f.y - sh / 2));
        const dw = sw * zoom, dh = sh * zoom;
        ctx.imageSmoothingEnabled = zoom < 0.999; ctx.drawImage(world, sx, sy, sw, sh, (SW - dw) / 2, (SH - dh) / 2, dw, dh);
      }
      if (tier >= 2) {
        // sis: iki katman, farklı hızlarda sürüklenir
        ctx.globalAlpha = 0.07;
        for (const [sp, sc] of [[6, 3], [11, 2]]) {
          const pat = ctx.createPattern(fog, 'repeat'); const m = new DOMMatrix().scaleSelf(sc, sc).translateSelf((-cam.x * 0.3 - t * sp) / sc, (-cam.y * 0.3) / sc);
          pat.setTransform(m); ctx.fillStyle = pat; ctx.fillRect(0, 0, SW, SH);
        }
        ctx.globalAlpha = 1;
        // yağmur
        const dt = 1 / 60;
        while (rain.length < 170) rain.push({ x: Math.random() * (SW + 60), y: Math.random() * -SH, v: 220 + Math.random() * 90, life: 0.4 + Math.random() * 0.9 });
        ctx.fillStyle = 'rgba(170,200,240,.32)';
        for (const d of rain) {
          d.x -= d.v * 0.28 * dt; d.y += d.v * dt; d.life -= dt;
          ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 4);
          if (d.life <= 0 || d.y > SH) {
            const wx = Math.floor((d.x + cam.x) / T), wy = Math.floor((d.y + cam.y) / T);
            if (d.y > 0 && d.y < SH) splashes.push({ x: d.x, y: d.y, t: 0, water: isWater(wx, wy) });
            Object.assign(d, { x: Math.random() * (SW + 60), y: -10 - Math.random() * 40, life: 0.4 + Math.random() * 0.9 });
          }
        }
        for (let i = splashes.length - 1; i >= 0; i--) {
          const s = splashes[i]; s.t += dt;
          if (s.t > 0.35) { splashes.splice(i, 1); continue; }
          const k = s.t / 0.35;
          if (s.water) { ctx.strokeStyle = `rgba(170,210,250,${0.5 * (1 - k)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(s.x, s.y, 1 + k * 4, 0.5 + k * 1.6, 0, 0, 7); ctx.stroke(); }
          else { ctx.fillStyle = `rgba(190,215,250,${0.6 * (1 - k)})`; ctx.fillRect(Math.round(s.x - 1 - k * 2), Math.round(s.y - k * 2), 1, 1); ctx.fillRect(Math.round(s.x + 1 + k * 2), Math.round(s.y - k * 2), 1, 1); }
        }
        // kenar karartması
        const vg = ctx.createRadialGradient(SW / 2, SH / 2, SH * 0.35, SW / 2, SH / 2, SW * 0.62);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,.45)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, SW, SH);
      }
      if (G.shake > 0) { ctx.fillStyle = `rgba(255,40,60,${G.shake * 0.6})`; ctx.fillRect(0, 0, SW, SH); }
      ctx.restore();
    },

    draw(ctx, G, opts = {}) {
      if (G.player && !opts.noFollow) this.follow(G);
      this.drawWorld(G, opts);
      this.present(ctx, G, opts.view);
    },
  };
})();
