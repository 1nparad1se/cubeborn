using System;
using System.Collections.Generic;

namespace Cubeborn
{
    /// <summary>Cell kinds on the navigation grid (1 cell = 1 world unit = 1 block).</summary>
    public static class CELL
    {
        public const byte floor = 0;
        public const byte solid = 1; // blocks walkers, flyers pass
        public const byte liquid = 2; // water/lava lake/void: blocks walkers, flyers pass
        public const byte hazard = 3; // walkable, damages the player
        public const byte ice = 4; // walkable, slippery
        public const byte wall = 5; // map border: blocks everything
    }

    public class Block
    {
        public double x, y, z;
        public string mat;
        /// <summary>Variant index into the material color list.</summary>
        public int v;
        /// <summary>Optional size (0 = a full block).</summary>
        public double s;
        public bool glow;
    }

    public class Decor
    {
        public double x, z, y, size, h;
        public int color;
        /// <summary>Sways in the wind.</summary>
        public bool sway, glow;
    }

    public class TerrainLight
    {
        public double x, z, y, intensity;
        public int color;
    }

    public class Marker
    {
        public double x, z;
        public string kind;
    }

    public class Terrain
    {
        public readonly int size;
        public readonly byte[] cell, tile;
        /// <summary>Column height used for block culling and visuals.</summary>
        public readonly byte[] height;
        public readonly List<Block> blocks = new List<Block>();
        public readonly List<Decor> decor = new List<Decor>();
        public readonly List<TerrainLight> lights = new List<TerrainLight>();
        /// <summary>Special markers used by events (rune circles etc).</summary>
        public readonly List<Marker> markers = new List<Marker>();
        public List<string> tileNames = new List<string>();

        public Terrain(int size)
        {
            this.size = size;
            cell = new byte[size * size];
            tile = new byte[size * size];
            height = new byte[size * size];
        }

        public int Idx(int cx, int cz) => cz * size + cx;
        public bool InBounds(int cx, int cz) => cx >= 0 && cz >= 0 && cx < size && cz < size;
        public int CellAt(double x, double z)
        {
            int cx = (int)Math.Floor(x), cz = (int)Math.Floor(z);
            if (!InBounds(cx, cz)) return CELL.wall;
            return cell[cz * size + cx];
        }
        public bool BlocksWalker(int cx, int cz)
        {
            if (!InBounds(cx, cz)) return true;
            int c = cell[cz * size + cx];
            return c == CELL.solid || c == CELL.liquid || c == CELL.wall;
        }
        public bool BlocksFlyer(int cx, int cz)
        {
            if (!InBounds(cx, cz)) return true;
            return cell[cz * size + cx] == CELL.wall;
        }
        public bool WalkableAt(double x, double z) => !BlocksWalker((int)Math.Floor(x), (int)Math.Floor(z));

        public int TileId(string name)
        {
            int i = tileNames.IndexOf(name);
            if (i < 0) { i = tileNames.Count; tileNames.Add(name); }
            return i;
        }
        public void SetTile(int cx, int cz, string name, int cellKind = -1)
        {
            if (!InBounds(cx, cz)) return;
            int i = Idx(cx, cz);
            if (cell[i] == CELL.wall) return;
            tile[i] = (byte)TileId(name);
            if (cellKind >= 0) cell[i] = (byte)cellKind;
        }
        public void SetCell(int cx, int cz, int c)
        {
            if (!InBounds(cx, cz)) return;
            int i = Idx(cx, cz);
            if (cell[i] == CELL.wall) return;
            cell[i] = (byte)c;
        }

        /// <summary>Raises a solid column of blocks.</summary>
        public void Column(int cx, int cz, int h, string mat, int v = -1, int c = CELL.solid, bool glow = false)
        {
            if (!InBounds(cx, cz)) return;
            int i = Idx(cx, cz);
            if (cell[i] == CELL.wall && c != CELL.wall) return;
            cell[i] = (byte)c;
            height[i] = (byte)Math.Max(height[i], h);
            for (int y = 0; y < h; y++) blocks.Add(new Block { x = cx, y = y, z = cz, mat = mat, v = v < 0 ? (cx * 7 + cz * 13 + y * 3) & 7 : v, glow = glow });
        }

        /// <summary>Adds a non-colliding block (canopy, roofs overhang, ornaments).</summary>
        public void AddBlock(double x, double y, double z, string mat, int v = -1, bool glow = false, double s = 0)
        {
            blocks.Add(new Block { x = x, y = y, z = z, mat = mat, v = v < 0 ? ((int)(x * 5 + z * 11 + y * 7)) & 7 : v, glow = glow, s = s });
        }

        public bool IsFree(int cx, int cz) => InBounds(cx, cz) && cell[Idx(cx, cz)] == CELL.floor;

        public bool AreaFree(int cx, int cz, int r)
        {
            for (int z = cz - r; z <= cz + r; z++)
                for (int x = cx - r; x <= cx + r; x++)
                    if (!IsFree(x, z)) return false;
            return true;
        }

        /// <summary>Removes blocks hidden on all four sides by taller neighbours (keeps tops).</summary>
        public void CullHidden()
        {
            var occupied = new HashSet<double>();
            double Key(double x, double y, double z) => (y * size + z) * size + x;
            foreach (var b in blocks) if (b.s == 0) occupied.Add(Key(b.x, b.y, b.z));
            var outList = new List<Block>(blocks.Count);
            foreach (var b in blocks)
            {
                if (b.s != 0 || b.glow) { outList.Add(b); continue; }
                bool top = !occupied.Contains(Key(b.x, b.y + 1, b.z));
                bool hidden = !top &&
                    occupied.Contains(Key(b.x + 1, b.y, b.z)) &&
                    occupied.Contains(Key(b.x - 1, b.y, b.z)) &&
                    occupied.Contains(Key(b.x, b.y, b.z + 1)) &&
                    occupied.Contains(Key(b.x, b.y, b.z - 1));
                if (!hidden) outList.Add(b);
            }
            blocks.Clear();
            blocks.AddRange(outList);
        }
    }
}
