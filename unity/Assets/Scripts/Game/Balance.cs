namespace Cubeborn
{
    /// <summary>Global tuning constants. Content-specific numbers live in the content data.</summary>
    public static class Balance
    {
        public const double runDuration = 900;
        public const int weaponSlots = 6;
        public const int passiveSlots = 6;
        public const int passiveMaxDefault = 5;

        // player
        public const double basePickupRadius = 1.6;
        public const double hurtInvuln = 0.12;
        public const double contactInterval = 0.5;
        public const double armorMin = 1;
        public const double maxCooldownReduction = 0.6;
        public const double maxDodge = 0.6;

        /// <summary>XP required to go from level L to L+1.</summary>
        public static double XpForLevel(int level)
        {
            if (level < 20) return 5 + (level - 1) * 9;
            if (level < 40) return 176 + (level - 20) * 20;
            return 576 + (level - 40) * 32;
        }
        public const int maxGems = 450;
        public const double gemPullSpeed = 14;

        // enemies
        public const double spawnRadiusMin = 20;
        public const double spawnRadiusMax = 25;
        public const double despawnRadius = 42;
        public const double enemyHpPerMinute = 0.24;
        public const double enemyHpPerMinuteLate = 1.0;
        public const double enemyDamagePerMinute = 0.1;
        public const double separationStrength = 7;
        public const double eliteChanceStart = 150;
        public const double eliteChancePerMin = 0.0014;
        public const int hardCap = 1400;
        public const double bossHpMul = 1.8;
        public const double spawnRateMul = 1.55;
        public const double spawnMaxMul = 1.65;

        // drops
        public const double goldDropChance = 0.04;
        public const double heartDropChance = 0.0025;
        public const double magnetDropChance = 0.0015;
        public const double powerupDropChance = 0.002;
        public const double eliteChestChance = 0.7;
        public const int crateCount = 70;

        // level up
        public const int choiceCount = 3;
        public const double extraChoiceLuck = 0.25;
        public const int baseRerolls = 1;
        public const int baseSkips = 1;
        public const int baseBanish = 0;

        // rewards
        public const double goldPerKill = 0.06;
        public const double goldPerMinute = 8;
        public const double goldVictoryBonus = 250;
        public const double goldBossBonus = 120;
    }
}
