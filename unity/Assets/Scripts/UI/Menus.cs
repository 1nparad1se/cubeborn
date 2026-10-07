using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace Cubeborn.UI
{
    /// <summary>Builds the out-of-run menu screens inside a single container (ui/Menus.ts).</summary>
    public class Menus
    {
        enum Screen { Main, Heroes, Maps, Weapons, Collection, Upgrades, Achievements, Settings }

        public readonly RectTransform root;
        readonly IMenuApi api;
        readonly List<Screen> stack = new List<Screen>();
        bool selectMode;
        string selHero, selMap, selDiff;
        string tab = "passives";
        RectTransform current;

        public Menus(RectTransform parent, IMenuApi api)
        {
            this.api = api;
            root = Kit.Stretch(Kit.Rect(parent, "Menus"));
            var d = api.profile.data;
            selHero = d.lastHero;
            selMap = d.lastMap;
            selDiff = d.lastDiff;
        }

        public void SetVisible(bool v) => root.gameObject.SetActive(v);

        void Open(Screen s)
        {
            stack.Add(s);
            Render();
        }

        public bool CanGoBack => stack.Count > 1 || (stack.Count == 1 && stack[0] != Screen.Main);

        public void Back()
        {
            api.Sfx("uiBack");
            if (stack.Count > 0) stack.RemoveAt(stack.Count - 1);
            if (stack.Count == 0) stack.Add(Screen.Main);
            if (stack[stack.Count - 1] == Screen.Main) selectMode = false;
            Render();
        }

        public void Home()
        {
            stack.Clear();
            stack.Add(Screen.Main);
            selectMode = false;
            Render();
        }

        public void Render()
        {
            var id = stack.Count > 0 ? stack[stack.Count - 1] : Screen.Main;
            Kit.Clear(root);
            current = Kit.Stretch(Kit.Rect(root, "screen-" + id), 12, 10, 12, 10);
            switch (id)
            {
                case Screen.Main: MainScreen(); break;
                case Screen.Heroes: HeroScreen(); break;
                case Screen.Maps: MapScreen(); break;
                case Screen.Weapons: WeaponScreen(); break;
                case Screen.Collection: CollectionScreen(); break;
                case Screen.Upgrades: UpgradeScreen(); break;
                case Screen.Achievements: AchievementScreen(); break;
                case Screen.Settings: SettingsScreen(); break;
            }
        }

        Button Btn(Transform parent, string label, Action onClick, Kit.BtnStyle style = Kit.BtnStyle.Normal, int size = 11)
        {
            return Kit.Btn(parent, label, () =>
            {
                api.Sfx("ui");
                onClick();
            }, style, size);
        }

        /// <summary>Header row + body below it; returns the body rect.</summary>
        RectTransform Frame(string title, Action<Transform> right = null)
        {
            var head = W.Header(current, title, Back, right ?? (t => W.GoldChip(t, api.profile.data.gold)));
            head.anchorMin = new Vector2(0, 1);
            head.anchorMax = new Vector2(1, 1);
            head.pivot = new Vector2(0.5f, 1);
            head.sizeDelta = new Vector2(0, 46);
            head.anchoredPosition = Vector2.zero;
            return Kit.Stretch(Kit.Rect(current, "body"), 0, 54, 0, 0);
        }

        /// <summary>Left list/grid and right detail panel, both scrollable.</summary>
        void Split(RectTransform body, out RectTransform left, out RectTransform right, float leftFrac = 0.52f)
        {
            var l = Kit.Rect(body, "left");
            l.anchorMin = Vector2.zero;
            l.anchorMax = new Vector2(leftFrac, 1);
            l.offsetMin = Vector2.zero;
            l.offsetMax = new Vector2(-6, 0);
            var lp = Kit.Img(l, Kit.PanelSprite, new Color(Kit.Panel.r, Kit.Panel.g, Kit.Panel.b, 0.88f), "bg");
            Kit.Stretch(lp.rectTransform);
            left = Kit.Scroll(lp.transform, out _, 8, 10);
            Kit.Stretch((RectTransform)left.parent);
            var r = Kit.Rect(body, "right");
            r.anchorMin = new Vector2(leftFrac, 0);
            r.anchorMax = Vector2.one;
            r.offsetMin = new Vector2(6, 0);
            r.offsetMax = Vector2.zero;
            var rp = Kit.Img(r, Kit.PanelSprite, new Color(Kit.Panel.r, Kit.Panel.g, Kit.Panel.b, 0.94f), "bg");
            Kit.Stretch(rp.rectTransform);
            right = Kit.Scroll(rp.transform, out _, 8, 12);
            Kit.Stretch((RectTransform)right.parent);
        }

        static GridLayoutGroup GridIn(Transform parent, float cw, float ch, float spacing = 8)
        {
            return Kit.Grid(parent, cw, ch, spacing);
        }

        /// <summary>Card button with a background, selection frame and click handler.</summary>
        static RectTransform Card(Transform parent, bool locked, Action onClick, out Image frame)
        {
            var bg = Kit.Img(parent, Kit.PanelSprite, locked ? new Color(0.1f, 0.09f, 0.14f, 0.9f) : Kit.Panel2, "card");
            frame = Kit.Img(bg.transform, Kit.FrameSprite, Kit.Gold, "sel");
            Kit.Stretch(frame.rectTransform, -2, -2, -2, -2);
            frame.enabled = false;
            Kit.Clickable(bg.rectTransform, onClick);
            return bg.rectTransform;
        }

        // ------------------------------------------------------------------ main
        void MainScreen()
        {
            var p = api.profile;
            api.SetShowcase(Content.HeroById.TryGetValue(selHero, out var hh) ? hh.model : "bram");
            var logo = Kit.VBox(current, 2, 0, TextAnchor.UpperLeft, "logo");
            Kit.Place((RectTransform)logo.transform, 0, 1, 420, 90, 8, -6);
            var t = Kit.Txt(logo.transform, "CUBEBORN", 34, Kit.Gold, Kit.Px, TextAnchor.UpperLeft, "title");
            Kit.Drop(t, Kit.C(0x7a3a10), 0, -4);
            Kit.Stroke(t, Kit.Ink, 2);
            var sub = Kit.Txt(logo.transform, I18n.T("game_subtitle"), 14, Kit.Text, Kit.UiBold, TextAnchor.UpperLeft, "sub");
            Kit.Drop(sub, Color.black, 0, -2);

            var col = Kit.VBox(current, 10, 0, TextAnchor.LowerLeft, "buttons");
            var crt = (RectTransform)col.transform;
            Kit.Place(crt, 0, 0, 340, 280, 8, 40);
            var play = Btn(col.transform, I18n.T("menu_play"), () =>
            {
                if (!p.data.seenIntro)
                {
                    api.StartRun("bram", "blightwood", "normal");
                    return;
                }
                selectMode = true;
                Open(Screen.Heroes);
            }, Kit.BtnStyle.Primary, 16);
            Kit.LE(play, -1, 60);
            var grid = Kit.Grid(col.transform, 165, 44, 10);
            Kit.LE(grid, -1, 160);
            Btn(grid.transform, I18n.T("menu_heroes"), () => { selectMode = false; Open(Screen.Heroes); }, Kit.BtnStyle.Normal, 9);
            Btn(grid.transform, I18n.T("menu_weapons"), () => Open(Screen.Weapons), Kit.BtnStyle.Normal, 9);
            Btn(grid.transform, I18n.T("menu_collection"), () => Open(Screen.Collection), Kit.BtnStyle.Normal, 9);
            Btn(grid.transform, I18n.T("menu_upgrades"), () => Open(Screen.Upgrades), Kit.BtnStyle.Normal, 9);
            Btn(grid.transform, I18n.T("menu_achievements") + " " + p.data.achievements.Count + "/" + Content.Achievements.Count, () => Open(Screen.Achievements), Kit.BtnStyle.Normal, 9);
            Btn(grid.transform, I18n.T("menu_settings"), () => Open(Screen.Settings), Kit.BtnStyle.Normal, 9);

            var foot = Kit.HBox(current, 12, 0, TextAnchor.LowerRight, "foot");
            Kit.Place((RectTransform)foot.transform, 1, 0, 500, 40, -4, 4);
            W.GoldChip(foot.transform, p.data.gold);
            var pw = Kit.Txt(foot.transform, I18n.T("power_level", "n", p.PowerLevel()), 9, Kit.Dim, Kit.Px, TextAnchor.MiddleRight, "power");
            W.Fit(pw);
            Kit.Stroke(pw, Color.black, 1);
            var ver = Kit.Txt(foot.transform, api.version, 8, Kit.Dim, Kit.Px, TextAnchor.MiddleRight, "ver");
            W.Fit(ver);
        }

        // ------------------------------------------------------------------ heroes
        void HeroScreen()
        {
            var p = api.profile;
            if (!p.IsHeroUnlocked(selHero)) selHero = "bram";
            var body = Frame(selectMode ? I18n.T("choose_hero") : I18n.T("menu_heroes"));
            Split(body, out var left, out var detail, 0.5f);
            var grid = GridIn(left, 92, 104);
            var frames = new Dictionary<string, Image>();
            void Show(string id)
            {
                var hero = Content.HeroById[id];
                bool unlocked = p.IsHeroUnlocked(id);
                if (unlocked)
                {
                    selHero = id;
                    api.SetShowcase(hero.model);
                }
                foreach (var kv in frames) kv.Value.enabled = kv.Key == id;
                Kit.Clear(detail);
                var w = Content.WeaponById[hero.startWeapon];
                var ach = Content.Achievements.FirstOrDefault(a => a.reward != null && a.reward.kind == "hero" && a.reward.id == id);
                W.Title(detail, I18n.L(hero.name), Kit.C(hero.color), 14);
                W.Small(detail, I18n.L(hero.title), Kit.Dim, 13);
                W.Para(detail, I18n.L(hero.desc));
                var perk = Kit.Img(detail, Kit.RoundSprite, new Color(1, 0.82f, 0.24f, 0.1f), "perk");
                var pv = perk.gameObject.AddComponent<VerticalLayoutGroup>();
                pv.padding = new RectOffset(8, 8, 6, 6);
                pv.spacing = 2;
                pv.childControlHeight = pv.childControlWidth = true;
                pv.childForceExpandHeight = false;
                Kit.Txt(perk.transform, I18n.L(hero.perkName), 14, Kit.Gold, Kit.UiBold, TextAnchor.UpperLeft);
                W.Para(perk.transform, I18n.L(hero.perkDesc), Kit.Text, 13);
                W.KV(detail, I18n.T("start_weapon"), I18n.L(w.name), null, Icons.Get(w.icon, w.color));
                W.KV(detail, I18n.T("stat_maxHp"), Fmt.Num(hero.baseHp));
                W.KV(detail, I18n.T("stat_moveSpeed"), Fmt.Num(hero.baseSpeed));
                foreach (var s in Fmt.StatModLines(hero.stats)) W.Para(detail, s, Kit.C(0x8aff9a), 13);
                if (!unlocked) W.Locked(detail, ach != null ? I18n.T("unlock_by", "name", I18n.L(ach.name), "desc", I18n.L(ach.desc)) : I18n.T("locked"));
                if (selectMode && unlocked)
                {
                    var b = Btn(detail, I18n.T("btn_next"), () => Open(Screen.Maps), Kit.BtnStyle.Primary, 12);
                    Kit.LE(b, -1, 50);
                }
            }
            foreach (var hero in Content.Heroes)
            {
                bool unlocked = p.IsHeroUnlocked(hero.id);
                string hid = hero.id;
                var card = Card(grid.transform, !unlocked, () => { api.Sfx("select"); Show(hid); }, out var fr);
                frames[hid] = fr;
                var th = W.Thumb(card, hero.model, 64, !unlocked);
                Kit.Place(th.rectTransform, 0.5f, 1, 64, 64, 0, -6);
                var nm = Kit.Txt(card, unlocked ? I18n.L(hero.name) : "???", 12, unlocked ? Kit.Text : Kit.Dim, Kit.UiBold, TextAnchor.MiddleCenter, "name");
                Kit.Place(nm.rectTransform, 0.5f, 0, 88, 26, 0, 4);
                if (p.Stat("herowin_" + hero.id) > 0)
                {
                    var star = Kit.Txt(card, "★", 10, Kit.Gold, Kit.Px, TextAnchor.UpperRight, "badge");
                    Kit.Place(star.rectTransform, 1, 1, 20, 20, -4, -4);
                }
            }
            Show(selHero);
        }

        // ------------------------------------------------------------------ maps
        void MapScreen()
        {
            var p = api.profile;
            if (!p.IsMapUnlocked(selMap)) selMap = Content.Maps[0].id;
            var body = Frame(I18n.T("choose_map"));
            Split(body, out var list, out var detail, 0.42f);
            var frames = new Dictionary<string, Image>();
            void Show(string id)
            {
                var m = Content.MapById[id];
                bool unlocked = p.IsMapUnlocked(id);
                if (unlocked) selMap = id;
                foreach (var kv in frames) kv.Value.enabled = kv.Key == id;
                Kit.Clear(detail);
                int maxD = p.MaxDifficulty(id);
                if (Content.Difficulties.FindIndex(d => d.id == selDiff) > maxD) selDiff = "normal";
                W.Title(detail, I18n.L(m.name), Kit.Text, 14);
                W.Small(detail, new string('★', m.difficultyStars) + new string('☆', Math.Max(0, 6 - m.difficultyStars)), Kit.Gold, 13).font = Kit.Px;
                W.Para(detail, I18n.L(m.desc));
                var disc = p.data.discBosses;
                W.KV(detail, I18n.T("boss_mid"), unlocked || disc.Contains(m.midBoss) ? I18n.L(Content.BossById[m.midBoss].name) : "???");
                W.KV(detail, I18n.T("boss_final"), unlocked || disc.Contains(m.boss) ? I18n.L(Content.BossById[m.boss].name) : "???");
                W.KV(detail, I18n.T("best_clear"), p.data.mapClears.TryGetValue(id, out var cl) ? I18n.L(Content.Difficulties[cl].name) : "—");
                int mi = Content.Maps.IndexOf(m);
                var prev = mi > 0 ? Content.Maps[mi - 1] : null;
                if (unlocked)
                {
                    W.Small(detail, I18n.T("difficulty"), Kit.Dim, 12);
                    var diffs = Kit.HBox(detail, 6, 0, TextAnchor.MiddleLeft, "diffs");
                    diffs.childForceExpandWidth = true;
                    var info = W.Small(detail, "", Kit.Text, 13);
                    void RenderDiffs()
                    {
                        Kit.Clear(diffs.transform);
                        for (int i = 0; i < Content.Difficulties.Count; i++)
                        {
                            var d = Content.Difficulties[i];
                            bool ok = i <= maxD;
                            string did = d.id;
                            var b = Kit.Btn(diffs.transform, ok ? I18n.L(d.name) : "X", () =>
                            {
                                if (!ok) { api.Sfx("denied"); return; }
                                api.Sfx("select");
                                selDiff = did;
                                RenderDiffs();
                            }, d.id == selDiff ? Kit.BtnStyle.Primary : Kit.BtnStyle.Normal, 8);
                            if (d.id == selDiff) b.targetGraphic.color = Gfx(d.color);
                            if (!ok) b.targetGraphic.color = new Color(0.15f, 0.13f, 0.2f);
                            Kit.LE(b, -1, 40, 1);
                        }
                        var cur = Content.DifficultyById[selDiff];
                        info.text = I18n.L(cur.modifiers) + "\n" + Kit.Col(I18n.T("reward_mult", "n", Fmt.Num(cur.reward)), Kit.Gold);
                    }
                    RenderDiffs();
                    var start = Btn(detail, I18n.T("btn_start"), () =>
                    {
                        p.data.lastHero = selHero;
                        p.data.lastMap = selMap;
                        p.data.lastDiff = selDiff;
                        p.Save();
                        api.StartRun(selHero, selMap, selDiff);
                    }, Kit.BtnStyle.Primary, 15);
                    Kit.LE(start, -1, 56);
                }
                else
                {
                    var pb = prev != null && Content.BossById.TryGetValue(prev.boss, out var bb) ? I18n.L(bb.name) : "?";
                    W.Locked(detail, I18n.T("map_unlock", "boss", pb));
                }
            }
            foreach (var m in Content.Maps)
            {
                bool unlocked = p.IsMapUnlocked(m.id);
                string mid = m.id;
                var card = Card(list, !unlocked, () => { api.Sfx("select"); Show(mid); }, out var fr);
                frames[mid] = fr;
                Kit.LE(card, -1, 52);
                int sw = m.palette.tiles.Count > 0 ? m.palette.tiles.First().Value[0] : 0x777777;
                var swatch = Kit.Img(card, Kit.RoundSprite, Kit.C(sw), "swatch");
                Kit.Place(swatch.rectTransform, 0, 0.5f, 36, 36, 8, 0);
                Kit.Stroke(swatch, Kit.Ink, 2);
                var nm = Kit.Txt(card, unlocked ? I18n.L(m.name) : "???", 14, unlocked ? Kit.Text : Kit.Dim, Kit.UiBold, TextAnchor.MiddleLeft, "name");
                Kit.Stretch(nm.rectTransform, 54, 0, 30, 0);
                if (p.data.mapClears.TryGetValue(m.id, out var c))
                {
                    var star = Kit.Txt(card, "★", 12, Gfx(Content.Difficulties[c].color), Kit.Px, TextAnchor.MiddleRight, "badge");
                    Kit.Stretch(star.rectTransform, 0, 0, 10, 0);
                }
            }
            Show(selMap);
        }

        static Color Gfx(string css) => Cubeborn.View.Gfx.Hex(css);

        // ------------------------------------------------------------------ weapons
        void WeaponScreen()
        {
            var p = api.profile;
            int found = Content.Weapons.Count(w => !w.evolved || p.data.discWeapons.Contains(w.id));
            var body = Frame(I18n.T("menu_weapons"), t => W.Fit(Kit.Txt(t, found + "/" + Content.Weapons.Count, 11, Kit.Dim, Kit.Px, TextAnchor.MiddleRight)));
            Split(body, out var left, out var detail, 0.5f);
            var grid = GridIn(left, 52, 52, 6);
            var frames = new Dictionary<string, Image>();
            void Show(WeaponDef w)
            {
                foreach (var kv in frames) kv.Value.enabled = kv.Key == w.id;
                Kit.Clear(detail);
                bool known = !w.evolved || p.data.discWeapons.Contains(w.id);
                bool unlocked = p.IsWeaponUnlocked(w.id);
                if (!known)
                {
                    W.Title(detail, "???", Kit.Text);
                    W.Para(detail, I18n.T("evo_unknown"));
                    var b = Content.Weapons.FirstOrDefault(x => x.evoInto == w.id);
                    if (b != null) W.Recipe(detail, b, w);
                    return;
                }
                var head = Kit.HBox(detail, 10, 0, TextAnchor.MiddleLeft, "head");
                W.Icon(head.transform, w.icon, w.color, 48);
                var hv = Kit.VBox(head.transform, 2, 0, TextAnchor.MiddleLeft, "names");
                Kit.LE(hv, -1, -1, 1);
                W.Title(hv.transform, I18n.L(w.name), Kit.Text, 12);
                W.Small(hv.transform, I18n.T("rarity_" + w.rarity) + (w.evolved ? " · " + I18n.T("evolution") : ""), W.RarityColor(w.rarity), 13);
                W.Para(detail, I18n.L(w.desc));
                if (!unlocked) W.Locked(detail, LockText(w.id, "weapon"));
                foreach (var row in BaseStatRows(w)) W.KV(detail, row[0], row[1]);
                for (int i = 0; i < w.levels.Count; i++)
                {
                    var lv = Kit.HBox(detail, 8, 0, TextAnchor.UpperLeft, "lv");
                    var lt = Kit.Txt(lv.transform, i + 2 == Content.WeaponMaxLevel ? "MAX" : I18n.T("lvl_short", "n", i + 2), 8, Kit.Gold, Kit.Px, TextAnchor.UpperLeft);
                    Kit.LE(lt, 50, 18, 0);
                    var dt = W.Para(lv.transform, string.Join(", ", Fmt.WeaponDeltaLines(w.levels[i])), Kit.Text, 13);
                    Kit.LE(dt, -1, -1, 1);
                }
                if (w.evoInto != null && Content.WeaponById.TryGetValue(w.evoInto, out var evo)) W.Recipe(detail, w, evo);
            }
            WeaponDef first = null;
            foreach (var w in Content.Weapons.Where(x => !x.evolved))
            {
                var list = new List<WeaponDef> { w };
                if (w.evoInto != null && Content.WeaponById.TryGetValue(w.evoInto, out var evo)) list.Add(evo);
                foreach (var def in list)
                {
                    first = first ?? def;
                    bool known = !def.evolved || p.data.discWeapons.Contains(def.id);
                    bool unlocked = p.IsWeaponUnlocked(def.id);
                    var d = def;
                    var cell = Card(grid.transform, !unlocked, () => { api.Sfx("select"); Show(d); }, out var fr);
                    frames[def.id] = fr;
                    if (def.evolved)
                    {
                        var ef = Kit.Img(cell, Kit.FrameSprite, Kit.C(0xffb02e, 0.6f), "evo");
                        Kit.Stretch(ef.rectTransform, 2, 2, 2, 2);
                    }
                    if (known)
                    {
                        var ic = Kit.Img(cell, Icons.Get(def.icon, def.color), unlocked ? Color.white : new Color(1, 1, 1, 0.4f), "icon");
                        Kit.Stretch(ic.rectTransform, 8, 8, 8, 8);
                    }
                    else
                    {
                        var q = Kit.Txt(cell, "?", 16, Kit.Dim, Kit.Px, TextAnchor.MiddleCenter);
                        Kit.Stretch(q.rectTransform);
                    }
                }
            }
            if (first != null) Show(first);
        }

        static List<string[]> BaseStatRows(WeaponDef w)
        {
            var b = w.@base;
            string T(string k) => I18n.T(k);
            return new List<string[]>
            {
                new[] { T("ws_damage"), Fmt.Num(b.damage) },
                new[] { T("wd_cooldown_s"), Fmt.Num(b.cooldown) + T("u_s") },
                new[] { T("stat_amount"), Fmt.Num(b.amount) },
                new[] { T("stat_area"), Math.Round(b.area * 100) + "%" },
                new[] { T("stat_projSpeed"), Fmt.Num(b.projSpeed) },
                new[] { T("stat_duration"), Fmt.Num(b.duration) + T("u_s") },
                new[] { T("stat_knockback"), Fmt.Num(b.knockback) },
                new[] { T("stat_pierce"), b.pierce < 0 ? "∞" : Fmt.Num(b.pierce) },
                new[] { T("stat_critChance"), Math.Round(b.critChance * 100) + "%" },
                new[] { T("wd_critDamage"), "×" + Fmt.Num(b.critDamage) },
                new[] { T("wd_attackSpeed"), Math.Round(b.attackSpeed * 100) + "%" },
                new[] { T("wd_maxLevel"), Content.WeaponMaxLevel.ToString() },
            };
        }

        static string LockText(string id, string kind)
        {
            var a = Content.Achievements.FirstOrDefault(x => x.reward != null && x.reward.kind == kind && x.reward.id == id);
            return a != null ? I18n.T("unlock_by", "name", I18n.L(a.name), "desc", I18n.L(a.desc)) : I18n.T("locked");
        }

        // ------------------------------------------------------------------ collection
        void CollectionScreen()
        {
            var p = api.profile;
            var body = Frame(I18n.T("menu_collection"));
            var tabs = Kit.HBox(body, 6, 0, TextAnchor.MiddleLeft, "tabs");
            var trt = (RectTransform)tabs.transform;
            trt.anchorMin = new Vector2(0, 1);
            trt.anchorMax = new Vector2(1, 1);
            trt.pivot = new Vector2(0.5f, 1);
            trt.sizeDelta = new Vector2(0, 38);
            tabs.childForceExpandWidth = true;
            var area = Kit.Stretch(Kit.Rect(body, "area"), 0, 46, 0, 0);
            void RenderTab()
            {
                Kit.Clear(tabs.transform);
                foreach (var id in new[] { "passives", "enemies", "bosses", "relics" })
                {
                    string tid = id;
                    var b = Btn(tabs.transform, I18n.T("tab_" + id), () => { tab = tid; RenderTab(); }, tab == id ? Kit.BtnStyle.Primary : Kit.BtnStyle.Normal, 9);
                    Kit.LE(b, -1, 38, 1);
                }
                Kit.Clear(area);
                Split(area, out var left, out var detail, 0.5f);
                bool thumbs = tab == "enemies" || tab == "bosses";
                var grid = GridIn(left, thumbs ? 72 : 52, thumbs ? 72 : 52, 6);
                var cells = new List<Action>();
                Image lastFrame = null;
                void Cell(bool ok, Action<RectTransform> content, Action show)
                {
                    Image fr = null;
                    var c = Card(grid.transform, !ok, () =>
                    {
                        api.Sfx("select");
                        if (lastFrame != null) lastFrame.enabled = false;
                        fr.enabled = true;
                        lastFrame = fr;
                        Kit.Clear(detail);
                        show();
                    }, out fr);
                    content(c);
                    cells.Add(() => { fr.enabled = true; lastFrame = fr; Kit.Clear(detail); show(); });
                }
                if (tab == "passives")
                {
                    foreach (var ps in Content.Passives)
                    {
                        bool ok = p.IsPassiveUnlocked(ps.id);
                        var d = ps;
                        Cell(ok, c => Kit.Stretch(Kit.Img(c, Icons.Get(d.icon, d.color), ok ? Color.white : new Color(1, 1, 1, 0.4f)).rectTransform, 8, 8, 8, 8), () =>
                        {
                            var head = Kit.HBox(detail, 10, 0, TextAnchor.MiddleLeft, "head");
                            W.Icon(head.transform, d.icon, d.color, 48);
                            var hv = Kit.VBox(head.transform, 2, 0, TextAnchor.MiddleLeft, "names");
                            Kit.LE(hv, -1, -1, 1);
                            W.Title(hv.transform, I18n.L(d.name), Kit.Text, 12);
                            W.Small(hv.transform, I18n.T("max_level", "n", d.maxLevel), Kit.Dim, 13);
                            W.Para(detail, I18n.L(d.desc));
                            foreach (var s in Fmt.StatModLines(d.perLevel)) W.Para(detail, s + " " + I18n.T("per_level"), Kit.C(0x8aff9a), 13);
                            foreach (var w in Content.Weapons.Where(x => x.evoPassive == d.id))
                                if (w.evoInto != null && Content.WeaponById.TryGetValue(w.evoInto, out var evo)) W.Recipe(detail, w, evo);
                            if (!ok) W.Locked(detail, LockText(d.id, "passive"));
                        });
                    }
                }
                else if (tab == "enemies")
                {
                    foreach (var e in Content.Enemies)
                    {
                        if (e.behavior == "prop" || e.id == "shield_crystal") continue;
                        bool seen = p.data.discEnemies.Contains(e.id);
                        var d = e;
                        Cell(seen, c => Kit.Stretch(W.Thumb(c, d.model, 64, !seen).rectTransform, 4, 4, 4, 4), () =>
                        {
                            if (!seen) { W.Title(detail, "???", Kit.Text); W.Para(detail, I18n.T("not_seen")); return; }
                            W.Title(detail, I18n.L(d.name), Kit.Text, 13);
                            W.Small(detail, I18n.T("cat_" + d.category), Kit.Dim, 13);
                            W.Thumb(detail, d.model, 120).preserveAspect = true;
                            W.KV(detail, I18n.T("stat_maxHp"), Fmt.Num(d.hp));
                            W.KV(detail, I18n.T("ws_damage"), Fmt.Num(d.damage));
                            W.KV(detail, I18n.T("stat_moveSpeed"), Fmt.Num(d.speed));
                            W.KV(detail, I18n.T("killed"), Fmt.Count(p.Stat("kill_" + d.id)));
                        });
                    }
                }
                else if (tab == "bosses")
                {
                    foreach (var b in Content.Bosses)
                    {
                        bool seen = p.data.discBosses.Contains(b.id);
                        var d = b;
                        Cell(seen, c => Kit.Stretch(W.Thumb(c, d.model, 64, !seen).rectTransform, 4, 4, 4, 4), () =>
                        {
                            if (!seen) { W.Title(detail, "???", Kit.Text); W.Para(detail, I18n.T("not_seen")); return; }
                            W.Title(detail, I18n.L(d.name), Kit.C(d.color), 13);
                            W.Small(detail, I18n.L(d.title), Kit.Dim, 13);
                            W.Thumb(detail, d.model, 120);
                            W.KV(detail, I18n.T("stat_maxHp"), Fmt.Count(d.hp));
                            W.KV(detail, I18n.T("phases"), d.phases.Count.ToString());
                            W.KV(detail, I18n.T("killed"), Fmt.Count(p.Stat("boss_" + d.id)));
                            if (d.relic != null && Content.RelicById.TryGetValue(d.relic, out var relic))
                                W.KV(detail, I18n.T("relic"), p.data.discRelics.Contains(relic.id) ? I18n.L(relic.name) : "???");
                        });
                    }
                }
                else
                {
                    foreach (var r in Content.Relics)
                    {
                        bool got = p.data.discRelics.Contains(r.id);
                        var d = r;
                        Cell(got, c => Kit.Stretch(Kit.Img(c, Icons.Get("crystal", got ? d.color : 0x3a3a48), Color.white).rectTransform, 8, 8, 8, 8), () =>
                        {
                            var boss = Content.Bosses.FirstOrDefault(b => b.relic == d.id);
                            var head = Kit.HBox(detail, 10, 0, TextAnchor.MiddleLeft, "head");
                            W.Icon(head.transform, "crystal", d.color, 48);
                            var tt = W.Title(head.transform, got ? I18n.L(d.name) : "???", Kit.Text, 12);
                            Kit.LE(tt, -1, -1, 1);
                            W.Para(detail, got ? I18n.L(d.desc) : I18n.T("relic_hint", "boss", boss != null ? I18n.L(boss.name) : "?"));
                            if (got) foreach (var s in Fmt.StatModLines(d.stats)) W.Para(detail, s, Kit.C(0x8aff9a), 13);
                        });
                    }
                }
                if (cells.Count > 0) cells[0]();
            }
            RenderTab();
        }

        // ------------------------------------------------------------------ upgrades
        void UpgradeScreen()
        {
            var p = api.profile;
            Text goldText = null;
            var body = Frame(I18n.T("menu_upgrades"), t =>
            {
                var chip = W.GoldChip(t, p.data.gold);
                goldText = chip.transform.Find("v").GetComponent<Text>();
            });
            var refund = Btn(body, I18n.T("btn_refund"), () => W.Confirm(api, I18n.T("refund_confirm"), () => { p.RefundPerms(); Render(); }), Kit.BtnStyle.Normal, 9);
            Kit.Place((RectTransform)refund.transform, 0.5f, 0, 240, 40, 0, 0);
            var area = Kit.Stretch(Kit.Rect(body, "area"), 0, 0, 0, 50);
            var bg = Kit.Img(area, Kit.PanelSprite, new Color(Kit.Panel.r, Kit.Panel.g, Kit.Panel.b, 0.9f), "bg");
            Kit.Stretch(bg.rectTransform);
            var list = Kit.Scroll(bg.transform, out _, 8, 10);
            Kit.Stretch((RectTransform)list.parent);
            void RenderList()
            {
                goldText.text = Fmt.Count(p.data.gold);
                Kit.Clear(list);
                foreach (var u in Content.Upgrades)
                {
                    int lvl = p.PermLevel(u.id);
                    bool max = lvl >= u.maxLevel;
                    double cost = p.PermNextCost(u.id);
                    bool can = !max && p.data.gold >= cost;
                    var row = Kit.Img(list, Kit.RoundSprite, max ? new Color(0.35f, 0.84f, 0.42f, 0.12f) : Kit.Panel2, "up");
                    var h = row.gameObject.AddComponent<HorizontalLayoutGroup>();
                    h.padding = new RectOffset(10, 10, 8, 8);
                    h.spacing = 10;
                    h.childAlignment = TextAnchor.MiddleLeft;
                    h.childControlHeight = h.childControlWidth = true;
                    h.childForceExpandWidth = h.childForceExpandHeight = false;
                    W.Icon(row.transform, u.icon, 0xffd23d, 32);
                    var v = Kit.VBox(row.transform, 3, 0, TextAnchor.MiddleLeft, "body");
                    Kit.LE(v, -1, -1, 1);
                    Kit.Txt(v.transform, I18n.L(u.name), 14, Kit.Text, Kit.UiBold);
                    W.Small(v.transform, string.Join(", ", Fmt.StatModLines(u.perLevel)) + " " + I18n.T("per_level"), Kit.Dim, 12);
                    var pips = Kit.HBox(v.transform, 3, 0, TextAnchor.MiddleLeft, "pips");
                    for (int i = 0; i < u.maxLevel; i++) Kit.LE(Kit.Img(pips.transform, null, i < lvl ? Kit.Gold : new Color(1, 1, 1, 0.15f), "pip"), 12, 6);
                    string uid = u.id;
                    var b = Kit.Btn(row.transform, max ? "MAX" : Fmt.Count(cost), () =>
                    {
                        if (p.BuyPerm(uid)) { api.Sfx("buy"); RenderList(); }
                        else api.Sfx("denied");
                    }, can ? Kit.BtnStyle.Primary : Kit.BtnStyle.Normal, 9);
                    if (!can) b.targetGraphic.color = new Color(0.2f, 0.18f, 0.26f);
                    Kit.LE(b, 110, 40);
                }
            }
            RenderList();
        }

        // ------------------------------------------------------------------ achievements
        void AchievementScreen()
        {
            var p = api.profile;
            var body = Frame(I18n.T("menu_achievements"), t => W.Fit(Kit.Txt(t, p.data.achievements.Count + "/" + Content.Achievements.Count, 11, Kit.Dim, Kit.Px, TextAnchor.MiddleRight)));
            var bg = Kit.Img(body, Kit.PanelSprite, new Color(Kit.Panel.r, Kit.Panel.g, Kit.Panel.b, 0.9f), "bg");
            Kit.Stretch(bg.rectTransform);
            var list = Kit.Scroll(bg.transform, out _, 6, 10);
            Kit.Stretch((RectTransform)list.parent);
            foreach (var a in Content.Achievements)
            {
                bool done = p.data.achievements.Contains(a.id);
                double prog = p.AchievementProgress(a);
                bool hidden = a.hidden && !done;
                var row = Kit.Img(list, Kit.RoundSprite, done ? new Color(1, 0.82f, 0.24f, 0.12f) : Kit.Panel2, "ach");
                var h = row.gameObject.AddComponent<HorizontalLayoutGroup>();
                h.padding = new RectOffset(10, 10, 8, 8);
                h.spacing = 10;
                h.childAlignment = TextAnchor.MiddleLeft;
                h.childControlHeight = h.childControlWidth = true;
                h.childForceExpandWidth = h.childForceExpandHeight = false;
                var ic = Kit.Txt(row.transform, done ? "★" : "☆", 18, done ? Kit.Gold : Kit.Dim, Kit.Px, TextAnchor.MiddleCenter);
                Kit.LE(ic, 30, 30);
                var v = Kit.VBox(row.transform, 3, 0, TextAnchor.MiddleLeft, "body");
                Kit.LE(v, -1, -1, 1);
                Kit.Txt(v.transform, hidden ? "???" : I18n.L(a.name), 14, done ? Kit.Gold : Kit.Text, Kit.UiBold);
                W.Small(v.transform, hidden ? I18n.T("hidden_ach") : I18n.L(a.desc), Kit.Dim, 12);
                if (!done)
                {
                    var track = Kit.Img(v.transform, null, new Color(0, 0, 0, 0.5f), "prog");
                    Kit.LE(track, -1, 6);
                    var fill = Kit.Img(track.transform, null, Kit.Green, "fill");
                    fill.rectTransform.anchorMin = Vector2.zero;
                    fill.rectTransform.anchorMax = new Vector2((float)prog, 1);
                    fill.rectTransform.offsetMin = fill.rectTransform.offsetMax = Vector2.zero;
                }
                if (a.reward != null || a.gold > 0) W.Small(v.transform, W.RewardText(a), Kit.C(0xffc070), 12);
            }
        }

        // ------------------------------------------------------------------ settings
        void SettingsScreen()
        {
            var body = Frame(I18n.T("menu_settings"));
            var bg = Kit.Img(body, Kit.PanelSprite, new Color(Kit.Panel.r, Kit.Panel.g, Kit.Panel.b, 0.92f), "bg");
            Kit.Stretch(bg.rectTransform);
            var list = Kit.Scroll(bg.transform, out _, 8, 14);
            Kit.Stretch((RectTransform)list.parent);
            W.SettingsPanel(list, api, Render);
        }
    }
}
