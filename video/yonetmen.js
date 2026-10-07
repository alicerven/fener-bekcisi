/* Tanıtım videosu yönetmeni (index.html?kayit=1 ile yüklenir).
   Oyun gerçek zamanlı değil, __kayit.frame() her çağrıldığında 1/25 sn ilerler; dışarıdaki betik her kareden sonra
   ekran görüntüsü alır. Sesler __fb.audioLog'a zaman damgasıyla yazılır ve sonradan ffmpeg ile karıştırılır. */
(() => {
  'use strict';
  const f = window.__fb, G = f.G, W = FB.World;
  const FPS = 25, DT = 1 / FPS;

  /* ---------- altyazı + kartlar ---------- */
  const css = document.createElement('style');
  css.textContent = `
    #kcap{position:absolute;left:640px;top:44px;transform:translateX(-50%);z-index:60;max-width:1100px;text-align:center;
      background:#05070fe6;border:1px solid #ffd84d77;color:#fff;font:600 24px "Trebuchet MS",system-ui,sans-serif;
      padding:9px 22px;border-radius:12px;box-shadow:0 8px 30px #000a;white-space:nowrap}
    #kcap:empty{display:none}
    #kcap b{color:#ffd84d}
    #kcap .ab{background:#3fb950;color:#04140a;font:800 15px system-ui;padding:3px 9px;border-radius:6px;letter-spacing:.08em;margin-right:12px;vertical-align:3px}
    #kbadge{position:absolute;left:84px;top:44px;z-index:60;background:#3fb950;color:#04140a;font:800 18px system-ui;padding:6px 12px;border-radius:8px;letter-spacing:.08em}
    #kcard{position:absolute;left:0;top:0;width:1280px;height:720px;z-index:70;background:#05070f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
      color:#f3ead8;font-family:"Trebuchet MS",system-ui,sans-serif;text-align:center}
    #kcard[hidden]{display:none}
    #kcard .s{font-size:28px;color:#9aa7b6}
    #kcard .b{font:700 64px Georgia,serif;color:#ffe7a8;text-shadow:0 0 30px #ffb84d66}
    #kcard .a{font-size:30px;color:#58a6ff;font-weight:700}
    #kcard .p{margin-top:10px;background:#58a6ff;color:#04111f;font-weight:800;font-size:26px;padding:10px 28px;border-radius:40px}
    #kcard .m{font-size:20px;color:#6f7891}`;
  document.head.appendChild(css);
  const cap = document.createElement('div'); cap.id = 'kcap'; document.body.appendChild(cap);
  const badge = document.createElement('div'); badge.id = 'kbadge'; badge.textContent = 'AFTER'; badge.hidden = true; document.body.appendChild(badge);
  const card = document.createElement('div'); card.id = 'kcard'; card.hidden = true; document.body.appendChild(card);
  const CARDS = {
    title: `<div class="s">A few hours ago, this was a tiny demo…</div><div class="b">Then I asked exo to turn it<br>into a real game.</div><div class="a">The Lighthouse Keeper · Fener Bekçisi</div>`,
    outro: `<div class="b">Play it in your browser</div><div class="s">Pixel art · TR / EN voices · enemy AI · mobile controls</div><div class="p">Built with exo · free on OpenCode</div><div class="m">Link in the post 👇 · Art: Kenney (CC0) · Voices: AI-generated (EMA Lightning, Kokoro)</div>`,
    black: '',
  };
  const showCard = (k) => { if (!k) { card.hidden = true; return; } card.innerHTML = CARDS[k]; card.hidden = false; };
  // "AFTER" etiketi altyazının içinde: ayrı konumlandırınca oyunun HUD'unun üstüne biniyordu
  const say = (html) => { cap.innerHTML = html ? `<span class="ab">AFTER</span>${html}` : ''; };

  /* ---------- otomatik pilot ---------- */
  const auto = { targets: [] };
  function autopilot() {
    const I = f.I; I.keys.clear();
    if (G.dialog || !auto.targets.length) return;
    const tgt = auto.targets[0], p = G.player, [px, py] = W.tileOf(p), c = W.C(...tgt);
    if (px === tgt[0] && py === tgt[1] && Math.hypot(c.x - p.x, c.y - p.y) < 3) { auto.targets.shift(); return; }
    const path = px === tgt[0] && py === tgt[1] ? [tgt] : W.bfs(px, py, tgt[0], tgt[1]);
    if (!path.length) return;
    const n = W.C(...path[0]), dx = n.x - p.x, dy = n.y - p.y;
    if (dx > 1.5) I.keys.add('d'); else if (dx < -1.5) I.keys.add('a');
    if (dy > 1.5) I.keys.add('s'); else if (dy < -1.5) I.keys.add('w');
  }
  const act = () => f.I.emit('action');
  const actN = (n) => { for (let i = 0; i < n; i++) act(); };
  const arrived = () => auto.targets.length === 0;

  // Gölge-1'in devriye hattına (satır 6) görüş mesafesinde yaklaşıp mercek parçasına kaçan rota (kuru çalıştırmayla seçildi)
  // sonuç: ~8 sn kovalamaca, can kaybı yok, 18. sn'de parça alınır, 25. sn'de Nuri İngilizce konuşur
  const ROUTE = [[9, 4], [10, 2]];

  /* ---------- zaman çizelgesi (saniye) ---------- */
  const EV = [
    [0.0, () => { f.setLang('tr'); f.setAI(false); f.toMenu(); say('Pixel art · a story · <b>two languages</b> · fully voiced'); }],
    [3.6, () => { f.start(); say('Talk to Nuri, the old lighthouse keeper'); }],
    [4.3, () => actN(2)],               // giriş 1 → 2
    [5.0, () => { actN(2); auto.targets = [[2, 2]]; }], // giriş kapanır, Nuri'ye yürü
    ['talk', () => arrived() && !G.dialog && G.stage === 0, () => { act(); say('In the dark, you only see the Shadows\' <b>eyes</b> 👀'); }],
    [10.2, () => actN(4)],              // n0_1 → n0_2 → n0_3 ("Ama dikkat et…")
    // n0_3 tamamen yazılmış durumda: 5 basış = n0_4'e geç, tamamla, n0_5'e geç, tamamla, kapat (6. basış Nuri ile yeniden konuşturur)
    [15.4, () => { actN(5); f.setAI(true); say('Press <b>V</b>: watch the enemy AI think · FSM + line of sight + BFS'); auto.targets = (window.__route || ROUTE).map((p) => p.slice()); }],
    [22.6, () => { f.setLang('en'); say('Switch to <b>English</b> anytime · English voices by Kokoro (88 MB, offline)'); auto.targets = [[2, 2]]; }],
    ['talk2', () => t > 22.7 && G.stage >= 1 && arrived() && !G.dialog && G.nearNuri(), () => act()],
    [30.0, () => { showCard('black'); }],
    [30.3, () => {
      showCard(null); f.setAI(false); if (G.dialog) { G.dialog = null; }
      G.items.forEach((s) => { s.taken = true; }); G.got = 3; G.stage = 3; auto.targets = [];
      Object.assign(G.player, W.C(22, 2)); f.I.keys.clear();
      say('…find all three lens shards, and <b>light the lighthouse</b>');
    }],
    [30.9, () => act()],                // fener: l1
    [34.3, () => actN(2)],              // l2
    [38.0, () => {}],
  ];
  const TOTAL = 38.0;
  const done = new Set();
  let t = 0, t0 = f.simTime;

  window.__kayit = {
    FPS, TOTAL,
    showCard,
    reset() { done.clear(); t = 0; t0 = f.simTime; f.audioLog.length = 0; showCard(null); say(''); },
    frame() {
      for (let i = 0; i < EV.length; i++) {
        if (done.has(i)) continue;
        const e = EV[i];
        if (typeof e[0] === 'number' ? t >= e[0] : e[1]()) { done.add(i); (typeof e[0] === 'number' ? e[1] : e[2])(); }
      }
      autopilot();
      f.step(DT);
      t += DT;
      return t;
    },
    get t() { return t; },
    log() { return f.audioLog.map((a) => ({ ...a, t: +(a.t - t0).toFixed(3) })); },
  };
})();
