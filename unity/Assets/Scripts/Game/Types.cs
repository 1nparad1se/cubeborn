namespace Cubeborn
{
    /// <summary>Information carried by every instance of player-caused damage.</summary>
    public class DamageInfo
    {
        public const int MAX_SOURCES = 24;
        public double damage, critChance, critDamage = 1.5, knockback = 1;
        /// <summary>Source slot used for per-enemy re-hit timers (0..MAX_SOURCES-1).</summary>
        public int source;
        public string weaponId = "";
        public double slow, slowDur, freeze, freezeDur, poison, poisonDur, burn, burnDur;

        public DamageInfo CopyFrom(DamageInfo s)
        {
            damage = s.damage; critChance = s.critChance; critDamage = s.critDamage; knockback = s.knockback;
            source = s.source; weaponId = s.weaponId; slow = s.slow; slowDur = s.slowDur; freeze = s.freeze; freezeDur = s.freezeDur;
            poison = s.poison; poisonDur = s.poisonDur; burn = s.burn; burnDur = s.burnDur;
            return this;
        }
    }

    public enum ParticleKind { Glow, Debris, Smoke }

    /// <summary>
    /// Presentation sink. The simulation calls these; the Unity client renders/plays them and
    /// the headless balance simulator ignores them.
    /// </summary>
    public interface IFx
    {
        void Burst(double x, double y, double z, int color, int count, double speed, double size, double life, ParticleKind kind = ParticleKind.Glow);
        void Number(double x, double z, double value, bool crit, int color = -1);
        void Text(double x, double z, string text, int color);
        void Shake(double amount);
        void Light(double x, double z, int color, double intensity, double radius, double duration);
        void Sound(string id, double volume = 1);
        void Vibrate(int ms);
    }

    public class NullFx : IFx
    {
        public static readonly NullFx I = new NullFx();
        public void Burst(double x, double y, double z, int color, int count, double speed, double size, double life, ParticleKind kind = ParticleKind.Glow) { }
        public void Number(double x, double z, double value, bool crit, int color = -1) { }
        public void Text(double x, double z, string text, int color) { }
        public void Shake(double amount) { }
        public void Light(double x, double z, int color, double intensity, double radius, double duration) { }
        public void Sound(string id, double volume = 1) { }
        public void Vibrate(int ms) { }
    }
}
