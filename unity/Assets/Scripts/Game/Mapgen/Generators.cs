using System;
using System.Collections.Generic;
using static Cubeborn.Gen;

namespace Cubeborn
{
    public static class Generators
    {
        static DecorOpts O(double size, double h, bool sway = false, bool glow = false, params string[] onTile) =>
            new DecorOpts { size = size, h = h, sway = sway, glow = glow, onTile = onTile.Length > 0 ? onTile : null };

        // ------------------------------------------------------------------ Blightwood: infected forest
        static void Forest(GenCtx g)
        {
            var t = g.t;
            var rng = g.rng;
            FillTiles(g, (x, z) => Fbm(x / 9.0, z / 9.0, g.seed) > 0.62 ? "grass2" : "grass");
            Blobs(g, 14, 0.7, 3, (x, z, v) => t.SetTile(x, z, "dirt"));
            // winding dirt paths from the center to each edge
            for (int i = 0; i < 4; i++)
            {
                double a = i / 4.0 * Math.PI * 2 + rng.Range(-0.4, 0.4);
                Path(g, g.c, g.c, g.c + Math.Cos(a) * (t.size / 2.0 - 6), g.c + Math.Sin(a) * (t.size / 2.0 - 6), 3, "path");
            }
            // toxic bogs (hazard) and ponds
            Blobs(g, 11, 0.74, 9, (x, z, v) =>
            {
                if (DistToCenter(g, x, z) > 14) t.SetTile(x, z, "bog", CELL.hazard);
            });
            for (int i = 0; i < 9; i++)
            {
                int x = rng.Int(12, t.size - 12), z = rng.Int(12, t.size - 12);
                if (DistToCenter(g, x, z) < 18) continue;
                Pond(g, x, z, rng.Int(2, 5), "water", CELL.liquid, 0x6b8a4a);
            }
            // trees: dense groves from noise
            for (int z = 4; z < t.size - 4; z += 2)
                for (int x = 4; x < t.size - 4; x += 2)
                {
                    double dens = Fbm(x / 16.0, z / 16.0, g.seed + 31);
                    if (dens < 0.5 || !rng.Chance((dens - 0.45) * 0.9)) continue;
                    int tx = x + rng.Int(0, 1), tz = z + rng.Int(0, 1);
                    if (!t.AreaFree(tx, tz, 1) || DistToCenter(g, tx, tz) < 9) continue;
                    int h = rng.Int(3, 5);
                    Tree(g, tx, tz, "trunk", "leaves", h, rng.Chance(0.18) ? 3 : rng.Int(0, 2));
                }
            // giant mushrooms
            for (int i = 0; i < 26; i++)
            {
                int x = rng.Int(6, t.size - 6), z = rng.Int(6, t.size - 6);
                if (!t.AreaFree(x, z, 1) || DistToCenter(g, x, z) < 10) continue;
                t.Column(x, z, 2, "mushroom", 1);
                for (int dz = -1; dz <= 1; dz++)
                    for (int dx = -1; dx <= 1; dx++) t.AddBlock(x + dx, 2, z + dz, "mushroom", 0);
                t.AddBlock(x, 3, z, "mushroom", 0);
            }
            // abandoned wooden huts (narrow interiors)
            for (int i = 0; i < 7; i++)
            {
                int x = rng.Int(15, t.size - 22), z = rng.Int(15, t.size - 22);
                if (DistToCenter(g, x + 3, z + 3) < 16) continue;
                int w = rng.Int(5, 8), d = rng.Int(5, 7);
                for (int dz = 0; dz <= d; dz++)
                    for (int dx = 0; dx <= w; dx++)
                    {
                        bool edge = dx == 0 || dz == 0 || dx == w || dz == d;
                        if (!edge)
                        {
                            t.SetTile(x + dx, z + dz, "path", CELL.floor);
                            continue;
                        }
                        if ((dx == w / 2 && (dz == 0 || dz == d)) || rng.Chance(0.15)) continue;
                        t.Column(x + dx, z + dz, rng.Int(1, 3), "plank");
                    }
            }
            for (int i = 0; i < 60; i++)
            {
                int x = rng.Int(6, t.size - 6), z = rng.Int(6, t.size - 6);
                if (DistToCenter(g, x, z) > 10) RockCluster(g, x, z, "stone", rng.Int(1, 4));
            }
            ScatterDecor(g, 1600, new[] { 0x6fb34a, 0x7cc455, 0x5a9a3a }, O(0.12, 0.35, true, false, "grass", "grass2"));
            ScatterDecor(g, 260, new[] { 0xe85a8a, 0xfff07a, 0x9a7aff, 0xffffff }, O(0.16, 0.22, true, false, "grass", "grass2"));
            ScatterDecor(g, 160, new[] { 0xc8483a, 0xb84aff, 0xe0d0b0 }, O(0.22, 0.25, false, false, "grass", "grass2", "dirt"));
            ScatterDecor(g, 120, new[] { 0x9aff6a }, O(0.12, 0.12, false, true, "bog"));
            Border(g, "stone", 3, 4);
            ClearCenter(g, 7, "grass");
        }

        // ------------------------------------------------------------------ Gloamhaven: abandoned city
        static void City(GenCtx g)
        {
            var t = g.t;
            var rng = g.rng;
            FillTiles(g, (x, z) => "cobble");
            const int block = 18, road = 4;
            // canal across the city with bridges
            int canalZ = g.c + rng.Int(18, 30) * (rng.Chance(0.5) ? 1 : -1);
            for (int x = 0; x < t.size; x++)
                for (int dz = -2; dz <= 2; dz++) t.SetTile(x, canalZ + dz, "water", CELL.liquid);
            for (int bx = 0; bx < t.size; bx += block)
                for (int dx = 0; dx < road; dx++)
                    for (int dz = -2; dz <= 2; dz++) t.SetTile(bx + dx, canalZ + dz, "road", CELL.floor);
            // street grid and building lots
            for (int by = 0; by < t.size; by += block)
                for (int bx = 0; bx < t.size; bx += block)
                {
                    for (int z = by; z < by + block; z++)
                        for (int x = bx; x < bx + block; x++)
                            if (x - bx < road || z - by < road) t.SetTile(x, z, "road");
                    int lx = bx + road, lz = by + road, lw = block - road;
                    if (Math.Abs(lz + lw / 2.0 - canalZ) < lw / 2.0 + 3) continue;
                    double cxm = lx + lw / 2.0, czm = lz + lw / 2.0;
                    if (DistToCenter(g, cxm, czm) < 14)
                    {
                        // central plaza with fountain
                        for (int z = lz; z < lz + lw; z++)
                            for (int x = lx; x < lx + lw; x++) t.SetTile(x, z, "plaza");
                        continue;
                    }
                    double kind = rng.Next();
                    if (kind < 0.18)
                    {
                        // small park
                        for (int z = lz; z < lz + lw; z++)
                            for (int x = lx; x < lx + lw; x++) t.SetTile(x, z, "grass");
                        for (int i = 0; i < 3; i++)
                        {
                            int x = rng.Int(lx + 2, lx + lw - 3), z = rng.Int(lz + 2, lz + lw - 3);
                            if (t.AreaFree(x, z, 1)) Tree(g, x, z, "plank", "roof", 3, 0);
                        }
                        continue;
                    }
                    if (kind < 0.3)
                    {
                        // plaza
                        for (int z = lz; z < lz + lw; z++)
                            for (int x = lx; x < lx + lw; x++) t.SetTile(x, z, "plaza");
                        continue;
                    }
                    // 1-4 buildings per lot with alleys between
                    bool split = rng.Chance(0.6);
                    double[][] parts = split
                        ? new[] { new double[] { lx + 1, lz + 1, lw / 2.0 - 2, lw - 2 }, new double[] { lx + lw / 2.0 + 1, lz + 1, lw / 2.0 - 2, lw - 2 } }
                        : new[] { new double[] { lx + 1, lz + 1, lw - 2, lw - 2 } };
                    foreach (var part in parts)
                    {
                        double x0 = part[0], z0 = part[1], w = part[2], d = part[3];
                        int h = rng.Int(3, 6);
                        bool ruined = rng.Chance(0.3);
                        int fx0 = (int)Math.Floor(x0), fz0 = (int)Math.Floor(z0);
                        for (int z = fz0; z < z0 + d; z++)
                            for (int x = fx0; x < x0 + w; x++)
                            {
                                bool edge = x == fx0 || z == fz0 || x >= x0 + w - 1 || z >= z0 + d - 1;
                                if (ruined)
                                {
                                    if (edge && rng.Chance(0.75))
                                    {
                                        int hh = rng.Int(1, h);
                                        t.Column(x, z, hh, rng.Chance(0.3) ? "stone" : "brick");
                                    }
                                    else t.SetTile(x, z, "dirt");
                                    continue;
                                }
                                t.Column(x, z, h, edge ? "brick" : "roof", edge ? -1 : rng.Int(0, 1));
                            }
                        if (!ruined)
                            for (int z = fz0; z < z0 + d; z++)
                                for (int x = fx0; x < x0 + w; x++) t.AddBlock(x, h, z, "roof");
                    }
                }
            // street lamps
            for (int by = 0; by < t.size; by += block)
                for (int bx = 0; bx < t.size; bx += block)
                {
                    int x = bx + road, z = by + road;
                    if (!t.IsFree(x, z)) continue;
                    t.Column(x, z, 2, "stone", 0);
                    t.AddBlock(x, 2, z, "lamp", 0, true);
                    t.lights.Add(new TerrainLight { x = x + 0.5, z = z + 0.5, y = 2.5, color = 0xffc66a, intensity = 1.6 });
                }
            // fountain at center
            Disk(g, g.c, g.c, 3.2, "plaza");
            ScatterDecor(g, 400, new[] { 0x4a4a52, 0x5a5048, 0x6a6a72 }, O(0.25, 0.12, false, false, "road", "cobble"));
            ScatterDecor(g, 300, new[] { 0x5a8a3a, 0x6a9a44 }, O(0.12, 0.3, true, false, "grass", "cobble"));
            Border(g, "brick", 3, 6);
            ClearCenter(g, 6, "plaza");
            for (int i = 0; i < 8; i++)
            {
                double a = i / 8.0 * Math.PI * 2;
                int x = MathX.RoundI(g.c + Math.Cos(a) * 4), z = MathX.RoundI(g.c + Math.Sin(a) * 4);
                t.AddBlock(x, 0, z, "stone", 1, false, 0.5);
            }
            t.AddBlock(g.c, 0, g.c, "lamp", 0, true, 0.7);
            t.lights.Add(new TerrainLight { x = g.c + 0.5, z = g.c + 0.5, y = 1.5, color = 0x9ad8ff, intensity = 1.4 });
        }

        class Room { public int x, z, w, d; }

        // ------------------------------------------------------------------ Ossuary Depths: catacombs
        static void Catacombs(GenCtx g)
        {
            var t = g.t;
            var rng = g.rng;
            int n = t.size;
            FillTiles(g, (x, z) => Fbm(x / 6.0, z / 6.0, g.seed) > 0.6 ? "tile" : "floor");
            var solid = new byte[n * n];
            for (int i = 0; i < solid.Length; i++) solid[i] = 1;
            var rooms = new List<Room> { new Room { x = g.c - 9, z = g.c - 9, w = 18, d = 18 } };
            for (int i = 0; i < 70 && rooms.Count < 26; i++)
            {
                int w = rng.Int(9, 18), d = rng.Int(9, 18);
                int x = rng.Int(5, n - w - 5), z = rng.Int(5, n - d - 5);
                if (rooms.Exists(r => x < r.x + r.w + 3 && x + w + 3 > r.x && z < r.z + r.d + 3 && z + d + 3 > r.z)) continue;
                rooms.Add(new Room { x = x, z = z, w = w, d = d });
            }
            void Carve(int x, int z)
            {
                if (x > 3 && z > 3 && x < n - 4 && z < n - 4) solid[z * n + x] = 0;
            }
            foreach (var r in rooms)
                for (int z = r.z; z < r.z + r.d; z++)
                    for (int x = r.x; x < r.x + r.w; x++) Carve(x, z);
            // connect rooms: each to nearest previous, plus extra loops
            void Corridor(Room a, Room b, int wdt)
            {
                int ax = (int)Math.Floor(a.x + a.w / 2.0), az = (int)Math.Floor(a.z + a.d / 2.0);
                int bx = (int)Math.Floor(b.x + b.w / 2.0), bz = (int)Math.Floor(b.z + b.d / 2.0);
                bool xf = rng.Chance(0.5);
                void Hx(int z, int x0, int x1)
                {
                    for (int x = Math.Min(x0, x1); x <= Math.Max(x0, x1); x++)
                        for (int k = 0; k < wdt; k++) Carve(x, z + k);
                }
                void Vz(int x, int z0, int z1)
                {
                    for (int z = Math.Min(z0, z1); z <= Math.Max(z0, z1); z++)
                        for (int k = 0; k < wdt; k++) Carve(x + k, z);
                }
                if (xf) { Hx(az, ax, bx); Vz(bx, az, bz); }
                else { Vz(ax, az, bz); Hx(bz, ax, bx); }
            }
            for (int i = 1; i < rooms.Count; i++)
            {
                int best = 0;
                double bd = 1e9;
                for (int j = 0; j < i; j++)
                {
                    double d = MathX.Hypot(rooms[i].x - rooms[j].x, rooms[i].z - rooms[j].z);
                    if (d < bd) { bd = d; best = j; }
                }
                Corridor(rooms[i], rooms[best], rng.Int(3, 4));
            }
            for (int i = 0; i < 10; i++)
            {
                var ra = rng.Pick(rooms);
                var rb = rng.Pick(rooms);
                Corridor(ra, rb, 3);
            }
            for (int z = 0; z < n; z++)
                for (int x = 0; x < n; x++)
                {
                    if (solid[z * n + x] == 0) continue;
                    // only build walls adjacent to open space; deep rock stays invisible solid
                    bool nearOpen = false;
                    for (int dz = -1; dz <= 1 && !nearOpen; dz++)
                        for (int dx = -1; dx <= 1; dx++)
                            if (z + dz >= 0 && x + dx >= 0 && z + dz < n && x + dx < n && solid[(z + dz) * n + x + dx] == 0) nearOpen = true;
                    if (nearOpen) t.Column(x, z, 3, "wall");
                    else
                    {
                        t.SetCell(x, z, CELL.solid);
                        t.AddBlock(x, 2, z, "wall", 0);
                    }
                }
            // room features
            for (int ri = 1; ri < rooms.Count; ri++)
            {
                var r = rooms[ri];
                double f = rng.Next();
                if (f < 0.35)
                {
                    // pillars grid
                    for (int z = r.z + 3; z < r.z + r.d - 3; z += 4)
                        for (int x = r.x + 3; x < r.x + r.w - 3; x += 4) t.Column(x, z, 3, "pillar");
                }
                else if (f < 0.55)
                {
                    // lava pit (hazard)
                    double cx = r.x + r.w / 2.0, cz = r.z + r.d / 2.0;
                    Disk(g, cx, cz, Math.Min(r.w, r.d) / 2.0 - 3, "lava", CELL.hazard);
                    t.lights.Add(new TerrainLight { x = cx, z = cz, y = 1, color = 0xff6a1a, intensity = 2 });
                }
                else if (f < 0.75)
                {
                    // crypt with coffins
                    for (int i = 0; i < 4; i++)
                    {
                        int x = rng.Int(r.x + 2, r.x + r.w - 4), z = rng.Int(r.z + 2, r.z + r.d - 3);
                        if (t.IsFree(x, z) && t.IsFree(x + 1, z))
                        {
                            t.Column(x, z, 1, "coffin");
                            t.Column(x + 1, z, 1, "coffin");
                        }
                    }
                }
                else
                {
                    for (int i = 0; i < 6; i++)
                    {
                        int tx = rng.Int(r.x, r.x + r.w - 1);
                        int tz = rng.Int(r.z, r.z + r.d - 1);
                        t.SetTile(tx, tz, "moss");
                    }
                    RockCluster(g, (int)Math.Floor(r.x + r.w / 2.0), (int)Math.Floor(r.z + r.d / 2.0), "bone", 4);
                }
                // wall torches at room corners
                int[][] corners = { new[] { r.x, r.z }, new[] { r.x + r.w - 1, r.z + r.d - 1 }, new[] { r.x + r.w - 1, r.z }, new[] { r.x, r.z + r.d - 1 } };
                foreach (var c in corners)
                {
                    if (!rng.Chance(0.6)) continue;
                    t.AddBlock(c[0], 1.3, c[1], "torch", 0, true, 0.35);
                    t.lights.Add(new TerrainLight { x = c[0] + 0.5, z = c[1] + 0.5, y = 1.6, color = 0xff9a3a, intensity = 1.8 });
                }
            }
            ScatterDecor(g, 500, new[] { 0xd8d0b8, 0xc8c0a8, 0xe8e0c8 }, O(0.2, 0.12, false, false, "floor", "tile"));
            ScatterDecor(g, 120, new[] { 0x5aff9a }, O(0.1, 0.1, false, true, "moss"));
            Border(g, "wall", 3, 3);
            ClearCenter(g, 6, "tile");
            SealUnreachable(g);
        }

        // ------------------------------------------------------------------ Emberwaste: volcanic lands
        static void Volcano(GenCtx g)
        {
            var t = g.t;
            var rng = g.rng;
            FillTiles(g, (x, z) =>
            {
                double v = Fbm(x / 10.0, z / 10.0, g.seed);
                return v > 0.66 ? "basalt" : v < 0.3 ? "scorch" : "ash";
            });
            // lava rivers: ridged noise bands
            for (int z = 0; z < t.size; z++)
                for (int x = 0; x < t.size; x++)
                {
                    double v = Fbm(x / 22.0, z / 22.0, g.seed + 5);
                    double band = Math.Abs(v - 0.5);
                    if (DistToCenter(g, x, z) < 14) continue;
                    if (band < 0.02) t.SetTile(x, z, "lava", CELL.liquid);
                    else if (band < 0.04) t.SetTile(x, z, "lava", CELL.hazard);
                }
            // basalt bridges across rivers
            for (int i = 0; i < 40; i++)
            {
                int x = rng.Int(8, t.size - 8), z = rng.Int(8, t.size - 8);
                if (t.tile[t.Idx(x, z)] != t.TileId("lava")) continue;
                bool horiz = rng.Chance(0.5);
                for (int k = -5; k <= 5; k++)
                    for (int w = 0; w < 3; w++) t.SetTile(horiz ? x + k : x + w, horiz ? z + w : z + k, "basalt", CELL.floor);
            }
            // lava lakes
            for (int i = 0; i < 7; i++)
            {
                int x = rng.Int(15, t.size - 15), z = rng.Int(15, t.size - 15);
                if (DistToCenter(g, x, z) < 22) continue;
                Pond(g, x, z, rng.Int(3, 6), "lava", CELL.liquid);
                t.lights.Add(new TerrainLight { x = x, z = z, y = 1, color = 0xff5a0a, intensity = 2.2 });
            }
            // sulfur vents
            Blobs(g, 8, 0.78, 11, (x, z, v) =>
            {
                if (t.IsFree(x, z)) t.SetTile(x, z, "sulfur");
            });
            // obsidian spires and basalt boulders
            for (int i = 0; i < 160; i++)
            {
                int x = rng.Int(6, t.size - 6), z = rng.Int(6, t.size - 6);
                if (!t.AreaFree(x, z, 1) || DistToCenter(g, x, z) < 9) continue;
                if (rng.Chance(0.45))
                {
                    int h = rng.Int(3, 6);
                    t.Column(x, z, h, "obsidian");
                    if (rng.Chance(0.5)) t.Column(x + 1, z, h - rng.Int(1, 2), "obsidian");
                    if (rng.Chance(0.3))
                    {
                        t.AddBlock(x, h, z, "crystal", 0, true, 0.6);
                        t.lights.Add(new TerrainLight { x = x + 0.5, z = z + 0.5, y = h + 0.5, color = 0xff8a3a, intensity = 1.2 });
                    }
                }
                else RockCluster(g, x, z, "basalt", rng.Int(2, 5));
            }
            // giant bones of ancient beasts
            for (int i = 0; i < 6; i++)
            {
                int x = rng.Int(20, t.size - 20), z = rng.Int(20, t.size - 20);
                if (DistToCenter(g, x, z) < 20) continue;
                for (int k = 0; k < 7; k++)
                {
                    if (t.IsFree(x + k * 2, z)) t.Column(x + k * 2, z, 2 + (k % 2), "bone");
                    if (t.IsFree(x + k * 2, z + 4)) t.Column(x + k * 2, z + 4, 2 + (k % 2), "bone");
                }
            }
            ScatterDecor(g, 400, new[] { 0xff6a1a, 0xffaa3a }, O(0.1, 0.1, false, true, "scorch", "ash"));
            ScatterDecor(g, 500, new[] { 0x2a2428, 0x3a3236 }, O(0.25, 0.15, false, false, "ash", "basalt"));
            Border(g, "obsidian", 3, 5);
            ClearCenter(g, 7, "basalt");
        }

        // ------------------------------------------------------------------ Frostveil: ice waste
        static void Tundra(GenCtx g)
        {
            var t = g.t;
            var rng = g.rng;
            FillTiles(g, (x, z) => Fbm(x / 8.0, z / 8.0, g.seed) > 0.6 ? "snow2" : "snow");
            // frozen lakes (slippery) with open water holes
            Blobs(g, 18, 0.62, 4, (x, z, v) =>
            {
                if (DistToCenter(g, x, z) < 10) return;
                if (v > 0.78) t.SetTile(x, z, "water", CELL.liquid);
                else t.SetTile(x, z, "ice", CELL.ice);
            });
            // rocky ridges
            Blobs(g, 9, 0.76, 13, (x, z, v) =>
            {
                if (DistToCenter(g, x, z) > 12 && t.IsFree(x, z)) t.SetTile(x, z, "rock");
            });
            for (int z = 4; z < t.size - 4; z += 3)
                for (int x = 4; x < t.size - 4; x += 3)
                {
                    double dens = Fbm(x / 14.0, z / 14.0, g.seed + 21);
                    if (dens < 0.52 || !rng.Chance(0.55)) continue;
                    int tx = x + rng.Int(0, 1), tz = z + rng.Int(0, 1);
                    if (!t.AreaFree(tx, tz, 1) || DistToCenter(g, tx, tz) < 9) continue;
                    Pine(g, tx, tz, rng.Int(4, 6));
                }
            // ice crystal formations
            for (int i = 0; i < 40; i++)
            {
                int x = rng.Int(6, t.size - 6), z = rng.Int(6, t.size - 6);
                if (!t.AreaFree(x, z, 1) || DistToCenter(g, x, z) < 10) continue;
                t.Column(x, z, rng.Int(2, 4), "ice", -1, CELL.solid, false);
                if (rng.Chance(0.6))
                {
                    int ox = x + rng.Int(-1, 1);
                    t.Column(ox, z + 1, rng.Int(1, 2), "ice");
                }
                t.lights.Add(new TerrainLight { x = x + 0.5, z = z + 0.5, y = 1.5, color = 0x8ad8ff, intensity = 0.8 });
            }
            // snowdrifts (low walls creating passages)
            for (int i = 0; i < 30; i++)
            {
                int x = rng.Int(8, t.size - 8), z = rng.Int(8, t.size - 8);
                bool dir = rng.Chance(0.5);
                for (int k = 0; k < rng.Int(5, 12); k++)
                {
                    if (t.IsFree(x, z) && DistToCenter(g, x, z) > 9) t.Column(x, z, 1, "snow");
                    if (dir) x++;
                    else z++;
                    if (rng.Chance(0.3))
                    {
                        if (dir) z += rng.Int(-1, 1);
                        else x += rng.Int(-1, 1);
                    }
                }
            }
            for (int i = 0; i < 50; i++)
            {
                int x = rng.Int(6, t.size - 6);
                int z = rng.Int(6, t.size - 6);
                RockCluster(g, x, z, "rock", rng.Int(1, 4));
            }
            ScatterDecor(g, 500, new[] { 0xffffff, 0xe8f0ff }, O(0.22, 0.12, false, false, "snow", "snow2"));
            ScatterDecor(g, 200, new[] { 0x8a9a7a, 0x7a8a6a }, O(0.1, 0.25, true, false, "snow2", "rock"));
            Border(g, "ice", 3, 4);
            ClearCenter(g, 7, "snow");
        }

        // ------------------------------------------------------------------ Aetherfall: ancient ruins
        static void Ruins(GenCtx g)
        {
            var t = g.t;
            var rng = g.rng;
            FillTiles(g, (x, z) => Fbm(x / 10.0, z / 10.0, g.seed) > 0.62 ? "moss" : "sand");
            // marble plazas
            for (int i = 0; i < 14; i++)
            {
                int x = rng.Int(15, t.size - 15), z = rng.Int(15, t.size - 15);
                int r = rng.Int(5, 9);
                Disk(g, x, z, r, "marble");
                // pillar ring
                int k = rng.Int(6, 10);
                for (int j = 0; j < k; j++)
                {
                    double a = (double)j / k * Math.PI * 2;
                    int px = MathX.RoundI(x + Math.Cos(a) * (r - 1)), pz = MathX.RoundI(z + Math.Sin(a) * (r - 1));
                    if (DistToCenter(g, px, pz) < 9 || !t.IsFree(px, pz)) continue;
                    bool broken = rng.Chance(0.35);
                    int h = broken ? rng.Int(1, 2) : rng.Int(3, 5);
                    t.Column(px, pz, h, "marble");
                    if (!broken) t.AddBlock(px, h, pz, "gold", 0);
                    if (rng.Chance(0.3)) t.AddBlock(px, h - 1, pz, "vine", 0, false, 1.05);
                }
            }
            // rune circles: glowing tiles used by arcane surge event
            for (int i = 0; i < 10; i++)
            {
                int x = rng.Int(15, t.size - 15), z = rng.Int(15, t.size - 15);
                if (DistToCenter(g, x, z) < 12) continue;
                for (int a = 0; a < 32; a++)
                {
                    int cx = MathX.RoundI(x + Math.Cos(a / 32.0 * Math.PI * 2) * 3), cz = MathX.RoundI(z + Math.Sin(a / 32.0 * Math.PI * 2) * 3);
                    if (t.IsFree(cx, cz)) t.SetTile(cx, cz, "rune");
                }
                t.SetTile(x, z, "rune");
                t.markers.Add(new Marker { x = x + 0.5, z = z + 0.5, kind = "rune" });
                t.lights.Add(new TerrainLight { x = x + 0.5, z = z + 0.5, y = 1, color = 0x8a6aff, intensity = 1.2 });
            }
            // void chasms (impassable for walkers)
            Blobs(g, 16, 0.75, 7, (x, z, v) =>
            {
                if (DistToCenter(g, x, z) > 16 && t.IsFree(x, z)) t.SetTile(x, z, "void", CELL.liquid);
            });
            // broken walls with gaps (corridors)
            for (int i = 0; i < 45; i++)
            {
                int x = rng.Int(8, t.size - 8), z = rng.Int(8, t.size - 8);
                bool horiz = rng.Chance(0.5);
                int len = rng.Int(6, 16);
                for (int k = 0; k < len; k++)
                {
                    if (t.IsFree(x, z) && DistToCenter(g, x, z) > 10 && !rng.Chance(0.15)) t.Column(x, z, rng.Int(1, 3), "sandstone");
                    if (horiz) x++;
                    else z++;
                }
            }
            // crystal clusters & golden statues
            for (int i = 0; i < 30; i++)
            {
                int x = rng.Int(6, t.size - 6), z = rng.Int(6, t.size - 6);
                if (!t.AreaFree(x, z, 1) || DistToCenter(g, x, z) < 10) continue;
                if (rng.Chance(0.6))
                {
                    t.Column(x, z, rng.Int(1, 3), "crystal", 0, CELL.solid, true);
                    t.lights.Add(new TerrainLight { x = x + 0.5, z = z + 0.5, y = 1.5, color = 0x9a7aff, intensity = 1 });
                }
                else
                {
                    t.Column(x, z, 1, "marble");
                    t.Column(x, z, 3, "gold");
                }
            }
            ScatterDecor(g, 500, new[] { 0x5a8a4a, 0x6a9a54 }, O(0.12, 0.3, true, false, "moss", "sand"));
            ScatterDecor(g, 200, new[] { 0xb89a6a, 0xd8c8a8 }, O(0.25, 0.15, false, false, "sand", "marble"));
            ScatterDecor(g, 150, new[] { 0xb89aff }, O(0.08, 0.08, false, true, "rune", "void"));
            Border(g, "sandstone", 3, 4);
            ClearCenter(g, 7, "marble");
        }

        static readonly Dictionary<string, Action<GenCtx>> GENERATORS = new Dictionary<string, Action<GenCtx>>
        {
            { "forest", Forest }, { "city", City }, { "catacombs", Catacombs }, { "volcano", Volcano }, { "tundra", Tundra }, { "ruins", Ruins },
        };

        /// <summary>Builds the terrain for a map. Each run uses a new seed so layouts vary.</summary>
        public static Terrain GenerateTerrain(MapDef map, long seed)
        {
            var t = new Terrain(map.size);
            var g = new GenCtx { t = t, rng = new Rng(seed), seed = seed % 100000, c = map.size / 2 };
            // register palette tiles first so ids are stable
            foreach (var name in map.palette.tiles.Keys) t.TileId(name);
            if (!GENERATORS.TryGetValue(map.generator ?? "", out var gen)) gen = Forest;
            gen(g);
            t.CullHidden();
            return t;
        }
    }
}
