using System;

namespace Cubeborn
{
    public partial class BossController
    {
        /// <summary>Executes one boss attack pattern. Patterns are generic and parameterised by data.</summary>
        public void RunAttack(Params a)
        {
            var b = this;
            var p = run.player;
            double dmg = e.damage;
            bool slow = a.Num("slow") != 0;
            switch (a.type)
            {
                case "ring":
                    {
                        int waves = (int)a.Num("waves", 1);
                        for (int w = 0; w < waves; w++)
                        {
                            int ww = w;
                            run.Later(ww * a.Num("waveDelay", 0.4), () =>
                            {
                                if (!e.alive) return;
                                int count = (int)a.Num("count", 12);
                                double rot = ww * a.Num("rotate", 0) * Math.PI / 180;
                                for (int i = 0; i < count; i++)
                                {
                                    double ang = rot + (double)i / count * MathX.TAU;
                                    run.hazards.Bullet(e.x, e.z, Math.Cos(ang) * a.Num("speed", 5), Math.Sin(ang) * a.Num("speed", 5), dmg * 0.6, 0.34, 5, slow ? 0x8ae8ff : 0xff3a6a, slow);
                                }
                                run.fx.Sound("bossShoot", 0.5);
                            });
                        }
                        break;
                    }
                case "spiral":
                    b.spiralAttack = a;
                    b.spiralT = a.Num("duration", 3);
                    b.spiralAcc = 0;
                    b.busy = b.spiralT;
                    run.fx.Sound("bossCharge", 0.6);
                    break;
                case "aimed":
                    {
                        int bursts = (int)a.Num("bursts", 1);
                        for (int k = 0; k < bursts; k++)
                        {
                            run.Later(k * a.Num("burstDelay", 0.3), () =>
                            {
                                if (!e.alive) return;
                                double bas = Math.Atan2(p.z - e.z, p.x - e.x);
                                int count = (int)a.Num("count", 3);
                                double spread = a.Num("spread", 30) * Math.PI / 180;
                                for (int i = 0; i < count; i++)
                                {
                                    double ang = count == 1 ? bas : bas - spread / 2 + (spread * i) / (count - 1);
                                    run.hazards.Bullet(e.x, e.z, Math.Cos(ang) * a.Num("speed", 8), Math.Sin(ang) * a.Num("speed", 8), dmg * 0.6, 0.32, 4, slow ? 0x8ae8ff : 0xff3a6a, slow);
                                }
                                run.fx.Sound("bossShoot", 0.5);
                            });
                        }
                        break;
                    }
                case "laser":
                    {
                        int count = (int)a.Num("count", 1);
                        bool aim = a.Num("aim") != 0;
                        double bas = aim ? Math.Atan2(p.z - e.z, p.x - e.x) - a.Num("sweep", 40) * Math.PI / 180 * 0.5 : Rand.Value * MathX.TAU;
                        for (int i = 0; i < count; i++)
                        {
                            run.hazards.Laser(e, e.x, e.z, bas + (double)i / count * MathX.TAU * (aim ? 0.15 : 1),
                                a.Num("sweep", 40) * Math.PI / 180, a.Num("length", 14), a.Num("width", 0.8), a.Num("telegraph", 1), a.Num("duration", 2.5), dmg * 0.5, def.color);
                        }
                        b.busy = a.Num("telegraph", 1) + 0.5;
                        run.fx.Sound("bossCharge", 0.7);
                        break;
                    }
                case "summon":
                    {
                        int count = (int)a.Num("count", 6);
                        for (int i = 0; i < count; i++)
                        {
                            double ang = (double)i / count * MathX.TAU;
                            double x = e.x + Math.Cos(ang) * 2.5, z = e.z + Math.Sin(ang) * 2.5;
                            if (!run.terrain.WalkableAt(x, z)) continue;
                            var m = run.enemies.SpawnById(a.Str("enemy"), x, z);
                            if (m != null) m.xp = Math.Ceiling(m.xp * 0.5);
                        }
                        run.fx.Burst(e.x, 1, e.z, 0xb070ff, 30, 5, 0.2, 0.8);
                        run.fx.Sound("summon");
                        break;
                    }
                case "teleport":
                    {
                        double ang = Rand.Value * MathX.TAU;
                        double r = 6 + Rand.Value * 2;
                        double tx = p.x + Math.Cos(ang) * r, tz = p.z + Math.Sin(ang) * r;
                        if (!def.flying && !run.terrain.WalkableAt(tx, tz)) { tx = p.x; tz = p.z; }
                        run.fx.Burst(e.x, 1.2, e.z, def.color, 30, 5, 0.2, 0.6);
                        e.x = tx;
                        e.z = tz;
                        if (a.Num("burrow") != 0)
                        {
                            b.hidden = 1;
                            e.invuln = true;
                            run.hazards.Telegraph(tx, tz, 2.6, 1);
                        }
                        else run.fx.Burst(e.x, 1.2, e.z, def.color, 30, 5, 0.2, 0.6);
                        run.fx.Sound("teleport");
                        break;
                    }
                case "dash":
                    b.dashLeft = (int)a.Num("count", 1);
                    b.dashSpeed = a.Num("speed", 14);
                    b.dashTele = a.Num("telegraph", 0.7);
                    b.StartDash();
                    break;
                case "zones":
                    {
                        int count = (int)a.Num("count", 5);
                        double r = a.Num("radius", 1.8);
                        double spread = a.Num("spread", 5);
                        double pool = a.Num("pool", 0);
                        bool freeze = a.Num("freeze") != 0;
                        int color = freeze ? 0x6ad8ff : -1;
                        bool line = a.Num("line") != 0;
                        for (int i = 0; i < count; i++)
                        {
                            double x, z;
                            if (line)
                            {
                                double dx = p.x - e.x, dz = p.z - e.z;
                                double d = MathX.Hypot(dx, dz);
                                if (d == 0) d = 1;
                                x = e.x + (dx / d) * (i + 1) * r * 1.6;
                                z = e.z + (dz / d) * (i + 1) * r * 1.6;
                                double lx = x, lz = z;
                                run.Later(i * 0.08, () => run.hazards.Zone(lx, lz, r, a.Num("telegraph", 1), dmg * 0.8, pool, color, freeze));
                                continue;
                            }
                            if (i == 0 || spread == 0)
                            {
                                x = p.x + p.vx * 0.5;
                                z = p.z + p.vz * 0.5;
                            }
                            else
                            {
                                double ang = Rand.Value * MathX.TAU;
                                double rr = Rand.Value * spread;
                                x = p.x + Math.Cos(ang) * rr;
                                z = p.z + Math.Sin(ang) * rr;
                            }
                            run.hazards.Zone(x, z, r, a.Num("telegraph", 1) + i * 0.05, dmg * 0.8, pool, color, freeze);
                        }
                        run.fx.Sound("bossCharge", 0.4);
                        break;
                    }
                case "meteor":
                    {
                        int count = (int)a.Num("count", 8);
                        for (int i = 0; i < count; i++)
                        {
                            run.Later(i * 0.12, () =>
                            {
                                double ang = Rand.Value * MathX.TAU;
                                double rr = Rand.Value * a.Num("spread", 9);
                                double x = p.x + Math.Cos(ang) * rr, z = p.z + Math.Sin(ang) * rr;
                                run.hazards.Zone(x, z, a.Num("radius", 2), a.Num("telegraph", 1.2), dmg * 0.9, color: 0xff7a1a);
                                run.SpawnFallingRock(x, z, a.Num("telegraph", 1.2), 0xff7a1a);
                            });
                        }
                        break;
                    }
                case "slam":
                    {
                        int waves = (int)a.Num("waves", 1);
                        for (int w = 0; w < waves; w++)
                        {
                            run.Later(0.5 + w * 0.55, () =>
                            {
                                if (!e.alive) return;
                                run.hazards.Shock(e.x, e.z, a.Num("radius", 10), a.Num("speed", 7), a.Num("width", 1.2), dmg * 0.8, def.color);
                                run.fx.Shake(0.35);
                                run.fx.Burst(e.x, 0.3, e.z, 0x8a7a6a, 24, 6, 0.25, 0.6, ParticleKind.Debris);
                                run.fx.Sound("slam");
                            });
                        }
                        run.hazards.Telegraph(e.x, e.z, 2.5, 0.5);
                        b.busy = 0.6 + waves * 0.55;
                        break;
                    }
                case "shield":
                    {
                        int count = (int)a.Num("count", 4);
                        for (int i = 0; i < count; i++)
                        {
                            double ang = (double)i / count * MathX.TAU;
                            double x = e.x + Math.Cos(ang) * 5, z = e.z + Math.Sin(ang) * 5;
                            var c = run.enemies.SpawnById(a.Str("enemy", "shield_crystal"), x, z, hpMul: 1 + run.time / 300);
                            if (c != null) b.crystals.Add(c);
                        }
                        e.invuln = true;
                        run.fx.Text(e.x, e.z, run.Tr("shielded"), 0x9a7aff);
                        run.fx.Sound("shield");
                        break;
                    }
                case "split":
                    {
                        int count = (int)a.Num("count", 2);
                        for (int i = 0; i < count; i++)
                        {
                            double ang = (double)i / count * MathX.TAU + Rand.Value;
                            var c = Spawn(run, def.id, e.x + Math.Cos(ang) * 3, e.z + Math.Sin(ang) * 3, isFinal, a.Num("hpFrac", 0.15), true);
                            if (c != null)
                            {
                                c.e.scale = 0.65;
                                c.e.radius = def.radius * 0.7;
                                c.ForcePhase(phase);
                            }
                        }
                        run.fx.Burst(e.x, 1.2, e.z, def.color, 40, 6, 0.25, 0.8);
                        run.fx.Sound("summon");
                        break;
                    }
                case "pull":
                    b.pullT = a.Num("duration", 2);
                    b.pullStrength = a.Num("strength", 3);
                    run.fx.Sound("bossCharge", 0.8);
                    break;
                case "darkness":
                    run.weather.darkness = Math.Max(run.weather.darkness, a.Num("duration", 30));
                    break;
            }
        }
    }
}
