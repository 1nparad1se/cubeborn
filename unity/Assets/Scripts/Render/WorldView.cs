using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Cubeborn.View
{
    /// <summary>Static voxel world: shader-tiled ground, merged block chunks, decor and glowing blocks.</summary>
    public class WorldView
    {
        const int ChunkSize = 16;
        public readonly GameObject root;
        readonly List<UnityEngine.Object> owned = new List<UnityEngine.Object>();

        static int TileAnim(string name)
        {
            if (name.Contains("water")) return 1;
            if (name.Contains("lava")) return 2;
            if (name.Contains("bog")) return 3;
            if (name.Contains("void")) return 4;
            if (name.Contains("rune")) return 5;
            if (name.Contains("ice")) return 6;
            return 0;
        }

        public WorldView(Terrain terrain, MapDef map, string quality)
        {
            root = new GameObject("World");
            BuildGround(terrain, map);
            BuildBlocks(terrain, map, quality);
            BuildDecor(terrain, quality);
        }

        GameObject AddRenderer(string name, Mesh mesh, Material mat, bool cast, bool receive = true)
        {
            var go = new GameObject(name);
            go.transform.SetParent(root.transform, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = cast ? ShadowCastingMode.On : ShadowCastingMode.Off;
            r.receiveShadows = receive;
            r.lightProbeUsage = LightProbeUsage.Off;
            r.reflectionProbeUsage = ReflectionProbeUsage.Off;
            owned.Add(mesh);
            return go;
        }

        void BuildGround(Terrain t, MapDef map)
        {
            int n = t.size;
            var cells = new Texture2D(n, n, TextureFormat.RGBA32, false, true) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
            var data = new Color32[n * n];
            for (int i = 0; i < n * n; i++)
            {
                int x = i % n, z = i / n;
                data[i] = new Color32(t.tile[i], (byte)Math.Floor(Rng.Hash2(x, z, 5) * Gfx.AtlasVariants), 0, 255);
            }
            cells.SetPixels32(data);
            cells.Apply(false, false);
            var atlas = Gfx.MakeGroundAtlas(t.tileNames, map.palette.tiles);
            var anims = new float[32];
            for (int i = 0; i < t.tileNames.Count && i < 32; i++) anims[i] = TileAnim(t.tileNames[i]);
            var mat = Gfx.Ground();
            mat.SetTexture("_Cells", cells);
            mat.SetTexture("_Atlas", atlas);
            mat.SetFloat("_Size", n);
            mat.SetFloat("_Tiles", Math.Max(1, t.tileNames.Count));
            mat.SetFloatArray("_Anim", anims);
            owned.Add(cells); owned.Add(atlas); owned.Add(mat);

            var mesh = new Mesh { name = "ground" };
            mesh.SetVertices(new List<Vector3> { Gfx.U(0, 0, 0), Gfx.U(n, 0, 0), Gfx.U(n, 0, n), Gfx.U(0, 0, n) });
            mesh.SetNormals(new List<Vector3> { Vector3.up, Vector3.up, Vector3.up, Vector3.up });
            // game z grows towards -Unity z, so (0,0)->(n,0)->(n,n) is clockwise seen from above
            mesh.SetTriangles(new[] { 0, 1, 2, 0, 2, 3 }, 0);
            mesh.RecalculateBounds();
            AddRenderer("ground", mesh, mat, false, true);
        }

        static long Key(long x, long y, long z) => (y * 4096 + z) * 4096 + x;

        void BuildBlocks(Terrain t, MapDef map, string quality)
        {
            int n = t.size;
            int chunks = (n + ChunkSize - 1) / ChunkSize;
            var mat = Gfx.Voxel();
            mat.SetFloat("_Dither", 1);
            var glowMat = Gfx.Voxel(null, true);
            owned.Add(mat); owned.Add(glowMat);
            // full blocks on integer coordinates hide each other's touching faces
            var full = new HashSet<long>();
            foreach (var b in t.blocks)
                if (b.s == 0 && b.x == Math.Floor(b.x) && b.y == Math.Floor(b.y) && b.z == Math.Floor(b.z))
                    full.Add(Key((long)b.x, (long)b.y, (long)b.z));
            var bufs = new VoxelMesh.Buf[chunks * chunks];
            var glowBuf = new VoxelMesh.Buf();
            var pal = map.palette.blocks;
            foreach (var b in t.blocks)
            {
                VoxelMesh.Buf buf;
                if (b.glow) buf = glowBuf;
                else
                {
                    int cx = Math.Min(chunks - 1, Math.Max(0, (int)Math.Floor(b.x / ChunkSize)));
                    int cz = Math.Min(chunks - 1, Math.Max(0, (int)Math.Floor(b.z / ChunkSize)));
                    buf = bufs[cz * chunks + cx] ?? (bufs[cz * chunks + cx] = new VoxelMesh.Buf());
                }
                int[] colors = pal.TryGetValue(b.mat ?? "", out var cs) && cs.Length > 0 ? cs : new[] { 0x888888 };
                int hex = colors[((b.v % colors.Length) + colors.Length) % colors.Length];
                double shade = 0.9 + Rng.Hash2(b.x * 3 + b.y, b.z, 11) * 0.16;
                var raw = Gfx.Raw(hex);
                var c = new Color(Gfx.ToSrgb((float)(Gfx.ToLin(raw.r) * shade)), Gfx.ToSrgb((float)(Gfx.ToLin(raw.g) * shade)), Gfx.ToSrgb((float)(Gfx.ToLin(raw.b) * shade)), 0);
                double s = b.s != 0 ? b.s : 1;
                float px = (float)(b.x + 0.5), py = (float)b.y, pz = (float)(b.z + 0.5);
                float h = (float)(s / 2);
                int skip = 0;
                if (b.s == 0 && !b.glow && full.Count > 0 && b.x == Math.Floor(b.x) && b.y == Math.Floor(b.y) && b.z == Math.Floor(b.z))
                {
                    long x = (long)b.x, y = (long)b.y, z = (long)b.z;
                    if (full.Contains(Key(x + 1, y, z))) skip |= 1;
                    if (full.Contains(Key(x - 1, y, z))) skip |= 2;
                    if (full.Contains(Key(x, y + 1, z))) skip |= 4;
                    if (y == 0 || full.Contains(Key(x, y - 1, z))) skip |= 8;
                    if (full.Contains(Key(x, y, z + 1))) skip |= 16;
                    if (full.Contains(Key(x, y, z - 1))) skip |= 32;
                    if (skip == 63) continue;
                }
                buf.Box(px - h, px + h, py, py + (float)s, pz - h, pz + h, c, 1, 1, 1, skip);
            }
            bool shadows = quality != "low";
            for (int i = 0; i < bufs.Length; i++)
                if (bufs[i] != null && bufs[i].pos.Count > 0) AddRenderer("chunk" + i, bufs[i].ToMesh("chunk"), mat, shadows);
            if (glowBuf.pos.Count > 0) AddRenderer("glowBlocks", glowBuf.ToMesh("glow"), glowMat, false, false);
        }

        void BuildDecor(Terrain t, string quality)
        {
            var list = t.decor;
            if (list.Count == 0) return;
            var mat = Gfx.Voxel(Gfx.White);
            mat.SetFloat("_Sway", 1);
            var glowMat = Gfx.Voxel(Gfx.White, true);
            owned.Add(mat); owned.Add(glowMat);
            var normal = new VoxelMesh.Buf { useSway = true };
            var glow = new VoxelMesh.Buf();
            for (int i = 0; i < list.Count; i++)
            {
                if (quality == "low" && i % 3 != 0) continue;
                var d = list[i];
                double hh = d.h > 0 ? d.h : d.size;
                var c = Gfx.Raw(d.color, 0);
                float x0 = (float)(d.x - d.size / 2), x1 = (float)(d.x + d.size / 2);
                float z0 = (float)(d.z - d.size / 2), z1 = (float)(d.z + d.size / 2);
                float y0 = (float)d.y, y1 = (float)(d.y + hh);
                if (d.glow) glow.Box(x0, x1, y0, y1, z0, z1, c, 1, 1, 1);
                else
                {
                    float ph = (float)(d.x * 0.7 + d.z * 0.5);
                    float amp = d.sway ? (float)(d.size / hh) : 0;
                    normal.swayBase = y0;
                    normal.Box(x0, x1, y0, y1, z0, z1, c, 1, 1, 1, 0, new Vector3(ph, 0.12f * amp, 0.08f * amp));
                }
            }
            if (normal.pos.Count > 0)
            {
                var m = normal.ToMesh("decor");
                var bnd = m.bounds;
                bnd.Expand(1);
                m.bounds = bnd;
                AddRenderer("decor", m, mat, false);
            }
            if (glow.pos.Count > 0) AddRenderer("decorGlow", glow.ToMesh("decorGlow"), glowMat, false, false);
        }

        public void Destroy()
        {
            UnityEngine.Object.Destroy(root);
            foreach (var o in owned) UnityEngine.Object.Destroy(o);
            owned.Clear();
        }
    }
}
