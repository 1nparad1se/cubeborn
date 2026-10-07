using System;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.UI;

namespace Cubeborn.UI
{
    /// <summary>In-run heads-up display. Writes to the UI only when a value changes.</summary>
    public class Hud
    {
        public readonly RectTransform root;
        readonly RectTransform xpFill, hpFill, bossFill;
        readonly Image hpFillImg, bossFillImg, vignette;
        readonly Text lvl, hpText, time, kills, gold, bossName, banner, fps, buffs;
        readonly RectTransform slotsW, slotsP, bossBox, bossPhase, hint;
        readonly Dictionary<string, object> last = new Dictionary<string, object>();
        string buildKey = "";
        double bannerT, bannerDur, fpsAcc;
        int fpsN;
        BossController boss;
        bool lowHp;
        public Action onPause;

        public Hud(RectTransform parent)
        {
            root = Kit.Stretch(Kit.Rect(parent, "Hud"));
            vignette = Kit.Img(root, MakeVignette(), new Color(1, 1, 1, 0), "vignette");
            Kit.Stretch(vignette.rectTransform);

            // xp bar along the top edge
            var xpBar = Kit.Img(root, null, Kit.Ink, "xp");
            Kit.Place(xpBar.rectTransform, 0.5f, 1, 0, 14);
            xpBar.rectTransform.anchorMin = new Vector2(0, 1);
            xpBar.rectTransform.anchorMax = new Vector2(1, 1);
            xpBar.rectTransform.sizeDelta = new Vector2(0, 14);
            var xf = Kit.Img(xpBar.transform, null, Kit.C(0x5ab4ff), "fill");
            xpFill = Kit.Stretch(xf.rectTransform);
            xpFill.pivot = new Vector2(0, 0.5f);
            Kit.Img(xf.transform, null, Kit.C(0x7ae0ff), "hi").rectTransform.anchorMin = new Vector2(0, 0.5f);
            var hi = xf.transform.Find("hi") as RectTransform;
            hi.anchorMax = Vector2.one; hi.offsetMin = hi.offsetMax = Vector2.zero;
            lvl = Kit.Txt(xpBar.transform, "", 8, Color.white, Kit.Px, TextAnchor.MiddleRight, "lvl");
            Kit.Stretch(lvl.rectTransform, 0, 0, 8, 0);
            Kit.Stroke(lvl, Color.black, 1);

            // top-left: hp, weapon and passive slots, buffs
            var left = Kit.VBox(root, 5, 0, TextAnchor.UpperLeft, "left", false);
            Kit.Place((RectTransform)left.transform, 0, 1, 260, 140, 10, -22);
            var hpBar = Kit.Img(left.transform, null, Kit.C(0x2a0c12), "hp");
            Kit.LE(hpBar, 150, 14);
            Kit.Stroke(hpBar, Kit.Ink, 2);
            hpFillImg = Kit.Img(hpBar.transform, null, Kit.C(0xe8364c), "fill");
            hpFill = Kit.Stretch(hpFillImg.rectTransform);
            hpFill.pivot = new Vector2(0, 0.5f);
            hpText = Kit.Txt(hpBar.transform, "", 7, Color.white, Kit.Px, TextAnchor.MiddleCenter, "t");
            Kit.Stretch(hpText.rectTransform);
            Kit.Stroke(hpText, Color.black, 1);
            slotsW = (RectTransform)Kit.HBox(left.transform, 5, 0, TextAnchor.MiddleLeft, "weapons").transform;
            Kit.LE(slotsW, -1, 30);
            slotsP = (RectTransform)Kit.HBox(left.transform, 5, 0, TextAnchor.MiddleLeft, "passives").transform;
            Kit.LE(slotsP, -1, 22);
            buffs = Kit.Txt(left.transform, "", 8, Color.white, Kit.Px, TextAnchor.UpperLeft, "buffs");
            Kit.Stroke(buffs, Color.black, 1);

            time = Kit.Txt(root, "00:00", 18, Color.white, Kit.Px, TextAnchor.UpperCenter, "time");
            Kit.Place(time.rectTransform, 0.5f, 1, 200, 30, 0, -24);
            Kit.Drop(time, Color.black, 0, -3);
            Kit.Stroke(time, Color.black, 2);

            // top-right: kills, gold, pause
            var right = Kit.HBox(root, 10, 0, TextAnchor.UpperRight, "right");
            Kit.Place((RectTransform)right.transform, 1, 1, 300, 44, -10, -22);
            var pause = Kit.Img(right.transform, Kit.PanelSprite, new Color(10 / 255f, 8 / 255f, 16 / 255f, 0.75f), "pause");
            Kit.LE(pause, 44, 44);
            var bars = Kit.HBox(pause.transform, 6, 0, TextAnchor.MiddleCenter, "bars");
            Kit.Stretch((RectTransform)bars.transform);
            Kit.LE(Kit.Img(bars.transform, null, Color.white, "a"), 6, 18);
            Kit.LE(Kit.Img(bars.transform, null, Color.white, "b"), 6, 18);
            Kit.Clickable(pause.rectTransform, () => onPause?.Invoke());
            kills = Stat(right.transform, "skull", 0xeeeeee);
            gold = Stat(right.transform, "coin", 0xffd23d);
            pause.transform.SetAsLastSibling();

            banner = Kit.Txt(root, "", 20, Kit.Gold, Kit.Px, TextAnchor.MiddleCenter, "banner");
            banner.rectTransform.anchorMin = new Vector2(0, 0.62f);
            banner.rectTransform.anchorMax = new Vector2(1, 0.78f);
            banner.rectTransform.offsetMin = new Vector2(20, 0);
            banner.rectTransform.offsetMax = new Vector2(-20, 0);
            Kit.Drop(banner, Color.black, 0, -3);
            Kit.Stroke(banner, Color.black, 2);

            // boss bar
            bossBox = Kit.Rect(root, "boss");
            Kit.Place(bossBox, 0.5f, 0, 520, 46, 0, 14);
            bossName = Kit.Txt(bossBox, "", 10, Color.white, Kit.Px, TextAnchor.LowerCenter, "name");
            bossName.rectTransform.anchorMin = new Vector2(0, 1);
            bossName.rectTransform.anchorMax = new Vector2(1, 1);
            bossName.rectTransform.pivot = new Vector2(0.5f, 1);
            bossName.rectTransform.sizeDelta = new Vector2(0, 16);
            Kit.Stroke(bossName, Color.black, 1.5f);
            var track = Kit.Img(bossBox, null, Kit.C(0x2a0c12), "track");
            Kit.Place(track.rectTransform, 0.5f, 0.5f, 520, 14, 0, -2);
            track.rectTransform.anchorMin = new Vector2(0, 0.5f);
            track.rectTransform.anchorMax = new Vector2(1, 0.5f);
            track.rectTransform.sizeDelta = new Vector2(0, 14);
            Kit.Stroke(track, Kit.Ink, 2);
            bossFillImg = Kit.Img(track.transform, null, Kit.C(0xff4a5a), "fill");
            bossFill = Kit.Stretch(bossFillImg.rectTransform);
            bossFill.pivot = new Vector2(0, 0.5f);
            bossPhase = (RectTransform)Kit.HBox(bossBox, 4, 0, TextAnchor.MiddleCenter, "phases").transform;
            bossPhase.anchorMin = new Vector2(0, 0);
            bossPhase.anchorMax = new Vector2(1, 0);
            bossPhase.pivot = new Vector2(0.5f, 0);
            bossPhase.sizeDelta = new Vector2(0, 8);
            bossBox.gameObject.SetActive(false);

            fps = Kit.Txt(root, "", 8, Kit.C(0x9aff9a), Kit.Px, TextAnchor.LowerLeft, "fps");
            Kit.Place(fps.rectTransform, 0, 0, 300, 20, 10, 8);
            Kit.Stroke(fps, Color.black, 1);
            fps.gameObject.SetActive(false);

            hint = Kit.Rect(root, "hint");
            hint.anchorMin = new Vector2(0, 0.18f);
            hint.anchorMax = new Vector2(1, 0.18f);
            hint.pivot = new Vector2(0.5f, 0);
            hint.sizeDelta = new Vector2(0, 110);
            hint.gameObject.SetActive(false);
        }

        static Sprite vigSprite;

        static Sprite MakeVignette()
        {
            if (vigSprite != null) return vigSprite;
            const int W = 128, H = 72;
            var t = new Texture2D(W, H, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            var px = new Color32[W * H];
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    float dx = (x + 0.5f) / W * 2 - 1, dy = (y + 0.5f) / H * 2 - 1;
                    float d = Mathf.Sqrt(dx * dx + dy * dy) / Mathf.Sqrt(2);
                    float a = Mathf.Clamp01((d - 0.55f) / 0.45f) * 0.55f;
                    px[y * W + x] = new Color32(255, 0, 30, (byte)(a * 255));
                }
            t.SetPixels32(px);
            t.Apply();
            return vigSprite = Sprite.Create(t, new Rect(0, 0, W, H), new Vector2(0.5f, 0.5f));
        }

        Text Stat(Transform parent, string icon, int color)
        {
            var h = Kit.HBox(parent, 4, 0, TextAnchor.MiddleRight, "stat");
            Kit.LE(h, -1, 44);
            var img = Kit.Img(h.transform, Icons.Get(icon, color), Color.white, "icon");
            Kit.LE(img, 18, 18);
            var t = Kit.Txt(h.transform, "0", 11, Color.white, Kit.Px, TextAnchor.MiddleLeft, "v");
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            Kit.Stroke(t, Color.black, 1.5f);
            Kit.FitBoth(t);
            return t;
        }

        public void Reset()
        {
            last.Clear();
            buildKey = "";
            boss = null;
            bossBox.gameObject.SetActive(false);
            banner.text = "";
            bannerT = 0;
            vignette.color = new Color(1, 1, 1, 0);
        }

        bool Changed(string key, object v)
        {
            if (last.TryGetValue(key, out var o) && Equals(o, v)) return false;
            last[key] = v;
            return true;
        }

        public void ShowBanner(string text, Color color, double dur = 2.6)
        {
            banner.text = text;
            banner.color = color;
            bannerT = bannerDur = dur;
        }

        public void SetBoss(BossController b)
        {
            boss = b;
            bossBox.gameObject.SetActive(b != null);
            if (b != null)
            {
                bossName.text = I18n.L(b.def.name);
                bossName.color = Kit.C(b.def.color);
                last.Remove("bossHp");
                last.Remove("bossPhase");
                last.Remove("bossInv");
            }
        }

        public void ShowHint(bool on, bool touch)
        {
            hint.gameObject.SetActive(on);
            Kit.Clear(hint);
            if (!on) return;
            var v = Kit.VBox(hint, 8, 0, TextAnchor.UpperCenter, "v");
            Kit.Stretch((RectTransform)v.transform);
            var hand = Kit.Img(v.transform, Kit.CircleSprite, new Color(1, 1, 1, 0.35f), "hand");
            Kit.LE(hand, 40, 40);
            v.childForceExpandWidth = false;
            var t = Kit.Txt(v.transform, I18n.T(touch ? "hint_touch" : "hint_keys"), 12, Color.white, Kit.Px, TextAnchor.MiddleCenter, "t");
            Kit.Drop(t, Color.black, 0, -2);
            var s = Kit.Txt(v.transform, I18n.T("hint_auto"), 14, Kit.Gold, Kit.Ui, TextAnchor.MiddleCenter, "s");
            Kit.Drop(s, Color.black, 0, -2);
            hintHand = hand.rectTransform;
        }

        RectTransform hintHand;

        public void SetFpsVisible(bool v) => fps.gameObject.SetActive(v);
        public void SetVisible(bool v) => root.gameObject.SetActive(v);

        static void Scale(RectTransform fill, double k) => fill.localScale = new Vector3((float)Math.Max(0, Math.Min(1, k)), 1, 1);

        Image Slot(Transform parent, float size, Sprite icon, string badge, Color badgeColor, bool evo, bool empty)
        {
            var bg = Kit.Img(parent, null, new Color(10 / 255f, 8 / 255f, 16 / 255f, empty ? 0.26f : 0.75f), "slot");
            Kit.LE(bg, size, size);
            Kit.Stroke(bg, new Color(Kit.Ink.r, Kit.Ink.g, Kit.Ink.b, empty ? 0.35f : 1), 2);
            if (evo)
            {
                var fr = Kit.Img(bg.transform, Kit.FrameSprite, Kit.C(0xffb02e), "evo");
                Kit.Stretch(fr.rectTransform);
            }
            if (icon != null)
            {
                var ic = Kit.Img(bg.transform, icon, Color.white, "icon");
                Kit.Stretch(ic.rectTransform, 2, 2, 2, 2);
            }
            if (badge != null)
            {
                var b = Kit.Txt(bg.transform, badge, 7, badgeColor, Kit.Px, TextAnchor.LowerRight, "b");
                Kit.Stretch(b.rectTransform, 0, 0, -3, -4);
                Kit.Stroke(b, Color.black, 1);
            }
            return bg;
        }

        public void Update(Run run, double dt, double realDt)
        {
            var p = run.player;
            double xpk = p.xpNext > 0 ? Math.Min(1, p.xp / p.xpNext) : 0;
            if (Changed("xp", (int)Math.Round(xpk * 400))) Scale(xpFill, xpk);
            if (Changed("lvl", p.level)) lvl.text = I18n.T("hud_level", "n", p.level);
            double hpk = Math.Max(0, p.hp / p.stats.maxHp);
            if (Changed("hp", (int)Math.Round(hpk * 300)))
            {
                Scale(hpFill, hpk);
                lowHp = hpk < 0.3;
            }
            hpFillImg.color = lowHp && Math.Floor(Time.unscaledTime * 4) % 2 == 0 ? Kit.C(0xff9aa6) : Kit.C(0xe8364c);
            string hpt = Math.Ceiling(Math.Max(0, p.hp)) + " / " + Math.Round(p.stats.maxHp);
            if (Changed("hpt", hpt)) hpText.text = hpt;
            int sec = (int)Math.Floor(run.time);
            if (Changed("time", sec)) time.text = Fmt.Time(run.time);
            bool bossTime = run.time >= run.map.bossTime - 30 && run.time < run.map.bossTime;
            time.color = bossTime ? (Math.Floor(Time.unscaledTime / 0.3) % 2 == 0 ? Kit.Red : Color.white) : Color.white;
            if (Changed("kills", run.stats.kills)) kills.text = Fmt.Count(run.stats.kills);
            if (Changed("gold", (long)Math.Round(run.stats.gold))) gold.text = Fmt.Count(run.stats.gold);

            // build slots
            var sb = new StringBuilder();
            foreach (var w in run.weapons.list) sb.Append(w.def.id).Append(w.level).Append(',');
            sb.Append('|');
            foreach (var kv in run.passives.levels) sb.Append(kv.Key).Append(kv.Value).Append(',');
            string key = sb.ToString();
            if (key != buildKey)
            {
                buildKey = key;
                Kit.Clear(slotsW);
                Kit.Clear(slotsP);
                for (int i = 0; i < Balance.weaponSlots; i++)
                {
                    var w = i < run.weapons.list.Count ? run.weapons.list[i] : null;
                    if (w == null) Slot(slotsW, 30, null, null, Color.white, false, true);
                    else Slot(slotsW, 30, Icons.Get(w.def.icon, w.def.color), w.def.evolved ? "★" : w.isMax ? "M" : w.level.ToString(),
                        w.def.evolved ? Kit.C(0xffb02e) : w.isMax ? Kit.Gold : Color.white, w.def.evolved, false);
                }
                int pi = 0;
                foreach (var kv in run.passives.levels)
                {
                    if (pi++ >= Balance.passiveSlots) break;
                    var def = Content.PassiveById[kv.Key];
                    Slot(slotsP, 22, Icons.Get(def.icon, def.color), kv.Value.ToString(), Color.white, false, false);
                }
                for (; pi < Balance.passiveSlots; pi++) Slot(slotsP, 22, null, null, Color.white, false, true);
            }
            // buffs
            var bf = p.buffs;
            string bk = $"{bf.fury > 0}{bf.haste > 0}{bf.aegis > 0}{bf.frenzy > 0}{p.shield}";
            if (Changed("buffs", bk))
            {
                var s = new StringBuilder();
                void Add(bool on, int c, string k) { if (on) s.Append(Kit.Col(I18n.T(k), Kit.C(c))).Append("  "); }
                Add(bf.fury > 0, 0xff6a6a, "buff_fury");
                Add(bf.haste > 0, 0x5affd0, "buff_haste");
                Add(bf.aegis > 0, 0xffe080, "buff_aegis");
                Add(bf.frenzy > 0, 0xff9a3a, "buff_frenzy");
                Add(p.shield, 0x8ad0ff, "buff_shield");
                buffs.text = s.ToString();
            }

            // boss bar
            if (boss != null)
            {
                var e = boss.e;
                if (!e.active || e.boss != boss)
                {
                    BossController next = null;
                    foreach (var x in run.bosses) if (x.e.active && x.e.boss == x && !x.isClone) { next = x; break; }
                    SetBoss(next);
                }
                else
                {
                    double k = Math.Max(0, e.hp / e.maxHp);
                    if (Changed("bossHp", (int)Math.Round(k * 500))) Scale(bossFill, k);
                    if (Changed("bossInv", e.invuln)) bossFillImg.color = e.invuln ? Kit.C(0x9adfff) : Kit.C(0xff4a5a);
                    if (Changed("bossPhase", boss.phase))
                    {
                        Kit.Clear(bossPhase);
                        for (int i = 0; i < boss.def.phases.Count; i++)
                            Kit.LE(Kit.Img(bossPhase, null, i <= boss.phase ? Kit.C(0xff4a5a) : new Color(1, 1, 1, 0.25f), "pip"), 14, 6);
                    }
                }
            }

            // hurt vignette
            double vv = p.hurtT > 0 ? 0.7 : hpk < 0.25 ? 0.25 + Math.Sin(run.time * 6) * 0.1 : 0;
            float va = vignette.color.a;
            va += (float)((vv - va) * Math.Min(1, realDt * 12));
            vignette.color = new Color(1, 1, 1, va);

            if (bannerT > 0)
            {
                bannerT -= realDt;
                double age = bannerDur - bannerT;
                double a = age < 0.3 ? age / 0.3 : bannerT < 0.5 ? bannerT / 0.5 : 1;
                var bc = banner.color;
                bc.a = (float)Math.Max(0, a);
                banner.color = bc;
                float sc = (float)(age < 0.3 ? 1.3 - age : 1);
                banner.rectTransform.localScale = new Vector3(sc, sc, 1);
                if (bannerT <= 0) banner.text = "";
            }
            if (hintHand != null && hint.gameObject.activeSelf)
            {
                float ph = Mathf.Sin(Time.unscaledTime * Mathf.PI * 2 / 1.6f);
                hintHand.localScale = new Vector3(1 + ph * 0.15f, 1 + ph * 0.15f, 1);
            }
            fpsAcc += realDt;
            fpsN++;
            if (fpsAcc > 0.5)
            {
                fps.text = Math.Round(fpsN / fpsAcc) + " FPS · " + run.enemies.aliveCount;
                fpsAcc = 0;
                fpsN = 0;
            }
        }
    }
}
