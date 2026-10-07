using System;
using System.Collections.Generic;

namespace Cubeborn
{
    public enum RunState { Playing, Levelup, Chest, Dead, Victory }

    public class ChestReward
    {
        public string kind; // evolution | weapon_up | passive_up | gold
        public string id;
        public int level;
        public string from;
    }

    public class ChestResult
    {
        public List<ChestReward> rewards;
        public double gold;
        public int tier;
    }

    public class RunOptions
    {
        public MapDef map;
        public DifficultyDef diff;
        public HeroDef hero;
        public StatMods permanent;
        public HashSet<string> unlockedWeapons, unlockedPassives;
        public IFx fx;
        public RunSettings settings;
        public Func<string, string> tr;
        public long seed = -1;
    }

    public class RunSettings
    {
        public bool damageNumbers = true;
    }

    public class Weather
    {
        public double darkness, blizzard, surge;
    }

    public class WeaponSummary
    {
        public string id;
        public int level;
        public double damage;
    }

    public class RunSummary
    {
        public double time;
        public int kills, level, elites, chests, maxedWeapons, weaponCount, treasureSprites;
        public double gold;
        public List<WeaponSummary> weapons = new List<WeaponSummary>();
        public List<KeyValuePair<string, int>> passives = new List<KeyValuePair<string, int>>();
        public bool victory;
        public List<string> bosses, evolutions, discovered, seen;
    }

    /// <summary>One playthrough of a map: owns every gameplay system and advances the simulation.</summary>
    public class Run
    {
        public readonly MapDef map;
        public readonly DifficultyDef diff;
        public readonly HeroDef hero;
        public readonly Rng rng;
        public readonly long seed;
        public readonly IFx fx;
        public readonly Terrain terrain;
        public readonly NavField nav;
        public readonly RunStats stats = new RunStats();
        public readonly Player player;
        public readonly EnemyManager enemies;
        public readonly Projectiles projectiles;
        public readonly Pickups pickups;
        public readonly Hazards hazards;
        public readonly Allies allies;
        public readonly Effects effects = new Effects();
        public readonly Combat combat;
        public readonly WeaponSystem weapons;
        public readonly Passives passives = new Passives();
        public readonly Leveling leveling;
        public readonly Spawner spawner;
        public readonly Perks perks;
        public readonly List<BossController> bosses = new List<BossController>();
        public readonly HashSet<string> unlockedWeapons, unlockedPassives;
        public readonly RunSettings settings;
        readonly Func<string, string> tr;
        public readonly Weather weather = new Weather();
        public bool debugGod;
        public readonly DamageInfo reviveBlast = new DamageInfo();
        public readonly DamageInfo nukeBlast = new DamageInfo();

        public double time;
        public RunState state = RunState.Playing;
        /// <summary>Real-time slow motion factor (victory/death moments).</summary>
        public double timeScale = 1;
        public List<Choice> pendingChoices;
        readonly StatMods permanent;
        double lastRevivalStat;
        class Timer { public double t; public Action fn; }
        List<Timer> timers = new List<Timer>();
        double endTimer = -1;
        RunState endState = RunState.Playing;
        // budgets let the client limit how many sounds fire per frame
        public int hitSoundBudget, killSoundBudget, xpSoundBudget;

        // events
        public event Action<List<Choice>> OnLevelup;
        public event Action<ChestResult> OnChest;
        public event Action<BossController> OnBossSpawn, OnBossPhase, OnBossDefeated;
        public event Action OnGameover, OnVictory;
        public event Action<string> OnBanner, OnPickup, OnEvolution;

        public void EmitBossSpawn(BossController b) => OnBossSpawn?.Invoke(b);
        public void EmitBossPhase(BossController b) => OnBossPhase?.Invoke(b);
        public void EmitBossDefeated(BossController b) => OnBossDefeated?.Invoke(b);
        public void EmitBanner(string key) => OnBanner?.Invoke(key);
        public void EmitPickup(string kind) => OnPickup?.Invoke(kind);

        public string Tr(string key) => tr != null ? tr(key) : key;

        public Run(RunOptions o)
        {
            map = o.map;
            diff = o.diff;
            hero = o.hero;
            seed = o.seed >= 0 ? o.seed : (long)(Rand.Value * 1e9);
            rng = new Rng(seed);
            fx = o.fx ?? NullFx.I;
            settings = o.settings ?? new RunSettings();
            tr = o.tr;
            permanent = o.permanent ?? new StatMods();
            unlockedWeapons = o.unlockedWeapons;
            unlockedPassives = o.unlockedPassives;
            unlockedWeapons.Add(o.hero.startWeapon);
            terrain = Generators.GenerateTerrain(o.map, seed);
            nav = new NavField(terrain);
            double c = o.map.size / 2 + 0.5;
            player = new Player(this, c, c);
            RecomputeStats();
            player.hp = player.stats.maxHp;
            player.revivals = (int)player.stats.revival;
            player.shield = o.hero.perk == "bastion";
            enemies = new EnemyManager(this);
            projectiles = new Projectiles(this);
            pickups = new Pickups(this);
            hazards = new Hazards(this);
            allies = new Allies(this);
            combat = new Combat(this);
            weapons = new WeaponSystem(this);
            leveling = new Leveling(this);
            leveling.InitCounters();
            spawner = new Spawner(this);
            perks = new Perks(this, o.hero.perk);
            weapons.Add(o.hero.startWeapon);
            stats.discovered.Add(o.hero.startWeapon);
            nav.Update(0, player.x, player.z, true);
            reviveBlast.damage = 200;
            reviveBlast.knockback = 4;
            reviveBlast.weaponId = "revive";
            nukeBlast.damage = 400;
            nukeBlast.knockback = 2;
            nukeBlast.weaponId = "nuke";
        }

        /// <summary>Recomputes player stats from hero, permanent upgrades, passives.</summary>
        public void RecomputeStats()
        {
            var p = player;
            double oldMax = p.stats?.maxHp ?? 0;
            var mods = PlayerStats.Sum(hero.stats, permanent, passives.Mods());
            p.stats = PlayerStats.Resolve(hero.baseHp, mods);
            if (oldMax > 0 && p.stats.maxHp > oldMax) p.hp += p.stats.maxHp - oldMax;
            double newRev = p.stats.revival;
            if (oldMax > 0 && newRev > lastRevivalStat) p.revivals += (int)(newRev - lastRevivalStat);
            lastRevivalStat = newRev;
        }

        public void Later(double delay, Action fn) => timers.Add(new Timer { t = time + delay, fn = fn });

        public int EnemyColor(string id) => Content.ModelMainColor(id);

        public void SpawnFallingRock(double x, double z, double t, int color)
        {
            var e = effects.Add(EffectKind.Fall, x, z, t, color);
            e.r = 1;
        }

        public bool isFinalPhase => spawner.bossSpawnedFlag;

        public void Update(double dt, double ix, double iz)
        {
            if (endTimer >= 0)
            {
                // slow-motion ending
                endTimer -= dt;
                dt *= timeScale;
                if (endTimer < 0)
                {
                    state = endState;
                    if (state == RunState.Victory) OnVictory?.Invoke();
                    else OnGameover?.Invoke();
                    return;
                }
            }
            if (state != RunState.Playing) return;
            time += dt;
            var p = player;
            if (weather.darkness > 0) weather.darkness -= dt;
            if (weather.blizzard > 0) weather.blizzard -= dt;
            if (weather.surge > 0) weather.surge -= dt;
            if (!p.dead) p.Update(dt, ix, iz);
            nav.Update(dt, p.x, p.z);
            SurgeBuff();
            // timers
            if (timers.Count > 0)
            {
                double now = time;
                List<Timer> due = null;
                foreach (var t in timers) if (t.t <= now) (due ?? (due = new List<Timer>())).Add(t);
                if (due != null)
                {
                    timers = timers.FindAll(t => t.t > now);
                    foreach (var t in due) t.fn();
                }
            }
            if (!p.dead)
            {
                spawner.Update(dt);
                weapons.Update(dt);
                perks.Update(dt);
            }
            enemies.Update(dt);
            projectiles.Update(dt);
            allies.Update(dt);
            hazards.Update(dt);
            pickups.Update(dt);
            effects.Update(dt, p.x, p.z);
            int maxed = 0;
            foreach (var w in weapons.list) if (w.isMax) maxed++;
            stats.maxedWeapons = Math.Max(stats.maxedWeapons, maxed);
            if (p.pendingLevels > 0 && state == RunState.Playing && !p.dead && endTimer < 0) BeginLevelUp();
        }

        void SurgeBuff()
        {
            // arcane surge: standing in a rune circle empowers the hero
            if (weather.surge <= 0) return;
            var p = player;
            foreach (var m in terrain.markers)
            {
                if (m.kind == "rune" && (m.x - p.x) * (m.x - p.x) + (m.z - p.z) * (m.z - p.z) < 9)
                {
                    p.buffs.fury = Math.Max(p.buffs.fury, 0.3);
                    return;
                }
            }
        }

        // ---------------------------------------------------------------- level up
        void BeginLevelUp()
        {
            state = RunState.Levelup;
            pendingChoices = leveling.Roll();
            fx.Sound("levelup");
            fx.Burst(player.x, 1, player.z, 0x8affff, 30, 4, 0.16, 0.8);
            OnLevelup?.Invoke(pendingChoices);
        }

        public void Choose(Choice c)
        {
            if (state != RunState.Levelup) return;
            if (c != null) leveling.Apply(c);
            player.pendingLevels--;
            pendingChoices = null;
            state = RunState.Playing;
            if (player.pendingLevels > 0) BeginLevelUp();
        }

        public List<Choice> Reroll()
        {
            if (leveling.rerolls <= 0 || state != RunState.Levelup) return null;
            leveling.rerolls--;
            pendingChoices = leveling.Roll();
            return pendingChoices;
        }

        public void Skip()
        {
            if (leveling.skips <= 0) return;
            leveling.skips--;
            stats.gold += 5;
            Choose(null);
        }

        public List<Choice> Banish(string id)
        {
            if (leveling.banishes <= 0 || state != RunState.Levelup) return null;
            leveling.banishes--;
            leveling.banished.Add(id);
            pendingChoices = leveling.Roll();
            return pendingChoices;
        }

        // ---------------------------------------------------------------- chests
        public void OpenChest(int tier)
        {
            var rewards = new List<ChestReward>();
            double luck = player.stats.luck;
            int count = tier >= 1 ? 3 : 1;
            double r = rng.Next();
            if (r < 0.04 * luck) count = 5;
            else if (r < 0.18 * luck) count = Math.Max(count, 3);
            if (tier >= 1 && rng.Chance(0.3 * luck)) count = 5;
            var used = new HashSet<string>();
            for (int i = 0; i < count; i++)
            {
                var evo = weapons.Evolvable().Find(w => !used.Contains(w.def.id));
                if (evo != null)
                {
                    used.Add(evo.def.id);
                    var nw = weapons.Evolve(evo);
                    rewards.Add(new ChestReward { kind = "evolution", id = nw.def.id, level = 1, from = evo.def.id });
                    stats.evolutions.Add(nw.def.id);
                    stats.discovered.Add(nw.def.id);
                    OnEvolution?.Invoke(nw.def.id);
                    continue;
                }
                var ups = new List<ChestReward>();
                foreach (var w in weapons.list) if (!w.isMax && !w.def.evolved) ups.Add(new ChestReward { kind = "weapon_up", id = w.def.id, level = w.level + 1 });
                foreach (var kv in passives.levels) if (kv.Value < Content.PassiveById[kv.Key].maxLevel) ups.Add(new ChestReward { kind = "passive_up", id = kv.Key, level = kv.Value + 1 });
                if (ups.Count > 0)
                {
                    var pick = rng.Pick(ups);
                    if (pick.kind == "weapon_up") weapons.Get(pick.id).LevelUp();
                    else
                    {
                        passives.Add(pick.id);
                        RecomputeStats();
                    }
                    rewards.Add(pick);
                }
                else rewards.Add(new ChestReward { kind = "gold", id = "gold", level = 0 });
            }
            int goldCount = rewards.FindAll(x => x.kind == "gold").Count;
            double gold = MathX.Round((20 + rng.Int(0, 40) + (tier >= 1 ? 100 : 0) + goldCount * 50) * player.stats.greed);
            stats.gold += gold;
            stats.chests++;
            player.Heal(player.stats.maxHp * 0.1 * perks.HealMul(), true);
            state = RunState.Chest;
            fx.Sound("chestOpen");
            OnChest?.Invoke(new ChestResult { rewards = rewards, gold = gold, tier = tier });
        }

        public void CloseChest()
        {
            if (state == RunState.Chest) state = RunState.Playing;
        }

        // ---------------------------------------------------------------- ending
        public void OnPlayerDeath()
        {
            if (endTimer >= 0) return;
            fx.Sound("death");
            fx.Burst(player.x, 1, player.z, hero.color, 50, 6, 0.2, 1.2, ParticleKind.Debris);
            fx.Shake(0.6);
            fx.Vibrate(300);
            endState = RunState.Dead;
            endTimer = 1.6;
            timeScale = 0.25;
        }

        public void OnFinalBossDefeated()
        {
            if (endTimer >= 0) return;
            endState = RunState.Victory;
            endTimer = 2.5;
            timeScale = 0.3;
            hazards.ClearAll();
            // remaining enemies flee into dust
            for (int i = 0; i < enemies.list.Count; i++)
            {
                var e = enemies.list[i];
                if (e.alive && e.boss == null) combat.KillEnemy(e, true);
            }
            fx.Sound("victory");
        }

        public bool ending => endTimer >= 0;

        /// <summary>Summary used by the results screen and meta progression.</summary>
        public RunSummary Summary()
        {
            var p = player;
            var s = new RunSummary
            {
                time = time, kills = stats.kills, level = p.level, gold = MathX.Round(stats.gold),
                victory = state == RunState.Victory || endState == RunState.Victory,
                bosses = new List<string>(stats.bossesKilled), evolutions = new List<string>(stats.evolutions),
                elites = stats.elites, chests = stats.chests, maxedWeapons = stats.maxedWeapons, weaponCount = weapons.list.Count,
                treasureSprites = stats.treasureSprites, discovered = new List<string>(stats.discovered), seen = new List<string>(stats.seen),
            };
            foreach (var w in weapons.list)
                s.weapons.Add(new WeaponSummary { id = w.def.id, level = w.level, damage = MathX.Round(stats.damageBy.TryGetValue(w.def.id, out var d) ? d : 0) });
            foreach (var kv in passives.levels) s.passives.Add(kv);
            return s;
        }

        public static double GoldReward(RunSummary summary, double diffReward)
        {
            double bas = summary.gold + summary.kills * Balance.goldPerKill + (summary.time / 60) * Balance.goldPerMinute + summary.bosses.Count * Balance.goldBossBonus + (summary.victory ? Balance.goldVictoryBonus : 0);
            return MathX.Round(bas * diffReward);
        }
    }
}
