using System;
using System.Collections.Generic;
using UnityEngine;

namespace Cubeborn.UI
{
    /// <summary>
    /// 16x16 pixel-art icons for weapons, passives, upgrades and pickups, rebuilt from the glyph
    /// recordings in icons.json (colour roles c/lt/dk filled from the item colour) with the
    /// web build's automatic dark outline. Cached per (id, colour).
    /// </summary>
    public static class Icons
    {
        const int N = 16;
        static Dictionary<string, List<object>> glyphs;
        static readonly Dictionary<string, Sprite> cache = new Dictionary<string, Sprite>();

        static void Load()
        {
            if (glyphs != null) return;
            glyphs = new Dictionary<string, List<object>>();
            var ta = Resources.Load<TextAsset>("Data/icons");
            if (ta == null) return;
            foreach (var kv in Json.Obj(Json.Parse(ta.text))) glyphs[kv.Key] = Json.Arr(kv.Value);
        }

        static Color32 Shade(int hex, double k)
        {
            double r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
            if (k > 0)
            {
                r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k;
            }
            else
            {
                r *= 1 + k; g *= 1 + k; b *= 1 + k;
            }
            return new Color32((byte)(int)r, (byte)(int)g, (byte)(int)b, 255);
        }

        public static Sprite Get(string id, int color)
        {
            string key = id + ":" + color;
            if (cache.TryGetValue(key, out var s)) return s;
            Load();
            if (id == null || !glyphs.TryGetValue(id, out var ops)) glyphs.TryGetValue("crystal", out ops);
            var px = new Color32[N * N];
            var c = Shade(color, 0);
            var lt = Shade(color, 0.45);
            var dk = Shade(color, -0.45);
            if (ops != null)
                for (int i = 0; i + 2 < ops.Count; i += 3)
                {
                    int x = (int)Convert.ToDouble(ops[i]), y = (int)Convert.ToDouble(ops[i + 1]);
                    if (x < 0 || y < 0 || x >= N || y >= N) continue;
                    string role = ops[i + 2] as string ?? "c";
                    Color32 col = role == "c" ? c : role == "lt" ? lt : role == "dk" ? dk : Parse(role);
                    px[y * N + x] = col;
                }
            // outline pass
            var outPx = new List<int>();
            for (int y = 0; y < N; y++)
                for (int x = 0; x < N; x++)
                    if (!Solid(px, x, y) && (Solid(px, x - 1, y) || Solid(px, x + 1, y) || Solid(px, x, y - 1) || Solid(px, x, y + 1))) outPx.Add(y * N + x);
            foreach (var i in outPx) px[i] = new Color32(12, 10, 20, 242);
            // canvas rows run top-down; textures bottom-up
            var flipped = new Color32[N * N];
            for (int y = 0; y < N; y++)
                for (int x = 0; x < N; x++) flipped[(N - 1 - y) * N + x] = px[y * N + x];
            var t = new Texture2D(N, N, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
            t.SetPixels32(flipped);
            t.Apply();
            s = Sprite.Create(t, new Rect(0, 0, N, N), new Vector2(0.5f, 0.5f), 16);
            cache[key] = s;
            return s;
        }

        static bool Solid(Color32[] px, int x, int y) => x >= 0 && y >= 0 && x < N && y < N && px[y * N + x].a > 0;

        static Color32 Parse(string s)
        {
            if (ColorUtility.TryParseHtmlString(s, out var c)) return c;
            return new Color32(255, 255, 255, 255);
        }
    }
}
