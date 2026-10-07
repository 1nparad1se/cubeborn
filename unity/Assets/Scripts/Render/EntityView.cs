using System;
using System.Collections.Generic;
using UnityEngine;

namespace Cubeborn.View
{
    /// <summary>
    /// Draws every dynamic gameplay object: the hero, enemies (instanced per model with two walk
    /// frames), bosses (articulated), allies, projectiles, pickups, enemy hazards and weapon effects.
    /// </summary>
    public class EntityView
    {
        const double TAU = Math.PI * 2;

        readonly Run run;
        readonly string quality;
        readonly LightPool lights;
        readonly Material voxMat;
        readonly Dictionary<string, Batch[]> models = new Dictionary<string, Batch[]>();
        readonly List<Batch> modelBatches = new List<Batch>();
        readonly Articulated hero;
        readonly Dictionary<string, Articulated> bossModels = new Dictionary<string, Articulated>();
        readonly Batch shadows, glowBox, glowBoxTop, glowDisc, glowRing, glowRingThin, glowPlane, darkDisc;
        readonly Batch[] all;
        readonly List<Material> mats = new List<Material>();
        readonly List<Mesh> meshes = new List<Mesh>();
        readonly HashSet<string> usedBoss = new HashSet<string>();
        readonly bool enemyShadows;
        double heroWalk, time;
        double camX, camZ;

        static readonly VoxelModel Rock = new VoxelModel
        {
            scale = 0.1f,
            boxes = new[]
            {
                new VoxBox { x = 0, y = 0, z = 0, w = 10, h = 10, d = 10, color = 0x8a8a8a },
                new VoxBox { x = 2, y = 2, z = 2, w = 6, h = 10, d = 6, color = 0x9a9a9a },
            },
        };

        public EntityView(Run run, string quality, LightPool lights)
        {
            this.run = run;
            this.quality = quality;
            this.lights = lights;
            voxMat = Gfx.Voxel();
            mats.Add(voxMat);
            enemyShadows = quality == "high";
            var heroModel = Content.GetModel(run.hero.model) ?? Content.GetModel(run.hero.id);
            hero = new Articulated(heroModel, quality != "low");

            var shadowMat = Gfx.Blend(Gfx.BlobTex, 0.45f, 1);
            var glowMat = Gfx.Glow(null, true, 5);
            var glowTopMat = Gfx.Glow(null, false, 6);
            var softMat = Gfx.Glow(Gfx.BlobTex, true, 5);
            var darkMat = Gfx.Multiply(Gfx.BlobTex, 5);
            mats.AddRange(new[] { shadowMat, glowMat, glowTopMat, softMat, darkMat });
            shadows = new Batch(VoxelMesh.FlatPlane(), shadowMat);
            glowBox = new Batch(VoxelMesh.CenteredCube(), glowMat);
            glowBoxTop = new Batch(VoxelMesh.CenteredCube(), glowTopMat);
            glowDisc = new Batch(VoxelMesh.FlatPlane(), softMat);
            glowRing = new Batch(VoxelMesh.FlatRing(0.84f), glowMat);
            glowRingThin = new Batch(VoxelMesh.FlatRing(0.93f), glowMat);
            glowPlane = new Batch(VoxelMesh.FlatPlane(), glowMat);
            darkDisc = new Batch(VoxelMesh.FlatPlane(), darkMat);
            all = new[] { shadows, glowBox, glowBoxTop, glowDisc, glowRing, glowRingThin, glowPlane, darkDisc };
        }

        Batch[] BatchesFor(string id, VoxelModel model, int frames)
        {
            if (models.TryGetValue(id, out var b)) return b;
            if (model == null) return null;
            b = new Batch[frames];
            for (int f = 0; f < frames; f++)
            {
                var mesh = VoxelMesh.Build(model, frames > 1 ? f : -1);
                meshes.Add(mesh);
                b[f] = new Batch(mesh, voxMat, true, enemyShadows);
                modelBatches.Add(b[f]);
            }
            models[id] = b;
            return b;
        }

        Articulated BossModel(string id)
        {
            if (bossModels.TryGetValue(id, out var m)) return m;
            var def = Content.GetGroupModel("boss", id);
            if (def == null) return null;
            m = new Articulated(def, quality != "low");
            bossModels[id] = m;
            return m;
        }

        bool Visible(double x, double z)
        {
            double dx = x - camX, dz = z - camZ - 2;
            return dx * dx + dz * dz < 30 * 30;
        }

        public void Update(double dt, double cx, double cz)
        {
            camX = cx;
            camZ = cz;
            time += dt;
            foreach (var b in modelBatches) b.Begin();
            foreach (var b in all) b.Begin();
            DrawHero(dt);
            DrawEnemies();
            DrawAllies();
            DrawProjectiles();
            DrawPickups();
            DrawHazards();
            DrawEffects();
            foreach (var b in modelBatches) b.Draw();
            foreach (var b in all) b.Draw();
        }

        static double AngleDelta(double from, double to)
        {
            double d = (to - from) % TAU;
            if (d > Math.PI) d -= TAU;
            if (d < -Math.PI) d += TAU;
            return d;
        }

        // ---------------------------------------------------------------- hero
        void DrawHero(double dt)
        {
            var p = run.player;
            var h = hero;
            double sp = Math.Sqrt(p.vx * p.vx + p.vz * p.vz);
            heroWalk += dt * (4 + sp * 2.2);
            double yaw = Math.Atan2(p.fx, p.fz);
            h.yaw += AngleDelta(h.yaw, yaw) * Math.Min(1, dt * 14);
            bool blink = p.invulnT > 0 && Math.Floor(time * 20) % 2 == 0;
            h.roll = p.dead ? Math.Min(Math.PI / 2, h.roll + dt * 5) : 0;
            h.Place(p.x, 0, p.z);
            h.Pose(new PoseInput
            {
                walk = heroWalk, moving = Math.Min(1, sp / 2), attack = Math.Max(0, p.attackPulse) / 0.12, cast = 0, time = time,
                flash = p.hurtT > 0 ? p.hurtT * 3 : blink ? 0.35 : 0,
            });
            shadows.Push(p.x, 0.03, p.z, 0, 1.3, 1, 1.3, Vector4.zero);
            if (p.buffs.aegis > 0) glowRing.Push(p.x, 0.9, p.z, time * 2, 1.2, 1, 1.2, 0xffe080, 0, 0, 0, 0.6);
            if (p.shield) glowRingThin.Push(p.x, 0.06, p.z, 0, 1.0, 1, 1.0, 0x8ad0ff, 0, 0, 0, 0.8);
            if (p.buffs.fury > 0) glowDisc.Push(p.x, 0.05, p.z, 0, 2.4, 1, 2.4, 0xff4040, 0, 0, 0, 0.5);
            if (p.buffs.haste > 0) glowDisc.Push(p.x, 0.05, p.z, 0, 2.2, 1, 2.2, 0x40ffc0, 0, 0, 0, 0.45);
            if (p.buffs.frenzy > 0) glowDisc.Push(p.x, 0.05, p.z, 0, 2.2, 1, 2.2, 0xff9a3a, 0, 0, 0, 0.45);
            // the hero always carries a soft light so darkness stays readable
            lights.Request(p.x, 2.2, p.z, 0xffe6c0, run.weather.darkness > 0 ? 1.4 : 0.55, 9, p.x, p.z);
        }

        // ---------------------------------------------------------------- enemies
        void DrawEnemies()
        {
            usedBoss.Clear();
            foreach (var e in run.enemies.list)
            {
                if (!e.active) continue;
                if (e.boss != null)
                {
                    DrawBoss(e);
                    usedBoss.Add(e.boss.def.model);
                    continue;
                }
                if (!Visible(e.x, e.z)) continue;
                var def = e.def;
                int frames = def.behavior == "prop" ? 1 : 2;
                var mb = BatchesFor(def.model, Content.GetModel(def.model), frames);
                double s = e.scale, sy = s, y = e.y;
                double flash = Math.Min(1, e.flash * 6);
                if (e.dying > 0)
                {
                    double k = e.dying / 0.28;
                    sy = s * k;
                    s = s * (1 + (1 - k) * 0.5);
                    flash = 1;
                    y -= (1 - k) * 0.2;
                }
                double r = 1, g = 1, bl = 1;
                if (e.freezeT > 0) { r = 0.6; g = 0.85; bl = 1.5; }
                else if (e.burnT > 0 && ((long)Math.Floor(time * 8 + e.index)) % 2 == 0) { r = 1.4; g = 0.8; bl = 0.55; }
                else if (e.poisonT > 0) { r = 0.7; g = 1.25; bl = 0.55; }
                else if (e.slowT > 0) { r = 0.8; g = 0.9; bl = 1.2; }
                if (e.invuln) { r *= 0.7; g *= 0.7; bl *= 1.3; }
                if (mb != null)
                {
                    int fi = frames > 1 && e.freezeT <= 0 ? ((int)Math.Floor(e.anim * 1.2)) & 1 : 0;
                    mb[fi].PushFast(e.x, y, e.z, e.yaw, s, sy, r, g, bl, flash);
                }
                else glowBox.Push(e.x, 0.6, e.z, 0, 0.8 * s, 1.2 * s, 0.8 * s, 0xff00ff);
                double shadowS = Math.Max(0.7, e.radius * 2.6);
                shadows.Push(e.x, 0.02, e.z, 0, shadowS, 1, shadowS, Vector4.zero);
                if (e.elite != null && e.dying == 0)
                {
                    int c = Content.EliteById[e.elite].color;
                    double pr = e.radius * 2.4 + Math.Sin(time * 5 + e.index) * 0.08;
                    glowRing.Push(e.x, 0.05, e.z, time, pr, 1, pr, c, 0, 0, 0, 0.9);
                    if (e.elite2 != null) glowRingThin.Push(e.x, 0.07, e.z, -time, pr * 0.75, 1, pr * 0.75, Content.EliteById[e.elite2].color, 0, 0, 0, 0.9);
                    glowDisc.Push(e.x, 0.04, e.z, 0, pr * 2.2, 1, pr * 2.2, c, 0, 0, 0, 0.35);
                }
                if (def.id == "treasure_sprite")
                {
                    glowDisc.Push(e.x, 0.05, e.z, 0, 2.6, 1, 2.6, 0xffd23d, 0, 0, 0, 0.6 + Math.Sin(time * 6) * 0.2);
                    lights.Request(e.x, 1.5, e.z, 0xffd23d, 1, 6, run.player.x, run.player.z);
                }
                if (def.behavior == "exploder" && e.state == 1)
                    glowDisc.Push(e.x, 0.06, e.z, 0, 2, 1, 2, 0xff5020, 0, 0, 0, 0.5 + Math.Sin(time * 30) * 0.5);
                if (e.shieldT > 0) glowRing.Push(e.x, 0.6 * s, e.z, time * 3, e.radius * 2.6, 1, e.radius * 2.6, 0x9a7aff, 0, 0, 0, 0.7);
            }
            foreach (var kv in bossModels) if (!usedBoss.Contains(kv.Key)) kv.Value.visible = false;
        }

        void DrawBoss(Enemy e)
        {
            var b = e.boss;
            var m = BossModel(b.def.model);
            if (m == null) return;
            bool hidden = b.hidden > 0;
            m.visible = !hidden;
            double dying = e.dying > 0 ? e.dying / 0.28 : 1;
            m.yaw += AngleDelta(m.yaw, e.yaw) * 0.15;
            m.Place(e.x, e.y + (hidden ? -2 : 0), e.z, e.scale * (b.isClone ? 0.6 : 1) * (0.5 + dying * 0.5));
            double sp = Math.Sqrt(e.vx * e.vx + e.vz * e.vz);
            m.Pose(new PoseInput
            {
                walk = time * (3 + sp * 1.5), moving = Math.Min(1, sp / 1.5), attack = 0, cast = b.cast, time = time,
                flash = Math.Min(1, e.flash * 6) + (b.dashPhase == 1 ? 0.3 + Math.Sin(time * 30) * 0.3 : 0),
            });
            double sh = e.radius * 3;
            shadows.Push(e.x, 0.03, e.z, 0, sh, 1, sh, Vector4.zero);
            if (hidden) glowDisc.Push(e.x, 0.05, e.z, time, 3, 1, 3, b.def.color, 0, 0, 0, 0.5);
            if (e.invuln) glowRing.Push(e.x, 1.2, e.z, time, e.radius * 2, 1, e.radius * 2, 0x9adfff, 0, 0, 0, 0.8);
            glowRing.Push(e.x, 0.05, e.z, -time * 0.5, e.radius * 1.8, 1, e.radius * 1.8, b.def.color, 0, 0, 0, 0.6);
            lights.Request(e.x, 3, e.z, b.def.color, 1.4, 10, run.player.x, run.player.z);
        }

        // ---------------------------------------------------------------- allies
        void DrawAllies()
        {
            foreach (var a in run.allies.list)
            {
                if (!a.active || !Visible(a.x, a.z)) continue;
                var mb = BatchesFor(a.model, Content.GetModel(a.model), 2);
                if (mb == null) continue;
                int fi = ((int)Math.Floor(a.anim * 1.2)) & 1;
                double fade = Math.Min(1, a.life * 2);
                mb[fi].PushFast(a.x, 0, a.z, a.yaw, a.scale * fade, a.scale * fade, 1, 1.05, 1.15, a.attack > 0 ? 0.25 : 0);
                shadows.Push(a.x, 0.02, a.z, 0, 0.9, 1, 0.9, Vector4.zero);
            }
        }

        // ---------------------------------------------------------------- projectiles
        void DrawProjectiles()
        {
            double px = run.player.x, pz = run.player.z;
            int nLights = 0;
            foreach (var p in run.projectiles.list)
            {
                if (!p.active || !Visible(p.x, p.z)) continue;
                var model = Content.GetGroupModel("projectile", p.vis);
                double fadeIn = Math.Min(1, p.age * 12);
                double s = p.scale * (0.4 + fadeIn * 0.6);
                string vis = p.vis;
                if (model != null)
                {
                    var mb = BatchesFor("p:" + vis, model, 1);
                    bool ground = vis == "pool" || vis == "firepool" || vis == "firepatch" || vis == "mine";
                    double fade = ground ? Math.Min(1, p.life * 2) : 1;
                    double yaw = p.yaw;
                    if (vis == "saw" || vis == "glaive" || vis == "tornado" || vis == "wisp") yaw = time * 10 + p.a;
                    if (vis == "pool" || vis == "firepool" || vis == "firepatch") yaw = p.a * 3;
                    double y = ground ? 0.02 : p.y - 0.15;
                    mb[0].PushFast(p.x, y, p.z, yaw, s * fade, s * (ground ? 1 : fade), 1, 1, 1, 0);
                    if (!ground) shadows.Push(p.x, 0.02, p.z, 0, 0.5 * s, 1, 0.5 * s, Vector4.zero);
                    if (vis == "pool" || vis == "firepool" || vis == "firepatch")
                        glowDisc.Push(p.x, 0.06, p.z, 0, 2.6 * s, 1, 2.6 * s, vis == "pool" ? 0x9cff4f : 0xff6a1a, 0, 0, 0, 0.35 * fade);
                    if (vis == "mine" && p.a > 0) glowDisc.Push(p.x, 0.08, p.z, 0, 2.5, 1, 2.5, 0xff5470, 0, 0, 0, 0.8);
                    if (vis == "cloud") shadows.Push(p.x, 0.03, p.z, 0, 2.2 * s, 1, 2.2 * s, Vector4.zero);
                    if (vis == "meteor") glowBox.Push(p.x, p.y + 0.3, p.z, time * 3, 0.9 * s, 0.9 * s, 0.9 * s, 0xff8a2a, 0, 0, 0, 0.8);
                }
                else glowBox.Push(p.x, p.y, p.z, time * 5, 0.32 * s, 0.32 * s, 0.32 * s, p.color);
                if (p.glow > 0 || vis == "fireball" || vis == "bolt" || vis == "wisp" || vis == "shard")
                {
                    glowDisc.Push(p.x, 0.05, p.z, 0, 1.4 * s, 1, 1.4 * s, p.color, 0, 0, 0, 0.45);
                    if (nLights < 6 && (vis == "fireball" || p.glow > 0))
                    {
                        nLights++;
                        lights.Request(p.x, 1, p.z, p.color, 0.8, 5, px, pz);
                    }
                }
            }
        }

        // ---------------------------------------------------------------- pickups
        void DrawPickups()
        {
            foreach (var k in run.pickups.list)
            {
                if (!k.active || !Visible(k.x, k.z)) continue;
                var model = Content.GetGroupModel("pickup", k.kind);
                double bob = Math.Sin(time * 3 + k.x * 1.7) * 0.08;
                if (k.kind == "xp")
                {
                    double v = k.value;
                    double cr, cg, cb, s;
                    if (v <= 2) { cr = 0.55; cg = 0.85; cb = 1.25; s = 0.9; }
                    else if (v <= 10) { cr = 0.5; cg = 1.4; cb = 0.6; s = 1.05; }
                    else if (v <= 40) { cr = 1.5; cg = 0.45; cb = 0.45; s = 1.25; }
                    else { cr = 1.25; cg = 0.6; cb = 1.5; s = 1.5; }
                    var xb = BatchesFor("k:xp", model, 1);
                    if (xb != null) xb[0].PushFast(k.x, 0.2 + k.y + bob, k.z, time * 1.5 + k.x, s, s, cr, cg, cb, 0.15);
                    continue;
                }
                if (model == null) continue;
                var mb = BatchesFor("k:" + k.kind, model, 1);
                bool chest = k.kind == "chest";
                double spin = chest ? 0 : time * 1.8;
                double sc = chest && k.tier > 0 ? 1.25 : 1;
                mb[0].PushFast(k.x, 0.15 + k.y + (chest ? 0 : bob + 0.2), k.z, spin, sc, sc, 1, 1, 1, 0);
                shadows.Push(k.x, 0.02, k.z, 0, chest ? 1.6 : 0.8, 1, chest ? 1.6 : 0.8, Vector4.zero);
                if (chest)
                {
                    int c = k.tier > 0 ? 0xffd23d : 0xffb060;
                    glowDisc.Push(k.x, 0.05, k.z, 0, 3.2, 1, 3.2, c, 0, 0, 0, 0.55 + Math.Sin(time * 4) * 0.2);
                    glowBox.Push(k.x, 3, k.z, time, 0.25, 6, 0.25, c, 0, 0, 0, 0.35);
                    lights.Request(k.x, 1.5, k.z, c, 0.9, 6, run.player.x, run.player.z);
                }
                else if (k.kind != "gold") glowDisc.Push(k.x, 0.05, k.z, 0, 1.6, 1, 1.6, model.boxes[0].color, 0, 0, 0, 0.5);
            }
        }

        // ---------------------------------------------------------------- hazards
        void DrawHazards()
        {
            var hz = run.hazards;
            double blink = 0.75 + Math.Sin(time * 18) * 0.25;
            foreach (var b in hz.bullets)
            {
                if (!b.active) continue;
                double s = b.r * 1.7;
                glowBoxTop.Push(b.x, 0.8, b.z, time * 6, s, s, s, b.color, 0, 0, 0, 1);
                glowBox.Push(b.x, 0.8, b.z, -time * 4, s * 0.55, s * 0.55, s * 0.55, 0xffffff, 0, 0, 0, 1);
                glowDisc.Push(b.x, 0.05, b.z, 0, s * 2.2, 1, s * 2.2, b.color, 0, 0, 0, 0.6);
            }
            foreach (var z in hz.zones)
            {
                if (!z.active) continue;
                int c = z.freeze ? 0x6ad8ff : z.color;
                if (z.t > 0)
                {
                    double k = 1 - z.t / Math.Max(0.01, z.tele);
                    glowRing.Push(z.x, 0.07, z.z, 0, z.r, 1, z.r, c, 0, 0, 0, 0.85 * blink);
                    glowDisc.Push(z.x, 0.06, z.z, 0, z.r * 2.2 * k, 1, z.r * 2.2 * k, c, 0, 0, 0, 0.6);
                }
                else if (z.poolT > 0)
                {
                    double f = Math.Min(1, z.poolT * 2);
                    glowDisc.Push(z.x, 0.06, z.z, time * 0.3, z.r * 2.4, 1, z.r * 2.4, c, 0, 0, 0, 0.55 * f);
                    glowRingThin.Push(z.x, 0.07, z.z, 0, z.r, 1, z.r, c, 0, 0, 0, 0.5 * f);
                }
            }
            foreach (var l in hz.lasers)
            {
                if (!l.active) continue;
                double yaw = Math.PI / 2 - l.angle;
                double cx = l.x + Math.Cos(l.angle) * l.len * 0.5;
                double cz = l.z + Math.Sin(l.angle) * l.len * 0.5;
                if (l.t < l.tele)
                {
                    double k = l.t / l.tele;
                    glowPlane.Push(cx, 0.08, cz, yaw, l.width * (0.2 + k * 0.3), 1, l.len, l.color, 0, 0, 0, 0.4 + k * 0.5 * blink);
                }
                else
                {
                    double fade = Math.Min(1, (l.tele + l.dur - l.t) * 4);
                    glowBoxTop.Push(cx, 0.9, cz, yaw, l.width * fade, l.width * 0.8 * fade, l.len, l.color, 0, 0, 0, 1);
                    glowBox.Push(cx, 0.9, cz, yaw, l.width * 0.35 * fade, l.width * 0.35, l.len, 0xffffff, 0, 0, 0, 1);
                    glowPlane.Push(cx, 0.06, cz, yaw, l.width * 2.4, 1, l.len, l.color, 0, 0, 0, 0.5);
                    lights.Request(cx, 1.2, cz, l.color, 1.6, l.len * 0.8, run.player.x, run.player.z);
                }
            }
            foreach (var s in hz.shocks)
            {
                if (!s.active) continue;
                double fade = 1 - s.r / s.maxR;
                glowRing.Push(s.x, 0.12, s.z, 0, s.r, 1, s.r, s.color, 0, 0, 0, 0.6 + fade * 0.4);
                glowRingThin.Push(s.x, 0.5, s.z, 0, s.r, 1, s.r, s.color, 0, 0, 0, 0.6 * fade);
            }
            foreach (var w in hz.warns)
            {
                if (!w.active) continue;
                double k = 1 - w.t / Math.Max(0.01, w.total);
                double yaw = Math.Atan2(w.dx, w.dz);
                double cx = w.x + w.dx * w.len * 0.5;
                double cz = w.z + w.dz * w.len * 0.5;
                glowPlane.Push(cx, 0.08, cz, yaw, w.width, 1, w.len, 0xff3030, 0, 0, 0, 0.25 + k * 0.4 * blink);
                glowPlane.Push(cx, 0.09, cz, yaw, w.width * k, 1, w.len, 0xff6040, 0, 0, 0, 0.5);
            }
        }

        // ---------------------------------------------------------------- weapon effects
        static double Rnd(double n)
        {
            double x = Math.Sin(n * 127.1) * 43758.5453;
            return x - Math.Floor(x);
        }

        void DrawEffects()
        {
            foreach (var e in run.effects.list)
            {
                if (!e.active) continue;
                double k = e.life / e.maxLife; // 1 -> 0
                int c = e.color;
                switch (e.kind)
                {
                    case EffectKind.Slash:
                        {
                            int n = Math.Max(4, (int)Math.Ceiling(e.arc / 0.22));
                            double sweep = Math.Min(1, (1 - k) * 2.2);
                            int shown = Math.Max(1, (int)Math.Floor(n * sweep));
                            for (int i = 0; i < shown; i++)
                            {
                                double a = e.angle - e.arc / 2 + ((i + 0.5) / n) * e.arc;
                                double rr = e.r * 0.78;
                                double x = e.x + Math.Cos(a) * rr;
                                double z = e.z + Math.Sin(a) * rr;
                                double seg = (e.arc / n) * rr * 1.25;
                                double tip = 1 - Math.Abs(i / (double)n - 0.5) * 1.4;
                                glowPlane.Push(x, 0.7, z, Math.PI / 2 - a, e.r * 0.42 * tip, 1, seg, c, 0, 0, 0, k * 0.95);
                                glowPlane.Push(x, 0.72, z, Math.PI / 2 - a, e.r * 0.12 * tip, 1, seg, 0xffffff, 0, 0, 0, k);
                            }
                            break;
                        }
                    case EffectKind.Ring:
                        {
                            double r = e.r * (0.35 + (1 - k) * 0.65);
                            glowRing.Push(e.x, 0.15, e.z, 0, r, 1, r, c, 0, 0, 0, k);
                            glowDisc.Push(e.x, 0.1, e.z, 0, r * 2.2, 1, r * 2.2, c, 0, 0, 0, k * 0.4);
                            break;
                        }
                    case EffectKind.Beam:
                        {
                            double dx = e.x2 - e.x, dz = e.z2 - e.z;
                            double len = Math.Sqrt(dx * dx + dz * dz);
                            if (len < 0.01) break;
                            double yaw = Math.Atan2(dx, dz);
                            double w = e.w * (0.5 + k * 0.5);
                            glowBoxTop.Push(e.x + dx / 2, e.y, e.z + dz / 2, yaw, w, w, len, c, 0, 0, 0, Math.Min(1, k * 2));
                            glowBox.Push(e.x + dx / 2, e.y, e.z + dz / 2, yaw, w * 0.35, w * 0.35, len, 0xffffff, 0, 0, 0, Math.Min(1, k * 2));
                            glowPlane.Push(e.x + dx / 2, 0.06, e.z + dz / 2, yaw, w * 2.5, 1, len, c, 0, 0, 0, k * 0.4);
                            break;
                        }
                    case EffectKind.Bolt:
                        {
                            int segs = e.y > 3 ? 7 : 5;
                            double px = e.x, py = e.y, pz = e.z;
                            double seed = Math.Floor(time * 30) + e.seed;
                            for (int i = 1; i <= segs; i++)
                            {
                                double t = i / (double)segs;
                                double j = i == segs ? 0 : 0.5;
                                double nx = e.x + (e.x2 - e.x) * t + (Rnd(seed + i) - 0.5) * j;
                                double nz = e.z + (e.z2 - e.z) * t + (Rnd(seed + i * 7) - 0.5) * j;
                                double ny = e.y + (0.6 - e.y) * t;
                                Segment(px, py, pz, nx, ny, nz, e.w * 1.6, c, k);
                                Segment(px, py, pz, nx, ny, nz, e.w * 0.6, 0xffffff, k);
                                px = nx; py = ny; pz = nz;
                            }
                            glowDisc.Push(e.x2, 0.06, e.z2, 0, 2.2, 1, 2.2, c, 0, 0, 0, k * 0.7);
                            break;
                        }
                    case EffectKind.Lance:
                        {
                            double yaw = Math.PI / 2 - e.angle;
                            double ext = Math.Min(1, (1 - k) * 4);
                            double len = e.r * ext;
                            double cx = e.x + Math.Cos(e.angle) * len * 0.5;
                            double cz = e.z + Math.Sin(e.angle) * len * 0.5;
                            glowBoxTop.Push(cx, 0.8, cz, yaw, e.w * 0.6, e.w * 0.4, len, c, 0, 0, 0, k);
                            glowPlane.Push(cx, 0.07, cz, yaw, e.w * 1.8, 1, len, c, 0, 0, 0, k * 0.5);
                            break;
                        }
                    case EffectKind.Aura:
                        {
                            double r = e.r;
                            glowRing.Push(e.x, 0.08, e.z, time * 0.8, r, 1, r, c, 0, 0, 0, 0.55);
                            glowRingThin.Push(e.x, 0.1, e.z, -time * 1.4, r * 0.8, 1, r * 0.8, c, 0, 0, 0, 0.35);
                            glowDisc.Push(e.x, 0.05, e.z, 0, r * 2.1, 1, r * 2.1, c, 0, 0, 0, 0.18 + Math.Sin(time * 3) * 0.05);
                            break;
                        }
                    case EffectKind.Flash:
                        {
                            double r = e.r * (0.5 + (1 - k) * 0.7);
                            glowDisc.Push(e.x, 0.1, e.z, 0, r * 2.6, 1, r * 2.6, c, 0, 0, 0, k);
                            glowDisc.Push(e.x, 0.12, e.z, 0, r * 1.3, 1, r * 1.3, 0xffffff, 0, 0, 0, k * k);
                            glowRing.Push(e.x, 0.14, e.z, 0, r, 1, r, c, 0, 0, 0, k * 0.8);
                            break;
                        }
                    case EffectKind.Warn:
                        {
                            double kk = 1 - k;
                            glowRing.Push(e.x, 0.07, e.z, 0, e.r, 1, e.r, c, 0, 0, 0, 0.7);
                            glowDisc.Push(e.x, 0.06, e.z, 0, e.r * 2.2 * kk, 1, e.r * 2.2 * kk, c, 0, 0, 0, 0.5);
                            break;
                        }
                    case EffectKind.Punch:
                        {
                            double r = e.r * (0.6 + (1 - k) * 0.8);
                            glowPlane.Push(e.x, 0.8, e.z, Math.PI / 2 - e.angle, r, 1, r * 0.5, c, 0, 0, 0, k);
                            glowRing.Push(e.x, 0.75, e.z, 0, r * 0.6, 1, r * 0.6, 0xffffff, 0, 0, 0, k);
                            break;
                        }
                    case EffectKind.Cloud:
                        darkDisc.Push(e.x, 0.05, e.z, 0, e.r * 2, 1, e.r * 2, 0x808080);
                        break;
                    case EffectKind.Fall:
                        {
                            glowRing.Push(e.x, 0.07, e.z, 0, 1.1, 1, 1.1, 0xff4030, 0, 0, 0, 0.8);
                            glowDisc.Push(e.x, 0.06, e.z, 0, 2.2 * (1 - k), 1, 2.2 * (1 - k), 0xff4030, 0, 0, 0, 0.5);
                            var mb = BatchesFor("fallrock", Rock, 1);
                            mb[0].PushFast(e.x, k * 12, e.z, time * 3 + e.seed, 1, 1, ((c >> 16) & 255) / 160.0, ((c >> 8) & 255) / 160.0, (c & 255) / 160.0, 0);
                            break;
                        }
                }
            }
        }

        void Segment(double x1, double y1, double z1, double x2, double y2, double z2, double w, int c, double a)
        {
            double dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
            double len = Math.Sqrt(dx * dx + dy * dy + dz * dz);
            double yaw = Math.Atan2(dx, dz);
            double pitch = -Math.Atan2(dy, Math.Sqrt(dx * dx + dz * dz));
            glowBoxTop.Push((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, yaw, w, w, len, c, 0, 0, pitch, a);
        }

        public void Destroy()
        {
            hero.Destroy();
            foreach (var m in bossModels.Values) m.Destroy();
            foreach (var m in meshes) UnityEngine.Object.Destroy(m);
            foreach (var m in mats) UnityEngine.Object.Destroy(m);
        }
    }
}
