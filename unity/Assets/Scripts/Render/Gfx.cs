using System;
using System.Collections.Generic;
using UnityEngine;

namespace Cubeborn.View
{
    /// <summary>
    /// Shared rendering helpers: materials, generated textures, colour conversions and the
    /// mapping from game coordinates (three.js style, right-handed) to Unity (z mirrored).
    /// </summary>
    public static class Gfx
    {
        public const int WorldLayer = 0;
        public const int ThumbLayer = 30;

        public static Texture2D BlockTex, BlobTex, White;
        static readonly Dictionary<string, Material> baseMats = new Dictionary<string, Material>();

        public static readonly int ColorId = Shader.PropertyToID("_Color");
        public static readonly int FlashId = Shader.PropertyToID("_Flash");

        public static void Init()
        {
            if (BlockTex != null) return;
            BlockTex = MakeBlockTexture();
            BlobTex = MakeBlobTexture();
            White = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            White.SetPixels32(new[] { new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255), new Color32(255, 255, 255, 255) });
            White.Apply();
        }

        // ------------------------------------------------------------ coordinates

        /// <summary>Game (x, y, z) to Unity world position.</summary>
        public static Vector3 U(double x, double y, double z) => new Vector3((float)x, (float)y, (float)-z);

        /// <summary>Unity rotation for a game yaw (rotation about +Y in the game's right-handed frame).</summary>
        public static Quaternion Yaw(double yaw) => Quaternion.Euler(0, (float)(-yaw * Mathf.Rad2Deg), 0);

        // ------------------------------------------------------------ colours

        public static Color Raw(int hex, float a = 1) => new Color(((hex >> 16) & 255) / 255f, ((hex >> 8) & 255) / 255f, (hex & 255) / 255f, a);

        public static float ToLin(float c) => c <= 0.04045f ? c / 12.92f : Mathf.Pow((c + 0.055f) / 1.055f, 2.4f);
        public static float ToSrgb(float c)
        {
            if (c <= 0) return 0;
            return c <= 0.0031308f ? c * 12.92f : 1.055f * Mathf.Pow(c, 1 / 2.4f) - 0.055f;
        }

        /// <summary>Linear colour of an sRGB hex, scaled (three.js Color.setHex then multiplyScalar).</summary>
        public static Vector4 Lin(int hex, double mul = 1)
        {
            float m = (float)mul;
            return new Vector4(ToLin(((hex >> 16) & 255) / 255f) * m, ToLin(((hex >> 8) & 255) / 255f) * m, ToLin((hex & 255) / 255f) * m, 1);
        }

        public static Color LinColor(int hex, double mul = 1)
        {
            var v = Lin(hex, mul);
            return new Color(v.x, v.y, v.z, 1);
        }

        public static Color Hex(string s)
        {
            if (string.IsNullOrEmpty(s)) return Color.white;
            ColorUtility.TryParseHtmlString(s, out var c);
            return c;
        }

        // ------------------------------------------------------------ materials

        static Material Base(string name)
        {
            if (baseMats.TryGetValue(name, out var m)) return m;
            m = Resources.Load<Material>("Materials/" + name);
            if (m == null)
            {
                var sh = Shader.Find("Cubeborn/" + name);
                m = new Material(sh);
            }
            m.enableInstancing = true;
            baseMats[name] = m;
            return m;
        }

        public static Material Voxel(Texture tex = null, bool unlit = false)
        {
            var m = new Material(Base("Voxel")) { enableInstancing = true };
            m.SetTexture("_MainTex", tex != null ? tex : BlockTex);
            m.SetFloat("_Unlit", unlit ? 1 : 0);
            m.SetColor(ColorId, Color.white);
            return m;
        }

        public static Material Ground() => new Material(Base("Ground"));

        public static Material Glow(Texture tex = null, bool depthTest = true, int order = 5)
        {
            var m = new Material(Base("Glow")) { enableInstancing = true };
            m.SetTexture("_MainTex", tex != null ? tex : White);
            m.SetFloat("_UseTex", tex != null ? 1 : 0);
            m.SetFloat("_ZTest", depthTest ? (float)UnityEngine.Rendering.CompareFunction.LessEqual : (float)UnityEngine.Rendering.CompareFunction.Always);
            m.renderQueue = 3000 + order;
            return m;
        }

        public static Material Blend(Texture tex, float opacity, int order)
        {
            var m = new Material(Base("Blend")) { enableInstancing = true };
            m.SetTexture("_MainTex", tex);
            m.SetFloat("_Opacity", opacity);
            m.renderQueue = 3000 + order;
            return m;
        }

        public static Material Multiply(Texture tex, int order)
        {
            var m = new Material(Base("Multiply")) { enableInstancing = true };
            m.SetTexture("_MainTex", tex);
            m.renderQueue = 3000 + order;
            return m;
        }

        // ------------------------------------------------------------ textures

        static Texture2D PixelTex(int w, int h, bool repeat)
        {
            var t = new Texture2D(w, h, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Point,
                wrapMode = repeat ? TextureWrapMode.Repeat : TextureWrapMode.Clamp,
                anisoLevel = 0,
            };
            return t;
        }

        /// <summary>Small grayscale pixel texture applied to every voxel face for a crafted block look.</summary>
        public static Texture2D MakeBlockTexture(int px = 8)
        {
            var t = PixelTex(px, px, true);
            var data = new Color32[px * px];
            for (int y = 0; y < px; y++)
                for (int x = 0; x < px; x++)
                {
                    bool edge = x == 0 || y == 0 || x == px - 1 || y == px - 1;
                    double v = 0.86 + Rng.Hash2(x, y, 7) * 0.14;
                    if (edge) v *= 0.82;
                    if (x == 1 && y == 1) v = Math.Min(1, v * 1.08);
                    byte b = (byte)MathX.RoundI(v * 255);
                    data[y * px + x] = new Color32(b, b, b, 255);
                }
            t.SetPixels32(data);
            t.Apply(false, false);
            return t;
        }

        public const int TilePx = 16;
        public const int AtlasVariants = 4;

        static bool Has(string name, params string[] parts)
        {
            foreach (var p in parts) if (name.Contains(p)) return true;
            return false;
        }

        /// <summary>Ground atlas: one column per tile type, AtlasVariants rows of 16x16 pixel art.</summary>
        public static Texture2D MakeGroundAtlas(List<string> tileNames, Dictionary<string, int[]> palette)
        {
            int cols = Math.Max(1, tileNames.Count);
            int W = cols * TilePx, H = AtlasVariants * TilePx;
            var t = PixelTex(W, H, false);
            var data = new Color32[W * H];
            for (int ti = 0; ti < tileNames.Count; ti++)
            {
                string name = tileNames[ti];
                int[] colors = palette.TryGetValue(name, out var cs) && cs.Length > 0 ? cs : new[] { 0x777777 };
                for (int v = 0; v < AtlasVariants; v++)
                {
                    int bc = colors[v % colors.Length];
                    double br = ((bc >> 16) & 255) / 255.0, bg = ((bc >> 8) & 255) / 255.0, bb = (bc & 255) / 255.0;
                    for (int y = 0; y < TilePx; y++)
                        for (int x = 0; x < TilePx; x++)
                        {
                            double n = Rng.Hash2(x + ti * 31, y + v * 17, 3 + ti);
                            double shade = 0.9 + n * 0.2;
                            if (name.Contains("grass") && Rng.Hash2(x, y, v + 9) > 0.86) shade *= 1.18;
                            if (Has(name, "cobble", "plaza", "marble", "tile", "floor") && (x % 8 == 0 || y % 8 == 0)) shade *= 0.78;
                            if (Has(name, "road", "basalt") && Rng.Hash2(x, y, v + 2) > 0.92) shade *= 0.7;
                            if (name.Contains("snow") && Rng.Hash2(x, y, v + 4) > 0.9) shade *= 1.1;
                            if (Has(name, "sand", "ash") && (x + y * 3 + v) % 7 == 0) shade *= 0.92;
                            if (Has(name, "water", "lava", "bog", "void", "ice")) shade = 0.92 + Math.Sin((x + v * 4) * 0.8 + y * 0.4) * 0.06 + n * 0.06;
                            if (name.Contains("rune") && (x == 7 || x == 8 || y == 7 || y == 8)) shade *= 1.35;
                            bool edge = x == 0 || y == 0;
                            if (edge && !Has(name, "water", "lava", "bog", "void")) shade *= 0.86;
                            // canvas row (v*16+y) from the top -> texture row from the bottom
                            int cy = v * TilePx + y;
                            int idx = (H - 1 - cy) * W + ti * TilePx + x;
                            data[idx] = new Color32(
                                (byte)Math.Min(255, (int)(br * 255 * shade)),
                                (byte)Math.Min(255, (int)(bg * 255 * shade)),
                                (byte)Math.Min(255, (int)(bb * 255 * shade)), 255);
                        }
                }
            }
            t.SetPixels32(data);
            t.Apply(false, false);
            return t;
        }

        /// <summary>Soft round blob used for shadows and glows.</summary>
        public static Texture2D MakeBlobTexture()
        {
            const int S = 64;
            var t = new Texture2D(S, S, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            var data = new Color32[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    double d = Math.Sqrt((x + 0.5 - 32) * (x + 0.5 - 32) + (y + 0.5 - 32) * (y + 0.5 - 32)) / 32;
                    double a = d >= 1 ? 0 : d < 0.6 ? 1 - d / 0.6 * 0.5 : 0.5 * (1 - (d - 0.6) / 0.4);
                    data[y * S + x] = new Color32(255, 255, 255, (byte)(a * 255));
                }
            t.SetPixels32(data);
            t.Apply(false, false);
            return t;
        }
    }
}
