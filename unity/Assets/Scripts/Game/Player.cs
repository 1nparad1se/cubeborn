using System;

namespace Cubeborn
{
    public class Buffs
    {
        public double fury, haste, aegis, frenzy;
    }

    /// <summary>The hero during a run: movement, health, experience and temporary buffs.</summary>
    public class Player
    {
        public double x, z, vx, vz, fx, fz = 1;
        public double radius = 0.38;
        public double hp = 100;
        public PlayerStats stats;
        public int level = 1;
        public double xp;
        public double xpNext = Balance.XpForLevel(1);
        public int pendingLevels;
        public double invulnT, hurtT;
        public bool dead;
        public int revivals;
        /// <summary>Extra damage multiplier from buffs and perks.</summary>
        public double damageMul = 1;
        public bool moving;
        public double anim, attackPulse;
        public readonly Buffs buffs = new Buffs();
        /// <summary>Bastion perk shield.</summary>
        public bool shield;
        public double slowT, pullX, pullZ, hazardTick;
        /// <summary>Extra speed burst (wind way perk).</summary>
        public double burstT;
        public double regenAcc;
        readonly Run run;

        public Player(Run run, double x, double z)
        {
            this.run = run;
            this.x = x;
            this.z = z;
        }

        public double moveSpeed
        {
            get
            {
                double s = run.hero.baseSpeed * stats.moveSpeed;
                if (buffs.haste > 0) s *= 1.4;
                if (burstT > 0) s *= 1.35;
                if (slowT > 0) s *= 0.6;
                if (run.weather.blizzard > 0) s *= 0.85;
                return s;
            }
        }

        public void Update(double dt, double ix, double iz)
        {
            var t = run.terrain;
            if (invulnT > 0) invulnT -= dt;
            if (hurtT > 0) hurtT -= dt;
            if (slowT > 0) slowT -= dt;
            if (burstT > 0) burstT -= dt;
            if (attackPulse > 0) attackPulse -= dt;
            if (buffs.fury > 0) buffs.fury -= dt;
            if (buffs.haste > 0) buffs.haste -= dt;
            if (buffs.aegis > 0) buffs.aegis -= dt;
            if (buffs.frenzy > 0) buffs.frenzy -= dt;
            damageMul = (buffs.fury > 0 ? 1.5 : 1) * run.perks.DamageMul();

            double len = MathX.Hypot(ix, iz);
            if (len > 1) { ix /= len; iz /= len; }
            moving = len > 0.08;
            if (moving)
            {
                double l = MathX.Hypot(ix, iz);
                fx = ix / l;
                fz = iz / l;
            }
            double speed = moveSpeed;
            bool onIce = t.CellAt(x, z) == CELL.ice;
            double tx = ix * speed, tz = iz * speed;
            double accel = onIce ? 2.2 : 30;
            double k = 1 - Math.Exp(-accel * dt);
            vx += (tx - vx) * k;
            vz += (tz - vz) * k;
            double mx = (vx + pullX) * dt, mz = (vz + pullZ) * dt;
            pullX *= Math.Exp(-3 * dt);
            pullZ *= Math.Exp(-3 * dt);
            MoveWithTerrain(mx, mz);
            if (moving || MathX.Hypot(vx, vz) > 0.3) anim += dt * speed * 2.2;
            else anim += dt;

            // hazard tiles
            int cell = t.CellAt(x, z);
            if (cell == CELL.hazard)
            {
                hazardTick -= dt;
                if (hazardTick <= 0)
                {
                    hazardTick = 0.5;
                    double hd = run.map.hazardDps != 0 ? run.map.hazardDps : 8;
                    Hurt(hd * 0.5 * run.diff.damage, null, true);
                }
            }
            // regeneration
            double regen = stats.regen * (run.diff.id == "inferno" ? 0.5 : 1);
            if (regen > 0 && hp < stats.maxHp)
            {
                regenAcc += regen * dt;
                if (regenAcc >= 1)
                {
                    Heal(Math.Floor(regenAcc), true);
                    regenAcc -= Math.Floor(regenAcc);
                }
            }
        }

        void MoveWithTerrain(double mx, double mz)
        {
            var t = run.terrain;
            double r = radius;
            double nx = x + mx;
            int cx0 = (int)Math.Floor(z - r * 0.8), cx1 = (int)Math.Floor(z + r * 0.8);
            int edgeX = (int)Math.Floor(nx + (mx > 0 ? r : -r));
            if (!t.BlocksWalker(edgeX, cx0) && !t.BlocksWalker(edgeX, cx1)) x = nx;
            else vx = 0;
            double nz = z + mz;
            int r0 = (int)Math.Floor(x - r * 0.8), r1 = (int)Math.Floor(x + r * 0.8);
            int edgeZ = (int)Math.Floor(nz + (mz > 0 ? r : -r));
            if (!t.BlocksWalker(r0, edgeZ) && !t.BlocksWalker(r1, edgeZ)) z = nz;
            else vz = 0;
            x = MathX.Clamp(x, 1, t.size - 1);
            z = MathX.Clamp(z, 1, t.size - 1);
        }

        /// <summary>Applies incoming damage. Returns damage actually taken.</summary>
        public double Hurt(double raw, Enemy source, bool ignoreInvuln = false)
        {
            if (dead || run.debugGod) return 0;
            if (!ignoreInvuln && invulnT > 0) return 0;
            if (buffs.aegis > 0) return 0;
            if (stats.dodge > 0 && Rand.Value < stats.dodge)
            {
                run.fx.Text(x, z, run.Tr("dodge"), 0xc1e8ff);
                run.perks.OnDodge();
                return 0;
            }
            if (shield)
            {
                shield = false;
                run.perks.OnShieldBreak();
                run.fx.Burst(x, 1, z, 0x8ad0ff, 18, 4, 0.16, 0.5);
                run.fx.Sound("shield");
                invulnT = 0.4;
                return 0;
            }
            double dmg = Math.Max(Balance.armorMin, raw - stats.armor);
            hp -= dmg;
            hurtT = 0.25;
            if (!ignoreInvuln) invulnT = Balance.hurtInvuln;
            run.stats.damageTaken += dmg;
            run.fx.Number(x, z, dmg, false, 0xff4040);
            run.fx.Sound("hurt");
            run.fx.Vibrate(25);
            run.fx.Shake(0.15);
            if (source != null && stats.thorns > 0) run.combat.ApplyRaw(source, raw * stats.thorns * stats.might, 0xb0e070, "thorns");
            if (hp <= 0) OnLethal();
            return dmg;
        }

        void OnLethal()
        {
            if (revivals > 0)
            {
                revivals--;
                hp = stats.maxHp * 0.5;
                invulnT = 3;
                run.fx.Burst(x, 1, z, 0xffa040, 60, 7, 0.22, 1.2);
                run.fx.Light(x, z, 0xffa040, 5, 10, 1);
                run.fx.Sound("revive");
                run.fx.Text(x, z, run.Tr("revived"), 0xffc060);
                // clear nearby threats
                run.hazards.ClearNear(x, z, 8);
                run.enemies.ForEachInRadius(x, z, 6, e =>
                {
                    if (e.boss == null) run.combat.Hit(e, run.reviveBlast, 1);
                    return false;
                });
                return;
            }
            hp = 0;
            dead = true;
            run.OnPlayerDeath();
        }

        public void Heal(double amount, bool quiet = false)
        {
            if (dead) return;
            double mul = run.diff.id == "inferno" ? 0.5 : 1;
            double before = hp;
            hp = Math.Min(stats.maxHp, hp + amount * mul);
            double healed = hp - before;
            if (!quiet && healed > 0.5) run.fx.Number(x, z, healed, false, 0x6bff8a);
        }

        public void AddXp(double v)
        {
            xp += v * stats.growth;
            while (xp >= xpNext)
            {
                xp -= xpNext;
                level++;
                pendingLevels++;
                xpNext = Balance.XpForLevel(level);
            }
        }
    }
}
