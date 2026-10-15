import { DAY_NIGHT, type DayPeriod, type PhaseLight } from '../config/dayNight';
import type { Run } from './Run';
import { DAY_MINUTES, phaseAt, type GameClock } from './GameClock';

function smooth(x: number): number {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
}

function lerpColor(a: number, b: number, k: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const r = Math.round(ar + (((b >> 16) & 255) - ar) * k);
  const g = Math.round(ag + (((b >> 8) & 255) - ag) * k);
  const bl = Math.round(ab + ((b & 255) - ab) * k);
  return (r << 16) | (g << 8) | bl;
}

function lerpLight(a: PhaseLight, b: PhaseLight, k: number, out: PhaseLight): PhaseLight {
  out.sun = a.sun + (b.sun - a.sun) * k;
  out.ambient = a.ambient + (b.ambient - a.ambient) * k;
  out.tint = a.tint + (b.tint - a.tint) * k;
  out.fog = a.fog + (b.fog - a.fog) * k;
  out.fogTint = a.fogTint + (b.fogTint - a.fogTint) * k;
  out.warm = a.warm + (b.warm - a.warm) * k;
  out.sat = a.sat + (b.sat - a.sat) * k;
  // colours blend only where they are actually applied so day keeps the map's own palette
  out.sunColor = lerpColor(a.tint > 0 ? a.sunColor : b.sunColor, b.tint > 0 ? b.sunColor : a.sunColor, k);
  out.ambientColor = lerpColor(a.tint > 0 ? a.ambientColor : b.ambientColor, b.tint > 0 ? b.ambientColor : a.ambientColor, k);
  out.fogColor = lerpColor(a.fogTint > 0 ? a.fogColor : b.fogColor, b.fogTint > 0 ? b.fogColor : a.fogColor, k);
  return out;
}

/**
 * Day/night lighting driven by the world clock (GameClock): dawn 05–07, day 07–18, dusk 18–20,
 * night 20–05, blended smoothly. The clock itself is advanced by the game loop; this class only
 * reads it, so it never changes game speed and keeps the gameplay hooks (period events, `night`).
 */
export class DayNight {
  /** Completed nights (the first night is 1 while it lasts). */
  nights = 0;
  period: DayPeriod = 'day';
  /** Progress 0..1 through the current period. */
  phaseK = 0;
  /** 0 full day .. 1 full night, eased through dawn and dusk. */
  night = 0;
  /** Blended lighting for the renderer. */
  readonly light: PhaseLight = { ...DAY_NIGHT.light.day };

  constructor(
    private run: Run,
    readonly clock: GameClock,
  ) {
    this.compute();
  }

  /** The cycle always runs (kept for callers that still ask). */
  get enabled(): boolean {
    return true;
  }

  get isNight(): boolean {
    return this.night >= 0.5;
  }

  /** Minutes since midnight. */
  get minutes(): number {
    return this.clock.minutes;
  }

  /**
   * Position of the sun (05:00–20:00) or the moon (20:00–05:00) across the sky, -1 (rising in the
   * east) .. 1 (setting in the west).
   */
  get sunArc(): number {
    const m = this.clock.minutes;
    const rise = 5 * 60;
    const set = 20 * 60;
    if (m >= rise && m < set) return ((m - rise) / (set - rise)) * 2 - 1;
    const since = m >= set ? m - set : m + DAY_MINUTES - set;
    return (since / (DAY_MINUTES - (set - rise))) * 2 - 1;
  }

  private compute() {
    const { p, k } = phaseAt(this.clock.minutes);
    this.period = p;
    this.phaseK = k;
    const L = DAY_NIGHT.light;
    switch (p) {
      case 'day':
        this.night = 0;
        // the last stretch of the day already leans toward dusk
        lerpLight(L.day, L.dusk, smooth((k - 0.85) / 0.15) * 0.5, this.light);
        break;
      case 'dusk':
        this.night = smooth(k);
        if (k < 0.5) lerpLight(L.day, L.dusk, 0.5 + k, this.light);
        else lerpLight(L.dusk, L.night, smooth((k - 0.5) * 2), this.light);
        break;
      case 'night':
        this.night = 1;
        // the last hour before dawn starts to lighten
        lerpLight(L.night, L.dawn, smooth((k - 0.9) / 0.1) * 0.4, this.light);
        break;
      case 'dawn':
        this.night = 1 - smooth(k);
        if (k < 0.5) lerpLight(L.night, L.dawn, 0.4 + 0.6 * smooth(k * 2), this.light);
        else lerpLight(L.dawn, L.day, smooth((k - 0.5) * 2), this.light);
        break;
    }
    // dark maps carry their own mood: soften the night there
    if (this.run.map.palette.heroLight) {
      const s = DAY_NIGHT.darkMapNightStrength;
      const d = DAY_NIGHT.light.day;
      this.light.sun = d.sun + (this.light.sun - d.sun) * s;
      this.light.ambient = d.ambient + (this.light.ambient - d.ambient) * s;
      this.light.tint *= s;
      this.light.fogTint *= s;
      this.light.fog = d.fog + (this.light.fog - d.fog) * s;
    }
  }

  // ---------------------------------------------------------------- update
  /** Re-reads the clock (advanced by the game loop) and announces period changes. */
  update() {
    const prev = this.period;
    this.compute();
    if (this.period !== prev) this.onPeriod(this.period);
  }

  private onPeriod(p: DayPeriod) {
    const run = this.run;
    run.events.emit('dayPeriod', p);
    if (p === 'dusk') run.events.emit('banner', 'dn_dusk');
    else if (p === 'night') {
      this.nights++;
      run.events.emit('banner', 'dn_night');
      run.fx.sound('nightfall', 0.8);
    } else if (p === 'dawn') {
      run.events.emit('banner', 'dn_dawn');
      run.fx.sound('dawn', 0.7);
    }
  }
}
