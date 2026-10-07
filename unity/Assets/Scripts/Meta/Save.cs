using System;
using System.Collections.Generic;

namespace Cubeborn
{
    public class Settings
    {
        public double music = 0.6, sfx = 0.8;
        public bool vibration = true;
        public string quality = "medium"; // low | medium | high
        public bool damageNumbers = true, screenShake = true, showFps;
        public string lang = "ru";
    }

    public class SaveData
    {
        public int version = 1;
        public double gold;
        public Dictionary<string, int> perm = new Dictionary<string, int>();
        public List<string> unlockedHeroes = new List<string>(), unlockedWeapons = new List<string>(), unlockedPassives = new List<string>(), unlockedMaps = new List<string>();
        public List<string> achievements = new List<string>();
        public Dictionary<string, double> stats = new Dictionary<string, double>();
        public List<string> discWeapons = new List<string>(), discPassives = new List<string>(), discEnemies = new List<string>(), discBosses = new List<string>(), discRelics = new List<string>();
        /// <summary>Highest difficulty index cleared per map (absent = none).</summary>
        public Dictionary<string, int> mapClears = new Dictionary<string, int>();
        public Settings settings = new Settings();
        public bool seenIntro;
        public string lastHero = "bram", lastMap = "blightwood", lastDiff = "normal";

        public List<string> Discovered(string kind)
        {
            switch (kind)
            {
                case "weapons": return discWeapons;
                case "passives": return discPassives;
                case "enemies": return discEnemies;
                case "bosses": return discBosses;
                default: return discRelics;
            }
        }
    }

    /// <summary>JSON persistence with the same layout as the web version's save.</summary>
    public static class SaveIO
    {
        /// <summary>Platform storage: get/set/delete a string by key (PlayerPrefs in Unity).</summary>
        public static Func<string, string> Get = k => null;
        public static Action<string, string> Set = (k, v) => { };
        public static Action<string> Delete = k => { };
        /// <summary>System language hint ("ru"/"en") and mobile flag for defaults.</summary>
        public static string SystemLang = "ru";
        public static bool Mobile = true;

        const string KEY = "cubeborn.save.v1";

        public static Settings DefaultSettings() => new Settings { lang = SystemLang, quality = Mobile ? "medium" : "high" };

        public static SaveData DefaultSave() => new SaveData { settings = DefaultSettings() };

        static List<string> Strs(object o)
        {
            var l = new List<string>();
            foreach (var x in Json.Arr(o)) if (x is string s) l.Add(s);
            return l;
        }

        static object Get2(Dictionary<string, object> d, string k) => d != null && d.TryGetValue(k, out var v) ? v : null;

        /// <summary>Merges stored data over defaults so that new fields appear after updates.</summary>
        public static SaveData FromJson(string json)
        {
            var d = DefaultSave();
            var raw = Json.Obj(Json.Parse(json));
            if (raw == null) return d;
            d.gold = Json.Num(raw, "gold");
            foreach (var kv in Json.Obj(Get2(raw, "perm")) ?? new Dictionary<string, object>()) d.perm[kv.Key] = (int)Convert.ToDouble(kv.Value);
            var un = Json.Obj(Get2(raw, "unlocked"));
            if (un != null)
            {
                d.unlockedHeroes = Strs(Get2(un, "heroes"));
                d.unlockedWeapons = Strs(Get2(un, "weapons"));
                d.unlockedPassives = Strs(Get2(un, "passives"));
                d.unlockedMaps = Strs(Get2(un, "maps"));
            }
            d.achievements = Strs(Get2(raw, "achievements"));
            foreach (var kv in Json.Obj(Get2(raw, "stats")) ?? new Dictionary<string, object>()) d.stats[kv.Key] = Convert.ToDouble(kv.Value);
            var disc = Json.Obj(Get2(raw, "discovered"));
            if (disc != null)
            {
                d.discWeapons = Strs(Get2(disc, "weapons"));
                d.discPassives = Strs(Get2(disc, "passives"));
                d.discEnemies = Strs(Get2(disc, "enemies"));
                d.discBosses = Strs(Get2(disc, "bosses"));
                d.discRelics = Strs(Get2(disc, "relics"));
            }
            foreach (var kv in Json.Obj(Get2(raw, "mapClears")) ?? new Dictionary<string, object>()) d.mapClears[kv.Key] = (int)Convert.ToDouble(kv.Value);
            var s = Json.Obj(Get2(raw, "settings"));
            if (s != null)
            {
                var st = d.settings;
                st.music = Json.Num(s, "music", st.music);
                st.sfx = Json.Num(s, "sfx", st.sfx);
                if (Json.Has(s, "vibration")) st.vibration = Json.Bool(s, "vibration");
                st.quality = Json.Str(s, "quality", st.quality);
                if (Json.Has(s, "damageNumbers")) st.damageNumbers = Json.Bool(s, "damageNumbers");
                if (Json.Has(s, "screenShake")) st.screenShake = Json.Bool(s, "screenShake");
                if (Json.Has(s, "showFps")) st.showFps = Json.Bool(s, "showFps");
                st.lang = Json.Str(s, "lang", st.lang);
            }
            d.seenIntro = Json.Bool(raw, "seenIntro");
            var last = Json.Obj(Get2(raw, "last"));
            if (last != null)
            {
                d.lastHero = Json.Str(last, "hero", d.lastHero);
                d.lastMap = Json.Str(last, "map", d.lastMap);
                d.lastDiff = Json.Str(last, "diff", d.lastDiff);
            }
            return d;
        }

        public static string ToJson(SaveData d)
        {
            var perm = new Dictionary<string, object>();
            foreach (var kv in d.perm) perm[kv.Key] = (double)kv.Value;
            var stats = new Dictionary<string, object>();
            foreach (var kv in d.stats) stats[kv.Key] = kv.Value;
            var clears = new Dictionary<string, object>();
            foreach (var kv in d.mapClears) clears[kv.Key] = (double)kv.Value;
            List<object> L(List<string> l) => new List<object>(l);
            var root = new Dictionary<string, object>
            {
                ["version"] = 1.0,
                ["gold"] = d.gold,
                ["perm"] = perm,
                ["unlocked"] = new Dictionary<string, object> { ["heroes"] = L(d.unlockedHeroes), ["weapons"] = L(d.unlockedWeapons), ["passives"] = L(d.unlockedPassives), ["maps"] = L(d.unlockedMaps) },
                ["achievements"] = L(d.achievements),
                ["stats"] = stats,
                ["discovered"] = new Dictionary<string, object> { ["weapons"] = L(d.discWeapons), ["passives"] = L(d.discPassives), ["enemies"] = L(d.discEnemies), ["bosses"] = L(d.discBosses), ["relics"] = L(d.discRelics) },
                ["mapClears"] = clears,
                ["settings"] = new Dictionary<string, object>
                {
                    ["music"] = d.settings.music, ["sfx"] = d.settings.sfx, ["vibration"] = d.settings.vibration, ["quality"] = d.settings.quality,
                    ["damageNumbers"] = d.settings.damageNumbers, ["screenShake"] = d.settings.screenShake, ["lang"] = d.settings.lang, ["showFps"] = d.settings.showFps,
                },
                ["seenIntro"] = d.seenIntro,
                ["last"] = new Dictionary<string, object> { ["hero"] = d.lastHero, ["map"] = d.lastMap, ["diff"] = d.lastDiff },
            };
            return Json.Write(root);
        }

        public static SaveData Load()
        {
            try
            {
                var s = Get(KEY);
                if (string.IsNullOrEmpty(s)) return DefaultSave();
                return FromJson(s);
            }
            catch
            {
                return DefaultSave();
            }
        }

        public static bool Write(SaveData d)
        {
            try
            {
                Set(KEY, ToJson(d));
                return true;
            }
            catch
            {
                return false;
            }
        }

        public static void Clear()
        {
            try { Delete(KEY); } catch { }
        }
    }
}
