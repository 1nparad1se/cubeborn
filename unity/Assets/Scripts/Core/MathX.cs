using System;

namespace Cubeborn
{
    public static class MathX
    {
        public const double PI = Math.PI;
        public const double TAU = Math.PI * 2;

        public static double Clamp(double v, double a, double b) => v < a ? a : v > b ? b : v;
        public static double Lerp(double a, double b, double t) => a + (b - a) * t;
        public static double Hypot(double x, double z) => Math.Sqrt(x * x + z * z);
        public static double Hypot(double x, double y, double z) => Math.Sqrt(x * x + y * y + z * z);
        public static int Floor(double v) => (int)Math.Floor(v);
        /// <summary>JavaScript Math.round: halves round toward +infinity.</summary>
        public static double Round(double v) => Math.Floor(v + 0.5);
        public static int RoundI(double v) => (int)Math.Floor(v + 0.5);
        public static double Sq(double v) => v * v;
        public static double Damp(double rate, double dt) => 1 - Math.Exp(-rate * dt);

        public static double AngleDelta(double from, double to)
        {
            double d = (to - from) % TAU;
            if (d > Math.PI) d -= TAU;
            if (d < -Math.PI) d += TAU;
            return d;
        }

        /// <summary>Shortest distance from point to segment, squared.</summary>
        public static double SegDist2(double px, double pz, double ax, double az, double bx, double bz)
        {
            double abx = bx - ax, abz = bz - az;
            double len2 = abx * abx + abz * abz;
            if (len2 == 0) len2 = 1e-6;
            double t = ((px - ax) * abx + (pz - az) * abz) / len2;
            t = Clamp(t, 0, 1);
            double cx = ax + abx * t - px, cz = az + abz * t - pz;
            return cx * cx + cz * cz;
        }

        /// <summary>JS-style % (sign follows dividend), same as C#.</summary>
        public static string FmtTime(double sec)
        {
            int s = Math.Max(0, (int)Math.Floor(sec));
            return (s / 60).ToString("00") + ":" + (s % 60).ToString("00");
        }

        public static string FmtNum(double n)
        {
            if (n >= 1e6) return (n / 1e6).ToString("0.0", System.Globalization.CultureInfo.InvariantCulture) + "M";
            if (n >= 1e4) return (n / 1e3).ToString("0.0", System.Globalization.CultureInfo.InvariantCulture) + "K";
            return RoundI(n).ToString();
        }

        public static string Num(double v)
        {
            double r = Round(v * 100) / 100;
            return r.ToString(System.Globalization.CultureInfo.InvariantCulture);
        }
    }
}
