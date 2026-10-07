import { BALANCE } from '../config/balance';
import { BOSSES } from '../data/bosses';
import type { Run } from './Run';

export type WaveType = 'normal' | 'horde' | 'fast' | 'elite' | 'danger' | 'boss' | 'final';
export type RunMode = 'campaign' | 'endless';

/** Endless-mode modifiers. Each one is active for a few waves. */
export type ModifierId = 'blood_moon' | 'swarm' | 'berserk' | 'iron_skin' | 'darkness' | 'elite_hunt';
export const MODIFIERS: { id: ModifierId; color: string }[] = [
  { id: 'blood_moon', color: '#ff3a4a' },
  { id: 'swarm', color: '#c8a0ff' },
  { id: 'berserk', color: '#ff8a2a' },
  { id: 'iron_skin', color: '#a8b8c8' },
  { id: 'darkness', color: '#6a6aff' },
  { id: 'elite_hunt', color: '#ffd23d' },
];

export interface Wave {
  /** 1-based wave number. */
  n: number;
  type: WaveType;
  start: number;
  duration: number;
  boss?: string;
  /** The boss of this wave ends the campaign when defeated. */
  final?: boolean;
  /** Boss returns enraged (second appearance). */
  enraged?: boolean;
}

/** Multipliers applied to every enemy spawned during a wave. */
export interface WaveScale {
  hp: number;
  damage: number;
  speed: number;
  rate: number;
  max: number;
  elite: number;
}

export const WAVE_TYPE_COLOR: Record<WaveType, string> = {
  normal: '#c8ccd8',
  horde: '#9a7aff',
  fast: '#5ae0ff',
  elite: '#ffb02e',
  danger: '#ff5a4a',
  boss: '#ff3a6a',
  final: '#ff2a2a',
};

/** Campaign structure: 30 waves, elites and dangerous waves interleaved, bosses on 10/20 and the final boss on 30. */
const CAMPAIGN: WaveType[] = [
  'normal', 'normal', 'horde', 'normal', 'fast', 'elite', 'normal', 'danger', 'horde', 'boss',
  'normal', 'fast', 'elite', 'horde', 'danger', 'normal', 'elite', 'fast', 'danger', 'boss',
  'horde', 'elite', 'danger', 'fast', 'horde', 'elite', 'danger', 'horde', 'elite', 'final',
];
/** Endless cycles this pattern; every 10th wave is a boss wave. */
const ENDLESS: WaveType[] = ['normal', 'fast', 'horde', 'elite', 'normal', 'danger', 'horde', 'fast', 'elite', 'boss'];

export const CAMPAIGN_WAVES = CAMPAIGN.length;

/**
 * Non-linear growth by wave: gentle for the first waves, noticeable mid-run,
 * serious in the final third, and (Endless only) exponential past wave 50 so
 * that every run eventually ends.
 */
export function waveScale(n: number): { hp: number; damage: number; speed: number; count: number; elite: number } {
  const B = BALANCE.waves;
  const s = Math.max(0, n - 1);
  let hp = 1 + B.hpLin * s + B.hpQuad * s * s;
  let damage = 1 + B.dmgLin * s + B.dmgQuad * s * s;
  const speed = Math.min(n > CAMPAIGN_WAVES ? B.speedCapEndless : B.speedCap, 1 + B.speedLin * s + B.speedQuad * s * s);
  let count = 1 + B.countLin * s;
  // endless anti-infinity: compounding growth that no build outruns forever
  if (n > B.expStart) {
    const k = n - B.expStart;
    hp *= Math.pow(B.expHp, k);
    damage *= Math.pow(B.expDmg, k);
    count *= Math.min(1.6, 1 + k * 0.01);
  }
  if (n > B.exp2Start) {
    const k = n - B.exp2Start;
    hp *= Math.pow(B.exp2Hp, k);
    damage *= Math.pow(B.exp2Dmg, k);
  }
  const elite = n < 4 ? 0 : Math.min(B.eliteMax, B.eliteBase + B.elitePerWave * s) * (n > CAMPAIGN_WAVES ? 1.3 : 1);
  return { hp, damage, speed, count, elite };
}

/** Spawn rate (per minute) and alive cap for a wave before type and difficulty modifiers. */
export function waveDensity(n: number): { rate: number; max: number } {
  const B = BALANCE.waves;
  const s = Math.min(Math.max(0, n - 1), 60);
  return { rate: B.rateBase + B.rateLin * s + B.rateQuad * s * s, max: B.maxBase + B.maxLin * s + B.maxQuad * s * s };
}

const TYPE_MUL: Record<WaveType, { hp: number; damage: number; speed: number; rate: number; max: number; elite: number }> = {
  normal: { hp: 1, damage: 1, speed: 1, rate: 1, max: 1, elite: 1 },
  horde: { hp: 0.55, damage: 0.9, speed: 1, rate: 2.1, max: 1.55, elite: 0.5 },
  fast: { hp: 0.85, damage: 1, speed: 1.12, rate: 1.1, max: 1, elite: 1 },
  elite: { hp: 1, damage: 1.1, speed: 1, rate: 0.75, max: 0.85, elite: 3 },
  danger: { hp: 1, damage: 1.45, speed: 1.05, rate: 0.95, max: 0.95, elite: 1.5 },
  boss: { hp: 1, damage: 1, speed: 1, rate: 0.65, max: 0.75, elite: 1 },
  final: { hp: 1.1, damage: 1.1, speed: 1, rate: 0.75, max: 0.85, elite: 1.5 },
};

/** Decides wave timing, types, bosses and (Endless) modifiers. */
export class WaveDirector {
  readonly mode: RunMode;
  readonly total: number;
  wave: Wave;
  /** Active Endless modifiers with the wave on which each expires. */
  readonly modifiers: { id: ModifierId; until: number }[] = [];
  private bossCycle: string[] = [];

  constructor(private run: Run, mode: RunMode) {
    this.mode = mode;
    this.total = mode === 'endless' ? Infinity : CAMPAIGN_WAVES;
    if (mode === 'endless') {
      // the map's own bosses first, then every other boss in a shuffled order
      const m = run.map;
      const others = BOSSES.map((b) => b.id).filter((id) => id !== m.midBoss && id !== m.boss);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(run.rng.next() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      this.bossCycle = [m.midBoss, m.boss, ...others];
    }
    this.wave = this.make(1, 0);
  }

  /** Wave length in seconds. */
  static length(n: number, mode: RunMode): number {
    return mode === 'endless' ? BALANCE.waves.endlessLength : BALANCE.waves.length;
  }

  /** Total campaign duration up to the start of the final wave. */
  static finalWaveTime(): number {
    return (CAMPAIGN_WAVES - 1) * BALANCE.waves.length;
  }

  typeOf(n: number): WaveType {
    if (this.mode === 'campaign') return CAMPAIGN[Math.min(n, CAMPAIGN_WAVES) - 1];
    return ENDLESS[(n - 1) % ENDLESS.length];
  }

  private make(n: number, start: number): Wave {
    const type = this.typeOf(n);
    const w: Wave = { n, type, start, duration: WaveDirector.length(n, this.mode) };
    const m = this.run.map;
    if (this.mode === 'campaign') {
      if (n === 10) w.boss = m.midBoss;
      else if (n === 20) {
        w.boss = m.midBoss;
        w.enraged = true;
      } else if (type === 'final') {
        w.boss = m.boss;
        w.final = true;
      }
    } else if (type === 'boss') {
      const k = n / 10 - 1;
      w.boss = this.bossCycle[k % this.bossCycle.length];
      w.enraged = k >= this.bossCycle.length;
    }
    return w;
  }

  /** Seconds left in the current wave (Infinity during the final wave). */
  get remaining(): number {
    if (this.wave.final) return Infinity;
    return Math.max(0, this.wave.start + this.wave.duration - this.run.time);
  }

  get progress(): number {
    if (this.wave.final) return 1;
    return Math.min(1, (this.run.time - this.wave.start) / this.wave.duration);
  }

  hasModifier(id: ModifierId): boolean {
    for (const m of this.modifiers) if (m.id === id) return true;
    return false;
  }

  /** Current multipliers for newly spawned enemies. */
  scale(): WaveScale {
    const w = this.wave;
    const base = waveScale(w.n);
    const t = TYPE_MUL[w.type];
    const s: WaveScale = { hp: base.hp * t.hp, damage: base.damage * t.damage, speed: base.speed * t.speed, rate: base.count * t.rate, max: base.count * t.max, elite: base.elite * t.elite };
    if (this.mode === 'endless') {
      if (this.hasModifier('blood_moon')) s.damage *= 1.3;
      if (this.hasModifier('swarm')) {
        s.rate *= 1.6;
        s.max *= 1.4;
        s.hp *= 0.8;
      }
      if (this.hasModifier('berserk')) s.speed *= 1.2;
      if (this.hasModifier('iron_skin')) s.hp *= 1.5;
      if (this.hasModifier('elite_hunt')) s.elite *= 4;
    }
    return s;
  }

  /** Advances to the next wave when the timer runs out. Returns true when a new wave began. */
  update(): boolean {
    const w = this.wave;
    if (w.final) return false;
    if (this.run.time < w.start + w.duration) return false;
    if (w.n >= this.total) return false;
    const next = this.make(w.n + 1, w.start + w.duration);
    this.wave = next;
    if (this.mode === 'endless') this.rollModifiers(next.n);
    return true;
  }

  /** Endless: from wave 8, a new modifier joins every 4 waves and lasts 6 waves; late waves stack more. */
  private rollModifiers(n: number) {
    for (let i = this.modifiers.length - 1; i >= 0; i--) if (this.modifiers[i].until < n) this.modifiers.splice(i, 1);
    if (n < 8 || n % 4 !== 0) return;
    const maxActive = n >= 60 ? 3 : n >= 30 ? 2 : 1;
    if (this.modifiers.length >= maxActive) return;
    const pool = MODIFIERS.filter((m) => !this.hasModifier(m.id));
    if (!pool.length) return;
    const pick = pool[Math.floor(this.run.rng.next() * pool.length)];
    this.modifiers.push({ id: pick.id, until: n + 5 });
    this.run.events.emit('modifier', pick.id);
  }

  /** Wave types for the campaign, used by the HUD timeline and map screen. */
  static campaignPlan(): WaveType[] {
    return [...CAMPAIGN];
  }
}
