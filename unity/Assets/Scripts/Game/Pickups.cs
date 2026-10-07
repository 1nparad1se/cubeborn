using System;
using System.Collections.Generic;

namespace Cubeborn
{
    public class Pickup
    {
        public bool active;
        public string kind = "xp";
        public double x, z, y, vx, vz, vy, value;
        public bool attracted;
        public double age;
        /// <summary>Chest tier: 0 normal, 1 boss.</summary>
        public int tier;
    }

    /// <summary>Experience gems, gold, healing, chests and power-ups lying on the ground.</summary>
    public class Pickups
    {
        public static readonly string[] POWERUPS = { "fury", "haste", "aegis", "frenzy", "chrono", "nuke" };
        public readonly List<Pickup> list = new List<Pickup>();
        readonly List<Pickup> free = new List<Pickup>();
        public int gemCount;
        Pickup overflow;
        readonly Run run;

        public Pickups(Run run)
        {
            this.run = run;
            for (int i = 0; i < 800; i++) free.Add(new Pickup());
        }

        public Pickup Spawn(string kind, double x, double z, double value = 0, bool pop = false)
        {
            Pickup p;
            if (free.Count > 0) { p = free[free.Count - 1]; free.RemoveAt(free.Count - 1); }
            else p = new Pickup();
            p.active = true;
            p.kind = kind;
            p.x = x;
            p.z = z;
            p.y = 0;
            p.value = value;
            p.attracted = false;
            p.age = 0;
            p.tier = 0;
            p.vx = p.vz = p.vy = 0;
            if (pop)
            {
                double a = Rand.Value * MathX.TAU, s = 1.5 + Rand.Value * 2;
                p.vx = Math.Cos(a) * s;
                p.vz = Math.Sin(a) * s;
                p.vy = 4;
            }
            list.Add(p);
            if (kind == "xp") gemCount++;
            return p;
        }

        public void DropXp(double x, double z, double value)
        {
            if (gemCount >= Balance.maxGems)
            {
                if (overflow == null || !overflow.active) overflow = Spawn("xp", x, z, 0);
                overflow.value += value;
                return;
            }
            Spawn("xp", x + (Rand.Value - 0.5) * 0.3, z + (Rand.Value - 0.5) * 0.3, value);
        }

        public void RollKillDrops(Enemy e)
        {
            double luck = run.player.stats.luck;
            double r = Rand.Value;
            if (r < Balance.goldDropChance * luck) Spawn("gold", e.x, e.z, 1 + Math.Floor(Rand.Value * 3), true);
            else if (r < (Balance.goldDropChance + Balance.heartDropChance) * luck) Spawn("heart", e.x, e.z, 0, true);
            else if (Rand.Value < Balance.magnetDropChance * luck) Spawn("magnet", e.x, e.z, 0, true);
            else if (Rand.Value < Balance.powerupDropChance * luck) Spawn(run.rng.Pick(POWERUPS), e.x, e.z, 0, true);
        }

        public void DropFromProp(double x, double z)
        {
            var rng = run.rng;
            double luck = run.player.stats.luck;
            double roll = rng.Next();
            if (roll < 0.3) Spawn("heart", x, z, 0, true);
            else if (roll < 0.55) Spawn("gold", x, z, 3 + rng.Int(0, 6), true);
            else if (roll < 0.66) Spawn("magnet", x, z, 0, true);
            else if (roll < 0.66 + 0.25 * luck) Spawn(rng.Pick(POWERUPS), x, z, 0, true);
            else if (roll < 0.97) Spawn("pouch", x, z, 25 + rng.Int(0, 30), true);
            else Spawn("star", x, z, 0, true);
        }

        public void SpawnChest(double x, double z, int tier = 0)
        {
            var c = Spawn("chest", x, z, 0, true);
            c.tier = tier;
            run.fx.Sound("chestDrop");
        }

        public void TreasureBurst(double x, double z)
        {
            for (int i = 0; i < 12; i++) Spawn("gold", x, z, 5 + Math.Floor(Rand.Value * 6), true);
            SpawnChest(x, z);
        }

        public void CollectAllXp()
        {
            foreach (var p in list) if (p.active && (p.kind == "xp" || p.kind == "gold")) p.attracted = true;
        }

        public void Update(double dt)
        {
            var pl = run.player;
            double magnet = pl.stats.magnet, m2 = magnet * magnet;
            int w = 0;
            // collecting can spawn pickups (chest -> nothing, but keep it safe): iterate by index over a snapshot length
            int n = list.Count;
            for (int i = 0; i < n; i++)
            {
                var p = list[i];
                if (!p.active) { free.Add(p); continue; }
                p.age += dt;
                if (p.vy != 0 || p.y > 0)
                {
                    p.vy -= 20 * dt;
                    p.y += p.vy * dt;
                    p.x += p.vx * dt;
                    p.z += p.vz * dt;
                    if (p.y <= 0) { p.y = 0; p.vy = 0; p.vx = p.vz = 0; }
                }
                double dx = pl.x - p.x, dz = pl.z - p.z, d2 = dx * dx + dz * dz;
                double grab = p.kind == "chest" ? 0.9 : 0.6;
                if (!p.attracted && d2 < m2 && p.kind != "chest" && p.age > 0.25) p.attracted = true;
                if (p.attracted)
                {
                    double d = Math.Sqrt(d2);
                    if (d == 0) d = 0.001;
                    double sp = Balance.gemPullSpeed + p.age * 2;
                    // slight overshoot-free homing
                    p.x += (dx / d) * Math.Min(d, sp * dt);
                    p.z += (dz / d) * Math.Min(d, sp * dt);
                }
                if (d2 < grab * grab)
                {
                    Collect(p);
                    p.active = false;
                    free.Add(p);
                    continue;
                }
                list[w++] = p;
            }
            // keep anything spawned during collection
            for (int i = n; i < list.Count; i++) list[w++] = list[i];
            list.RemoveRange(w, list.Count - w);
        }

        void Collect(Pickup p)
        {
            var pl = run.player;
            switch (p.kind)
            {
                case "xp":
                    gemCount--;
                    if (p == overflow) overflow = null;
                    pl.AddXp(p.value);
                    run.xpSoundBudget++;
                    break;
                case "gold":
                    run.stats.gold += p.value * pl.stats.greed;
                    run.fx.Sound("coin", 0.5);
                    break;
                case "pouch":
                    run.stats.gold += p.value * pl.stats.greed;
                    run.fx.Text(pl.x, pl.z, "+" + MathX.Round(p.value * pl.stats.greed), 0xffd23d);
                    run.fx.Sound("coin");
                    break;
                case "heart":
                    pl.Heal(30 * run.perks.HealMul());
                    run.fx.Sound("heal");
                    run.fx.Burst(pl.x, 1, pl.z, 0x6bff8a, 12, 2.5, 0.14, 0.6);
                    break;
                case "magnet":
                    CollectAllXp();
                    run.fx.Sound("magnet");
                    break;
                case "chest":
                    run.OpenChest(p.tier);
                    break;
                case "fury":
                    pl.buffs.fury = 12;
                    PowerFx(0xff5050, "pu_fury");
                    break;
                case "haste":
                    pl.buffs.haste = 12;
                    PowerFx(0x5affd0, "pu_haste");
                    break;
                case "aegis":
                    pl.buffs.aegis = 7;
                    PowerFx(0xffe08a, "pu_aegis");
                    break;
                case "frenzy":
                    pl.buffs.frenzy = 12;
                    PowerFx(0xff9a3a, "pu_frenzy");
                    break;
                case "chrono":
                    run.enemies.frozenAll = 6;
                    PowerFx(0x8ad8ff, "pu_chrono");
                    break;
                case "nuke":
                    PowerFx(0xffffff, "pu_nuke");
                    run.fx.Light(pl.x, pl.z, 0xffffff, 6, 30, 0.5);
                    run.fx.Shake(0.6);
                    run.enemies.ForEachInRadius(pl.x, pl.z, 20, e =>
                    {
                        if (e.boss == null) run.combat.Hit(e, run.nukeBlast, 1);
                        return false;
                    });
                    break;
                case "star":
                    pl.AddXp((pl.xpNext - pl.xp) / pl.stats.growth + 0.01);
                    PowerFx(0xfff07a, "pu_star");
                    break;
            }
            run.EmitPickup(p.kind);
        }

        void PowerFx(int color, string key)
        {
            var pl = run.player;
            run.fx.Burst(pl.x, 1, pl.z, color, 30, 5, 0.18, 0.8);
            run.fx.Text(pl.x, pl.z, run.Tr(key), color);
            run.fx.Sound("powerup");
        }

        public void Clear()
        {
            foreach (var p in list) p.active = false;
            list.Clear();
            gemCount = 0;
        }
    }
}
