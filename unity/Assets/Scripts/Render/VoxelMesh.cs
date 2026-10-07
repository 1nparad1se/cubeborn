using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Cubeborn.View
{
    /// <summary>
    /// Builds Unity meshes from voxel models (boxes with colours and tags). Geometry is generated
    /// in game space and mirrored on z; triangle winding is flipped to stay front-facing.
    /// </summary>
    public static class VoxelMesh
    {
        /// <summary>Tag offsets used to build the two walking frames of instanced enemies.</summary>
        static readonly Dictionary<string, float[][]> FrameOffsets = new Dictionary<string, float[][]>
        {
            { "legL", new[] { new[] { 0f, 0.6f, 1.2f }, new[] { 0f, 0f, -1.2f } } },
            { "legR", new[] { new[] { 0f, 0f, -1.2f }, new[] { 0f, 0.6f, 1.2f } } },
            { "armL", new[] { new[] { 0f, 0f, -1f }, new[] { 0f, 0f, 1f } } },
            { "armR", new[] { new[] { 0f, 0f, 1f }, new[] { 0f, 0f, -1f } } },
            { "wingL", new[] { new[] { 0f, 1.6f, 0f }, new[] { 0f, -1.4f, 0f } } },
            { "wingR", new[] { new[] { 0f, 1.6f, 0f }, new[] { 0f, -1.4f, 0f } } },
            { "tail", new[] { new[] { 0.8f, 0f, 0f }, new[] { -0.8f, 0f, 0f } } },
            { "jaw", new[] { new[] { 0f, 0f, 0f }, new[] { 0f, -0.8f, 0f } } },
        };

        public static readonly string[] Tags = { "legL", "legR", "armL", "armR", "head", "wingL", "wingR", "tail", "jaw", "lid" };

        /// <summary>Growable vertex buffers shared by the builders.</summary>
        public class Buf
        {
            public readonly List<Vector3> pos = new List<Vector3>();
            public readonly List<Vector3> nor = new List<Vector3>();
            public readonly List<Vector2> uv = new List<Vector2>();
            public readonly List<Color> col = new List<Color>();
            public readonly List<Vector3> sway = new List<Vector3>();
            public readonly List<int> idx = new List<int>();
            public bool useSway;
            /// <summary>Game-space y where sway amplitude is zero (base of the swaying box).</summary>
            public float swayBase;

            public void Clear()
            {
                pos.Clear(); nor.Clear(); uv.Clear(); col.Clear(); sway.Clear(); idx.Clear();
            }

            /// <summary>Adds a box spanning [x0,x1]x[y0,y1]x[z0,z1] in game space.</summary>
            public void Box(float x0, float x1, float y0, float y1, float z0, float z1, Color c, float uw, float uh, float ud, int skipMask = 0, Vector3 swayV = default)
            {
                // faces: +x -x +y -y +z -z (game space), uv scaled by face size
                if ((skipMask & 1) == 0) Face(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0, ud, uh, c, swayV);
                if ((skipMask & 2) == 0) Face(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0, ud, uh, c, swayV);
                if ((skipMask & 4) == 0) Face(x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, 0, 1, 0, uw, ud, c, swayV);
                if ((skipMask & 8) == 0) Face(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 0, -1, 0, uw, ud, c, swayV);
                if ((skipMask & 16) == 0) Face(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1, uw, uh, c, swayV);
                if ((skipMask & 32) == 0) Face(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1, uw, uh, c, swayV);
            }

            void Face(float ax, float ay, float az, float bx, float by, float bz, float cx, float cy, float cz, float dx, float dy, float dz,
                float nx, float ny, float nz, float fw, float fh, Color c, Vector3 swayV)
            {
                int b = pos.Count;
                pos.Add(new Vector3(ax, ay, -az));
                pos.Add(new Vector3(bx, by, -bz));
                pos.Add(new Vector3(cx, cy, -cz));
                pos.Add(new Vector3(dx, dy, -dz));
                var n = new Vector3(nx, ny, -nz);
                for (int k = 0; k < 4; k++) { nor.Add(n); col.Add(c); }
                uv.Add(new Vector2(0, 0));
                uv.Add(new Vector2(fw, 0));
                uv.Add(new Vector2(fw, fh));
                uv.Add(new Vector2(0, fh));
                if (useSway)
                {
                    sway.Add(new Vector3(swayV.x, swayV.y * (ay - swayBase), swayV.z * (ay - swayBase)));
                    sway.Add(new Vector3(swayV.x, swayV.y * (by - swayBase), swayV.z * (by - swayBase)));
                    sway.Add(new Vector3(swayV.x, swayV.y * (cy - swayBase), swayV.z * (cy - swayBase)));
                    sway.Add(new Vector3(swayV.x, swayV.y * (dy - swayBase), swayV.z * (dy - swayBase)));
                }
                // mirrored z flips handedness: reverse winding
                idx.Add(b); idx.Add(b + 2); idx.Add(b + 1);
                idx.Add(b); idx.Add(b + 3); idx.Add(b + 2);
            }

            public Mesh ToMesh(string name = "vox")
            {
                var m = new Mesh { name = name };
                if (pos.Count > 65000) m.indexFormat = IndexFormat.UInt32;
                m.SetVertices(pos);
                m.SetNormals(nor);
                m.SetUVs(0, uv);
                m.SetColors(col);
                if (useSway) m.SetUVs(1, sway);
                m.SetTriangles(idx, 0, true);
                m.RecalculateBounds();
                return m;
            }
        }

        static bool IsGlowColor(int c)
        {
            int r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
            int max = Math.Max(r, Math.Max(g, b)), min = Math.Min(r, Math.Min(g, b));
            return max > 235 && max - min > 100;
        }

        /// <summary>
        /// Merges a model's boxes into one mesh. frame 0/1 applies walk offsets (-1 none);
        /// tag null = all boxes, "" = untagged + body, otherwise only that tag.
        /// </summary>
        public static Mesh Build(VoxelModel m, int frame = -1, string tag = null, Vector3 pivot = default, float tint = 0)
        {
            var buf = new Buf();
            float s = m.scale;
            var glowSet = new HashSet<int>();
            if (m.glow != null) foreach (var g in m.glow) glowSet.Add(g);
            for (int bi = 0; bi < m.boxes.Length; bi++)
            {
                var b = m.boxes[bi];
                string t = b.tag ?? "";
                if (tag != null)
                {
                    if (tag == "") { if (t != "" && t != "body") continue; }
                    else if (t != tag) continue;
                }
                float x = b.x, y = b.y, z = b.z;
                if (frame >= 0 && t != "" && FrameOffsets.TryGetValue(t, out var fo))
                {
                    var o = fo[frame];
                    x += o[0]; y += o[1]; z += o[2];
                }
                x -= pivot.x; y -= pivot.y; z -= pivot.z;
                var c = Gfx.Raw(b.color);
                if (tint != 0)
                {
                    // three.js multiplies the linear colour
                    c = new Color(Gfx.ToSrgb(Gfx.ToLin(c.r) * tint), Gfx.ToSrgb(Gfx.ToLin(c.g) * tint), Gfx.ToSrgb(Gfx.ToLin(c.b) * tint));
                }
                c.a = glowSet.Contains(bi) || IsGlowColor(b.color) ? 1 : 0;
                float x0 = (x - b.w / 2) * s, x1 = (x + b.w / 2) * s;
                float y0 = y * s, y1 = (y + b.h) * s;
                float z0 = (z - b.d / 2) * s, z1 = (z + b.d / 2) * s;
                int skip = y0 <= 0.001f ? 8 : 0; // skip bottoms on the ground
                buf.Box(x0, x1, y0, y1, z0, z1, c, b.w, b.h, b.d, skip);
            }
            return buf.ToMesh();
        }

        public static bool HasTag(VoxelModel m, string tag)
        {
            foreach (var b in m.boxes) if (b.tag == tag) return true;
            return false;
        }

        /// <summary>Pivot (voxel units, game space) for an articulated part based on its bounding box.</summary>
        public static Vector3 PartPivot(VoxelModel m, string tag)
        {
            float minX = float.MaxValue, maxX = float.MinValue, minY = float.MaxValue, maxY = float.MinValue, minZ = float.MaxValue, maxZ = float.MinValue;
            foreach (var b in m.boxes)
            {
                if (b.tag != tag) continue;
                minX = Math.Min(minX, b.x - b.w / 2); maxX = Math.Max(maxX, b.x + b.w / 2);
                minY = Math.Min(minY, b.y); maxY = Math.Max(maxY, b.y + b.h);
                minZ = Math.Min(minZ, b.z - b.d / 2); maxZ = Math.Max(maxZ, b.z + b.d / 2);
            }
            if (minX == float.MaxValue) return Vector3.zero;
            float cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
            switch (tag)
            {
                case "legL":
                case "legR":
                    return new Vector3(cx, maxY, cz);
                case "armL":
                case "armR":
                    {
                        float top = minY, best = 0;
                        foreach (var b in m.boxes)
                            if (b.tag == tag && b.w * b.h * b.d > best) { best = b.w * b.h * b.d; top = b.y + b.h; }
                        return new Vector3(cx, top, cz);
                    }
                case "wingL": return new Vector3(maxX, cy, cz);
                case "wingR": return new Vector3(minX, cy, cz);
                case "head": return new Vector3(cx, minY, cz);
                case "tail": return new Vector3(cx, cy, maxZ);
                case "jaw": return new Vector3(cx, maxY, minZ);
                case "lid": return new Vector3(cx, minY, minZ);
                default: return new Vector3(cx, cy, cz);
            }
        }

        // ------------------------------------------------------------ primitive meshes

        static Mesh cube, centeredCube, plane, ring84, ring93;

        /// <summary>Unit cube with its base at y = 0 and per-face 0..1 UVs (three.js BoxGeometry translated up).</summary>
        public static Mesh UnitCube()
        {
            if (cube != null) return cube;
            var b = new Buf();
            b.Box(-0.5f, 0.5f, 0, 1, -0.5f, 0.5f, Color.white, 1, 1, 1);
            return cube = b.ToMesh("cube");
        }

        /// <summary>Unit cube centred at the origin (BoxGeometry(1,1,1)).</summary>
        public static Mesh CenteredCube()
        {
            if (centeredCube != null) return centeredCube;
            var b = new Buf();
            b.Box(-0.5f, 0.5f, -0.5f, 0.5f, -0.5f, 0.5f, Color.white, 1, 1, 1);
            return centeredCube = b.ToMesh("ccube");
        }

        /// <summary>Flat 1x1 quad on the XZ plane, facing up.</summary>
        public static Mesh FlatPlane()
        {
            if (plane != null) return plane;
            var m = new Mesh { name = "plane" };
            m.SetVertices(new List<Vector3> { new Vector3(-0.5f, 0, -0.5f), new Vector3(0.5f, 0, -0.5f), new Vector3(0.5f, 0, 0.5f), new Vector3(-0.5f, 0, 0.5f) });
            m.SetNormals(new List<Vector3> { Vector3.up, Vector3.up, Vector3.up, Vector3.up });
            m.SetUVs(0, new List<Vector2> { new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1) });
            m.SetColors(new List<Color> { Color.white, Color.white, Color.white, Color.white });
            m.SetTriangles(new[] { 0, 2, 1, 0, 3, 2 }, 0);
            m.RecalculateBounds();
            return plane = m;
        }

        /// <summary>Flat ring (outer radius 1) on the XZ plane.</summary>
        public static Mesh FlatRing(float inner, int seg = 40)
        {
            if (inner < 0.9f && ring84 != null) return ring84;
            if (inner >= 0.9f && ring93 != null) return ring93;
            var v = new List<Vector3>();
            var uv = new List<Vector2>();
            var n = new List<Vector3>();
            var c = new List<Color>();
            var idx = new List<int>();
            for (int i = 0; i <= seg; i++)
            {
                float a = i / (float)seg * Mathf.PI * 2;
                float ca = Mathf.Cos(a), sa = Mathf.Sin(a);
                v.Add(new Vector3(ca * inner, 0, sa * inner));
                v.Add(new Vector3(ca, 0, sa));
                uv.Add(new Vector2(0.5f + ca * inner * 0.5f, 0.5f + sa * inner * 0.5f));
                uv.Add(new Vector2(0.5f + ca * 0.5f, 0.5f + sa * 0.5f));
                n.Add(Vector3.up); n.Add(Vector3.up);
                c.Add(Color.white); c.Add(Color.white);
            }
            for (int i = 0; i < seg; i++)
            {
                int a = i * 2;
                idx.Add(a); idx.Add(a + 1); idx.Add(a + 3);
                idx.Add(a); idx.Add(a + 3); idx.Add(a + 2);
            }
            var m = new Mesh { name = "ring" };
            m.SetVertices(v); m.SetNormals(n); m.SetUVs(0, uv); m.SetColors(c);
            m.SetTriangles(idx, 0);
            m.RecalculateBounds();
            if (inner < 0.9f) ring84 = m; else ring93 = m;
            return m;
        }
    }
}
