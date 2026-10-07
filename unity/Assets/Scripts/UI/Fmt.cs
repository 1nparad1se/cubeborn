using System;
using System.Collections.Generic;
using System.Globalization;

namespace Cubeborn.UI
{
    /// <summary>Text formatting shared by menus and run screens (ui/format.ts).</summary>
    public static class Fmt
    {
        static readonly HashSet<string> PctStats = new HashSet<string> { "might", "area", "cooldown", "projSpeed", "duration", "luck", "growth", "greed", "critChance", "critDamage", "moveSpeed", "magnet", "lifesteal", "thorns", "curse", "dodge", "knockback" };
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public static string T(string key, params object[] kv) => I18n.T(key, kv);
        public static string L(Loc l) => I18n.L(l);

        public static string Num(double v)
        {
            double r = Math.Round(v * 100) / 100;
            return r.ToString("0.##", Inv);
        }

        /// <summary>"+10% Might" style lines for passive / upgrade stat modifiers.</summary>
        public static List<string> StatModLines(StatMods m)
        {
            var o = new List<string>();
            if (m == null) return o;
            foreach (var kv in m)
            {
                double v = kv.Value;
                if (v == 0) continue;
                string sign = v > 0 ? "+" : "−";
                string val;
                if (kv.Key == "cooldown") val = "−" + Num(Math.Abs(v) * 100) + "%";
                else if (PctStats.Contains(kv.Key)) val = sign + Num(Math.Abs(v) * 100) + "%";
                else if (kv.Key == "regen") val = sign + Num(Math.Abs(v)) + "/" + T("u_sec");
                else val = sign + Num(Math.Abs(v));
                o.Add(val + " " + T("stat_" + kv.Key));
            }
            return o;
        }

        /// <summary>Describes a weapon level delta: "+5 damage, +1 projectile".</summary>
        public static List<string> WeaponDeltaLines(WStats d)
        {
            var o = new List<string>();
            if (d == null) return o;
            foreach (var kv in d.v)
            {
                double v = kv.Value;
                if (v == 0) continue;
                string sign = v > 0 ? "+" : "−";
                double a = Math.Abs(v);
                switch (kv.Key)
                {
                    case "cooldown":
                        o.Add(T("wd_cooldown", "v", Num(a)));
                        break;
                    case "area":
                    case "projSpeed":
                    case "critChance":
                    case "width":
                        o.Add(sign + Num(a * 100) + "% " + T("wd_" + kv.Key));
                        break;
                    case "duration":
                    case "slowDur":
                    case "freeze":
                        o.Add(sign + Num(a) + T("u_s") + " " + T("wd_" + kv.Key));
                        break;
                    default:
                        o.Add(sign + Num(a) + " " + T("wd_" + kv.Key));
                        break;
                }
            }
            return o;
        }

        public static string Time(double s)
        {
            int t = (int)Math.Max(0, Math.Floor(s));
            return (t / 60).ToString("00") + ":" + (t % 60).ToString("00");
        }

        public static string Count(double n)
        {
            if (n >= 1e6) return (n / 1e6).ToString("0.0", Inv) + "M";
            if (n >= 1e4) return (n / 1e3).ToString("0.0", Inv) + "K";
            return Math.Floor(n + 0.5).ToString(Inv);
        }
    }
}
