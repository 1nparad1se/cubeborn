using System.Collections.Generic;

namespace Cubeborn
{
    using D = Dictionary<string, object>;

    /// <summary>Localized string pair.</summary>
    public class Loc
    {
        public string ru = "", en = "";
        public static Loc From(object o)
        {
            var d = Json.Obj(o);
            if (d == null) return new Loc();
            return new Loc { ru = Json.Str(d, "ru", ""), en = Json.Str(d, "en", "") };
        }
    }

    /// <summary>Partial stat bag (StatMods in TS).</summary>
    public class StatMods : Dictionary<string, double>
    {
        public static StatMods From(object o)
        {
            var m = new StatMods();
            var d = Json.Obj(o);
            if (d != null) foreach (var kv in d) m[kv.Key] = System.Convert.ToDouble(kv.Value);
            return m;
        }
        public double Get(string k) => TryGetValue(k, out var v) ? v : 0;
    }

    /// <summary>Generic numeric/string parameter bag (enemy p, boss attacks, map events).</summary>
    public class Params
    {
        public readonly D d;
        public Params(D d) { this.d = d ?? new D(); }
        public double Num(string k, double def = 0) => Json.Num(d, k, def);
        public string Str(string k, string def = null) => Json.Str(d, k, def);
        public bool Has(string k) => Json.Has(d, k);
        public object Raw(string k) => d.TryGetValue(k, out var v) ? v : null;
        public string type => Str("type", "");
    }

    /// <summary>Weapon stat block: named numeric fields plus behaviour-specific extras.</summary>
    public class WStats
    {
        public readonly Dictionary<string, double> v = new Dictionary<string, double>();
        public double this[string k]
        {
            get => v.TryGetValue(k, out var x) ? x : 0;
            set => v[k] = value;
        }
        public bool Has(string k) => v.ContainsKey(k);
        public double Get(string k, double def) => v.TryGetValue(k, out var x) ? x : def;
        public double damage { get => this["damage"]; set => this["damage"] = value; }
        public double cooldown { get => this["cooldown"]; set => this["cooldown"] = value; }
        public double attackSpeed { get => this["attackSpeed"]; set => this["attackSpeed"] = value; }
        public double amount { get => this["amount"]; set => this["amount"] = value; }
        public double projSpeed { get => this["projSpeed"]; set => this["projSpeed"] = value; }
        public double area { get => this["area"]; set => this["area"] = value; }
        public double duration { get => this["duration"]; set => this["duration"] = value; }
        public double knockback { get => this["knockback"]; set => this["knockback"] = value; }
        public double critChance { get => this["critChance"]; set => this["critChance"] = value; }
        public double critDamage { get => this["critDamage"]; set => this["critDamage"] = value; }
        public double pierce { get => this["pierce"]; set => this["pierce"] = value; }
        public WStats Clone()
        {
            var c = new WStats();
            foreach (var kv in v) c.v[kv.Key] = kv.Value;
            return c;
        }
        public static WStats From(object o)
        {
            var s = new WStats();
            var d = Json.Obj(o);
            if (d != null) foreach (var kv in d) s.v[kv.Key] = System.Convert.ToDouble(kv.Value);
            return s;
        }
    }

    public class WeaponDef
    {
        public string id, icon, rarity, behavior, targeting, sfx;
        public Loc name, desc;
        public int color;
        public WStats @base;
        public List<WStats> levels = new List<WStats>();
        public string evoPassive, evoInto;
        public bool evolved, locked;
        public List<string> tags = new List<string>();
        public bool HasTag(string t) => tags.Contains(t);
    }

    public class PassiveDef
    {
        public string id, icon, rarity;
        public Loc name, desc;
        public int color, maxLevel;
        public StatMods perLevel;
        public bool locked;
    }

    public class HeroDef
    {
        public string id, perk, startWeapon, model;
        public Loc name, title, desc, perkName, perkDesc;
        public double baseHp, baseSpeed;
        public StatMods stats;
        public int color;
        public bool locked;
    }

    public class EnemyDef
    {
        public string id, category, behavior, model, splitInto;
        public Loc name;
        public double hp, damage, speed, radius, size, xp, kbResist;
        public Params p;
        public bool flying;
    }

    public class EliteDef
    {
        public string id;
        public Loc name;
        public int color;
        public double hp, speed, damage;
    }

    public class BossPhase
    {
        public double hp, speed;
        public string move;
        public List<Params> attacks = new List<Params>();
        public List<Params> onEnter = new List<Params>();
    }

    public class BossDef
    {
        public string id, model, relic, music;
        public Loc name, title;
        public double hp, damage, radius;
        public int color;
        public List<BossPhase> phases = new List<BossPhase>();
        public bool flying;
    }

    public class RelicDef
    {
        public string id;
        public Loc name, desc;
        public StatMods stats;
        public int color;
    }

    public class SpawnSegment
    {
        public double t, rate, max;
        public List<KeyValuePair<string, double>> pool = new List<KeyValuePair<string, double>>();
    }

    public class MapPalette
    {
        public int sky, fog, ambient, sun, hemiGround;
        public double fogNear, fogFar, ambientIntensity, sunIntensity;
        public Dictionary<string, int[]> tiles = new Dictionary<string, int[]>();
        public Dictionary<string, int[]> blocks = new Dictionary<string, int[]>();
    }

    public class MapMusic
    {
        public double root, tempo;
        public string scale, mood;
    }

    public class MapDef
    {
        public string id, generator, midBoss, boss, ambient;
        public Loc name, desc;
        public int size, difficultyStars, recommendedLevel;
        public MapPalette palette;
        public List<SpawnSegment> segments = new List<SpawnSegment>();
        public List<Params> events = new List<Params>();
        public double bossTime, tier, hazardDps;
        public MapMusic music;
    }

    public class DifficultyDef
    {
        public string id, color;
        public Loc name, modifiers;
        public double hp, damage, speed, spawn, elite, reward;
    }

    public class PermUpgradeDef
    {
        public string id, icon;
        public Loc name, desc;
        public int maxLevel;
        public double baseCost, costGrowth;
        public StatMods perLevel;
    }

    public class UnlockRef
    {
        public string kind, id;
    }

    public class AchievementDef
    {
        public string id;
        public Loc name, desc;
        public string condStat, condExtra;
        public double condValue;
        public UnlockRef reward;
        public double gold;
        public bool hidden;
    }

    /// <summary>One voxel box: center x/z, bottom y, size, colour, optional animation tag.</summary>
    public struct VoxBox
    {
        public float x, y, z, w, h, d;
        public int color;
        public string tag;
    }

    public class VoxelModel
    {
        public VoxBox[] boxes;
        public float scale;
        public int[] glow;
    }
}
