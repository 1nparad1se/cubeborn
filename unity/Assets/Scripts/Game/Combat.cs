using System;

namespace Cubeborn
{
    /// <summary>Central damage resolution so crits, statuses, knockback, numbers and kills are consistent.</summary>
    public class Combat
    {
        readonly Run run;
        public Combat(Run run) { this.run = run; }

        /// <summary>
        /// Applies player damage to an enemy. Returns damage dealt (0 if immune).
        /// dirX/dirZ define knockback direction; if zero, pushes away from the player.
        /// </summary>
        public double Hit(Enemy e, DamageInfo info, double mult = 1, double dirX = 0, double dirZ = 0)
        {
            if (!e.alive) return 0;
            var st = run.player.stats;
            if (e.invuln || e.shieldT > 0)
            {
                if (Rand.Value < 0.2) run.fx.Burst(e.x, 1, e.z, 0xa0a0ff, 3, 2, 0.12, 0.3);
                return 0;
            }
            double critChance = info.critChance + st.critChance;
            bool crit = Rand.Value < critChance;
            double dmg = info.damage * st.might * run.player.damageMul * mult;
            if (crit) dmg *= info.critDamage + st.critDamage;
            dmg *= 0.92 + Rand.Value * 0.16;
            if (e.HasElite("armored")) dmg *= 0.7;
            e.hp -= dmg;
            e.flash = 0.1;
            run.stats.AddDamage(info.weaponId, dmg);

            // knockback
            if (info.knockback > 0 && e.kbResist < 1)
            {
                double kx = dirX, kz = dirZ;
                if (kx == 0 && kz == 0) { kx = e.x - run.player.x; kz = e.z - run.player.z; }
                double l = MathX.Hypot(kx, kz);
                if (l == 0) l = 1;
                double f = info.knockback * st.knockback * (1 - e.kbResist) * 5;
                e.kx += (kx / l) * f;
                e.kz += (kz / l) * f;
            }
            // statuses
            if (info.slow > 0)
            {
                e.slowMul = Math.Min(e.slowMul, info.slow);
                e.slowT = Math.Max(e.slowT, info.slowDur * st.duration);
            }
            if (info.freeze > 0 && e.boss == null && Rand.Value < info.freeze)
                e.freezeT = Math.Max(e.freezeT, (info.freezeDur != 0 ? info.freezeDur : 1.5) * st.duration);
            if (info.poison > 0)
            {
                e.poisonDps = Math.Max(e.poisonDps, info.poison * st.might);
                e.poisonT = Math.Max(e.poisonT, info.poisonDur * st.duration);
            }
            if (info.burn > 0)
            {
                e.burnDps = Math.Max(e.burnDps, info.burn * st.might);
                e.burnT = Math.Max(e.burnT, info.burnDur * st.duration);
            }
            if (run.settings.damageNumbers) run.fx.Number(e.x, e.z, dmg, crit);
            run.hitSoundBudget++;
            if (e.hp <= 0) KillEnemy(e);
            return dmg;
        }

        /// <summary>Damage over time / non-weapon damage without crit or knockback.</summary>
        public void ApplyRaw(Enemy e, double dmg, int color, string source)
        {
            if (!e.alive || e.invuln || e.shieldT > 0) return;
            e.hp -= dmg;
            run.stats.AddDamage(source, dmg);
            if (run.settings.damageNumbers) run.fx.Number(e.x, e.z, dmg, false, color);
            if (e.hp <= 0) KillEnemy(e);
        }

        /// <summary>Kills an enemy: rewards, death fx, split/explode effects, perks.</summary>
        public void KillEnemy(Enemy e, bool silent = false)
        {
            if (!e.alive) return;
            var def = e.def;
            run.enemies.StartDying(e);
            bool isProp = def.category == "prop";
            if (e.boss != null)
            {
                e.boss.OnDeath();
                return;
            }
            // death fx: chunks in the enemy's main color
            run.fx.Burst(e.x, 0.6 * e.scale, e.z, run.EnemyColor(def.id), isProp ? 10 : e.elite != null ? 26 : 7, 4 + e.scale, 0.14 * e.scale, 0.7, ParticleKind.Debris);
            if (e.elite != null)
            {
                run.fx.Shake(0.35);
                run.fx.Light(e.x, e.z, 0xffe0a0, 3, 6, 0.4);
            }
            if (isProp)
            {
                run.pickups.DropFromProp(e.x, e.z);
                run.fx.Sound("crate");
                return;
            }
            if (!silent) run.killSoundBudget++;
            run.stats.kills++;
            run.stats.killsBy[def.id] = (run.stats.killsBy.TryGetValue(def.id, out var kb) ? kb : 0) + 1;
            if (!e.noReward)
            {
                if (e.xp > 0) run.pickups.DropXp(e.x, e.z, e.xp);
                run.pickups.RollKillDrops(e);
            }
            if (e.elite != null)
            {
                run.stats.elites++;
                if (Rand.Value < Balance.eliteChestChance) run.pickups.SpawnChest(e.x, e.z);
            }
            if (def.id == "treasure_sprite")
            {
                run.stats.treasureSprites++;
                run.pickups.TreasureBurst(e.x, e.z);
            }
            // lifesteal
            if (run.player.stats.lifesteal > 0) run.player.Heal(run.player.stats.lifesteal, true);
            // splitting
            string splitId = def.splitInto ?? (e.HasElite("splitting") ? def.id : null);
            if (splitId != null && run.enemies.aliveCount < Balance.hardCap)
            {
                int n = (int)def.p.Num("split", 4);
                var child = Content.EnemyById[splitId];
                for (int k = 0; k < n; k++)
                {
                    double a = (double)k / n * MathX.TAU + Rand.Value;
                    var c = run.enemies.Spawn(child, e.x + Math.Cos(a) * 0.6, e.z + Math.Sin(a) * 0.6);
                    if (c != null)
                    {
                        c.kx = Math.Cos(a) * 4;
                        c.kz = Math.Sin(a) * 4;
                        if (e.HasElite("splitting")) c.xp = 1;
                    }
                }
            }
            if (e.HasElite("volatile"))
            {
                run.hazards.Telegraph(e.x, e.z, 3, 0.7);
                run.hazards.DelayedExplosion(e.x, e.z, 3, e.damage, 0.7);
            }
            run.weapons.OnKill(e);
            run.perks.OnKill(e);
        }
    }
}
