using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace Cubeborn.UI
{
    public class ResultData
    {
        public bool victory;
        public RunSummary summary;
        public double goldEarned;
        public string diffName;
        public List<AchievementDef> achievements;
        public string relic;
        public List<string> newUnlocks;
    }

    /// <summary>Level-up, chest, pause and results overlays shown during a run (ui/RunModals.ts).</summary>
    public class RunModals
    {
        public readonly RectTransform root;
        readonly IMenuApi api;
        bool banishMode;
        int openId;

        public RunModals(RectTransform parent, IMenuApi api)
        {
            this.api = api;
            root = Kit.Stretch(Kit.Rect(parent, "RunModals"));
            root.gameObject.SetActive(false);
        }

        public bool IsOpen => root.gameObject.activeSelf;

        public void Close()
        {
            openId++;
            Kit.Clear(root);
            root.gameObject.SetActive(false);
        }

        /// <summary>Dimmed backdrop + centred panel; returns the panel's layout.</summary>
        VerticalLayoutGroup Open(float width, string title, Color titleColor, string sub = null)
        {
            openId++;
            Kit.Clear(root);
            root.gameObject.SetActive(true);
            var back = Kit.Img(root, null, new Color(8 / 255f, 6 / 255f, 14 / 255f, 0.72f), "back");
            Kit.Stretch(back.rectTransform);
            back.raycastTarget = true;
            var panel = W.Panel(back.transform, 14, 8, "modal");
            var prt = (RectTransform)panel.transform;
            Kit.Place(prt, 0.5f, 0.5f, width, 100);
            Kit.FitV(panel);
            panel.childAlignment = TextAnchor.UpperCenter;
            var t = Kit.Txt(panel.transform, title, 18, titleColor, Kit.Px, TextAnchor.MiddleCenter, "title");
            Kit.Drop(t, new Color(0, 0, 0, 0.8f), 0, -3);
            Kit.Stroke(t, Kit.Ink, 1.5f);
            if (sub != null) Kit.Txt(panel.transform, sub, 13, Kit.Dim, Kit.Ui, TextAnchor.MiddleCenter, "sub");
            return panel;
        }

        float ScreenW => ((RectTransform)root.parent).rect.width;
        float ScreenH => ((RectTransform)root.parent).rect.height;

        // ------------------------------------------------------------------ level up
        public void LevelUp(Run run, List<Choice> choices, Action done)
        {
            banishMode = false;
            var panel = Open(Math.Min(ScreenW - 24, 900), I18n.T("level_up"), Kit.C(0x8affff), I18n.T("hud_level", "n", run.player.level + 1 - run.player.pendingLevels));
            var cards = Kit.HBox(panel.transform, 10, 0, TextAnchor.UpperCenter, "choices");
            cards.childForceExpandWidth = true;
            cards.childControlHeight = true;
            cards.childForceExpandHeight = true;
            var actions = Kit.HBox(panel.transform, 10, 0, TextAnchor.MiddleCenter, "actions");
            var hint = Kit.Txt(panel.transform, I18n.T("banish_hint"), 12, Kit.C(0xff8a8a), Kit.Ui, TextAnchor.MiddleCenter, "hint");
            hint.gameObject.SetActive(false);
            Action renderActions = null;
            void Render(List<Choice> list)
            {
                Kit.Clear(cards.transform);
                float cw = Math.Min(230, (Math.Min(ScreenW - 24, 900) - 28 - 10 * (list.Count - 1)) / Math.Max(1, list.Count));
                foreach (var c in list)
                {
                    var choice = c;
                    var card = ChoiceCard(cards.transform, run, c, cw);
                    Kit.Clickable(card, () =>
                    {
                        if (banishMode)
                        {
                            if (choice.kind == ChoiceKind.Gold || choice.kind == ChoiceKind.Heal) return;
                            var next = run.Banish(choice.id);
                            api.Sfx("uiBack");
                            banishMode = false;
                            hint.gameObject.SetActive(false);
                            if (next != null) Render(next);
                            return;
                        }
                        api.Sfx("select");
                        run.Choose(choice);
                        done();
                    });
                }
                renderActions();
            }
            renderActions = () =>
            {
                Kit.Clear(actions.transform);
                var lv = run.leveling;
                Button Act(string icon, int col, string label, int n, bool active, Action fn)
                {
                    var b = Kit.Btn(actions.transform, null, fn, active ? Kit.BtnStyle.Danger : Kit.BtnStyle.Normal);
                    var h = b.gameObject.AddComponent<HorizontalLayoutGroup>();
                    h.padding = new RectOffset(12, 12, 6, 8);
                    h.spacing = 6;
                    h.childAlignment = TextAnchor.MiddleCenter;
                    h.childControlWidth = h.childControlHeight = true;
                    h.childForceExpandWidth = h.childForceExpandHeight = false;
                    W.Icon(b.transform, icon, col, 18);
                    W.Fit(Kit.Txt(b.transform, (label + " " + n).ToUpperInvariant(), 9, Kit.Text, Kit.Px, TextAnchor.MiddleLeft));
                    if (n <= 0) b.targetGraphic.color = new Color(0.17f, 0.15f, 0.22f);
                    Kit.LE(b, -1, 40);
                    return b;
                }
                Act("dice", 0xffffff, I18n.T("btn_reroll"), lv.rerolls, false, () =>
                {
                    var next = run.Reroll();
                    if (next != null) { api.Sfx("ui"); Render(next); }
                    else api.Sfx("denied");
                });
                Act("skip", 0x8ad8ff, I18n.T("btn_skip"), lv.skips, false, () =>
                {
                    if (lv.skips <= 0) { api.Sfx("denied"); return; }
                    api.Sfx("ui");
                    run.Skip();
                    done();
                });
                Act("banish", 0xff5a5a, I18n.T("btn_banish"), lv.banishes, banishMode, () =>
                {
                    if (lv.banishes <= 0) { api.Sfx("denied"); return; }
                    banishMode = !banishMode;
                    hint.gameObject.SetActive(banishMode);
                    api.Sfx("ui");
                    renderActions();
                });
            };
            Render(choices);
        }

        RectTransform ChoiceCard(Transform parent, Run run, Choice c, float width)
        {
            Sprite icon;
            string name, tag;
            var lines = new List<string>();
            Color color = W.RarityColor(c.rarity);
            string hint = "";
            bool isNew = c.kind == ChoiceKind.WeaponNew || c.kind == ChoiceKind.PassiveNew;
            if (c.kind == ChoiceKind.WeaponNew || c.kind == ChoiceKind.WeaponUp)
            {
                var w = Content.WeaponById[c.id];
                icon = Icons.Get(w.icon, w.color);
                name = I18n.L(w.name);
                if (c.kind == ChoiceKind.WeaponNew)
                {
                    tag = I18n.T("new");
                    lines.Add(I18n.L(w.desc));
                }
                else
                {
                    tag = c.level >= Content.WeaponMaxLevel ? "MAX" : I18n.T("lvl_short", "n", c.level);
                    lines.AddRange(Fmt.WeaponDeltaLines(c.level - 2 >= 0 && c.level - 2 < w.levels.Count ? w.levels[c.level - 2] : null));
                }
                if (w.evoPassive != null && Content.PassiveById.TryGetValue(w.evoPassive, out var ps))
                    hint = (run.passives.Has(ps.id) ? "✓ " : "") + I18n.T("evo_with", "name", I18n.L(ps.name));
            }
            else if (c.kind == ChoiceKind.PassiveNew || c.kind == ChoiceKind.PassiveUp)
            {
                var p = Content.PassiveById[c.id];
                icon = Icons.Get(p.icon, p.color);
                name = I18n.L(p.name);
                tag = c.kind == ChoiceKind.PassiveNew ? I18n.T("new") : I18n.T("lvl_short", "n", c.level);
                if (c.kind == ChoiceKind.PassiveNew) lines.Add(I18n.L(p.desc));
                else lines.AddRange(Fmt.StatModLines(p.perLevel));
                var evo = Content.Weapons.FirstOrDefault(w => w.evoPassive == p.id && run.weapons.Has(w.id));
                if (evo != null) hint = "✓ " + I18n.T("evo_for", "name", I18n.L(evo.name));
            }
            else if (c.kind == ChoiceKind.Gold)
            {
                icon = Icons.Get("coin", 0xffd23d);
                name = I18n.T("choice_gold");
                tag = "";
                lines.Add(I18n.T("choice_gold_desc", "n", Math.Round(25 * run.player.stats.greed)));
                color = Kit.Gold;
            }
            else
            {
                icon = Icons.Get("heart", 0xff4a6a);
                name = I18n.T("choice_heal");
                tag = "";
                lines.Add(I18n.T("choice_heal_desc"));
                color = Kit.C(0xff6a8a);
            }
            var bg = Kit.Img(parent, Kit.BtnSprite, Kit.Panel2, "choice");
            Kit.LE(bg, width, -1, 0, 1, -1, 190);
            var v = bg.gameObject.AddComponent<VerticalLayoutGroup>();
            v.padding = new RectOffset(10, 10, 10, 12);
            v.spacing = 5;
            v.childAlignment = TextAnchor.UpperCenter;
            v.childControlWidth = v.childControlHeight = true;
            v.childForceExpandWidth = true;
            v.childForceExpandHeight = false;
            var edge = Kit.Img(bg.transform, Kit.FrameSprite, color, "edge");
            edge.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            Kit.Stretch(edge.rectTransform, -1, -1, -1, -1);
            var head = Kit.HBox(bg.transform, 8, 0, TextAnchor.MiddleLeft, "head");
            var ic = Kit.Img(head.transform, icon, Color.white, "icon");
            Kit.LE(ic, 40, 40);
            var nv = Kit.VBox(head.transform, 2, 0, TextAnchor.MiddleLeft, "names");
            Kit.LE(nv, -1, -1, 1);
            var nt = Kit.Txt(nv.transform, name, 14, color, Kit.UiBold, TextAnchor.MiddleLeft, "name");
            if (!string.IsNullOrEmpty(tag)) Kit.Txt(nv.transform, tag.ToUpperInvariant(), 8, isNew ? Kit.Gold : Kit.Dim, Kit.Px, TextAnchor.MiddleLeft, "tag");
            foreach (var l in lines) W.Para(bg.transform, l, Kit.Text, 13);
            if (hint != "") W.Small(bg.transform, hint, Kit.C(0xffc070), 12);
            return bg.rectTransform;
        }

        // ------------------------------------------------------------------ chest
        public void Chest(Run run, ChestResult data, Action done)
        {
            var panel = Open(Math.Min(ScreenW - 24, 520), I18n.T(data.tier > 0 ? "chest_boss" : "chest"), Kit.Gold);
            int id = openId;
            var chest = W.Thumb(panel.transform, "chest", 90);
            var list = Kit.VBox(panel.transform, 6, 0, TextAnchor.UpperCenter, "rewards");
            var goldRow = Kit.HBox(panel.transform, 6, 0, TextAnchor.MiddleCenter, "gold");
            W.Icon(goldRow.transform, "coin", 0xffd23d, 20);
            W.Fit(Kit.Txt(goldRow.transform, "+" + Fmt.Count(data.gold), 14, Kit.Gold, Kit.Px, TextAnchor.MiddleLeft));
            goldRow.gameObject.SetActive(false);
            var btn = Kit.Btn(panel.transform, I18n.T("btn_take"), () => { api.Sfx("ui"); done(); }, Kit.BtnStyle.Primary, 13);
            Kit.LE(btn, -1, 50);
            btn.gameObject.SetActive(false);
            int i = 0;
            void Reveal()
            {
                if (!IsOpen || id != openId) return;
                if (i >= data.rewards.Count)
                {
                    goldRow.gameObject.SetActive(true);
                    btn.gameObject.SetActive(true);
                    api.Sfx("coin");
                    return;
                }
                var r = data.rewards[i++];
                RewardRow(list.transform, r);
                api.Sfx(r.kind == "evolution" ? "evolution" : "powerup");
                Timers.After(r.kind == "evolution" ? 0.9 : 0.42, Reveal);
            }
            chest.rectTransform.localScale = Vector3.one * 0.8f;
            Timers.After(0.35, () => { if (id == openId) chest.rectTransform.localScale = Vector3.one * 1.1f; });
            Timers.After(0.9, Reveal);
        }

        void RewardRow(Transform parent, ChestReward r)
        {
            bool evo = r.kind == "evolution";
            var bg = Kit.Img(parent, Kit.RoundSprite, evo ? new Color(1, 0.69f, 0.18f, 0.18f) : Kit.Panel2, "reward");
            var h = bg.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.padding = new RectOffset(10, 10, 6, 6);
            h.spacing = 8;
            h.childAlignment = TextAnchor.MiddleLeft;
            h.childControlHeight = h.childControlWidth = true;
            h.childForceExpandWidth = h.childForceExpandHeight = false;
            VerticalLayoutGroup Body()
            {
                var v = Kit.VBox(bg.transform, 2, 0, TextAnchor.MiddleLeft, "body");
                Kit.LE(v, -1, -1, 1);
                return v;
            }
            if (evo)
            {
                var w = Content.WeaponById[r.id];
                var from = Content.WeaponById[r.from];
                W.Icon(bg.transform, from.icon, from.color, 28);
                W.Fit(Kit.Txt(bg.transform, "→", 12, Kit.Dim, Kit.Px));
                W.Icon(bg.transform, w.icon, w.color, 40);
                var v = Body();
                Kit.Txt(v.transform, I18n.T("evolution") + "!", 11, Kit.C(0xffb02e), Kit.Px);
                Kit.Txt(v.transform, I18n.L(w.name), 14, Kit.Text, Kit.UiBold);
                W.Small(v.transform, I18n.L(w.desc), Kit.Dim, 12);
            }
            else if (r.kind == "weapon_up")
            {
                var w = Content.WeaponById[r.id];
                W.Icon(bg.transform, w.icon, w.color, 32);
                var v = Body();
                Kit.Txt(v.transform, I18n.L(w.name), 14, Kit.Text, Kit.UiBold);
                W.Small(v.transform, r.level >= Content.WeaponMaxLevel ? "MAX" : I18n.T("lvl_short", "n", r.level), Kit.Gold, 12);
            }
            else if (r.kind == "passive_up")
            {
                var p = Content.PassiveById[r.id];
                W.Icon(bg.transform, p.icon, p.color, 32);
                var v = Body();
                Kit.Txt(v.transform, I18n.L(p.name), 14, Kit.Text, Kit.UiBold);
                W.Small(v.transform, I18n.T("lvl_short", "n", r.level), Kit.Gold, 12);
            }
            else
            {
                W.Icon(bg.transform, "coin", 0xffd23d, 32);
                var v = Body();
                Kit.Txt(v.transform, I18n.T("choice_gold"), 14, Kit.Text, Kit.UiBold);
            }
        }

        // ------------------------------------------------------------------ pause
        public void Pause(Run run, Action resume, Action restart, Action exit)
        {
            var panel = Open(Math.Min(ScreenW - 24, 760), I18n.T("paused"), Kit.Text,
                I18n.L(run.map.name) + " · " + I18n.L(run.diff.name) + " · " + Fmt.Time(run.time));
            var body = Kit.Rect(panel.transform, "body");
            Kit.LE(body, -1, Math.Min(ScreenH - 120, 300));
            void ShowMain()
            {
                Kit.Clear(body);
                var left = Kit.Rect(body, "left");
                left.anchorMin = Vector2.zero;
                left.anchorMax = new Vector2(0.62f, 1);
                left.offsetMin = Vector2.zero;
                left.offsetMax = new Vector2(-8, 0);
                var sc = Kit.Scroll(left, out _, 8, 0);
                Kit.Stretch((RectTransform)sc.parent);
                BuildRows(sc, run);
                var grid = Kit.Grid(sc, 210, 22, 4);
                grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
                grid.constraintCount = 2;
                foreach (var row in StatRows(run)) W.KV(grid.transform, row[0], row[1]);
                var right = Kit.VBox(body, 10, 0, TextAnchor.UpperCenter, "buttons");
                var rrt = (RectTransform)right.transform;
                rrt.anchorMin = new Vector2(0.62f, 0);
                rrt.anchorMax = Vector2.one;
                rrt.offsetMin = Vector2.zero;
                rrt.offsetMax = Vector2.zero;
                Kit.LE(Kit.Btn(right.transform, I18n.T("btn_resume"), resume, Kit.BtnStyle.Primary, 11), -1, 48);
                Kit.LE(Kit.Btn(right.transform, I18n.T("menu_settings"), () => { api.Sfx("ui"); ShowSettings(); }, Kit.BtnStyle.Normal, 10), -1, 44);
                Kit.LE(Kit.Btn(right.transform, I18n.T("btn_restart"), restart, Kit.BtnStyle.Normal, 10), -1, 44);
                Kit.LE(Kit.Btn(right.transform, I18n.T("btn_exit"), exit, Kit.BtnStyle.Danger, 10), -1, 44);
            }
            void ShowSettings()
            {
                Kit.Clear(body);
                var sc = Kit.Scroll(body, out _, 8, 4);
                var srt = (RectTransform)sc.parent;
                Kit.Stretch(srt, 0, 0, 0, 52);
                W.SettingsPanel(sc, api, ShowSettings);
                var back = Kit.Btn(body, I18n.T("btn_back"), () => { api.Sfx("uiBack"); ShowMain(); }, Kit.BtnStyle.Normal, 10);
                Kit.Place((RectTransform)back.transform, 0.5f, 0, 220, 44, 0, 0);
            }
            ShowMain();
        }

        static void BuildRows(Transform parent, Run run)
        {
            var ws = Kit.HBox(parent, 6, 0, TextAnchor.MiddleLeft, "weapons");
            for (int i = 0; i < Balance.weaponSlots; i++)
            {
                var w = i < run.weapons.list.Count ? run.weapons.list[i] : null;
                Slot(ws.transform, w == null ? null : Icons.Get(w.def.icon, w.def.color), w == null ? null : w.def.evolved ? "★" : w.isMax ? "M" : w.level.ToString(), w != null && w.def.evolved);
            }
            var ps = Kit.HBox(parent, 6, 0, TextAnchor.MiddleLeft, "passives");
            int n = 0;
            foreach (var kv in run.passives.levels)
            {
                if (n++ >= Balance.passiveSlots) break;
                var d = Content.PassiveById[kv.Key];
                Slot(ps.transform, Icons.Get(d.icon, d.color), kv.Value.ToString(), false);
            }
            for (; n < Balance.passiveSlots; n++) Slot(ps.transform, null, null, false);
        }

        static void Slot(Transform parent, Sprite icon, string badge, bool evo)
        {
            var bg = Kit.Img(parent, null, new Color(10 / 255f, 8 / 255f, 16 / 255f, icon == null ? 0.3f : 0.8f), "slot");
            Kit.LE(bg, 38, 38);
            Kit.Stroke(bg, Kit.Ink, 2);
            if (evo) Kit.Stretch(Kit.Img(bg.transform, Kit.FrameSprite, Kit.C(0xffb02e), "evo").rectTransform);
            if (icon != null) Kit.Stretch(Kit.Img(bg.transform, icon, Color.white, "icon").rectTransform, 3, 3, 3, 3);
            if (badge != null)
            {
                var b = Kit.Txt(bg.transform, badge, 8, evo ? Kit.C(0xffb02e) : Color.white, Kit.Px, TextAnchor.LowerRight, "b");
                Kit.Stretch(b.rectTransform, 0, 0, -3, -4);
                Kit.Stroke(b, Color.black, 1);
            }
        }

        static List<string[]> StatRows(Run run)
        {
            var s = run.player.stats;
            string Pct(double v) => Math.Round(v * 100) + "%";
            string T(string k) => I18n.T(k);
            return new List<string[]>
            {
                new[] { T("stat_maxHp"), Math.Round(s.maxHp).ToString() },
                new[] { T("stat_armor"), Fmt.Num(s.armor) },
                new[] { T("stat_regen"), s.regen.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture) },
                new[] { T("stat_might"), Pct(s.might) },
                new[] { T("stat_area"), Pct(s.area) },
                new[] { T("stat_cooldown"), Pct(s.cooldown) },
                new[] { T("stat_amount"), "+" + Fmt.Num(s.amount) },
                new[] { T("stat_moveSpeed"), Pct(s.moveSpeed) },
                new[] { T("stat_luck"), Pct(s.luck) },
                new[] { T("stat_growth"), Pct(s.growth) },
                new[] { T("stat_critChance"), Pct(s.critChance) },
                new[] { T("stat_magnet"), s.magnet.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture) },
            };
        }

        // ------------------------------------------------------------------ results
        public void Results(ResultData data, Action retry, Action menu)
        {
            var s = data.summary;
            var panel = Open(Math.Min(ScreenW - 24, 760), data.victory ? I18n.T("victory") : I18n.T("game_over"),
                data.victory ? Kit.Gold : Kit.Red, data.victory ? I18n.T("victory_sub") : I18n.T("defeat_sub"));
            var body = Kit.Rect(panel.transform, "body");
            Kit.LE(body, -1, Math.Min(ScreenH - 170, 260));
            var left = Kit.VBox(body, 4, 0, TextAnchor.UpperLeft, "stats");
            var lrt = (RectTransform)left.transform;
            lrt.anchorMin = Vector2.zero;
            lrt.anchorMax = new Vector2(0.45f, 1);
            lrt.offsetMin = Vector2.zero;
            lrt.offsetMax = new Vector2(-8, 0);
            W.KV(left.transform, I18n.T("r_time"), Fmt.Time(s.time));
            W.KV(left.transform, I18n.T("r_level"), s.level.ToString());
            W.KV(left.transform, I18n.T("r_kills"), Fmt.Count(s.kills));
            W.KV(left.transform, I18n.T("r_bosses"), s.bosses.Count.ToString());
            W.KV(left.transform, I18n.T("r_diff"), data.diffName);
            W.KV(left.transform, I18n.T("r_gold"), "+" + Fmt.Count(data.goldEarned), Kit.Gold, Icons.Get("coin", 0xffd23d));
            if (data.relic != null) W.Para(left.transform, I18n.T("relic_found", "name", data.relic), Kit.C(0xc77dff), 13);
            foreach (var u in data.newUnlocks) W.Para(left.transform, u, Kit.Green, 13);
            foreach (var a in data.achievements)
                W.Para(left.transform, "★ " + I18n.L(a.name) + (a.reward != null || a.gold > 0 ? " — " + W.RewardText(a) : ""), Kit.Gold, 13);
            var right = Kit.Rect(body, "dmg");
            right.anchorMin = new Vector2(0.45f, 0);
            right.anchorMax = Vector2.one;
            right.offsetMin = new Vector2(8, 0);
            right.offsetMax = Vector2.zero;
            var bg = Kit.Img(right, Kit.RoundSprite, new Color(0, 0, 0, 0.25f), "bg");
            Kit.Stretch(bg.rectTransform);
            var sc = Kit.Scroll(bg.transform, out _, 4, 8);
            Kit.Stretch((RectTransform)sc.parent);
            foreach (var w in s.weapons.OrderByDescending(x => x.damage))
            {
                if (!Content.WeaponById.TryGetValue(w.id, out var def)) continue;
                var row = Kit.HBox(sc, 8, 0, TextAnchor.MiddleLeft, "row");
                W.Icon(row.transform, def.icon, def.color, 22);
                var n = Kit.Txt(row.transform, I18n.L(def.name), 13, Kit.Text, Kit.Ui);
                Kit.LE(n, -1, 24, 1);
                var l = Kit.Txt(row.transform, def.evolved ? "★" : w.level >= Content.WeaponMaxLevel ? "MAX" : I18n.T("lvl_short", "n", w.level), 8, Kit.Gold, Kit.Px, TextAnchor.MiddleRight);
                Kit.LE(l, 50, 24, 0);
                var d = Kit.Txt(row.transform, Fmt.Count(w.damage), 10, Kit.Text, Kit.Px, TextAnchor.MiddleRight);
                Kit.LE(d, 70, 24, 0);
            }
            var btns = Kit.HBox(panel.transform, 12, 0, TextAnchor.MiddleCenter, "buttons");
            btns.childForceExpandWidth = true;
            Kit.LE(Kit.Btn(btns.transform, I18n.T("btn_menu"), () => { api.Sfx("ui"); menu(); }, Kit.BtnStyle.Normal, 11), -1, 48, 1);
            Kit.LE(Kit.Btn(btns.transform, I18n.T("btn_retry"), () => { api.Sfx("ui"); retry(); }, Kit.BtnStyle.Primary, 11), -1, 48, 1);
        }
    }
}
