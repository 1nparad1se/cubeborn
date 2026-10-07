using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Cubeborn.View;

namespace Cubeborn.UI
{
    /// <summary>What menus and run screens need from the app.</summary>
    public interface IMenuApi
    {
        Profile profile { get; }
        string version { get; }
        void Sfx(string id);
        void StartRun(string hero, string map, string diff);
        void SetShowcase(string modelId);
        void ApplySettings();
        void SaveSoon();
        void ResetProgress();
        RectTransform ModalLayer { get; }
    }

    /// <summary>Composite widgets shared by the menu and run screens.</summary>
    public static class W
    {
        public static readonly Dictionary<string, int> Rarity = new Dictionary<string, int>
        {
            { "common", 0xc8ccd8 }, { "uncommon", 0x6aff8a }, { "rare", 0x5ab4ff }, { "epic", 0xc77dff }, { "legendary", 0xffb02e },
        };

        public static Color RarityColor(string r) => Rarity.TryGetValue(r ?? "", out var c) ? Kit.C(c) : Color.white;

        /// <summary>Dark rounded panel with padding; returns its vertical layout content.</summary>
        public static VerticalLayoutGroup Panel(Transform parent, int pad = 12, float spacing = 8, string name = "panel")
        {
            var img = Kit.Img(parent, Kit.PanelSprite, new Color(Kit.Panel.r, Kit.Panel.g, Kit.Panel.b, 0.94f), name);
            var v = img.gameObject.AddComponent<VerticalLayoutGroup>();
            v.padding = new RectOffset(pad, pad, pad, pad);
            v.spacing = spacing;
            v.childControlWidth = v.childControlHeight = true;
            v.childForceExpandWidth = true;
            v.childForceExpandHeight = false;
            return v;
        }

        public static Text Title(Transform parent, string text, Color color, int size = 13)
        {
            var t = Kit.Txt(parent, text, size, color, Kit.Px, TextAnchor.MiddleLeft, "title");
            Kit.Drop(t, new Color(0, 0, 0, 0.6f), 0, -2);
            return t;
        }

        public static Text Para(Transform parent, string text, Color? color = null, int size = 14)
        {
            var t = Kit.Txt(parent, text, size, color ?? Kit.Text, Kit.Ui, TextAnchor.UpperLeft, "p");
            return t;
        }

        public static Text Small(Transform parent, string text, Color? color = null, int size = 12)
        {
            return Kit.Txt(parent, text, size, color ?? Kit.Dim, Kit.Ui, TextAnchor.UpperLeft, "small");
        }

        /// <summary>Key/value row.</summary>
        public static HorizontalLayoutGroup KV(Transform parent, string k, string v, Color? vc = null, Sprite icon = null)
        {
            var h = Kit.HBox(parent, 6, 0, TextAnchor.MiddleLeft, "kv");
            h.childForceExpandWidth = false;
            var a = Kit.Txt(h.transform, k, 13, Kit.Dim, Kit.Ui, TextAnchor.MiddleLeft, "k");
            Kit.LE(a, -1, 20, 1);
            if (icon != null) Kit.LE(Kit.Img(h.transform, icon, Color.white, "i"), 18, 18);
            var b = Kit.Txt(h.transform, v, 13, vc ?? Kit.Text, Kit.UiBold, TextAnchor.MiddleRight, "v");
            b.horizontalOverflow = HorizontalWrapMode.Overflow;
            Kit.LE(b, -1, 20, 0);
            Kit.FitBoth(b);
            return h;
        }

        public static Text Locked(Transform parent, string text)
        {
            var box = Kit.Img(parent, Kit.RoundSprite, new Color(1, 0.3f, 0.35f, 0.12f), "locked");
            var t = Kit.Txt(box.transform, text, 13, Kit.C(0xff8a95), Kit.Ui, TextAnchor.MiddleLeft, "t");
            Kit.Stretch(t.rectTransform, 8, 6, 8, 6);
            var le = Kit.LE(box, -1, -1);
            var fit = box.gameObject.AddComponent<VerticalLayoutGroup>();
            fit.padding = new RectOffset(8, 8, 6, 6);
            fit.childControlHeight = fit.childControlWidth = true;
            return t;
        }

        public static Image Icon(Transform parent, string icon, int color, float size)
        {
            var img = Kit.Img(parent, Icons.Get(icon, color), Color.white, "icon");
            Kit.LE(img, size, size);
            return img;
        }

        public static Image Thumb(Transform parent, string model, float size, bool silhouette = false)
        {
            var img = Kit.Img(parent, Thumbs.Get(model, silhouette), Color.white, "thumb");
            img.preserveAspect = true;
            Kit.LE(img, size, size);
            if (img.sprite == null) img.color = new Color(0, 0, 0, 0);
            return img;
        }

        /// <summary>Gold amount with a coin icon.</summary>
        public static HorizontalLayoutGroup GoldChip(Transform parent, double gold)
        {
            var bg = Kit.Img(parent, Kit.PanelSprite, new Color(10 / 255f, 8 / 255f, 16 / 255f, 0.8f), "gold");
            var h = bg.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.padding = new RectOffset(10, 10, 6, 6);
            h.spacing = 6;
            h.childAlignment = TextAnchor.MiddleCenter;
            h.childControlHeight = h.childControlWidth = true;
            h.childForceExpandWidth = h.childForceExpandHeight = false;
            Icon(bg.transform, "coin", 0xffd23d, 16);
            var t = Kit.Txt(bg.transform, Fmt.Count(gold), 11, Kit.Gold, Kit.Px, TextAnchor.MiddleLeft, "v");
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            Kit.FitBoth(t);
            Kit.FitBoth(bg);
            return h;
        }

        /// <summary>Evolution recipe: base MAX + passive -> evolution.</summary>
        public static void Recipe(Transform parent, WeaponDef b, WeaponDef evo)
        {
            if (b?.evoPassive == null || evo == null || !Content.PassiveById.TryGetValue(b.evoPassive, out var ps)) return;
            var box = Kit.Img(parent, Kit.RoundSprite, new Color(1, 0.7f, 0.2f, 0.1f), "recipe");
            var v = box.gameObject.AddComponent<VerticalLayoutGroup>();
            v.padding = new RectOffset(8, 8, 6, 6);
            v.spacing = 4;
            v.childControlHeight = v.childControlWidth = true;
            v.childForceExpandHeight = false;
            var h = Kit.HBox(box.transform, 5, 0, TextAnchor.MiddleLeft, "row");
            Icon(h.transform, b.icon, b.color, 20);
            Fit(Kit.Txt(h.transform, "MAX", 8, Kit.Gold, Kit.Px));
            Fit(Kit.Txt(h.transform, "+", 12, Kit.Dim, Kit.Px));
            Icon(h.transform, ps.icon, ps.color, 20);
            Fit(Kit.Txt(h.transform, "→", 12, Kit.Dim, Kit.Px));
            Icon(h.transform, evo.icon, evo.color, 20);
            Small(box.transform, I18n.L(b.name) + " + " + I18n.L(ps.name), Kit.C(0xffc070));
        }

        public static Text Fit(Text t)
        {
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            Kit.FitBoth(t);
            return t;
        }

        /// <summary>Screen header: back button, title and a right-side element.</summary>
        public static RectTransform Header(Transform parent, string title, Action back, Action<Transform> right)
        {
            var h = Kit.HBox(parent, 10, 0, TextAnchor.MiddleLeft, "head");
            var rt = (RectTransform)h.transform;
            var b = Kit.Btn(h.transform, "‹", back, Kit.BtnStyle.Normal, 16, "back");
            Kit.LE(b, 44, 44);
            var t = Title(h.transform, title, Kit.Text, 14);
            Kit.LE(t, -1, 44, 1);
            right?.Invoke(h.transform);
            return rt;
        }

        // ------------------------------------------------------------ settings controls

        public static Slider MakeSlider(Transform parent, float value, Action<float> onChange)
        {
            var rt = Kit.Rect(parent, "slider");
            Kit.LE(rt, 160, 24, 1);
            var bg = Kit.Img(rt, Kit.RoundSprite, Kit.Ink, "bg");
            Kit.Stretch(bg.rectTransform, 0, 8, 0, 8);
            var fillArea = Kit.Stretch(Kit.Rect(rt, "fillArea"), 0, 8, 0, 8);
            var fill = Kit.Img(fillArea, Kit.RoundSprite, Kit.Green, "fill");
            Kit.Stretch(fill.rectTransform);
            var handleArea = Kit.Stretch(Kit.Rect(rt, "handleArea"), 10, 0, 10, 0);
            var handle = Kit.Img(handleArea, Kit.BtnSprite, Kit.C(0xece6f6), "handle");
            handle.rectTransform.sizeDelta = new Vector2(20, 0);
            var s = rt.gameObject.AddComponent<Slider>();
            s.fillRect = fill.rectTransform;
            s.handleRect = handle.rectTransform;
            s.targetGraphic = handle;
            s.direction = Slider.Direction.LeftToRight;
            s.minValue = 0;
            s.maxValue = 1;
            s.value = value;
            s.onValueChanged.AddListener(v => onChange(v));
            bg.raycastTarget = true;
            return s;
        }

        public static HorizontalLayoutGroup Row(Transform parent, string label)
        {
            var h = Kit.HBox(parent, 10, 0, TextAnchor.MiddleLeft, "row");
            var t = Kit.Txt(h.transform, label, 14, Kit.Text, Kit.Ui, TextAnchor.MiddleLeft, "label");
            Kit.LE(t, 150, 36, 0);
            return h;
        }

        /// <summary>Settings controls, shared by the main menu and the pause menu.</summary>
        public static void SettingsPanel(Transform parent, IMenuApi api, Action rerender)
        {
            var s = api.profile.data.settings;
            void Save()
            {
                api.SaveSoon();
                api.ApplySettings();
            }
            void SliderRow(string label, bool music)
            {
                var row = Row(parent, label);
                var val = Kit.Txt(row.transform, Math.Round((music ? s.music : s.sfx) * 100) + "%", 10, Kit.Dim, Kit.Px, TextAnchor.MiddleRight, "val");
                MakeSlider(row.transform, (float)(music ? s.music : s.sfx), v =>
                {
                    if (music) s.music = Math.Round(v * 100) / 100; else s.sfx = Math.Round(v * 100) / 100;
                    val.text = Math.Round(v * 100) + "%";
                    Save();
                });
                val.transform.SetAsLastSibling();
                Kit.LE(val, 54, 30, 0);
            }
            void Toggle(string label, Func<bool> get, Action<bool> set)
            {
                var row = Row(parent, label);
                Button b = null;
                b = Kit.Btn(row.transform, get() ? I18n.T("on") : I18n.T("off"), () =>
                {
                    set(!get());
                    Kit.SetStyle(b, get() ? Kit.BtnStyle.Primary : Kit.BtnStyle.Normal);
                    Kit.Label(b).text = (get() ? I18n.T("on") : I18n.T("off")).ToUpperInvariant();
                    api.Sfx("ui");
                    Save();
                }, get() ? Kit.BtnStyle.Primary : Kit.BtnStyle.Normal, 10);
                Kit.LE(b, 90, 36);
            }
            void Seg(string label, string[][] opts, string cur, Action<string> set)
            {
                var row = Row(parent, label);
                foreach (var o in opts)
                {
                    string id = o[0];
                    var b = Kit.Btn(row.transform, o[1], () =>
                    {
                        api.Sfx("ui");
                        set(id);
                        Save();
                        rerender();
                    }, id == cur ? Kit.BtnStyle.Primary : Kit.BtnStyle.Normal, 9);
                    Kit.LE(b, -1, 36, 1);
                }
            }
            SliderRow(I18n.T("set_music"), true);
            SliderRow(I18n.T("set_sfx"), false);
            Toggle(I18n.T("set_vibration"), () => s.vibration, v => s.vibration = v);
            Seg(I18n.T("set_quality"), new[] { new[] { "low", I18n.T("q_low") }, new[] { "medium", I18n.T("q_medium") }, new[] { "high", I18n.T("q_high") } }, s.quality, v => s.quality = v);
            Toggle(I18n.T("set_numbers"), () => s.damageNumbers, v => s.damageNumbers = v);
            Toggle(I18n.T("set_shake"), () => s.screenShake, v => s.screenShake = v);
            Toggle(I18n.T("set_fps"), () => s.showFps, v => s.showFps = v);
            var langs = new List<string[]>();
            foreach (var l in I18n.Langs) langs.Add(new[] { l[0], l[1] });
            Seg(I18n.T("set_lang"), langs.ToArray(), s.lang, v => { s.lang = v; I18n.SetLang(v); });
            var rr = Row(parent, I18n.T("set_reset"));
            var rb = Kit.Btn(rr.transform, I18n.T("btn_reset"), () => Confirm(api, I18n.T("reset_confirm"), api.ResetProgress), Kit.BtnStyle.Danger, 9);
            Kit.LE(rb, -1, 36);
            var cr = Small(parent, I18n.T("credits") + "\n" + api.version, Kit.Dim, 12);
            cr.alignment = TextAnchor.UpperCenter;
        }

        /// <summary>Modal yes/no box over everything.</summary>
        public static void Confirm(IMenuApi api, string text, Action yes)
        {
            var back = Kit.Img(api.ModalLayer, null, new Color(0, 0, 0, 0.7f), "confirm");
            Kit.Stretch(back.rectTransform);
            back.raycastTarget = true;
            var panel = Panel(back.transform, 16, 14, "modal");
            Kit.Place((RectTransform)panel.transform, 0.5f, 0.5f, 360, 160);
            Kit.FitV(panel);
            var p = Para(panel.transform, text, Kit.Text, 15);
            p.alignment = TextAnchor.MiddleCenter;
            var row = Kit.HBox(panel.transform, 10, 0, TextAnchor.MiddleCenter, "row");
            row.childForceExpandWidth = true;
            var no = Kit.Btn(row.transform, I18n.T("btn_no"), () => { api.Sfx("uiBack"); UnityEngine.Object.Destroy(back.gameObject); });
            Kit.LE(no, -1, 44, 1);
            var ok = Kit.Btn(row.transform, I18n.T("btn_yes"), () => { UnityEngine.Object.Destroy(back.gameObject); yes(); }, Kit.BtnStyle.Danger);
            Kit.LE(ok, -1, 44, 1);
        }

        public static string RewardText(AchievementDef a)
        {
            var parts = new List<string>();
            if (a.reward != null)
            {
                var r = a.reward;
                string name = "";
                if (r.kind == "hero" && Content.HeroById.TryGetValue(r.id, out var h)) name = I18n.L(h.name);
                else if (r.kind == "weapon" && Content.WeaponById.TryGetValue(r.id, out var w)) name = I18n.L(w.name);
                else if (r.kind == "passive" && Content.PassiveById.TryGetValue(r.id, out var p)) name = I18n.L(p.name);
                else if (Content.MapById.TryGetValue(r.id, out var m)) name = I18n.L(m.name);
                parts.Add(I18n.T("unlock_" + r.kind, "name", name));
            }
            if (a.gold > 0) parts.Add("+" + a.gold + " " + I18n.T("gold"));
            return string.Join(" · ", parts);
        }
    }
}
