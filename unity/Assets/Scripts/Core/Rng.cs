using System;

namespace Cubeborn
{
    /// <summary>Small fast seeded PRNG (mulberry32). Bit-identical to the web version.</summary>
    public class Rng
    {
        uint s;
        static readonly Random seeder = new Random();

        public Rng(long seed) { s = unchecked((uint)seed); }
        public Rng() : this(seeder.Next()) { }

        public double Next()
        {
            unchecked
            {
                s += 0x6d2b79f5;
                uint t = s;
                t = (t ^ (t >> 15)) * (t | 1);
                t ^= t + (t ^ (t >> 7)) * (t | 61);
                return (t ^ (t >> 14)) / 4294967296.0;
            }
        }

        public double Range(double a, double b) => a + (b - a) * Next();
        public int Int(int a, int b) => (int)Math.Floor(Range(a, b + 1));
        public bool Chance(double p) => Next() < p;
        public T Pick<T>(System.Collections.Generic.IList<T> arr) => arr[(int)Math.Floor(Next() * arr.Count)];

        public T Weighted<T>(System.Collections.Generic.IList<T> items, Func<T, double> weight) where T : class
        {
            double total = 0;
            foreach (var it in items) total += Math.Max(0, weight(it));
            if (total <= 0) return null;
            double r = Next() * total;
            foreach (var it in items)
            {
                r -= Math.Max(0, weight(it));
                if (r <= 0) return it;
            }
            return items[items.Count - 1];
        }

        public System.Collections.Generic.IList<T> Shuffle<T>(System.Collections.Generic.IList<T> arr)
        {
            for (int i = arr.Count - 1; i > 0; i--)
            {
                int j = (int)Math.Floor(Next() * (i + 1));
                T t = arr[i];
                arr[i] = arr[j];
                arr[j] = t;
            }
            return arr;
        }

        /// <summary>Deterministic 2D hash in [0,1). Emulates JS double math and ToInt32 exactly.</summary>
        public static double Hash2(double x, double y, double seed = 0)
        {
            double v = Math.Truncate(x * 374761393.0 + y * 668265263.0 + seed * 2147483647.0);
            double m = v % 4294967296.0;
            if (m < 0) m += 4294967296.0;
            unchecked
            {
                uint h = (uint)m;
                h = (h ^ (h >> 13)) * 1274126177u;
                h ^= h >> 16;
                return h / 4294967296.0;
            }
        }
    }

    /// <summary>Process-wide Math.random() replacement.</summary>
    public static class Rand
    {
        static readonly Random r = new Random();
        public static double Value => r.NextDouble();
    }
}
