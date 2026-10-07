using System;
using System.Collections.Generic;

namespace Cubeborn
{
    /// <summary>Account-level state: currency, unlocks, achievements and lifetime stats.</summary>
    public class Profile
    {
        public SaveData data;

        public Profile() { data = SaveIO.Load(); }

        public void Save() => SaveIO.Write(data);

        public void Reset()
        {
            var settings = data.settings;
            SaveIO.Clear();
            data = SaveIO.DefaultSave();
            data.settings = settings;
            Save();
        }

        // ---------------------------------------------------------------- unlocks
        public bool IsHeroUnlocked(string id) => Content.HeroById.TryGetValue(id, out var h) && (!h.locked || data.unlockedHeroes.Contains(id));
        public bool IsWeaponUnlocked(string id) => Content.WeaponById.TryGetValue(id, out var w) && (!w.locked || data.unlockedWeapons.Contains(id));
        public bool IsPassiveUnlocked(string id) => Content.PassiveById.TryGetValue(id, out var p) && (!p.locked || data.unlockedPassives.Contains(id));
        public bool IsMapUnlocked(string id) => Content.Maps[0].id == id || data.unlockedMaps.Contains(id);

        /// <summary>Difficulty index available for a map: one above the best clear.</summary>
        public int MaxDifficulty(string mapId) => data.mapClears.TryGetValue(mapId, out var c) ? Math.Min(3, c + 1) : 0;

        public bool Unlock(UnlockRef r)
        {
            var list = r.kind == "hero" ? data.unlockedHeroes : r.kind == "weapon" ? data.unlockedWeapons : r.kind == "passive" ? data.unlockedPassives : data.unlockedMaps;
            if (list.Contains(r.id)) return false;
            list.Add(r.id);
            return true;
        }

        public bool Discover(string kind, string id)
        {
            var list = data.Discovered(kind);
            if (list.Contains(id)) return false;
            list.Add(id);
            return true;
        }

        // ---------------------------------------------------------------- stats
        public double Stat(string key) => data.stats.TryGetValue(key, out var v) ? v : 0;
        public void AddStat(string key, double v) => data.stats[key] = Stat(key) + v;
        public void MaxStat(string key, double v)
        {
            if (v > Stat(key)) data.stats[key] = v;
        }

        /// <summary>Derived stats used by achievements.</summary>
        public double DerivedStat(string key)
        {
            if (key == "evolutions")
            {
                int n = 0;
                foreach (var id in data.discWeapons) if (Content.WeaponById.TryGetValue(id, out var w) && w.evolved) n++;
                return n;
            }
            if (key == "heroWins")
            {
                int n = 0;
                foreach (var h in Content.Heroes) if (Stat("herowin_" + h.id) > 0) n++;
                return n;
            }
            if (key == "mapsCleared")
            {
                int n = 0;
                foreach (var m in Content.Maps) if (data.mapClears.TryGetValue(m.id, out var c) && c >= 0) n++;
                return n;
            }
            return Stat(key);
        }

        /// <summary>Returns newly completed achievements and applies their rewards.</summary>
        public List<AchievementDef> CheckAchievements()
        {
            var done = new List<AchievementDef>();
            foreach (var a in Content.Achievements)
            {
                if (data.achievements.Contains(a.id)) continue;
                if (DerivedStat(a.condStat) >= a.condValue)
                {
                    data.achievements.Add(a.id);
                    if (a.reward != null) Unlock(a.reward);
                    if (a.gold > 0) data.gold += a.gold;
                    done.Add(a);
                }
            }
            return done;
        }

        public double AchievementProgress(AchievementDef a) => Math.Min(1, DerivedStat(a.condStat) / a.condValue);

        // ---------------------------------------------------------------- permanent upgrades
        public int PermLevel(string id) => data.perm.TryGetValue(id, out var l) ? l : 0;
        public double PermNextCost(string id) => Content.PermCost(Content.UpgradeById[id], PermLevel(id));

        public bool BuyPerm(string id)
        {
            if (!Content.UpgradeById.TryGetValue(id, out var def)) return false;
            int lvl = PermLevel(id);
            if (lvl >= def.maxLevel) return false;
            double cost = Content.PermCost(def, lvl);
            if (data.gold < cost) return false;
            data.gold -= cost;
            data.perm[id] = lvl + 1;
            Save();
            return true;
        }

        /// <summary>Refunds all gold spent on upgrades.</summary>
        public void RefundPerms()
        {
            double total = 0;
            foreach (var def in Content.Upgrades)
            {
                int lvl = PermLevel(def.id);
                for (int i = 0; i < lvl; i++) total += Content.PermCost(def, i);
            }
            data.perm.Clear();
            data.gold += total;
            Save();
        }

        /// <summary>Total upgrade levels bought: shown as account "power level".</summary>
        public int PowerLevel()
        {
            int n = 0;
            foreach (var kv in data.perm) n += kv.Value;
            return n + data.discRelics.Count;
        }

        /// <summary>Stat bonuses from permanent upgrades and relics.</summary>
        public StatMods PermanentMods()
        {
            var o = new StatMods();
            void Add(StatMods m, int times)
            {
                foreach (var kv in m) o[kv.Key] = o.Get(kv.Key) + kv.Value * times;
            }
            foreach (var def in Content.Upgrades)
            {
                int lvl = PermLevel(def.id);
                if (lvl > 0) Add(def.perLevel, lvl);
            }
            foreach (var id in data.discRelics)
                if (Content.RelicById.TryGetValue(id, out var r)) Add(r.stats, 1);
            return o;
        }
    }
}
