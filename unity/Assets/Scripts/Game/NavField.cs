using System;

namespace Cubeborn
{
    /// <summary>
    /// BFS flow field toward the player over walkable cells. Recomputed a few times a second,
    /// bounded by a radius around the player. Walkers read a direction per cell.
    /// </summary>
    public class NavField
    {
        public readonly float[] dirX, dirZ;
        readonly ushort[] dist, stamp;
        readonly int[] queue;
        int curStamp;
        readonly int n;
        double timer;
        readonly Terrain terrain;
        readonly int radius;

        public NavField(Terrain terrain, int radius = 48)
        {
            this.terrain = terrain;
            this.radius = radius;
            n = terrain.size;
            int cells = n * n;
            dirX = new float[cells];
            dirZ = new float[cells];
            dist = new ushort[cells];
            queue = new int[cells];
            stamp = new ushort[cells];
        }

        public void Update(double dt, double px, double pz, bool force = false)
        {
            timer -= dt;
            if (timer > 0 && !force) return;
            timer = 0.2;
            Compute((int)Math.Floor(px), (int)Math.Floor(pz));
        }

        /// <summary>Whether the cell has valid flow data this generation.</summary>
        public bool Has(int cx, int cz)
        {
            if (cx < 0 || cz < 0 || cx >= n || cz >= n) return false;
            return stamp[cz * n + cx] == curStamp;
        }

        void Compute(int sx, int sz)
        {
            curStamp = (curStamp + 1) & 0xffff;
            if (curStamp == 0) curStamp = 1;
            ushort st = (ushort)curStamp;
            if (sx < 0 || sz < 0 || sx >= n || sz >= n) return;
            int head = 0, tail = 0;
            int s = sz * n + sx;
            stamp[s] = st;
            dist[s] = 0;
            queue[tail++] = s;
            while (head < tail)
            {
                int i = queue[head++];
                int d = dist[i];
                if (d >= radius) continue;
                int x = i % n, z = i / n;
                if (x > 0 && Visit(i - 1, x - 1, z, d, st, tail)) tail++;
                if (x < n - 1 && Visit(i + 1, x + 1, z, d, st, tail)) tail++;
                if (z > 0 && Visit(i - n, x, z - 1, d, st, tail)) tail++;
                if (z < n - 1 && Visit(i + n, x, z + 1, d, st, tail)) tail++;
            }
            // directions: steepest descent among 8 neighbours (diagonals only if both sides open)
            for (int k = 0; k < tail; k++)
            {
                int i = queue[k];
                int x = i % n, z = i / n;
                double best = dist[i];
                int bx = 0, bz = 0;
                for (int dz = -1; dz <= 1; dz++)
                    for (int dx = -1; dx <= 1; dx++)
                    {
                        if (dx == 0 && dz == 0) continue;
                        int nx = x + dx, nz = z + dz;
                        if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
                        int j = nz * n + nx;
                        if (stamp[j] != st) continue;
                        if (dx != 0 && dz != 0 && (stamp[z * n + nx] != st || stamp[nz * n + x] != st)) continue;
                        double dd = dist[j] + (dx != 0 && dz != 0 ? 0.4 : 0);
                        if (dd < best) { best = dd; bx = dx; bz = dz; }
                    }
                double len = MathX.Hypot(bx, bz);
                if (len == 0) len = 1;
                dirX[i] = (float)(bx / len);
                dirZ[i] = (float)(bz / len);
            }
        }

        bool Visit(int j, int x, int z, int d, ushort st, int tail)
        {
            if (stamp[j] == st) return false;
            if (terrain.BlocksWalker(x, z)) return false;
            stamp[j] = st;
            dist[j] = (ushort)(d + 1);
            queue[tail] = j;
            return true;
        }
    }
}
