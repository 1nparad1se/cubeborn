using System;

namespace Cubeborn
{
    /// <summary>Uniform grid rebuilt every frame with a counting sort. Items referenced by index.</summary>
    public class SpatialGrid
    {
        public readonly int Cols, Rows;
        readonly double cellSize;
        readonly int[] cellStart, cellCount;
        int[] items, itemCell;

        public SpatialGrid(double width, double height, double cellSize, int capacity)
        {
            this.cellSize = cellSize;
            Cols = (int)Math.Ceiling(width / cellSize);
            Rows = (int)Math.Ceiling(height / cellSize);
            int cells = Cols * Rows;
            cellStart = new int[cells + 1];
            cellCount = new int[cells];
            items = new int[capacity];
            itemCell = new int[capacity];
        }

        void Ensure(int cap)
        {
            if (cap <= items.Length) return;
            int n = Math.Max(cap, items.Length * 2);
            items = new int[n];
            itemCell = new int[n];
        }

        public int CellOf(double x, double z)
        {
            int cx = (int)Math.Floor(x / cellSize), cz = (int)Math.Floor(z / cellSize);
            if (cx < 0) cx = 0; else if (cx >= Cols) cx = Cols - 1;
            if (cz < 0) cz = 0; else if (cz >= Rows) cz = Rows - 1;
            return cz * Cols + cx;
        }

        public void Rebuild(int count, float[] xs, float[] zs, Func<int, bool> active)
        {
            Ensure(count);
            Array.Clear(cellCount, 0, cellCount.Length);
            for (int i = 0; i < count; i++)
            {
                if (!active(i)) { itemCell[i] = -1; continue; }
                int c = CellOf(xs[i], zs[i]);
                itemCell[i] = c;
                cellCount[c]++;
            }
            int cells = cellCount.Length, acc = 0;
            for (int c = 0; c < cells; c++) { cellStart[c] = acc; acc += cellCount[c]; }
            cellStart[cells] = acc;
            for (int c = 0; c < cells; c++) cellCount[c] = cellStart[c];
            for (int i = 0; i < count; i++)
            {
                int c = itemCell[i];
                if (c < 0) continue;
                items[cellCount[c]++] = i;
            }
        }

        /// <summary>Collects item indices in cells overlapping the circle (no allocation).</summary>
        public void Collect(double x, double z, double r, System.Collections.Generic.List<int> outList)
        {
            outList.Clear();
            int x0 = (int)Math.Floor((x - r) / cellSize), x1 = (int)Math.Floor((x + r) / cellSize);
            int z0 = (int)Math.Floor((z - r) / cellSize), z1 = (int)Math.Floor((z + r) / cellSize);
            if (x0 < 0) x0 = 0;
            if (z0 < 0) z0 = 0;
            if (x1 >= Cols) x1 = Cols - 1;
            if (z1 >= Rows) z1 = Rows - 1;
            for (int cz = z0; cz <= z1; cz++)
            {
                int row = cz * Cols;
                for (int cx = x0; cx <= x1; cx++)
                {
                    int c = row + cx, end = cellStart[c + 1];
                    for (int k = cellStart[c]; k < end; k++) outList.Add(items[k]);
                }
            }
        }

        /// <summary>Calls fn for each item in cells overlapping the circle. Return true from fn to stop.</summary>
        public void Query(double x, double z, double r, Func<int, bool> fn)
        {
            int x0 = (int)Math.Floor((x - r) / cellSize), x1 = (int)Math.Floor((x + r) / cellSize);
            int z0 = (int)Math.Floor((z - r) / cellSize), z1 = (int)Math.Floor((z + r) / cellSize);
            if (x0 < 0) x0 = 0;
            if (z0 < 0) z0 = 0;
            if (x1 >= Cols) x1 = Cols - 1;
            if (z1 >= Rows) z1 = Rows - 1;
            for (int cz = z0; cz <= z1; cz++)
            {
                int row = cz * Cols;
                for (int cx = x0; cx <= x1; cx++)
                {
                    int c = row + cx, end = cellStart[c + 1];
                    for (int k = cellStart[c]; k < end; k++)
                        if (fn(items[k])) return;
                }
            }
        }
    }
}
