// Headless balance simulator: plays runs with a simple kiting bot and prints outcomes.
// Usage: dotnet run -c Release -- [mapId] [heroId] [diffId] [runs] [perm 0|1]
// Also: dotnet run -c Release -- terrain <mapId> <seed>  (prints a terrain checksum for parity tests)
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Cubeborn;

static class Program
{
    static string dataDir = Path.Combine(AppContext.BaseDirectory, "../../../../Assets/Resources/Data");

    static int Main(string[] args)
    {
        if (!Directory.Exists(dataDir)) dataDir = Path.GetFullPath("../Assets/Resources/Data");
        Content.Loader = name => File.ReadAllText(Path.Combine(dataDir, name + ".json"));
        Content.Load();
        if (args.Length > 0 && args[0] == "terrain") return TerrainSum(args[1], long.Parse(args[2]));
        string mapId = args.Length > 0 ? args[0] : "blightwood";
        string heroId = args.Length > 1 ? args[1] : "bram";
        string diffId = args.Length > 2 ? args[2] : "normal";
        int runs = args.Length > 3 ? int.Parse(args[3]) : 3;
        bool perm1 = args.Length > 4 && args[4] == "1";
        var perm = new StatMods();
        if (perm1)
        {
            perm["might"] = 0.25; perm["maxHp"] = 50; perm["armor"] = 3; perm["regen"] = 0.75; perm["growth"] = 0.25;
            perm["cooldown"] = 0.09; perm["area"] = 0.16; perm["duration"] = 0.16; perm["luck"] = 0.24; perm["magnet"] = 0.6;
        }
        var map = Content.MapById[mapId];
        var hero = Content.HeroById[heroId];
        var diff = Content.DifficultyById[diffId];
        int wins = 0;
        for (int r = 0; r < runs; r++)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var run = new Run(new RunOptions
            {
                map = map, diff = diff, hero = hero, permanent = perm,
                unlockedWeapons = new HashSet<string>(Content.Weapons.Select(w => w.id)),
                unlockedPassives = new HashSet<string>(Content.Passives.Select(p => p.id)),
                fx = NullFx.I, settings = new RunSettings { damageNumbers = false }, tr = k => k, seed = 1000 + r,
            });
            const double dt = 1.0 / 30;
            int maxEnemies = 0, steps = 0;
            double lastLog = 0;
            while (run.state != RunState.Dead && run.state != RunState.Victory && run.time < 1100 && steps < 40000)
            {
                steps++;
                if (run.state == RunState.Levelup)
                {
                    var ch = run.pendingChoices;
                    var pick = ch.FirstOrDefault(c => c.kind == ChoiceKind.WeaponUp) ?? ch.FirstOrDefault(c => c.kind == ChoiceKind.WeaponNew) ?? ch[0];
                    run.Choose(pick);
                    continue;
                }
                if (run.state == RunState.Chest) { run.CloseChest(); continue; }
                Bot(run, out double ix, out double iz);
                run.Update(dt, ix, iz);
                maxEnemies = Math.Max(maxEnemies, run.enemies.aliveCount);
                if (run.time - lastLog > 60)
                {
                    lastLog = run.time;
                    Console.WriteLine($"  t={run.time:F0} lvl={run.player.level} hp={run.player.hp:F0}/{run.player.stats.maxHp} alive={run.enemies.aliveCount} kills={run.stats.kills} weapons={string.Join(",", run.weapons.list.Select(w => w.def.id + ":" + w.level))}");
                }
            }
            var s = run.Summary();
            if (s.victory) wins++;
            double ms = sw.Elapsed.TotalMilliseconds;
            Console.WriteLine($"RUN {r}: {(s.victory ? "VICTORY" : "DEAD")} time={s.time:F0} level={s.level} kills={s.kills} maxAlive={maxEnemies} gold={s.gold} bosses={string.Join("/", s.bosses)} evos={string.Join("/", s.evolutions)} sim={ms / 1000:F1}s ({ms / (s.time / dt) * 1000:F0}us/step)");
            Console.WriteLine("   dmg: " + string.Join(" ", s.weapons.Select(w => $"{w.id}@{w.level}={w.damage}")));
        }
        Console.WriteLine($"WINS {wins}/{runs}");
        return 0;
    }

    static int TerrainSum(string mapId, long seed)
    {
        var t = Generators.GenerateTerrain(Content.MapById[mapId], seed);
        long h = 0;
        for (int i = 0; i < t.cell.Length; i++) h = (h * 31 + t.cell[i] * 7 + t.tile[i]) % 1000000007;
        double bsum = 0;
        foreach (var b in t.blocks) bsum += b.x * 3 + b.y * 5 + b.z * 7 + b.v;
        double dsum = 0;
        foreach (var d in t.decor) dsum += d.x + d.z + d.size;
        Console.WriteLine($"cells={h} blocks={t.blocks.Count} bsum={bsum:F2} decor={t.decor.Count} dsum={dsum:F4} lights={t.lights.Count} tiles={string.Join(",", t.tileNames)}");
        return 0;
    }

    static void Bot(Run run, out double ox, out double oz)
    {
        var p = run.player;
        // repulsion from nearby enemies + bullets, attraction to xp and chests
        double fx = 0, fz = 0;
        run.enemies.ForEachInRadius(p.x, p.z, 6, e =>
        {
            if (e.def.category == "prop") return false;
            double dx = p.x - e.x, dz = p.z - e.z;
            double d2 = dx * dx + dz * dz + 0.1;
            double w = (e.boss != null ? 6 : 1) / d2;
            fx += dx * w;
            fz += dz * w;
            return false;
        });
        foreach (var b in run.hazards.bullets)
        {
            if (!b.active) continue;
            double dx = p.x - b.x, dz = p.z - b.z, d2 = dx * dx + dz * dz;
            if (d2 < 9) { fx += dx / (d2 + 0.1) * 2; fz += dz / (d2 + 0.1) * 2; }
        }
        foreach (var z in run.hazards.zones)
        {
            if (!z.active || z.visualOnly) continue;
            double dx = p.x - z.x, dz = p.z - z.z, d = MathX.Hypot(dx, dz);
            if (d < z.r + 1) { fx += dx / (d + 0.1) * 4; fz += dz / (d + 0.1) * 4; }
        }
        Pickup best = null;
        double bd = 1e9;
        foreach (var pk in run.pickups.list)
        {
            if (!pk.active) continue;
            double d = (pk.x - p.x) * (pk.x - p.x) + (pk.z - p.z) * (pk.z - p.z);
            double w = pk.kind == "chest" ? d * 0.2 : d;
            if (w < bd && d < 400) { bd = w; best = pk; }
        }
        if (best != null)
        {
            double dx = best.x - p.x, dz = best.z - p.z, d = MathX.Hypot(dx, dz);
            if (d == 0) d = 1;
            fx += dx / d * 0.6;
            fz += dz / d * 0.6;
        }
        // avoid hazard tiles (lava, spikes) and walls like a human would
        for (int a = 0; a < 8; a++)
        {
            double ang = a / 8.0 * Math.PI * 2;
            foreach (double rr in new[] { 0.8, 1.6 })
            {
                double sx = p.x + Math.Cos(ang) * rr, sz = p.z + Math.Sin(ang) * rr;
                int c = run.terrain.CellAt(sx, sz);
                if (c == 3 || c == 1 || c == 5 || c == 2)
                {
                    fx -= Math.Cos(ang) * (c == 3 ? 3 : 1) / rr;
                    fz -= Math.Sin(ang) * (c == 3 ? 3 : 1) / rr;
                }
            }
        }
        // drift toward map center to avoid corners
        double cc = run.terrain.size / 2.0;
        fx += (cc - p.x) * 0.004;
        fz += (cc - p.z) * 0.004;
        double l = MathX.Hypot(fx, fz);
        if (l < 0.05) { ox = oz = 0; return; }
        ox = fx / l;
        oz = fz / l;
    }
}
