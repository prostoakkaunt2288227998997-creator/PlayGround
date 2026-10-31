# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/prostoakkaunt2288227998997-creator/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/prostoakkaunt2288227998997-creator/PlayGround)

- 🎮 [Open the project](https://omgithub.com/prostoakkaunt2288227998997-creator/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=prostoakkaunt2288227998997-creator%2FPlayGround).
- 💻 [Explore the source](https://github.com/prostoakkaunt2288227998997-creator/PlayGround).
- 🛠️ [Check build runs](https://github.com/prostoakkaunt2288227998997-creator/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/prostoakkaunt2288227998997-creator/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/prostoakkaunt2288227998997-creator).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->

# Geometry Dash — Neon Edition

A complete, dependency-free Geometry Dash–style rhythm platformer for the browser. Five handcrafted levels, ten cube skins and ten achievements — all rendered on a neon canvas with procedurally generated music and sound effects.

## Play

The game is a static site. From this directory, serve it over HTTP (ES modules do not run from `file://`):

```bash
python3 -m http.server 3000
```

Then open <http://localhost:3000>. Any static file server works; no build step or package install is required.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Jump | `Space`, `W`, `↑` or click | Tap anywhere |
| Auto-jump | Hold the jump input | Hold a finger down |
| Pause / resume | `Esc` | Pause button |

The game scales to the viewport, supports portrait and landscape phones, and keeps the playfield inside safe-area insets.

## Features

- **5 levels** — Stereo Dawn, Neon Rush, Circuit Breaker, Gravity Well and Final Overdrive. Each has its own palette, soundtrack tempo and obstacle pattern.
- **Hazards and gadgets** — spikes, blocks, saw blades, jump pads, jump orbs, gravity portals, speed portals and a finish gate.
- **10 cube skins** — unlockable through level clears, shard collection, jumps, deaths and total completion. The selected cube is rendered in-game and in the wardrobe preview.
- **10 achievements** — progression, skill, collection and persistence milestones, with toast notifications.
- **15 shards** — three optional collectibles per level, tracked per save.
- **Per-level stats** — best percentage, attempts, completed flag and collected shards persist in `localStorage`.
- **Procedural audio** — WebAudio synthesizes the music and all jump, shard, portal, death and victory sounds. No audio files to download.
- **Instant retry** — death triggers a short explosion and automatically restarts the attempt.
- **Responsive UI** — menus, level select, wardrobe, achievements, pause screen and results overlay all adapt to desktop and mobile.

## Project layout

```text
index.html          App shell, screens, HUD and overlays
styles.css          Neon design system and responsive layouts
js/main.js          Game loop, rendering, input, UI and save logic
js/engine.js        Physics, collision and player state
js/levels.js        Level definitions, object builders and themes
js/data.js          Cube, achievement and stat definitions
js/skins.js         Canvas cube rendering and previews
js/audio.js         Procedural WebAudio music and SFX
favicon.svg         Neon app icon
tools/simulate.mjs  Headless bot that verifies every level is beatable
```

## Verification

Check JavaScript syntax and run the headless level bot:

```bash
for f in js/*.js; do node --check "$f"; done
node tools/simulate.mjs
```

The simulator plays all five levels start to finish, confirms a 100% clear on each, and collects all 15 shards along the way.

## Save data

Progress is stored under the `geometry-dash-neon-v1` key in `localStorage`. Clearing site data resets levels, shards, cubes, achievements and statistics.
