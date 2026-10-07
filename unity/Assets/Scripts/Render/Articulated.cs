using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Cubeborn.View
{
    public struct PoseInput
    {
        public double walk, moving, attack, cast, time, flash;
    }

    /// <summary>
    /// Voxel model split into tagged parts parented at their pivots so limbs, wings, heads and jaws
    /// can rotate. Used for the hero, bosses and the menu showcase.
    /// </summary>
    public class Articulated
    {
        public readonly GameObject root;
        public readonly Transform body;
        readonly Dictionary<string, Transform> parts = new Dictionary<string, Transform>();
        readonly Material material;
        readonly List<Mesh> meshes = new List<Mesh>();
        /// <summary>Current yaw in game radians (applied with Gfx.Yaw).</summary>
        public double yaw, roll;

        public Articulated(VoxelModel model, bool castShadow, Transform parent = null)
        {
            root = new GameObject("model");
            if (parent != null) root.transform.SetParent(parent, false);
            body = new GameObject("body").transform;
            body.SetParent(root.transform, false);
            material = Gfx.Voxel();
            float s = model.scale;
            AddMesh(body, VoxelMesh.Build(model, -1, ""), castShadow);
            foreach (var tag in VoxelMesh.Tags)
            {
                if (!VoxelMesh.HasTag(model, tag)) continue;
                var pv = VoxelMesh.PartPivot(model, tag);
                var pivot = new GameObject(tag).transform;
                pivot.SetParent(body, false);
                pivot.localPosition = new Vector3(pv.x * s, pv.y * s, -pv.z * s);
                AddMesh(pivot, VoxelMesh.Build(model, -1, tag, pv), castShadow);
                parts[tag] = pivot;
            }
        }

        void AddMesh(Transform parent, Mesh mesh, bool castShadow)
        {
            meshes.Add(mesh);
            var go = new GameObject("mesh");
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = material;
            r.shadowCastingMode = castShadow ? ShadowCastingMode.On : ShadowCastingMode.Off;
            r.receiveShadows = true;
            r.lightProbeUsage = LightProbeUsage.Off;
            r.reflectionProbeUsage = ReflectionProbeUsage.Off;
        }

        public void SetLayer(int layer)
        {
            foreach (var t in root.GetComponentsInChildren<Transform>(true)) t.gameObject.layer = layer;
        }

        public bool visible
        {
            get => root.activeSelf;
            set { if (root.activeSelf != value) root.SetActive(value); }
        }

        public void Place(double x, double y, double z, double scale = 1)
        {
            root.transform.localPosition = Gfx.U(x, y, z);
            root.transform.localRotation = Quaternion.Euler(0, (float)(-yaw * Mathf.Rad2Deg), (float)(roll * Mathf.Rad2Deg));
            root.transform.localScale = new Vector3((float)scale, (float)scale, (float)scale);
        }

        // Game-space part rotations: x -> Euler(-x), y -> Euler(-y), z -> Euler(z) after the z mirror.
        void Rot(string tag, double rx, double ry, double rz)
        {
            if (parts.TryGetValue(tag, out var t))
                t.localRotation = Quaternion.Euler((float)(-rx * Mathf.Rad2Deg), (float)(-ry * Mathf.Rad2Deg), (float)(rz * Mathf.Rad2Deg));
        }

        public void Pose(PoseInput p)
        {
            double sw = Math.Sin(p.walk) * 0.7 * p.moving;
            Rot("legL", sw, 0, 0);
            Rot("legR", -sw, 0, 0);
            double castLift = p.cast * 2.4;
            Rot("armL", -sw * 0.8 - castLift, 0, -p.cast * 0.4);
            Rot("armR", sw * 0.8 - castLift - p.attack * 1.6, 0, p.cast * 0.4);
            double flap = Math.Sin(p.time * 9) * 0.55;
            Rot("wingL", 0, 0, flap + 0.1);
            Rot("wingR", 0, 0, -flap - 0.1);
            Rot("head", Math.Sin(p.time * 1.8) * 0.04 - p.cast * 0.15, 0, 0);
            Rot("tail", 0, Math.Sin(p.time * 4) * 0.4, 0);
            Rot("jaw", Math.Max(0, Math.Sin(p.time * 3)) * 0.3 + p.cast * 0.5, 0, 0);
            body.localPosition = new Vector3(0, (float)(Math.Abs(Math.Sin(p.walk)) * 0.06 * p.moving), 0);
            body.localScale = new Vector3(1, (float)(1 + Math.Sin(p.time * 2.2) * 0.015 * (1 - p.moving)), 1);
            material.SetFloat(Gfx.FlashId, (float)p.flash);
        }

        public void Destroy()
        {
            UnityEngine.Object.Destroy(root);
            UnityEngine.Object.Destroy(material);
            foreach (var m in meshes) UnityEngine.Object.Destroy(m);
        }
    }
}
