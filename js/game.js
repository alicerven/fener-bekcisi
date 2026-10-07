/* Oyun mantığı: oyuncu, Gölgeler (FSM), görevler, diyalog, kazanma/kaybetme.
   Arayüzle konuşmak için FB.Game.on(olay, fonksiyon) kullanılır: 'dialog', 'toast', 'end', 'hit'. */
window.FB = window.FB || {};
(() => {
  'use strict';
  const W = FB.World, L = FB.LEVEL, T = FB.T;
  // ayarlar (piksel/sn, 16 px karo ölçeğinde)
  const SPEED = { player: 80, patrol: 35, chase: 62, search: 43, back: 37 };
  const VISION = 80, TALK = 22, PICK = 10, LOST_AFTER = 0.6, GIVE_UP = 160, SEARCH_TIME = 2;

  const listeners = {};
  const emit = (ev, data) => (listeners[ev] || []).forEach((f) => f(data));

  const G = {
    on(ev, f) { (listeners[ev] = listeners[ev] || []).push(f); },
    stage: 0, got: 0, hearts: 3, dialog: null, over: false, won: false, wonT: 0, inv: 0, shake: 0, time: 0,
    player: null, nuri: null, lighthouse: null, shards: [], enemies: [],
  };

  G.reset = () => {
    G.player = { ...W.C(...L.player), r: 5, face: 1, moving: false, walkT: 0 };
    G.nuri = W.C(...L.nuri);
    G.lighthouse = W.C(...L.lighthouse);
    G.shards = L.shards.map((s, i) => ({ ...W.C(...s), taken: false, phase: i * 1.7 }));
    G.enemies = L.enemies.map((wps, i) => ({ ...W.C(...wps[0]), r: 5, wps, wi: 1, state: 'DEVRIYE', path: null, key: '', repath: 0, last: null, lost: 0, timer: 0, look: 0, id: i + 1, face: 1, alpha: 1 }));
    Object.assign(G, { stage: 0, got: 0, hearts: 3, dialog: null, over: false, won: false, wonT: 0, inv: 0, shake: 0, time: 0 });
    G.say(['intro1', 'intro2']);
  };

  /* ---------- diyalog ---------- */
  G.say = (keys, done) => { G.dialog = { keys, i: 0, done }; emit('dialog', G.dialog); };
  G.advance = () => {
    const d = G.dialog; if (!d) return;
    d.i++;
    if (d.i >= d.keys.length) { G.dialog = null; emit('dialog', null); d.done && d.done(); }
    else emit('dialog', d);
  };

  /* ---------- etkileşim ---------- */
  G.nearNuri = () => W.dist(G.player, G.nuri) < TALK;
  G.nearLighthouse = () => W.dist(G.player, G.lighthouse) < TALK;
  G.interact = () => {
    if (G.dialog) { G.advance(); return; }
    if (G.over) return;
    if (G.nearNuri()) {
      if (G.stage === 0) G.say(['n0_1', 'n0_2', 'n0_3', 'n0_4', 'n0_5'], () => { G.stage = G.got >= 3 ? 2 : 1; });
      else if (G.stage === 1) G.say(['n1_' + (3 - G.got)]);
      else if (G.stage === 2) G.say(['n2_1', 'n2_2', 'n2_3'], () => { G.stage = 3; });
      else G.say(['n3']);
    } else if (G.nearLighthouse()) {
      if (G.stage === 3) { G.stage = 4; G.won = true; G.wonT = 0; G.say(['l1', 'l2', 'l3'], () => { G.over = true; emit('end', 'won'); }); }
      else G.say(['kilit']);
    }
  };

  /* ---------- Gölge FSM ---------- */
  function goTo(e, tx, ty, sp, dt) {
    e.repath -= dt; const key = tx + ',' + ty;
    if (e.repath <= 0 || !e.path || e.key !== key) { const [cx, cy] = W.tileOf(e); e.path = W.bfs(cx, cy, tx, ty); e.key = key; e.repath = 0.3; }
    const tgt = e.path.length ? W.C(...e.path[0]) : W.C(tx, ty);
    const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy);
    if (d < 1.5) { if (e.path.length) { e.path.shift(); return false; } return true; }
    const s = Math.min(d, sp * dt); W.move(e, dx / d * s, dy / d * s); if (Math.abs(dx) > 0.5) e.face = dx > 0 ? 1 : -1;
    return false;
  }
  function updateEnemy(e, dt) {
    const p = G.player, d = W.dist(e, p), sees = d < VISION && W.los(e, p);
    const chase = () => { e.state = 'KOVALA'; e.lost = 0; e.last = W.tileOf(p); };
    switch (e.state) {
      case 'DEVRIYE': { const w = e.wps[e.wi]; if (goTo(e, w[0], w[1], SPEED.patrol, dt)) e.wi = (e.wi + 1) % e.wps.length; if (sees) chase(); break; }
      case 'KOVALA': {
        if (sees) { e.last = W.tileOf(p); e.lost = 0; } else e.lost += dt;
        if (sees && d < T * 1.3) { const s = SPEED.chase * dt; W.move(e, (p.x - e.x) / d * s, (p.y - e.y) / d * s); e.face = p.x > e.x ? 1 : -1; }
        else goTo(e, e.last[0], e.last[1], SPEED.chase, dt);
        if (e.lost > LOST_AFTER || d > GIVE_UP) { e.state = 'ARA'; e.timer = 0; }
        break;
      }
      case 'ARA': {
        if (goTo(e, e.last[0], e.last[1], SPEED.search, dt)) { e.timer += dt; e.look += dt * 4; e.face = Math.sin(e.look) > 0 ? 1 : -1; }
        if (sees) chase();
        else if (e.timer > SEARCH_TIME) { e.state = 'DON'; let bi = 0, bd = 1e9; e.wps.forEach((w, i) => { const dd = W.dist(e, W.C(...w)); if (dd < bd) { bd = dd; bi = i; } }); e.wi = bi; }
        break;
      }
      case 'DON': { const w = e.wps[e.wi]; if (goTo(e, w[0], w[1], SPEED.back, dt)) { e.state = 'DEVRIYE'; e.wi = (e.wi + 1) % e.wps.length; } if (sees) chase(); break; }
    }
  }

  /* ---------- güncelleme ---------- */
  G.update = (dt) => {
    G.time += dt;
    if (G.shake > 0) G.shake -= dt;
    if (G.won) { G.wonT += dt; G.enemies.forEach((e) => { e.alpha = Math.max(0, e.alpha - dt * 0.7); }); }
    if (G.dialog || G.over) { G.player.moving = false; return; }
    // oyuncu
    const p = G.player, inp = FB.Input.dir();
    p.moving = !!(inp.x || inp.y);
    if (p.moving) { W.move(p, inp.x * SPEED.player * dt, inp.y * SPEED.player * dt); p.walkT += dt; if (Math.abs(inp.x) > 0.2) p.face = inp.x > 0 ? 1 : -1; }
    if (G.inv > 0) G.inv -= dt;
    // mercek parçaları
    for (const s of G.shards) if (!s.taken && W.dist(p, s) < PICK) {
      s.taken = true; G.got++;
      if (G.got === 3 && G.stage === 1) { G.stage = 2; emit('toast', 'hepsi'); } else emit('toast', 'parca');
    }
    if (G.won) return;
    // Gölgeler
    for (const e of G.enemies) {
      updateEnemy(e, dt);
      if (W.dist(e, p) < e.r + p.r && G.inv <= 0) {
        G.hearts--; G.inv = 1.5; G.shake = 0.35; emit('hit');
        if (G.hearts <= 0) { G.say(['kayip1', 'kayip2'], () => { G.over = true; emit('end', 'lost'); }); }
        else {
          Object.assign(p, W.C(...L.player)); emit('toast', 'vurus');
          G.enemies.forEach((en) => { if (en.state === 'KOVALA' || en.state === 'ARA') { en.state = 'DON'; en.wi = 0; } });
        }
      }
    }
  };

  FB.Game = G;
})();
