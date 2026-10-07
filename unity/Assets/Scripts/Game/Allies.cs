using System;
using System.Collections.Generic;

namespace Cubeborn
{
    /// <summary>Friendly summoned minion (Bone Familiars, Raise Dead).</summary>
    public class Ally
    {
        public bool active;
        public double x, z, vx, vz, yaw, life, speed = 6, scale = 1;
        public readonly DamageInfo dmg = new DamageInfo();
        public double hitEvery = 0.6;
        public string model = "ally_skeleton";
        public Enemy target;
        public int targetUid;
        public double retarget, anim, swing, attack;
        /// <summary>Group id: weapon instance source or -1 for perk allies.</summary>
        public int group = -1;
    }

    public class Allies
    {
        public readonly List<Ally> list = new List<Ally>();
        readonly Run run;

        public Allies(Run run) { this.run = run; }

        public Ally Spawn(double x, double z, double life, double speed, DamageInfo dmg, double hitEvery, string model, int group, double scale = 1)
        {
            var a = list.Find(o => !o.active);
            if (a == null) { a = new Ally(); list.Add(a); }
            a.active = true;
            a.x = x;
            a.z = z;
            a.vx = a.vz = 0;
            a.life = life;
            a.speed = speed;
            a.hitEvery = hitEvery;
            a.model = model;
            a.group = group;
            a.scale = scale;
            a.target = null;
            a.retarget = 0;
            a.dmg.CopyFrom(dmg);
            run.fx.Burst(x, 0.6, z, 0xd8ffd0, 10, 3, 0.14, 0.5);
            return a;
        }

        public int Count(int group)
        {
            int n = 0;
            foreach (var a in list) if (a.active && a.group == group) n++;
            return n;
        }

        public void Dismiss(int group)
        {
            foreach (var a in list) if (a.active && a.group == group) a.active = false;
        }

        public void Update(double dt)
        {
            var p = run.player;
            for (int i = 0; i < list.Count; i++)
            {
                var a = list[i];
                if (!a.active) continue;
                a.life -= dt;
                if (a.life <= 0)
                {
                    a.active = false;
                    run.fx.Burst(a.x, 0.6, a.z, 0xe8e2cc, 8, 2, 0.12, 0.5, ParticleKind.Debris);
                    continue;
                }
                a.retarget -= dt;
                if (a.retarget <= 0 || a.target == null || !a.target.alive || a.target.uid != a.targetUid)
                {
                    a.retarget = 0.5;
                    a.target = run.enemies.Nearest(a.x, a.z, 10);
                    a.targetUid = a.target?.uid ?? 0;
                }
                double tx = p.x, tz = p.z;
                bool chasing = false;
                if (a.target != null && (a.target.x - p.x) * (a.target.x - p.x) + (a.target.z - p.z) * (a.target.z - p.z) < 16 * 16)
                {
                    tx = a.target.x;
                    tz = a.target.z;
                    chasing = true;
                }
                double dx = tx - a.x, dz = tz - a.z;
                double d = MathX.Hypot(dx, dz);
                if (d == 0) d = 1;
                double want = chasing ? 0 : 2;
                double sp = d > want ? a.speed : 0;
                a.vx = (dx / d) * sp;
                a.vz = (dz / d) * sp;
                a.x += a.vx * dt;
                a.z += a.vz * dt;
                if (sp > 0)
                {
                    a.yaw = Math.Atan2(a.vx, a.vz);
                    a.anim += dt * 8;
                }
                // teleport back if left far behind
                if ((a.x - p.x) * (a.x - p.x) + (a.z - p.z) * (a.z - p.z) > 400)
                {
                    a.x = p.x + (Rand.Value - 0.5) * 2;
                    a.z = p.z + (Rand.Value - 0.5) * 2;
                }
                a.swing -= dt;
                if (a.swing <= 0)
                {
                    bool hit = false;
                    run.enemies.ForEachInRadius(a.x, a.z, 0.7 * a.scale, e =>
                    {
                        run.combat.Hit(e, a.dmg, 1, e.x - a.x, e.z - a.z);
                        hit = true;
                        return false;
                    });
                    if (hit)
                    {
                        a.swing = a.hitEvery;
                        a.attack = 0.2;
                    }
                }
                if (a.attack > 0) a.attack -= dt;
            }
        }

        public void Clear()
        {
            foreach (var a in list) a.active = false;
        }
    }
}
