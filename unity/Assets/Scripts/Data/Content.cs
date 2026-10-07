using System;
using System.Collections.Generic;

namespace Cubeborn
{
    using D = Dictionary<string, object>;

    /// <summary>All game content, parsed from the JSON exported from the web version.</summary>
    public static class Content
    {
        /// <summary>Returns the text of a data file by name ("content", "models", "i18n", "icons").</summary>
        public static Func<string, string> Loader;

        public static int WeaponMaxLevel = 6;
        public static List<WeaponDef> Weapons = new List<WeaponDef>();
        public static List<PassiveDef> Passives = new List<PassiveDef>();
        public static List<HeroDef> Heroes = new List<HeroDef>();
        public static List<EnemyDef> Enemies = new List<EnemyDef>();
        public static List<EliteDef> Elites = new List<EliteDef>();
        public static List<BossDef> Bosses = new List<BossDef>();
        public static List<RelicDef> Relics = new List<RelicDef>();
        public static List<MapDef> Maps = new List<MapDef>();
        public static List<DifficultyDef> Difficulties = new List<DifficultyDef>();
        public static List<PermUpgradeDef> Upgrades = new List<PermUpgradeDef>();
        public static List<AchievementDef> Achievements = new List<AchievementDef>();

        public static Dictionary<string, WeaponDef> WeaponById = new Dictionary<string, WeaponDef>();
        public static Dictionary<string, PassiveDef> PassiveById = new Dictionary<string, PassiveDef>();
        public static Dictionary<string, HeroDef> HeroById = new Dictionary<string, HeroDef>();
        public static Dictionary<string, EnemyDef> EnemyById = new Dictionary<string, EnemyDef>();
        public static Dictionary<string, EliteDef> EliteById = new Dictionary<string, EliteDef>();
        public static Dictionary<string, BossDef> BossById = new Dictionary<string, BossDef>();
        public static Dictionary<string, RelicDef> RelicById = new Dictionary<string, RelicDef>();
        public static Dictionary<string, MapDef> MapById = new Dictionary<string, MapDef>();
        public static Dictionary<string, DifficultyDef> DifficultyById = new Dictionary<string, DifficultyDef>();
        public static Dictionary<string, PermUpgradeDef> UpgradeById = new Dictionary<string, PermUpgradeDef>();
        public static Dictionary<string, AchievementDef> AchievementById = new Dictionary<string, AchievementDef>();

        /// <summary>Model groups: enemy, hero, ally, boss, projectile, pickup.</summary>
        public static Dictionary<string, Dictionary<string, VoxelModel>> ModelGroups = new Dictionary<string, Dictionary<string, VoxelModel>>();
        static readonly Dictionary<string, VoxelModel> allModels = new Dictionary<string, VoxelModel>();
        static readonly Dictionary<string, int> mainColorCache = new Dictionary<string, int>();

        public static bool Loaded;

        public static void Load()
        {
            if (Loaded) return;
            Loaded = true;
            var root = Json.Obj(Json.Parse(Loader("content")));
            WeaponMaxLevel = (int)Json.Num(root, "weaponMaxLevel", 6);
            foreach (var o in Json.Arr(root["weapons"])) Add(Weapons, WeaponById, ParseWeapon(Json.Obj(o)), w => w.id);
            foreach (var o in Json.Arr(root["passives"])) Add(Passives, PassiveById, ParsePassive(Json.Obj(o)), w => w.id);
            foreach (var o in Json.Arr(root["heroes"])) Add(Heroes, HeroById, ParseHero(Json.Obj(o)), w => w.id);
            foreach (var o in Json.Arr(root["enemies"])) Add(Enemies, EnemyById, ParseEnemy(Json.Obj(o)), w => w.id);
            foreach (var o in Json.Arr(root["elites"]))
            {
                var d = Json.Obj(o);
                Add(Elites, EliteById, new EliteDef { id = Json.Str(d, "id"), name = Loc.From(d["name"]), color = (int)Json.Num(d, "color"), hp = Json.Num(d, "hp"), speed = Json.Num(d, "speed"), damage = Json.Num(d, "damage") }, w => w.id);
            }
            foreach (var o in Json.Arr(root["bosses"])) Add(Bosses, BossById, ParseBoss(Json.Obj(o)), w => w.id);
            foreach (var o in Json.Arr(root["relics"]))
            {
                var d = Json.Obj(o);
                Add(Relics, RelicById, new RelicDef { id = Json.Str(d, "id"), name = Loc.From(d["name"]), desc = Loc.From(d["desc"]), stats = StatMods.From(Get(d, "stats")), color = (int)Json.Num(d, "color") }, w => w.id);
            }
            foreach (var o in Json.Arr(root["maps"])) Add(Maps, MapById, ParseMap(Json.Obj(o)), w => w.id);
            foreach (var o in Json.Arr(root["difficulties"]))
            {
                var d = Json.Obj(o);
                Add(Difficulties, DifficultyById, new DifficultyDef
                {
                    id = Json.Str(d, "id"), name = Loc.From(d["name"]), modifiers = Loc.From(Get(d, "modifiers")), color = Json.Str(d, "color", "#ffffff"),
                    hp = Json.Num(d, "hp", 1), damage = Json.Num(d, "damage", 1), speed = Json.Num(d, "speed", 1), spawn = Json.Num(d, "spawn", 1), elite = Json.Num(d, "elite", 1), reward = Json.Num(d, "reward", 1),
                }, w => w.id);
            }
            foreach (var o in Json.Arr(root["upgrades"]))
            {
                var d = Json.Obj(o);
                Add(Upgrades, UpgradeById, new PermUpgradeDef
                {
                    id = Json.Str(d, "id"), name = Loc.From(d["name"]), desc = Loc.From(d["desc"]), icon = Json.Str(d, "icon", ""),
                    maxLevel = (int)Json.Num(d, "maxLevel"), baseCost = Json.Num(d, "baseCost"), costGrowth = Json.Num(d, "costGrowth", 1), perLevel = StatMods.From(Get(d, "perLevel")),
                }, w => w.id);
            }
            foreach (var o in Json.Arr(root["achievements"]))
            {
                var d = Json.Obj(o);
                var c = Json.Obj(Get(d, "cond"));
                var a = new AchievementDef
                {
                    id = Json.Str(d, "id"), name = Loc.From(d["name"]), desc = Loc.From(d["desc"]),
                    condStat = Json.Str(c, "stat", ""), condValue = Json.Num(c, "value"), condExtra = Json.Str(c, "extra"),
                    gold = Json.Num(d, "gold"), hidden = Json.Bool(d, "hidden"),
                };
                var r = Json.Obj(Get(d, "reward"));
                if (r != null) a.reward = new UnlockRef { kind = Json.Str(r, "kind"), id = Json.Str(r, "id") };
                Add(Achievements, AchievementById, a, w => w.id);
            }

            var models = Json.Obj(Json.Parse(Loader("models")));
            foreach (var g in models)
            {
                var group = new Dictionary<string, VoxelModel>();
                foreach (var m in Json.Obj(g.Value)) group[m.Key] = ParseModel(Json.Obj(m.Value));
                ModelGroups[g.Key] = group;
                if (g.Key == "enemy" || g.Key == "hero" || g.Key == "ally" || g.Key == "boss")
                    foreach (var kv in group) allModels[kv.Key] = kv.Value;
            }
            I18n.Load(Loader("i18n"));
        }

        static object Get(D d, string k) => d != null && d.TryGetValue(k, out var v) ? v : null;

        static void Add<T>(List<T> list, Dictionary<string, T> map, T item, Func<T, string> id)
        {
            list.Add(item);
            map[id(item)] = item;
        }

        static WeaponDef ParseWeapon(D d)
        {
            var w = new WeaponDef
            {
                id = Json.Str(d, "id"), name = Loc.From(d["name"]), desc = Loc.From(d["desc"]), icon = Json.Str(d, "icon", "crystal"),
                color = (int)Json.Num(d, "color"), rarity = Json.Str(d, "rarity", "common"), behavior = Json.Str(d, "behavior"),
                targeting = Json.Str(d, "targeting", "nearest"), @base = WStats.From(Get(d, "base")),
                evolved = Json.Bool(d, "evolved"), locked = Json.Bool(d, "locked"), sfx = Json.Str(d, "sfx"),
            };
            foreach (var l in Json.Arr(Get(d, "levels"))) w.levels.Add(WStats.From(l));
            var evo = Json.Obj(Get(d, "evolution"));
            if (evo != null) { w.evoPassive = Json.Str(evo, "passive"); w.evoInto = Json.Str(evo, "into"); }
            foreach (var t in Json.Arr(Get(d, "tags"))) w.tags.Add((string)t);
            return w;
        }

        static PassiveDef ParsePassive(D d) => new PassiveDef
        {
            id = Json.Str(d, "id"), name = Loc.From(d["name"]), desc = Loc.From(d["desc"]), icon = Json.Str(d, "icon", "crystal"),
            color = (int)Json.Num(d, "color"), rarity = Json.Str(d, "rarity", "common"), maxLevel = (int)Json.Num(d, "maxLevel", 5),
            perLevel = StatMods.From(Get(d, "perLevel")), locked = Json.Bool(d, "locked"),
        };

        static HeroDef ParseHero(D d) => new HeroDef
        {
            id = Json.Str(d, "id"), name = Loc.From(d["name"]), title = Loc.From(d["title"]), desc = Loc.From(d["desc"]),
            perkName = Loc.From(d["perkName"]), perkDesc = Loc.From(d["perkDesc"]), perk = Json.Str(d, "perk", ""),
            startWeapon = Json.Str(d, "startWeapon"), baseHp = Json.Num(d, "baseHp", 100), baseSpeed = Json.Num(d, "baseSpeed", 4),
            stats = StatMods.From(Get(d, "stats")), model = Json.Str(d, "model"), color = (int)Json.Num(d, "color"), locked = Json.Bool(d, "locked"),
        };

        static EnemyDef ParseEnemy(D d) => new EnemyDef
        {
            id = Json.Str(d, "id"), name = Loc.From(d["name"]), category = Json.Str(d, "category", "normal"), behavior = Json.Str(d, "behavior", "chase"),
            hp = Json.Num(d, "hp"), damage = Json.Num(d, "damage"), speed = Json.Num(d, "speed"), radius = Json.Num(d, "radius", 0.45),
            size = Json.Num(d, "size", 1), xp = Json.Num(d, "xp"), kbResist = Json.Num(d, "kbResist"), model = Json.Str(d, "model", Json.Str(d, "id")),
            p = new Params(Json.Obj(Get(d, "p"))), flying = Json.Bool(d, "flying"), splitInto = Json.Str(d, "splitInto"),
        };

        static BossDef ParseBoss(D d)
        {
            var b = new BossDef
            {
                id = Json.Str(d, "id"), name = Loc.From(d["name"]), title = Loc.From(d["title"]), hp = Json.Num(d, "hp"), damage = Json.Num(d, "damage"),
                radius = Json.Num(d, "radius", 1), model = Json.Str(d, "model"), color = (int)Json.Num(d, "color"), relic = Json.Str(d, "relic"),
                music = Json.Str(d, "music"), flying = Json.Bool(d, "flying"),
            };
            foreach (var po in Json.Arr(Get(d, "phases")))
            {
                var p = Json.Obj(po);
                var ph = new BossPhase { hp = Json.Num(p, "hp", 1), move = Json.Str(p, "move", "chase"), speed = Json.Num(p, "speed", 1) };
                foreach (var a in Json.Arr(Get(p, "attacks"))) ph.attacks.Add(new Params(Json.Obj(a)));
                foreach (var a in Json.Arr(Get(p, "onEnter"))) ph.onEnter.Add(new Params(Json.Obj(a)));
                b.phases.Add(ph);
            }
            return b;
        }

        static int[] Ints(object o)
        {
            var a = Json.Arr(o);
            var r = new int[a.Count];
            for (int i = 0; i < a.Count; i++) r[i] = (int)Convert.ToDouble(a[i]);
            return r;
        }

        static MapDef ParseMap(D d)
        {
            var m = new MapDef
            {
                id = Json.Str(d, "id"), name = Loc.From(d["name"]), desc = Loc.From(d["desc"]), size = (int)Json.Num(d, "size", 160),
                generator = Json.Str(d, "generator"), difficultyStars = (int)Json.Num(d, "difficultyStars", 1), recommendedLevel = (int)Json.Num(d, "recommendedLevel"),
                midBoss = Json.Str(d, "midBoss"), boss = Json.Str(d, "boss"), bossTime = Json.Num(d, "bossTime", 900), tier = Json.Num(d, "tier", 1),
                hazardDps = Json.Num(d, "hazardDps"), ambient = Json.Str(d, "ambient"),
            };
            var pal = Json.Obj(d["palette"]);
            m.palette = new MapPalette
            {
                sky = (int)Json.Num(pal, "sky"), fog = (int)Json.Num(pal, "fog"), fogNear = Json.Num(pal, "fogNear"), fogFar = Json.Num(pal, "fogFar"),
                ambient = (int)Json.Num(pal, "ambient"), ambientIntensity = Json.Num(pal, "ambientIntensity"), sun = (int)Json.Num(pal, "sun"),
                sunIntensity = Json.Num(pal, "sunIntensity"), hemiGround = (int)Json.Num(pal, "hemiGround"),
            };
            foreach (var kv in Json.Obj(pal["tiles"])) m.palette.tiles[kv.Key] = Ints(kv.Value);
            foreach (var kv in Json.Obj(pal["blocks"])) m.palette.blocks[kv.Key] = Ints(kv.Value);
            foreach (var so in Json.Arr(Get(d, "segments")))
            {
                var s = Json.Obj(so);
                var seg = new SpawnSegment { t = Json.Num(s, "t"), rate = Json.Num(s, "rate"), max = Json.Num(s, "max") };
                foreach (var pe in Json.Arr(s["pool"]))
                {
                    var pa = Json.Arr(pe);
                    seg.pool.Add(new KeyValuePair<string, double>((string)pa[0], Convert.ToDouble(pa[1])));
                }
                m.segments.Add(seg);
            }
            foreach (var e in Json.Arr(Get(d, "events"))) m.events.Add(new Params(Json.Obj(e)));
            var mu = Json.Obj(Get(d, "music"));
            m.music = new MapMusic { root = Json.Num(mu, "root", 45), tempo = Json.Num(mu, "tempo", 110), scale = Json.Str(mu, "scale", "minor"), mood = Json.Str(mu, "mood", "") };
            return m;
        }

        static VoxelModel ParseModel(D d)
        {
            var boxes = Json.Arr(d["boxes"]);
            var m = new VoxelModel { scale = (float)Json.Num(d, "scale", 0.1), boxes = new VoxBox[boxes.Count] };
            for (int i = 0; i < boxes.Count; i++)
            {
                var b = Json.Arr(boxes[i]);
                m.boxes[i] = new VoxBox
                {
                    x = (float)Convert.ToDouble(b[0]), y = (float)Convert.ToDouble(b[1]), z = (float)Convert.ToDouble(b[2]),
                    w = (float)Convert.ToDouble(b[3]), h = (float)Convert.ToDouble(b[4]), d = (float)Convert.ToDouble(b[5]),
                    color = (int)Convert.ToDouble(b[6]), tag = b.Count > 7 ? b[7] as string : null,
                };
            }
            if (Json.Has(d, "glow")) m.glow = Ints(d["glow"]);
            return m;
        }

        // ------------------------------------------------------------ helpers mirroring the TS data modules

        public static VoxelModel GetModel(string id) => id != null && allModels.TryGetValue(id, out var m) ? m : null;

        public static VoxelModel GetGroupModel(string group, string id)
        {
            if (ModelGroups.TryGetValue(group, out var g) && id != null && g.TryGetValue(id, out var m)) return m;
            return null;
        }

        /// <summary>Colour of the largest box: used for death debris and UI accents.</summary>
        public static int ModelMainColor(string id)
        {
            if (id == null) return 0x888888;
            if (mainColorCache.TryGetValue(id, out var c)) return c;
            var m = GetModel(id);
            int best = 0x888888;
            double vol = 0;
            if (m != null)
                foreach (var b in m.boxes)
                {
                    double v = b.w * b.h * b.d;
                    if (v > vol) { vol = v; best = b.color; }
                }
            return mainColorCache[id] = best;
        }

        public static IEnumerable<WeaponDef> BaseWeapons()
        {
            foreach (var w in Weapons) if (!w.evolved) yield return w;
        }

        public static WeaponDef EvolutionOf(string id)
        {
            if (id != null && WeaponById.TryGetValue(id, out var w) && w.evoInto != null && WeaponById.TryGetValue(w.evoInto, out var e)) return e;
            return null;
        }

        public static double PermCost(PermUpgradeDef def, int level) => MathX.Round(def.baseCost * Math.Pow(def.costGrowth, level) / 10) * 10;
    }

    /// <summary>UI string tables (ru/en).</summary>
    public static class I18n
    {
        static readonly Dictionary<string, Dictionary<string, string>> dicts = new Dictionary<string, Dictionary<string, string>>();
        public static string Lang = "ru";
        public static readonly string[][] Langs = { new[] { "ru", "Русский" }, new[] { "en", "English" } };

        public static void Load(string text)
        {
            var root = Json.Obj(Json.Parse(text));
            foreach (var l in root)
            {
                var d = new Dictionary<string, string>();
                foreach (var kv in Json.Obj(l.Value)) d[kv.Key] = kv.Value as string ?? "";
                dicts[l.Key] = d;
            }
        }

        public static void SetLang(string lang) => Lang = dicts.ContainsKey(lang) ? lang : "ru";

        /// <summary>Translates a UI key; {name} placeholders are filled from pairs of (key, value).</summary>
        public static string T(string key, params object[] kv)
        {
            string s = null;
            if (dicts.TryGetValue(Lang, out var cur)) cur.TryGetValue(key, out s);
            if (s == null && dicts.TryGetValue("en", out var en)) en.TryGetValue(key, out s);
            if (s == null) s = key;
            for (int i = 0; i + 1 < kv.Length; i += 2) s = s.Replace("{" + kv[i] + "}", Convert.ToString(kv[i + 1], System.Globalization.CultureInfo.InvariantCulture));
            return s;
        }

        public static string L(Loc loc)
        {
            if (loc == null) return "";
            var s = Lang == "en" ? loc.en : loc.ru;
            return string.IsNullOrEmpty(s) ? loc.en : s;
        }
    }
}
