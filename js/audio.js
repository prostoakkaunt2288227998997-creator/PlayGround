// Tiny procedural synthwave engine: no audio files, all WebAudio.
const MIDI = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor(muted = false) {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.muted = muted;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.loop = 0;
    this.level = null;
    this.playing = false;
    this.noiseBuffer = null;
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.55;
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.7;
      this.sfxBus.connect(this.master);
      this.noiseBuffer = this.makeNoise();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.02);
  }

  tone({ freq, endFreq, type = 'square', dur = 0.12, gain = 0.08, attack = 0.006, bus = 'sfx', filter = 0, detune = 0 }) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    osc.detune.value = detune;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let node = osc;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      node.connect(f);
      node = f;
    }
    node.connect(amp);
    amp.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    osc.start(now);
    osc.stop(now + dur + 0.03);
  }

  noise({ dur = 0.1, gain = 0.1, type = 'highpass', freq = 6000, bus = 'sfx' }) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f);
    f.connect(amp);
    amp.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  playMusic(level) {
    if (!this.ensure()) return;
    this.stopMusic();
    this.level = level;
    this.step = 0;
    this.loop = 0;
    this.playing = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.08);
    this.timer = setInterval(() => this.scheduler(), 25);
    this.scheduler();
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
  }

  scheduler() {
    if (!this.playing || !this.ctx) return;
    const stepDur = 60 / this.level.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.14) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.loop++;
      this.nextTime += stepDur;
    }
  }

  playStep(step, when, stepDur) {
    if (!this.ctx) return;
    const lv = this.level;
    const root = lv.root;
    const pattern = lv.musicPattern;
    const degree = pattern[step] || 0;
    const octave = this.loop % 8 === 7 ? 12 : 0;
    const leadFreq = MIDI(root + 12 + degree + octave);
    const now = when;

    // Lead (scheduled slightly ahead).
    this.scheduleOsc('square', leadFreq, now, stepDur * 0.86, 0.055, 2400);
    if (step % 4 === 2) this.scheduleOsc('triangle', leadFreq * 0.5, now, stepDur * 1.5, 0.035, 1600);

    // Bass on the beat.
    if (step % 4 === 0) {
      const bassDeg = [0, 0, 5, 3][(this.loop >> 1) % 4];
      this.scheduleOsc('sawtooth', MIDI(root - 12 + bassDeg), now, stepDur * 3.6, 0.11, 380);
    }

    // Drums.
    if (step === 0 || step === 8 || step === 6 || step === 11) this.kick(now);
    if (step === 4 || step === 12) this.snare(now);
    if (step % 2 === 1) this.hat(now, 0.035);
    if (step === 14 && this.loop % 4 === 2) this.hat(now, 0.06);

    // Pad swell each bar.
    if (step === 0 && this.loop % 2 === 0) {
      for (const d of [0, 7, 10]) this.scheduleOsc('sawtooth', MIDI(root + d), now, stepDur * 15, 0.012, 900);
    }
  }

  scheduleOsc(type, freq, when, dur, gain, filterFreq) {
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, when);
    filter.Q.value = 2;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(gain, when + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(this.musicBus);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  kick(when) {
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(42, when + 0.17);
    amp.gain.setValueAtTime(0.4, when);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    osc.connect(amp);
    amp.connect(this.musicBus);
    osc.start(when);
    osc.stop(when + 0.22);
  }

  snare(when) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2100;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.16, when);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.13);
    src.connect(f);
    f.connect(amp);
    amp.connect(this.musicBus);
    src.start(when);
    src.stop(when + 0.15);
  }

  hat(when, gain) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7800;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, when);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
    src.connect(f);
    f.connect(amp);
    amp.connect(this.musicBus);
    src.start(when);
    src.stop(when + 0.05);
  }

  duckMusic(on) {
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(on ? 0.12 : 0.55, this.ctx.currentTime, 0.1);
  }

  sfx(name) {
    if (!this.ensure() || this.muted) return;
    if (name === 'jump') {
      this.tone({ freq: 460, endFreq: 720, type: 'square', dur: 0.075, gain: 0.055, filter: 3000 });
    } else if (name === 'land') {
      this.tone({ freq: 140, endFreq: 70, type: 'sine', dur: 0.09, gain: 0.05 });
    } else if (name === 'orb') {
      this.tone({ freq: 620, endFreq: 1180, type: 'triangle', dur: 0.16, gain: 0.1 });
    } else if (name === 'pad') {
      this.tone({ freq: 360, endFreq: 1020, type: 'sawtooth', dur: 0.18, gain: 0.08, filter: 2200 });
    } else if (name === 'portal') {
      this.tone({ freq: 180, endFreq: 860, type: 'sawtooth', dur: 0.28, gain: 0.07, filter: 1800 });
    } else if (name === 'shard') {
      this.tone({ freq: 980, type: 'sine', dur: 0.14, gain: 0.08 });
      setTimeout(() => this.tone({ freq: 1470, type: 'sine', dur: 0.2, gain: 0.07 }), 70);
    } else if (name === 'death') {
      this.noise({ dur: 0.28, gain: 0.2, type: 'lowpass', freq: 1800 });
      this.tone({ freq: 300, endFreq: 48, type: 'sawtooth', dur: 0.4, gain: 0.12, filter: 1200 });
    } else if (name === 'win') {
      [0, 4, 7, 12].forEach((semi, i) => {
        setTimeout(() => this.tone({ freq: MIDI(69 + semi), type: 'triangle', dur: 0.3, gain: 0.09 }), i * 100);
      });
    } else if (name === 'click') {
      this.tone({ freq: 660, endFreq: 780, type: 'square', dur: 0.05, gain: 0.04, filter: 3200 });
    } else if (name === 'unlock') {
      [0, 7, 12].forEach((semi, i) => {
        setTimeout(() => this.tone({ freq: MIDI(72 + semi), type: 'sine', dur: 0.25, gain: 0.06 }), i * 90);
      });
    }
  }
}
