/* Oyun mantığı: bölümler, oyuncu, Gölgeler (FSM), görevler, sokak lambaları, diyalog, kazanma/kaybetme.
   Arayüzle konuşmak için FB.Game.on(olay, fonksiyon): 'dialog', 'toast', 'end', 'hit', 'level'. */
window.FB = window.FB || {};
(() => {
  'use strict';
  const W = FB.World, T = FB.T;
  // ayarlar (piksel/sn, 16 px karo ölçeğinde)
  const SPEED = { player: 80, patrol: 35, chase: 62, search: 43, back: 37 };
  const VISION = 80, TALK = 22, PICK = 10, LAMP_REACH = 20, LOST_AFTER = 0.6, GIVE_UP = 160, SEARCH_TIME = 2;
  // koruma (sn): bölüm başında ve her yeniden doğuşta Gölgeler oyuncuyu göremez/dokunamaz
  const PROTECT = 4, FLEE_TIME = 8, GATHER_TIME = 2.5, FLARE_KEY = 'alev_anlatici';
  const sfx = (n) => FB.Synth && FB.Synth.sfx[n]();

  const listeners = {};
  const emit = (ev, data) => (listeners[ev] || []).forEach((f) => f(data));

  const G = {
    on(ev, f) { (listeners[ev] = listeners[ev] || []).push(f); },
    levelIndex: 0, L: FB.LEVELS[0],
    stage: 0, got: 0, hearts: 3, dialog: null, over: false, won: false, wonT: 0, inv: 0, shake: 0, time: 0,
    protect: 0, fleeT: 0, gatherT: 0, flareFx: 0, flareUsed: false,
    player: null, nuri: null, lighthouse: null, items: [], enemies: [], lamps: [], stepT: 0,
    get hasNext() { return G.levelIndex < FB.LEVELS.length - 1; },
  };

  G.reset = (levelIndex = G.levelIndex) => {
    G.levelIndex = levelIndex; const L = G.L = FB.LEVELS[levelIndex];
    W.setLevel(L);
    G.player = { ...W.C(...L.player), r: 5, face: 1, moving: false, walkT: 0 };
    G.nuri = W.C(...L.nuri);
    G.lighthouse = W.C(...L.lighthouse);
    G.items = L.items.map((s, i) => ({ ...W.C(...s), taken: false, phase: i * 1.7 }));
    G.lamps = L.lamps.map(([cx, cy], i) => ({ ...W.C(cx, cy), cx, cy, lit: (L.litAtStart || []).includes(i) }));
    W.setLights(G.lamps);
    G.enemies = L.enemies.map((wps, i) => ({ ...W.C(...wps[0]), r: 5, enemy: true, wps, wi: 1, state: 'DEVRIYE', path: null, key: '', repath: 0, last: null, lost: 0, timer: 0, look: 0, id: i + 1, face: 1, alpha: 1 }));
    Object.assign(G, { stage: 0, got: 0, hearts: 3, dialog: null, over: false, won: false, wonT: 0, inv: 0, shake: 0, time: 0, stepT: 0,
      protect: PROTECT, fleeT: 0, gatherT: 0, flareFx: 0, flareUsed: false });
    if (FB.Synth) { FB.Synth.setMood('calm'); FB.Synth.setChase(false); }
    emit('level', G.L);
    G.say(L.lines.intro);
  };

  /* ---------- diyalog ---------- */
  G.say = (keys, done) => { G.dialog = { keys, i: 0, done }; onLine(keys[0]); emit('dialog', G.dialog); };
  G.advance = () => {
    const d = G.dialog; if (!d) return;
    d.i++; sfx('click');
    if (d.i >= d.keys.length) { G.dialog = null; emit('dialog', null); d.done && d.done(); }
    else { onLine(d.keys[d.i]); emit('dialog', d); }
  };
  // Nuri'nin alevi: yalnızca bir kez, ilk konuşmada. Gölgeler oyuncudan uzak noktalara kaçar.
  function onLine(key) { if (key === FLARE_KEY && !G.flareUsed) flare(); }
  function flare() {
    G.flareUsed = true; G.flareFx = 1.6; G.fleeT = FLEE_TIME; sfx('lamp'); sfx('win');
    const p = G.player, [px, py] = W.tileOf(p), taken = [];
    for (const e of G.enemies) {
      const [ex, ey] = W.tileOf(e), field = W.bfsField(ex, ey, W.enemyWall);
      let best = null, bs = -1e9;
      for (let i = 0; i < field.length; i++) {
        if (field[i] < 0) continue;
        const x = i % W.COLS, y = (i / W.COLS) | 0;
        const away = Math.hypot(x - px, y - py), spread = Math.min(...taken.map(([tx, ty]) => Math.hypot(x - tx, y - ty)), 6);
        const sc = away * 1.0 - field[i] * 0.25 + spread * 0.5; // uzak, yakın ulaşılabilir, diğerlerinden ayrık
        if (sc > bs) { bs = sc; best = [x, y]; }
      }
      e.state = 'KAC'; e.flee = best || [ex, ey]; e.path = null; taken.push(e.flee);
    }
  }
  // yakalanınca: yakalayan Gölge diğerlerini o noktaya çağırır; oyuncu korumalı olarak başlangıçta yeniden doğar
  function caught(at) {
    G.gatherT = GATHER_TIME; G.fleeT = 0;
    for (const e of G.enemies) { e.state = 'TOPLAN'; e.last = at; e.path = null; }
    Object.assign(G.player, W.C(...G.L.player)); G.protect = PROTECT;
  }

  /* ---------- etkileşim ---------- */
  G.nearNuri = () => W.dist(G.player, G.nuri) < TALK;
  G.nearLighthouse = () => W.dist(G.player, G.lighthouse) < TALK;
  G.nearLamp = () => G.lamps.find((l) => !l.lit && W.dist(G.player, l) < LAMP_REACH) || null;
  G.inLight = (o) => G.lamps.some((l) => l.lit && Math.abs(Math.floor(o.x / T) - l.cx) <= 1 && Math.abs(Math.floor(o.y / T) - l.cy) <= 1);
  G.interact = () => {
    if (G.dialog) { G.advance(); return; }
    if (G.over) return;
    const ln = G.L.lines;
    if (G.nearNuri()) {
      if (G.stage === 0) G.say(ln.n0, () => { G.stage = G.got >= 3 ? 2 : 1; });
      else if (G.stage === 1) G.say([ln.n1(G.got)]);
      else if (G.stage === 2) G.say(ln.n2, () => { G.stage = 3; });
      else G.say([ln.n3]);
      return;
    }
    const lamp = G.nearLamp();
    if (lamp) { lamp.lit = true; W.setLights(G.lamps); sfx('lamp'); emit('toast', ln.lamp); return; }
    if (G.nearLighthouse()) {
      if (G.stage === 3) {
        G.stage = 4; G.won = true; G.wonT = 0; sfx('win');
        if (FB.Synth) { FB.Synth.setMood('bright'); FB.Synth.setChase(false); }
        G.say(ln.lit, () => { G.over = true; emit('end', 'won'); });
      } else G.say([ln.locked]);
    }
  };

  /* ---------- Gölge FSM ---------- */
  function goTo(e, tx, ty, sp, dt) {
    e.repath -= dt; const key = tx + ',' + ty;
    if (e.repath <= 0 || !e.path || e.key !== key) { const [cx, cy] = W.tileOf(e); e.path = W.bfs(cx, cy, tx, ty, W.enemyWall); e.key = key; e.repath = 0.3; }
    // hedef ışıklı bölgedeyse oraya ulaşılamaz: "vardım" say (arama/dönüş takılmasın)
    if (!e.path.length && W.isForbidden(tx, ty)) return true;
    const tgt = e.path.length ? W.C(...e.path[0]) : W.C(tx, ty);
    const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy);
    if (d < 1.5) { if (e.path.length) { e.path.shift(); return false; } return true; }
    const s = Math.min(d, sp * dt); W.move(e, dx / d * s, dy / d * s); if (Math.abs(dx) > 0.5) e.face = dx > 0 ? 1 : -1;
    return false;
  }
  function nearestWp(e) { let bi = 0, bd = 1e9; e.wps.forEach((w, i) => { const dd = W.dist(e, W.C(...w)); if (dd < bd) { bd = dd; bi = i; } }); e.wi = bi; e.path = null; }
  function updateEnemy(e, dt) {
    const p = G.player, d = W.dist(e, p);
    // ışığın altındaki oyuncu görünmez
    const sees = G.protect <= 0 && e.state !== 'KAC' && e.state !== 'TOPLAN' && d < VISION && !G.inLight(p) && W.los(e, p);
    const chase = () => { if (e.state !== 'KOVALA') sfx('alert'); e.state = 'KOVALA'; e.lost = 0; e.last = W.tileOf(p); };
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
      case 'KAC': { goTo(e, e.flee[0], e.flee[1], SPEED.chase, dt); if (G.fleeT <= 0 && !G.dialog) { e.state = 'DON'; nearestWp(e); } break; }
      case 'TOPLAN': { goTo(e, e.last[0], e.last[1], SPEED.chase, dt); if (G.gatherT <= 0) { e.state = 'DON'; nearestWp(e); } break; }
      case 'DON': { const w = e.wps[e.wi]; if (goTo(e, w[0], w[1], SPEED.back, dt)) { e.state = 'DEVRIYE'; e.wi = (e.wi + 1) % e.wps.length; } if (sees) chase(); break; }
    }
    // devriye noktası ışığa kaldıysa ulaşılamaz: sıradaki noktaya geç
    if (e.state === 'DEVRIYE' && W.isForbidden(...e.wps[e.wi]) && !W.bfs(...W.tileOf(e), ...e.wps[e.wi], W.enemyWall).length) e.wi = (e.wi + 1) % e.wps.length;
  }

  /* ---------- güncelleme ---------- */
  G.update = (dt) => {
    G.time += dt;
    if (G.shake > 0) G.shake -= dt;
    if (G.won) { G.wonT += dt; G.enemies.forEach((e) => { e.alpha = Math.max(0, e.alpha - dt * 0.7); }); }
    if (G.flareFx > 0) G.flareFx -= dt;
    if (G.dialog || G.over) {
      G.player.moving = false;
      // Nuri konuşurken kaçan Gölgeler uzaklaşmaya devam etsin (oyuncu donuk, onlar hareketli)
      if (G.dialog && !G.over) for (const e of G.enemies) if (e.state === 'KAC') updateEnemy(e, dt);
      return;
    }
    if (G.protect > 0) G.protect -= dt;
    if (G.fleeT > 0) G.fleeT -= dt;
    if (G.gatherT > 0) G.gatherT -= dt;
    // oyuncu
    const p = G.player, inp = FB.Input.dir();
    p.moving = !!(inp.x || inp.y);
    if (p.moving) {
      W.move(p, inp.x * SPEED.player * dt, inp.y * SPEED.player * dt); p.walkT += dt; if (Math.abs(inp.x) > 0.2) p.face = inp.x > 0 ? 1 : -1;
      G.stepT -= dt; if (G.stepT <= 0) { sfx('step'); G.stepT = 0.28; }
    }
    if (G.inv > 0) G.inv -= dt;
    // toplanan nesneler
    const ln = G.L.lines;
    for (const s of G.items) if (!s.taken && W.dist(p, s) < PICK) {
      s.taken = true; G.got++; sfx('pickup');
      if (G.got === 3 && G.stage === 1) { G.stage = 2; emit('toast', ln.all); } else emit('toast', ln.pickup);
    }
    if (G.won) return;
    // Gölgeler
    for (const e of G.enemies) {
      updateEnemy(e, dt);
      if (W.dist(e, p) < e.r + p.r && G.inv <= 0 && G.protect <= 0 && e.state !== 'KAC' && e.state !== 'TOPLAN') {
        G.hearts--; G.inv = 0.6; G.shake = 0.35; sfx('hit'); emit('hit');
        if (G.hearts <= 0) { sfx('lose'); G.say(['kayip1', 'kayip2'], () => { G.over = true; emit('end', 'lost'); }); }
        else { caught(W.tileOf(p)); emit('toast', 'yakalandin'); }
        break;
      }
    }
    if (FB.Synth) FB.Synth.setChase(G.enemies.some((e) => e.state === 'KOVALA'));
  };

  FB.Game = G;
})();
