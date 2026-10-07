using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Cubeborn.UI;

namespace Cubeborn.View
{
    /// <summary>
    /// Screen-space layer over the 3D view: floating damage numbers, short text popups,
    /// elite health bars and off-screen indicators for chests and bosses.
    /// </summary>
    public class Overlay
    {
        class Num
        {
            public double x, y, z, life, max, vx, size;
            public string text;
            public Color color;
            public bool big;
        }

        readonly RectTransform root;
        readonly List<Num> nums = new List<Num>();
        readonly List<Text> textPool = new List<Text>();
        readonly List<Image[]> barPool = new List<Image[]>();
        readonly List<Image> arrowPool = new List<Image>();
        public bool showNumbers = true;

        public Overlay(RectTransform parent)
        {
            root = Kit.Stretch(Kit.Rect(parent, "Overlay"));
        }

        public void Number(double x, double z, double value, bool crit, int color = -1)
        {
            bool colored = color >= 0;
            if (!showNumbers && !colored) return;
            if (!crit && !colored && nums.Count > 30 && UnityEngine.Random.value < (nums.Count - 30) / 40.0) return;
            if (nums.Count > 90)
            {
                int i = nums.FindIndex(n => !n.big);
                if (i >= 0) nums.RemoveAt(i);
                else return;
            }
            long v = (long)Math.Floor(value + 0.5);
            if (v <= 0) return;
            nums.Add(new Num
            {
                x = x + (UnityEngine.Random.value - 0.5) * 0.5, y = 1.6, z = z, text = v.ToString(),
                color = colored ? Kit.C(color) : crit ? Kit.C(0xffd23d) : Kit.C(0xf0ecf8),
                size = crit ? 14 : colored ? 12 : 9, life = crit ? 0.8 : 0.6, max = crit ? 0.8 : 0.6,
                vx = (UnityEngine.Random.value - 0.5) * 0.6, big = crit || colored,
            });
        }

        public void Text(double x, double z, string text, int color)
        {
            nums.Add(new Num { x = x, y = 2.4, z = z, text = text, color = Kit.C(color), size = 12, life = 1.2, max = 1.2, vx = 0, big = true });
        }

        public void Clear()
        {
            nums.Clear();
            foreach (var t in textPool) t.gameObject.SetActive(false);
            foreach (var b in barPool) b[0].gameObject.SetActive(false);
            foreach (var a in arrowPool) a.gameObject.SetActive(false);
        }

        Text GetText(int i)
        {
            while (textPool.Count <= i)
            {
                var t = Kit.Txt(root, "", 9, Color.white, Kit.Px, TextAnchor.MiddleCenter, "num");
                t.horizontalOverflow = HorizontalWrapMode.Overflow;
                t.rectTransform.sizeDelta = new Vector2(200, 30);
                Kit.Stroke(t, new Color(10 / 255f, 8 / 255f, 16 / 255f, 0.9f), 1.6f);
                textPool.Add(t);
            }
            return textPool[i];
        }

        Image[] GetBar(int i)
        {
            while (barPool.Count <= i)
            {
                var bg = Kit.Img(root, null, new Color(0, 0, 0, 0.65f), "bar");
                bg.rectTransform.sizeDelta = new Vector2(36, 6);
                var fill = Kit.Img(bg.transform, null, Color.white, "fill");
                fill.rectTransform.anchorMin = new Vector2(0, 0);
                fill.rectTransform.anchorMax = new Vector2(0, 1);
                fill.rectTransform.pivot = new Vector2(0, 0.5f);
                fill.rectTransform.offsetMin = new Vector2(1, 1);
                fill.rectTransform.offsetMax = new Vector2(1, -1);
                barPool.Add(new[] { bg, fill });
            }
            return barPool[i];
        }

        Image GetArrow(int i)
        {
            while (arrowPool.Count <= i)
            {
                var a = Kit.Img(root, Kit.ArrowSprite, Color.white, "arrow");
                a.rectTransform.sizeDelta = new Vector2(30, 30);
                arrowPool.Add(a);
            }
            return arrowPool[i];
        }

        Vector2 size;
        Camera cam;

        bool Project(double x, double y, double z, out Vector2 p)
        {
            var sp = cam.WorldToScreenPoint(Gfx.U(x, y, z));
            p = default;
            if (sp.z < 0) return false;
            // screen pixels -> overlay local (origin bottom-left)
            p = new Vector2(sp.x / Screen.width * size.x, sp.y / Screen.height * size.y);
            return p.x > -40 && p.x < size.x + 40 && p.y > -40 && p.y < size.y + 40;
        }

        public void Draw(double dt, Camera camera, Run run)
        {
            cam = camera;
            size = root.rect.size;
            int nt = 0, nb = 0, na = 0;
            if (run != null)
            {
                double px = run.player.x, pz = run.player.z;
                foreach (var e in run.enemies.list)
                {
                    if (!e.active || e.dying > 0 || e.boss != null || e.elite == null) continue;
                    if ((e.x - px) * (e.x - px) + (e.z - pz) * (e.z - pz) > 26 * 26) continue;
                    if (!Project(e.x, 1.2 + e.scale * 1.4, e.z, out var p)) continue;
                    var bar = GetBar(nb++);
                    bar[0].gameObject.SetActive(true);
                    bar[0].rectTransform.anchorMin = bar[0].rectTransform.anchorMax = Vector2.zero;
                    bar[0].rectTransform.anchoredPosition = new Vector2(p.x, p.y);
                    bar[1].color = Kit.C(Content.EliteById[e.elite].color);
                    bar[1].rectTransform.sizeDelta = new Vector2((float)(34 * Math.Max(0, e.hp / e.maxHp)), -2);
                }
                foreach (var k in run.pickups.list)
                    if (k.active && k.kind == "chest") Arrow(ref na, k.x, k.z, Kit.Gold);
                foreach (var b in run.bosses)
                    if (b.e.active && b.e.boss == b) Arrow(ref na, b.e.x, b.e.z, Kit.Red);
            }
            for (int i = nums.Count - 1; i >= 0; i--)
            {
                var n = nums[i];
                n.life -= dt;
                if (n.life <= 0) { nums.RemoveAt(i); continue; }
                double k = n.life / n.max;
                n.y += dt * (0.8 + k * 1.6);
                n.x += n.vx * dt;
                if (run == null || !Project(n.x, n.y, n.z, out var p)) continue;
                double pop = k > 0.8 ? 1 + (k - 0.8) * 2.5 : 1;
                var t = GetText(nt++);
                t.gameObject.SetActive(true);
                t.text = n.text;
                t.fontSize = Math.Max(6, (int)Math.Round(n.size * pop));
                var c = n.color;
                c.a = (float)Math.Min(1, k * 3);
                t.color = c;
                t.rectTransform.anchorMin = t.rectTransform.anchorMax = Vector2.zero;
                t.rectTransform.anchoredPosition = p;
            }
            for (int i = nt; i < textPool.Count; i++) if (textPool[i].gameObject.activeSelf) textPool[i].gameObject.SetActive(false);
            for (int i = nb; i < barPool.Count; i++) if (barPool[i][0].gameObject.activeSelf) barPool[i][0].gameObject.SetActive(false);
            for (int i = na; i < arrowPool.Count; i++) if (arrowPool[i].gameObject.activeSelf) arrowPool[i].gameObject.SetActive(false);
        }

        void Arrow(ref int na, double x, double z, Color color)
        {
            var sp = cam.WorldToScreenPoint(Gfx.U(x, 0.5, z));
            float sx = sp.x / Screen.width * size.x, sy = sp.y / Screen.height * size.y;
            if (sp.z < 0) { sx = size.x - sx; sy = size.y - sy; }
            const float m = 28;
            if (sp.z > 0 && sx > m && sx < size.x - m && sy > m && sy < size.y - m) return;
            float cx = size.x / 2, cy = size.y / 2;
            float a = Mathf.Atan2(sy - cy, sx - cx);
            float ca = Mathf.Cos(a), sa = Mathf.Sin(a);
            float t = Math.Min(Math.Abs(ca) > 1e-4f ? Math.Abs((cx - m) / ca) : 1e9f, Math.Abs(sa) > 1e-4f ? Math.Abs((cy - m - 40) / sa) : 1e9f);
            var img = GetArrow(na++);
            img.gameObject.SetActive(true);
            img.color = color;
            img.rectTransform.anchorMin = img.rectTransform.anchorMax = Vector2.zero;
            img.rectTransform.anchoredPosition = new Vector2(cx + ca * t, cy + sa * t);
            img.rectTransform.localRotation = Quaternion.Euler(0, 0, a * Mathf.Rad2Deg);
        }
    }
}
