import { LEVELS, DIFFICULTY_LABELS, DIFFICULTY_COLORS } from './levels.js';
import {
  CUBES, ACHIEVEMENTS, computeStats, achievementIsDone, achievementProgressLabel,
} from './data.js';
import {
  createPlayer, stepPlayer, SIZE, FLOOR_Y, CEIL_Y, DEATH_TIME,
} from './engine.js';
import { drawCube, drawCubePreview } from './skins.js';
import { AudioEngine } from './audio.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

const SAVE_KEY = 'geometry-dash-neon-v1';

// ---------------------------------------------------------------------------
// Save data
// ---------------------------------------------------------------------------
function defaultSave() {
  const levels = {};
  for (const l of LEVELS) levels[l.id] = { best: 0, completed: false, attempts: 0, shards: [] };
  return {
    v: 1,
    selectedCube: 'classic',
    levels,
    stats: { jumps: 0, deaths: 0, perfectRuns: 0, attempts: 0, time: 0 },
    achievements: [],
    unlockedCubes: ['classic'],
    settings: { muted: false },
  };
}

function loadSave() {
  const base = defaultSave();
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { /* ignore */ }
  if (!raw || typeof raw !== 'object') return base;
  base.selectedCube = typeof raw.selectedCube === 'string' ? raw.selectedCube : 'classic';
  base.achievements = Array.isArray(raw.achievements) ? raw.achievements.filter((x) => typeof x === 'string') : [];
  base.unlockedCubes = Array.isArray(raw.unlockedCubes) ? raw.unlockedCubes.filter((x) => typeof x === 'string') : ['classic'];
  if (!base.unlockedCubes.includes('classic')) base.unlockedCubes.push('classic');
  for (const l of LEVELS) {
    const incoming = raw.levels?.[l.id];
    if (!incoming) continue;
    base.levels[l.id] = {
      best: clamp(Number(incoming.best) || 0, 0, 100),
      completed: Boolean(incoming.completed),
      attempts: Math.max(0, Number(incoming.attempts) || 0),
      shards: Array.isArray(incoming.shards) ? incoming.shards.filter((x) => typeof x === 'string') : [],
    };
  }
  for (const key of ['jumps', 'deaths', 'perfectRuns', 'attempts', 'time']) {
    base.stats[key] = Math.max(0, Number(raw.stats?.[key]) || 0);
  }
  base.settings.muted = Boolean(raw.settings?.muted);
  return base;
}

const save = loadSave();
const audio = new AudioEngine(save.settings.muted);

let saveQueued = false;
function queueSave() {
  if (saveQueued) return;
  saveQueued = true;
  setTimeout(() => { saveQueued = false; writeSave(); }, 180);
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

// ---------------------------------------------------------------------------
// Canvas and view
// ---------------------------------------------------------------------------
const canvas = $('#game');
const ctx = canvas.getContext('2d', { alpha: false });
const view = { w: 0, h: 0, dpr: 1, scale: 1, logicalW: 0, logicalH: 0, offsetY: 0, floorY: 0 };

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  view.w = w;
  view.h = h;
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * view.dpr);
  canvas.height = Math.round(h * view.dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const portrait = h > w * 1.05;
  view.portrait = portrait;
  view.scale = portrait
    ? Math.min(h / 900, w / 620)
    : Math.min(h / 720, w / 940);
  view.logicalW = w / view.scale;
  view.logicalH = h / view.scale;
  if (portrait) {
    view.offsetY = (h * 0.72) / view.scale - 620;
  } else {
    view.offsetY = view.logicalH / 2 - 620 + 300;
  }
  view.floorY = FLOOR_Y + view.offsetY;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
let mode = 'menu'; // menu | playing | dead | paused | finished
let current = null;
let currentIndex = -1;
let player = createPlayer();
let runAttempts = 0;
let runShardIds = [];
let deathTimer = 0;
let finishTimer = 0;
let finishedShown = false;
let pendingPress = false;
let inputHeld = false;
let accumulator = 0;
let lastTime = performance.now() / 1000;
let worldTime = 0;
let shake = 0;
let flash = 0;
let deathFlash = 0;
let landPulse = 0;

let trail = [];
let particles = [];
let floaters = [];
let musicStarted = false;

const STEP = 1 / 120;

function getStats() { return computeStats(save); }
function selectedCube() { return CUBES.find((c) => c.id === save.selectedCube) || CUBES[0]; }
function levelSave(id) { return save.levels[id]; }

// ---------------------------------------------------------------------------
// Achievements / unlocks
// ---------------------------------------------------------------------------
let toastTimer = 0;
function toast(kind, title, sub, icon) {
  const wrap = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.innerHTML = `<span class="toast-icon">${icon}</span><div><b>${title}</b><span>${sub}</span></div>`;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => {
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 350);
  }, 3400 + (toastTimer++ % 2) * 300);
}

function evaluateProgress({ silent = false } = {}) {
  let unlockedSomething = false;
  let stats = getStats();
  for (const cube of CUBES) {
    if (!save.unlockedCubes.includes(cube.id) && cube.condition(stats)) {
      save.unlockedCubes.push(cube.id);
      unlockedSomething = true;
      if (!silent) {
        toast('cube', 'CUBE UNLOCKED', `${cube.name} — ${cube.unlock}`, '▣');
        audio.sfx('unlock');
      }
    }
  }
  stats = getStats();
  for (const a of ACHIEVEMENTS) {
    if (!save.achievements.includes(a.id) && a.progress(stats) >= a.goal) {
      save.achievements.push(a.id);
      unlockedSomething = true;
      if (!silent) {
        toast('award', 'ACHIEVEMENT', `${a.name} — ${a.desc}`, a.icon);
        audio.sfx('unlock');
      }
    }
  }
  if (!save.unlockedCubes.includes(save.selectedCube)) save.selectedCube = 'classic';
  if (unlockedSomething) {
    queueSave();
    refreshCounts();
    if ($('#screen-cubes').classList.contains('is-active')) buildCubeGrid();
    if ($('#screen-awards').classList.contains('is-active')) buildAwardGrid();
  }
  return unlockedSomething;
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------
function showScreen(name) {
  for (const s of $$('.screen')) s.classList.toggle('is-active', s.id === `screen-${name}`);
  document.body.dataset.screen = name || 'game';
  if (name === 'levels') { buildLevelGrid(); refreshCounts(); }
  if (name === 'cubes') { buildCubeGrid(); refreshCounts(); }
  if (name === 'awards') { buildAwardGrid(); refreshCounts(); }
}

function refreshCounts() {
  const stats = getStats();
  const done = save.achievements.length;
  $('#menu-levels').textContent = `${stats.levelsCompleted}/5`;
  $('#menu-shards').textContent = `${stats.shards}/15`;
  $('#menu-perfect').textContent = `${stats.perfectRuns}`;
  $('#menu-cubes').textContent = `${save.unlockedCubes.length}/10`;
  $('#menu-awards').textContent = `${done}/10`;
  $('#levels-done').textContent = `${stats.levelsCompleted}/5 COMPLETE`;
  $('#cubes-count').textContent = `${save.unlockedCubes.length}/10 UNLOCKED`;
  $('#awards-count').textContent = `${done}/10 EARNED`;
}

function drawLevelPreview(canvasEl, level) {
  const w = 520, h = 200;
  canvasEl.width = w;
  canvasEl.height = h;
  const c = canvasEl.getContext('2d');
  const theme = level.theme;
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(1, theme.skyBottom);
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);

  const sun = c.createRadialGradient(390, 88, 4, 390, 88, 92);
  sun.addColorStop(0, hexA(theme.accent, 0.5));
  sun.addColorStop(1, hexA(theme.accent, 0));
  c.fillStyle = sun;
  c.fillRect(280, 0, 230, 200);

  c.strokeStyle = hexA(theme.accent2, 0.14);
  c.lineWidth = 1;
  for (let x = 0; x < w; x += 42) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 150); c.stroke(); }
  for (let y = 20; y < 150; y += 42) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }

  // Decorative ridge.
  c.fillStyle = hexA('#000000', 0.28);
  c.beginPath();
  c.moveTo(0, 150);
  for (let x = 0; x <= w; x += 52) {
    const y = 118 - Math.abs(Math.sin(x * 0.021)) * 48;
    c.lineTo(x, y);
  }
  c.lineTo(w, 150);
  c.closePath();
  c.fill();

  c.fillStyle = theme.floor;
  c.fillRect(0, 150, w, 50);
  c.fillStyle = theme.floorLine;
  c.fillRect(0, 149, w, 3);
  c.globalAlpha = 0.5;
  c.fillStyle = theme.accent;
  for (let x = -40; x < w + 40; x += 60) {
    c.save();
    c.translate(x, 168);
    c.rotate(-0.5);
    c.fillRect(0, 0, 3, 70);
    c.restore();
  }
  c.globalAlpha = 1;

  // Spikes + block.
  drawPreviewSpikes(c, 258, 150, theme);
  drawPreviewSpikes(c, 302, 150, theme);
  c.fillStyle = theme.block;
  c.strokeStyle = theme.blockEdge;
  c.lineWidth = 2.5;
  roundRect(c, 366, 106, 44, 44, 6);
  c.fill();
  c.stroke();
  c.fillStyle = hexA(theme.accent2, 0.2);
  c.fillRect(373, 113, 30, 30);

  drawCube(c, 150, 127, 44, selectedCube(), 0, -0.06, { glowScale: 0.5 });
}

function drawPreviewSpikes(c, x, base, theme) {
  const g = c.createLinearGradient(0, base - 38, 0, base);
  g.addColorStop(0, theme.spike);
  g.addColorStop(1, theme.floor);
  c.fillStyle = g;
  c.strokeStyle = theme.spike;
  c.lineWidth = 2;
  c.shadowColor = theme.spike;
  c.shadowBlur = 9;
  for (let i = 0; i < 2; i++) {
    const sx = x + i * 32;
    c.beginPath();
    c.moveTo(sx, base);
    c.lineTo(sx + 16, base - 38);
    c.lineTo(sx + 32, base);
    c.closePath();
    c.fill();
    c.stroke();
  }
  c.shadowBlur = 0;
}

function buildLevelGrid() {
  const grid = $('#level-grid');
  grid.innerHTML = '';
  const stats = getStats();
  LEVELS.forEach((level, i) => {
    const data = levelSave(level.id);
    const pct = data.completed ? 100 : Math.min(99, data.best || 0);
    const shards = data.shards.length;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `level-card${data.completed ? ' is-complete' : ''}`;
    card.dataset.level = level.id;
    card.style.setProperty('--card-accent', DIFFICULTY_COLORS[level.difficulty - 1]);
    card.innerHTML = `
      <div class="level-art">
        <canvas class="level-preview" aria-hidden="true"></canvas>
        <span class="level-index">${String(i + 1).padStart(2, '0')}</span>
        <span class="level-badge" style="--badge:${DIFFICULTY_COLORS[level.difficulty - 1]}">${DIFFICULTY_LABELS[level.difficulty - 1].toUpperCase()}</span>
        <span class="level-best">BEST ${pct}%</span>
        ${data.completed ? '<span class="level-complete">✓</span>' : ''}
      </div>
      <div class="level-body">
        <div class="level-name-row">
          <h3>${level.name}</h3>
        </div>
        <p>${level.tagline}</p>
        <div class="level-meta">
          <span>${level.speed > 430 ? '⚡' : '▶'} ${level.speed} px/s</span>
          <span class="${shards === 3 ? 'is-full' : ''}">♦ ${shards}/3</span>
          <span class="level-arrow">PLAY →</span>
        </div>
      </div>`;
    grid.appendChild(card);
    drawLevelPreview($('.level-preview', card), level);
  });
  refreshCounts();
}

function buildCubeGrid() {
  const grid = $('#cube-grid');
  grid.innerHTML = '';
  const stats = getStats();
  CUBES.forEach((cube) => {
    const unlocked = cube.condition(stats);
    const selected = save.selectedCube === cube.id;
    const card = document.createElement('button');
    card.type = 'button';
    card.dataset.cube = cube.id;
    card.className = `cube-card${unlocked ? '' : ' is-locked'}${selected ? ' is-selected' : ''}`;
    card.innerHTML = `
      <div class="cube-stage">
        <canvas aria-hidden="true"></canvas>
        ${!unlocked ? '<span class="cube-lock">LOCKED</span>' : ''}
        ${selected ? '<span class="cube-equipped">EQUIPPED</span>' : ''}
      </div>
      <h3>${unlocked ? cube.name : '???'}</h3>
      <p>${unlocked ? (selected ? 'Dashing right now' : 'Tap to equip') : cube.unlock}</p>`;
    grid.appendChild(card);
    drawCubePreview($('canvas', card), cube, 92);
    if (!unlocked) {
      const cv = $('canvas', card);
      cv.style.filter = 'grayscale(1) brightness(.55)';
      cv.style.opacity = '0.55';
    }
  });
  refreshCounts();
}

function buildAwardGrid() {
  const grid = $('#award-grid');
  grid.innerHTML = '';
  const stats = getStats();
  for (const a of ACHIEVEMENTS) {
    const done = save.achievements.includes(a.id);
    const value = Math.min(a.goal, a.progress(stats));
    const pct = clamp((value / a.goal) * 100, 0, 100);
    const article = document.createElement('article');
    article.className = `award${done ? ' is-done' : ''}`;
    article.innerHTML = `
      <div class="award-icon">${a.icon}</div>
      <div class="award-body">
        <div class="award-head">
          <h3>${a.name}</h3>
          <span>${done ? 'EARNED' : achievementProgressLabel(a, stats)}</span>
        </div>
        <p>${a.desc}</p>
        <div class="award-bar"><i style="width:${pct}%"></i></div>
      </div>
      <div class="award-mark">${done ? '✓' : ''}</div>`;
    grid.appendChild(article);
  }
  refreshCounts();
}

function equipCube(id) {
  const cube = CUBES.find((c) => c.id === id);
  if (!cube) return;
  const stats = getStats();
  if (!cube.condition(stats)) {
    audio.sfx('click');
    toast('locked', 'CUBE LOCKED', cube.unlock, '▣');
    return;
  }
  if (save.selectedCube !== id) {
    save.selectedCube = id;
    audio.sfx('click');
    queueSave();
    buildCubeGrid();
  }
}

// ---------------------------------------------------------------------------
// Level flow
// ---------------------------------------------------------------------------
function startLevel(id) {
  const idx = LEVELS.findIndex((l) => l.id === id);
  if (idx < 0) return;
  current = LEVELS[idx];
  currentIndex = idx;
  for (const s of current.shards) s.taken = false;
  runAttempts = 0;
  runShardIds = [];
  deathTimer = 0;
  finishTimer = 0;
  finishedShown = false;
  particles = [];
  floaters = [];
  trail = [];
  shake = 0;
  flash = 0;
  deathFlash = 0;

  $('#hud-level').textContent = current.name.toUpperCase();
  $('#hud').classList.remove('is-hidden');
  const hint = $('#hud-hint');
  hint.classList.remove('is-animating');
  void hint.offsetWidth;
  hint.classList.add('is-animating');
  showScreen(null);
  hideOverlay($('#overlay-result'));
  hideOverlay($('#overlay-pause'));
  spawnPlayer();
  mode = 'playing';
  audio.ensure();
  audio.playMusic(current);
  musicStarted = true;
  lastTime = performance.now() / 1000;
  accumulator = 0;
}

function spawnPlayer() {
  player = createPlayer();
  for (const s of current.shards) s.taken = false;
  runAttempts++;
  const data = levelSave(current.id);
  data.attempts = (data.attempts || 0) + 1;
  save.stats.attempts = (save.stats.attempts || 0) + 1;
  runShardIds = [];
  pendingPress = false;
  inputHeld = false;
  trail = [];
  deathTimer = 0;
  mode = 'playing';
  landPulse = 0;
  updateHUD();
  queueSave();
}

function onDeath() {
  if (mode !== 'playing') return;
  mode = 'dead';
  deathTimer = 0;
  shake = 1.15;
  deathFlash = 1;
  audio.sfx('death');
  burst(player.x + SIZE / 2, player.y + SIZE / 2, 34, selectedCube().colors, 1.15);
  save.stats.deaths++;
  const pct = Math.floor(player.progress * 100);
  const data = levelSave(current.id);
  if (pct > (data.best || 0)) {
    data.best = pct;
    if (pct > 0) floaters.push({ x: player.x, y: player.y - 40, text: `${pct}%`, color: '#fff', life: 1.2, max: 1.2 });
  }
  evaluateProgress();
  queueSave();
  updateHUD();
}

function onFinish() {
  mode = 'finished';
  finishTimer = 0;
  finishedShown = false;
  flash = 0.85;
  audio.sfx('win');
  const data = levelSave(current.id);
  const wasCompleted = Boolean(data.completed);
  data.completed = true;
  data.best = 100;
  for (const id of runShardIds) if (!data.shards.includes(id)) data.shards.push(id);
  const flawless = runAttempts === 1;
  if (flawless) save.stats.perfectRuns++;
  const allShards = current.shards.every((s) => runShardIds.includes(s.id));
  const flags = [];
  if (!wasCompleted) flags.push('FIRST CLEAR');
  if (flawless) flags.push('FLAWLESS');
  if (allShards) flags.push('ALL SHARDS');
  finishFlags = flags;
  finishWasCompleted = wasCompleted;
  finishFlawless = flawless;
  finishAllShards = allShards;

  burst(player.x + SIZE / 2, player.y + SIZE / 2, 70, selectedCube().colors, 1.7);
  burst(player.x + SIZE / 2, player.y + SIZE / 2, 30, { a: '#ffffff', b: '#ffe45e' }, 1.2);
  evaluateProgress();
  updateHUD();
  writeSave();
  setTimeout(() => audio.duckMusic(true), 900);
}

let finishFlags = [];
let finishWasCompleted = false;
let finishFlawless = false;
let finishAllShards = false;

function showResult() {
  if (finishedShown || mode !== 'finished' || !current) return;
  finishedShown = true;
  const data = levelSave(current.id);
  $('#result-title').textContent = current.name;
  $('#result-percent').textContent = '100%';
  $('#result-attempts').textContent = String(runAttempts);
  $('#result-shards').textContent = `${runShardIds.length}/3`;
  $('#result-best').textContent = `${data.best}%`;
  $('#result-kicker').textContent = finishFlawless && !finishWasCompleted ? 'FLAWLESS CLEAR' : 'LEVEL COMPLETE';
  const flags = $('#result-flags');
  flags.innerHTML = finishFlags.map((f, i) => `<span style="--i:${i}">${f}</span>`).join('');
  const nextBtn = $('#btn-next');
  if (currentIndex < LEVELS.length - 1) {
    nextBtn.classList.remove('is-hidden');
    nextBtn.textContent = 'NEXT LEVEL';
    nextBtn.dataset.action = 'next';
  } else {
    nextBtn.classList.add('is-hidden');
  }
  showOverlay($('#overlay-result'));
  audio.stopMusic();
  musicStarted = false;
  audio.duckMusic(false);
}

function quitToLevels() {
  if (current && mode !== 'finished') {
    const pct = Math.floor(player.progress * 100);
    const data = levelSave(current.id);
    if (pct > (data.best || 0)) data.best = pct;
  }
  writeSave();
  mode = 'menu';
  current = null;
  currentIndex = -1;
  hideOverlay($('#overlay-pause'));
  hideOverlay($('#overlay-result'));
  $('#hud').classList.add('is-hidden');
  audio.stopMusic();
  musicStarted = false;
  audio.duckMusic(false);
  showScreen('levels');
}

function setPaused(paused) {
  if (paused && mode === 'playing') {
    mode = 'paused';
    $('#pause-level').textContent = `${current.name} · ${Math.floor(player.progress * 100)}%`;
    showOverlay($('#overlay-pause'));
    audio.duckMusic(true);
  } else if (!paused && mode === 'paused') {
    mode = 'playing';
    hideOverlay($('#overlay-pause'));
    audio.duckMusic(false);
    lastTime = performance.now() / 1000;
    accumulator = 0;
    if (!musicStarted) { audio.playMusic(current); musicStarted = true; }
  }
}

function restartFromPause() {
  if (!current) return;
  hideOverlay($('#overlay-pause'));
  audio.duckMusic(false);
  spawnPlayer();
  lastTime = performance.now() / 1000;
  accumulator = 0;
}

function showOverlay(el) {
  el.classList.add('is-open');
  el.setAttribute('aria-hidden', 'false');
}
function hideOverlay(el) {
  el.classList.remove('is-open');
  el.setAttribute('aria-hidden', 'true');
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function updateHUD() {
  if (!current) return;
  const pct = clamp(Math.floor(player.progress * 100), 0, 100);
  $('#progress-fill').style.width = `${pct}%`;
  $('#progress-knob').style.left = `${pct}%`;
  $('#progress-pct').textContent = `${pct}%`;
  $('#hud-attempt').textContent = `ATTEMPT ${runAttempts}`;
  const shards = $$('#hud-shards span');
  const total = current.shards.length;
  shards.forEach((el, i) => {
    el.classList.toggle('is-filled', i < runShardIds.length);
    el.classList.toggle('is-empty-slot', i >= total);
  });
}

// ---------------------------------------------------------------------------
// Particles and visual state
// ---------------------------------------------------------------------------
function burst(x, y, n, colors, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = (90 + Math.random() * 320) * power;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 100,
      life: 0.5 + Math.random() * 0.7,
      max: 1.2,
      size: 3 + Math.random() * 9,
      color: Math.random() < 0.5 ? colors.a : colors.b,
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 14,
      grav: 600 + Math.random() * 800,
    });
  }
}

function dust(x, y, up, color, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const sp = 40 + Math.random() * 130;
    particles.push({
      x: x + (Math.random() - 0.5) * 26,
      y: y - Math.random() * 4,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp * up,
      life: 0.25 + Math.random() * 0.35,
      max: 0.6,
      size: 2 + Math.random() * 5,
      color,
      rot: 0,
      vr: (Math.random() - 0.5) * 8,
      grav: 420,
    });
  }
}

function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= dt;
    f.y -= 36 * dt;
    if (f.life <= 0) floaters.splice(i, 1);
  }
  for (let i = trail.length - 1; i >= 0; i--) {
    trail[i].life -= dt;
    if (trail[i].life <= 0) trail.splice(i, 1);
  }
  shake = Math.max(0, shake - dt * 2.6);
  flash = Math.max(0, flash - dt * 2.2);
  deathFlash = Math.max(0, deathFlash - dt * 1.9);
  landPulse = Math.max(0, landPulse - dt * 5);
  if (mode === 'playing' && !player.onGround) {
    trail.push({ x: player.x, y: player.y, rot: player.rot + (player.gravity === -1 ? Math.PI : 0), life: 0.22, max: 0.22 });
    if (trail.length > 18) trail.shift();
  }
}

// ---------------------------------------------------------------------------
// Physics loop
// ---------------------------------------------------------------------------
function handleEvents(events) {
  for (const ev of events) {
    if (ev.type === 'jump') {
      save.stats.jumps++;
      audio.sfx('jump');
      dust(ev.x, ev.y, 1, hexA('#ffffff', 0.8), 5);
      if (save.stats.jumps % 25 === 0) { evaluateProgress(); queueSave(); }
    } else if (ev.type === 'land') {
      if (ev.impact > 0.35) {
        landPulse = Math.max(landPulse, ev.impact);
        audio.sfx('land');
        dust(ev.x, ev.y, -0.2, hexA('#ffffff', 0.55), Math.round(4 + ev.impact * 7));
      }
    } else if (ev.type === 'orb') {
      audio.sfx('orb');
      burst(ev.x, ev.y, 12, selectedCube().colors, 0.5);
      floaters.push({ x: ev.x, y: ev.y - 18, text: 'BOOST', color: '#ffe45e', life: 0.8, max: 0.8 });
    } else if (ev.type === 'pad') {
      audio.sfx('pad');
      burst(ev.x, ev.y, 16, { a: '#ffe45e', b: '#ff9a3c' }, 0.65);
    } else if (ev.type === 'portal') {
      audio.sfx('portal');
      shake = Math.max(shake, 0.45);
      const col = ev.kind === 'gravity' ? { a: '#b28bff', b: '#42f5e4' } : { a: '#ffd35c', b: '#ff7a5c' };
      burst(ev.x, ev.y, 22, col, 0.9);
      floaters.push({
        x: ev.x, y: ev.y - 30,
        text: ev.kind === 'gravity' ? (ev.dir === -1 ? 'GRAVITY FLIP' : 'GRAVITY RESTORED') : 'SPEED UP',
        color: ev.kind === 'gravity' ? '#cbb0ff' : '#ffd35c',
        life: 1.1, max: 1.1,
      });
    } else if (ev.type === 'shard') {
      audio.sfx('shard');
      runShardIds.push(ev.id);
      burst(ev.x, ev.y, 20, { a: '#ffffff', b: current.theme.accent2 }, 0.7);
      floaters.push({ x: ev.x, y: ev.y - 18, text: `SHARD ${runShardIds.length}/3`, color: current.theme.accent2, life: 1.1, max: 1.1 });
      evaluateProgress();
      updateHUD();
      queueSave();
    } else if (ev.type === 'death') {
      onDeath();
    } else if (ev.type === 'finish') {
      onFinish();
    }
  }
}

function update(dt) {
  const events = [];
  stepPlayer(player, current, dt, { held: inputHeld, pressed: pendingPress }, events);
  pendingPress = false;
  handleEvents(events);
  if (mode === 'playing') {
    save.stats.time = (save.stats.time || 0) + dt;
    updateHUD();
  }
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------
function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function hexA(hex, alpha) {
  if (!hex) return `rgba(255,255,255,${alpha})`;
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const num = parseInt(n, 16);
  return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${alpha})`;
}

function drawBackground(theme, camX, t, strength = 1, showCeiling = false) {
  const top = -view.offsetY;
  const bottom = view.logicalH - view.offsetY;
  const sky = ctx.createLinearGradient(0, top, 0, bottom);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(0.62, theme.skyBottom);
  sky.addColorStop(1, theme.floor);
  ctx.fillStyle = sky;
  ctx.fillRect(0, top, view.logicalW, bottom - top);

  // Neon sun / moon.
  const sunX = view.logicalW * 0.7 - (camX * 0.015) % 400;
  const sunY = FLOOR_Y - 250;
  const halo = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 230);
  halo.addColorStop(0, hexA(theme.accent, 0.26 * strength));
  halo.addColorStop(0.45, hexA(theme.accent2, 0.09 * strength));
  halo.addColorStop(1, hexA(theme.accent, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - 260, sunY - 260, 520, 520);

  // Filled sun disc with synthwave scanline cutouts.
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, 86, 0, TAU);
  ctx.clip();
  const disc = ctx.createLinearGradient(0, sunY - 86, 0, sunY + 86);
  disc.addColorStop(0, hexA(theme.accent2, 0.62 * strength));
  disc.addColorStop(0.55, hexA(theme.accent, 0.4 * strength));
  disc.addColorStop(1, hexA(theme.accent, 0.1 * strength));
  ctx.fillStyle = disc;
  ctx.fillRect(sunX - 100, sunY - 100, 200, 200);
  ctx.fillStyle = hexA(theme.skyBottom, 0.7);
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(sunX - 100, sunY + 18 + i * 14, 200, 2 + i * 1.6);
  }
  ctx.restore();

  ctx.save();
  ctx.shadowColor = hexA(theme.accent2, 0.75 * strength);
  ctx.shadowBlur = 18;
  ctx.strokeStyle = hexA(theme.accent2, 0.55 * strength);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 86, 0, TAU);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = hexA(theme.accent, 0.2 * strength);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 118, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sunX, sunY, 92, 0, TAU);
  ctx.stroke();

  // Stars.
  for (let i = 0; i < 54; i++) {
    const span = view.logicalW + 120;
    const sx = ((i * 157.3 - camX * 0.045 - t * 4) % span + span) % span - 60;
    const sy = top + ((i * 89.7 + Math.sin(i * 5 + t * 0.4) * 16) % (bottom - top));
    const tw = 0.35 + 0.45 * Math.abs(Math.sin(t * 1.3 + i));
    ctx.fillStyle = hexA(i % 5 === 0 ? theme.accent2 : '#ffffff', tw * 0.65 * strength);
    ctx.fillRect(sx, sy, i % 7 === 0 ? 3 : 1.6, i % 7 === 0 ? 3 : 1.6);
  }

  // Back ridge.
  drawRidge(theme, camX, 0.08, 210, FLOOR_Y + 30, hexA('#000000', 0.18), 170);
  drawRidge(theme, camX, 0.15, 140, FLOOR_Y + 30, hexA(theme.skyTop, 0.82), 120);

  // Grid.
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  const grid = 92;
  const offset = ((-camX * 0.32) % grid + grid) % grid;
  ctx.beginPath();
  for (let x = offset; x < view.logicalW + grid; x += grid) {
    ctx.moveTo(x, top);
    ctx.lineTo(x, FLOOR_Y);
  }
  for (let y = FLOOR_Y - grid; y > top; y -= grid) {
    ctx.moveTo(0, y);
    ctx.lineTo(view.logicalW, y);
  }
  ctx.stroke();

  // Floor band.
  ctx.fillStyle = theme.floor;
  ctx.fillRect(0, FLOOR_Y, view.logicalW, Math.max(0, bottom - FLOOR_Y));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, FLOOR_Y, view.logicalW, Math.max(0, bottom - FLOOR_Y));
  ctx.clip();
  ctx.strokeStyle = hexA(theme.floorLine, 0.1);
  ctx.lineWidth = 14;
  const stripeOffset = ((-camX) % 120 + 120) % 120;
  for (let x = -220 + stripeOffset; x < view.logicalW + 220; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_Y);
    ctx.lineTo(x - 90, bottom);
    ctx.stroke();
  }
  ctx.strokeStyle = hexA(theme.accent2, 0.18);
  ctx.lineWidth = 1;
  for (let x = offset; x < view.logicalW + grid; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_Y + 10);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }
  ctx.restore();

  // Floor edge.
  ctx.save();
  ctx.shadowColor = theme.floorLine;
  ctx.shadowBlur = 22;
  ctx.fillStyle = theme.floorLine;
  ctx.fillRect(0, FLOOR_Y - 3, view.logicalW, 3);
  ctx.restore();

  // Ceiling band only matters in gravity sections.
  if (showCeiling) {
    ctx.fillStyle = hexA(theme.floor, 0.78);
    ctx.fillRect(0, top, view.logicalW, CEIL_Y - top);
    ctx.fillStyle = hexA(theme.accent2, 0.42);
    ctx.fillRect(0, CEIL_Y - 2, view.logicalW, 2);
    ctx.strokeStyle = hexA(theme.accent2, 0.08);
    ctx.lineWidth = 1;
    for (let x = offset; x < view.logicalW + grid; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, CEIL_Y);
      ctx.stroke();
    }
  }
}

function drawRidge(theme, camX, parallax, amp, baseY, color, step) {
  const shift = camX * parallax;
  const start = -step - (shift % step);
  ctx.beginPath();
  ctx.moveTo(start, baseY);
  for (let x = start; x < view.logicalW + step * 2; x += step) {
    const world = x + shift;
    const h = amp * (0.35 + 0.65 * Math.abs(Math.sin(world * 0.006 + 1.7)));
    ctx.lineTo(x + step / 2, baseY - h);
    ctx.lineTo(x + step, baseY);
  }
  ctx.lineTo(view.logicalW + step * 2, baseY);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawWorldObjects(level, camX, t) {
  const left = camX - 140;
  const right = camX + view.logicalW + 140;
  const theme = level.theme;

  ctx.save();
  ctx.translate(-camX, 0);

  // Finish gate.
  drawFinish(level, t);

  for (const o of level.objects) {
    if (o.x < left || o.x > right) {
      if (o.type !== 'portal') continue;
    }
    if (o.type === 'portal') drawPortal(o, theme, t);
    else if (o.type === 'block') drawBlock(o, theme, t);
    else if (o.type === 'spike') drawSpike(o, theme);
    else if (o.type === 'saw') drawSaw(o, theme, t);
    else if (o.type === 'pad') drawPad(o, theme, t);
    else if (o.type === 'orb') drawOrb(o, theme, t);
  }

  for (const s of level.shards) {
    if (s.taken || s.x < left || s.x > right) continue;
    drawShard(s, theme, t);
  }
  ctx.restore();
}

function drawFinish(level, t) {
  const x = level.length;
  const camX = player.x - playerScreenX();
  if (x < camX - 120 || x > camX + view.logicalW + 160) return;
  const theme = level.theme;
  ctx.save();
  const pulse = 0.55 + Math.sin(t * 5) * 0.25;
  ctx.shadowColor = theme.accent2;
  ctx.shadowBlur = 26 * pulse;
  ctx.fillStyle = hexA(theme.accent2, 0.18);
  ctx.fillRect(x - 16, CEIL_Y, 32, FLOOR_Y - CEIL_Y);
  ctx.strokeStyle = theme.accent2;
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 16, CEIL_Y, 32, FLOOR_Y - CEIL_Y);
  ctx.shadowBlur = 0;
  for (let y = CEIL_Y; y < FLOOR_Y; y += 28) {
    ctx.fillStyle = (Math.floor((y - CEIL_Y) / 28) % 2 === 0) ? theme.accent2 : theme.floor;
    ctx.fillRect(x - 12, y, 24, 14);
  }
  ctx.save();
  ctx.translate(x, (CEIL_Y + FLOOR_Y) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '6px';
  ctx.fillText('FINISH', 0, 5);
  ctx.restore();
  ctx.restore();
}

function drawBlock(o, theme, t) {
  const isPlatform = o.platform || o.h <= 20;
  ctx.save();
  if (isPlatform) {
    ctx.shadowColor = theme.accent2;
    ctx.shadowBlur = 14;
    ctx.fillStyle = hexA(theme.block, 0.9);
    roundRect(ctx, o.x, o.y, o.w, o.h, 6);
    ctx.fill();
    ctx.strokeStyle = theme.accent2;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = hexA(theme.accent2, 0.55);
    for (let x = o.x + 10; x < o.x + o.w - 6; x += 22) ctx.fillRect(x, o.y + 6, 8, 3);
    ctx.restore();
    return;
  }
  ctx.fillStyle = theme.block;
  ctx.shadowColor = theme.blockEdge;
  ctx.shadowBlur = 12;
  roundRect(ctx, o.x, o.y, o.w, o.h, 7);
  ctx.fill();
  ctx.shadowBlur = 0;

  const g = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
  g.addColorStop(0, hexA(theme.blockEdge, 0.4));
  g.addColorStop(0.18, hexA(theme.blockEdge, 0.08));
  g.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  roundRect(ctx, o.x, o.y, o.w, o.h, 7);
  ctx.fill();

  ctx.strokeStyle = theme.blockEdge;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = hexA(theme.blockEdge, 0.1);
  roundRect(ctx, o.x + 7, o.y + 7, o.w - 14, o.h - 14, 4);
  ctx.fill();
  ctx.strokeStyle = hexA(theme.blockEdge, 0.35);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = hexA(theme.accent2, 0.7);
  ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, 2);

  ctx.save();
  ctx.beginPath();
  ctx.rect(o.x + 3, o.y + 3, o.w - 6, o.h - 6);
  ctx.clip();
  ctx.strokeStyle = hexA(theme.blockEdge, 0.12);
  ctx.lineWidth = 8;
  for (let x = o.x - 40; x < o.x + o.w + 40; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, o.y + o.h);
    ctx.lineTo(x + o.h, o.y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function drawSpike(o, theme) {
  const up = o.dir !== -1;
  const baseY = o.y;
  const tipY = up ? o.y - o.size : o.y + o.size;
  const g = ctx.createLinearGradient(0, baseY, 0, tipY);
  g.addColorStop(0, hexA(theme.spike, 0.92));
  g.addColorStop(1, theme.spike);
  ctx.save();
  ctx.shadowColor = theme.spike;
  ctx.shadowBlur = 14;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(o.x + 1, baseY);
  ctx.lineTo(o.x + o.size / 2, tipY);
  ctx.lineTo(o.x + o.size - 1, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hexA('#ffffff', 0.85);
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = hexA('#ffffff', 0.25);
  ctx.beginPath();
  ctx.moveTo(o.x + o.size / 2, tipY + (up ? 8 : -8));
  ctx.lineTo(o.x + o.size * 0.34, baseY);
  ctx.lineTo(o.x + o.size * 0.44, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSaw(o, theme, t) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(t * 4.2);
  const r = o.r;
  ctx.shadowColor = theme.spike;
  ctx.shadowBlur = 16;
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, r);
  g.addColorStop(0, hexA(theme.spike, 0.9));
  g.addColorStop(1, hexA(theme.spike, 0.18));
  ctx.fillStyle = g;
  ctx.beginPath();
  const teeth = 9;
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * TAU;
    const rad = i % 2 === 0 ? r : r * 0.66;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hexA('#ffffff', 0.7);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = theme.floor;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.36, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = theme.spike;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.36, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = hexA('#ffffff', 0.85);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.08, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPad(o, theme, t) {
  const pulse = 0.7 + Math.sin(t * 6 + o.x) * 0.3;
  ctx.save();
  ctx.shadowColor = '#ffe45e';
  ctx.shadowBlur = 20 * pulse;
  const g = ctx.createLinearGradient(o.x, o.y - 14, o.x, o.y + 6);
  g.addColorStop(0, '#fff5a8');
  g.addColorStop(1, '#ff9a1f');
  ctx.fillStyle = g;
  roundRect(ctx, o.x, o.y - 9, o.w, 11, 5);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff8cf';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = hexA('#ffe45e', 0.85);
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 2; i++) {
    const yy = o.y - 20 - i * 9 - pulse * 3;
    ctx.beginPath();
    ctx.moveTo(o.x + 12, yy + 6);
    ctx.lineTo(o.x + o.w / 2, yy);
    ctx.lineTo(o.x + o.w - 12, yy + 6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOrb(o, theme, t) {
  const pulse = 0.8 + Math.sin(t * 4 + o.x * 0.02) * 0.2;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.shadowColor = '#ffe45e';
  ctx.shadowBlur = 22 * pulse;
  ctx.strokeStyle = hexA('#ffe45e', 0.9);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, o.r * pulse, 0, TAU);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hexA('#fff8cf', 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, o.r * 0.68, 0, TAU);
  ctx.stroke();
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, o.r * 0.7);
  g.addColorStop(0, hexA('#fff8cf', 0.9));
  g.addColorStop(1, hexA('#ffe45e', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, o.r * 0.7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff8cf';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPortal(o, theme, t) {
  const grav = o.kind === 'gravity';
  const c1 = grav ? '#b28bff' : '#ffd35c';
  const c2 = grav ? '#42f5e4' : '#ff7a5c';
  const pulse = 0.6 + Math.sin(t * 5 + o.x * 0.03) * 0.4;
  ctx.save();
  const g = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
  g.addColorStop(0, hexA(c1, 0.08));
  g.addColorStop(0.5, hexA(c1, 0.3));
  g.addColorStop(1, hexA(c2, 0.08));
  ctx.fillStyle = g;
  roundRect(ctx, o.x, o.y, o.w, o.h, 26);
  ctx.fill();
  ctx.shadowColor = c1;
  ctx.shadowBlur = 20 * pulse;
  ctx.strokeStyle = c1;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hexA(c2, 0.35 + pulse * 0.3);
  ctx.lineWidth = 1.5;
  roundRect(ctx, o.x + 6, o.y + 6, o.w - 12, o.h - 12, 20);
  ctx.stroke();

  // Moving energy dashes.
  ctx.save();
  roundRect(ctx, o.x + 8, o.y + 8, o.w - 16, o.h - 16, 18);
  ctx.clip();
  ctx.strokeStyle = hexA(c2, 0.5);
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const yy = o.y + ((t * 90 + i * 46) % (o.h + 40)) - 20;
    ctx.beginPath();
    ctx.moveTo(o.x + 10, yy);
    ctx.lineTo(o.x + o.w - 10, yy + 12);
    ctx.stroke();
  }
  ctx.restore();

  // Arrows.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  for (let i = 0; i < 2; i++) {
    const dir = grav ? (i === 0 ? 1 : -1) : 1;
    const offset = grav ? i * 34 : i * 26;
    const yy = cy - 20 + offset;
    ctx.beginPath();
    if (grav) {
      ctx.moveTo(cx - 11, yy - 7 * dir);
      ctx.lineTo(cx, yy + 5 * dir);
      ctx.lineTo(cx + 11, yy - 7 * dir);
    } else {
      ctx.moveTo(cx - 12 + i * 11, yy - 10);
      ctx.lineTo(cx - 2 + i * 11, yy);
      ctx.lineTo(cx - 12 + i * 11, yy + 10);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawShard(s, theme, t) {
  const bob = Math.sin(t * 3.2 + s.x * 0.02) * 5;
  const pulse = 0.85 + Math.sin(t * 5 + s.x) * 0.15;
  ctx.save();
  ctx.translate(s.x, s.y + bob);
  ctx.rotate(t * 1.6);
  ctx.shadowColor = theme.accent2;
  ctx.shadowBlur = 22 * pulse;
  const g = ctx.createLinearGradient(0, -18, 0, 18);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, theme.accent2);
  g.addColorStop(1, theme.accent);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.lineTo(10, -4);
  ctx.lineTo(0, 17);
  ctx.lineTo(-10, -4);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(4, -3);
  ctx.lineTo(0, 6);
  ctx.lineTo(-4, -3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function playerScreenX() {
  return clamp(view.logicalW * 0.25, view.portrait ? 150 : 210, 340);
}

function drawPlayer(t, camX) {
  if (!player.alive) return;
  const cube = selectedCube();
  const cx = player.x + SIZE / 2;
  const cy = player.y + SIZE / 2;
  const px = cx - camX;
  const py = cy;

  // Trail.
  for (const tr of trail) {
    const alpha = (tr.life / tr.max) * 0.25;
    ctx.save();
    ctx.translate(tr.x + SIZE / 2 - camX, tr.y + SIZE / 2);
    ctx.rotate(tr.rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = cube.colors.glow;
    roundRect(ctx, -SIZE / 2 + 4, -SIZE / 2 + 4, SIZE - 8, SIZE - 8, 9);
    ctx.fill();
    ctx.restore();
  }

  // Ground glow shadow.
  ctx.save();
  const surface = player.gravity === 1 ? FLOOR_Y : CEIL_Y;
  const dist = Math.abs((player.y + SIZE) - surface);
  const shadowAlpha = clamp(0.35 - dist / 900, 0.06, 0.35);
  ctx.fillStyle = hexA(cube.colors.glow, shadowAlpha);
  ctx.beginPath();
  ctx.ellipse(cx - camX, surface, SIZE * 0.6, 7, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Ambient glow.
  const halo = ctx.createRadialGradient(px, py, 4, px, py, 92);
  halo.addColorStop(0, hexA(cube.colors.glow, 0.3));
  halo.addColorStop(1, hexA(cube.colors.glow, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(px - 100, py - 100, 200, 200);

  const squash = 1 + landPulse * 0.08;
  drawCube(ctx, px, py, SIZE * squash, cube, t, player.rot + (player.gravity === -1 ? Math.PI : 0), { glowScale: 0.75 });
}

function drawParticles(camX) {
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x - camX, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  }
  for (const f of floaters) {
    const a = clamp(f.life / f.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = f.color;
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 12;
    ctx.fillText(f.text, f.x - camX, f.y);
    ctx.restore();
  }
}

function render(t) {
  const dpr = view.dpr;
  ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, 0, 0);
  ctx.clearRect(0, 0, view.logicalW, view.logicalH);
  ctx.translate(0, view.offsetY);

  if (!current) {
    renderAmbient(t);
    return;
  }

  const theme = current.theme;
  const shakeX = shake > 0 ? (Math.random() - 0.5) * shake * 16 : 0;
  const shakeY = shake > 0 ? (Math.random() - 0.5) * shake * 12 : 0;
  const camX = player.x - playerScreenX() + shakeX;
  ctx.save();
  ctx.translate(0, shakeY);

  const gravityLevel = current.objects.some((o) => o.type === 'portal' && o.kind === 'gravity');
  drawBackground(theme, camX, t, 1, gravityLevel || player.gravity === -1);
  drawWorldObjects(current, camX, t);
  drawPlayer(t, camX);
  drawParticles(camX);

  // Speed streaks.
  if (player.speedMul > 1.05 && mode === 'playing') {
    ctx.strokeStyle = hexA(theme.accent2, 0.18);
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const yy = CEIL_Y + ((i * 97 + t * 340) % (FLOOR_Y - CEIL_Y));
      const xx = ((t * 900 + i * 133) % (view.logicalW + 200)) - 100;
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx + 80, yy);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Flash overlays.
  if (flash > 0) {
    ctx.fillStyle = hexA('#ffffff', flash * 0.55);
    ctx.fillRect(0, -view.offsetY, view.logicalW, view.logicalH);
  }
  if (deathFlash > 0) {
    ctx.fillStyle = hexA('#ff2f5e', deathFlash * 0.32);
    ctx.fillRect(0, -view.offsetY, view.logicalW, view.logicalH);
  }

  // Vignette.
  const vig = ctx.createRadialGradient(
    view.logicalW / 2, view.logicalH / 2 - view.offsetY, view.logicalW * 0.25,
    view.logicalW / 2, view.logicalH / 2 - view.offsetY, view.logicalW * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, -view.offsetY, view.logicalW, view.logicalH);

}

function renderAmbient(t) {
  const theme = LEVELS[Math.floor(t / 10) % LEVELS.length].theme;
  const camX = t * 42;
  drawBackground(theme, camX, t, 0.9);

  // Drifting decorative geometry on the floor.
  const span = view.logicalW + 600;
  for (let i = 0; i < 16; i++) {
    const wx = ((i * 383 - (t * 42) % span) % span + span) % span - 300;
    ctx.save();
    ctx.globalAlpha = 0.24;
    if (i % 3 === 0) {
      drawSpike({ x: wx, y: FLOOR_Y, size: 44, dir: 1 }, theme);
    } else if (i % 3 === 1) {
      drawBlock({ x: wx, y: FLOOR_Y - 44, w: 44, h: 44 }, theme, t);
    } else {
      ctx.strokeStyle = hexA(theme.accent2, 0.5);
      ctx.lineWidth = 2;
      ctx.strokeRect(wx + 10, FLOOR_Y - 120, 42, 42);
    }
    ctx.restore();
  }

  // Floating hero cube.
  const bob = Math.sin(t * 1.4) * 14;
  const px = view.logicalW * (view.logicalW > 1100 ? 0.82 : 0.76);
  const py = FLOOR_Y - 190 + bob;
  const halo = ctx.createRadialGradient(px, py, 6, px, py, 150);
  halo.addColorStop(0, hexA(selectedCube().colors.glow, 0.28));
  halo.addColorStop(1, hexA(selectedCube().colors.glow, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(px - 170, py - 170, 340, 340);
  drawCube(ctx, px, py, 92, selectedCube(), t, Math.sin(t * 0.8) * 0.18, { glowScale: 0.7 });

  // Orbiting mini cubes.
  for (let i = 0; i < 3; i++) {
    const a = t * 0.5 + i * (TAU / 3);
    const ox = px + Math.cos(a) * 120;
    const oy = py + Math.sin(a) * 54;
    ctx.globalAlpha = 0.35;
    drawCube(ctx, ox, oy, 22, CUBES[(i + 2) % CUBES.length], t, a, { glow: false });
    ctx.globalAlpha = 1;
  }

  // Vignette.
  const vig = ctx.createRadialGradient(
    view.logicalW / 2, view.logicalH / 2 - view.offsetY, view.logicalW * 0.2,
    view.logicalW / 2, view.logicalH / 2 - view.offsetY, view.logicalW * 0.8,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0.05)');
  vig.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, -view.offsetY, view.logicalW, view.logicalH);
}

// ---------------------------------------------------------------------------
// Main frame
// ---------------------------------------------------------------------------
function frame(nowMs) {
  const now = nowMs / 1000;
  let dt = now - lastTime;
  lastTime = now;
  if (!Number.isFinite(dt)) dt = 0;
  dt = clamp(dt, 0, 0.05);
  worldTime = now;

  if (mode === 'playing') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && mode === 'playing' && guard++ < 12) {
      update(STEP);
      accumulator -= STEP;
      if (mode !== 'playing') { accumulator = 0; break; }
    }
  } else if (mode === 'dead') {
    deathTimer += dt;
    updateEffects(dt);
    if (deathTimer > DEATH_TIME + 0.32) {
      spawnPlayer();
      lastTime = now;
      accumulator = 0;
    }
  } else if (mode === 'finished') {
    updateEffects(dt);
    finishTimer += dt;
    if (!finishedShown && finishTimer > 0.9) showResult();
  }

  if (mode !== 'paused') updateEffects(dt);

  render(now);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  const jumpKey = e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW';
  if (jumpKey) {
    if (mode === 'playing') {
      e.preventDefault();
      if (!e.repeat) pendingPress = true;
      inputHeld = true;
      audio.ensure();
    } else if (['menu', 'paused', 'finished', 'dead'].includes(mode)) {
      // Avoid page scroll on menus and overlays.
      if (document.activeElement === document.body || document.activeElement === canvas) e.preventDefault();
    }
  }
  if (e.code === 'Escape') {
    if (mode === 'playing') { e.preventDefault(); setPaused(true); }
    else if (mode === 'paused') { e.preventDefault(); setPaused(false); }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') inputHeld = false;
});

canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'playing') return;
  e.preventDefault();
  pendingPress = true;
  inputHeld = true;
  audio.ensure();
  if (canvas.setPointerCapture) {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
});

window.addEventListener('pointerup', () => { inputHeld = false; });
window.addEventListener('pointercancel', () => { inputHeld = false; });
window.addEventListener('blur', () => {
  inputHeld = false;
  if (mode === 'playing') setPaused(true);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------
function toggleSound() {
  save.settings.muted = !save.settings.muted;
  audio.setMuted(save.settings.muted);
  audio.ensure();
  if (!save.settings.muted) audio.sfx('click');
  updateSoundButtons();
  queueSave();
}

function updateSoundButtons() {
  for (const btn of $$('[data-sound]')) {
    btn.textContent = save.settings.muted ? '✕' : '♪';
    btn.classList.toggle('is-muted', save.settings.muted);
    btn.setAttribute('aria-label', save.settings.muted ? 'Enable sound' : 'Mute sound');
  }
}

document.addEventListener('click', (e) => {
  const sound = e.target.closest('[data-sound]');
  if (sound) { toggleSound(); return; }

  const levelCard = e.target.closest('[data-level]');
  if (levelCard) {
    audio.ensure();
    audio.sfx('click');
    startLevel(levelCard.dataset.level);
    return;
  }

  const cubeCard = e.target.closest('[data-cube]');
  if (cubeCard) { equipCube(cubeCard.dataset.cube); return; }

  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  audio.ensure();
  if (action === 'play') { audio.sfx('click'); showScreen('levels'); }
  else if (action === 'cubes') { audio.sfx('click'); showScreen('cubes'); }
  else if (action === 'achievements') { audio.sfx('click'); showScreen('awards'); }
  else if (action === 'menu') { audio.sfx('click'); showScreen('menu'); }
  else if (action === 'resume') { setPaused(false); }
  else if (action === 'restart') { restartFromPause(); }
  else if (action === 'quit') { quitToLevels(); }
  else if (action === 'retry') {
    hideOverlay($('#overlay-result'));
    startLevel(current.id);
  } else if (action === 'next') {
    hideOverlay($('#overlay-result'));
    startLevel(LEVELS[currentIndex + 1].id);
  }
});

$('#btn-pause').addEventListener('click', (e) => {
  e.stopPropagation();
  setPaused(true);
});

document.addEventListener('pointerdown', () => audio.ensure(), { passive: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    writeSave();
    if (mode === 'playing') setPaused(true);
  }
});
window.addEventListener('pagehide', writeSave);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
resize();
refreshCounts();
evaluateProgress({ silent: true });
updateSoundButtons();
updateHUD();
buildLevelGrid();
buildCubeGrid();
buildAwardGrid();
showScreen('menu');
requestAnimationFrame(frame);
