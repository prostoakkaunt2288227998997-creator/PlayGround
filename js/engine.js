// Pure gameplay physics shared by the browser game and the level simulator.
export const TILE = 44;
export const FLOOR_Y = 620;
export const CEIL_Y = 80;
export const SIZE = 46;
export const GRAVITY = 2600;
export const JUMP_V = 940;
export const PAD_V = 1260;
export const MAX_FALL = 1650;
export const DEATH_TIME = 0.75;

export function createPlayer() {
  return {
    x: 0,
    y: FLOOR_Y - SIZE,
    vy: 0,
    gravity: 1,
    onGround: true,
    rot: 0,
    alive: true,
    finished: false,
    speedMul: 1,
    buffer: 0,
    usedOrbs: new Set(),
    usedPads: new Set(),
    usedPortals: new Set(),
    progress: 0,
    airTime: 0,
    landImpact: 0,
  };
}

export function resetPlayer(p) {
  p.x = 0;
  p.y = FLOOR_Y - SIZE;
  p.vy = 0;
  p.gravity = 1;
  p.onGround = true;
  p.rot = 0;
  p.alive = true;
  p.finished = false;
  p.speedMul = 1;
  p.buffer = 0;
  p.usedOrbs.clear();
  p.usedPads.clear();
  p.usedPortals.clear();
  p.progress = 0;
  p.airTime = 0;
  p.landImpact = 0;
}

export function playerBox(p) {
  return { x: p.x, y: p.y, w: SIZE, h: SIZE };
}

export function playerHazardBox(p) {
  return { x: p.x + 8, y: p.y + 8, w: SIZE - 16, h: SIZE - 16 };
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function spikeBox(o) {
  // A forgiving triangle approximated by a narrow box near its base.
  if (o.dir === -1) {
    return { x: o.x + 12, y: o.y + 2, w: o.size - 24, h: o.size - 10 };
  }
  return { x: o.x + 12, y: o.y - o.size + 8, w: o.size - 24, h: o.size - 10 };
}

export function hazardBox(o) {
  if (o.type === 'spike') return spikeBox(o);
  if (o.type === 'saw') {
    return { x: o.x - o.r + 7, y: o.y - o.r + 7, w: o.r * 2 - 14, h: o.r * 2 - 14 };
  }
  return { x: o.x, y: o.y, w: o.w || 0, h: o.h || 0 };
}

function die(p, events) {
  if (!p.alive) return;
  p.alive = false;
  events.push({ type: 'death', x: p.x + SIZE / 2, y: p.y + SIZE / 2 });
}

function jump(p, events, power = JUMP_V) {
  p.vy = -power * p.gravity;
  p.onGround = false;
  p.buffer = 0;
  events.push({ type: 'jump', x: p.x + SIZE / 2, y: p.y + SIZE });
}

function land(p) {
  p.vy = 0;
  p.onGround = true;
  p.rot = 0;
}

export function stepPlayer(p, level, dt, input, events) {
  if (!p.alive || p.finished) return;

  const wasGround = p.onGround;
  p.buffer = Math.max(0, p.buffer - dt);
  if (input.pressed) p.buffer = 0.13;

  // Jump orbs react to a fresh press only.
  if (input.pressed) {
    const cx = p.x + SIZE / 2;
    const cy = p.y + SIZE / 2;
    for (const o of level.objects) {
      if (o.type !== 'orb' || p.usedOrbs.has(o.id)) continue;
      const dx = cx - o.x;
      const dy = cy - o.y;
      if (dx * dx + dy * dy <= (o.r + 30) * (o.r + 30)) {
        p.usedOrbs.add(o.id);
        p.vy = -JUMP_V * 1.02 * p.gravity;
        p.onGround = false;
        p.buffer = 0;
        events.push({ type: 'orb', x: o.x, y: o.y });
        break;
      }
    }
  }

  if (wasGround && (input.held || p.buffer > 0)) {
    jump(p, events);
  }

  if (!p.onGround) {
    p.airTime += dt;
    p.vy += GRAVITY * p.gravity * dt;
    p.vy = Math.max(-MAX_FALL, Math.min(MAX_FALL, p.vy));
    p.rot += p.gravity * dt * 8.6;
  } else {
    p.airTime = 0;
    p.rot = 0;
  }

  const prevY = p.y;
  p.y += p.vy * dt;
  p.onGround = false;

  // Vertical resolution against solid blocks.
  const body = playerBox(p);
  for (const o of level.objects) {
    if (o.type !== 'block') continue;
    if (!overlap(body, o)) continue;
    const prevBottom = prevY + SIZE;
    const prevTop = prevY;
    if (p.gravity === 1 && p.vy >= 0 && prevBottom <= o.y + 16) {
      p.y = o.y - SIZE;
      p.landImpact = Math.min(1, Math.abs(p.vy) / 1200);
      land(p);
      events.push({ type: 'land', x: p.x + SIZE / 2, y: p.y + SIZE, impact: p.landImpact });
    } else if (p.gravity === -1 && p.vy <= 0 && prevTop >= o.y + o.h - 16) {
      p.y = o.y + o.h;
      p.landImpact = Math.min(1, Math.abs(p.vy) / 1200);
      land(p);
      events.push({ type: 'land', x: p.x + SIZE / 2, y: p.y, impact: p.landImpact });
    } else if (p.gravity === 1 && p.vy < 0) {
      // Head bonk is fatal in the runner, like GD block sides.
      die(p, events);
      return;
    } else if (p.gravity === -1 && p.vy > 0) {
      die(p, events);
      return;
    }
    body.y = p.y;
  }

  // Move forward, then resolve block sides.
  const speed = level.speed * p.speedMul;
  p.x += speed * dt;

  for (const o of level.objects) {
    if (o.type !== 'block') continue;
    const b = playerBox(p);
    if (!overlap(b, o)) continue;
    if (p.gravity === 1 && p.vy >= 0 && p.y + SIZE <= o.y + 28) {
      p.y = o.y - SIZE;
      land(p);
      events.push({ type: 'land', x: p.x + SIZE / 2, y: p.y + SIZE, impact: 0.3 });
      continue;
    }
    if (p.gravity === -1 && p.vy <= 0 && p.y >= o.y + o.h - 28) {
      p.y = o.y + o.h;
      land(p);
      events.push({ type: 'land', x: p.x + SIZE / 2, y: p.y, impact: 0.3 });
      continue;
    }
    die(p, events);
    return;
  }

  // Floor and ceiling.
  if (p.gravity === 1) {
    if (p.y + SIZE >= FLOOR_Y) {
      p.y = FLOOR_Y - SIZE;
      if (!p.onGround) {
        p.landImpact = Math.min(1, Math.abs(p.vy) / 1200);
        events.push({ type: 'land', x: p.x + SIZE / 2, y: p.y + SIZE, impact: p.landImpact });
        land(p);
      }
    }
    if (p.y < CEIL_Y) {
      p.y = CEIL_Y;
      p.vy = Math.max(0, p.vy);
    }
  } else {
    if (p.y <= CEIL_Y) {
      p.y = CEIL_Y;
      if (!p.onGround) {
        p.landImpact = Math.min(1, Math.abs(p.vy) / 1200);
        events.push({ type: 'land', x: p.x + SIZE / 2, y: p.y, impact: p.landImpact });
        land(p);
      }
    }
    if (p.y + SIZE > FLOOR_Y) {
      p.y = FLOOR_Y - SIZE;
      p.vy = Math.min(0, p.vy);
    }
  }

  // Pads.
  for (const o of level.objects) {
    if (o.type !== 'pad' || p.usedPads.has(o.id)) continue;
    const hit = { x: p.x + 4, y: p.y + 4, w: SIZE - 8, h: SIZE - 8 };
    const trigger = { x: o.x - 4, y: o.y - 20, w: o.w + 8, h: 30 };
    if (overlap(hit, trigger)) {
      p.usedPads.add(o.id);
      p.vy = -PAD_V * p.gravity;
      p.onGround = false;
      events.push({ type: 'pad', x: o.x + o.w / 2, y: o.y });
    }
  }

  // Portals.
  for (const o of level.objects) {
    if (o.type !== 'portal' || p.usedPortals.has(o.id)) continue;
    if (p.x + SIZE < o.x || p.x > o.x + o.w) continue;
    if (p.y + SIZE < o.y || p.y > o.y + o.h) continue;
    p.usedPortals.add(o.id);
    if (o.kind === 'gravity') {
      p.gravity *= -1;
      p.vy = 0;
      p.onGround = false;
      events.push({ type: 'portal', kind: 'gravity', x: o.x + o.w / 2, y: p.y + SIZE / 2, dir: p.gravity });
    } else if (o.kind === 'speed') {
      p.speedMul = o.mul;
      events.push({ type: 'portal', kind: 'speed', x: o.x + o.w / 2, y: p.y + SIZE / 2, mul: o.mul });
    }
  }

  // Hazards.
  const hb = playerHazardBox(p);
  for (const o of level.objects) {
    if (o.type === 'spike' || o.type === 'saw') {
      if (Math.abs(o.x - p.x) > 180) continue;
      if (overlap(hb, hazardBox(o))) {
        die(p, events);
        return;
      }
    }
  }

  // Shards.
  const cx = p.x + SIZE / 2;
  const cy = p.y + SIZE / 2;
  for (const s of level.shards) {
    if (s.taken) continue;
    const dx = cx - s.x;
    const dy = cy - s.y;
    if (dx * dx + dy * dy < 42 * 42) {
      s.taken = true;
      events.push({ type: 'shard', id: s.id, x: s.x, y: s.y });
    }
  }

  p.progress = Math.max(0, Math.min(1, p.x / level.length));
  if (p.x + SIZE >= level.length) {
    p.finished = true;
    events.push({ type: 'finish', x: p.x + SIZE, y: p.y });
  }
}

export function levelSolids(level) {
  return level.objects.filter((o) => o.type === 'block');
}

export function findThreatAhead(p, level, lookahead) {
  let best = null;
  const laneTop = p.gravity === 1 ? FLOOR_Y - SIZE : CEIL_Y;
  const laneBottom = laneTop + SIZE;
  const probe = { x: p.x + SIZE, y: p.y + 2, w: lookahead, h: SIZE - 4 };
  for (const o of level.objects) {
    if (o.type !== 'spike' && o.type !== 'saw' && o.type !== 'block') continue;
    if (o.x + (o.w || o.size || 0) < p.x + SIZE) continue;
    if (o.x > p.x + SIZE + lookahead) continue;
    const rect = o.type === 'block' ? o : hazardBox(o);
    if (rect.y >= laneBottom + 4 || rect.y + rect.h <= laneTop - 4) continue;
    if (!overlap(probe, rect)) continue;
    if (!best || o.x < best.x) best = o;
  }
  return best;
}
