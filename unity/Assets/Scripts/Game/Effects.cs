using System.Collections.Generic;

namespace Cubeborn
{
    /// <summary>Purely visual effects created by gameplay and drawn by the renderer.</summary>
    public enum EffectKind { Slash, Ring, Beam, Bolt, Lance, Aura, Flash, Warn, Punch, Cloud, Fall }

    public class Effect
    {
        public bool active;
        public EffectKind kind = EffectKind.Ring;
        public double x, y = 0.5, z, x2, z2, angle, arc, r = 1, r2 = 1, w = 0.5, life = 0.3, maxLife = 0.3, seed;
        public int color = 0xffffff;
        /// <summary>Follows the player position.</summary>
        public bool follow;
    }

    public class Effects
    {
        public readonly List<Effect> list = new List<Effect>();

        public Effect Add(EffectKind kind, double x, double z, double life, int color)
        {
            Effect e = null;
            foreach (var o in list)
                if (!o.active) { e = o; break; }
            if (e == null) { e = new Effect(); list.Add(e); }
            e.active = true; e.kind = kind; e.x = x; e.z = z; e.y = 0.5;
            e.life = e.maxLife = life; e.color = color; e.angle = 0; e.arc = 0;
            e.r = 1; e.r2 = 1; e.w = 0.5; e.x2 = x; e.z2 = z;
            e.seed = Rand.Value * 1000; e.follow = false;
            return e;
        }

        public void Update(double dt, double px, double pz)
        {
            foreach (var e in list)
            {
                if (!e.active) continue;
                e.life -= dt;
                if (e.follow) { e.x = px; e.z = pz; }
                if (e.life <= 0) e.active = false;
            }
        }

        public void Clear()
        {
            foreach (var e in list) e.active = false;
        }
    }
}
