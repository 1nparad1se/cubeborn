using System;
using System.Collections.Generic;

namespace Cubeborn
{
    public class Bullet
    {
        public bool active;
        public double x, z, vx, vz, dmg, r = 0.3, life;
        public int color = 0xff3a6a;
        public bool slow;
    }

    public class Zone
    {
        public bool active;
        public double x, z, r = 1;
        /// <summary>Remaining telegraph time.</summary>
        public double t, tele = 1, dmg;
        /// <summary>Lingering pool duration after detonation (0 = none).</summary>
        public double pool, poolT, tick;
        public int color = 0xff3030;
        public bool freeze;
        /// <summary>Visual only (exploder/charger warnings).</summary>
        public bool visualOnly, delayedBlast;
    }

    public class Laser
    {
        public bool active;
        public double x, z, angle, sweep, len = 10, width = 1, tele = 1, t, dur = 2, dmg, tick;
        public Enemy owner;
        public int ownerUid;
        public int color = 0xff3060;
    }

    public class Shock
    {
        public bool active;
        public double x, z, r, maxR = 10, speed = 7, width = 1, dmg;
        public bool hit;
        public int color = 0xff5a3a;
    }

    public class LineWarn
    {
        public bool active;
        public double x, z, dx, dz, len = 8, width = 1, t, total = 1;
    }

    /// <summary>Enemy-side threats: bullets, telegraphed zones, lasers, shockwaves and explosions.</summary>
    public class Hazards
    {
        public readonly List<Bullet> bullets = Pool<Bullet>(400);
        public readonly List<Zone> zones = Pool<Zone>(80);
        public readonly List<Laser> lasers = Pool<Laser>(16);
        public readonly List<Shock> shocks = Pool<Shock>(16);
        public readonly List<LineWarn> warns = Pool<LineWarn>(24);
        readonly Run run;

        public Hazards(Run run) { this.run = run; }

        static List<T> Pool<T>(int n) where T : new()
        {
            var l = new List<T>(n);
            for (int i = 0; i < n; i++) l.Add(new T());
            return l;
        }

        static T Take<T>(List<T> arr, Func<T, bool> isActive) where T : new()
        {
            foreach (var o in arr) if (!isActive(o)) return o;
            var n = new T();
            arr.Add(n);
            return n;
        }

        public void Bullet(double x, double z, double vx, double vz, double dmg, double r = 0.28, double life = 4, int color = 0xff3a6a, bool slow = false)
        {
            var b = Take(bullets, o => o.active);
            b.active = true;
            b.x = x; b.z = z; b.vx = vx; b.vz = vz; b.dmg = dmg; b.r = r; b.life = life; b.color = color; b.slow = slow;
        }

        public Zone Zone(double x, double z, double r, double tele, double dmg, double pool = 0, int color = -1, bool freeze = false)
        {
            var o = Take(zones, q => q.active);
            o.active = true;
            o.x = x; o.z = z; o.r = r;
            o.t = o.tele = tele;
            o.dmg = dmg;
            o.pool = pool;
            o.poolT = 0;
            o.tick = 0;
            o.color = color >= 0 ? color : (freeze ? 0x6ad8ff : 0xff3030);
            o.freeze = freeze;
            o.visualOnly = false;
            o.delayedBlast = false;
            return o;
        }

        /// <summary>Purely visual warning circle.</summary>
        public void Telegraph(double x, double z, double r, double t)
        {
            var o = Zone(x, z, r, t, 0);
            o.visualOnly = true;
        }

        public void DelayedExplosion(double x, double z, double r, double dmg, double t)
        {
            var o = Zone(x, z, r, t, dmg);
            o.visualOnly = true;
            o.delayedBlast = true;
        }

        public void LineTelegraph(double x, double z, double dx, double dz, double len, double width, double t)
        {
            var w = Take(warns, o => o.active);
            w.active = true;
            w.x = x; w.z = z; w.dx = dx; w.dz = dz; w.len = len; w.width = width;
            w.t = w.total = t;
        }

        public void Laser(Enemy owner, double x, double z, double angle, double sweep, double len, double width, double tele, double dur, double dmg, int color = 0xff3060)
        {
            var l = Take(lasers, o => o.active);
            l.active = true;
            l.owner = owner;
            l.ownerUid = owner?.uid ?? 0;
            l.x = x; l.z = z; l.angle = angle; l.sweep = sweep; l.len = len; l.width = width; l.tele = tele;
            l.t = 0; l.dur = dur; l.dmg = dmg; l.tick = 0; l.color = color;
        }

        public void Shock(double x, double z, double maxR, double speed, double width, double dmg, int color = 0xff5a3a)
        {
            var s = Take(shocks, o => o.active);
            s.active = true;
            s.x = x; s.z = z; s.r = 0.5; s.maxR = maxR; s.speed = speed; s.width = width; s.dmg = dmg; s.hit = false; s.color = color;
        }

        /// <summary>Immediate explosion that can hit the player.</summary>
        public void Explode(double x, double z, double r, double dmg, int color)
        {
            var p = run.player;
            if ((p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < (r + p.radius) * (r + p.radius)) p.Hurt(dmg, null);
            run.fx.Burst(x, 0.6, z, color, 26, 6, 0.2, 0.6);
            run.fx.Burst(x, 0.4, z, 0x333333, 10, 3, 0.25, 0.8, ParticleKind.Smoke);
            run.fx.Light(x, z, color, 4, r * 3, 0.3);
            run.fx.Shake(0.2);
            run.fx.Sound("explosion", 0.6);
        }

        public void ClearNear(double x, double z, double r)
        {
            foreach (var b in bullets) if (b.active && (b.x - x) * (b.x - x) + (b.z - z) * (b.z - z) < r * r) b.active = false;
        }

        public void ClearAll()
        {
            foreach (var b in bullets) b.active = false;
            foreach (var o in zones) o.active = false;
            foreach (var l in lasers) l.active = false;
            foreach (var s in shocks) s.active = false;
            foreach (var w in warns) w.active = false;
        }

        public void Update(double dt)
        {
            var p = run.player;
            var t = run.terrain;
            for (int i = 0; i < bullets.Count; i++)
            {
                var b = bullets[i];
                if (!b.active) continue;
                b.x += b.vx * dt;
                b.z += b.vz * dt;
                b.life -= dt;
                if (b.life <= 0 || t.BlocksFlyer((int)Math.Floor(b.x), (int)Math.Floor(b.z)))
                {
                    b.active = false;
                    continue;
                }
                double rr = b.r + p.radius;
                if ((b.x - p.x) * (b.x - p.x) + (b.z - p.z) * (b.z - p.z) < rr * rr)
                {
                    b.active = false;
                    if (p.Hurt(b.dmg, null) > 0 && b.slow) p.slowT = 1.5;
                    run.fx.Burst(b.x, 0.8, b.z, b.color, 6, 3, 0.12, 0.3);
                }
            }
            for (int i = 0; i < zones.Count; i++)
            {
                var o = zones[i];
                if (!o.active) continue;
                if (o.t > 0)
                {
                    o.t -= dt;
                    if (o.t <= 0)
                    {
                        if (o.visualOnly && !o.delayedBlast)
                        {
                            o.active = false;
                            continue;
                        }
                        // detonate
                        double rr = o.r + p.radius * 0.5;
                        bool inside = (p.x - o.x) * (p.x - o.x) + (p.z - o.z) * (p.z - o.z) < rr * rr;
                        if (inside)
                        {
                            p.Hurt(o.dmg, null);
                            if (o.freeze) p.slowT = 2;
                        }
                        run.fx.Burst(o.x, 0.4, o.z, o.color, 16, 5, 0.18, 0.5);
                        run.fx.Light(o.x, o.z, o.color, 2.5, o.r * 3, 0.25);
                        if (o.pool > 0) o.poolT = o.pool;
                        else o.active = false;
                    }
                }
                else
                {
                    o.poolT -= dt;
                    o.tick -= dt;
                    if (o.tick <= 0)
                    {
                        o.tick = 0.5;
                        if ((p.x - o.x) * (p.x - o.x) + (p.z - o.z) * (p.z - o.z) < o.r * o.r) p.Hurt(o.dmg * 0.35, null, true);
                    }
                    if (o.poolT <= 0) o.active = false;
                }
            }
            for (int i = 0; i < lasers.Count; i++)
            {
                var l = lasers[i];
                if (!l.active) continue;
                if (l.owner != null)
                {
                    if (!l.owner.alive || l.owner.uid != l.ownerUid)
                    {
                        l.active = false;
                        continue;
                    }
                    l.x = l.owner.x;
                    l.z = l.owner.z;
                }
                l.t += dt;
                if (l.t > l.tele)
                {
                    l.angle += l.sweep * dt;
                    l.tick -= dt;
                    double ex = l.x + Math.Cos(l.angle) * l.len, ez = l.z + Math.Sin(l.angle) * l.len;
                    double rr = l.width / 2 + p.radius;
                    if (l.tick <= 0 && MathX.SegDist2(p.x, p.z, l.x, l.z, ex, ez) < rr * rr)
                    {
                        l.tick = 0.25;
                        p.Hurt(l.dmg, null);
                    }
                }
                if (l.t > l.tele + l.dur) l.active = false;
            }
            for (int i = 0; i < shocks.Count; i++)
            {
                var s = shocks[i];
                if (!s.active) continue;
                s.r += s.speed * dt;
                double d = MathX.Hypot(p.x - s.x, p.z - s.z);
                if (!s.hit && Math.Abs(d - s.r) < s.width / 2 + p.radius)
                {
                    s.hit = true;
                    p.Hurt(s.dmg, null);
                }
                if (s.r >= s.maxR) s.active = false;
            }
            for (int i = 0; i < warns.Count; i++)
            {
                var w = warns[i];
                if (!w.active) continue;
                w.t -= dt;
                if (w.t <= 0) w.active = false;
            }
        }
    }
}
