using System;
using System.Collections.Generic;

namespace Cubeborn
{
    /// <summary>Drives one boss enemy: phases, movement and attack scheduling.</summary>
    public partial class BossController
    {
        static readonly Dictionary<string, EnemyDef> bossDefs = new Dictionary<string, EnemyDef>();

        /// <summary>Synthetic enemy definition so a boss can live in the enemy pool.</summary>
        public static EnemyDef BossEnemyDef(BossDef def)
        {
            if (bossDefs.TryGetValue(def.id, out var d)) return d;
            return bossDefs[def.id] = new EnemyDef
            {
                id = def.id, name = def.name, category = "special", behavior = "chase", hp = def.hp, damage = def.damage, speed = 0,
                radius = def.radius, size = 1, xp = 150, kbResist = 1, model = def.model, flying = def.flying, p = new Params(null),
            };
        }

        public int phase;
        public double[] cds = new double[0];
        /// <summary>Seconds before another attack may start.</summary>
        public double busy = 1.5;
        // durational attack state
        public double spiralT, spiralAngle, spiralAcc;
        public Params spiralAttack;
        public int dashLeft;
        /// <summary>0 idle, 1 telegraphing, 2 charging</summary>
        public int dashPhase;
        public double dashTele = 0.7, dashT, dashX, dashZ, dashSpeed;
        public double pullT, pullStrength;
        public List<Enemy> crystals = new List<Enemy>();
        public double wanderX, wanderZ, wanderT, hidden, anim;
        /// <summary>Visual cue for the renderer (0..1) while casting.</summary>
        public double cast;
        public double dashDist = 10;

        public readonly Run run;
        public readonly Enemy e;
        public readonly BossDef def;
        public readonly bool isFinal, isClone;

        public BossController(Run run, Enemy e, BossDef def, bool isFinal, bool isClone = false)
        {
            this.run = run;
            this.e = e;
            this.def = def;
            this.isFinal = isFinal;
            this.isClone = isClone;
            EnterPhase(0);
        }

        public static BossController Spawn(Run run, string id, double x, double z, bool isFinal, double hpMul = 1, bool isClone = false)
        {
            if (id == null || !Content.BossById.TryGetValue(id, out var def)) return null;
            var e = run.enemies.Spawn(BossEnemyDef(def), x, z, noScale: true);
            if (e == null) return null;
            // re-skin the pooled enemy as the boss
            e.maxHp = e.hp = def.hp * Balance.bossHpMul * run.diff.hp * hpMul * (1 + (run.player.stats.curse - 1) * 0.5);
            e.damage = def.damage * run.diff.damage;
            e.speed = 0;
            e.radius = def.radius;
            e.scale = 1;
            e.kbResist = 1;
            e.xp = isClone ? 20 : 150;
            e.flying = def.flying;
            var c = new BossController(run, e, def, isFinal, isClone);
            e.boss = c;
            run.bosses.Add(c);
            return c;
        }

        public BossPhase phaseDef => def.phases[phase];

        double[] InitCds(BossPhase ph)
        {
            var r = new double[ph.attacks.Count];
            for (int k = 0; k < r.Length; k++) r[k] = ph.attacks[k].Num("cd") * 0.5 + k * 0.7;
            return r;
        }

        void EnterPhase(int i)
        {
            phase = i;
            var ph = def.phases[i];
            cds = InitCds(ph);
            if (i > 0)
            {
                busy = 1.2;
                run.fx.Shake(0.4);
                run.fx.Burst(e.x, 1.5, e.z, def.color, 40, 6, 0.25, 0.9);
                run.fx.Sound("bossPhase");
                run.EmitBossPhase(this);
            }
            foreach (var a in ph.onEnter) RunAttack(a);
        }

        public void Update(double dt)
        {
            var p = run.player;
            anim += dt;
            if (cast > 0) cast -= dt * 2;
            // phase transitions
            double frac = e.hp / e.maxHp;
            var next = phase + 1 < def.phases.Count ? def.phases[phase + 1] : null;
            if (next != null && frac <= next.hp && !isClone) EnterPhase(phase + 1);
            // shield crystals
            if (crystals.Count > 0)
            {
                crystals.RemoveAll(c => !(c.alive && c.def.id == "shield_crystal"));
                e.invuln = crystals.Count > 0;
            }
            if (hidden > 0)
            {
                hidden -= dt;
                e.vx = e.vz = 0;
                if (hidden <= 0)
                {
                    e.invuln = crystals.Count > 0;
                    run.hazards.Explode(e.x, e.z, 2.6, e.damage, def.color);
                }
                return;
            }
            if (pullT > 0)
            {
                pullT -= dt;
                double dx = e.x - p.x, dz = e.z - p.z;
                double d = MathX.Hypot(dx, dz);
                if (d == 0) d = 1;
                p.pullX = (dx / d) * pullStrength;
                p.pullZ = (dz / d) * pullStrength;
            }
            // spiral emission
            if (spiralT > 0 && spiralAttack != null)
            {
                var a = spiralAttack;
                spiralT -= dt;
                spiralAcc += dt * a.Num("rate");
                spiralAngle += a.Num("turn", 60) * Math.PI / 180 * dt;
                int arms = (int)a.Num("arms", 4);
                bool slow = a.Num("slow") != 0;
                while (spiralAcc >= 1)
                {
                    spiralAcc--;
                    for (int k = 0; k < arms; k++)
                    {
                        double ang = spiralAngle + (double)k / arms * MathX.TAU;
                        double sp = a.Num("speed", 5);
                        run.hazards.Bullet(e.x, e.z, Math.Cos(ang) * sp, Math.Sin(ang) * sp, e.damage * 0.55, 0.32, 5, slow ? 0x8ae8ff : 0xff3a8a, slow);
                    }
                }
                cast = 1;
            }
            // dash sequence: telegraph -> charge, repeated dashLeft times
            if (dashPhase == 1)
            {
                e.vx = e.vz = 0;
                dashT -= dt;
                if (dashT <= 0)
                {
                    dashPhase = 2;
                    dashT = dashDist / dashSpeed;
                    run.fx.Sound("dash");
                }
                return;
            }
            if (dashPhase == 2)
            {
                e.vx = dashX * dashSpeed;
                e.vz = dashZ * dashSpeed;
                dashT -= dt;
                if (dashT <= 0)
                {
                    dashLeft--;
                    if (dashLeft > 0) StartDash();
                    else
                    {
                        dashPhase = 0;
                        busy = 0.7;
                    }
                }
                return;
            }
            Move(dt);
            // attack scheduling
            if (busy > 0)
            {
                busy -= dt;
                return;
            }
            var ph = phaseDef;
            for (int i = 0; i < cds.Length; i++) cds[i] -= dt;
            int pick = -1;
            for (int i = 0; i < cds.Length; i++) if (cds[i] <= 0 && (pick < 0 || cds[i] < cds[pick])) pick = i;
            if (pick >= 0)
            {
                var a = ph.attacks[pick];
                cds[pick] = a.Num("cd") * (0.85 + Rand.Value * 0.3) / Math.Sqrt(run.diff.speed);
                busy = 0.6;
                cast = 1;
                RunAttack(a);
            }
        }

        public void StartDash()
        {
            var p = run.player;
            double dx = p.x - e.x, dz = p.z - e.z;
            double d = MathX.Hypot(dx, dz);
            if (d == 0) d = 1;
            dashX = dx / d;
            dashZ = dz / d;
            dashDist = Math.Min(14, d + 4);
            dashPhase = 1;
            dashT = dashTele;
            run.hazards.LineTelegraph(e.x, e.z, dashX, dashZ, dashDist, e.radius * 2, dashTele);
        }

        /// <summary>Sets a phase without its entry actions (used by clones).</summary>
        public void ForcePhase(int i)
        {
            phase = i;
            cds = InitCds(def.phases[i]);
        }

        void Move(double dt)
        {
            var p = run.player;
            var ph = phaseDef;
            double dx = p.x - e.x, dz = p.z - e.z;
            double d = MathX.Hypot(dx, dz);
            if (d == 0) d = 1;
            double sp = ph.speed * run.diff.speed;
            double ux = dx / d, uz = dz / d;
            if (!def.flying && d > 3)
            {
                int cx = (int)Math.Floor(e.x), cz = (int)Math.Floor(e.z);
                if (run.nav.Has(cx, cz))
                {
                    int i = cz * run.terrain.size + cx;
                    if (run.nav.dirX[i] != 0 || run.nav.dirZ[i] != 0)
                    {
                        ux = run.nav.dirX[i];
                        uz = run.nav.dirZ[i];
                    }
                }
            }
            switch (ph.move)
            {
                case "stationary":
                    e.vx = e.vz = 0;
                    break;
                case "keep":
                    {
                        const double want = 7;
                        double m = d > want + 1 ? 1 : d < want - 1 ? -0.8 : 0;
                        e.vx = ux * sp * m - uz * sp * 0.5;
                        e.vz = uz * sp * m + ux * sp * 0.5;
                        break;
                    }
                case "wander":
                    {
                        wanderT -= dt;
                        if (wanderT <= 0)
                        {
                            wanderT = 2.5;
                            double a = Rand.Value * MathX.TAU;
                            wanderX = p.x + Math.Cos(a) * 6;
                            wanderZ = p.z + Math.Sin(a) * 6;
                        }
                        double wx = wanderX - e.x, wz = wanderZ - e.z;
                        double wd = MathX.Hypot(wx, wz);
                        if (wd == 0) wd = 1;
                        e.vx = wd > 0.5 ? (wx / wd) * sp : 0;
                        e.vz = wd > 0.5 ? (wz / wd) * sp : 0;
                        break;
                    }
                default:
                    e.vx = d > 1 ? ux * sp : 0;
                    e.vz = d > 1 ? uz * sp : 0;
                    break;
            }
        }

        public void OnDeath()
        {
            run.fx.Shake(0.9);
            run.fx.Vibrate(120);
            run.fx.Light(e.x, e.z, def.color, 6, 16, 1);
            run.fx.Burst(e.x, 1.5, e.z, def.color, 80, 9, 0.3, 1.4, ParticleKind.Debris);
            run.fx.Burst(e.x, 1.5, e.z, 0xffffff, 40, 7, 0.2, 1);
            run.fx.Sound("bossDeath");
            foreach (var c in crystals.ToArray()) if (c.alive) run.combat.KillEnemy(c, true);
            foreach (var l in run.hazards.lasers) if (l.owner == e) l.active = false;
            run.bosses.Remove(this);
            run.pickups.DropXp(e.x, e.z, e.xp);
            run.stats.kills++;
            if (!isClone)
            {
                run.pickups.SpawnChest(e.x, e.z, 1);
                run.stats.bossesKilled.Add(def.id);
                run.stats.gold += 40 * run.player.stats.greed;
                for (int i = 0; i < 10; i++) run.pickups.Spawn("gold", e.x, e.z, 5, true);
                run.EmitBossDefeated(this);
            }
            if (isFinal && !run.bosses.Exists(b => b.isFinal)) run.OnFinalBossDefeated();
        }
    }
}
