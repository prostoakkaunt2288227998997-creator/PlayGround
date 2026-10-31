import { LEVELS } from './levels.js';

export const CUBES = [
  {
    id: 'classic', name: 'Classic', pattern: 'basic', face: 'happy',
    colors: { a: '#3de0ff', b: '#1663d8', edge: '#b8fbff', glow: '#3de0ff', eye: '#062a4a' },
    condition: () => true,
    unlock: 'Available from the start',
  },
  {
    id: 'ember', name: 'Ember', pattern: 'flame', face: 'determined',
    colors: { a: '#ff9a3c', b: '#d1192b', edge: '#ffe0a3', glow: '#ff7a2f', eye: '#3a0707' },
    condition: (s) => s.completedIds.includes('l1'),
    unlock: 'Complete Stereo Dawn',
  },
  {
    id: 'mint', name: 'Mint Chip', pattern: 'stripes', face: 'happy',
    colors: { a: '#7dffc4', b: '#079e72', edge: '#d6fff1', glow: '#4dffb8', eye: '#03392c' },
    condition: (s) => s.shards >= 3,
    unlock: 'Collect 3 shards',
  },
  {
    id: 'bubble', name: 'Bubblegum', pattern: 'dots', face: 'wink',
    colors: { a: '#ff9ee0', b: '#c62ba5', edge: '#ffd9f4', glow: '#ff6ed4', eye: '#4a0b3a' },
    condition: (s) => s.completedIds.includes('l2'),
    unlock: 'Complete Neon Rush',
  },
  {
    id: 'circuit', name: 'Circuit', pattern: 'circuit', face: 'determined',
    colors: { a: '#ffe45e', b: '#f08a12', edge: '#fff8c4', glow: '#ffc93c', eye: '#3d2600' },
    condition: (s) => s.completedIds.includes('l3'),
    unlock: 'Complete Circuit Breaker',
  },
  {
    id: 'frost', name: 'Frostbite', pattern: 'sparkle', face: 'cool',
    colors: { a: '#c9f4ff', b: '#4b8cff', edge: '#ffffff', glow: '#8fd8ff', eye: '#082a5c' },
    condition: (s) => s.jumps >= 250,
    unlock: 'Jump 250 times',
  },
  {
    id: 'solar', name: 'Solar Flare', pattern: 'rays', face: 'determined',
    colors: { a: '#fff27a', b: '#ff6a00', edge: '#fffbd0', glow: '#ffb300', eye: '#4a1b00' },
    condition: (s) => s.completedIds.includes('l4'),
    unlock: 'Complete Gravity Well',
  },
  {
    id: 'void', name: 'Void Walker', pattern: 'stars', face: 'cool',
    colors: { a: '#8b6bff', b: '#180b3d', edge: '#d9ccff', glow: '#9c7bff', eye: '#e8e0ff' },
    condition: (s) => s.deaths >= 50,
    unlock: 'Die 50 times',
  },
  {
    id: 'prism', name: 'Prism', pattern: 'prism', face: 'wink',
    colors: { a: '#7cf9ff', b: '#9b4dff', edge: '#ffffff', glow: '#b57bff', eye: '#240a4a' },
    condition: (s) => s.shards >= 10,
    unlock: 'Collect 10 shards',
  },
  {
    id: 'rainbow', name: 'Overdrive', pattern: 'rainbow', face: 'determined',
    colors: { a: '#ff5d5d', b: '#635bff', edge: '#fff4b8', glow: '#ff7a3c', eye: '#25052a' },
    condition: (s) => s.levelsCompleted >= LEVELS.length,
    unlock: `Complete all ${LEVELS.length} levels`,
  },
];

export const ACHIEVEMENTS = [
  {
    id: 'first-steps', name: 'First Steps', icon: '★', goal: 1,
    desc: 'Complete Stereo Dawn.',
    progress: (s) => (s.completedIds.includes('l1') ? 1 : 0),
  },
  {
    id: 'double-trouble', name: 'Double Trouble', icon: '✦', goal: 2,
    desc: 'Complete any 2 levels.',
    progress: (s) => Math.min(2, s.levelsCompleted),
  },
  {
    id: 'halfway-hero', name: 'Halfway Hero', icon: '◆', goal: 3,
    desc: 'Complete any 3 levels.',
    progress: (s) => Math.min(3, s.levelsCompleted),
  },
  {
    id: 'legend', name: 'Legend', icon: '♛', goal: LEVELS.length,
    desc: `Complete all ${LEVELS.length} levels.`,
    progress: (s) => Math.min(LEVELS.length, s.levelsCompleted),
  },
  {
    id: 'flawless', name: 'Flawless', icon: '◈', goal: 1,
    desc: 'Complete a level without dying.',
    progress: (s) => Math.min(1, s.perfectRuns),
  },
  {
    id: 'never-give-up', name: 'Never Give Up', icon: '↻', goal: 25,
    desc: 'Crash 25 times. Progress is built on failure.',
    progress: (s) => Math.min(25, s.deaths),
  },
  {
    id: 'jump-machine', name: 'Jump Machine', icon: '↑', goal: 500,
    desc: 'Jump 500 times.',
    progress: (s) => Math.min(500, s.jumps),
  },
  {
    id: 'shard-seeker', name: 'Shard Seeker', icon: '♦', goal: 8,
    desc: 'Collect 8 shards across the levels.',
    progress: (s) => Math.min(8, s.shards),
  },
  {
    id: 'completionist', name: 'Completionist', icon: '✹', goal: LEVELS.length * 3,
    desc: `Collect all ${LEVELS.length * 3} shards.`,
    progress: (s) => Math.min(LEVELS.length * 3, s.shards),
  },
  {
    id: 'fashionista', name: 'Fashionista', icon: '▣', goal: 5,
    desc: 'Unlock 5 different cubes.',
    progress: (s) => Math.min(5, s.cubes),
  },
];

export function computeStats(save) {
  const completedIds = LEVELS.filter((l) => save.levels[l.id]?.completed).map((l) => l.id);
  let shards = 0;
  for (const l of LEVELS) shards += save.levels[l.id]?.shards?.length || 0;
  const base = {
    completedIds,
    levelsCompleted: completedIds.length,
    shards,
    jumps: save.stats.jumps,
    deaths: save.stats.deaths,
    perfectRuns: save.stats.perfectRuns,
    attempts: save.stats.attempts || 0,
    cubes: 0,
  };
  base.cubes = CUBES.filter((c) => c.condition(base)).length;
  return base;
}

export function isCubeUnlocked(cube, stats) {
  return cube.condition(stats);
}

export function achievementIsDone(a, stats) {
  return a.progress(stats) >= a.goal;
}

export function achievementProgressLabel(a, stats) {
  return `${Math.min(a.goal, a.progress(stats))} / ${a.goal}`;
}
