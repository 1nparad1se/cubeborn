using System;
using System.Collections.Generic;

namespace Cubeborn
{
    /// <summary>Code side of a weapon mechanic. One behaviour serves a base weapon and its evolution.</summary>
    public class WeaponBehavior
    {
        /// <summary>Called when cooldown elapses.</summary>
        public Action<WeaponInstance, Run> fire;
        /// <summary>Called every frame (persistent effects).</summary>
        public Action<WeaponInstance, Run, double> update;
        public Action<WeaponInstance, Run> onAdd, onRemove;
        public Action<WeaponInstance, Run, Enemy> onKill;
        public Func<WeaponInstance, Run, Projectile, double, bool> projectileUpdate;
        public Action<WeaponInstance, Run, Projectile, Enemy> projectileHit;
        public Action<WeaponInstance, Run, Projectile> projectileExpire;

        static readonly Dictionary<string, WeaponBehavior> REGISTRY = new Dictionary<string, WeaponBehavior>();

        public static void Register(string key, WeaponBehavior b) => REGISTRY[key] = b;

        public static WeaponBehavior Get(string key)
        {
            if (REGISTRY.Count == 0) Behaviors.RegisterAll();
            if (!REGISTRY.TryGetValue(key, out var b)) throw new Exception("Unknown weapon behavior: " + key);
            return b;
        }
    }

    public class BeamState
    {
        public Effect ef;
        public double angle, t;
        public int idx;
    }

    public class Wave
    {
        public double t, dur, r, x, z;
    }

    /// <summary>A weapon owned by the player during a run.</summary>
    public class WeaponInstance
    {
        public WeaponDef def;
        public int source;
        public int level = 1;
        public WStats stats;
        public double cdT = 0.3;
        public readonly DamageInfo dmg = new DamageInfo();
        public WeaponBehavior behavior;
        public int kills;

        // behaviour scratch state
        public double stRot, stBloomCd;
        public List<Projectile> stProjs;
        public List<BeamState> stBeams;
        public List<Wave> stWaves;
        public Effect stEf;
        public Projectile stEye;

        public WeaponInstance(WeaponDef def, int source)
        {
            this.def = def;
            this.source = source;
            behavior = WeaponBehavior.Get(def.behavior);
            stats = def.@base.Clone();
            RefreshDamage();
        }

        public int maxLevel => def.evolved ? 1 : Content.WeaponMaxLevel;
        public bool isMax => level >= maxLevel;
        public bool evo => stats["evo"] != 0;

        public void LevelUp()
        {
            if (isMax) return;
            var delta = level - 1 < def.levels.Count ? def.levels[level - 1] : null;
            level++;
            if (delta != null) foreach (var kv in delta.v) stats[kv.Key] = stats[kv.Key] + kv.Value;
            RefreshDamage();
        }

        public void RefreshDamage()
        {
            var s = stats;
            var d = dmg;
            d.damage = s.damage;
            d.critChance = s.critChance;
            d.critDamage = s.critDamage;
            d.knockback = s.knockback;
            d.source = source;
            d.weaponId = def.id;
            d.slow = s.Get("slow", 0);
            d.slowDur = s.Get("slowDur", 0);
            d.freeze = s.Get("freeze", 0);
            d.freezeDur = s.Get("freezeDur", 1.5);
            d.poison = s.Get("poison", 0);
            d.poisonDur = s.Get("poisonDur", 0);
            d.burn = s.Get("burn", 0);
            d.burnDur = s.Get("burnDur", 0);
        }

        // ---- effective values with player modifiers
        public int Amount(Run run) => Math.Max(1, MathX.RoundI(stats.amount + run.player.stats.amount));
        public double Area(Run run) => stats.area * run.player.stats.area;
        public double Speed(Run run) => stats.projSpeed * run.player.stats.projSpeed;
        public double Duration(Run run) => stats.duration * run.player.stats.duration;
        public int Pierce(Run run) => stats.pierce < 0 ? -1 : (int)(stats.pierce + run.player.stats.pierce);
        public double Cooldown(Run run)
        {
            double frenzy = run.player.buffs.frenzy > 0 ? 0.6 : 1;
            return Math.Max(0.05, (stats.cooldown * run.player.stats.cooldown * frenzy) / Math.Max(0.1, stats.attackSpeed));
        }
        public double P(string key, double def = 0) => stats.Get(key, def);
    }

    /// <summary>Holds the player's weapons and drives them each frame.</summary>
    public class WeaponSystem
    {
        public readonly List<WeaponInstance> list = new List<WeaponInstance>();
        int nextSource = 1;
        readonly Run run;

        public WeaponSystem(Run run) { this.run = run; }

        public bool Has(string id) => list.Exists(w => w.def.id == id);
        public WeaponInstance Get(string id) => list.Find(w => w.def.id == id);

        public WeaponInstance Add(string id)
        {
            var def = Content.WeaponById[id];
            var w = new WeaponInstance(def, nextSource++ % 23 + 1);
            list.Add(w);
            w.behavior.onAdd?.Invoke(w, run);
            run.stats.weaponsUsed.Add(id);
            return w;
        }

        /// <summary>Replaces a maxed weapon with its evolution, keeping the slot.</summary>
        public WeaponInstance Evolve(WeaponInstance w)
        {
            var into = w.def.evoInto;
            if (into == null) return null;
            w.behavior.onRemove?.Invoke(w, run);
            var def = Content.WeaponById[into];
            var nw = new WeaponInstance(def, w.source) { kills = w.kills };
            int i = list.IndexOf(w);
            list[i] = nw;
            nw.behavior.onAdd?.Invoke(nw, run);
            run.stats.weaponsUsed.Add(into);
            return nw;
        }

        /// <summary>Weapons ready to evolve (maxed + required passive owned).</summary>
        public List<WeaponInstance> Evolvable() => list.FindAll(w => w.isMax && w.def.evoInto != null && run.passives.Has(w.def.evoPassive));

        public void Update(double dt)
        {
            for (int i = 0; i < list.Count; i++)
            {
                var w = list[i];
                w.behavior.update?.Invoke(w, run, dt);
                w.cdT -= dt;
                if (w.cdT <= 0)
                {
                    w.cdT += w.Cooldown(run);
                    if (w.cdT < 0) w.cdT = w.Cooldown(run);
                    w.behavior.fire(w, run);
                }
            }
        }

        public void OnKill(Enemy e)
        {
            for (int i = 0; i < list.Count; i++) list[i].behavior.onKill?.Invoke(list[i], run, e);
        }

        public void Clear()
        {
            foreach (var w in list) w.behavior.onRemove?.Invoke(w, run);
            list.Clear();
        }
    }

    /// <summary>Shared helpers for behaviours.</summary>
    public static class WUtil
    {
        public struct Aim
        {
            public double x, z;
            public Enemy target;
        }

        /// <summary>Resolves a firing direction for the weapon's targeting mode.</summary>
        public static Aim DoAim(WeaponInstance w, Run run, double range = 14)
        {
            var p = run.player;
            Enemy t = null;
            switch (w.def.targeting)
            {
                case "nearest": t = run.enemies.Nearest(p.x, p.z, range); break;
                case "random": t = run.enemies.RandomInRadius(p.x, p.z, range); break;
                case "strongest": t = run.enemies.Strongest(p.x, p.z, range); break;
            }
            if (t != null)
            {
                double dx = t.x - p.x, dz = t.z - p.z;
                double d = MathX.Hypot(dx, dz);
                if (d == 0) d = 1;
                return new Aim { x = dx / d, z = dz / d, target = t };
            }
            if (w.def.targeting == "random")
            {
                double a = run.rng.Next() * MathX.TAU;
                return new Aim { x = Math.Cos(a), z = Math.Sin(a) };
            }
            return new Aim { x = p.fx, z = p.fz };
        }

        /// <summary>Point to drop area attacks on: an enemy cluster, else random near the player.</summary>
        public static void GroundTarget(Run run, double range, out double x, out double z)
        {
            var p = run.player;
            if (run.enemies.Cluster(p.x, p.z, range, out x, out z)) return;
            double a = run.rng.Next() * MathX.TAU;
            double r = 3 + run.rng.Next() * 5;
            x = p.x + Math.Cos(a) * r;
            z = p.z + Math.Sin(a) * r;
        }

        /// <summary>Damages enemies in a circle. Returns number hit.</summary>
        public static int HitCircle(Run run, WeaponInstance w, double x, double z, double r, double mult = 1, double rehit = 0)
        {
            int n = 0;
            double time = run.time;
            run.enemies.ForEachInRadius(x, z, r, e =>
            {
                if (rehit > 0)
                {
                    if (time - e.lastHit[w.source] < rehit) return false;
                    e.lastHit[w.source] = time;
                }
                run.combat.Hit(e, w.dmg, mult, e.x - x, e.z - z);
                n++;
                return false;
            });
            return n;
        }

        /// <summary>Damages enemies along a segment.</summary>
        public static int HitLine(Run run, WeaponInstance w, double x0, double z0, double x1, double z1, double width, double mult = 1, double rehit = 0)
        {
            int n = 0;
            double cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
            double half = MathX.Hypot(x1 - x0, z1 - z0) / 2;
            double dirX = x1 - x0, dirZ = z1 - z0;
            double time = run.time;
            run.enemies.ForEachInRadius(cx, cz, half + width, e =>
            {
                double rr = width / 2 + e.radius;
                if (MathX.SegDist2(e.x, e.z, x0, z0, x1, z1) > rr * rr) return false;
                if (rehit > 0)
                {
                    if (time - e.lastHit[w.source] < rehit) return false;
                    e.lastHit[w.source] = time;
                }
                run.combat.Hit(e, w.dmg, mult, dirX, dirZ);
                n++;
                return false;
            });
            return n;
        }

        public static void ExplosionFx(Run run, double x, double z, double r, int color, double shake = 0.12)
        {
            run.fx.Burst(x, 0.5, z, color, (int)Math.Ceiling(Math.Min(40, 10 + r * 6)), 3 + r * 2, 0.2, 0.55);
            run.fx.Burst(x, 0.4, z, 0x2a2a2a, 6, 2, 0.3, 0.8, ParticleKind.Smoke);
            run.fx.Light(x, z, color, 3, r * 3.5, 0.3);
            var e = run.effects.Add(EffectKind.Flash, x, z, 0.3, color);
            e.r = r;
            if (shake > 0) run.fx.Shake(shake);
        }
    }
}
