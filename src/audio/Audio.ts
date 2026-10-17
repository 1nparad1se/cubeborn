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

const DORIAN = [0, 2, 3, 5, 7, 9, 10];

const SONGS: Record<string, SongDef> = {
  menu: { bpm: 84, root: 50, scale: DORIAN, prog: [0, 5, 3, 4], lead: 'triangle', pad: 'sine', drums: 0, swing: 0, arp: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 2, -1, 3, -1, 2, -1], bassPat: [0, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1], bright: 1800 },
  forest: { bpm: 112, root: 45, scale: DORIAN, prog: [0, 6, 5, 4], lead: 'square', pad: 'triangle', drums: 1, swing: 0.08, arp: [0, 1, 2, 1, 3, 2, 1, 2, 0, 1, 2, 3, 4, 3, 2, 1], bassPat: [0, -1, 0, -1, -1, -1, 0, -1, 0, -1, -1, 0, -1, -1, 0, -1], bright: 2400 },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Menu and interface sounds follow the UI volume slider. */
const UI_SOUNDS = new Set(['ui', 'uiBack', 'select', 'denied']);

class AudioEngine {
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
  private ambVol = 0.7;
  private masterVol = 1;
  /** Ambience: looping wind and water beds plus occasional birds (day) or crickets (night). */
  ambBus!: GainNode;
  private windGain: GainNode | null = null;
  private waterGain: GainNode | null = null;
  private critterT = 0;
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
      this.ambBus = this.ctx.createGain();
      this.ambBus.connect(this.master);
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
      this.setVolumes(this.masterVol, this.sfxVol, this.musicVol, this.uiVol, this.ambVol);
      if (this.songId) {
        const id = this.songId;
        this.songId = '';
        this.playMusic(id);
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(master: number, sfx: number, music: number, ui: number, amb = this.ambVol) {
    this.masterVol = master;
    this.sfxVol = sfx;
    this.musicVol = music;
    this.uiVol = ui;
    this.ambVol = amb;
    if (!this.ctx) return;
    this.ambBus.gain.value = amb * 0.9;
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

  // ------------------------------------------------------------- ambience
  /** Loop of filtered noise feeding a gain (wind or water bed). */
  private bed(type: BiquadFilterType, freq: number, q: number, lfo: number): GainNode {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    // slow swell of the filter (gusts / ripples)
    const o = c.createOscillator();
    o.frequency.value = lfo;
    const og = c.createGain();
    og.gain.value = freq * 0.35;
    o.connect(og);
    og.connect(f.frequency);
    o.start();
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(f);
    f.connect(g);
    g.connect(this.ambBus);
    src.start();
    return g;
  }

  /**
   * Sets the world ambience every frame: `wind` and `water` 0..1, `night` switches birds to crickets.
   * `on` false (menus) fades the beds out.
   */
  setAmbience(on: boolean, wind: number, water: number, night: boolean, dt: number) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (!this.windGain) {
      this.windGain = this.bed('bandpass', 420, 0.6, 0.07);
      this.waterGain = this.bed('highpass', 1800, 0.4, 0.9);
    }
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(on ? 0.05 + wind * 0.08 : 0, t, 0.6);
    this.waterGain!.gain.setTargetAtTime(on ? water * 0.11 : 0, t, 0.4);
    if (!on || this.ambVol <= 0 || this.masterVol <= 0) return;
    this.critterT -= dt;
    if (this.critterT > 0) return;
    this.critterT = night ? 0.25 + Math.random() * 0.6 : 1.5 + Math.random() * 4;
    const out = this.ambBus;
    if (night) {
      // cricket: a few fast high pulses
      const f = 4200 + Math.random() * 500;
      for (let i = 0; i < 3; i++) this.tone(t + i * 0.045, 'sine', f, f, 0.03, 0.012, 0.003, out);
    } else {
      // bird: two or three falling chirps
      const n = 2 + ((Math.random() * 2) | 0);
      const f = 2400 + Math.random() * 1400;
      for (let i = 0; i < n; i++) this.tone(t + i * 0.11, 'sine', f * (1.15 - i * 0.06), f * 0.8, 0.08, 0.02, 0.005, out);
    }
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

  /** 0..1 raises drum density and filter brightness . */
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
  slash: 0.06,
  hit: 0.03,
};

const RECIPES: Record<string, Recipe> = {
  slash: (a, t, v) => a.noise(t, 0.12, 0.25 * v, 'bandpass', 3200, 900, 1.4),
  thrust: (a, t, v) => a.noise(t, 0.16, 0.25 * v, 'bandpass', 1400, 4000, 2),
  magic: (a, t, v) => {
    a.tone(t, 'triangle', 660, 1320, 0.15, 0.12 * v);
    a.tone(t + 0.03, 'sine', 990, 1980, 0.12, 0.08 * v);
  },
  bow: (a, t, v) => {
    a.tone(t, 'triangle', 300, 120, 0.1, 0.18 * v);
    a.noise(t, 0.06, 0.1 * v, 'highpass', 2500, 5000);
  },
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
  hit: (a, t, v) => a.noise(t, 0.04, 0.1 * v, 'bandpass', 1800, 900, 2),
  ui: (a, t, v) => a.tone(t, 'square', 880, 880, 0.04, 0.05 * v),
  uiBack: (a, t, v) => a.tone(t, 'square', 520, 440, 0.06, 0.05 * v),
  select: (a, t, v) => {
    a.tone(t, 'square', 660, 660, 0.05, 0.05 * v);
    a.tone(t + 0.05, 'square', 990, 990, 0.08, 0.05 * v);
  },
  denied: (a, t, v) => a.tone(t, 'square', 160, 140, 0.15, 0.08 * v),
};

export const audio = new AudioEngine();
