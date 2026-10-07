# Fener Bekçisi · The Lighthouse Keeper

A small story-driven stealth game for the browser. The town's lighthouse has gone dark, Shadows roam the streets, and you have to find the three shards of the shattered lens to bring the light back.

**▶ Play:** https://alicerven.github.io/fener-bekcisi/

Built step by step with **exo**, the free stealth model on [OpenCode](https://opencode.ai). This started as a minimal demo in [exo-skill-test](https://github.com/alicerven/exo-skill-test) and is being turned into a real game.

## Features
- **Darkness & light:** a flickering lantern around the player, warm window lights, glowing lens shards. When the lighthouse is lit, a rotating beam sweeps the town.
- **Enemy AI:** a finite state machine per Shadow (patrol → chase → search → return), line of sight, BFS pathfinding. In the dark you only see their eyes. Press **V** for the AI view: vision radius, paths and live states.
- **Story & quests:** fully voiced dialogue in **Turkish and English**, quest chain, typewriter text.
- **Two languages:** TR / EN for both UI and voice, switchable anytime.
- **Plays everywhere:** keyboard, or touch with a virtual joystick on phones and tablets.
- **No build step, no libraries:** plain HTML + CSS + JavaScript.

## Controls
| | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrows | joystick (left) |
| Talk / interact | E / Space / Enter | button (right) |
| Pause | Esc / P | ❚❚ |
| AI view | V | pause menu |

## Run locally
```bash
python3 -m http.server 8000   # → http://localhost:8000
```
Opening `index.html` directly also works.

## Project layout
```
index.html, css/style.css
js/i18n.js     UI strings (TR/EN)
js/lines.js    all dialogue lines: single source for text and voice generation
js/data.js     level: map, entities, patrol routes
js/engine.js   sprites, procedural pixel art (lighthouse, lens shard, tinted ghosts), audio, input, collision, BFS
js/game.js     game logic: quests, enemy FSM, win/lose
js/render.js   tiles, animated sea, lighting, AI view
js/main.js     UI, menus, dialogue, main loop
audio/tr, audio/en   voice clips
tools/ses_en.py      regenerates English voices (Kokoro)
```

## Credits
- **Art:** [Kenney](https://kenney.nl): Tiny Town & Tiny Dungeon (CC0). The lighthouse, lens shards and sea are hand-coded pixel art.
- **Voices (AI-generated, offline):** Turkish by [EMA Lightning](https://huggingface.co/canberkkkkkk/ema-lightning); English by [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0).

## License
Code: MIT. Kenney assets: CC0 (see `assets/LICENSE-kenney.txt`).
