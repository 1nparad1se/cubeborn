using System;
using System.Collections.Generic;

namespace Cubeborn
{
    /// <summary>Hero-specific passive abilities.</summary>
    public class Perks
    {
        double shieldT, staticT;
        int raised;
        readonly DamageInfo dmg = new DamageInfo();
        readonly Run run;
        public readonly string id;
        readonly HashSet<int> seen = new HashSet<int>();

        public Perks(Run run, string id)
        {
            this.run = run;
            this.id = id;
            dmg.source = 0;
            dmg.weaponId = "perk";
            dmg.knockback = 1;
            dmg.critChance = 0.05;
            dmg.critDamage = 1.5;
        }

        public void Update(double dt)
        {
            var p = run.player;
            if (id == "bastion" && !p.shield)
            {
                shieldT += dt;
                if (shieldT >= 10)
                {
                    shieldT = 0;
                    p.shield = true;
                    run.fx.Burst(p.x, 1, p.z, 0x8ad0ff, 10, 2, 0.12, 0.4);
                }
            }
            if (id == "static")
            {
                if (p.moving) staticT += dt;
                if (staticT >= 3)
                {
                    staticT = 0;
                    dmg.damage = 14 + p.level * 1.6;
                    double fx = p.x, fz = p.z;
                    seen.Clear();
                    for (int i = 0; i < 4; i++)
                    {
                        var e = run.enemies.Nearest(fx, fz, i == 0 ? 8 : 4, seen);
                        if (e == null) break;
                        seen.Add(e.uid);
                        var ef = run.effects.Add(EffectKind.Bolt, fx, fz, 0.2, 0x4ad0ff);
                        ef.x2 = e.x;
                        ef.z2 = e.z;
                        ef.y = 0.9;
                        ef.w = 0.12;
                        run.combat.Hit(e, dmg);
                        fx = e.x;
                        fz = e.z;
                    }
                    run.fx.Sound("zap", 0.4);
                }
            }
        }

        public double DamageMul()
        {
            if (id == "kindling") return 1 + Math.Min(0.6, run.player.level * 0.015);
            return 1;
        }

        public double HealMul() => id == "grace" ? 2 : 1;

        public void OnKill(Enemy e)
        {
            if (id == "raise_dead" && !e.isAlly && run.rng.Chance(0.04) && run.allies.Count(-1) < 8)
            {
                dmg.damage = 8 + run.player.level * 0.8;
                run.allies.Spawn(e.x, e.z, 10, 6, dmg, 0.6, "ally_risen", -1, 0.9);
                raised++;
            }
            if (id == "volatile" && e.poisonT > 0)
            {
                dmg.damage = 6 + run.player.level * 1.5;
                run.enemies.ForEachInRadius(e.x, e.z, 1.8, o =>
                {
                    run.combat.Hit(o, dmg, 1, o.x - e.x, o.z - e.z);
                    return false;
                });
                run.fx.Burst(e.x, 0.5, e.z, 0x9cff4f, 10, 4, 0.16, 0.4);
                var ef = run.effects.Add(EffectKind.Flash, e.x, e.z, 0.25, 0x9cff4f);
                ef.r = 1.8;
            }
        }

        public void OnDodge()
        {
            if (id == "wind_way") run.player.burstT = 1.5;
        }

        public void OnShieldBreak() => shieldT = 0;
    }
}
