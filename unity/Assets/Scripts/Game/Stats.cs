using System;
using System.Collections.Generic;

namespace Cubeborn
{
    /// <summary>Fully resolved player stats used by every system during a run.</summary>
    public class PlayerStats
    {
        public double maxHp, armor, moveSpeed, might, area, cooldown, amount, projSpeed, duration, luck, growth, magnet, regen,
            critChance, critDamage, greed, knockback, pierce, revival, lifesteal, thorns, curse, dodge, reroll, skip, banish;

        public static StatMods Sum(params StatMods[] list)
        {
            var o = new StatMods();
            foreach (var m in list)
                if (m != null)
                    foreach (var kv in m) o[kv.Key] = o.Get(kv.Key) + kv.Value;
            return o;
        }

        public static PlayerStats Resolve(double baseHp, StatMods m)
        {
            double g(string k) => m.Get(k);
            return new PlayerStats
            {
                maxHp = Math.Max(1, baseHp + g("maxHp")),
                armor = g("armor"),
                moveSpeed = Math.Max(0.3, 1 + g("moveSpeed")),
                might = Math.Max(0.1, 1 + g("might")),
                area = Math.Max(0.3, 1 + g("area")),
                cooldown = Math.Max(1 - Balance.maxCooldownReduction, 1 - g("cooldown")),
                amount = MathX.Round(g("amount")),
                projSpeed = Math.Max(0.3, 1 + g("projSpeed")),
                duration = Math.Max(0.3, 1 + g("duration")),
                luck = Math.Max(0, 1 + g("luck")),
                growth = Math.Max(0.1, 1 + g("growth")),
                magnet = Balance.basePickupRadius * Math.Max(0.3, 1 + g("magnet")),
                regen = g("regen"),
                critChance = g("critChance"),
                critDamage = g("critDamage"),
                greed = Math.Max(0, 1 + g("greed")),
                knockback = Math.Max(0, 1 + g("knockback")),
                pierce = MathX.Round(g("pierce")),
                revival = MathX.Round(g("revival")),
                lifesteal = g("lifesteal"),
                thorns = g("thorns"),
                curse = Math.Max(0.5, 1 + g("curse")),
                dodge = Math.Min(Balance.maxDodge, g("dodge")),
                reroll = MathX.Round(g("reroll")) + Balance.baseRerolls,
                skip = MathX.Round(g("skip")) + Balance.baseSkips,
                banish = MathX.Round(g("banish")) + Balance.baseBanish,
            };
        }
    }

    /// <summary>Statistics collected during one run; used for results, achievements and collection.</summary>
    public class RunStats
    {
        public int kills, elites, chests, treasureSprites, maxedWeapons;
        public Dictionary<string, double> killsBy = new Dictionary<string, double>();
        public Dictionary<string, double> damageBy = new Dictionary<string, double>();
        public double gold, damageTaken;
        public List<string> bossesKilled = new List<string>();
        public List<string> evolutions = new List<string>();
        public HashSet<string> seen = new HashSet<string>();
        public HashSet<string> weaponsUsed = new HashSet<string>();
        public HashSet<string> discovered = new HashSet<string>();

        public void AddDamage(string id, double v) => damageBy[id] = (damageBy.TryGetValue(id, out var o) ? o : 0) + v;
    }
}
