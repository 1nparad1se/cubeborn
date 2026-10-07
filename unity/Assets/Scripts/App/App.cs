using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Cubeborn.Controls;
using Cubeborn.Sound;
using Cubeborn.UI;
using Cubeborn.View;

namespace Cubeborn
{
    /// <summary>Creates the app object once the (empty) scene has loaded.</summary>
    public static class Boot
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Start()
        {
            if (UnityEngine.Object.FindAnyObjectByType<App>() != null) return;
            var go = new GameObject("Cubeborn");
            UnityEngine.Object.DontDestroyOnLoad(go);
            go.AddComponent<App>();
        }
    }

    /// <summary>Forwards IFx calls to a target that can be swapped once the view exists.</summary>
    class ProxyFx : IFx
    {
        public IFx target = NullFx.I;
        public void Burst(double x, double y, double z, int color, int count, double speed, double size, double life, ParticleKind kind = ParticleKind.Glow) => target.Burst(x, y, z, color, count, speed, size, life, kind);
        public void Number(double x, double z, double value, bool crit, int color = -1) => target.Number(x, z, value, crit, color);
        public void Text(double x, double z, string text, int color) => target.Text(x, z, text, color);
        public void Shake(double amount) => target.Shake(amount);
        public void Light(double x, double z, int color, double intensity, double radius, double duration) => target.Light(x, z, color, intensity, radius, duration);
        public void Sound(string id, double volume = 1) => target.Sound(id, volume);
        public void Vibrate(int ms) => target.Vibrate(ms);
    }

    /// <summary>Top-level controller (App.ts): screens, the game loop and meta progression.</summary>
    public class App : MonoBehaviour, IMenuApi, IFxHooks
    {
        public const string VERSION = "v1.0.0";

        enum Mode { Splash, Menu, Run, Results }

        Profile prof;
        public Profile profile => prof;
        public string version => VERSION;
        public RectTransform ModalLayer => modalLayer;

        Canvas canvas;
        RectTransform canvasRt, safeRoot, modalLayer, toasts, splashRt;
        GameView view;
        GameInput input;
        Hud hud;
        Menus menus;
        RunModals modals;
        Run run;
        string[] runArgs = { "bram", "blightwood", "normal" };
        bool paused, finished;
        Mode mode = Mode.Splash;
        int lastW, lastH;
        Rect lastSafe;
        double saveAt = -1;
        float lastVibrate;

        // scripted screenshot mode for CI (-cbshots <dir>)
        string shotsDir;
        bool bot;

        void Awake()
        {
            Application.targetFrameRate = 60;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
            Input.multiTouchEnabled = true;
            shotsDir = Arg("-cbshots");
            if (shotsDir != null)
            {
                Directory.CreateDirectory(shotsDir);
                Application.logMessageReceived += (msg, stack, type) =>
                {
                    if (type == LogType.Error || type == LogType.Exception || type == LogType.Assert)
                        File.AppendAllText(Path.Combine(shotsDir, "errors.txt"), type + ": " + msg + "\n" + stack + "\n");
                };
            }

            Content.Loader = name => Resources.Load<TextAsset>("Data/" + name).text;
            Content.Load();
            I18n.Load(Resources.Load<TextAsset>("Data/i18n").text);

            SaveIO.Get = k => PlayerPrefs.HasKey(k) ? PlayerPrefs.GetString(k) : null;
            SaveIO.Set = (k, v) =>
            {
                if (shotsDir != null) return;
                PlayerPrefs.SetString(k, v);
                PlayerPrefs.Save();
            };
            SaveIO.Delete = k =>
            {
                PlayerPrefs.DeleteKey(k);
                PlayerPrefs.Save();
            };
            SaveIO.SystemLang = Application.systemLanguage == SystemLanguage.Russian || Application.systemLanguage == SystemLanguage.Ukrainian || Application.systemLanguage == SystemLanguage.Belarusian ? "ru" : "en";
            SaveIO.Mobile = Application.isMobilePlatform;
            prof = new Profile();
            var s = prof.data.settings;
            I18n.SetLang(s.lang);

            Kit.Init();
            BuildCanvas();
            view = new GameView(s.quality);
            view.overlay = new Overlay(overlayRoot);
            input = new GameInput(inputRoot);
            input.onPause = TogglePause;
            input.onBack = HandleBack;
            hud = new Hud(safeRoot);
            hud.onPause = TogglePause;
            hud.SetVisible(false);
            menus = new Menus(safeRoot, this);
            menus.SetVisible(false);
            modals = new RunModals(safeRoot, this);
            toasts = Kit.Rect(safeRoot, "toasts");
            Kit.Place(toasts, 0.5f, 1, 600, 10, 0, -84, 0.5f, 1);
            var tl = toasts.gameObject.AddComponent<VerticalLayoutGroup>();
            tl.childAlignment = TextAnchor.UpperCenter;
            tl.spacing = 6;
            tl.childControlWidth = tl.childControlHeight = true;
            tl.childForceExpandWidth = tl.childForceExpandHeight = false;
            modalLayer = Kit.Stretch(Kit.Rect(safeRoot, "modalLayer"));

            Synth.Create();
            ApplySettings();
            ShowMenuBackdrop();
            Splash();
            lastW = Screen.width;
            lastH = Screen.height;
            ApplySafeArea();
            if (shotsDir != null) StartCoroutine(Shots());
        }

        static string Arg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++)
                if (args[i] == name) return args[i + 1];
            return null;
        }

        RectTransform overlayRoot, inputRoot;

        void BuildCanvas()
        {
            var go = new GameObject("Canvas");
            go.layer = 5;
            DontDestroyOnLoad(go);
            canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.pixelPerfect = false;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(900, 420);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;
            go.AddComponent<GraphicRaycaster>();
            canvasRt = (RectTransform)go.transform;

            var es = new GameObject("EventSystem");
            DontDestroyOnLoad(es);
            es.AddComponent<EventSystem>();
            es.AddComponent<StandaloneInputModule>();

            overlayRoot = Kit.Stretch(Kit.Rect(canvasRt, "overlay"));
            inputRoot = Kit.Stretch(Kit.Rect(canvasRt, "stick"));
            safeRoot = Kit.Rect(canvasRt, "safe");
        }

        void ApplySafeArea()
        {
            var sa = Screen.safeArea;
            lastSafe = sa;
            float w = Mathf.Max(1, Screen.width), h = Mathf.Max(1, Screen.height);
            safeRoot.anchorMin = new Vector2(sa.xMin / w, sa.yMin / h);
            safeRoot.anchorMax = new Vector2(sa.xMax / w, sa.yMax / h);
            safeRoot.offsetMin = safeRoot.offsetMax = Vector2.zero;
        }

        // ------------------------------------------------------------------ IMenuApi

        public void Sfx(string id) => Synth.I?.Play(id);

        public void SetShowcase(string modelId) => view.SetShowcase(modelId);

        public void ApplySettings()
        {
            var s = prof.data.settings;
            Synth.I?.SetVolumes(s.sfx, s.music);
            if (s.quality != view.CurrentQuality)
            {
                view.ApplyQuality(s.quality);
                if (mode == Mode.Menu) ShowMenuBackdrop();
            }
            view.SetSettings(s.damageNumbers, s.screenShake);
            hud.SetFpsVisible(s.showFps);
            if (run != null) run.settings.damageNumbers = s.damageNumbers;
        }

        public void SaveSoon()
        {
            if (saveAt < 0) saveAt = Time.unscaledTimeAsDouble + 0.4;
        }

        public void ResetProgress()
        {
            prof.Reset();
            I18n.SetLang(prof.data.settings.lang);
            menus.Home();
        }

        // ------------------------------------------------------------------ IFxHooks

        public void Sound(string id, double volume) => Synth.I?.Play(id, volume);

        public void Vibrate(int ms)
        {
            if (!prof.data.settings.vibration) return;
            if (Time.unscaledTime - lastVibrate < 0.15f) return;
            lastVibrate = Time.unscaledTime;
#if UNITY_ANDROID || UNITY_IOS
            Handheld.Vibrate();
#endif
        }

        // ------------------------------------------------------------------ screens

        void Splash()
        {
            mode = Mode.Splash;
            var bg = Kit.Img(canvasRt, null, Kit.C(0x0b0910, 0.86f), "splash");
            splashRt = Kit.Stretch(bg.rectTransform);
            bg.raycastTarget = true;
            var col = Kit.VBox(splashRt, 10, 0, TextAnchor.MiddleCenter, "logo");
            Kit.Place((RectTransform)col.transform, 0.5f, 0.56f, 700, 220);
            col.childControlWidth = col.childControlHeight = true;
            col.childForceExpandWidth = col.childForceExpandHeight = false;
            var cubes = Kit.HBox(col.transform, 8, 0, TextAnchor.MiddleCenter, "cubes");
            foreach (var c in new[] { 0x5ad66a, 0xffd23d, 0xff4a5a })
            {
                var cube = Kit.Box(cubes.transform, Kit.C(c));
                Kit.LE(cube, 22, 22);
                Kit.Drop(cube, new Color(0, 0, 0, 0.5f), 0, -3);
            }
            var title = Kit.Txt(col.transform, "CUBEBORN", 46, Kit.Gold, Kit.Px, TextAnchor.MiddleCenter, "title");
            Kit.Stroke(title, Kit.Ink, 3);
            Kit.Drop(title, new Color(0.6f, 0.2f, 0, 0.9f), 0, -5);
            Kit.LE(title, 700, 62);
            var sub = Kit.Txt(col.transform, I18n.T("game_subtitle"), 15, Kit.Text, Kit.UiBold, TextAnchor.MiddleCenter, "sub");
            Kit.LE(sub, 700, 24);
            var tap = Kit.Txt(splashRt, I18n.T("tap_to_start"), 13, Kit.Text, Kit.Px, TextAnchor.MiddleCenter, "tap");
            Kit.Place(tap.rectTransform, 0.5f, 0.22f, 600, 30);
            Kit.Stroke(tap, Kit.Ink, 2);
            tapText = tap;
            var foot = Kit.Txt(splashRt, I18n.T("splash_note"), 11, Kit.Dim, Kit.Ui, TextAnchor.MiddleCenter, "foot");
            Kit.Place(foot.rectTransform, 0.5f, 0.06f, 800, 24);
            var trig = bg.gameObject.AddComponent<EventTrigger>();
            var e = new EventTrigger.Entry { eventID = EventTriggerType.PointerClick };
            e.callback.AddListener(_ => SplashGo());
            trig.triggers.Add(e);
        }

        Text tapText;

        void SplashGo()
        {
            if (mode != Mode.Splash || splashRt == null) return;
            Synth.I?.Play("select");
            StartCoroutine(FadeOut(splashRt, 0.4f));
            splashRt = null;
            tapText = null;
            ToMenu();
        }

        IEnumerator FadeOut(RectTransform rt, float dur)
        {
            var cg = rt.gameObject.AddComponent<CanvasGroup>();
            cg.blocksRaycasts = false;
            float t = 0;
            while (t < dur)
            {
                t += Time.unscaledDeltaTime;
                cg.alpha = 1 - t / dur;
                yield return null;
            }
            Destroy(rt.gameObject);
        }

        void ShowMenuBackdrop()
        {
            var p = prof.data;
            var map = Content.MapById.TryGetValue(p.lastMap, out var m) && prof.IsMapUnlocked(p.lastMap) ? m : Content.Maps[0];
            var terrain = Generators.GenerateTerrain(map, 4242);
            var hero = Content.HeroById.TryGetValue(p.lastHero, out var h) ? h.model : "bram";
            view.ShowMenu(map, terrain, hero);
        }

        void ToMenu()
        {
            mode = Mode.Menu;
            input.SetEnabled(false);
            hud.SetVisible(false);
            modals.Close();
            menus.SetVisible(true);
            menus.Home();
            Synth.I?.PlayMusic("menu");
        }

        // ------------------------------------------------------------------ run lifecycle

        public void StartRun(string heroId, string mapId, string diffId)
        {
            runArgs = new[] { heroId, mapId, diffId };
            menus.SetVisible(false);
            modals.Close();
            Kit.Clear(modalLayer);
            view.EndRun();
            var p = prof;
            p.data.lastHero = heroId;
            p.data.lastMap = mapId;
            p.data.lastDiff = diffId;
            var fx = new ProxyFx();
            var uw = new HashSet<string>();
            foreach (var w in Content.Weapons) if (p.IsWeaponUnlocked(w.id)) uw.Add(w.id);
            var up = new HashSet<string>();
            foreach (var x in Content.Passives) if (p.IsPassiveUnlocked(x.id)) up.Add(x.id);
            var s = p.data.settings;
            var r = new Run(new RunOptions
            {
                map = Content.MapById[mapId],
                diff = Content.DifficultyById[diffId],
                hero = Content.HeroById[heroId],
                permanent = p.PermanentMods(),
                unlockedWeapons = uw,
                unlockedPassives = up,
                fx = fx,
                settings = new RunSettings { damageNumbers = s.damageNumbers },
                tr = k => I18n.T(k),
                seed = bot ? 12345 : -1,
            });
            if (bot) r.debugGod = true;
            fx.target = view.StartRun(r, this, s.damageNumbers, s.screenShake);
            run = r;
            finished = false;
            paused = false;
            hud.Reset();
            hud.SetVisible(true);
            input.SetEnabled(true);
            mode = Mode.Run;
            BindRunEvents(r);
            Synth.I?.PlayMusic(r.map.generator);
            hud.ShowBanner(I18n.L(r.map.name), Color.white, 2.2);
            if (!p.data.seenIntro)
            {
                hud.ShowHint(true, Input.touchSupported);
                input.onFirstMove = () =>
                {
                    Timers.After(1.2, () => hud.ShowHint(false, false));
                    p.data.seenIntro = true;
                    p.Save();
                };
            }
            else hud.ShowHint(false, false);
        }

        void BindRunEvents(Run r)
        {
            r.OnLevelup += choices =>
            {
                input.SetEnabled(false);
                if (bot)
                {
                    BotLevelUp(r, choices);
                    return;
                }
                modals.LevelUp(r, choices, () =>
                {
                    if (r.state == RunState.Levelup) return;
                    modals.Close();
                    input.SetEnabled(true);
                });
            };
            r.OnChest += data =>
            {
                input.SetEnabled(false);
                modals.Chest(r, data, () =>
                {
                    r.CloseChest();
                    modals.Close();
                    input.SetEnabled(true);
                });
                if (bot) Timers.After(1.5, () =>
                {
                    if (r.state != RunState.Chest) return;
                    r.CloseChest();
                    modals.Close();
                    input.SetEnabled(true);
                });
            };
            r.OnBossSpawn += b =>
            {
                if (b.isClone) return;
                hud.SetBoss(b);
                hud.ShowBanner(I18n.T("boss_appears", "name", I18n.L(b.def.name)), Kit.C(0xff4a5a), 3);
                if (b.isFinal) Synth.I?.PlayMusic("boss");
            };
            r.OnBossPhase += b =>
            {
                if (!b.isClone) hud.ShowBanner(I18n.T("boss_rage", "name", I18n.L(b.def.name)), Kit.C(0xff7a3a), 2);
            };
            r.OnBossDefeated += b =>
            {
                if (b.isClone) return;
                hud.ShowBanner(I18n.T("boss_defeated", "name", I18n.L(b.def.name)), Kit.C(0xffd23d), 3);
                if (!b.isFinal) Synth.I?.PlayMusic(r.map.generator);
            };
            r.OnBanner += key => hud.ShowBanner(I18n.T(key), key == "ev_treasure" ? Kit.C(0xffd23d) : Kit.C(0xff8a5a));
            r.OnEvolution += id =>
            {
                if (Content.WeaponById.TryGetValue(id, out var w)) Toast(I18n.T("evolved", "name", I18n.L(w.name)), Kit.C(0xffb02e));
            };
            r.OnGameover += () => FinishRun(false);
            r.OnVictory += () => FinishRun(true);
        }

        /// <summary>Back button (Android) / Escape outside of active play.</summary>
        bool HandleBack()
        {
            for (int i = modalLayer.childCount - 1; i >= 0; i--)
            {
                var c = modalLayer.GetChild(i);
                if (c.name == "confirm")
                {
                    Destroy(c.gameObject);
                    return true;
                }
            }
            if (mode == Mode.Splash)
            {
                SplashGo();
                return true;
            }
            if (mode == Mode.Run)
            {
                if (paused) TogglePause();
                else if (run != null && run.state == RunState.Playing && !run.ending) TogglePause();
                return true;
            }
            if (mode == Mode.Menu)
            {
                if (menus.CanGoBack)
                {
                    menus.Back();
                    return true;
                }
#if UNITY_ANDROID && !UNITY_EDITOR
                Application.Quit();
#endif
                return false;
            }
            return true;
        }

        void TogglePause()
        {
            var r = run;
            if (mode != Mode.Run || r == null || finished) return;
            if (paused)
            {
                paused = false;
                modals.Close();
                input.SetEnabled(true);
                Synth.I?.Play("ui");
                return;
            }
            if (r.state != RunState.Playing || r.ending) return;
            paused = true;
            input.SetEnabled(false);
            Synth.I?.Play("ui");
            modals.Pause(r,
                () => TogglePause(),
                () =>
                {
                    paused = false;
                    FinishRun(false, true);
                    StartRun(runArgs[0], runArgs[1], runArgs[2]);
                },
                () =>
                {
                    paused = false;
                    FinishRun(false);
                });
        }

        /// <summary>Applies rewards and stats to the profile and shows the results screen.</summary>
        void FinishRun(bool victory, bool silent = false)
        {
            var r = run;
            if (r == null || finished) return;
            finished = true;
            input.SetEnabled(false);
            var p = prof;
            var s = r.Summary();
            var diff = r.diff;
            double goldEarned = Run.GoldReward(s, diff.reward);
            p.data.gold += goldEarned;
            p.AddStat("gold", goldEarned);
            p.AddStat("kills", s.kills);
            p.AddStat("runs", 1);
            p.AddStat("elites", s.elites);
            p.AddStat("chests", s.chests);
            p.AddStat("treasureSprites", s.treasureSprites);
            p.AddStat("bossKills", s.bosses.Count);
            p.MaxStat("bestRunKills", s.kills);
            p.MaxStat("bestLevel", s.level);
            p.MaxStat("bestTime", s.time);
            p.MaxStat("bestRunEvos", s.evolutions.Count);
            p.MaxStat("bestWeaponCount", s.weaponCount);
            p.MaxStat("maxedWeapons", s.maxedWeapons);
            foreach (var kv in r.stats.killsBy) p.AddStat("kill_" + kv.Key, kv.Value);
            string relic = null;
            foreach (var id in s.bosses)
            {
                p.AddStat("boss_" + id, 1);
                if (Content.BossById.TryGetValue(id, out var def) && def.relic != null && Content.RelicById.TryGetValue(def.relic, out var rel) && p.Discover("relics", def.relic))
                    relic = I18n.L(rel.name);
            }
            foreach (var id in s.discovered)
            {
                if (Content.WeaponById.ContainsKey(id)) p.Discover("weapons", id);
                else if (Content.PassiveById.ContainsKey(id)) p.Discover("passives", id);
            }
            foreach (var id in s.seen)
            {
                if (Content.BossById.ContainsKey(id)) p.Discover("bosses", id);
                else p.Discover("enemies", id);
            }
            int di = Content.Difficulties.FindIndex(d => d.id == diff.id);
            if (victory)
            {
                p.AddStat("herowin_" + r.hero.id, 1);
                p.AddStat("diffwin_" + diff.id, 1);
                int prev = p.data.mapClears.TryGetValue(r.map.id, out var c) ? c : -1;
                p.data.mapClears[r.map.id] = Math.Max(prev, di);
            }
            var achievements = p.CheckAchievements();
            p.data.seenIntro = true;
            p.Save();
            if (silent) return;
            mode = Mode.Results;
            Synth.I?.PlayMusic(victory ? "victory" : "menu");
            var newUnlocks = new List<string>();
            if (victory && r.map.id != Content.Maps[Content.Maps.Count - 1].id)
            {
                int clears = p.data.mapClears.TryGetValue(r.map.id, out var c2) ? c2 : -1;
                if (di < 3 && clears == di) newUnlocks.Add(I18n.T("diff_unlocked", "name", I18n.L(Content.Difficulties[di + 1].name)));
            }
            var data = new ResultData { victory = victory, summary = s, goldEarned = goldEarned, diffName = I18n.L(diff.name), achievements = achievements, relic = relic, newUnlocks = newUnlocks };
            Timers.After(0.2, () => modals.Results(data, () => StartRun(runArgs[0], runArgs[1], runArgs[2]), ExitToMenu));
        }

        void ExitToMenu()
        {
            view.EndRun();
            run = null;
            ShowMenuBackdrop();
            ToMenu();
        }

        void Toast(string text, Color color)
        {
            var t = Kit.Txt(toasts, text, 13, color, Kit.Px, TextAnchor.MiddleCenter, "toast");
            Kit.Stroke(t, Kit.Ink, 2);
            Kit.LE(t, 600, 22);
            var rt = t.rectTransform;
            Timers.After(2.6, () =>
            {
                if (rt != null) StartCoroutine(FadeOut(rt, 0.5f));
            });
        }

        // ------------------------------------------------------------------ loop

        void Update()
        {
            Timers.Tick();
            if (Screen.width != lastW || Screen.height != lastH || Screen.safeArea != lastSafe)
            {
                lastW = Screen.width;
                lastH = Screen.height;
                view.Resize();
                ApplySafeArea();
            }
            if (saveAt >= 0 && Time.unscaledTimeAsDouble >= saveAt)
            {
                saveAt = -1;
                prof.Save();
            }
            if (mode == Mode.Splash && (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.Space))) SplashGo();
            if (tapText != null) tapText.color = new Color(1, 1, 1, 0.55f + 0.45f * Mathf.Sin(Time.unscaledTime * 4));

            double realDt = Math.Min(0.1, Math.Max(0, Time.unscaledDeltaTime));
            double dt = Math.Min(realDt, 1.0 / 20);
            input.Update();
            var r = run;
            if (r != null && mode != Mode.Menu)
            {
                double ix = input.x, iz = input.z;
                if (bot && input.enabled) BotSteer(r, out ix, out iz);
                bool active = !paused && !modals.IsOpen && r.state == RunState.Playing;
                if (active || r.ending)
                {
                    // fixed-ish sub-steps keep collisions stable on slow frames
                    int steps = dt > 1.0 / 40 ? 2 : 1;
                    for (int i = 0; i < steps; i++)
                    {
                        r.Update(dt / steps, ix, iz);
                        if (run != r) break;
                    }
                }
                double visDt = active || r.ending ? dt * (r.ending ? r.timeScale : 1) : 0;
                view.Frame(visDt);
                hud.Update(r, visDt, realDt);
                var a = Synth.I;
                if (a != null)
                {
                    if (r.hitSoundBudget > 0) a.Play("hit", Math.Min(1, 0.3 + r.hitSoundBudget * 0.05));
                    if (r.killSoundBudget > 0) a.Play("kill", Math.Min(1, 0.4 + r.killSoundBudget * 0.1));
                    if (r.xpSoundBudget > 0) a.Play("xp", 0.6);
                    a.SetIntensity(Math.Min(1, r.enemies.aliveCount / 250.0));
                }
                r.hitSoundBudget = r.killSoundBudget = r.xpSoundBudget = 0;
            }
            else view.Frame(realDt);
        }

        void OnApplicationPause(bool pause)
        {
            if (pause)
            {
                if (mode == Mode.Run && !paused && run != null && run.state == RunState.Playing) TogglePause();
                input?.ReleaseAll();
                if (saveAt >= 0)
                {
                    saveAt = -1;
                    prof.Save();
                }
                Synth.I?.Suspend(true);
            }
            else Synth.I?.Suspend(false);
        }

        void OnApplicationQuit()
        {
            if (saveAt >= 0) prof.Save();
        }

        // ------------------------------------------------------------------ CI screenshots

        double botAngle;

        void BotSteer(Run r, out double ix, out double iz)
        {
            botAngle += Time.unscaledDeltaTime * 0.35;
            ix = Math.Cos(botAngle);
            iz = Math.Sin(botAngle * 1.3);
        }

        int botLevelups;

        void BotLevelUp(Run r, List<Choice> choices)
        {
            botLevelups++;
            if (botLevelups == 1)
            {
                modals.LevelUp(r, choices, () =>
                {
                    if (r.state == RunState.Levelup) return;
                    modals.Close();
                    input.SetEnabled(true);
                });
                Timers.After(0.8, () => Shot("04_levelup"));
                Timers.After(1.4, () => BotPick(r));
            }
            else BotPick(r);
        }

        void BotPick(Run r)
        {
            if (r.state != RunState.Levelup || r.pendingChoices == null) return;
            var choices = r.pendingChoices;
            r.Choose(choices.Count > 0 ? choices[0] : null);
            if (r.state == RunState.Levelup) return; // another level queued: handler re-entered
            modals.Close();
            input.SetEnabled(true);
        }

        void Shot(string name)
        {
            var path = Path.Combine(shotsDir, name + ".png");
            ScreenCapture.CaptureScreenshot(path);
            var info = $"{name}: {Screen.width}x{Screen.height} fps~{(1f / Mathf.Max(0.0001f, Time.smoothDeltaTime)):0}";
            if (run != null) info += $" t={run.time:0.0} alive={run.enemies.aliveCount} lvl={run.player.level} hp={run.player.hp:0}";
            Debug.Log("[cbshots] " + info);
            File.AppendAllText(Path.Combine(shotsDir, "log.txt"), info + "\n");
        }

        IEnumerator Shots()
        {
            yield return new WaitForSecondsRealtime(2f);
            Shot("01_splash");
            yield return new WaitForSecondsRealtime(0.5f);
            SplashGo();
            yield return new WaitForSecondsRealtime(2.5f);
            Shot("02_menu");
            yield return new WaitForSecondsRealtime(0.5f);
            bot = true;
            prof.data.seenIntro = true;
            StartRun(prof.data.lastHero, prof.data.lastMap, "normal");
            yield return new WaitForSecondsRealtime(3f);
            Shot("03_run_start");
            yield return WaitRunTime(30);
            Shot("05_run_30s");
            yield return WaitRunTime(75);
            Shot("06_run_75s");
            TogglePause();
            yield return new WaitForSecondsRealtime(1f);
            Shot("07_pause");
            TogglePause();
            run.debugGod = false;
            FinishRun(false);
            yield return new WaitForSecondsRealtime(1.5f);
            Shot("08_results");
            yield return new WaitForSecondsRealtime(1f);
            ExitToMenu();
            menus.SetVisible(false);
            yield return new WaitForSecondsRealtime(1.5f);
            Shot("09_backdrop");
            yield return new WaitForSecondsRealtime(1f);
            Application.Quit(0);
        }

        IEnumerator WaitRunTime(double t)
        {
            float guard = Time.realtimeSinceStartup + 120;
            while (run != null && run.time < t && Time.realtimeSinceStartup < guard) yield return null;
        }
    }
}
