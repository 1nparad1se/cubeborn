using System;
using System.Collections.Generic;
using static Cubeborn.WUtil;

namespace Cubeborn
{
    public static partial class Behaviors
    {
        static void StrikeAt(WeaponInstance w, Run run, double x, double z)
        {
            double r = w.P("radius", 1.3) * w.Area(run);
            HitCircle(run, w, x, z, r);
            var ef = run.effects.Add(EffectKind.Bolt, x, z, 0.22, w.def.color);
            ef.x2 = x + (run.rng.Next() - 0.5) * 2;
            ef.z2 = z - 2;
            ef.y = 12;
            ef.w = 0.25;
            ExplosionFx(run, x, z, r, w.def.color, 0.05);
            run.fx.Sound("zap", 0.5);
        }

        static readonly HashSet<int> visited = new HashSet<int>();

        static void RegisterMagic()
        {
            // Storm Rod / Tempest Crown: lightning from the sky (evolution: orbiting storm clouds).
            WeaponBehavior.Register("strike", new WeaponBehavior
            {
                update = (w, run, dt) =>
                {
                    if (!w.evo) return;
                    int want = w.Amount(run) + 1;
                    var list = w.stProjs ?? (w.stProjs = new List<Projectile>());
                    for (int i = list.Count - 1; i >= 0; i--) if (!list[i].active) list.RemoveAt(i);
                    while (list.Count < want)
                    {
                        var pl = run.player;
                        var p = run.projectiles.Spawn(w, pl.x, pl.z, 0, 0, 1e9, "cloud", 0x8090b0);
                        p.custom = true;
                        p.collide = false;
                        p.y = 4;
                        list.Add(p);
                    }
                    while (list.Count > want)
                    {
                        list[list.Count - 1].active = false;
                        list.RemoveAt(list.Count - 1);
                    }
                    for (int i = 0; i < list.Count; i++) list[i].a = (double)i / list.Count * MathX.TAU;
                },
                fire = (w, run) =>
                {
                    var pl = run.player;
                    if (w.evo)
                    {
                        if (w.stProjs != null)
                            foreach (var c in w.stProjs)
                            {
                                var t = run.enemies.RandomInRadius(c.x, c.z, 5);
                                if (t != null) StrikeAt(w, run, t.x, t.z);
                            }
                        return;
                    }
                    int n = w.Amount(run);
                    for (int i = 0; i < n; i++)
                    {
                        run.Later(i * w.P("interval", 0.1), () =>
                        {
                            var t = run.enemies.RandomInRadius(pl.x, pl.z, 13);
                            if (t != null) StrikeAt(w, run, t.x, t.z);
                        });
                    }
                },
                projectileUpdate = (w, run, p, dt) =>
                {
                    var pl = run.player;
                    p.b += dt;
                    double ang = p.a + p.b * 0.8;
                    p.x = pl.x + Math.Cos(ang) * 4.5;
                    p.z = pl.z + Math.Sin(ang) * 4.5;
                    return true;
                },
                onRemove = (w, run) =>
                {
                    if (w.stProjs != null) foreach (var p in w.stProjs) p.active = false;
                },
            });

            // Chain Spark / Thunderweb: lightning hopping between enemies.
            WeaponBehavior.Register("chain", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    int n = w.Amount(run);
                    int hops = MathX.RoundI(w.P("chains", 4));
                    double range = w.P("range", 4.5) * w.Area(run);
                    for (int i = 0; i < n; i++)
                    {
                        run.Later(i * 0.12, () =>
                        {
                            visited.Clear();
                            double fromX = pl.x, fromZ = pl.z;
                            var cur = run.enemies.Nearest(pl.x, pl.z, 9, visited);
                            int left = hops;
                            while (cur != null && left-- > 0)
                            {
                                visited.Add(cur.uid);
                                var ef = run.effects.Add(EffectKind.Bolt, fromX, fromZ, 0.2, w.def.color);
                                ef.x2 = cur.x;
                                ef.z2 = cur.z;
                                ef.y = 0.9;
                                ef.w = 0.12;
                                run.combat.Hit(cur, w.dmg, 1, cur.x - fromX, cur.z - fromZ);
                                run.fx.Burst(cur.x, 0.9, cur.z, w.def.color, 4, 3, 0.1, 0.25);
                                if (w.evo)
                                {
                                    var fork = run.enemies.Nearest(cur.x, cur.z, range, visited);
                                    if (fork != null)
                                    {
                                        visited.Add(fork.uid);
                                        var ef2 = run.effects.Add(EffectKind.Bolt, cur.x, cur.z, 0.2, 0xffffff);
                                        ef2.x2 = fork.x;
                                        ef2.z2 = fork.z;
                                        ef2.y = 0.9;
                                        ef2.w = 0.08;
                                        run.combat.Hit(fork, w.dmg, 0.6, fork.x - cur.x, fork.z - cur.z);
                                    }
                                }
                                fromX = cur.x;
                                fromZ = cur.z;
                                cur = run.enemies.Nearest(cur.x, cur.z, range, visited);
                            }
                            run.fx.Light(pl.x, pl.z, w.def.color, 1.5, 6, 0.15);
                            run.fx.Sound("zap", 0.4);
                        });
                    }
                },
            });

            // Prism Ray / Rainbow Lattice: sustained beams.
            WeaponBehavior.Register("beam", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    int n = w.Amount(run);
                    var beams = w.stBeams ?? (w.stBeams = new List<BeamState>());
                    double dur = w.Duration(run);
                    var t0 = run.enemies.Nearest(pl.x, pl.z, 12);
                    double bas = t0 != null ? Math.Atan2(t0.z - pl.z, t0.x - pl.x) : Math.Atan2(pl.fz, pl.fx);
                    for (int i = 0; i < n; i++)
                    {
                        var ef = run.effects.Add(EffectKind.Beam, pl.x, pl.z, dur, w.def.color);
                        ef.w = w.P("width", 0.7) * w.Area(run);
                        ef.y = 0.9;
                        beams.Add(new BeamState { ef = ef, angle = bas + (double)i / n * MathX.TAU * (w.evo ? 1 : 0.15), t = dur, idx = i });
                    }
                    run.fx.Sound("beam", 0.5);
                },
                update = (w, run, dt) =>
                {
                    var beams = w.stBeams;
                    if (beams == null || beams.Count == 0) return;
                    var pl = run.player;
                    double len = w.P("length", 9) * w.Area(run);
                    double width = w.P("width", 0.7) * w.Area(run);
                    for (int i = beams.Count - 1; i >= 0; i--)
                    {
                        if (i >= beams.Count) continue;
                        var b = beams[i];
                        b.t -= dt;
                        if (b.t <= 0)
                        {
                            b.ef.active = false;
                            beams.RemoveAt(i);
                            continue;
                        }
                        if (w.evo) b.angle += 1.1 * dt;
                        else
                        {
                            var t = run.enemies.Nearest(pl.x, pl.z, len);
                            if (t != null)
                            {
                                double want = Math.Atan2(t.z - pl.z, t.x - pl.x);
                                double d = want - b.angle;
                                d = Math.Atan2(Math.Sin(d), Math.Cos(d));
                                b.angle += d * Math.Min(1, 4 * dt) + (b.idx != 0 ? 0.25 * b.idx * dt : 0);
                            }
                        }
                        double ex = pl.x + Math.Cos(b.angle) * len, ez = pl.z + Math.Sin(b.angle) * len;
                        b.ef.x = pl.x;
                        b.ef.z = pl.z;
                        b.ef.x2 = ex;
                        b.ef.z2 = ez;
                        b.ef.life = Math.Max(b.ef.life, 0.05);
                        HitLine(run, w, pl.x, pl.z, ex, ez, width, 1, w.P("hitEvery", 0.15));
                        if (run.rng.Chance(0.3)) run.fx.Burst(ex, 0.9, ez, w.def.color, 1, 2, 0.12, 0.3);
                        run.fx.Light((pl.x + ex) / 2, (pl.z + ez) / 2, w.def.color, 1.2, 6, 0.05);
                    }
                },
                onRemove = (w, run) =>
                {
                    if (w.stBeams != null) foreach (var b in w.stBeams) b.ef.active = false;
                    w.stBeams = new List<BeamState>();
                },
            });
        }

        static void MakePool(WeaponInstance w, Run run, double x, double z, double scale = 1)
        {
            double r = w.P("radius", 1.7) * w.Area(run) * scale;
            var p = run.projectiles.Spawn(w, x, z, 0, 0, w.Duration(run) * scale, "pool", w.def.color);
            p.custom = true;
            p.pierce = -1;
            p.hitEvery = w.P("hitEvery", 0.4);
            p.radius = r;
            p.scale = r;
            p.y = 0.04;
            p.a = r;
            p.dmg.knockback = 0;
            run.fx.Burst(x, 0.3, z, w.def.color, 10, 3, 0.15, 0.5);
            run.fx.Sound("glass", 0.4);
        }

        static void BombBlast(WeaponInstance w, Run run, double x, double z, double scale)
        {
            double r = w.P("radius", 2.4) * w.Area(run) * scale;
            HitCircle(run, w, x, z, r, scale < 1 ? 0.5 : 1);
            ExplosionFx(run, x, z, r, 0xff9b3d, scale < 1 ? 0.05 : 0.18);
            run.fx.Sound("explosion", scale < 1 ? 0.3 : 0.6);
        }

        static void RegisterArea()
        {
            // Whirling Saws / Maelstrom Saws: blades orbiting the hero.
            WeaponBehavior.Register("orbit", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var list = w.stProjs ?? (w.stProjs = new List<Projectile>());
                    for (int i = list.Count - 1; i >= 0; i--) if (!list[i].active) list.RemoveAt(i);
                    int n = w.Amount(run);
                    if (w.evo && list.Count == n) return;
                    foreach (var p in list) p.active = false;
                    list.Clear();
                    double life = w.evo ? 1e9 : w.Duration(run);
                    for (int i = 0; i < n; i++)
                    {
                        var pl = run.player;
                        var p = run.projectiles.Spawn(w, pl.x, pl.z, 0, 0, life, "saw", w.def.color);
                        p.custom = true;
                        p.pierce = -1;
                        p.hitEvery = w.P("hitEvery", 0.4);
                        p.a = (double)i / n * MathX.TAU;
                        p.radius = 0.55 * w.Area(run);
                        p.scale = w.Area(run);
                        p.spin = 18;
                        list.Add(p);
                    }
                    run.fx.Sound("saw", 0.4);
                },
                projectileUpdate = (w, run, p, dt) =>
                {
                    var pl = run.player;
                    double bas = w.P("radius", 2.4) * Math.Sqrt(w.Area(run));
                    double r = w.evo ? bas * (1 + 0.4 * Math.Sin(run.time * 1.6)) : bas;
                    double ang = p.a + run.time * w.Speed(run);
                    p.x = pl.x + Math.Cos(ang) * r;
                    p.z = pl.z + Math.Sin(ang) * r;
                    p.vx = -Math.Sin(ang);
                    p.vz = Math.Cos(ang);
                    p.radius = 0.55 * w.Area(run);
                    return true;
                },
                onRemove = (w, run) =>
                {
                    if (w.stProjs != null) foreach (var p in w.stProjs) p.active = false;
                },
            });

            // Sanctified Halo / Sanctum: damaging aura.
            WeaponBehavior.Register("aura", new WeaponBehavior
            {
                update = (w, run, dt) =>
                {
                    var ef = w.stEf;
                    if (ef == null || !ef.active || ef.kind != EffectKind.Aura)
                    {
                        ef = run.effects.Add(EffectKind.Aura, run.player.x, run.player.z, 1e9, w.def.color);
                        ef.follow = true;
                        w.stEf = ef;
                    }
                    ef.r = w.P("radius", 2.2) * w.Area(run);
                },
                fire = (w, run) =>
                {
                    var pl = run.player;
                    double r = w.P("radius", 2.2) * w.Area(run);
                    run.enemies.ForEachInRadius(pl.x, pl.z, r, e =>
                    {
                        run.combat.Hit(e, w.dmg, 1, e.x - pl.x, e.z - pl.z);
                        if (w.evo && e.alive)
                        {
                            e.slowMul = Math.Min(e.slowMul, w.P("slow", 0.6));
                            e.slowT = Math.Max(e.slowT, 0.6);
                        }
                        return false;
                    });
                },
                onKill = (w, run, e) =>
                {
                    if (!w.evo) return;
                    var pl = run.player;
                    double r = w.P("radius", 2.2) * w.Area(run) + 0.5;
                    if ((e.x - pl.x) * (e.x - pl.x) + (e.z - pl.z) * (e.z - pl.z) < r * r) pl.Heal(0.35, true);
                },
                onRemove = (w, run) =>
                {
                    if (w.stEf != null) w.stEf.active = false;
                },
            });

            // Pulse Heart / Resonance: expanding waves.
            WeaponBehavior.Register("nova", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    int n = w.Amount(run);
                    for (int i = 0; i < n; i++)
                    {
                        run.Later(i * 0.3, () =>
                        {
                            var pl = run.player;
                            double r = w.P("radius", 5) * w.Area(run);
                            double dur = w.P("duration", 0.6);
                            (w.stWaves ?? (w.stWaves = new List<Wave>())).Add(new Wave { t = 0, dur = dur, r = r, x = pl.x, z = pl.z });
                            var ef = run.effects.Add(EffectKind.Ring, pl.x, pl.z, dur, w.def.color);
                            ef.r = r;
                            ef.w = 0.6;
                            run.fx.Sound("pulse", 0.5);
                            run.fx.Light(pl.x, pl.z, w.def.color, 2, r * 1.5, dur);
                        });
                    }
                },
                update = (w, run, dt) =>
                {
                    var waves = w.stWaves;
                    if (waves == null) return;
                    for (int i = waves.Count - 1; i >= 0; i--)
                    {
                        if (i >= waves.Count) continue;
                        var wv = waves[i];
                        double r0 = (wv.t / wv.dur) * wv.r;
                        wv.t += dt;
                        double r1 = Math.Min(1, wv.t / wv.dur) * wv.r;
                        run.enemies.ForEachInRadius(wv.x, wv.z, r1, e =>
                        {
                            double d = MathX.Hypot(e.x - wv.x, e.z - wv.z);
                            if (d + e.radius < r0) return false;
                            run.combat.Hit(e, w.dmg, 1, e.x - wv.x, e.z - wv.z);
                            return false;
                        });
                        if (wv.t >= wv.dur)
                        {
                            waves.Remove(wv);
                            if (w.evo)
                            {
                                // drag survivors back toward the center
                                run.enemies.ForEachInRadius(wv.x, wv.z, wv.r + 1, e =>
                                {
                                    if (e.boss != null) return false;
                                    double dx = wv.x - e.x, dz = wv.z - e.z;
                                    double d = MathX.Hypot(dx, dz);
                                    if (d == 0) d = 1;
                                    e.kx += (dx / d) * 9 * (1 - e.kbResist);
                                    e.kz += (dz / d) * 9 * (1 - e.kbResist);
                                    return false;
                                });
                            }
                        }
                    }
                },
            });

            // Cyclone Fan / Hurricane Eye: wandering tornadoes that pull enemies.
            WeaponBehavior.Register("tornado", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    if (w.evo)
                    {
                        var t = w.stEye;
                        if (t != null && t.active) return;
                        var p = run.projectiles.Spawn(w, pl.x, pl.z, 0, 0, 1e9, "tornado", w.def.color);
                        p.custom = true;
                        p.pierce = -1;
                        p.hitEvery = w.P("hitEvery", 0.25);
                        w.stEye = p;
                        return;
                    }
                    int n = w.Amount(run);
                    for (int i = 0; i < n; i++)
                    {
                        double a = run.rng.Next() * MathX.TAU;
                        double sp = w.Speed(run);
                        var p = run.projectiles.Spawn(w, pl.x, pl.z, Math.Cos(a) * sp, Math.Sin(a) * sp, w.Duration(run), "tornado", w.def.color);
                        p.custom = true;
                        p.pierce = -1;
                        p.hitEvery = w.P("hitEvery", 0.35);
                        p.a = a;
                    }
                    run.fx.Sound("wind", 0.5);
                },
                projectileUpdate = (w, run, p, dt) =>
                {
                    var pl = run.player;
                    double r = w.P("radius", 1.6) * w.Area(run);
                    p.radius = r;
                    p.scale = r / 1.6;
                    if (w.evo)
                    {
                        double k = 1 - Math.Exp(-3 * dt);
                        p.x += (pl.x - p.x) * k;
                        p.z += (pl.z - p.z) * k;
                    }
                    else
                    {
                        p.a += (run.rng.Next() - 0.5) * 4 * dt;
                        double sp = w.Speed(run);
                        p.vx = Math.Cos(p.a) * sp;
                        p.vz = Math.Sin(p.a) * sp;
                        p.x += p.vx * dt;
                        p.z += p.vz * dt;
                    }
                    double pull = w.P("pull", 3);
                    run.enemies.ForEachInRadius(p.x, p.z, r * 2.2, e =>
                    {
                        if (e.boss != null) return false;
                        double dx = p.x - e.x, dz = p.z - e.z;
                        double d = MathX.Hypot(dx, dz);
                        if (d == 0) d = 1;
                        double f = pull * (1 - e.kbResist) * dt * 4;
                        e.kx += (dx / d) * f - (dz / d) * f * 0.6;
                        e.kz += (dz / d) * f + (dx / d) * f * 0.6;
                        return false;
                    });
                    return p.life > 0;
                },
            });

            // Venom Flask / Plague Bloom: thrown flasks leave poison pools.
            WeaponBehavior.Register("pool", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    int n = w.Amount(run);
                    for (int i = 0; i < n; i++)
                    {
                        var t = run.enemies.RandomInRadius(pl.x, pl.z, 10);
                        double tx = t != null ? t.x : pl.x + (run.rng.Next() - 0.5) * 8;
                        double tz = t != null ? t.z : pl.z + (run.rng.Next() - 0.5) * 8;
                        var p = run.projectiles.Spawn(w, pl.x, pl.z, 0, 0, 0.55, "flask", w.def.color);
                        p.custom = true;
                        p.collide = false;
                        p.spin = 10;
                        p.a = pl.x;
                        p.b = pl.z;
                        p.c = tx;
                        p.d = tz;
                    }
                },
                projectileUpdate = (w, run, p, dt) =>
                {
                    if (p.vis == "flask")
                    {
                        double t = Math.Min(1, p.age / 0.55);
                        p.x = p.a + (p.c - p.a) * t;
                        p.z = p.b + (p.d - p.b) * t;
                        p.y = 0.8 + Math.Sin(t * Math.PI) * 2.5;
                        if (t >= 1)
                        {
                            MakePool(w, run, p.x, p.z);
                            return false;
                        }
                        return true;
                    }
                    // pool
                    if (w.evo)
                    {
                        double grow = 1 + Math.Min(0.6, p.age * 0.15);
                        p.radius = p.a * grow;
                        p.scale = p.radius;
                    }
                    return p.life > 0;
                },
                onKill = (w, run, e) =>
                {
                    if (!w.evo || e.poisonT <= 0) return;
                    if (w.stBloomCd > run.time) return;
                    w.stBloomCd = run.time + 0.6;
                    MakePool(w, run, e.x, e.z, 0.6);
                },
            });

            // Powder Keg / Cluster Barrage: lobbed bombs.
            WeaponBehavior.Register("lob", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    int n = w.Amount(run);
                    for (int i = 0; i < n; i++)
                    {
                        run.Later(i * w.P("interval", 0.2), () =>
                        {
                            GroundTarget(run, 11, out double gx, out double gz);
                            double tx = gx + (run.rng.Next() - 0.5) * 2;
                            double tz = gz + (run.rng.Next() - 0.5) * 2;
                            var p = run.projectiles.Spawn(w, pl.x, pl.z, 0, 0, 10, "bomb", w.def.color);
                            p.custom = true;
                            p.collide = false;
                            p.a = pl.x;
                            p.b = pl.z;
                            p.c = tx;
                            p.d = tz;
                            p.e = 1;
                            p.spin = 6;
                        });
                    }
                },
                projectileUpdate = (w, run, p, dt) =>
                {
                    const double flight = 0.6;
                    if (p.age < flight)
                    {
                        double t = p.age / flight;
                        p.x = p.a + (p.c - p.a) * t;
                        p.z = p.b + (p.d - p.b) * t;
                        p.y = 0.6 + Math.Sin(t * Math.PI) * 3 * p.e;
                        return true;
                    }
                    p.y = 0.3;
                    p.spin = 0;
                    double fuse = (p.e < 1 ? 0.3 : w.P("duration", 0.8)) + flight;
                    p.glow = Math.Sin(p.age * 30) > 0 ? 1 : 0;
                    if (p.age >= fuse)
                    {
                        BombBlast(w, run, p.x, p.z, p.e);
                        if (w.evo && p.e == 1)
                        {
                            for (int k = 0; k < 4; k++)
                            {
                                double a = k / 4.0 * MathX.TAU + run.rng.Next();
                                var c = run.projectiles.Spawn(w, p.x, p.z, 0, 0, 10, "bomb", 0xffd04a);
                                c.custom = true;
                                c.collide = false;
                                c.a = p.x;
                                c.b = p.z;
                                c.c = p.x + Math.Cos(a) * 2.8;
                                c.d = p.z + Math.Sin(a) * 2.8;
                                c.e = 0.5;
                                c.scale = 0.6;
                            }
                        }
                        return false;
                    }
                    return true;
                },
            });

            // Rune Traps / Minefield: proximity mines.
            WeaponBehavior.Register("mine", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    int n = w.Amount(run);
                    for (int i = 0; i < n; i++)
                    {
                        double a = (double)i / n * MathX.TAU + run.time;
                        double r = n == 1 ? 0 : w.evo ? 3 : 1.5;
                        var p = run.projectiles.Spawn(w, pl.x + Math.Cos(a) * r, pl.z + Math.Sin(a) * r, 0, 0, w.Duration(run), "mine", w.def.color);
                        p.custom = true;
                        p.collide = false;
                        p.y = 0.05;
                        p.a = 0; // fuse (0 = waiting)
                    }
                    run.fx.Sound("mine", 0.3);
                },
                projectileUpdate = (w, run, p, dt) =>
                {
                    if (p.a > 0)
                    {
                        p.a -= dt;
                        if (p.a <= 0)
                        {
                            double r = w.P("radius", 2.2) * w.Area(run);
                            HitCircle(run, w, p.x, p.z, r);
                            ExplosionFx(run, p.x, p.z, r, w.def.color, 0.1);
                            run.fx.Sound("explosion", 0.45);
                            if (w.evo)
                            {
                                // chain reaction
                                double rr = r * 1.6;
                                foreach (var o in run.projectiles.list)
                                    if (o.active && o != p && o.owner == w && o.vis == "mine" && o.a == 0 && (o.x - p.x) * (o.x - p.x) + (o.z - p.z) * (o.z - p.z) < rr * rr) o.a = 0.15;
                            }
                            return false;
                        }
                        p.glow = 1;
                        return true;
                    }
                    p.glow = Math.Sin(p.age * 6) > 0.6 ? 0.6 : 0;
                    if (p.age < 0.5) return p.life > 0;
                    double trig = w.P("trigger", 1.3);
                    bool found = false;
                    run.enemies.ForEachInRadius(p.x, p.z, trig, e =>
                    {
                        found = true;
                        return true;
                    });
                    if (found) p.a = 0.12;
                    return p.life > 0;
                },
            });

            // Starfall Tome / Cataclysm: meteors onto clusters.
            WeaponBehavior.Register("meteor", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    int n = w.Amount(run);
                    for (int i = 0; i < n; i++)
                    {
                        run.Later(i * w.P("interval", 0.3), () =>
                        {
                            GroundTarget(run, 13, out double gx, out double gz);
                            double r = w.P("radius", 2.8) * w.Area(run);
                            double fall = w.P("duration", 0.9);
                            var ef = run.effects.Add(EffectKind.Warn, gx, gz, fall, w.def.color);
                            ef.r = r;
                            var p = run.projectiles.Spawn(w, gx - 3, gz - 3, 0, 0, fall, "meteor", w.def.color);
                            p.custom = true;
                            p.collide = false;
                            p.a = gx;
                            p.b = gz;
                            p.c = fall;
                            p.glow = 2;
                            p.scale = 0.8 + r * 0.25;
                        });
                    }
                },
                projectileUpdate = (w, run, p, dt) =>
                {
                    double t = Math.Min(1, p.age / p.c);
                    p.x = p.a - 3 * (1 - t);
                    p.z = p.b - 3 * (1 - t);
                    p.y = 14 * (1 - t) + 0.3;
                    if (run.rng.Chance(0.5)) run.fx.Burst(p.x, p.y, p.z, 0xffa040, 1, 1, 0.2, 0.4);
                    if (t >= 1)
                    {
                        double r = w.P("radius", 2.8) * w.Area(run);
                        HitCircle(run, w, p.a, p.b, r);
                        ExplosionFx(run, p.a, p.b, r, w.def.color, 0.3);
                        run.fx.Burst(p.a, 0.3, p.b, 0x5a4a3a, 14, 5, 0.25, 0.8, ParticleKind.Debris);
                        run.fx.Sound("explosion", 0.7);
                        return false;
                    }
                    return true;
                },
            });

            // Bone Familiars / Legion of Bones: summoned skeleton allies.
            WeaponBehavior.Register("summon", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    int n = w.Amount(run);
                    int have = run.allies.Count(w.source);
                    int toSpawn = w.evo ? n - have : n;
                    double scale = (w.evo ? 1.25 : 1) * Math.Sqrt(w.Area(run));
                    for (int i = 0; i < toSpawn; i++)
                    {
                        double a = run.rng.Next() * MathX.TAU;
                        run.allies.Spawn(pl.x + Math.Cos(a) * 1.5, pl.z + Math.Sin(a) * 1.5, w.evo ? 1e9 : w.Duration(run), w.Speed(run), w.dmg, w.P("hitEvery", 0.6), w.evo ? "ally_knight" : "ally_skeleton", w.source, scale);
                    }
                    if (toSpawn > 0) run.fx.Sound("bones", 0.5);
                },
                onRemove = (w, run) => run.allies.Dismiss(w.source),
            });
        }
    }
}
