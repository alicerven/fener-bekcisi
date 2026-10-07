# Fener Bekçisi · The Lighthouse Keeper

A small story-driven stealth game for the browser. The town's lighthouse has gone dark, Shadows roam the streets, and you have to find the three shards of the shattered lens to bring the light back.

**▶ Play:** https://alicerven.github.io/fener-bekcisi/

Built step by step with **exo**, the free stealth model on [OpenCode](https://opencode.ai). This started as a minimal demo in [exo-skill-test](https://github.com/alicerven/exo-skill-test) and is being turned into a real game.

## The idea: the game evolves with the light
The darkness didn't just put out the lighthouse; it drained the world's color and depth. **Every light you bring back gives the world a new dimension**, so each chapter is a visible step up in technology:

| Chapter | World | Tech level |
|---|---|---|
| 1 · The Lighthouse | one screen | 16 px pixel art, simple round lights |
| 2 · The Harbor | 4× larger, scrolling camera | **real-time 2D shadows** (visibility polygons per light), rain with splashes and ripples, fog, light reflections shimmering on the water, depth shadows, wet cobblestones |
| 3 · The Town *(planned)* | connected areas | 2.5D: height and parallax layers |
| 4 · The Top of the Lighthouse *(planned)* | open | full 3D, a WebGL engine written from scratch |

When you finish a chapter, the old world shrinks into light and the new, larger one unfolds.

## Features
- **Darkness & light:** a flickering lantern around the player, warm window lights, glowing lens shards. When the lighthouse is lit, a rotating beam sweeps the town.
- **Enemy AI:** a finite state machine per Shadow (patrol → chase → search → return), line of sight, BFS pathfinding. In the dark you only see their eyes. Press **V** for the AI view: vision radius, paths and live states.
- **Fair play:** a few seconds of shield at the start and after every respawn. When Nuri gives you the quest, he blazes his lantern once and the Shadows flee. If you get caught, the Shadow calls the others to that spot while you slip back to the start; then they scatter back to their patrols.
- **Two chapters:**
  - *Chapter 1 · The Lighthouse*: find the three lens shards and relight the lighthouse.
  - *Chapter 2 · The Harbor*: recover the stolen oil lamps and light the harbor beacon. New mechanic: **street lamps**. Light them and the Shadows can't step into their glow or see you under them, so you build your own safe paths.
- **Story & quests:** fully voiced dialogue in **Turkish and English**, quest chain, typewriter text, chapter progress saved.
- **Music & sound effects synthesized in code** (Web Audio, no audio files): sea ambience, a soft pad and arpeggio, a heartbeat layer while you're being chased, a brighter key when the light returns; footsteps, pickups, alerts, hits. Music ducks under the voice lines.
- **Two languages:** TR / EN for both UI and voice, switchable anytime.
- **Plays everywhere:** keyboard, or touch with a virtual joystick on phones and tablets. Holding the phone upright shows a "turn sideways" screen and pauses the game; fullscreen + landscape lock where the browser allows it.
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
js/data.js     chapters: maps, entities, patrol routes, street lamps, dialogue keys
js/engine.js   sprites, procedural pixel art (lighthouse, lens shard, oil lamp, street lamp, pier, tinted ghosts), voice playback, input, collision, BFS
js/synth.js    procedural music + sound effects (Web Audio)
js/game.js     game logic: quests, enemy FSM, win/lose
js/render.js   world canvas + camera, tiles, animated sea, lighting & 2D shadows, rain/fog/reflections, AI view
js/main.js     UI, menus, dialogue, main loop
audio/tr, audio/en   voice clips
tools/harita2.py     generates & validates the chapter 2 map
tools/ses_tr.py      generates missing Turkish voices (EMA Lightning)
tools/ses_en.py      generates missing English voices (Kokoro)
```

## Credits
- **Art:** [Kenney](https://kenney.nl): Tiny Town & Tiny Dungeon (CC0). The lighthouse, lens shards and sea are hand-coded pixel art.
- **Voices (AI-generated, offline):** Turkish by [EMA Lightning](https://huggingface.co/canberkkkkkk/ema-lightning); English by [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0).

## License
Code: MIT. Kenney assets: CC0 (see `assets/LICENSE-kenney.txt`).
