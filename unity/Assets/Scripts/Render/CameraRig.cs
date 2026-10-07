using System;
using UnityEngine;

namespace Cubeborn.View
{
    /// <summary>Top-down angled follow camera with trauma-based screen shake.</summary>
    public class CameraRig
    {
        public readonly Camera camera;
        double trauma, tx, tz;
        public double height = 19.5, back = 11.5, zoom = 1;
        public bool shakeEnabled = true;

        public CameraRig(Camera cam)
        {
            camera = cam;
            cam.nearClipPlane = 0.5f;
            cam.farClipPlane = 200;
            cam.fieldOfView = 40;
        }

        public void Resize(int w, int h)
        {
            double aspect = w / (double)Math.Max(1, h);
            // keep at least ~20 world units visible horizontally on narrow screens
            camera.fieldOfView = aspect < 1 ? 62 : aspect < 1.4 ? 48 : 40;
        }

        public void AddShake(double amount)
        {
            if (!shakeEnabled) return;
            trauma = Math.Min(1, trauma + amount);
        }

        public void Snap(double x, double z) { tx = x; tz = z; }

        public void Update(double dt, double x, double z, double leadX, double leadZ)
        {
            double k = 1 - Math.Exp(-8 * dt);
            tx += (x + leadX - tx) * k;
            tz += (z + leadZ - tz) * k;
            trauma = Math.Max(0, trauma - dt * 1.6);
            double s = trauma * trauma * 0.6;
            double ox = (UnityEngine.Random.value * 2 - 1) * s;
            double oz = (UnityEngine.Random.value * 2 - 1) * s;
            double h = height * zoom, b = back * zoom;
            LookFrom(tx + ox, h, tz + b + oz, tx + ox * 0.5, 0, tz + oz * 0.5);
        }

        /// <summary>Places the camera at a game-space point looking at another.</summary>
        public void LookFrom(double px, double py, double pz, double lx, double ly, double lz)
        {
            var from = Gfx.U(px, py, pz);
            var to = Gfx.U(lx, ly, lz);
            camera.transform.position = from;
            camera.transform.rotation = Quaternion.LookRotation(to - from, Vector3.up);
        }

        public double targetX => tx;
        public double targetZ => tz;
    }
}
