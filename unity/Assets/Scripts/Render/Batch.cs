using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Cubeborn.View
{
    /// <summary>
    /// Instanced draw list refilled every frame (three.js InstancedBatch equivalent).
    /// Instances are drawn with Graphics.DrawMeshInstanced in chunks of up to 1023.
    /// </summary>
    public class Batch
    {
        const int Chunk = 1023;

        class Part
        {
            public readonly Matrix4x4[] m = new Matrix4x4[Chunk];
            public readonly Vector4[] c = new Vector4[Chunk];
            public readonly float[] f = new float[Chunk];
            public readonly MaterialPropertyBlock mpb = new MaterialPropertyBlock();
        }

        public Mesh mesh;
        public readonly Material material;
        readonly bool withFlash, castShadow;
        readonly List<Part> parts = new List<Part>();
        public int count;

        public Batch(Mesh mesh, Material material, bool withFlash = false, bool castShadow = false)
        {
            this.mesh = mesh;
            this.material = material;
            this.withFlash = withFlash;
            this.castShadow = castShadow;
        }

        public void Begin() => count = 0;

        int Slot(out Part p)
        {
            int i = count++;
            int pi = i / Chunk;
            while (parts.Count <= pi) parts.Add(new Part());
            p = parts[pi];
            return i % Chunk;
        }

        /// <summary>Adds an instance: game-space position, yaw/roll/pitch (three.js YXZ order), non-uniform scale, linear colour.</summary>
        public void Push(double x, double y, double z, double yaw, double sx, double sy, double sz, Vector4 color, double flash = 0, double roll = 0, double pitch = 0)
        {
            int i = Slot(out var p);
            if (roll == 0 && pitch == 0) p.m[i] = YawMatrix(x, y, z, yaw, sx, sy, sz);
            else
                p.m[i] = Matrix4x4.TRS(Gfx.U(x, y, z),
                    Quaternion.Euler((float)(-pitch * Mathf.Rad2Deg), (float)(-yaw * Mathf.Rad2Deg), (float)(roll * Mathf.Rad2Deg)),
                    new Vector3((float)sx, (float)sy, (float)sz));
            p.c[i] = color;
            p.f[i] = (float)flash;
        }

        /// <summary>Adds an instance with a hex colour times brightness.</summary>
        public void Push(double x, double y, double z, double yaw, double sx, double sy, double sz, int hex = 0xffffff, double flash = 0, double roll = 0, double pitch = 0, double bright = 1)
            => Push(x, y, z, yaw, sx, sy, sz, Gfx.Lin(hex, bright), flash, roll, pitch);

        /// <summary>Yaw only, uniform horizontal scale and a raw (linear) rgb multiplier.</summary>
        public void PushFast(double x, double y, double z, double yaw, double s, double sy, double r, double g, double b, double flash = 0)
        {
            int i = Slot(out var p);
            p.m[i] = YawMatrix(x, y, z, yaw, s, sy, s);
            p.c[i] = new Vector4((float)r, (float)g, (float)b, 1);
            p.f[i] = (float)flash;
        }

        /// <summary>Unity matrix for a game-space yaw rotation (Ry(-yaw) after mirroring z).</summary>
        public static Matrix4x4 YawMatrix(double x, double y, double z, double yaw, double sx, double sy, double sz)
        {
            float c = (float)Math.Cos(yaw), s = (float)Math.Sin(yaw);
            var m = new Matrix4x4();
            m.m00 = c * (float)sx; m.m01 = 0; m.m02 = -s * (float)sz; m.m03 = (float)x;
            m.m10 = 0; m.m11 = (float)sy; m.m12 = 0; m.m13 = (float)y;
            m.m20 = s * (float)sx; m.m21 = 0; m.m22 = c * (float)sz; m.m23 = (float)-z;
            m.m30 = 0; m.m31 = 0; m.m32 = 0; m.m33 = 1;
            return m;
        }

        public void Draw(Camera cam = null)
        {
            int left = count;
            for (int pi = 0; left > 0; pi++)
            {
                var p = parts[pi];
                int n = Math.Min(Chunk, left);
                left -= n;
                p.mpb.SetVectorArray(Gfx.ColorId, p.c);
                if (withFlash) p.mpb.SetFloatArray(Gfx.FlashId, p.f);
                Graphics.DrawMeshInstanced(mesh, 0, material, p.m, n, p.mpb,
                    castShadow ? ShadowCastingMode.On : ShadowCastingMode.Off, castShadow, Gfx.WorldLayer, cam);
            }
        }
    }
}
