using System;
using System.Collections.Generic;
using UnityEngine;

namespace Cubeborn.View
{
    /// <summary>
    /// Fixed set of point lights reassigned every frame to the most important sources
    /// (explosions, torches, glowing projectiles). Uploaded as global shader arrays.
    /// </summary>
    public class LightPool
    {
        const int Max = 6;

        class Req
        {
            public double x, y, z, intensity, radius, score;
            public int color;
        }

        class Flash
        {
            public double x, z, intensity, radius, t, dur;
            public int color;
        }

        public int count;
        readonly List<Req> reqs = new List<Req>();
        int nReq;
        readonly List<Flash> flashes = new List<Flash>();
        readonly Vector4[] pos = new Vector4[Max];
        readonly Vector4[] col = new Vector4[Max];
        static readonly int PosId = Shader.PropertyToID("_CB_PLPos");
        static readonly int ColId = Shader.PropertyToID("_CB_PLCol");
        static readonly int CountId = Shader.PropertyToID("_CB_PLCount");
        readonly Comparison<Req> byScore = (a, b) => b.score.CompareTo(a.score);
        readonly List<Req> sorted = new List<Req>();

        public LightPool(int count)
        {
            this.count = Math.Min(Max, count);
            for (int i = 0; i < 128; i++) reqs.Add(new Req());
        }

        public void Begin() => nReq = 0;

        public void Request(double x, double y, double z, int color, double intensity, double radius, double cx, double cz)
        {
            if (nReq >= reqs.Count || count == 0) return;
            double d2 = (x - cx) * (x - cx) + (z - cz) * (z - cz);
            if (d2 > 26 * 26) return;
            var r = reqs[nReq++];
            r.x = x; r.y = y; r.z = z; r.color = color; r.intensity = intensity; r.radius = radius;
            r.score = intensity / (1 + d2 * 0.02);
        }

        public void AddFlash(double x, double z, int color, double intensity, double radius, double dur)
        {
            if (flashes.Count > 24) flashes.RemoveAt(0);
            flashes.Add(new Flash { x = x, z = z, color = color, intensity = intensity, radius = radius, t = dur, dur = dur });
        }

        public void Clear() => flashes.Clear();

        public void End(double dt, double cx, double cz)
        {
            for (int i = flashes.Count - 1; i >= 0; i--)
            {
                var f = flashes[i];
                f.t -= dt;
                if (f.t <= 0) { flashes.RemoveAt(i); continue; }
                Request(f.x, 1.2, f.z, f.color, f.intensity * (f.t / f.dur) * 1.5, f.radius, cx, cz);
            }
            sorted.Clear();
            for (int i = 0; i < nReq; i++) sorted.Add(reqs[i]);
            sorted.Sort(byScore);
            int n = 0;
            for (int i = 0; i < count && i < sorted.Count; i++)
            {
                var r = sorted[i];
                var p = Gfx.U(r.x, r.y, r.z);
                pos[n] = new Vector4(p.x, p.y, p.z, (float)Math.Max(0.01, r.radius));
                col[n] = Gfx.Lin(r.color, r.intensity * 3);
                n++;
            }
            for (int i = n; i < Max; i++) { pos[i] = new Vector4(0, -100, 0, 1); col[i] = Vector4.zero; }
            Shader.SetGlobalVectorArray(PosId, pos);
            Shader.SetGlobalVectorArray(ColId, col);
            Shader.SetGlobalFloat(CountId, n);
        }

        public static void Disable()
        {
            Shader.SetGlobalFloat(CountId, 0);
        }
    }
}
