using System;
using System.Collections.Generic;
using UnityEngine;

namespace Cubeborn.View
{
    /// <summary>
    /// Renders voxel models to small transparent sprites (3/4 view) for menu cards, using a
    /// dedicated camera on its own layer. Results are cached by id.
    /// </summary>
    public static class Thumbs
    {
        const int Size = 160;
        static Camera cam;
        static RenderTexture rt;
        static Material lit, flat;
        static readonly Dictionary<string, Sprite> cache = new Dictionary<string, Sprite>();
        static readonly Vector3 Origin = new Vector3(0, -500, 0);

        /// <summary>The scene's directional light, disabled while rendering thumbnails.</summary>
        public static Light Sun;

        static void Init()
        {
            if (cam != null) return;
            var go = new GameObject("ThumbCamera");
            UnityEngine.Object.DontDestroyOnLoad(go);
            cam = go.AddComponent<Camera>();
            cam.enabled = false;
            cam.cullingMask = 1 << Gfx.ThumbLayer;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0, 0, 0, 0);
            cam.fieldOfView = 30;
            cam.nearClipPlane = 0.1f;
            cam.farClipPlane = 100;
            cam.allowHDR = false;
            cam.allowMSAA = true;
            rt = new RenderTexture(Size, Size, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            cam.targetTexture = rt;
            lit = Gfx.Voxel();
            flat = Gfx.Voxel();
            flat.SetColor("_Flat", new Color(0x14 / 255f, 0x12 / 255f, 0x1c / 255f, 1));
        }

        public static Sprite Get(string id, bool silhouette = false)
        {
            string key = id + (silhouette ? ":s" : "");
            if (cache.TryGetValue(key, out var hit)) return hit;
            var model = Content.GetModel(id) ?? Content.GetGroupModel("projectile", id) ?? Content.GetGroupModel("pickup", id) ?? Content.GetGroupModel("boss", id);
            if (model == null) return null;
            Init();
            var mesh = VoxelMesh.Build(model, -1);
            var b = mesh.bounds;
            var pivot = new GameObject("thumb");
            pivot.layer = Gfx.ThumbLayer;
            pivot.transform.position = Origin;
            // three.js pivot.rotation.y = -0.55 -> Unity +0.55 rad after the z mirror
            pivot.transform.rotation = Quaternion.Euler(0, 0.55f * Mathf.Rad2Deg, 0);
            var mgo = new GameObject("mesh");
            mgo.layer = Gfx.ThumbLayer;
            mgo.transform.SetParent(pivot.transform, false);
            mgo.transform.localPosition = -b.center;
            mgo.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = mgo.AddComponent<MeshRenderer>();
            mr.sharedMaterial = silhouette ? flat : lit;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mr.receiveShadows = false;
            float r = Math.Max(b.size.x, Math.Max(b.size.y, b.size.z)) * 0.62f + 0.05f;
            float dist = r / Mathf.Tan(cam.fieldOfView * Mathf.Deg2Rad / 2);
            // game camera at (0, d*0.32, d) -> Unity (0, d*0.32, -d)
            cam.transform.position = Origin + new Vector3(0, dist * 0.32f, -dist);
            cam.transform.rotation = Quaternion.LookRotation(Origin - cam.transform.position, Vector3.up);

            // studio lighting: hemisphere + key light, no fog or point lights
            Shader.SetGlobalVector("_CB_HemiSky", Gfx.Lin(0xffffff, 1.6));
            Shader.SetGlobalVector("_CB_HemiGround", Gfx.Lin(0x404050, 1.6));
            Shader.SetGlobalVector("_CB_SunCol", Gfx.Lin(0xffffff, 2.2));
            Shader.SetGlobalVector("_CB_SunDir", new Vector3(3, 6, -5).normalized);
            Shader.SetGlobalFloat("_CB_FogOn", 0);
            LightPool.Disable();
            bool sunOn = Sun != null && Sun.enabled;
            if (sunOn) Sun.enabled = false;
            cam.Render();
            if (sunOn) Sun.enabled = true;
            GameView.RestoreAtmosphere();

            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(Size, Size, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear };
            tex.ReadPixels(new Rect(0, 0, Size, Size), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;
            UnityEngine.Object.DestroyImmediate(pivot);
            UnityEngine.Object.Destroy(mesh);
            var s = Sprite.Create(tex, new Rect(0, 0, Size, Size), new Vector2(0.5f, 0.5f), 100);
            cache[key] = s;
            return s;
        }
    }
}
