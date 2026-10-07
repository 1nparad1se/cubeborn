import { registerBehavior } from '../Weapon';
import { hitCircle, hitLine, aim, reaches, clipShot } from './util';
import { TAU } from '../../../core/math';

// Rune Blade / Soulreaver: arc slashes around the hero.
registerBehavior('slash', {
  fire(w, run) {
    const p = run.player;
    const n = w.amount(run);
    const range = w.p('range', 2.6) * w.area(run);
    const arc = (w.p('arc', 130) * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      run.later(i * 0.14, () => {
        const back = i % 2 === 1;
        const a0 = aim(w, run, range + 2);
        const base = Math.atan2(a0.z, a0.x) + (back ? Math.PI : 0) + (w.evo ? i * 0.6 : 0);
        const ef = run.effects.add('slash', p.x, p.z, 0.22, w.def.color);
        ef.angle = base;
        ef.arc = Math.min(TAU, arc);
        ef.r = range;
        ef.follow = true;
        p.attackPulse = 0.2;
        run.fx.sound('slash', 0.6);
        run.enemies.forEachInRadius(p.x, p.z, range, (e) => {
          if (arc < TAU) {
            let d = Math.atan2(e.z - p.z, e.x - p.x) - base;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            if (Math.abs(d) > arc / 2 + 0.2) return false;
          }
          if (!reaches(run, w, p.x, p.z, e)) return false;
          run.combat.hit(e, w.dmg, 1, e.x - p.x, e.z - p.z);
          return false;
        });
        if (w.evo) {
          // crescents fly outward in a fan
          for (let k = -1; k <= 1; k++) {
            const a = base + k * 0.35;
            const sp = w.speed(run);
            const pr = run.projectiles.spawn(w, p.x, p.z, Math.cos(a) * sp, Math.sin(a) * sp, 0.7, 'crescent', w.def.color);
            pr.pierce = -1;
            pr.radius = 0.7 * w.area(run);
            pr.scale = w.area(run);
            pr.dmg.damage *= 0.5;
            pr.glow = 1;
          }
        }
      });
    }
  },
});

// Spirit Fists / Hundred Palms: rapid punches at the nearest enemies.
registerBehavior('fists', {
  fire(w, run) {
    const p = run.player;
    const n = w.amount(run);
    const range = w.p('range', 2.4) * Math.sqrt(w.area(run));
    for (let i = 0; i < n; i++) {
      run.later(i * w.p('interval', 0.09), () => {
        const t = run.enemies.nearest(p.x, p.z, range + 1, undefined, !w.passWalls);
        let dx = p.fx;
        let dz = p.fz;
        if (t) {
          const d = Math.hypot(t.x - p.x, t.z - p.z) || 1;
          dx = (t.x - p.x) / d;
          dz = (t.z - p.z) / d;
        }
        const side = i % 2 ? 0.35 : -0.35;
        let reach = Math.min(range, t ? Math.hypot(t.x - p.x, t.z - p.z) : 1.3);
        reach *= clipShot(run, w, p.x, p.z, p.x + dx * reach, p.z + dz * reach);
        const hx = p.x + dx * reach - dz * side;
        const hz = p.z + dz * reach + dx * side;
        hitCircle(run, w, hx, hz, 0.9 * w.area(run));
        const ef = run.effects.add('punch', hx, hz, 0.16, w.def.color);
        ef.angle = Math.atan2(dz, dx);
        ef.r = 0.9 * w.area(run);
        p.attackPulse = 0.12;
        run.fx.sound('punch', 0.45);
        if (w.evo) {
          const sp = w.speed(run);
          const pr = run.projectiles.spawn(w, hx, hz, dx * sp, dz * sp, 0.35, 'fistwave', w.def.color);
          pr.pierce = -1;
          pr.radius = 0.8 * w.area(run);
          pr.scale = w.area(run);
          pr.dmg.damage *= 0.6;
        }
      });
    }
  },
});

// Sky Lance / Dragon Lance: long piercing thrusts.
registerBehavior('lance', {
  fire(w, run) {
    const p = run.player;
    const n = w.amount(run);
    const len = w.p('range', 6) * w.area(run);
    const width = w.p('width', 0.9) * w.area(run);
    const a0 = aim(w, run);
    const base = Math.atan2(a0.z, a0.x);
    for (let i = 0; i < n; i++) {
      const a = w.evo ? base + (i * TAU) / Math.max(4, n) : base + (i % 2 ? Math.PI : 0) + Math.floor(i / 2) * 0.25;
      run.later(w.evo ? 0 : i * 0.12, () => {
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        const reach = len * clipShot(run, w, p.x, p.z, p.x + dx * len, p.z + dz * len);
        hitLine(run, w, p.x, p.z, p.x + dx * reach, p.z + dz * reach, width);
        const ef = run.effects.add('lance', p.x, p.z, 0.25, w.def.color);
        ef.angle = a;
        ef.r = reach;
        ef.w = width;
        ef.follow = true;
        p.attackPulse = 0.2;
        run.fx.sound('thrust', 0.6);
        if (w.evo) {
          for (let k = 1; k <= 4; k++) {
            const fx = p.x + dx * (reach * k) / 4.5;
            const fz = p.z + dz * (reach * k) / 4.5;
            const pr = run.projectiles.spawn(w, fx, fz, 0, 0, 2, 'firepatch', 0xff6a1a);
            pr.hitEvery = 0.4;
            pr.pierce = -1;
            pr.radius = 0.9;
            pr.y = 0.05;
            pr.dmg.damage *= 0.25;
            pr.dmg.burn = 6;
            pr.dmg.burnDur = 2;
            pr.dmg.knockback = 0;
          }
        }
      });
    }
  },
});
