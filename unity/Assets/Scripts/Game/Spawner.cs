using System;
using System.Collections.Generic;

namespace Cubeborn
{
    /// <summary>Time-based enemy waves, scripted map events, bosses and breakable props.</summary>
    public class Spawner
    {
        double acc;
        int eventIdx;
        readonly List<Params> events;
        bool midSpawned, bossSpawned;
        double propTimer;
        class Rain { public double t, radius, every, acc; public string style; }
        Rain rain;
        readonly Run run;
        static readonly List<string> ELITE_IDS = new List<string>();

        public Spawner(Run run)
        {
            this.run = run;
            events = new List<Params>(run.map.events);
            // stable sort by time (JS Array.prototype.sort is stable)
            var idx = new Dictionary<Params, int>();
            for (int i = 0; i < events.Count; i++) idx[events[i]] = i;
            events.Sort((a, b) =>
            {
                int c = a.Num("t").CompareTo(b.Num("t"));
                return c != 0 ? c : idx[a].CompareTo(idx[b]);
            });
            if (ELITE_IDS.Count == 0) foreach (var e in Content.Elites) ELITE_IDS.Add(e.id);
        }

        public SpawnSegment segment
        {
            get
            {
                var segs = run.map.segments;
                var s = segs[0];
                foreach (var g in segs) if (g.t <= run.time) s = g;
                return s;
            }
        }

        public bool bossSpawnedFlag => bossSpawned;

        /// <summary>Waves are reduced while a boss fight is underway.</summary>
        double BossDamp() => run.bosses.Count > 0 ? 0.45 : 1;

        public void Update(double dt)
        {
            var seg = segment;
            double curse = run.player.stats.curse;
            double ramp = Math.Min(1, run.time / Balance.runDuration);
            double rate = (seg.rate / 60) * (1 + (Balance.spawnRateMul - 1) * ramp) * run.diff.spawn * curse * BossDamp();
            double max = Math.Min(Balance.hardCap, seg.max * (1 + (Balance.spawnMaxMul - 1) * ramp) * run.diff.spawn * curse);
            acc += rate * dt;
            // catch up faster when the field is nearly empty
            if (run.enemies.aliveCount < max * 0.3) acc += rate * dt * 2;
            int guard = 0;
            while (acc >= 1 && guard++ < 40)
            {
                acc -= 1;
                if (run.enemies.aliveCount >= max)
                {
                    acc = Math.Min(acc, 1);
                    break;
                }
                var pick = WeightedPool(seg.pool);
                if (pick != null) SpawnOne(pick);
            }
            // scripted events
            while (eventIdx < events.Count && events[eventIdx].Num("t") <= run.time) RunEvent(events[eventIdx++]);
            if (!midSpawned && run.time >= run.map.bossTime / 2)
            {
                midSpawned = true;
                SpawnBoss(run.map.midBoss, false);
            }
            if (!bossSpawned && run.time >= run.map.bossTime)
            {
                bossSpawned = true;
                SpawnBoss(run.map.boss, true);
            }
            if (rain != null) UpdateRain(dt);
            propTimer -= dt;
            if (propTimer <= 0)
            {
                propTimer = 2.5;
                MaintainProps();
            }
        }

        string WeightedPool(List<KeyValuePair<string, double>> pool)
        {
            double total = 0;
            foreach (var it in pool) total += Math.Max(0, it.Value);
            if (total <= 0) return null;
            double r = run.rng.Next() * total;
            foreach (var it in pool)
            {
                r -= Math.Max(0, it.Value);
                if (r <= 0) return it.Key;
            }
            return pool[pool.Count - 1].Key;
        }

        double EliteChance()
        {
            if (run.time < Balance.eliteChanceStart) return 0;
            double min = (run.time - Balance.eliteChanceStart) / 60;
            return Math.Min(0.03, 0.002 + min * Balance.eliteChancePerMin) * run.diff.elite;
        }

        public string RandomElite() => run.rng.Pick(ELITE_IDS);

        /// <summary>Spawns one enemy on the ring. eliteMode: null = roll, "" = none, id = that elite.</summary>
        public Enemy SpawnOne(string id, string elite = null, bool rollElite = true)
        {
            if (!Content.EnemyById.TryGetValue(id, out var def)) return null;
            if (!FindSpawnPos(def.flying, out double px, out double pz)) return null;
            if (elite == null && rollElite) elite = run.rng.Chance(EliteChance()) ? RandomElite() : null;
            var e = run.enemies.Spawn(def, px, pz, elite);
            if (e != null && elite != null && run.diff.elite >= 2.4 && run.rng.Chance(0.5))
            {
                string second = RandomElite();
                if (second == elite) second = RandomElite();
                if (second != elite) run.enemies.MakeElite(e, second);
            }
            return e;
        }

        /// <summary>Random point on a ring around the player, biased toward the movement direction.</summary>
        public bool FindSpawnPos(bool flying, out double ox, out double oz, double rMin = Balance.spawnRadiusMin, double rMax = Balance.spawnRadiusMax)
        {
            var p = run.player;
            var t = run.terrain;
            double moveAng = Math.Atan2(p.vz, p.vx);
            bool moving = MathX.Hypot(p.vx, p.vz) > 0.5;
            for (int k = 0; k < 12; k++)
            {
                double a = moving && run.rng.Chance(0.5) ? moveAng + (run.rng.Next() - 0.5) * 2.2 : run.rng.Next() * MathX.TAU;
                double r = run.rng.Range(rMin, rMax);
                double x = p.x + Math.Cos(a) * r, z = p.z + Math.Sin(a) * r;
                int cx = (int)Math.Floor(x), cz = (int)Math.Floor(z);
                if (flying ? t.BlocksFlyer(cx, cz) : t.BlocksWalker(cx, cz)) continue;
                if (!flying && !run.nav.Has(cx, cz)) continue;
                ox = x;
                oz = z;
                return true;
            }
            ox = oz = 0;
            return false;
        }

        public void Relocate(Enemy e)
        {
            if (!FindSpawnPos(e.flying, out double x, out double z)) return;
            e.x = x;
            e.z = z;
            e.kx = e.kz = 0;
        }

        void SpawnBoss(string id, bool final)
        {
            if (!FindSpawnPos(true, out double x, out double z, 13, 15)) { x = run.player.x + 12; z = run.player.z; }
            var b = BossController.Spawn(run, id, x, z, final);
            if (b != null)
            {
                run.EmitBossSpawn(b);
                run.fx.Sound("bossRoar");
                run.fx.Shake(0.5);
            }
        }

        void RunEvent(Params ev)
        {
            var p = run.player;
            switch (ev.type)
            {
                case "swarm":
                    {
                        int n = MathX.RoundI(ev.Num("count", 30) * run.diff.spawn);
                        if (!Content.EnemyById.TryGetValue(ev.Str("enemy", ""), out var def)) break;
                        for (int i = 0; i < n; i++)
                        {
                            double a = (double)i / n * MathX.TAU;
                            double x = p.x + Math.Cos(a) * 17, z = p.z + Math.Sin(a) * 17;
                            int cx = (int)Math.Floor(x), cz = (int)Math.Floor(z);
                            if (def.flying ? run.terrain.BlocksFlyer(cx, cz) : run.terrain.BlocksWalker(cx, cz)) continue;
                            run.enemies.Spawn(def, x, z);
                        }
                        run.EmitBanner("ev_swarm");
                        break;
                    }
                case "stampede":
                    {
                        int n = MathX.RoundI(ev.Num("count", 20) * run.diff.spawn);
                        if (!Content.EnemyById.TryGetValue(ev.Str("enemy", ""), out var def)) break;
                        double a = run.rng.Next() * MathX.TAU;
                        double px = -Math.Sin(a), pz = Math.Cos(a);
                        for (int i = 0; i < n; i++)
                        {
                            double off = (i - n / 2.0) * 0.9;
                            double x = p.x + Math.Cos(a) * 18 + px * off, z = p.z + Math.Sin(a) * 18 + pz * off;
                            if (!run.terrain.WalkableAt(x, z)) continue;
                            var e = run.enemies.Spawn(def, x, z);
                            if (e != null) e.speed *= 1.3;
                        }
                        run.EmitBanner("ev_stampede");
                        break;
                    }
                case "elite":
                    {
                        int n = (int)ev.Num("count", 1);
                        for (int i = 0; i < n; i++) SpawnOne(ev.Str("enemy", ""), RandomElite());
                        run.EmitBanner("ev_elite");
                        break;
                    }
                case "chest":
                    {
                        if (FindSpawnPos(false, out double x, out double z, 6, 10)) run.pickups.SpawnChest(x, z);
                        break;
                    }
                case "treasure":
                    {
                        if (!FindSpawnPos(false, out double x, out double z, 8, 11)) break;
                        var e = run.enemies.SpawnById("treasure_sprite", x, z);
                        if (e != null) e.ttl = 22;
                        run.EmitBanner("ev_treasure");
                        break;
                    }
                case "hazard_rain":
                    rain = new Rain { t = ev.Num("duration", 20), style = ev.Str("style", "meteor"), radius = ev.Num("radius", 2), every = ev.Num("duration", 20) / ev.Num("count", 30), acc = 0 };
                    run.EmitBanner("ev_rain_" + rain.style);
                    break;
                case "darkness":
                    run.weather.darkness = ev.Num("duration", 30);
                    run.EmitBanner("ev_darkness");
                    break;
                case "blizzard":
                    run.weather.blizzard = ev.Num("duration", 40);
                    run.EmitBanner("ev_blizzard");
                    break;
                case "arcane_surge":
                    run.weather.surge = ev.Num("duration", 40);
                    run.EmitBanner("ev_surge");
                    break;
            }
        }

        void UpdateRain(double dt)
        {
            var r = rain;
            r.t -= dt;
            r.acc += dt;
            while (r.acc >= r.every)
            {
                r.acc -= r.every;
                var p = run.player;
                double a = run.rng.Next() * MathX.TAU;
                double d = run.rng.Range(0, 9);
                double x = p.x + Math.Cos(a) * d + p.vx * 0.6, z = p.z + Math.Sin(a) * d + p.vz * 0.6;
                double dmg = 12 * run.map.tier * run.diff.damage;
                if (r.style == "spore") run.hazards.Zone(x, z, r.radius, 1.3, dmg * 0.6, pool: 3, color: 0xa04aff);
                else if (r.style == "arcane") run.hazards.Zone(x, z, r.radius, 1.2, dmg, color: 0x9a6aff);
                else
                {
                    run.hazards.Zone(x, z, r.radius, 1.3, dmg, color: 0xff7a1a);
                    run.SpawnFallingRock(x, z, 1.3, 0xff7a1a);
                }
            }
            if (r.t <= 0) rain = null;
        }

        /// <summary>Keeps a handful of breakable crates around the player.</summary>
        void MaintainProps()
        {
            var p = run.player;
            int near = 0;
            run.enemies.ForEachInRadius(p.x, p.z, 30, e =>
            {
                if (e.def.id == "crate") near++;
                return false;
            });
            const int want = 8;
            for (int i = near; i < want; i++)
            {
                if (!FindSpawnPos(false, out double x, out double z, 14, 26)) continue;
                run.enemies.SpawnById("crate", Math.Floor(x) + 0.5, Math.Floor(z) + 0.5, noScale: true);
            }
        }
    }
}
