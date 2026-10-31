// Headless level validator: an aggressive auto-player proves every level is beatable.
import { LEVELS } from '../js/levels.js';
import { CUBES, ACHIEVEMENTS } from '../js/data.js';
import { createPlayer, stepPlayer, findThreatAhead, hazardBox, SIZE } from '../js/engine.js';

const shardTotal = LEVELS.reduce((total, level) => total + level.shards.length, 0);
const contentOk = LEVELS.length === 5 && CUBES.length === 10 && ACHIEVEMENTS.length === 10 && shardTotal === 15;
console.log(`Content: ${LEVELS.length} levels, ${CUBES.length} cubes, ${ACHIEVEMENTS.length} achievements, ${shardTotal} shards.`);
if (!contentOk) {
  console.error('Expected exactly 5 levels, 10 cubes, 10 achievements and 15 shards.');
  process.exit(1);
}
console.log('');

function threatStart(o) {
  if (o.type === 'block') return o.x;
  return hazardBox(o).x;
}

function decide(p, level, factor) {
  if (!p.onGround) return false;
  const speed = level.speed * p.speedMul;
  const threat = findThreatAhead(p, level, speed * 0.4);
  if (!threat) return false;
  const gap = threatStart(threat) - (p.x + SIZE);
  if (gap > speed * factor) return false;
  return true;
}

function simulate(level, factor, dt = 1 / 240) {
  for (const s of level.shards) s.taken = false;
  const p = createPlayer();
  const events = [];
  let t = 0;
  let maxProgress = 0;
  while (t < 90) {
    const pressed = decide(p, level, factor);
    stepPlayer(p, level, dt, { held: false, pressed }, events);
    maxProgress = Math.max(maxProgress, p.progress);
    if (p.finished) return { win: true, progress: 1, maxProgress: 1, deaths: 0, time: t, shards: level.shards.filter((s) => s.taken).length };
    if (!p.alive) {
      return { win: false, progress: p.progress, maxProgress, deadAt: p.x, time: t, events };
    }
    t += dt;
  }
  return { win: false, progress: p.progress, maxProgress, timeout: true };
}

let allOk = true;
for (const level of LEVELS) {
  let best = null;
  for (let factor = 0.12; factor <= 0.36; factor += 0.005) {
    const result = simulate(level, factor);
    if (!best || result.maxProgress > best.result.maxProgress) best = { factor, result };
    if (result.win) {
      best = { factor, result };
      break;
    }
  }
  const r = best.result;
  const pct = (r.progress * 100).toFixed(1);
  console.log(
    `${level.id} ${level.name.padEnd(18)} ${r.win ? 'WIN ' : 'FAIL'} ${pct.padStart(5)}%  factor=${best.factor.toFixed(3)}  time=${r.time?.toFixed(2)}s  shards=${r.shards ?? 0}/3`,
  );
  if (!r.win) {
    allOk = false;
    console.log(`   died at x=${Math.round(r.deadAt)} (${(level.objects.find((o) => o.x >= r.deadAt - 60 && (o.type === 'spike' || o.type === 'block' || o.type === 'saw')) || {}).type})`);
  }
}
console.log(allOk ? '\nAll levels beatable by the auto-player.' : '\nSome levels need tuning.');
process.exit(allOk ? 0 : 1);
