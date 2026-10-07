/* Görüntü: statik karo katmanı, animasyonlu deniz, karakterler, karanlık + ışık, yapay zekâ görünümü. */
window.FB = window.FB || {};
(() => {
  'use strict';
  const T = FB.T, W = FB.World, L = FB.LEVEL;
  const VW = W.COLS * T, VH = W.ROWS * T;
  const STATE_COL = { DEVRIYE: '#a98bff', KOVALA: '#ff4d6a', ARA: '#ffb04d', DON: '#7fb2ff' };
  let ground, dark, dg, ghosts, shard, lhOff, lhOn;
  const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // aynı harfin bitişik bölgesi içinde (sütun, satır) konumu → ev karosu seçimi için
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
    const w = r.x1 - r.x0 + 1, i = x - r.x0, j = y - r.y0, h = r.y1 - r.y0 + 1;
    const red = kind === 'H';
    const pick = (l, m, rr) => (i === 0 ? l : i === w - 1 ? rr : m);
    if (j === h - 1) { // duvar: kenarlarda pencere, ortada kapı
      const door = Math.floor((w - 1) / 2);
      if (red) return i === door ? 85 : 84;
      return i === door ? 89 : 88;
    }
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

  FB.Render = {
    init() {
      ghosts = FB.makeGhosts(); shard = FB.makeShard(); lhOff = FB.makeLighthouse(false); lhOn = FB.makeLighthouse(true);
      dark = FB.canvas(VW, VH); dg = dark.getContext('2d');
      // statik katman: çimen + ağaç/ev/çit/fıçı
      ground = FB.canvas(VW, VH); const g = ground.getContext('2d');
      const houses = { H: regions('H'), G: regions('G') };
      for (let y = 0; y < W.ROWS; y++) for (let x = 0; x < W.COLS; x++) {
        const ch = W.M[y][x], px = x * T, py = y * T;
        if (ch === 'W' || ch === 'L') continue;
        const hv = hash(x, y); FB.spr(g, 'town', hv < 0.12 ? 1 : hv < 0.17 ? 2 : 0, px, py);
        if (ch === 'T') FB.spr(g, 'town', [16, 28, 4, 16][Math.floor(hash(y, x) * 4)], px, py);
        else if (ch === 'B') FB.spr(g, 'town', hash(y, x) < 0.5 ? 5 : 16, px, py);
        else if (ch === 'F') FB.spr(g, 'town', fenceTile(x, y), px, py);
        else if (ch === 'O') FB.spr(g, 'dungeon', 82, px, py);
        else if (ch === 'H' || ch === 'G') { const r = houses[ch].find((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1); FB.spr(g, 'town', houseTile(ch, r, x, y), px, py); }
      }
    },
    size: { w: VW, h: VH },

    draw(ctx, G, opts = {}) {
      const t = G.time;
      ctx.save();
      if (G.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 3), Math.round((Math.random() - 0.5) * 3));
      ctx.fillStyle = '#123a5e'; ctx.fillRect(-4, -4, VW + 8, VH + 8);
      // deniz (animasyonlu)
      for (let y = 0; y < W.ROWS; y++) for (let x = 0; x < W.COLS; x++) {
        const ch = W.M[y][x]; if (ch !== 'W' && ch !== 'L') continue;
        const px = x * T, py = y * T;
        ctx.fillStyle = '#1b4f80'; ctx.fillRect(px, py, T, T);
        for (let k = 0; k < 3; k++) {
          const ph = hash(x * 3 + k, y * 7) * 6.28, wx = (hash(x, y * 5 + k) * 12 + Math.sin(t * 1.2 + ph) * 2) | 0, wy = 3 + k * 5;
          ctx.fillStyle = k === 1 ? '#3d7ab3' : '#2c6699'; ctx.fillRect(px + wx, py + wy, 4, 1);
        }
        if (x > 0 && W.M[y][x - 1] !== 'W' && W.M[y][x - 1] !== 'L') { // kıyı köpüğü
          ctx.fillStyle = '#9fd0ef'; for (let j = 0; j < T; j += 2) if (Math.sin(t * 2 + j + y) > 0.2) ctx.fillRect(px, py + j, 1 + (Math.sin(t * 3 + j) > 0.6 ? 1 : 0), 1);
        }
        if (y < W.ROWS - 1 && W.M[y + 1][x] !== 'W' && W.M[y + 1][x] !== 'L') { ctx.fillStyle = '#9fd0ef'; for (let i = 0; i < T; i += 2) if (Math.sin(t * 2 + i + x) > 0.2) ctx.fillRect(px + i, py + T - 1, 1, 1); }
      }
      ctx.drawImage(ground, 0, 0);
      // fener
      const lh = G.lighthouse; ctx.drawImage(G.won ? lhOn : lhOff, lh.x - 8, lh.y + 8 - 32);
      // mercek parçaları
      for (const s of G.shards) if (!s.taken) ctx.drawImage(shard, Math.round(s.x - 4), Math.round(s.y - 6 + Math.sin(t * 3 + s.phase) * 1.5));
      // Nuri
      FB.spr(ctx, 'dungeon', 100, G.nuri.x - 8, G.nuri.y - 10, true);
      // Gölgeler (ışıkta tam görünür)
      for (const e of G.enemies) {
        if (e.alpha <= 0) continue;
        ctx.globalAlpha = 0.85 * e.alpha; FB.spr(ctx, null, 0, e.x - 8, e.y - 10 + Math.sin(t * 4 + e.id) * 1.2, e.face < 0, ghosts[e.state]); ctx.globalAlpha = 1;
      }
      // oyuncu
      const p = G.player;
      if (p && !(G.inv > 0 && Math.floor(t * 12) % 2)) {
        const bob = p.moving ? (Math.floor(p.walkT * 8) % 2 ? -1 : 0) : 0;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(Math.round(p.x - 4), Math.round(p.y + 5), 8, 2);
        FB.spr(ctx, 'dungeon', 88, p.x - 8, p.y - 10 + bob, p.face < 0);
      }

      // ---- karanlık + ışık ----
      const base = G.won ? Math.max(0.12, 0.86 - G.wonT * 0.22) : 0.86;
      dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, VW, VH);
      dg.fillStyle = `rgba(4,6,20,${base})`; dg.fillRect(0, 0, VW, VH);
      dg.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, a = 1) => { const gr = dg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); dg.fillStyle = gr; dg.beginPath(); dg.arc(x, y, r, 0, 7); dg.fill(); };
      if (p) hole(p.x, p.y - 2, 54 + Math.sin(t * 9) * 1.5 + Math.sin(t * 23) * 0.8, 1);
      hole(G.nuri.x, G.nuri.y, 30, 0.9);
      for (const [wx, wy] of L.windows) hole(wx * T + 8, wy * T + 9, 20, 0.75);
      for (const s of G.shards) if (!s.taken) hole(s.x, s.y, 18, 0.8);
      hole(lh.x, lh.y - 14, G.won ? 44 : 10, G.won ? 1 : 0.5);
      let beam = null;
      if (G.won) { // dönen ışık huzmesi
        const a = t * 1.1, ox = lh.x, oy = lh.y - 18, len = 420, sp = 0.22;
        beam = [ox, oy, ox + Math.cos(a - sp) * len, oy + Math.sin(a - sp) * len, ox + Math.cos(a + sp) * len, oy + Math.sin(a + sp) * len];
        const gr = dg.createRadialGradient(ox, oy, 0, ox, oy, len); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0.2)');
        dg.fillStyle = gr; dg.beginPath(); dg.moveTo(beam[0], beam[1]); dg.lineTo(beam[2], beam[3]); dg.lineTo(beam[4], beam[5]); dg.closePath(); dg.fill();
      }
      dg.globalCompositeOperation = 'source-over';
      ctx.drawImage(dark, 0, 0);

      // ---- renkli ışımalar ----
      ctx.globalCompositeOperation = 'lighter';
      const glow = (x, y, r, c) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
      for (const [wx, wy] of L.windows) glow(wx * T + 8, wy * T + 9, 14, 'rgba(255,160,60,.35)');
      for (const s of G.shards) if (!s.taken) glow(s.x, s.y, 12 + Math.sin(t * 3 + s.phase) * 2, 'rgba(90,210,255,.45)');
      if (p) glow(p.x, p.y - 2, 40, 'rgba(255,190,90,.10)');
      glow(G.nuri.x, G.nuri.y, 18, 'rgba(255,190,90,.18)');
      if (G.won) {
        glow(lh.x, lh.y - 20, 30, 'rgba(255,230,140,.6)');
        ctx.fillStyle = 'rgba(255,230,150,.10)'; ctx.beginPath(); ctx.moveTo(beam[0], beam[1]); ctx.lineTo(beam[2], beam[3]); ctx.lineTo(beam[4], beam[5]); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // ---- karanlıkta da görünenler: Gölge gözleri, simgeler ----
      for (const e of G.enemies) {
        if (e.alpha <= 0) continue;
        const ex = Math.round(e.x - 8), ey = Math.round(e.y - 10 + Math.sin(t * 4 + e.id) * 1.2), c = STATE_COL[e.state];
        ctx.globalAlpha = e.alpha; ctx.fillStyle = c;
        const f = e.face < 0; ctx.fillRect(ex + (f ? 9 : 5), ey + 7, 2, 2); ctx.fillRect(ex + (f ? 5 : 9), ey + 7, 2, 2);
        if (e.state === 'KOVALA') FB.drawGlyph(ctx, '!', ex + 7, ey - 6, '#ff4d6a');
        if (e.state === 'ARA') FB.drawGlyph(ctx, '?', ex + 7, ey - 6, '#ffb04d');
        ctx.globalAlpha = 1;
      }
      const bounce = Math.round(Math.sin(t * 5) * 1.5);
      if (G.stage === 0 || G.stage === 2) FB.drawGlyph(ctx, '!', G.nuri.x, G.nuri.y - 18 + bounce, '#ffd84d');
      if (G.stage === 3) FB.drawGlyph(ctx, '!', lh.x, lh.y - 30 + bounce, '#ffd84d');

      // ---- yapay zekâ görünümü (V) ----
      if (opts.ai) {
        for (const e of G.enemies) {
          if (e.alpha <= 0) continue;
          const c = STATE_COL[e.state];
          ctx.strokeStyle = c; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, e.y, 80, 0, 7); ctx.stroke();
          ctx.globalAlpha = 0.9; ctx.fillStyle = c;
          if (e.path) for (const [px, py] of e.path) ctx.fillRect(px * T + 7, py * T + 7, 2, 2);
          if (p && (e.state === 'KOVALA') && W.los(e, p)) { ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]); }
          if (e.state === 'ARA' && e.last) { ctx.strokeRect(e.last[0] * T + 2, e.last[1] * T + 2, 12, 12); }
          ctx.globalAlpha = 1;
        }
      }
      // vuruş kızıllığı
      if (G.shake > 0) { ctx.fillStyle = `rgba(255,40,60,${G.shake * 0.6})`; ctx.fillRect(0, 0, VW, VH); }
      ctx.restore();
    },
  };
})();
