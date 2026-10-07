using System;
using System.Collections.Generic;

namespace Cubeborn
{
    /// <summary>Passive items owned during a run.</summary>
    public class Passives
    {
        public readonly Dictionary<string, int> levels = new Dictionary<string, int>();
        public bool Has(string id) => id != null && levels.ContainsKey(id);
        public int Level(string id) => levels.TryGetValue(id, out var l) ? l : 0;
        public int count => levels.Count;
        public void Add(string id) => levels[id] = Level(id) + 1;
        public StatMods Mods()
        {
            var o = new StatMods();
            foreach (var kv in levels)
            {
                var def = Content.PassiveById[kv.Key];
                foreach (var m in def.perLevel) o[m.Key] = o.Get(m.Key) + m.Value * kv.Value;
            }
            return o;
        }
    }

    public enum ChoiceKind { WeaponNew, WeaponUp, PassiveNew, PassiveUp, Gold, Heal }

    public class Choice
    {
        public ChoiceKind kind;
        public string id;
        /// <summary>Level after taking it.</summary>
        public int level;
        public string rarity;
    }

    /// <summary>Generates and applies level-up choices.</summary>
    public class Leveling
    {
        static readonly Dictionary<string, double> RARITY_WEIGHT = new Dictionary<string, double> { { "common", 10 }, { "rare", 7 }, { "epic", 4 }, { "legendary", 2 } };
        public readonly HashSet<string> banished = new HashSet<string>();
        public int rerolls, skips, banishes;
        readonly Run run;

        public Leveling(Run run) { this.run = run; }

        public void InitCounters()
        {
            var s = run.player.stats;
            rerolls = (int)s.reroll;
            skips = (int)s.skip;
            banishes = (int)s.banish;
        }

        class Cand { public Choice c; public double w; }

        List<Cand> Candidates()
        {
            double luck = run.player.stats.luck;
            var o = new List<Cand>();
            double Rw(string r) => (RARITY_WEIGHT.TryGetValue(r, out var v) ? v : 10) * (r == "common" ? 1 : luck);
            foreach (var w in run.weapons.list)
            {
                if (w.def.evolved || w.isMax) continue;
                o.Add(new Cand { c = new Choice { kind = ChoiceKind.WeaponUp, id = w.def.id, level = w.level + 1, rarity = w.def.rarity }, w = Rw(w.def.rarity) * 1.4 });
            }
            if (run.weapons.list.Count < Balance.weaponSlots)
            {
                foreach (var def in Content.Weapons)
                {
                    if (def.evolved || run.weapons.Has(def.id) || banished.Contains(def.id)) continue;
                    if (def.evoInto != null && run.weapons.Has(def.evoInto)) continue;
                    if (!run.unlockedWeapons.Contains(def.id)) continue;
                    o.Add(new Cand { c = new Choice { kind = ChoiceKind.WeaponNew, id = def.id, level = 1, rarity = def.rarity }, w = Rw(def.rarity) });
                }
            }
            foreach (var kv in run.passives.levels)
            {
                var def = Content.PassiveById[kv.Key];
                if (kv.Value >= def.maxLevel) continue;
                o.Add(new Cand { c = new Choice { kind = ChoiceKind.PassiveUp, id = kv.Key, level = kv.Value + 1, rarity = def.rarity }, w = Rw(def.rarity) * 1.1 });
            }
            if (run.passives.count < Balance.passiveSlots)
            {
                foreach (var def in Content.Passives)
                {
                    if (run.passives.Has(def.id) || banished.Contains(def.id) || !run.unlockedPassives.Contains(def.id)) continue;
                    // favour passives that complete an evolution recipe
                    bool helps = run.weapons.list.Exists(w => w.def.evoPassive == def.id);
                    o.Add(new Cand { c = new Choice { kind = ChoiceKind.PassiveNew, id = def.id, level = 1, rarity = def.rarity }, w = Rw(def.rarity) * (helps ? 1.8 : 0.8) });
                }
            }
            return o;
        }

        public List<Choice> Roll()
        {
            var pool = Candidates();
            double luck = run.player.stats.luck;
            int n = Balance.choiceCount;
            if (run.rng.Chance(Math.Min(0.5, (luck - 1) * Balance.extraChoiceLuck + 0.08))) n++;
            var picks = new List<Choice>();
            while (picks.Count < n && pool.Count > 0)
            {
                var it = run.rng.Weighted(pool, q => q.w);
                if (it == null) break;
                picks.Add(it.c);
                pool.Remove(it);
            }
            if (picks.Count == 0)
            {
                picks.Add(new Choice { kind = ChoiceKind.Gold, id = "gold", level = 0, rarity = "common" });
                picks.Add(new Choice { kind = ChoiceKind.Heal, id = "heal", level = 0, rarity = "common" });
            }
            return picks;
        }

        public void Apply(Choice c)
        {
            switch (c.kind)
            {
                case ChoiceKind.WeaponNew:
                    run.weapons.Add(c.id);
                    break;
                case ChoiceKind.WeaponUp:
                    run.weapons.Get(c.id)?.LevelUp();
                    break;
                case ChoiceKind.PassiveNew:
                case ChoiceKind.PassiveUp:
                    run.passives.Add(c.id);
                    run.RecomputeStats();
                    break;
                case ChoiceKind.Gold:
                    run.stats.gold += 25 * run.player.stats.greed;
                    break;
                case ChoiceKind.Heal:
                    run.player.Heal(run.player.stats.maxHp * 0.3);
                    break;
            }
            run.stats.discovered.Add(c.id);
        }
    }
}
