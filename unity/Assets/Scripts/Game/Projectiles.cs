using System;
using System.Collections.Generic;

namespace Cubeborn
{
    /// <summary>Player-side projectile. Behaviours may take over movement with `custom`.</summary>
    public class Projectile
    {
        public bool active;
        public double x, y = 0.8, z, vx, vz, vy, life = 1, age, radius = 0.3;
        public readonly DamageInfo dmg = new DamageInfo();
        /// <summary>Remaining enemies it can pass through; -1 = infinite.</summary>
        public int pierce;
        public readonly List<int> hitIds = new List<int>();
        /// <summary>&gt;0: can re-hit the same enemy after this many seconds (uses enemy.lastHit).</summary>
        public double hitEvery;
        public bool collide = true, custom;
        public double homing;
        public Enemy target;
        public int targetUid;
        public string vis = "orb";
        public int color = 0xffffff;
        public double scale = 1, yaw, pitch, spin;
        public WeaponInstance owner;
        /// <summary>Scratch values for behaviours.</summary>
        public double a, b, c, d, e;
        /// <summary>Light emitted for the light pool (0 = none).</summary>
        public double glow;
    }

    public class Projectiles
    {
        public readonly List<Projectile> list = new List<Projectile>();
        readonly List<Projectile> free = new List<Projectile>();
        readonly Run run;

        public Projectiles(Run run)
        {
            this.run = run;
            for (int i = 0; i < 600; i++) free.Add(new Projectile());
        }

        public Projectile Spawn(WeaponInstance owner, double x, double z, double vx, double vz, double life, string vis, int color)
        {
            Projectile p;
            if (free.Count > 0) { p = free[free.Count - 1]; free.RemoveAt(free.Count - 1); }
            else p = new Projectile();
            p.active = true;
            p.owner = owner;
            p.x = x;
            p.z = z;
            p.y = 0.8;
            p.vx = vx;
            p.vz = vz;
            p.vy = 0;
            p.life = life;
            p.age = 0;
            p.radius = 0.3;
            p.pierce = 0;
            p.hitIds.Clear();
            p.hitEvery = 0;
            p.collide = true;
            p.custom = false;
            p.homing = 0;
            p.target = null;
            p.targetUid = 0;
            p.vis = vis;
            p.color = color;
            p.scale = 1;
            p.yaw = Math.Atan2(vx, vz);
            p.pitch = 0;
            p.spin = 0;
            p.a = p.b = p.c = p.d = p.e = 0;
            p.glow = 0;
            if (owner != null) p.dmg.CopyFrom(owner.dmg);
            list.Add(p);
            return p;
        }

        public void Kill(Projectile p)
        {
            if (!p.active) return;
            p.active = false;
            p.owner?.behavior.projectileExpire?.Invoke(p.owner, run, p);
        }

        public void Update(double dt)
        {
            int w = 0;
            // projectiles spawned during the loop are appended and processed in the same pass (like the JS loop)
            for (int i = 0; i < list.Count; i++)
            {
                var p = list[i];
                if (!p.active) { free.Add(p); continue; }
                p.age += dt;
                p.life -= dt;
                if (p.custom && p.owner?.behavior.projectileUpdate != null)
                {
                    if (!p.owner.behavior.projectileUpdate(p.owner, run, p, dt)) Kill(p);
                }
                else
                {
                    if (p.homing > 0) Steer(p, dt);
                    p.x += p.vx * dt;
                    p.z += p.vz * dt;
                    if (p.vy != 0)
                    {
                        p.y += p.vy * dt;
                        p.vy -= 18 * dt;
                    }
                }
                p.yaw += p.spin * dt;
                if (p.active && p.life <= 0) Kill(p);
                if (p.active && p.collide) Collide(p);
                if (p.active) list[w++] = p;
                else free.Add(p);
            }
            list.RemoveRange(w, list.Count - w);
        }

        void Steer(Projectile p, double dt)
        {
            if (p.target == null || !p.target.alive || p.target.uid != p.targetUid)
            {
                p.target = run.enemies.Nearest(p.x, p.z, 10);
                p.targetUid = p.target?.uid ?? 0;
            }
            var t = p.target;
            if (t == null) return;
            double sp = MathX.Hypot(p.vx, p.vz);
            double dx = t.x - p.x, dz = t.z - p.z;
            double d = MathX.Hypot(dx, dz);
            if (d == 0) d = 1;
            double k = Math.Min(1, p.homing * dt);
            p.vx += ((dx / d) * sp - p.vx) * k;
            p.vz += ((dz / d) * sp - p.vz) * k;
            double s2 = MathX.Hypot(p.vx, p.vz);
            if (s2 == 0) s2 = 1;
            p.vx = (p.vx / s2) * sp;
            p.vz = (p.vz / s2) * sp;
            p.yaw = Math.Atan2(p.vx, p.vz);
        }

        void Collide(Projectile p)
        {
            double time = run.time;
            var beh = p.owner?.behavior;
            run.enemies.ForEachInRadius(p.x, p.z, p.radius, e =>
            {
                if (p.hitEvery > 0)
                {
                    int src = p.dmg.source;
                    if (time - e.lastHit[src] < p.hitEvery) return false;
                    e.lastHit[src] = time;
                }
                else
                {
                    if (p.hitIds.Contains(e.uid)) return false;
                    p.hitIds.Add(e.uid);
                }
                double len = MathX.Hypot(p.vx, p.vz);
                run.combat.Hit(e, p.dmg, 1, len > 0.1 ? p.vx : e.x - p.x, len > 0.1 ? p.vz : e.z - p.z);
                if (p.owner != null && beh?.projectileHit != null) beh.projectileHit(p.owner, run, p, e);
                if (p.pierce >= 0)
                {
                    p.pierce--;
                    if (p.pierce < 0)
                    {
                        Kill(p);
                        return true;
                    }
                }
                return !p.active;
            });
        }

        public void Clear()
        {
            foreach (var p in list) p.active = false;
            list.Clear();
        }
    }
}
