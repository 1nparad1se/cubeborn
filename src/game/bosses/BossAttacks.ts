import type { BossAttack } from '../../data/types';
import { TAU } from '../../core/math';
import { BossController } from './Boss';

const n = (a: BossAttack, k: string, d: number) => (a[k] as number | undefined) ?? d;

/** Executes one boss attack pattern. Patterns are generic and parameterised by data. */
export function runAttack(b: BossController, a: BossAttack) {
  const run = b.run;
  const e = b.e;
  const p = run.player;
  const dmg = e.damage;
  switch (a.type) {
    case 'ring': {
      const waves = n(a, 'waves', 1);
      for (let w = 0; w < waves; w++) {
        run.later(w * n(a, 'waveDelay', 0.4), () => {
          if (!e.alive) return;
          const count = n(a, 'count', 12);
          const rot = (w * n(a, 'rotate', 0) * Math.PI) / 180;
          for (let i = 0; i < count; i++) {
            const ang = rot + (i / count) * TAU;
            run.hazards.bullet(e.x, e.z, Math.cos(ang) * n(a, 'speed', 5), Math.sin(ang) * n(a, 'speed', 5), dmg * 0.6, 0.34, 5, a.slow ? 0x8ae8ff : 0xff3a6a, !!a.slow);
          }
          run.fx.sound('bossShoot', 0.5);
        });
      }
      break;
    }
    case 'spiral':
      b.spiralAttack = a;
      b.spiralT = n(a, 'duration', 3);
      b.spiralAcc = 0;
      b.busy = b.spiralT;
      run.fx.sound('bossCharge', 0.6);
      break;
    case 'aimed': {
      const bursts = n(a, 'bursts', 1);
      for (let k = 0; k < bursts; k++) {
        run.later(k * n(a, 'burstDelay', 0.3), () => {
          if (!e.alive) return;
          const base = Math.atan2(p.z - e.z, p.x - e.x);
          const count = n(a, 'count', 3);
          const spread = (n(a, 'spread', 30) * Math.PI) / 180;
          for (let i = 0; i < count; i++) {
            const ang = count === 1 ? base : base - spread / 2 + (spread * i) / (count - 1);
            run.hazards.bullet(e.x, e.z, Math.cos(ang) * n(a, 'speed', 8), Math.sin(ang) * n(a, 'speed', 8), dmg * 0.6, 0.32, 4, a.slow ? 0x8ae8ff : 0xff3a6a, !!a.slow);
          }
          run.fx.sound('bossShoot', 0.5);
        });
      }
      break;
    }
    case 'laser': {
      const count = n(a, 'count', 1);
      const base = a.aim ? Math.atan2(p.z - e.z, p.x - e.x) - (n(a, 'sweep', 40) * Math.PI) / 180 * 0.5 : Math.random() * TAU;
      for (let i = 0; i < count; i++) {
        run.hazards.laser(e, e.x, e.z, base + (i / count) * TAU * (a.aim ? 0.15 : 1), {
          sweep: (n(a, 'sweep', 40) * Math.PI) / 180,
          len: n(a, 'length', 14),
          width: n(a, 'width', 0.8),
          tele: n(a, 'telegraph', 1),
          dur: n(a, 'duration', 2.5),
          dmg: dmg * 0.5,
          color: b.def.color,
        });
      }
      b.busy = n(a, 'telegraph', 1) + 0.5;
      run.fx.sound('bossCharge', 0.7);
      break;
    }
    case 'summon': {
      const count = n(a, 'count', 6);
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * TAU;
        const x = e.x + Math.cos(ang) * 2.5;
        const z = e.z + Math.sin(ang) * 2.5;
        if (!run.terrain.walkableAt(x, z)) continue;
        const m = run.enemies.spawnById(a.enemy as string, x, z);
        if (m) m.xp = Math.ceil(m.xp * 0.5);
      }
      run.fx.burst(e.x, 1, e.z, 0xb070ff, 30, 5, 0.2, 0.8, 'glow');
      run.fx.sound('summon');
      break;
    }
    case 'teleport': {
      const ang = Math.random() * TAU;
      const r = 6 + Math.random() * 2;
      let tx = p.x + Math.cos(ang) * r;
      let tz = p.z + Math.sin(ang) * r;
      if (!b.def.flying && !run.terrain.walkableAt(tx, tz)) {
        tx = p.x;
        tz = p.z;
      }
      run.fx.burst(e.x, 1.2, e.z, b.def.color, 30, 5, 0.2, 0.6, 'glow');
      e.x = tx;
      e.z = tz;
      if (a.burrow) {
        b.hidden = 1;
        e.invuln = true;
        run.hazards.telegraph(tx, tz, 2.6, 1);
      } else run.fx.burst(e.x, 1.2, e.z, b.def.color, 30, 5, 0.2, 0.6, 'glow');
      run.fx.sound('teleport');
      break;
    }
    case 'dash':
      b.dashLeft = n(a, 'count', 1);
      b.dashSpeed = n(a, 'speed', 14);
      b.dashTele = n(a, 'telegraph', 0.7);
      b.startDash();
      break;
    case 'zones': {
      const count = n(a, 'count', 5);
      const r = n(a, 'radius', 1.8);
      const spread = n(a, 'spread', 5);
      const opts = { pool: n(a, 'pool', 0), freeze: !!a.freeze, color: a.freeze ? 0x6ad8ff : undefined };
      for (let i = 0; i < count; i++) {
        let x: number;
        let z: number;
        if (a.line) {
          const dx = p.x - e.x;
          const dz = p.z - e.z;
          const d = Math.hypot(dx, dz) || 1;
          x = e.x + (dx / d) * (i + 1) * r * 1.6;
          z = e.z + (dz / d) * (i + 1) * r * 1.6;
          run.later(i * 0.08, () => run.hazards.zone(x, z, r, n(a, 'telegraph', 1), dmg * 0.8, opts));
          continue;
        }
        if (i === 0 || spread === 0) {
          x = p.x + p.vx * 0.5;
          z = p.z + p.vz * 0.5;
        } else {
          const ang = Math.random() * TAU;
          const rr = Math.random() * spread;
          x = p.x + Math.cos(ang) * rr;
          z = p.z + Math.sin(ang) * rr;
        }
        run.hazards.zone(x, z, r, n(a, 'telegraph', 1) + i * 0.05, dmg * 0.8, opts);
      }
      run.fx.sound('bossCharge', 0.4);
      break;
    }
    case 'meteor': {
      const count = n(a, 'count', 8);
      for (let i = 0; i < count; i++) {
        run.later(i * 0.12, () => {
          const ang = Math.random() * TAU;
          const rr = Math.random() * n(a, 'spread', 9);
          const x = p.x + Math.cos(ang) * rr;
          const z = p.z + Math.sin(ang) * rr;
          run.hazards.zone(x, z, n(a, 'radius', 2), n(a, 'telegraph', 1.2), dmg * 0.9, { color: 0xff7a1a });
          run.spawnFallingRock(x, z, n(a, 'telegraph', 1.2), 0xff7a1a);
        });
      }
      break;
    }
    case 'slam': {
      const waves = n(a, 'waves', 1);
      for (let w = 0; w < waves; w++) {
        run.later(0.5 + w * 0.55, () => {
          if (!e.alive) return;
          run.hazards.shock(e.x, e.z, n(a, 'radius', 10), n(a, 'speed', 7), n(a, 'width', 1.2), dmg * 0.8, b.def.color);
          run.fx.shake(0.35);
          run.fx.burst(e.x, 0.3, e.z, 0x8a7a6a, 24, 6, 0.25, 0.6, 'debris');
          run.fx.sound('slam');
        });
      }
      run.hazards.telegraph(e.x, e.z, 2.5, 0.5);
      b.busy = 0.6 + waves * 0.55;
      break;
    }
    case 'shield': {
      const count = n(a, 'count', 4);
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * TAU;
        const x = e.x + Math.cos(ang) * 5;
        const z = e.z + Math.sin(ang) * 5;
        const c = run.enemies.spawnById((a.enemy as string) ?? 'shield_crystal', x, z, { hpMul: 1 + run.time / 300 });
        if (c) b.crystals.push(c);
      }
      e.invuln = true;
      run.fx.text(e.x, e.z, run.tr('shielded'), 0x9a7aff);
      run.fx.sound('shield');
      break;
    }
    case 'split': {
      const count = n(a, 'count', 2);
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * TAU + Math.random();
        const c = BossController.spawn(run, b.def.id, e.x + Math.cos(ang) * 3, e.z + Math.sin(ang) * 3, b.isFinal, n(a, 'hpFrac', 0.15), true);
        if (c) {
          c.e.scale = 0.65;
          c.e.radius = b.def.radius * 0.7;
          c.forcePhase(b.phase);
        }
      }
      run.fx.burst(e.x, 1.2, e.z, b.def.color, 40, 6, 0.25, 0.8, 'glow');
      run.fx.sound('summon');
      break;
    }
    case 'pull':
      b.pullT = n(a, 'duration', 2);
      b.pullStrength = n(a, 'strength', 3);
      run.fx.sound('bossCharge', 0.8);
      break;
    case 'darkness':
      run.weather.darkness = Math.max(run.weather.darkness, n(a, 'duration', 30));
      break;
  }
}
