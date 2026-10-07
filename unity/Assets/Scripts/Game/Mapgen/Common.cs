using System;
using System.Collections.Generic;

namespace Cubeborn
{
    public class GenCtx
    {
        public Terrain t;
        public Rng rng;
        public double seed;
        /// <summary>Center coordinate.</summary>
        public int c;
    }

    public class DecorOpts
    {
        public double size = 0.18;
        public double h = -1;
        public bool sway, glow;
        public string[] onTile;
    }

    public static class Gen
    {
        static double Smooth(double t) => t * t * (3 - 2 * t);

        /// <summary>Value noise in [0,1].</summary>
        public static double VNoise(double x, double z, double seed)
        {
            double x0 = Math.Floor(x), z0 = Math.Floor(z);
            double fx = Smooth(x - x0), fz = Smooth(z - z0);
            double a = Rng.Hash2(x0, z0, seed);
            double b = Rng.Hash2(x0 + 1, z0, seed);
            double c = Rng.Hash2(x0, z0 + 1, seed);
            double d = Rng.Hash2(x0 + 1, z0 + 1, seed);
            return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
        }

        /// <summary>Fractal noise, two octaves.</summary>
        public static double Fbm(double x, double z, double seed) => VNoise(x, z, seed) * 0.65 + VNoise(x * 2.1, z * 2.1, seed + 17) * 0.35;

        /// <summary>Tall cliff wall around the map edge.</summary>
        public static void Border(GenCtx g, string mat, int thickness = 3, int h = 4)
        {
            var t = g.t;
            int n = t.size;
            for (int z = 0; z < n; z++)
                for (int x = 0; x < n; x++)
                {
                    int d = Math.Min(Math.Min(x, z), Math.Min(n - 1 - x, n - 1 - z));
                    if (d < thickness)
                    {
                        int i = t.Idx(x, z);
                        t.cell[i] = CELL.wall;
                        t.height[i] = (byte)h;
                        // Only the inner face is visible; outer rows get one top block.
                        if (d == thickness - 1) for (int y = 0; y < h; y++) t.blocks.Add(new Block { x = x, y = y, z = z, mat = mat, v = (x + z + y) & 7 });
                        else t.blocks.Add(new Block { x = x, y = h - 1, z = z, mat = mat, v = (x * 3 + z) & 7 });
                    }
                }
        }

        public static void FillTiles(GenCtx g, Func<int, int, string> pick)
        {
            var t = g.t;
            for (int z = 0; z < t.size; z++)
                for (int x = 0; x < t.size; x++) t.SetTile(x, z, pick(x, z));
        }

        /// <summary>Calls fn for cells where noise exceeds threshold (organic blobs).</summary>
        public static void Blobs(GenCtx g, double scale, double threshold, double seedOff, Action<int, int, double> fn)
        {
            var t = g.t;
            for (int z = 0; z < t.size; z++)
                for (int x = 0; x < t.size; x++)
                {
                    double v = Fbm(x / scale, z / scale, g.seed + seedOff);
                    if (v > threshold) fn(x, z, v);
                }
        }

        public static double DistToCenter(GenCtx g, double x, double z) => MathX.Hypot(x - g.c, z - g.c);

        /// <summary>Random walk path of given width, painting tiles and clearing obstacles.</summary>
        public static void Path(GenCtx g, double x0, double z0, double x1, double z1, double width, string tile, double wobble = 0.35)
        {
            double x = x0, z = z0;
            int guard = 0;
            while (MathX.Hypot(x1 - x, z1 - z) > 1 && guard++ < 4000)
            {
                double ang = Math.Atan2(z1 - z, x1 - x) + (g.rng.Next() - 0.5) * wobble * 2;
                x += Math.Cos(ang);
                z += Math.Sin(ang);
                double r = width / 2;
                for (double dz = -r; dz <= r; dz++)
                    for (double dx = -r; dx <= r; dx++)
                    {
                        int cx = MathX.RoundI(x + dx), cz = MathX.RoundI(z + dz);
                        if (g.t.InBounds(cx, cz) && g.t.cell[g.t.Idx(cx, cz)] != CELL.wall) g.t.SetTile(cx, cz, tile, CELL.floor);
                    }
            }
        }

        /// <summary>Fills circle with tile/cell.</summary>
        public static void Disk(GenCtx g, double cx, double cz, double r, string tile, int cell = -1)
        {
            for (int z = (int)Math.Floor(cz - r); z <= (int)Math.Ceiling(cz + r); z++)
                for (int x = (int)Math.Floor(cx - r); x <= (int)Math.Ceiling(cx + r); x++)
                {
                    if ((x - cx) * (x - cx) + (z - cz) * (z - cz) > r * r) continue;
                    if (!g.t.InBounds(x, z)) continue;
                    if (tile != null) g.t.SetTile(x, z, tile, cell);
                    else if (cell >= 0) g.t.SetCell(x, z, cell);
                }
        }

        /// <summary>Blocky tree: trunk column (solid) and a cuboid canopy.</summary>
        public static void Tree(GenCtx g, int x, int z, string trunkMat, string leafMat, int h, int leafV = -1)
        {
            var t = g.t;
            t.Column(x, z, h, trunkMat);
            int r = h >= 4 ? 2 : 1;
            for (int y = h - 1; y <= h + 1; y++)
            {
                int rr = y == h + 1 ? r - 1 : r;
                for (int dz = -rr; dz <= rr; dz++)
                    for (int dx = -rr; dx <= rr; dx++)
                    {
                        if (Math.Abs(dx) == rr && Math.Abs(dz) == rr && g.rng.Chance(0.6)) continue;
                        if (dx == 0 && dz == 0 && y < h) continue;
                        t.AddBlock(x + dx, y, z + dz, leafMat, leafV < 0 ? -1 : leafV);
                    }
            }
        }

        public static void Pine(GenCtx g, int x, int z, int h)
        {
            var t = g.t;
            t.Column(x, z, 2, "trunk");
            for (int y = 1; y < h; y++)
            {
                int r = Math.Max(0, MathX.RoundI((h - y) / 2.0));
                for (int dz = -r; dz <= r; dz++)
                    for (int dx = -r; dx <= r; dx++)
                    {
                        if (Math.Abs(dx) + Math.Abs(dz) > r + 0.5) continue;
                        if (dx == 0 && dz == 0 && y < 2) continue;
                        t.AddBlock(x + dx, y, z + dz, y == h - 1 || (r > 0 && g.rng.Chance(0.25)) ? "snow" : "pine");
                    }
            }
        }

        public static void RockCluster(GenCtx g, int x, int z, string mat, int size)
        {
            for (int i = 0; i < size; i++)
            {
                int cx = x + g.rng.Int(-1, 1), cz = z + g.rng.Int(-1, 1);
                if (!g.t.IsFree(cx, cz)) continue;
                g.t.Column(cx, cz, g.rng.Int(1, 2), mat);
            }
        }

        /// <summary>Water/lava pond with optional bank decoration.</summary>
        public static void Pond(GenCtx g, int x, int z, int r, string tile, int cell, int bankColor = -1)
        {
            for (int dz = -r - 1; dz <= r + 1; dz++)
                for (int dx = -r - 1; dx <= r + 1; dx++)
                {
                    double d = MathX.Hypot(dx, dz) + (g.rng.Next() - 0.5) * 0.9;
                    int cx = x + dx, cz = z + dz;
                    if (!g.t.InBounds(cx, cz) || g.t.cell[g.t.Idx(cx, cz)] == CELL.wall) continue;
                    if (d < r) g.t.SetTile(cx, cz, tile, cell);
                    else if (d < r + 1 && bankColor >= 0 && g.rng.Chance(0.35) && g.t.IsFree(cx, cz))
                        g.t.decor.Add(new Decor { x = cx + 0.5, z = cz + 0.5, y = 0, size = 0.5, h = 0.25, color = bankColor });
                }
        }

        /// <summary>Scatter small decorative voxels (flowers, grass, pebbles).</summary>
        public static void ScatterDecor(GenCtx g, int count, int[] colors, DecorOpts opts = null)
        {
            opts = opts ?? new DecorOpts();
            var t = g.t;
            var rng = g.rng;
            List<int> tiles = null;
            if (opts.onTile != null)
            {
                tiles = new List<int>();
                foreach (var n in opts.onTile) tiles.Add(t.TileId(n));
            }
            for (int i = 0; i < count; i++)
            {
                double x = rng.Range(4, t.size - 4), z = rng.Range(4, t.size - 4);
                int cx = (int)Math.Floor(x), cz = (int)Math.Floor(z);
                if (!t.IsFree(cx, cz)) continue;
                if (tiles != null && !tiles.Contains(t.tile[t.Idx(cx, cz)])) continue;
                double size = opts.size * rng.Range(0.7, 1.3);
                double hh = (opts.h >= 0 ? opts.h : size) * rng.Range(0.8, 1.6);
                t.decor.Add(new Decor { x = x, z = z, y = 0, size = size, h = hh, color = rng.Pick(colors), sway = opts.sway, glow = opts.glow });
            }
        }

        /// <summary>Ensures the spawn area is open.</summary>
        public static void ClearCenter(GenCtx g, int r, string tile)
        {
            var t = g.t;
            for (int z = g.c - r; z <= g.c + r; z++)
                for (int x = g.c - r; x <= g.c + r; x++)
                {
                    if (MathX.Hypot(x - g.c, z - g.c) > r) continue;
                    int i = t.Idx(x, z);
                    t.cell[i] = CELL.floor;
                    t.height[i] = 0;
                    t.SetTile(x, z, tile);
                }
            // drop blocks inside the cleared radius
            t.blocks.RemoveAll(b => !(MathX.Hypot(b.x - g.c, b.z - g.c) > r + 0.5 || b.y > 6));
            t.decor.RemoveAll(d => !(MathX.Hypot(d.x - g.c, d.z - g.c) > r));
        }

        /// <summary>Flood fill from center; converts unreachable floor pockets into solid to avoid trapped spawns.</summary>
        public static void SealUnreachable(GenCtx g)
        {
            var t = g.t;
            int n = t.size;
            var seen = new byte[n * n];
            var q = new int[n * n];
            int h = 0, tl = 0;
            int s = t.Idx(g.c, g.c);
            q[tl++] = s;
            seen[s] = 1;
            while (h < tl)
            {
                int i = q[h++];
                int x = i % n, z = i / n;
                for (int k = 0; k < 4; k++)
                {
                    bool ok = k == 0 ? x > 0 : k == 1 ? x < n - 1 : k == 2 ? z > 0 : z < n - 1;
                    if (!ok) continue;
                    int j = k == 0 ? i - 1 : k == 1 ? i + 1 : k == 2 ? i - n : i + n;
                    if (seen[j] != 0) continue;
                    int c = t.cell[j];
                    if (c == CELL.solid || c == CELL.liquid || c == CELL.wall) continue;
                    seen[j] = 1;
                    q[tl++] = j;
                }
            }
            for (int i = 0; i < n * n; i++)
            {
                int c = t.cell[i];
                if (seen[i] == 0 && (c == CELL.floor || c == CELL.hazard || c == CELL.ice)) t.cell[i] = CELL.solid;
            }
        }
    }
}
