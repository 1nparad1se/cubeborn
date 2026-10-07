using System;
using System.Collections.Generic;

namespace Cubeborn
{
    public struct SpawnOpts
    {
        public string elite;
        public double hpMul;
        public bool noScale;
    }

    /// <summary>Owns all enemies: pooling, AI, movement, separation and spatial queries.</summary>
    public class EnemyManager
    {
        const double GRID_CELL = 2;
        public readonly List<Enemy> list = new List<Enemy>();
        readonly List<int> free = new List<int>();
        public readonly SpatialGrid grid;
        float[] xs, zs;
        public int aliveCount;
        /// <summary>Seconds of global freeze from the Chrono pickup.</summary>
        public double frozenAll;
        int uidCounter = 1;
        readonly Run run;
        readonly Func<int, bool> aliveFn;
        readonly Stack<List<int>> bufPool = new Stack<List<int>>();

        public EnemyManager(Run run, int capacity = 1600)
        {
            this.run = run;
            int size = run.terrain.size;
            grid = new SpatialGrid(size, size, GRID_CELL, capacity);
            xs = new float[capacity];
            zs = new float[capacity];
            for (int i = 0; i < capacity; i++)
            {
                list.Add(new Enemy(i));
                free.Add(capacity - 1 - i);
            }
            aliveFn = i => list[i].alive;
        }

        List<int> RentBuf() => bufPool.Count > 0 ? bufPool.Pop() : new List<int>(64);
        void ReturnBuf(List<int> b) => bufPool.Push(b);

        void Grow()
        {
            int old = list.Count, n = old * 2;
            for (int i = old; i < n; i++)
            {
                list.Add(new Enemy(i));
                free.Add(i);
            }
            Array.Resize(ref xs, n);
            Array.Resize(ref zs, n);
        }

        int PopFree()
        {
            int i = free[free.Count - 1];
            free.RemoveAt(free.Count - 1);
            return i;
        }

        /// <summary>Spawns an enemy with time/difficulty scaling applied.</summary>
        public Enemy Spawn(EnemyDef def, double x, double z, string elite = null, double hpMul = 1, bool noScale = false)
        {
            if (free.Count == 0)
            {
                if (list.Count >= 4096) return null;
                Grow();
            }
            var e = list[PopFree()];
            e.Reset(def);
            e.uid = uidCounter++;
            e.x = x;
            e.z = z;
            var r = run;
            double minute = r.time / 60;
            double tier = r.map.tier;
            double timeHp = 1 + Math.Min(minute, 10) * Balance.enemyHpPerMinute + Math.Max(0, minute - 10) * Balance.enemyHpPerMinuteLate;
            double hm = noScale ? 1 : tier * r.diff.hp * timeHp * (1 + (r.player.stats.curse - 1) * 0.5);
            double dmgMul = noScale ? 1 : (0.85 + tier * 0.15) * r.diff.damage * (1 + minute * Balance.enemyDamagePerMinute);
            e.maxHp = e.hp = Math.Max(1, def.hp * hm * hpMul);
            e.damage = def.damage * dmgMul;
            e.speed = def.speed * r.diff.speed * (1 + (r.player.stats.curse - 1) * 0.25) * (0.92 + Rand.Value * 0.16);
            e.xp = def.xp;
            if (def.behavior == "prop") e.speed = 0;
            if (elite != null) MakeElite(e, elite);
            e.yaw = Math.Atan2(r.player.x - x, r.player.z - z);
            aliveCount++;
            r.stats.seen.Add(def.id);
            return e;
        }

        public Enemy SpawnById(string id, double x, double z, string elite = null, double hpMul = 1, bool noScale = false)
        {
            return id != null && Content.EnemyById.TryGetValue(id, out var def) ? Spawn(def, x, z, elite, hpMul, noScale) : null;
        }

        public void MakeElite(Enemy e, string id)
        {
            var m = Content.EliteById[id];
            if (e.elite == null)
            {
                e.elite = id;
                e.scale *= 1.45;
                e.radius *= 1.35;
                e.kbResist = Math.Min(1, e.kbResist + 0.5);
                e.xp *= 8;
            }
            else e.elite2 = id;
            e.maxHp *= m.hp * 4;
            e.hp = e.maxHp;
            e.speed *= m.speed;
            e.damage *= m.damage;
            if (id == "armored") e.kbResist = 1;
        }

        public void Release(Enemy e)
        {
            if (!e.active) return;
            e.active = false;
            e.boss = null;
            free.Add(e.index);
            if (e.dying == 0) aliveCount--;
        }

        /// <summary>Marks as dying (plays death anim), removing it from gameplay immediately.</summary>
        public void StartDying(Enemy e)
        {
            if (e.dying > 0) return;
            e.dying = 0.28;
            aliveCount--;
        }

        // ------------------------------------------------------------------ queries

        /// <summary>Calls fn for each living enemy whose body overlaps the circle. Return true to stop.</summary>
        public void ForEachInRadius(double x, double z, double r, Func<Enemy, bool> fn, bool includeProps = true)
        {
            var buf = RentBuf();
            grid.Collect(x, z, r + 1.5, buf);
            for (int k = 0; k < buf.Count; k++)
            {
                var e = list[buf[k]];
                if (!e.alive || (!includeProps && e.def.behavior == "prop" && e.boss == null)) continue;
                double dx = e.x - x, dz = e.z - z, rr = r + e.radius;
                if (dx * dx + dz * dz <= rr * rr && fn(e)) break;
            }
            ReturnBuf(buf);
        }

        public Enemy Nearest(double x, double z, double maxR = 30, HashSet<int> exclude = null)
        {
            Enemy best = null;
            double bd = maxR * maxR;
            var buf = RentBuf();
            // expanding search keeps it cheap in dense crowds
            for (double r = 4; r <= maxR + 4; r *= 2)
            {
                grid.Collect(x, z, Math.Min(r, maxR), buf);
                for (int k = 0; k < buf.Count; k++)
                {
                    var e = list[buf[k]];
                    if (!e.alive || IsProp(e)) continue;
                    if (exclude != null && exclude.Contains(e.uid)) continue;
                    double d = (e.x - x) * (e.x - x) + (e.z - z) * (e.z - z);
                    if (d < bd) { bd = d; best = e; }
                }
                if (best != null || r >= maxR) break;
            }
            ReturnBuf(buf);
            return best;
        }

        public bool IsProp(Enemy e) => e.def.behavior == "prop" && e.boss == null && e.def.id != "shield_crystal";

        /// <summary>Random targetable enemy within radius of point (used for strikes/random targeting).</summary>
        public Enemy RandomInRadius(double x, double z, double r)
        {
            int count = 0;
            Enemy pick = null;
            var rng = run.rng;
            ForEachInRadius(x, z, r, e =>
            {
                if (IsProp(e)) return false;
                count++;
                if (rng.Next() * count < 1) pick = e;
                return false;
            });
            return pick;
        }

        /// <summary>Approximate densest spot among a few samples near the player.</summary>
        public bool Cluster(double x, double z, double r, out double cx, out double cz)
        {
            Enemy best = null;
            int bestN = 0;
            for (int k = 0; k < 6; k++)
            {
                var e = RandomInRadius(x, z, r);
                if (e == null) break;
                int n = 0;
                ForEachInRadius(e.x, e.z, 2.5, _ => { n++; return false; });
                if (n > bestN) { bestN = n; best = e; }
            }
            cx = best?.x ?? 0;
            cz = best?.z ?? 0;
            return best != null;
        }

        public Enemy Strongest(double x, double z, double r)
        {
            Enemy best = null;
            ForEachInRadius(x, z, r, e =>
            {
                if (IsProp(e)) return false;
                if (best == null || e.hp > best.hp) best = e;
                return false;
            });
            return best;
        }

        // ------------------------------------------------------------------ update
        public void Update(double dt)
        {
            int n = list.Count;
            for (int i = 0; i < n; i++)
            {
                var e = list[i];
                if (e.active) { xs[i] = (float)e.x; zs[i] = (float)e.z; }
            }
            grid.Rebuild(n, xs, zs, aliveFn);
            if (frozenAll > 0) frozenAll -= dt;

            var p = run.player;
            var sepBuf = RentBuf();
            for (int i = 0; i < n; i++)
            {
                var e = list[i];
                if (!e.active) continue;
                if (e.dying > 0)
                {
                    e.dying -= dt;
                    if (e.dying <= 0)
                    {
                        e.dying = 0.0001; // keep counted as dying until released
                        ReleaseDead(e);
                    }
                    continue;
                }
                UpdateStatus(e, dt);
                if (!e.active || e.dying > 0) continue;
                if (e.flash > 0) e.flash -= dt;
                if (e.touchCd > 0) e.touchCd -= dt;

                bool frozen = e.freezeT > 0 || frozenAll > 0;
                if (e.boss != null)
                {
                    if (!frozen) e.boss.Update(dt);
                }
                else if (!frozen) Think(e, dt);
                else { e.vx = 0; e.vz = 0; }

                // integrate with knockback
                double mx = (e.vx + e.kx) * dt;
                double mz = (e.vz + e.kz) * dt;
                double kd = Math.Exp(-8 * dt);
                e.kx *= kd;
                e.kz *= kd;

                // separation from neighbours
                if (e.boss == null && e.def.behavior != "prop")
                {
                    int checks = 0;
                    double sep = Balance.separationStrength * dt;
                    grid.Collect(e.x, e.z, e.radius * 2, sepBuf);
                    for (int k = 0; k < sepBuf.Count; k++)
                    {
                        int j = sepBuf[k];
                        if (j == i) continue;
                        var o = list[j];
                        double dx = e.x - o.x, dz = e.z - o.z, rr = e.radius + o.radius, dd = dx * dx + dz * dz;
                        if (dd < rr * rr && dd > 1e-6)
                        {
                            double d = Math.Sqrt(dd);
                            double push = ((rr - d) / rr) * sep * (o.boss != null ? 2 : 1);
                            mx += (dx / d) * push;
                            mz += (dz / d) * push;
                        }
                        if (++checks > 8) break;
                    }
                }
                MoveWithTerrain(e, mx, mz);

                double dxp = p.x - e.x, dzp = p.z - e.z, d2 = dxp * dxp + dzp * dzp;
                // contact damage
                if (e.damage > 0 && !frozen && e.touchCd <= 0)
                {
                    double rr = e.radius + p.radius;
                    if (d2 < rr * rr)
                    {
                        e.touchCd = Balance.contactInterval;
                        double dealt = p.Hurt(e.damage, e);
                        if (dealt > 0 && e.HasElite("vampiric")) e.hp = Math.Min(e.maxHp, e.hp + e.maxHp * 0.05);
                    }
                }
                // keep far enemies near the action instead of leaving them behind
                if (e.boss == null && e.elite == null && e.def.behavior != "prop" && d2 > Balance.despawnRadius * Balance.despawnRadius)
                {
                    if (e.def.id == "treasure_sprite") { Release(e); continue; }
                    run.spawner.Relocate(e);
                }
                else if (e.def.category == "prop" && d2 > 2500) { Release(e); continue; }
                if (e.ttl > 0)
                {
                    e.ttl -= dt;
                    if (e.ttl <= 0)
                    {
                        run.fx.Burst(e.x, 0.8, e.z, 0xfff0a0, 20, 4, 0.18, 0.6);
                        Release(e);
                        continue;
                    }
                }
                double sp = MathX.Hypot(e.vx, e.vz);
                if (sp > 0.05)
                {
                    e.anim += dt * (2 + sp * 1.6);
                    e.yaw = Math.Atan2(e.vx, e.vz);
                }
                else e.anim += dt;
            }
            ReturnBuf(sepBuf);
        }

        void ReleaseDead(Enemy e)
        {
            e.active = false;
            e.boss = null;
            free.Add(e.index);
        }

        void UpdateStatus(Enemy e, double dt)
        {
            if (e.slowT > 0)
            {
                e.slowT -= dt;
                if (e.slowT <= 0) e.slowMul = 1;
            }
            if (e.freezeT > 0) e.freezeT -= dt;
            if (e.shieldT > 0) e.shieldT -= dt;
            if (e.poisonT > 0 || e.burnT > 0)
            {
                e.dotTick -= dt;
                if (e.dotTick <= 0)
                {
                    e.dotTick = 0.5;
                    double dmg = 0;
                    if (e.poisonT > 0) { dmg += e.poisonDps * 0.5; e.poisonT -= 0.5; }
                    if (e.burnT > 0) { dmg += e.burnDps * 0.5; e.burnT -= 0.5; }
                    if (dmg > 0) run.combat.ApplyRaw(e, dmg, e.poisonT > 0 ? 0x9cff4f : 0xff8a3a, "dot");
                }
            }
            // warded elites pulse a protective shield
            if (e.HasElite("warded"))
            {
                e.aux += dt;
                if (e.aux > 6) { e.aux = 0; e.shieldT = 2; }
            }
        }

        /// <summary>Per-behaviour AI producing desired velocity e.vx/e.vz.</summary>
        void Think(Enemy e, double dt)
        {
            var p = run.player;
            double dx = p.x - e.x, dz = p.z - e.z;
            double dist = MathX.Hypot(dx, dz);
            if (dist == 0) dist = 0.001;
            double ux = dx / dist, uz = dz / dist;
            // walkers follow the flow field when not close
            if (!e.flying && dist > 2.5)
            {
                int cx = (int)Math.Floor(e.x), cz = (int)Math.Floor(e.z);
                if (run.nav.Has(cx, cz))
                {
                    int i = cz * run.terrain.size + cx;
                    double fx = run.nav.dirX[i], fz = run.nav.dirZ[i];
                    if (fx != 0 || fz != 0) { ux = fx; uz = fz; }
                }
            }
            double speed = e.speed * e.slowMul;
            if (e.HasElite("frenzied") && e.hp < e.maxHp * 0.5) speed *= 1.5;
            var pp = e.def.p;
            switch (e.def.behavior)
            {
                case "prop":
                    e.vx = e.vz = 0;
                    return;
                case "flyer":
                    {
                        e.aux += dt;
                        double w = Math.Sin(e.aux * 3 + e.index) * 0.6;
                        e.vx = (ux - uz * w) * speed;
                        e.vz = (uz + ux * w) * speed;
                        e.y = 0.6 + Math.Sin(e.aux * 5) * 0.15;
                        return;
                    }
                case "ranged":
                    {
                        double range = pp.Num("range", 7);
                        double m = 1;
                        if (dist < range * 0.6) m = -0.7;
                        else if (dist < range) m = 0.15;
                        e.vx = ux * speed * m;
                        e.vz = uz * speed * m;
                        if (m != 1)
                        {
                            // strafe
                            double s = e.index % 2 != 0 ? 1 : -1;
                            e.vx += -uz * speed * 0.4 * s;
                            e.vz += ux * speed * 0.4 * s;
                        }
                        e.cd -= dt;
                        if (e.cd <= 0 && dist < range + 3)
                        {
                            e.cd = pp.Num("fireCd", 2.5) * (0.85 + Rand.Value * 0.3);
                            int count = (int)pp.Num("bullets", 1);
                            double spread = pp.Num("spread", 20) * Math.PI / 180;
                            double bas = Math.Atan2(dz, dx);
                            double bs = pp.Num("bulletSpeed", 7);
                            bool slow = pp.Num("slow") != 0;
                            for (int k = 0; k < count; k++)
                            {
                                double a = count == 1 ? bas : bas - spread / 2 + (spread * k) / (count - 1);
                                run.hazards.Bullet(e.x, e.z, Math.Cos(a) * bs, Math.Sin(a) * bs, e.damage * 0.65, 0.28, 4, slow ? 0x8ae8ff : 0xff3a6a, slow);
                            }
                            e.flash = 0.05;
                        }
                        return;
                    }
                case "summoner":
                    {
                        double range = pp.Num("range", 8);
                        double m = dist < range * 0.7 ? -0.5 : dist < range ? 0 : 1;
                        e.vx = ux * speed * m;
                        e.vz = uz * speed * m;
                        e.cd -= dt;
                        if (e.cd <= 0 && dist < range + 6)
                        {
                            e.cd = pp.Num("cd", 6);
                            int count = (int)pp.Num("count", 3);
                            for (int k = 0; k < count; k++)
                            {
                                double a = (double)k / count * MathX.TAU;
                                double sx = e.x + Math.Cos(a) * 1.2, sz = e.z + Math.Sin(a) * 1.2;
                                if (run.terrain.WalkableAt(sx, sz) && aliveCount < Balance.hardCap)
                                {
                                    var m2 = SpawnById(pp.Str("summon"), sx, sz);
                                    if (m2 != null) m2.xp = 0;
                                }
                            }
                            run.fx.Burst(e.x, 1, e.z, 0xb070ff, 14, 3, 0.16, 0.6);
                        }
                        return;
                    }
                case "exploder":
                    {
                        if (e.state == 0)
                        {
                            e.vx = ux * speed;
                            e.vz = uz * speed;
                            if (dist < pp.Num("trigger", 1.6))
                            {
                                e.state = 1;
                                e.stateT = pp.Num("fuse", 0.8);
                                run.hazards.Telegraph(e.x, e.z, pp.Num("blast", 2), e.stateT);
                            }
                        }
                        else
                        {
                            e.vx = e.vz = 0;
                            e.stateT -= dt;
                            e.flash = Math.Sin(e.stateT * 40) > 0 ? 0.1 : 0;
                            if (e.stateT <= 0)
                            {
                                run.hazards.Explode(e.x, e.z, pp.Num("blast", 2), e.damage, 0xff7a2a);
                                run.combat.KillEnemy(e, true);
                            }
                        }
                        return;
                    }
                case "charger":
                    {
                        if (e.state == 0)
                        {
                            e.vx = ux * speed;
                            e.vz = uz * speed;
                            e.cd -= dt;
                            if (e.cd <= 0 && dist < pp.Num("trigger", 8))
                            {
                                e.state = 1;
                                e.stateT = pp.Num("windup", 0.6);
                                e.dirX = dx / dist;
                                e.dirZ = dz / dist;
                                run.hazards.LineTelegraph(e.x, e.z, e.dirX, e.dirZ, 9, e.radius * 2, e.stateT);
                            }
                        }
                        else if (e.state == 1)
                        {
                            e.vx = e.vz = 0;
                            e.stateT -= dt;
                            e.flash = 0.03;
                            if (e.stateT <= 0) { e.state = 2; e.stateT = 0.75; }
                        }
                        else
                        {
                            double cs = pp.Num("chargeSpeed", 12);
                            e.vx = e.dirX * cs;
                            e.vz = e.dirZ * cs;
                            e.stateT -= dt;
                            if (e.stateT <= 0) { e.state = 0; e.cd = pp.Num("chargeCd", 4); }
                        }
                        return;
                    }
                case "teleporter":
                    {
                        e.vx = ux * speed;
                        e.vz = uz * speed;
                        e.cd -= dt;
                        e.y = 0.3 + Math.Sin(e.anim * 2) * 0.15;
                        if (e.cd <= 0 && dist > 5)
                        {
                            e.cd = pp.Num("tpCd", 4);
                            double a = Rand.Value * MathX.TAU;
                            double r = pp.Num("tpDist", 3.5);
                            double tx = p.x + Math.Cos(a) * r, tz = p.z + Math.Sin(a) * r;
                            if (!run.terrain.BlocksFlyer((int)Math.Floor(tx), (int)Math.Floor(tz)))
                            {
                                run.fx.Burst(e.x, 0.8, e.z, 0x9a7aff, 12, 3, 0.15, 0.5);
                                e.x = tx;
                                e.z = tz;
                                run.fx.Burst(e.x, 0.8, e.z, 0x9a7aff, 12, 3, 0.15, 0.5);
                            }
                        }
                        return;
                    }
                case "orbiter":
                    {
                        double orbit = pp.Num("orbit", 6);
                        e.cd -= dt;
                        if (e.state == 0)
                        {
                            double tang = e.index % 2 != 0 ? 1 : -1;
                            double radial = (dist - orbit) * 0.8;
                            e.vx = (ux * radial - uz * tang * 1.2) * speed * 0.6;
                            e.vz = (uz * radial + ux * tang * 1.2) * speed * 0.6;
                            if (e.cd <= 0) { e.state = 1; e.stateT = 0.9; e.dirX = ux; e.dirZ = uz; }
                        }
                        else
                        {
                            e.vx = e.dirX * speed * 3;
                            e.vz = e.dirZ * speed * 3;
                            e.stateT -= dt;
                            if (e.stateT <= 0) { e.state = 0; e.cd = pp.Num("diveCd", 4); }
                        }
                        e.y = 0.7;
                        return;
                    }
                default:
                    {
                        // chase / splitter / treasure sprite
                        if (pp.Num("flee") != 0)
                        {
                            e.vx = -ux * speed;
                            e.vz = -uz * speed;
                            return;
                        }
                        e.vx = ux * speed;
                        e.vz = uz * speed;
                        return;
                    }
            }
        }

        void MoveWithTerrain(Enemy e, double mx, double mz)
        {
            var t = run.terrain;
            bool fly = e.flying || (e.boss != null && e.boss.def.flying);
            double nx = e.x + mx, nz = e.z + mz;
            double r = Math.Min(e.radius, 0.45);
            // axis-separated resolution against blocked cells
            double sx = mx > 0 ? r : -r;
            if (!Blocked(t, fly, Math.Floor(nx + sx), Math.Floor(e.z))) e.x = nx;
            else e.kx = 0;
            double sz = mz > 0 ? r : -r;
            if (!Blocked(t, fly, Math.Floor(e.x), Math.Floor(nz + sz))) e.z = nz;
            else e.kz = 0;
            // unstick if inside geometry (spawned or pushed in)
            if (!fly && Blocked(t, fly, Math.Floor(e.x), Math.Floor(e.z)))
            {
                var p = run.player;
                double d = MathX.Hypot(p.x - e.x, p.z - e.z);
                if (d == 0) d = 1;
                e.x += ((p.x - e.x) / d) * 0.1;
                e.z += ((p.z - e.z) / d) * 0.1;
            }
        }

        static bool Blocked(Terrain t, bool fly, double cx, double cz) => fly ? t.BlocksFlyer((int)cx, (int)cz) : t.BlocksWalker((int)cx, (int)cz);

        public void Clear()
        {
            foreach (var e in list) if (e.active) Release(e);
            aliveCount = 0;
        }
    }
}
