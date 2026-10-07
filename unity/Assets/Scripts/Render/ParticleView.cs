using System;
using System.Collections.Generic;
using UnityEngine;

namespace Cubeborn.View
{
    /// <summary>
    /// CPU particle pool drawn as instanced cubes: additive glow sparks, lit debris chunks with
    /// gravity and bounce, soft smoke puffs and per-map ambient particles.
    /// </summary>
    public class ParticleView
    {
        class P
        {
            public double x, y, z, vx, vy, vz, r, g, b, size, life, max, rot, spin;
            public int kind; // 0 glow, 1 debris, 2 smoke, 3 ambient glow, 4 snow
        }

        readonly P[] list;
        int n;
        readonly Batch glow, debris, smoke;
        readonly int max;
        double ambientAcc;
        readonly string ambient;
        readonly int ambientColor;
        readonly List<UnityEngine.Object> owned = new List<UnityEngine.Object>();

        static float Rv => UnityEngine.Random.value;

        public ParticleView(string quality, string ambient, int ambientColor)
        {
            this.ambient = ambient;
            this.ambientColor = ambientColor;
            max = quality == "low" ? 900 : quality == "medium" ? 1800 : 3000;
            list = new P[max];
            for (int i = 0; i < max; i++) list[i] = new P();
            var glowMat = Gfx.Glow(null, true, 7);
            glow = new Batch(VoxelMesh.CenteredCube(), glowMat);
            var cube = VoxelMesh.Build(new VoxelModel { scale = 0.1f, boxes = new[] { new VoxBox { x = 0, y = -5, z = 0, w = 10, h = 10, d = 10, color = 0xffffff } } });
            var debrisMat = Gfx.Voxel();
            debris = new Batch(cube, debrisMat, true);
            var smokeMat = Gfx.Blend(Gfx.BlobTex, 0.45f, 4);
            smoke = new Batch(SmokeQuad(), smokeMat);
            owned.Add(glowMat); owned.Add(cube); owned.Add(debrisMat); owned.Add(smokeMat); owned.Add(smoke.mesh);
        }

        /// <summary>Vertical 1x1 quad (three.js PlaneGeometry) for camera-facing smoke.</summary>
        static Mesh SmokeQuad()
        {
            var m = new Mesh { name = "smoke" };
            m.SetVertices(new List<Vector3> { new Vector3(-0.5f, -0.5f, 0), new Vector3(0.5f, -0.5f, 0), new Vector3(0.5f, 0.5f, 0), new Vector3(-0.5f, 0.5f, 0) });
            m.SetUVs(0, new List<Vector2> { new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1) });
            m.SetTriangles(new[] { 0, 1, 2, 0, 2, 3 }, 0);
            m.RecalculateBounds();
            return m;
        }

        public void Burst(double x, double y, double z, int color, int count, double speed, double size, double life, ParticleKind kind)
        {
            int k = kind == ParticleKind.Glow ? 0 : kind == ParticleKind.Debris ? 1 : 2;
            double r = ((color >> 16) & 255) / 255.0, g = ((color >> 8) & 255) / 255.0, b = (color & 255) / 255.0;
            for (int i = 0; i < count; i++)
            {
                if (n >= max) return;
                var p = list[n++];
                double a = Rv * Math.PI * 2;
                double sp = speed * (0.35 + Rv * 0.65);
                p.x = x; p.y = y; p.z = z;
                p.vx = Math.Cos(a) * sp;
                p.vz = Math.Sin(a) * sp;
                p.vy = k == 1 ? 2 + Rv * speed : k == 2 ? 0.6 + Rv : (Rv - 0.2) * speed * 0.8;
                p.r = r; p.g = g; p.b = b;
                p.size = size * (0.6 + Rv * 0.8);
                p.life = p.max = life * (0.6 + Rv * 0.6);
                p.rot = Rv * 6;
                p.spin = (Rv - 0.5) * 12;
                p.kind = k;
            }
        }

        void SpawnAmbient(double cx, double cz, double dt, double blizzard)
        {
            double rate = (ambient == "snow" ? 40 : 14) + blizzard * 160;
            ambientAcc += dt * rate;
            int c = ambientColor;
            while (ambientAcc >= 1)
            {
                ambientAcc--;
                if (n >= max - 50) return;
                var p = list[n++];
                p.x = cx + (Rv - 0.5) * 40;
                p.z = cz + (Rv - 0.5) * 34 - 2;
                p.spin = (Rv - 0.5) * 2;
                p.rot = Rv * 6;
                bool snow = ambient == "snow" || (blizzard > 0 && Rv < 0.85);
                if (snow)
                {
                    p.y = 8 + Rv * 6;
                    p.vx = 1 + blizzard * 6 + Rv;
                    p.vz = 0.5 + Rv;
                    p.vy = -2 - Rv * 2;
                    p.r = p.g = p.b = 0.85;
                    p.size = 0.06 + Rv * 0.06;
                    p.life = p.max = 5;
                    p.kind = 4;
                    continue;
                }
                p.kind = 3;
                p.r = ((c >> 16) & 255) / 255.0;
                p.g = ((c >> 8) & 255) / 255.0;
                p.b = (c & 255) / 255.0;
                p.size = 0.05 + Rv * 0.07;
                p.life = p.max = 3 + Rv * 4;
                switch (ambient)
                {
                    case "embers":
                        p.y = 0.2; p.vx = (Rv - 0.5) * 0.6; p.vz = (Rv - 0.5) * 0.6; p.vy = 0.8 + Rv * 1.4;
                        break;
                    case "dust":
                        p.y = 0.3 + Rv * 2; p.vx = (Rv - 0.5) * 0.3; p.vz = (Rv - 0.5) * 0.3; p.vy = (Rv - 0.5) * 0.1;
                        break;
                    default:
                        p.y = 0.3 + Rv * 2.5; p.vx = (Rv - 0.5) * 0.8; p.vz = (Rv - 0.5) * 0.8; p.vy = (Rv - 0.3) * 0.4;
                        break;
                }
            }
        }

        public void Update(double dt, double cx, double cz, double blizzard)
        {
            SpawnAmbient(cx, cz, dt, blizzard);
            glow.Begin();
            debris.Begin();
            smoke.Begin();
            int w = 0;
            for (int i = 0; i < n; i++)
            {
                var p = list[i];
                p.life -= dt;
                if (p.life <= 0) continue;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.z += p.vz * dt;
                p.rot += p.spin * dt;
                double k = p.life / p.max;
                switch (p.kind)
                {
                    case 0:
                        {
                            p.vx *= 1 - dt * 3;
                            p.vz *= 1 - dt * 3;
                            p.vy -= dt * 2;
                            double s = p.size * (0.3 + k * 0.7);
                            glow.PushFast(p.x, p.y, p.z, p.rot, s, s, p.r * k * 1.4, p.g * k * 1.4, p.b * k * 1.4);
                            break;
                        }
                    case 1:
                        {
                            p.vy -= dt * 22;
                            if (p.y < p.size * 0.5)
                            {
                                p.y = p.size * 0.5;
                                p.vy *= -0.35;
                                p.vx *= 0.6;
                                p.vz *= 0.6;
                                p.spin *= 0.6;
                            }
                            double s = p.size * Math.Min(1, k * 3);
                            debris.PushFast(p.x, p.y, p.z, p.rot, s, s, p.r, p.g, p.b, 0);
                            break;
                        }
                    case 2:
                        {
                            p.vx *= 1 - dt * 2;
                            p.vz *= 1 - dt * 2;
                            double s = p.size * (2 - k);
                            smoke.Push(p.x, p.y, p.z, 0, s, s, s, new Vector4((float)(p.r * 0.6), (float)(p.g * 0.6), (float)(p.b * 0.6), 1), 0, 0, -0.9);
                            break;
                        }
                    case 3:
                        {
                            double tw = Math.Sin(k * Math.PI);
                            double s = p.size * (0.6 + tw * 0.4);
                            glow.PushFast(p.x, p.y, p.z, p.rot, s, s, p.r * tw, p.g * tw, p.b * tw);
                            break;
                        }
                    case 4:
                        {
                            if (p.y < 0.05)
                            {
                                p.life = Math.Min(p.life, 0.3);
                                p.vx = p.vy = p.vz = 0;
                                p.y = 0.05;
                            }
                            double f = Math.Min(1, k * 4);
                            glow.PushFast(p.x, p.y, p.z, p.rot, p.size, p.size, 0.7 * f, 0.75 * f, 0.8 * f);
                            break;
                        }
                }
                if (w != i)
                {
                    var t = list[w];
                    list[w] = p;
                    list[i] = t;
                }
                w++;
            }
            n = w;
            glow.Draw();
            debris.Draw();
            smoke.Draw();
        }

        public void Clear() => n = 0;

        public void Destroy()
        {
            foreach (var o in owned) UnityEngine.Object.Destroy(o);
        }
    }
}
