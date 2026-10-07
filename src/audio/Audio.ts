/**
 * All sound is synthesised at runtime with WebAudio: no audio files ship with the game.
 * SFX are short recipes built from oscillators, filtered noise and envelopes; music is a
 * small step sequencer with per-map scales, tempo and timbre.
 */

type Recipe = (a: AudioEngine, t: number, v: number) => void;

interface SongDef {
  bpm: number;
  root: number; // midi
  scale: number[];
  prog: number[]; // scale degrees per bar
  lead: OscillatorType;
  pad: OscillatorType;
  drums: number; // 0 none .. 2 driving
  swing: number;
  arp: number[]; // arpeggio pattern of chord tones (16 steps, -1 rest)
  bassPat: number[];
  bright: number; // filter cutoff
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];
const HARM = [0, 2, 3, 5, 7, 8, 11];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const LYD = [0, 2, 4, 6, 7, 9, 11];

const SONGS: Record<string, SongDef> = {
  menu: { bpm: 84, root: 50, scale: DORIAN, prog: [0, 5, 3, 4], lead: 'triangle', pad: 'sine', drums: 0, swing: 0, arp: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 2, -1, 3, -1, 2, -1], bassPat: [0, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1], bright: 1800 },
  forest: { bpm: 112, root: 45, scale: DORIAN, prog: [0, 6, 5, 4], lead: 'square', pad: 'triangle', drums: 1, swing: 0.08, arp: [0, 1, 2, 1, 3, 2, 1, 2, 0, 1, 2, 3, 4, 3, 2, 1], bassPat: [0, -1, 0, -1, -1, -1, 0, -1, 0, -1, -1, 0, -1, -1, 0, -1], bright: 2400 },
  city: { bpm: 118, root: 47, scale: HARM, prog: [0, 5, 3, 4], lead: 'sawtooth', pad: 'triangle', drums: 2, swing: 0.12, arp: [0, -1, 2, 1, -1, 2, 3, -1, 0, -1, 2, 1, 4, -1, 3, 2], bassPat: [0, -1, 0, 0, -1, -1, 0, -1, 0, -1, 0, 0, -1, 0, -1, -1], bright: 2000 },
  catacombs: { bpm: 100, root: 43, scale: PHRYG, prog: [0, 1, 0, 6], lead: 'triangle', pad: 'sawtooth', drums: 1, swing: 0, arp: [0, -1, -1, 2, -1, -1, 1, -1, 0, -1, -1, 3, -1, 2, -1, -1], bassPat: [0, -1, -1, -1, 0, -1, -1, -1, 0, -1, -1, -1, 0, -1, 0, -1], bright: 1400 },
  volcano: { bpm: 132, root: 40, scale: PHRYG, prog: [0, 1, 6, 4], lead: 'sawtooth', pad: 'square', drums: 2, swing: 0, arp: [0, 0, 2, 0, 3, 0, 2, 4, 0, 0, 2, 0, 5, 4, 3, 2], bassPat: [0, 0, -1, 0, 0, -1, 0, -1, 0, 0, -1, 0, 0, 0, -1, 0], bright: 2600 },
  tundra: { bpm: 104, root: 50, scale: MINOR, prog: [0, 5, 2, 6], lead: 'sine', pad: 'triangle', drums: 1, swing: 0.05, arp: [0, 2, 4, 2, 5, 4, 2, 4, 0, 2, 4, 6, 5, 4, 2, 1], bassPat: [0, -1, -1, -1, 0, -1, -1, 0, 0, -1, -1, -1, 0, -1, -1, -1], bright: 3000 },
  ruins: { bpm: 124, root: 46, scale: LYD, prog: [0, 1, 5, 4], lead: 'square', pad: 'sine', drums: 2, swing: 0.06, arp: [0, 2, 4, 6, 4, 2, 5, 3, 0, 2, 4, 6, 7, 6, 4, 2], bassPat: [0, -1, 0, -1, 0, -1, 0, 0, 0, -1, 0, -1, 0, 0, -1, 0], bright: 3200 },
  boss: { bpm: 140, root: 41, scale: HARM, prog: [0, 0, 5, 4], lead: 'sawtooth', pad: 'sawtooth', drums: 2, swing: 0, arp: [0, 2, 0, 3, 0, 4, 0, 3, 0, 2, 0, 6, 5, 4, 3, 2], bassPat: [0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0, 0, 0, -1, 0, 0], bright: 2800 },
  victory: { bpm: 96, root: 52, scale: MAJOR, prog: [0, 3, 4, 0], lead: 'triangle', pad: 'sine', drums: 0, swing: 0, arp: [0, 1, 2, 4, 2, 1, 0, -1, 0, 2, 4, 6, 4, 2, 0, -1], bassPat: [0, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1], bright: 2400 },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Menu and interface sounds follow the UI volume slider. */
const UI_SOUNDS = new Set(['ui', 'uiBack', 'select', 'buy', 'denied']);

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  uiBus!: GainNode;
  /** Bus the current recipe plays into (sfx or ui). */
  private bus!: GainNode;
  musicBus!: GainNode;
  private comp!: DynamicsCompressorNode;
  private noiseBuf!: AudioBuffer;
  private last: Record<string, number> = {};
  private voices = 0;
  private sfxVol = 0.8;
  private musicVol = 0.6;
  private uiVol = 0.8;
  private masterVol = 1;
  private song: SongDef | null = null;
  private songId = '';
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private musicFilter!: BiquadFilterNode;
  private intensity = 0;

  /** Must be called from a user gesture on mobile. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.ratio.value = 6;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.sfxBus = this.ctx.createGain();
      this.uiBus = this.ctx.createGain();
      this.bus = this.sfxBus;
      this.musicBus = this.ctx.createGain();
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 2400;
      this.sfxBus.connect(this.comp);
      this.uiBus.connect(this.comp);
      this.musicBus.connect(this.musicFilter);
      this.musicFilter.connect(this.comp);
      this.comp.connect(this.master);
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.setVolumes(this.masterVol, this.sfxVol, this.musicVol, this.uiVol);
      if (this.songId) {
        const id = this.songId;
        this.songId = '';
        this.playMusic(id);
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(master: number, sfx: number, music: number, ui: number) {
    this.masterVol = master;
    this.sfxVol = sfx;
    this.musicVol = music;
    this.uiVol = ui;
    if (!this.ctx) return;
    this.master.gain.value = 0.9 * master;
    this.uiBus.gain.value = ui * 0.9;
    this.sfxBus.gain.value = sfx * 0.9;
    this.musicBus.gain.value = music * 0.32;
  }

  suspend(on: boolean) {
    if (!this.ctx) return;
    if (on) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  // ------------------------------------------------------------- primitives
  tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, attack = 0.005, out?: AudioNode) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out ?? this.bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(t: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, q = 1, out?: AudioNode) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(out ?? this.bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------- sfx
  play(id: string, volume = 1) {
    const ui = UI_SOUNDS.has(id);
    if (!this.ctx || this.ctx.state !== 'running' || (ui ? this.uiVol : this.sfxVol) <= 0 || this.masterVol <= 0) return;
    const now = this.ctx.currentTime;
    const gap = MIN_GAP[id] ?? 0.045;
    if (now - (this.last[id] ?? -1) < gap) return;
    if (this.voices > 28) return;
    this.last[id] = now;
    const r = RECIPES[id];
    if (!r) return;
    this.voices++;
    setTimeout(() => this.voices--, 250);
    this.bus = ui ? this.uiBus : this.sfxBus;
    r(this, now, Math.min(1.2, volume));
    this.bus = this.sfxBus;
  }

  // ------------------------------------------------------------- music
  playMusic(id: string) {
    if (this.songId === id) return;
    this.songId = id;
    this.song = SONGS[id] ?? null;
    if (!this.ctx) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.musicFilter.frequency.setTargetAtTime(this.song?.bright ?? 2000, this.ctx.currentTime, 0.5);
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 50);
  }

  /** 0..1 raises drum density and filter brightness (crowds, bosses). */
  setIntensity(v: number) {
    this.intensity = v;
    if (this.ctx && this.song) this.musicFilter.frequency.setTargetAtTime(this.song.bright * (0.8 + v * 0.5), this.ctx.currentTime, 1);
  }

  stopMusic() {
    this.songId = '';
    this.song = null;
  }

  private schedule() {
    if (!this.ctx || !this.song || this.musicVol <= 0 || this.ctx.state !== 'running') {
      if (this.ctx) this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05);
      return;
    }
    const s = this.song;
    const stepDur = 60 / s.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const st = this.step % 16;
      const bar = Math.floor(this.step / 16) % s.prog.length;
      const t = this.nextTime + (st % 2 === 1 ? s.swing * stepDur : 0);
      this.musicStep(s, t, st, bar, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private note(s: SongDef, deg: number, oct = 0): number {
    const n = s.scale.length;
    const o = Math.floor(deg / n);
    const d = ((deg % n) + n) % n;
    return s.root + s.scale[d] + 12 * (o + oct);
  }

  private musicStep(s: SongDef, t: number, st: number, bar: number, sd: number) {
    const out = this.musicBus;
    const chord = s.prog[bar];
    // pad: chord on bar start
    if (st === 0) {
      for (const k of [0, 2, 4]) this.tone(t, s.pad, mtof(this.note(s, chord + k, 1)), mtof(this.note(s, chord + k, 1)), sd * 16, 0.05, 0.4, out);
    }
    // bass
    if (s.bassPat[st] >= 0) this.tone(t, 'triangle', mtof(this.note(s, chord, 0)), mtof(this.note(s, chord, 0)) * 0.98, sd * 1.8, 0.22, 0.005, out);
    // arpeggio lead
    const a = s.arp[st];
    if (a >= 0 && (this.step >> 6) % 4 !== 3) {
      const f = mtof(this.note(s, chord + a, 2));
      this.tone(t, s.lead, f, f, sd * 1.4, s.lead === 'sawtooth' || s.lead === 'square' ? 0.035 : 0.06, 0.004, out);
    }
    // drums
    const dr = s.drums + (this.intensity > 0.6 ? 1 : 0);
    if (dr > 0) {
      if (st % 8 === 0 || (dr > 1 && st % 8 === 6 && Math.random() < 0.5)) this.tone(t, 'sine', 120, 40, 0.18, 0.4, 0.002, out);
      if (st % 8 === 4) this.noise(t, 0.12, 0.16, 'bandpass', 1800, 900, 0.8, out);
      if (dr > 1 && st % 2 === 0) this.noise(t, 0.04, 0.05, 'highpass', 7000, 6000, 1, out);
      if (dr > 2 && st % 2 === 1) this.noise(t, 0.03, 0.035, 'highpass', 8000, 7000, 1, out);
    }
  }
}

const MIN_GAP: Record<string, number> = {
  hurt: 0.12,
  coin: 0.05,
  levelup: 0.3,
  explosion: 0.07,
  bossRoar: 1,
  slash: 0.06,
  zap: 0.05,
  hit: 0.03,
  kill: 0.03,
  xp: 0.035,
};

const RECIPES: Record<string, Recipe> = {
  slash: (a, t, v) => a.noise(t, 0.12, 0.25 * v, 'bandpass', 3200, 900, 1.4),
  punch: (a, t, v) => {
    a.tone(t, 'sine', 180, 60, 0.1, 0.4 * v);
    a.noise(t, 0.06, 0.2 * v, 'lowpass', 2000, 400);
  },
  thrust: (a, t, v) => a.noise(t, 0.16, 0.25 * v, 'bandpass', 1400, 4000, 2),
  throw: (a, t, v) => a.noise(t, 0.08, 0.15 * v, 'highpass', 3000, 5000, 1),
  magic: (a, t, v) => {
    a.tone(t, 'triangle', 660, 1320, 0.15, 0.12 * v);
    a.tone(t + 0.03, 'sine', 990, 1980, 0.12, 0.08 * v);
  },
  fire: (a, t, v) => {
    a.noise(t, 0.25, 0.22 * v, 'lowpass', 1500, 300, 1);
    a.tone(t, 'sawtooth', 160, 80, 0.15, 0.06 * v);
  },
  ice: (a, t, v) => {
    a.tone(t, 'sine', 1800, 2600, 0.12, 0.1 * v);
    a.noise(t, 0.1, 0.1 * v, 'highpass', 5000, 8000, 3);
  },
  bow: (a, t, v) => {
    a.tone(t, 'triangle', 300, 120, 0.1, 0.18 * v);
    a.noise(t, 0.06, 0.1 * v, 'highpass', 2500, 5000);
  },
  whoosh: (a, t, v) => a.noise(t, 0.22, 0.18 * v, 'bandpass', 600, 2400, 1.5),
  jump: (a, t, v) => {
    a.noise(t, 0.12, 0.12 * v, 'bandpass', 900, 2600, 1.2);
    a.tone(t, 'sine', 260, 420, 0.08, 0.08 * v);
  },
  land: (a, t, v) => {
    a.noise(t, 0.12, 0.22 * v, 'lowpass', 900, 200, 0.8);
    a.tone(t, 'sine', 120, 60, 0.08, 0.16 * v);
  },
  nightfall: (a, t, v) => [392, 311, 262, 196].forEach((f, i) => a.tone(t + i * 0.18, 'triangle', f, f * 0.99, 0.6, 0.1 * v)),
  dawn: (a, t, v) => [392, 494, 587, 784].forEach((f, i) => a.tone(t + i * 0.12, 'sine', f, f * 1.01, 0.5, 0.09 * v)),
  warning: (a, t, v) => [0, 0.3, 0.6].forEach((d) => a.tone(t + d, 'square', 440, 330, 0.2, 0.07 * v)),
  achieve: (a, t, v) => [659, 784, 988, 1318].forEach((f, i) => a.tone(t + i * 0.07, 'triangle', f, f, 0.3, 0.12 * v)),
  ignite: (a, t, v) => a.noise(t, 0.18, 0.16 * v, 'bandpass', 1200, 400, 1.2),
  frost: (a, t, v) => {
    a.tone(t, 'triangle', 2400, 3200, 0.08, 0.06 * v);
    a.noise(t, 0.08, 0.08 * v, 'highpass', 6000, 9000, 4);
  },
  venom: (a, t, v) => a.noise(t, 0.16, 0.1 * v, 'bandpass', 500, 900, 5),
  shadow: (a, t, v) => a.tone(t, 'sawtooth', 110, 70, 0.22, 0.06 * v),
  saw: (a, t, v) => a.tone(t, 'sawtooth', 900, 700, 0.1, 0.06 * v),
  zap: (a, t, v) => {
    a.tone(t, 'square', 1200, 200, 0.1, 0.08 * v);
    a.noise(t, 0.08, 0.12 * v, 'highpass', 4000, 2000);
  },
  beam: (a, t, v) => a.tone(t, 'sawtooth', 440, 880, 0.25, 0.08 * v, 0.02),
  pulse: (a, t, v) => a.tone(t, 'sine', 220, 90, 0.3, 0.25 * v),
  wind: (a, t, v) => a.noise(t, 0.4, 0.15 * v, 'bandpass', 400, 1200, 3),
  glass: (a, t, v) => {
    a.tone(t, 'triangle', 2200, 1800, 0.18, 0.08 * v);
    a.noise(t, 0.12, 0.12 * v, 'highpass', 6000, 3000, 2);
  },
  explosion: (a, t, v) => {
    a.noise(t, 0.5, 0.45 * v, 'lowpass', 2400, 120, 0.7);
    a.tone(t, 'sine', 140, 30, 0.45, 0.45 * v);
  },
  mine: (a, t, v) => a.tone(t, 'square', 880, 880, 0.05, 0.06 * v),
  bones: (a, t, v) => {
    a.noise(t, 0.05, 0.15 * v, 'bandpass', 2000, 1500, 4);
    a.noise(t + 0.05, 0.05, 0.12 * v, 'bandpass', 1600, 1200, 4);
  },
  crate: (a, t, v) => {
    a.noise(t, 0.15, 0.3 * v, 'bandpass', 900, 300, 2);
    a.tone(t, 'square', 120, 60, 0.1, 0.1 * v);
  },
  shield: (a, t, v) => a.tone(t, 'triangle', 800, 400, 0.25, 0.15 * v),
  hurt: (a, t, v) => {
    a.tone(t, 'square', 220, 90, 0.16, 0.18 * v);
    a.noise(t, 0.1, 0.15 * v, 'lowpass', 1600, 400);
  },
  revive: (a, t, v) => [523, 659, 784, 1046].forEach((f, i) => a.tone(t + i * 0.08, 'triangle', f, f, 0.35, 0.16 * v)),
  heal: (a, t, v) => [523, 784].forEach((f, i) => a.tone(t + i * 0.07, 'sine', f, f * 1.01, 0.25, 0.13 * v)),
  coin: (a, t, v) => {
    a.tone(t, 'square', 1318, 1318, 0.05, 0.05 * v);
    a.tone(t + 0.05, 'square', 1760, 1760, 0.12, 0.05 * v);
  },
  xp: (a, t, v) => a.tone(t, 'sine', 1400 + Math.random() * 600, 2200, 0.05, 0.05 * v),
  magnet: (a, t, v) => a.tone(t, 'sine', 300, 1600, 0.5, 0.15 * v, 0.05),
  powerup: (a, t, v) => [440, 554, 659, 880].forEach((f, i) => a.tone(t + i * 0.05, 'square', f, f, 0.12, 0.06 * v)),
  chestDrop: (a, t, v) => {
    a.tone(t, 'sine', 90, 50, 0.3, 0.4 * v);
    a.noise(t, 0.2, 0.2 * v, 'lowpass', 900, 200);
  },
  chestOpen: (a, t, v) => [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => a.tone(t + i * 0.07, 'triangle', f, f, 0.4, 0.12 * v)),
  levelup: (a, t, v) => [392, 523, 659, 784].forEach((f, i) => a.tone(t + i * 0.06, 'square', f, f, 0.2, 0.07 * v)),
  death: (a, t, v) => [392, 330, 262, 196].forEach((f, i) => a.tone(t + i * 0.18, 'triangle', f, f * 0.97, 0.4, 0.18 * v)),
  victory: (a, t, v) => [523, 659, 784, 659, 784, 1046].forEach((f, i) => a.tone(t + i * 0.12, 'square', f, f, 0.3, 0.08 * v)),
  bossRoar: (a, t, v) => {
    a.tone(t, 'sawtooth', 90, 50, 1.0, 0.3 * v, 0.1);
    a.noise(t, 1.0, 0.25 * v, 'lowpass', 600, 150, 2);
  },
  bossPhase: (a, t, v) => {
    a.tone(t, 'sawtooth', 70, 140, 0.6, 0.25 * v, 0.05);
    a.noise(t, 0.6, 0.2 * v, 'bandpass', 300, 1200, 2);
  },
  bossShoot: (a, t, v) => a.tone(t, 'square', 330, 160, 0.12, 0.07 * v),
  bossCharge: (a, t, v) => a.tone(t, 'sawtooth', 80, 400, 0.6, 0.15 * v, 0.1),
  summon: (a, t, v) => {
    a.tone(t, 'triangle', 200, 600, 0.4, 0.12 * v, 0.05);
    a.noise(t, 0.4, 0.1 * v, 'bandpass', 500, 2000, 4);
  },
  teleport: (a, t, v) => a.tone(t, 'sine', 1600, 200, 0.3, 0.12 * v),
  dash: (a, t, v) => a.noise(t, 0.3, 0.25 * v, 'bandpass', 300, 1500, 1),
  slam: (a, t, v) => {
    a.tone(t, 'sine', 100, 30, 0.5, 0.5 * v);
    a.noise(t, 0.35, 0.3 * v, 'lowpass', 1200, 100);
  },
  bossDeath: (a, t, v) => {
    a.noise(t, 1.4, 0.5 * v, 'lowpass', 3000, 60, 0.7);
    a.tone(t, 'sine', 160, 25, 1.4, 0.5 * v);
    [523, 659, 784].forEach((f, i) => a.tone(t + 0.6 + i * 0.1, 'triangle', f, f, 0.5, 0.1 * v));
  },
  hit: (a, t, v) => a.noise(t, 0.04, 0.1 * v, 'bandpass', 1800, 900, 2),
  kill: (a, t, v) => a.tone(t, 'square', 300 + Math.random() * 120, 80, 0.06, 0.05 * v),
  ui: (a, t, v) => a.tone(t, 'square', 880, 880, 0.04, 0.05 * v),
  uiBack: (a, t, v) => a.tone(t, 'square', 520, 440, 0.06, 0.05 * v),
  select: (a, t, v) => {
    a.tone(t, 'square', 660, 660, 0.05, 0.05 * v);
    a.tone(t + 0.05, 'square', 990, 990, 0.08, 0.05 * v);
  },
  evolution: (a, t, v) => [262, 330, 392, 523, 659, 784, 1046].forEach((f, i) => a.tone(t + i * 0.06, 'sawtooth', f, f, 0.3, 0.05 * v)),
  buy: (a, t, v) => [784, 1046, 1318].forEach((f, i) => a.tone(t + i * 0.05, 'square', f, f, 0.1, 0.05 * v)),
  denied: (a, t, v) => a.tone(t, 'square', 160, 140, 0.15, 0.08 * v),
  warn: (a, t, v) => [880, 880].forEach((f, i) => a.tone(t + i * 0.18, 'square', f, f, 0.12, 0.06 * v)),
};

export const audio = new AudioEngine();
