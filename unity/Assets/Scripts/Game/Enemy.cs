using System;

namespace Cubeborn
{
    /// <summary>Pooled enemy instance. Plain mutable fields for speed; Reset() on reuse.</summary>
    public class Enemy
    {
        public readonly int index;
        public bool active;
        /// <summary>Unique id increments on each spawn so stale references can be detected.</summary>
        public int uid;
        public EnemyDef def;
        public double x, z, y, vx, vz, kx, kz, yaw;
        public double hp = 1, maxHp = 1, damage = 1, speed = 1, radius = 0.4, scale = 1, xp = 1, kbResist;
        public bool flying;
        public double flash, anim;
        /// <summary>0 alive, &gt;0 dying timer.</summary>
        public double dying;
        public double touchCd;
        public int state;
        public double stateT, cd, aux, dirX, dirZ;
        public double slowT, slowMul = 1, freezeT, poisonT, poisonDps, burnT, burnDps, dotTick;
        public bool invuln;
        public double shieldT;
        public string elite, elite2;
        public BossController boss;
        public bool isAlly, noReward;
        /// <summary>Seconds left before the enemy leaves on its own (treasure sprite).</summary>
        public double ttl;
        public readonly double[] lastHit = new double[DamageInfo.MAX_SOURCES];
        public int tint;

        public Enemy(int index) { this.index = index; }

        public void Reset(EnemyDef d)
        {
            def = d;
            active = true;
            vx = vz = kx = kz = 0;
            y = 0;
            flash = 0;
            anim = Rand.Value * 10;
            dying = 0;
            touchCd = 0;
            state = 0;
            stateT = 0;
            cd = 1 + Rand.Value * 2;
            aux = 0;
            slowT = freezeT = poisonT = burnT = 0;
            slowMul = 1;
            poisonDps = burnDps = 0;
            dotTick = 0;
            invuln = false;
            shieldT = 0;
            elite = null;
            elite2 = null;
            boss = null;
            isAlly = false;
            noReward = false;
            ttl = 0;
            for (int i = 0; i < lastHit.Length; i++) lastHit[i] = -99;
            radius = d.radius;
            scale = d.size;
            kbResist = d.kbResist;
            flying = d.flying;
            tint = 0;
        }

        public bool alive => active && dying == 0;

        public bool HasElite(string id) => elite == id || elite2 == id;
    }
}
