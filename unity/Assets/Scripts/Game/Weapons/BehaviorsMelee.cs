using System;
using System.Collections.Generic;
using static Cubeborn.WUtil;

namespace Cubeborn
{
    public static partial class Behaviors
    {
        static bool registered;

        public static void RegisterAll()
        {
            if (registered) return;
            registered = true;
            RegisterMelee();
            RegisterProjectiles();
            RegisterMagic();
            RegisterArea();
        }

        static void RegisterMelee()
        {
            // Rune Blade / Soulreaver: arc slashes around the hero.
            WeaponBehavior.Register("slash", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var p = run.player;
                    int n = w.Amount(run);
                    double range = w.P("range", 2.6) * w.Area(run);
                    double arc = w.P("arc", 130) * Math.PI / 180;
                    for (int i = 0; i < n; i++)
                    {
                        int ii = i;
                        run.Later(ii * 0.14, () =>
                        {
                            bool back = ii % 2 == 1;
                            var a0 = DoAim(w, run, range + 2);
                            double bas = Math.Atan2(a0.z, a0.x) + (back ? Math.PI : 0) + (w.evo ? ii * 0.6 : 0);
                            var ef = run.effects.Add(EffectKind.Slash, p.x, p.z, 0.22, w.def.color);
                            ef.angle = bas;
                            ef.arc = Math.Min(MathX.TAU, arc);
                            ef.r = range;
                            ef.follow = true;
                            p.attackPulse = 0.2;
                            run.fx.Sound("slash", 0.6);
                            run.enemies.ForEachInRadius(p.x, p.z, range, e =>
                            {
                                if (arc < MathX.TAU)
                                {
                                    double d = Math.Atan2(e.z - p.z, e.x - p.x) - bas;
                                    d = Math.Atan2(Math.Sin(d), Math.Cos(d));
                                    if (Math.Abs(d) > arc / 2 + 0.2) return false;
                                }
                                run.combat.Hit(e, w.dmg, 1, e.x - p.x, e.z - p.z);
                                return false;
                            });
                            if (w.evo)
                            {
                                // crescents fly outward in a fan
                                for (int k = -1; k <= 1; k++)
                                {
                                    double a = bas + k * 0.35;
                                    double sp = w.Speed(run);
                                    var pr = run.projectiles.Spawn(w, p.x, p.z, Math.Cos(a) * sp, Math.Sin(a) * sp, 0.7, "crescent", w.def.color);
                                    pr.pierce = -1;
                                    pr.radius = 0.7 * w.Area(run);
                                    pr.scale = w.Area(run);
                                    pr.dmg.damage *= 0.5;
                                    pr.glow = 1;
                                }
                            }
                        });
                    }
                },
            });

            // Spirit Fists / Hundred Palms: rapid punches at the nearest enemies.
            WeaponBehavior.Register("fists", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var p = run.player;
                    int n = w.Amount(run);
                    double range = w.P("range", 2.4) * Math.Sqrt(w.Area(run));
                    for (int i = 0; i < n; i++)
                    {
                        int ii = i;
                        run.Later(ii * w.P("interval", 0.09), () =>
                        {
                            var t = run.enemies.Nearest(p.x, p.z, range + 1);
                            double dx = p.fx, dz = p.fz;
                            if (t != null)
                            {
                                double d = MathX.Hypot(t.x - p.x, t.z - p.z);
                                if (d == 0) d = 1;
                                dx = (t.x - p.x) / d;
                                dz = (t.z - p.z) / d;
                            }
                            double side = ii % 2 != 0 ? 0.35 : -0.35;
                            double reach = Math.Min(range, t != null ? MathX.Hypot(t.x - p.x, t.z - p.z) : 1.3);
                            double hx = p.x + dx * reach - dz * side, hz = p.z + dz * reach + dx * side;
                            HitCircle(run, w, hx, hz, 0.9 * w.Area(run));
                            var ef = run.effects.Add(EffectKind.Punch, hx, hz, 0.16, w.def.color);
                            ef.angle = Math.Atan2(dz, dx);
                            ef.r = 0.9 * w.Area(run);
                            p.attackPulse = 0.12;
                            run.fx.Sound("punch", 0.45);
                            if (w.evo)
                            {
                                double sp = w.Speed(run);
                                var pr = run.projectiles.Spawn(w, hx, hz, dx * sp, dz * sp, 0.35, "fistwave", w.def.color);
                                pr.pierce = -1;
                                pr.radius = 0.8 * w.Area(run);
                                pr.scale = w.Area(run);
                                pr.dmg.damage *= 0.6;
                            }
                        });
                    }
                },
            });

            // Sky Lance / Dragon Lance: long piercing thrusts.
            WeaponBehavior.Register("lance", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var p = run.player;
                    int n = w.Amount(run);
                    double len = w.P("range", 6) * w.Area(run);
                    double width = w.P("width", 0.9) * w.Area(run);
                    var a0 = DoAim(w, run);
                    double bas = Math.Atan2(a0.z, a0.x);
                    for (int i = 0; i < n; i++)
                    {
                        double a = w.evo ? bas + (i * MathX.TAU) / Math.Max(4, n) : bas + (i % 2 != 0 ? Math.PI : 0) + Math.Floor(i / 2.0) * 0.25;
                        run.Later(w.evo ? 0 : i * 0.12, () =>
                        {
                            double dx = Math.Cos(a), dz = Math.Sin(a);
                            HitLine(run, w, p.x, p.z, p.x + dx * len, p.z + dz * len, width);
                            var ef = run.effects.Add(EffectKind.Lance, p.x, p.z, 0.25, w.def.color);
                            ef.angle = a;
                            ef.r = len;
                            ef.w = width;
                            ef.follow = true;
                            p.attackPulse = 0.2;
                            run.fx.Sound("thrust", 0.6);
                            if (w.evo)
                            {
                                for (int k = 1; k <= 4; k++)
                                {
                                    double fx = p.x + dx * (len * k) / 4.5, fz = p.z + dz * (len * k) / 4.5;
                                    var pr = run.projectiles.Spawn(w, fx, fz, 0, 0, 2, "firepatch", 0xff6a1a);
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
        }

        static Projectile Shoot(WeaponInstance w, Run run, double x, double z, double ang, double speed, double life, string vis)
        {
            var p = run.projectiles.Spawn(w, x, z, Math.Cos(ang) * speed, Math.Sin(ang) * speed, life, vis, w.def.color);
            p.pierce = w.Pierce(run);
            return p;
        }

        static void FireballBlast(WeaponInstance w, Run run, Projectile p)
        {
            if (p.a == 1) return;
            p.a = 1;
            double r = w.P("radius", 1.8) * w.Area(run);
            HitCircle(run, w, p.x, p.z, r);
            ExplosionFx(run, p.x, p.z, r, 0xff8a2a, 0.08);
            run.fx.Sound("fire", 0.5);
            if (w.evo)
            {
                var pool = run.projectiles.Spawn(w, p.x, p.z, 0, 0, 3 * run.player.stats.duration, "firepool", 0xff7a1a);
                pool.radius = r * 0.8;
                pool.scale = r * 0.8;
                pool.hitEvery = 0.5;
                pool.pierce = -1;
                pool.y = 0.05;
                pool.dmg.damage *= 0.12;
                pool.dmg.knockback = 0;
                pool.glow = 1;
            }
        }

        static void RegisterProjectiles()
        {
            // Twin Daggers / Thousand Edges: thrown in the movement direction.
            WeaponBehavior.Register("directional", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    int n = w.Amount(run);
                    double bas = Math.Atan2(pl.fz, pl.fx);
                    double sp = w.Speed(run);
                    double life = w.Duration(run);
                    if (w.evo)
                    {
                        double spread = w.P("spread", 50) * Math.PI / 180;
                        for (int i = 0; i < n; i++)
                        {
                            double a = bas + (run.rng.Next() - 0.5) * spread;
                            var p = Shoot(w, run, pl.x, pl.z, a, sp, life, "dagger");
                            p.scale = 1.1;
                        }
                        if (run.rng.Chance(0.3)) run.fx.Sound("throw", 0.25);
                        return;
                    }
                    for (int i = 0; i < n; i++)
                    {
                        int ii = i;
                        run.Later(ii * w.P("interval", 0.07), () =>
                        {
                            double off = (ii % 2 != 0 ? 1 : -1) * 0.25;
                            double a = bas + (run.rng.Next() - 0.5) * 0.12;
                            Shoot(w, run, pl.x - Math.Sin(bas) * off, pl.z + Math.Cos(bas) * off, a, sp, life, "dagger");
                            run.fx.Sound("throw", 0.35);
                        });
                    }
                },
            });

            // Arcane Staff / Archmage Scepter: homing bolts (evolution splits on hit).
            WeaponBehavior.Register("bolt", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    int n = w.Amount(run);
                    for (int i = 0; i < n; i++)
                    {
                        run.Later(i * w.P("interval", 0.12), () =>
                        {
                            var a0 = DoAim(w, run, 16);
                            double a = Math.Atan2(a0.z, a0.x) + (run.rng.Next() - 0.5) * 0.6;
                            var p = Shoot(w, run, pl.x, pl.z, a, w.Speed(run), w.Duration(run), "bolt");
                            p.homing = w.P("homing", 6);
                            p.target = a0.target;
                            p.targetUid = a0.target?.uid ?? 0;
                            p.glow = 1;
                            p.radius = 0.35;
                            run.fx.Sound("magic", 0.35);
                        });
                    }
                },
                projectileHit = (w, run, p, e) =>
                {
                    if (!w.evo || p.a == 1) return;
                    for (int k = 0; k < 3; k++)
                    {
                        double a = k / 3.0 * MathX.TAU + run.rng.Next();
                        var c = Shoot(w, run, e.x, e.z, a, w.Speed(run) * 0.9, 0.8, "bolt");
                        c.a = 1;
                        c.scale = 0.6;
                        c.pierce = 0;
                        c.homing = 4;
                        c.hitIds.Add(e.uid);
                        c.dmg.damage *= 0.4;
                    }
                },
            });

            // Ember Orb / Sunfire Core: explosive fireballs.
            WeaponBehavior.Register("fireball", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    int n = w.Amount(run);
                    for (int i = 0; i < n; i++)
                    {
                        run.Later(i * w.P("interval", 0.15), () =>
                        {
                            var a0 = DoAim(w, run, 14);
                            double a = Math.Atan2(a0.z, a0.x);
                            var p = Shoot(w, run, pl.x, pl.z, a, w.Speed(run), w.Duration(run), "fireball");
                            p.pierce = 0;
                            p.radius = 0.45;
                            p.scale = 0.9 + w.Area(run) * 0.2;
                            p.glow = 1.5;
                            p.spin = 6;
                        });
                    }
                },
                projectileHit = (w, run, p, e) => FireballBlast(w, run, p),
                projectileExpire = (w, run, p) => FireballBlast(w, run, p),
            });

            // Frost Shards / Absolute Zero: fan of slowing shards; evolution shatters frozen foes.
            WeaponBehavior.Register("frost", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    int n = w.Amount(run);
                    double spread = w.P("spread", 30) * Math.PI / 180;
                    var a0 = DoAim(w, run, 12);
                    double bas = Math.Atan2(a0.z, a0.x);
                    for (int i = 0; i < n; i++)
                    {
                        double a = n == 1 ? bas : bas - spread / 2 + (spread * i) / (n - 1);
                        var p = Shoot(w, run, pl.x, pl.z, a, w.Speed(run), w.Duration(run), "shard");
                        p.radius = 0.3;
                    }
                    run.fx.Sound("ice", 0.4);
                },
                onKill = (w, run, e) =>
                {
                    if (!w.evo || e.freezeT <= 0) return;
                    if (run.rng.Next() > 0.5) return;
                    for (int k = 0; k < 6; k++)
                    {
                        double a = k / 6.0 * MathX.TAU;
                        var c = Shoot(w, run, e.x, e.z, a, w.Speed(run) * 0.8, 0.5, "shard");
                        c.scale = 0.6;
                        c.dmg.damage *= 0.5;
                        c.pierce = 1;
                    }
                    run.fx.Burst(e.x, 0.6, e.z, 0xd0f8ff, 10, 4, 0.14, 0.4);
                },
            });

            // Longbow / Skypiercer: fast piercing arrows; evolution bursts into more arrows.
            WeaponBehavior.Register("arrow", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    int n = w.Amount(run);
                    for (int i = 0; i < n; i++)
                    {
                        run.Later(i * w.P("interval", 0.1), () =>
                        {
                            var a0 = DoAim(w, run, 18);
                            double a = Math.Atan2(a0.z, a0.x) + (run.rng.Next() - 0.5) * 0.08;
                            var p = Shoot(w, run, pl.x, pl.z, a, w.Speed(run), w.Duration(run), "arrow");
                            p.radius = 0.3;
                            run.fx.Sound("bow", 0.4);
                        });
                    }
                },
                projectileExpire = (w, run, p) =>
                {
                    if (!w.evo || p.a == 1) return;
                    double bas = Math.Atan2(p.vz, p.vx);
                    for (int k = -2; k <= 2; k++)
                    {
                        var c = Shoot(w, run, p.x, p.z, bas + k * 0.3, w.Speed(run) * 0.8, 0.45, "arrow");
                        c.a = 1;
                        c.scale = 0.8;
                        c.dmg.damage *= 0.5;
                    }
                },
            });

            // Bolt Thrower / Siege Engine: heavy bolts in all directions.
            WeaponBehavior.Register("radial", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    int n = w.Amount(run);
                    w.stRot = (w.stRot + Math.PI / n) % MathX.TAU;
                    for (int i = 0; i < n; i++)
                    {
                        double a = w.stRot + (double)i / n * MathX.TAU;
                        var p = Shoot(w, run, pl.x, pl.z, a, w.Speed(run), w.Duration(run), "heavybolt");
                        p.radius = 0.4;
                        p.scale = 1.1;
                    }
                    run.fx.Sound("bow", 0.6);
                },
                projectileHit = (w, run, p, e) =>
                {
                    if (!w.evo) return;
                    double r = w.P("radius", 1.8) * w.Area(run);
                    HitCircle(run, w, e.x, e.z, r, 0.5);
                    ExplosionFx(run, e.x, e.z, r, 0xffa04a, 0);
                },
            });

            // Moon Glaive / Eclipse Glaive: returning blades / spiralling glaives.
            WeaponBehavior.Register("boomerang", new WeaponBehavior
            {
                fire = (w, run) =>
                {
                    var pl = run.player;
                    int n = w.Amount(run);
                    for (int i = 0; i < n; i++)
                    {
                        int ii = i;
                        run.Later(w.evo ? 0 : ii * w.P("interval", 0.15), () =>
                        {
                            var a0 = DoAim(w, run, 12);
                            double a = w.evo ? (double)ii / n * MathX.TAU : Math.Atan2(a0.z, a0.x) + (ii - (n - 1) / 2.0) * 0.3;
                            var p = Shoot(w, run, pl.x, pl.z, a, w.Speed(run), w.evo ? w.Duration(run) : 6, "glaive");
                            p.custom = true;
                            p.pierce = -1;
                            p.radius = 0.55 * w.Area(run);
                            p.scale = w.Area(run);
                            p.spin = 14;
                            p.a = a; // angle
                            p.b = 0; // phase / distance
                            p.c = Math.Cos(a);
                            p.d = Math.Sin(a);
                            p.hitEvery = w.evo ? 0.3 : 0;
                            run.fx.Sound("whoosh", 0.4);
                        });
                    }
                },
                projectileUpdate = (w, run, p, dt) =>
                {
                    var pl = run.player;
                    if (w.evo)
                    {
                        // spiral out then in around the hero
                        double life = w.Duration(run);
                        double t = p.age / life;
                        double reach = w.P("reach", 8) * Math.Sqrt(w.Area(run));
                        double r = 1 + Math.Sin(t * Math.PI) * reach;
                        p.a += (w.Speed(run) / Math.Max(2, r)) * dt;
                        p.x = pl.x + Math.Cos(p.a) * r;
                        p.z = pl.z + Math.Sin(p.a) * r;
                        return p.life > 0;
                    }
                    double sp = w.Speed(run);
                    double rch = w.P("reach", 7);
                    if (p.e == 0)
                    {
                        p.x += p.c * sp * dt;
                        p.z += p.d * sp * dt;
                        p.b += sp * dt;
                        if (p.b >= rch)
                        {
                            p.e = 1;
                            p.hitIds.Clear();
                        }
                        return true;
                    }
                    double dx = pl.x - p.x, dz = pl.z - p.z;
                    double d = MathX.Hypot(dx, dz);
                    if (d < 0.6) return false;
                    double s = sp * 1.25 * dt;
                    p.x += (dx / d) * s;
                    p.z += (dz / d) * s;
                    p.vx = dx;
                    p.vz = dz;
                    return true;
                },
            });

            // Guardian Wisps / Spirit Choir: companions that shoot (evolution fires piercing rays).
            WeaponBehavior.Register("wisp", new WeaponBehavior
            {
                update = (w, run, dt) =>
                {
                    int want = w.Amount(run);
                    var list = w.stProjs ?? (w.stProjs = new List<Projectile>());
                    for (int i = list.Count - 1; i >= 0; i--) if (!list[i].active || list[i].owner != w) list.RemoveAt(i);
                    while (list.Count < want)
                    {
                        var pl = run.player;
                        var p = run.projectiles.Spawn(w, pl.x, pl.z, 0, 0, 1e9, "wisp", w.def.color);
                        p.custom = true;
                        p.collide = false;
                        p.glow = 0.8;
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
                    double range = w.P("range", 9);
                    if (w.stProjs != null)
                        foreach (var wp in w.stProjs)
                        {
                            var t = run.enemies.Nearest(wp.x, wp.z, range);
                            if (t == null) continue;
                            double dx = t.x - wp.x, dz = t.z - wp.z;
                            double d = MathX.Hypot(dx, dz);
                            if (d == 0) d = 1;
                            if (w.evo)
                            {
                                double ex = wp.x + (dx / d) * range, ez = wp.z + (dz / d) * range;
                                var ef = run.effects.Add(EffectKind.Beam, wp.x, wp.z, 0.2, w.def.color);
                                ef.x2 = ex;
                                ef.z2 = ez;
                                ef.w = 0.35;
                                ef.y = 1.2;
                                run.enemies.ForEachInRadius((wp.x + ex) / 2, (wp.z + ez) / 2, range / 2 + 0.5, e =>
                                {
                                    double t2 = ((e.x - wp.x) * dx + (e.z - wp.z) * dz) / d;
                                    if (t2 < 0 || t2 > range) return false;
                                    double px = wp.x + (dx / d) * t2 - e.x, pz = wp.z + (dz / d) * t2 - e.z;
                                    double rr = 0.4 + e.radius;
                                    if (px * px + pz * pz < rr * rr) run.combat.Hit(e, w.dmg, 1, dx, dz);
                                    return false;
                                });
                            }
                            else
                            {
                                double sp = w.Speed(run);
                                var p = run.projectiles.Spawn(w, wp.x, wp.z, (dx / d) * sp, (dz / d) * sp, w.Duration(run), "wispshot", w.def.color);
                                p.pierce = w.Pierce(run);
                                p.y = 1.2;
                                p.radius = 0.25;
                            }
                        }
                    run.fx.Sound("magic", 0.2);
                },
                projectileUpdate = (w, run, p, dt) =>
                {
                    if (p.vis != "wisp") return true;
                    var pl = run.player;
                    p.b += dt;
                    double ang = p.a + p.b * 1.4;
                    double tx = pl.x + Math.Cos(ang) * 1.4, tz = pl.z + Math.Sin(ang) * 1.4;
                    double k = 1 - Math.Exp(-8 * dt);
                    p.x += (tx - p.x) * k;
                    p.z += (tz - p.z) * k;
                    p.y = 1.3 + Math.Sin(p.b * 3 + p.a) * 0.15;
                    return true;
                },
                onRemove = (w, run) =>
                {
                    if (w.stProjs != null) foreach (var p in w.stProjs) p.active = false;
                },
            });
        }
    }
}
