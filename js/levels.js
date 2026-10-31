import { FLOOR_Y as F, CEIL_Y as C, TILE as T } from './engine.js';

const THEMES = {
  dawn: {
    skyTop: '#170b33', skyBottom: '#5b1c6e', accent: '#ff5ec4', accent2: '#61e7ff',
    floor: '#1b0c2e', floorLine: '#ff5ec4', block: '#331a5e', blockEdge: '#9b6dff',
    spike: '#ff6ad5', grid: 'rgba(255,110,220,.14)', glow: '#ff5ec4',
  },
  rush: {
    skyTop: '#041c2c', skyBottom: '#07546b', accent: '#3dffd0', accent2: '#48a9ff',
    floor: '#041824', floorLine: '#3dffd0', block: '#0a3b4a', blockEdge: '#60ffe0',
    spike: '#56ffe0', grid: 'rgba(61,255,208,.14)', glow: '#3dffd0',
  },
  circuit: {
    skyTop: '#1f0a08', skyBottom: '#6d2410', accent: '#ffb340', accent2: '#59c8ff',
    floor: '#1a0907', floorLine: '#ffb340', block: '#4a2010', blockEdge: '#ffd27a',
    spike: '#ffb340', grid: 'rgba(255,179,64,.13)', glow: '#ffb340',
  },
  gravity: {
    skyTop: '#0b0620', skyBottom: '#232a72', accent: '#b28bff', accent2: '#42f5e4',
    floor: '#080419', floorLine: '#b28bff', block: '#231a52', blockEdge: '#cbb0ff',
    spike: '#b28bff', grid: 'rgba(178,139,255,.14)', glow: '#b28bff',
  },
  overdrive: {
    skyTop: '#21030b', skyBottom: '#7a0f1d', accent: '#ff4d4d', accent2: '#ffe45e',
    floor: '#160207', floorLine: '#ff4d4d', block: '#4d0c18', blockEdge: '#ff9b6a',
    spike: '#ff5b5b', grid: 'rgba(255,77,77,.15)', glow: '#ff4d4d',
  },
  time: {
    skyTop: '#031716', skyBottom: '#075a54', accent: '#ffe45e', accent2: '#42f5e4',
    floor: '#02100f', floorLine: '#ffe45e', block: '#073a35', blockEdge: '#80ffe8',
    spike: '#ffe45e', grid: 'rgba(255,228,94,.12)', glow: '#ffe45e',
  },
  ystep: {
    skyTop: '#17062d', skyBottom: '#5c1976', accent: '#ff5ec4', accent2: '#a8ff60',
    floor: '#120420', floorLine: '#ff5ec4', block: '#331253', blockEdge: '#ffa8eb',
    spike: '#ff6ad5', grid: 'rgba(255,94,196,.14)', glow: '#ff5ec4',
  },
  clutter: {
    skyTop: '#0a1303', skyBottom: '#3d5c0e', accent: '#b6ff3d', accent2: '#ff9a3c',
    floor: '#070f02', floorLine: '#b6ff3d', block: '#233805', blockEdge: '#d9ff9a',
    spike: '#c6ff4a', grid: 'rgba(182,255,61,.12)', glow: '#b6ff3d',
  },
};

let objectCounter = 0;

function build(id, config, define) {
  const objects = [];
  const shards = [];
  let shardCount = 0;
  const add = (o) => objects.push({ id: `${id}-o${++objectCounter}`, ...o });
  const api = {
    spike(x, n = 1, y = F) {
      for (let i = 0; i < n; i++) add({ type: 'spike', x: x + i * T, y, size: T, dir: 1 });
      return api;
    },
    spikeDown(x, n = 1, y = C) {
      for (let i = 0; i < n; i++) add({ type: 'spike', x: x + i * T, y, size: T, dir: -1 });
      return api;
    },
    block(x, wT = 1, hT = 1, y = F - hT * T) {
      add({ type: 'block', x, y, w: wT * T, h: hT * T });
      return api;
    },
    blockAt(x, y, wT = 1, hT = 1) {
      add({ type: 'block', x, y, w: wT * T, h: hT * T });
      return api;
    },
    platform(x, y, wT = 3) {
      add({ type: 'block', x, y, w: wT * T, h: 18, platform: true });
      return api;
    },
    saw(x, y = F - 34, r = 32) {
      add({ type: 'saw', x, y, r });
      return api;
    },
    pad(x, y = F, w = 56) {
      add({ type: 'pad', x, y, w });
      return api;
    },
    orb(x, y, r = 22, kind = 'yellow') {
      add({ type: 'orb', x, y, r, kind });
      return api;
    },
    portal(x, kind, y = F - 300, h = 300, mul) {
      add({ type: 'portal', kind, x, y, h, w: 54, mul });
      return api;
    },
    shard(x, y) {
      shards.push({ id: `${id}-s${++shardCount}`, x, y, taken: false });
      return api;
    },
  };
  define(api);
  objects.sort((a, b) => a.x - b.x);
  return { id, ...config, objects, shards };
}

const LEVELS = [
  build('l1', {
    name: 'Stereo Dawn',
    tagline: 'Where the beat begins',
    difficulty: 1,
    speed: 360,
    length: 10800,
    theme: THEMES.dawn,
    bpm: 126,
    root: 57, // A3
    scale: [0, 3, 5, 7, 10],
    musicPattern: [0, 3, 7, 10, 7, 3, 5, 7, 10, 12, 10, 7, 5, 3, 0, 3],
  }, (l) => {
    l.spike(1300);
    l.spike(1900);
    l.spike(2450);
    l.spike(3000, 2);
    l.block(3600, 1, 1);
    l.spike(4200);
    l.spike(4750, 2);
    l.block(5350, 2, 1);
    l.spike(5950);
    l.spike(6500);
    l.shard(6548, 416);
    l.pad(7100);
    l.shard(7320, 330);
    l.spike(7900);
    l.spike(8450, 2);
    l.block(9000, 1, 2);
    l.spike(9550, 3);
    l.spike(10150);
    l.shard(10195, 420);
  }),

  build('l2', {
    name: 'Neon Rush',
    tagline: 'Pick up the pace',
    difficulty: 2,
    speed: 400,
    length: 12000,
    theme: THEMES.rush,
    bpm: 140,
    root: 50, // D3
    scale: [0, 2, 3, 5, 7, 8, 10],
    musicPattern: [0, 3, 7, 10, 12, 10, 7, 3, 0, 5, 8, 12, 10, 7, 5, 3],
  }, (l) => {
    l.spike(1250);
    l.shard(1350, 430);
    l.spike(1750, 2);
    l.saw(2350);
    l.block(2900, 1, 1);
    l.spike(3450, 2);
    l.pad(4050);
    l.shard(4280, 330);
    l.spike(4700, 3);
    l.saw(5350);
    l.block(5900, 2, 1);
    l.spike(6500, 2);
    l.spike(7100);
    l.shard(7200, 430);
    l.saw(7700);
    l.spike(8300, 3);
    l.block(8900, 1, 2);
    l.spike(9500, 2);
    l.spike(10100, 3);
    l.block(10700, 2, 1);
    l.spike(11300);
  }),

  build('l3', {
    name: 'Circuit Breaker',
    tagline: 'Ride the current',
    difficulty: 3,
    speed: 420,
    length: 13200,
    theme: THEMES.circuit,
    bpm: 146,
    root: 52, // E3
    scale: [0, 2, 3, 5, 7, 9, 10],
    musicPattern: [0, 3, 5, 7, 10, 12, 10, 7, 5, 3, 0, 7, 10, 12, 10, 5],
  }, (l) => {
    l.spike(1250);
    l.spike(1800, 2);
    l.saw(2400);
    l.block(3000, 2, 1);
    l.spike(3650, 3);
    l.pad(4250);
    l.platform(4500, 430, 4);
    l.shard(4620, 375);
    l.spike(5000);
    l.spike(5550, 2);
    l.saw(6150);
    l.block(6750, 1, 2);
    l.spike(7350, 3);
    l.shard(7450, 430);
    l.spike(7950);
    l.pad(8500);
    l.shard(8730, 330);
    l.spike(9100, 2);
    l.saw(9700);
    l.spike(10250, 3);
    l.block(10850, 2, 1);
    l.spike(11450, 2);
    l.spike(12050);
    l.spike(12600, 3);
  }),

  build('l4', {
    name: 'Gravity Well',
    tagline: 'Up is the new down',
    difficulty: 4,
    speed: 400,
    length: 14300,
    theme: THEMES.gravity,
    bpm: 150,
    root: 49, // C#3
    scale: [0, 2, 3, 6, 7, 10, 11],
    musicPattern: [0, 3, 6, 10, 11, 10, 6, 3, 0, 7, 10, 11, 13, 11, 10, 6],
  }, (l) => {
    l.spike(1200);
    l.spike(1750, 2);
    l.saw(2350);
    l.block(2900, 1, 1);
    l.spike(3450);
    l.portal(4000, 'gravity', C, F - C);
    l.spikeDown(4550);
    l.spikeDown(5100, 2);
    l.shard(5350, 100);
    l.spikeDown(5650);
    l.shard(5750, 270);
    l.spikeDown(6200, 3);
    l.spikeDown(6850);
    l.portal(7350, 'gravity', C, F - C);
    l.spike(7900);
    l.spike(8450, 2);
    l.saw(9050);
    l.block(9600, 1, 2);
    l.spike(10200, 3);
    l.pad(10800);
    l.shard(11030, 330);
    l.spike(11450);
    l.spike(12000, 2);
    l.saw(12600);
    l.spike(13150, 3);
    l.spike(13750);
  }),

  build('l5', {
    name: 'Final Overdrive',
    tagline: 'No brakes. No mercy.',
    difficulty: 5,
    speed: 440,
    length: 15900,
    theme: THEMES.overdrive,
    bpm: 160,
    root: 53, // F3
    scale: [0, 1, 3, 5, 7, 8, 10],
    musicPattern: [0, 3, 5, 7, 8, 10, 12, 10, 8, 7, 5, 3, 0, 10, 12, 15],
  }, (l) => {
    l.spike(1100);
    l.spike(1600, 2);
    l.saw(2150);
    l.block(2700, 2, 1);
    l.spike(3300, 3);
    l.portal(3850, 'speed', F - 300, 300, 1.2);
    l.spike(4300);
    l.spike(4850, 2);
    l.saw(5450);
    l.block(6050, 1, 2);
    l.spike(6650, 3);
    l.pad(7250);
    l.shard(7480, 330);
    l.spike(7900);
    l.portal(8450, 'gravity', C, F - C);
    l.spikeDown(9150);
    l.spikeDown(9750, 2);
    l.shard(10160, 100);
    l.spikeDown(10350);
    l.spikeDown(10900);
    l.portal(11400, 'gravity', C, F - C);
    l.portal(11900, 'speed', F - 300, 300, 1.3);
    l.spike(12350);
    l.shard(12450, 430);
    l.spike(12950, 2);
    l.saw(13550);
    l.spike(14150, 3);
    l.block(14800, 2, 1);
    l.spike(15400, 2);
  }),

  build('l6', {
    name: 'Time Machines',
    tagline: 'Rewind the rhythm',
    difficulty: 6,
    speed: 420,
    length: 15200,
    theme: THEMES.time,
    bpm: 156,
    root: 55, // G3
    scale: [0, 2, 3, 5, 7, 8, 10],
    musicPattern: [0, 3, 7, 8, 10, 12, 10, 8, 7, 5, 3, 0, 5, 8, 12, 10],
  }, (l) => {
    l.spike(1100);
    l.spike(1650, 2);
    l.saw(2250);
    l.block(2800, 2, 1);
    l.spike(3350, 3);
    l.shard(3450, 430);
    l.pad(3900);
    l.spike(4500);
    l.saw(5100);
    l.block(5700, 1, 2);
    l.spike(6250, 3);
    l.portal(7100, 'gravity', C, F - C);
    l.spikeDown(7700);
    l.spikeDown(8250, 2);
    l.shard(8350, 270);
    l.spikeDown(8650);
    l.portal(9250, 'gravity', C, F - C);
    l.spike(9800);
    l.spike(10350, 2);
    l.saw(10950);
    l.block(11500, 2, 1);
    l.spike(12050, 3);
    l.pad(12700);
    l.shard(12920, 330);
    l.spike(13300);
    l.spike(13850, 2);
    l.block(14400, 1, 2);
    l.spike(14900);
  }),

  build('l7', {
    name: 'Ystep',
    tagline: 'Every step hits harder',
    difficulty: 7,
    speed: 440,
    length: 16000,
    theme: THEMES.ystep,
    bpm: 164,
    root: 54, // F#3
    scale: [0, 2, 3, 5, 7, 9, 10],
    musicPattern: [0, 3, 5, 7, 9, 12, 9, 7, 5, 3, 0, 7, 12, 10, 7, 5],
  }, (l) => {
    l.spike(1000);
    l.spike(1550, 2);
    l.saw(2100);
    l.block(2650, 1, 1);
    l.spike(3200, 3);
    l.shard(3300, 430);
    l.pad(3750);
    l.saw(4400);
    l.spike(4950, 2);
    l.block(5500, 2, 1);
    l.spike(6050);
    l.portal(6800, 'gravity', C, F - C);
    l.spikeDown(7400);
    l.spikeDown(7950, 2);
    l.shard(8050, 270);
    l.spikeDown(8350);
    l.portal(8950, 'gravity', C, F - C);
    l.portal(9500, 'speed', F - 300, 300, 1.2);
    l.spike(10000);
    l.spike(10600, 2);
    l.saw(11200);
    l.block(11800, 2, 1);
    l.spike(12400, 3);
    l.pad(13000);
    l.shard(13220, 330);
    l.spike(13600);
    l.spike(14150, 2);
    l.block(14700, 1, 2);
    l.spike(15300);
  }),

  build('l8', {
    name: 'Clutterfunk',
    tagline: 'Order inside the chaos',
    difficulty: 8,
    speed: 460,
    length: 17000,
    theme: THEMES.clutter,
    bpm: 170,
    root: 51, // D#3
    scale: [0, 1, 3, 5, 7, 8, 10],
    musicPattern: [0, 3, 5, 7, 8, 10, 12, 10, 8, 7, 5, 3, 0, 10, 12, 15],
  }, (l) => {
    l.spike(900);
    l.spike(1400, 2);
    l.saw(1900);
    l.block(2400, 1, 1);
    l.spike(2900, 3);
    l.shard(3000, 430);
    l.pad(3450);
    l.saw(4050);
    l.spike(4600, 2);
    l.block(5150, 2, 1);
    l.spike(5700, 3);
    l.portal(6350, 'speed', F - 300, 300, 1.15);
    l.spike(6900);
    l.saw(7500);
    l.portal(8150, 'gravity', C, F - C);
    l.spikeDown(8750);
    l.spikeDown(9300, 2);
    l.shard(9400, 270);
    l.spikeDown(9700);
    l.portal(10300, 'gravity', C, F - C);
    l.portal(10850, 'speed', F - 300, 300, 1.2);
    l.spike(11350);
    l.spike(11950, 2);
    l.saw(12550);
    l.block(13150, 2, 1);
    l.spike(13750, 3);
    l.pad(14350);
    l.shard(14570, 330);
    l.spike(14950);
    l.spike(15500, 2);
    l.block(16050, 1, 2);
    l.spike(16600);
  }),
];

export { LEVELS, THEMES };

export const DIFFICULTY_LABELS = ['Easy', 'Normal', 'Hard', 'Harder', 'Insane', 'Extreme', 'Chaos', 'Legendary'];
export const DIFFICULTY_COLORS = ['#5cf28a', '#59c8ff', '#ffd35c', '#ff8a5c', '#ff4d6d', '#ff5ec4', '#a8ff60', '#42f5e4'];
