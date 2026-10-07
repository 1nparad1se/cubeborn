using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Cubeborn.View
{
    /// <summary>Hooks the renderer's FX sink needs from the app (sound, vibration).</summary>
    public interface IFxHooks
    {
        void Sound(string id, double volume);
        void Vibrate(int ms);
    }

    /// <summary>Owns the camera, lights and atmosphere; draws either the in-run world or the menu diorama.</summary>
    public class GameView
    {
        static readonly Dictionary<string, KeyValuePair<string, int>> Ambient = new Dictionary<string, KeyValuePair<string, int>>
        {
            { "forest", new KeyValuePair<string, int>("spores", 0xc58aff) },
            { "city", new KeyValuePair<string, int>("fireflies", 0xffd37a) },
            { "catacombs", new KeyValuePair<string, int>("dust", 0x9affd8) },
            { "volcano", new KeyValuePair<string, int>("embers", 0xff8a2a) },
            { "tundra", new KeyValuePair<string, int>("snow", 0xffffff) },
            { "ruins", new KeyValuePair<string, int>("motes", 0x8ad8ff) },
        };

        public readonly CameraRig rig;
        public readonly Camera camera;
        readonly Light sun;
        LightPool lights;
        WorldView world;
        EntityView entities;
        ParticleView particles;
        Run run;
        string quality = "medium";
        double time;
        Terrain torchTerrain;
        Articulated showModel;
        string showId = "";
        bool menuMode;
        double menuAngle;
        public Overlay overlay;

        // atmosphere (for restore after thumbnails)
        static Vector4 hemiSky, hemiGround, sunCol, sunDir, fogCol;
        static float fogNear, fogFar, fogOn;
        MapPalette pal;

        public GameView(string quality)
        {
            Gfx.Init();
            var camGo = new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            camera = camGo.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = Color.black;
            camera.cullingMask = ~(1 << Gfx.ThumbLayer) & ~(1 << 5);
            camera.allowHDR = false;
            camera.depth = 0;
            camGo.AddComponent<AudioListener>();
            rig = new CameraRig(camera);
            var sunGo = new GameObject("Sun");
            sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = Color.white;
            sun.intensity = 1;
            sun.shadowStrength = 1;
            sun.shadowBias = 0.03f;
            sun.shadowNormalBias = 0.3f;
            sun.renderMode = LightRenderMode.ForcePixel;
            Thumbs.Sun = sun;
            this.quality = quality;
            lights = new LightPool(LightCount());
            ApplyQuality(quality, true);
            Resize();
        }

        int LightCount() => quality == "low" ? 2 : quality == "medium" ? 4 : 6;

        public string CurrentQuality => quality;

        public void ApplyQuality(string q, bool force = false)
        {
            bool changed = q != quality;
            quality = q;
            bool shadows = q != "low";
            sun.shadows = shadows ? LightShadows.Hard : LightShadows.None;
            QualitySettings.shadows = shadows ? ShadowQuality.HardOnly : ShadowQuality.Disable;
            QualitySettings.shadowResolution = q == "high" ? ShadowResolution.VeryHigh : ShadowResolution.High;
            QualitySettings.shadowCascades = 1;
            QualitySettings.shadowDistance = 45;
            QualitySettings.shadowProjection = ShadowProjection.StableFit;
            QualitySettings.antiAliasing = q == "low" ? 0 : q == "medium" ? 2 : 4;
            QualitySettings.pixelLightCount = 1;
            QualitySettings.vSyncCount = 0;
            camera.allowMSAA = q != "low";
            ApplyResolution(q);
            if (changed || force) lights = new LightPool(LightCount());
            if (changed && run != null)
            {
                // rebuild per-quality geometry (block shadows, particle budget)
                var r = run;
                EndRunInternal(false);
                StartRunInternal(r);
            }
        }

        static int nativeW, nativeH;

        /// <summary>Phones render below native resolution (the web build lowers the pixel ratio).</summary>
        static void ApplyResolution(string q)
        {
            if (!Application.isMobilePlatform) return;
            if (nativeW == 0)
            {
                nativeW = Math.Max(Screen.width, Screen.height);
                nativeH = Math.Min(Screen.width, Screen.height);
            }
            int target = q == "low" ? 540 : q == "medium" ? 800 : 1080;
            float k = Math.Min(1f, target / (float)Math.Max(1, nativeH));
            int w = Mathf.RoundToInt(nativeW * k), h = Mathf.RoundToInt(nativeH * k);
            if (Screen.width < Screen.height) { var t = w; w = h; h = t; }
            Screen.SetResolution(w, h, FullScreenMode.FullScreenWindow);
        }

        public void Resize()
        {
            rig.Resize(Screen.width, Screen.height);
        }

        // ------------------------------------------------------------ atmosphere

        void SetAtmosphere(MapDef map)
        {
            pal = map.palette;
            camera.backgroundColor = Gfx.Raw(pal.sky);
            hemiSky = Gfx.Lin(pal.ambient, pal.ambientIntensity * 2.2);
            hemiGround = Gfx.Lin(pal.hemiGround, pal.ambientIntensity * 2.2);
            sunCol = Gfx.Lin(pal.sun, pal.sunIntensity * 1.6);
            fogCol = Gfx.Raw(pal.fog);
            fogNear = (float)(pal.fogNear + 8);
            fogFar = (float)(pal.fogFar + 12);
            fogOn = 1;
            RestoreAtmosphere();
        }

        public static void RestoreAtmosphere()
        {
            Shader.SetGlobalVector("_CB_HemiSky", hemiSky);
            Shader.SetGlobalVector("_CB_HemiGround", hemiGround);
            Shader.SetGlobalVector("_CB_SunCol", sunCol);
            Shader.SetGlobalVector("_CB_SunDir", sunDir);
            Shader.SetGlobalVector("_CB_FogCol", fogCol);
            Shader.SetGlobalFloat("_CB_FogNear", fogNear);
            Shader.SetGlobalFloat("_CB_FogFar", fogFar);
            Shader.SetGlobalFloat("_CB_FogOn", fogOn);
        }

        /// <summary>Points the sun from a game-space position towards a target (three.js DirectionalLight).</summary>
        void SunFrom(double px, double py, double pz, double tx, double ty, double tz)
        {
            var dir = (Gfx.U(px, py, pz) - Gfx.U(tx, ty, tz)).normalized;
            sunDir = dir;
            Shader.SetGlobalVector("_CB_SunDir", dir);
            sun.transform.rotation = Quaternion.LookRotation(-dir, Vector3.up);
        }

        void BuildWorld(Terrain terrain, MapDef map)
        {
            DisposeWorld();
            SetAtmosphere(map);
            world = new WorldView(terrain, map, quality);
            torchTerrain = terrain;
        }

        void DisposeWorld()
        {
            world?.Destroy();
            world = null;
            torchTerrain = null;
        }

        // ------------------------------------------------------------ runs

        IFxHooks hooks;
        Fx fx;

        /// <summary>Starts drawing a run; returns the FX sink the game logic should use.</summary>
        public IFx StartRun(Run run, IFxHooks hooks, bool damageNumbers, bool screenShake)
        {
            this.hooks = hooks;
            StartRunInternal(run);
            overlay.showNumbers = damageNumbers;
            overlay.Clear();
            rig.shakeEnabled = screenShake;
            rig.Snap(run.player.x, run.player.z);
            fx = new Fx(this);
            return fx;
        }

        void StartRunInternal(Run r)
        {
            menuMode = false;
            ClearShowcase();
            run = r;
            BuildWorld(r.terrain, r.map);
            entities = new EntityView(r, quality, lights);
            var amb = Ambient.TryGetValue(r.map.generator, out var a) ? a : new KeyValuePair<string, int>("motes", 0xffffff);
            particles = new ParticleView(quality, amb.Key, amb.Value);
        }

        public void SetSettings(bool damageNumbers, bool screenShake)
        {
            overlay.showNumbers = damageNumbers;
            rig.shakeEnabled = screenShake;
        }

        /// <summary>FX sink handed to the game logic.</summary>
        class Fx : IFx
        {
            readonly GameView v;
            public Fx(GameView v) { this.v = v; }

            public void Burst(double x, double y, double z, int color, int count, double speed, double size, double life, ParticleKind kind = ParticleKind.Glow)
            {
                double mul = v.quality == "low" ? 0.5 : v.quality == "medium" ? 0.8 : 1;
                v.particles?.Burst(x, y, z, color, Math.Max(1, MathX.RoundI(count * mul)), speed, size, life, kind);
            }
            public void Number(double x, double z, double value, bool crit, int color = -1) => v.overlay.Number(x, z, value, crit, color);
            public void Text(double x, double z, string text, int color) => v.overlay.Text(x, z, text, color);
            public void Shake(double amount) => v.rig.AddShake(amount);
            public void Light(double x, double z, int color, double intensity, double radius, double duration) => v.lights.AddFlash(x, z, color, intensity, radius, duration);
            public void Sound(string id, double volume = 1) => v.hooks?.Sound(id, volume);
            public void Vibrate(int ms) => v.hooks?.Vibrate(ms);
        }

        public void EndRun() => EndRunInternal(true);

        void EndRunInternal(bool clearOverlay)
        {
            entities?.Destroy();
            entities = null;
            particles?.Destroy();
            particles = null;
            DisposeWorld();
            run = null;
            lights.Clear();
            if (clearOverlay) overlay?.Clear();
        }

        // ------------------------------------------------------------ menu diorama

        /// <summary>Menu background: a slice of a map with a hero slowly circled by the camera.</summary>
        public void ShowMenu(MapDef map, Terrain terrain, string heroModel)
        {
            EndRun();
            menuMode = true;
            BuildWorld(terrain, map);
            fogNear = 14;
            fogFar = 44;
            Shader.SetGlobalFloat("_CB_FogNear", fogNear);
            Shader.SetGlobalFloat("_CB_FogFar", fogFar);
            SetShowcase(heroModel);
        }

        public void SetShowcase(string modelId)
        {
            if (showId == modelId && showModel != null) return;
            ClearShowcase();
            var m = Content.GetModel(modelId);
            if (m == null) return;
            showModel = new Articulated(m, true);
            showId = modelId;
        }

        void ClearShowcase()
        {
            if (showModel == null) return;
            showModel.Destroy();
            showModel = null;
            showId = "";
        }

        // ------------------------------------------------------------ frame

        public void Frame(double dt)
        {
            time += dt;
            lights.Begin();
            if (menuMode) MenuFrame(dt);
            else if (run != null) RunFrame(dt);
            double tx = rig.targetX, tz = rig.targetZ;
            if (torchTerrain != null)
            {
                foreach (var l in torchTerrain.lights)
                {
                    if ((l.x - tx) * (l.x - tx) + (l.z - tz) * (l.z - tz) > 22 * 22) continue;
                    double flick = 0.85 + Math.Sin(time * 9 + l.x * 3) * 0.08 + Math.Sin(time * 23 + l.z) * 0.05;
                    lights.Request(l.x, l.y, l.z, l.color, l.intensity * flick, 7, tx, tz);
                }
            }
            lights.End(dt, tx, tz);
            Shader.SetGlobalFloat("_CB_Time", (float)time);
            Shader.SetGlobalFloat("_CB_Surge", (float)(run?.weather.surge ?? 0));
            overlay?.Draw(dt, camera, menuMode ? null : run);
        }

        void MenuFrame(double dt)
        {
            double c = (torchTerrain?.size ?? 64) / 2.0;
            menuAngle += dt * 0.12;
            bool portrait = Screen.height > Screen.width;
            double dist = portrait ? 13 : 10;
            rig.LookFrom(c + Math.Sin(menuAngle) * dist, portrait ? 7.5 : 6, c + Math.Cos(menuAngle) * dist, c, 1.4, c);
            rig.Snap(c, c);
            SunFrom(c + 10, 25, c + 6, c, 0, c);
            sun.transform.position = Gfx.U(c, 0, c);
            if (showModel != null)
            {
                showModel.yaw = menuAngle + Math.Sin(time * 0.6) * 0.4;
                showModel.Place(c, 0, c);
                showModel.Pose(new PoseInput { walk = 0, moving = 0, attack = 0, cast = Math.Max(0, Math.Sin(time * 0.7)) * 0.3, time = time, flash = 0 });
            }
            lights.Request(c + 1.5, 2.5, c + 1.5, 0xffc070, 1.2, 9, c, c);
        }

        void RunFrame(double dt)
        {
            var p = run.player;
            rig.Update(dt, p.x, p.z, p.vx * 0.18, p.vz * 0.18);
            double tx = rig.targetX, tz = rig.targetZ;
            double dark = run.weather.darkness, bl = run.weather.blizzard;
            Shader.SetGlobalVector("_CB_HemiSky", hemiSky * (float)(1 - dark * 0.72));
            Shader.SetGlobalVector("_CB_HemiGround", hemiGround * (float)(1 - dark * 0.72));
            Shader.SetGlobalVector("_CB_SunCol", sunCol * (float)(1 - dark * 0.8));
            Shader.SetGlobalFloat("_CB_FogNear", (float)((pal.fogNear + 8) * (1 - bl * 0.45) * (1 - dark * 0.3)));
            Shader.SetGlobalFloat("_CB_FogFar", (float)((pal.fogFar + 12) * (1 - bl * 0.4) * (1 - dark * 0.3)));
            // the sun follows the camera so the shadow map covers the view
            SunFrom(tx + 8, 26, tz + 10, tx, 0, tz - 2);
            Shader.SetGlobalVector("_CB_Focus", new Vector4((float)p.x, 0, (float)p.z, 0));
            entities.Update(dt, tx, tz);
            particles.Update(dt, tx, tz, bl);
        }
    }
}
