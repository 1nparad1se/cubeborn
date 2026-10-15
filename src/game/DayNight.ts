import { DAY_NIGHT, type DayPeriod, type PhaseLight } from '../config/dayNight';
import type { Run } from './Run';

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
 * Day/night cycle: dawn → day → dusk → night with smooth lighting.
 * Disabled when the cycle length setting is 0.
 */
export class DayNight {
  readonly length: number;
  /** Seconds into the current cycle. */
  t = 0;
  /** Completed nights (the first night is 1 while it lasts). */
  nights = 0;
  period: DayPeriod = 'day';
  /** 0 full day .. 1 full night, eased through dawn and dusk. */
  night = 0;
  /** Blended lighting for the renderer. */
  readonly light: PhaseLight = { ...DAY_NIGHT.light.day };
  private bounds: { p: DayPeriod; a: number; b: number }[] = [];

  constructor(private run: Run, length: number) {
    this.length = Math.max(0, length);
    let a = 0;
    for (const [p, share] of DAY_NIGHT.phases) {
      this.bounds.push({ p, a: a * this.length, b: (a + share) * this.length });
      a += share;
    }
    // runs begin in the morning
    this.t = this.enabled ? this.bounds.find((b) => b.p === 'day')!.a : 0;
    this.compute();
  }

  get enabled(): boolean {
    return this.length > 0;
  }

  get isNight(): boolean {
    return this.enabled && this.night >= 0.5;
  }

  /** Seconds until the next period begins. */
  get timeToNext(): number {
    const b = this.bounds.find((x) => this.t >= x.a && this.t < x.b);
    return b ? b.b - this.t : 0;
  }

  /** Position of the sun (day) or moon (night) across the sky, -1 (rising) .. 1 (setting). */
  get sunArc(): number {
    if (!this.enabled) return 0;
    const night = this.bounds.find((b) => b.p === 'night')!;
    if (this.t >= night.a && this.t < night.b) return ((this.t - night.a) / (night.b - night.a)) * 2 - 1;
    // dawn..dusk (wrapping past the night)
    const dayLen = this.length - (night.b - night.a);
    const since = (this.t - night.b + this.length) % this.length;
    return Math.min(1, (since / dayLen) * 2 - 1);
  }

  /** Progress through the whole cycle 0..1 (for the HUD dial). */
  get cycleProgress(): number {
    return this.enabled ? this.t / this.length : 0.3;
  }

  private periodAt(t: number): { p: DayPeriod; a: number; b: number } {
    for (const b of this.bounds) if (t >= b.a && t < b.b) return b;
    return this.bounds[this.bounds.length - 1];
  }

  private compute() {
    if (!this.enabled) {
      this.period = 'day';
      this.night = 0;
      Object.assign(this.light, DAY_NIGHT.light.day);
      return;
    }
    const cur = this.periodAt(this.t);
    this.period = cur.p;
    const k = (this.t - cur.a) / Math.max(1e-6, cur.b - cur.a);
    const L = DAY_NIGHT.light;
    switch (cur.p) {
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
        lerpLight(L.night, L.dawn, smooth((k - 0.9) / 0.1) * 0.4, this.light);
        break;
      case 'dawn':
        this.night = 1 - smooth(k);
        if (k < 0.5) lerpLight(L.night, L.dawn, smooth(0.4 + k * 1.2), this.light);
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
  update(dt: number) {
    if (!this.enabled) return;
    const prev = this.period;
    this.t += dt;
    if (this.t >= this.length) this.t -= this.length;
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
