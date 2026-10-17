import type { DayPeriod } from '../config/dayNight';

/** Game minutes in one day. */
export const DAY_MINUTES = 24 * 60;
/** Game minutes per real second: 1 real second = 1 game minute (1 game hour = 1 real minute). */
const CLOCK_RATE = 1;
/** Where a new save's clock starts (08:00). */
const CLOCK_START = 8 * 60;

/** Phase boundaries in minutes of the day: dawn 05–07, day 07–18, dusk (sunset) 18–20, night 20–05. */
const PHASES: { p: DayPeriod; from: number; to: number }[] = [
  { p: 'dawn', from: 5 * 60, to: 7 * 60 },
  { p: 'day', from: 7 * 60, to: 18 * 60 },
  { p: 'dusk', from: 18 * 60, to: 20 * 60 },
  { p: 'night', from: 20 * 60, to: 29 * 60 },
];

/** Wraps any minute count into 0 ≤ m < DAY_MINUTES. */
function wrapMinutes(m: number): number {
  if (!Number.isFinite(m)) return CLOCK_START;
  const r = m % DAY_MINUTES;
  return r < 0 ? r + DAY_MINUTES : r;
}

/** Phase at a minute of the day, with the progress 0..1 through it. */
export function phaseAt(minutes: number): { p: DayPeriod; k: number } {
  const m = wrapMinutes(minutes);
  for (const ph of PHASES) {
    // night runs past midnight: test it in the 20:00..29:00 window as well
    const x = m < ph.from ? m + DAY_MINUTES : m;
    if (x >= ph.from && x < ph.to) return { p: ph.p, k: (x - ph.from) / (ph.to - ph.from) };
  }
  return { p: 'night', k: 0 };
}

/** "HH:MM", 24-hour, zero padded. */
export function formatClock(minutes: number): string {
  const m = Math.floor(wrapMinutes(minutes));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${hh < 10 ? '0' : ''}${hh}:${mm < 10 ? '0' : ''}${mm}`;
}

/**
 * The world's 24-hour clock. It only moves when the game loop feeds it real elapsed seconds
 * (so it is independent of the frame rate and stops while paused), is shared by every map and
 * is stored in the save.
 */
export class GameClock {
  /** Minutes since midnight, fractional (0 ≤ minutes < 1440). */
  minutes: number;
  /** Whole days passed since the clock was created (informational). */
  days = 0;

  constructor(minutes = CLOCK_START, days = 0) {
    this.minutes = wrapMinutes(minutes);
    this.days = Number.isFinite(days) && days > 0 ? Math.floor(days) : 0;
  }

  /** Advances by real seconds of play. */
  advance(realSeconds: number) {
    if (!(realSeconds > 0)) return;
    const m = this.minutes + realSeconds * CLOCK_RATE;
    this.days += Math.floor(m / DAY_MINUTES);
    this.minutes = wrapMinutes(m);
  }

  get hhmm(): string {
    return formatClock(this.minutes);
  }

  get phase(): DayPeriod {
    return phaseAt(this.minutes).p;
  }

  toSave(): { minutes: number; days: number } {
    return { minutes: Math.round(this.minutes * 1000) / 1000, days: this.days };
  }

  /** Restores from save data; anything unreadable gives a fresh morning clock. */
  static fromSave(raw: unknown): GameClock {
    if (raw && typeof raw === 'object') {
      const r = raw as { minutes?: unknown; days?: unknown };
      if (typeof r.minutes === 'number' && Number.isFinite(r.minutes)) return new GameClock(r.minutes, typeof r.days === 'number' ? r.days : 0);
    }
    return new GameClock();
  }
}
