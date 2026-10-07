using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Cubeborn.UI;

namespace Cubeborn.Controls
{
    /// <summary>
    /// Movement input (input/Input.ts): floating virtual stick (touch or mouse drag anywhere on
    /// the play area), keyboard (WASD / arrows) and gamepad. Produces a world direction where
    /// screen-up maps to -z.
    /// </summary>
    public class GameInput
    {
        public double x, z;
        public bool enabled;
        public Action onPause;
        /// <summary>Back button / Escape outside of a run (menus); returns true when handled.</summary>
        public Func<bool> onBack;
        /// <summary>Fired when the player first moves (used by the controls hint).</summary>
        public Action onFirstMove;

        readonly RectTransform area;
        readonly RectTransform stickBase, knob;
        int pointerId = int.MinValue;
        const int MouseId = -100;
        Vector2 o, s;
        float radius = 56;

        public GameInput(RectTransform area)
        {
            this.area = area;
            var b = Kit.Img(area, Kit.CircleSprite, new Color(1, 1, 1, 0.08f), "stickBase");
            stickBase = b.rectTransform;
            stickBase.anchorMin = stickBase.anchorMax = new Vector2(0, 0);
            stickBase.pivot = new Vector2(0.5f, 0.5f);
            var ring = Kit.Img(stickBase, Kit.CircleSprite, new Color(1, 1, 1, 0.22f), "ring");
            Kit.Stretch(ring.rectTransform, -2, -2, -2, -2);
            ring.transform.SetAsFirstSibling();
            var inner = Kit.Img(stickBase, Kit.CircleSprite, new Color(0.07f, 0.06f, 0.1f, 0.55f), "inner");
            Kit.Stretch(inner.rectTransform);
            var k = Kit.Img(stickBase, Kit.CircleSprite, new Color(1, 1, 1, 0.75f), "knob");
            knob = k.rectTransform;
            knob.anchorMin = knob.anchorMax = new Vector2(0.5f, 0.5f);
            knob.pivot = new Vector2(0.5f, 0.5f);
            stickBase.gameObject.SetActive(false);
        }

        Vector2 ToLocal(Vector2 screen)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(area, screen, null, out var p);
            // local is relative to the pivot; convert to bottom-left origin
            var r = area.rect;
            return p - r.min;
        }

        static bool OverUi(int id)
        {
            var es = EventSystem.current;
            if (es == null) return false;
            return id == MouseId ? es.IsPointerOverGameObject() : es.IsPointerOverGameObject(id);
        }

        void Down(int id, Vector2 screen)
        {
            if (!enabled || pointerId != int.MinValue) return;
            if (OverUi(id)) return;
            pointerId = id;
            o = s = ToLocal(screen);
            var r = area.rect;
            radius = Mathf.Max(44, Mathf.Min(70, Mathf.Min(r.width, r.height) * 0.11f));
            stickBase.sizeDelta = new Vector2(radius * 2, radius * 2);
            knob.sizeDelta = new Vector2(radius * 0.9f, radius * 0.9f);
            stickBase.anchoredPosition = o;
            stickBase.gameObject.SetActive(true);
            UpdateKnob();
        }

        void Move(Vector2 screen)
        {
            s = ToLocal(screen);
            var d = s - o;
            float len = d.magnitude, max = radius * 1.25f;
            if (len > max)
            {
                o = s - d / len * max;
                stickBase.anchoredPosition = o;
            }
            UpdateKnob();
        }

        void Release()
        {
            pointerId = int.MinValue;
            stickBase.gameObject.SetActive(false);
        }

        void UpdateKnob()
        {
            var d = s - o;
            if (d.magnitude > radius) d = d.normalized * radius;
            knob.anchoredPosition = d;
        }

        void PollPointers()
        {
            if (Input.touchCount > 0)
            {
                for (int i = 0; i < Input.touchCount; i++)
                {
                    var t = Input.GetTouch(i);
                    if (t.phase == TouchPhase.Began) Down(t.fingerId, t.position);
                    else if (t.fingerId == pointerId)
                    {
                        if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled) Release();
                        else Move(t.position);
                    }
                }
                return;
            }
            if (pointerId >= 0) Release(); // lost touch
            if (Input.GetMouseButtonDown(0)) Down(MouseId, Input.mousePosition);
            else if (pointerId == MouseId)
            {
                if (!Input.GetMouseButton(0)) Release();
                else Move(Input.mousePosition);
            }
        }

        /// <summary>Called once per frame from the app; handles pause / back keys too.</summary>
        public void Update()
        {
            if (Input.GetKeyDown(KeyCode.Escape) || Input.GetKeyDown(KeyCode.P) || Input.GetKeyDown(KeyCode.JoystickButton7))
            {
                bool esc = Input.GetKeyDown(KeyCode.Escape);
                if (enabled) onPause?.Invoke();
                else if (esc) onBack?.Invoke();
            }
            PollPointers();

            double ix = 0, iz = 0;
            if (pointerId != int.MinValue)
            {
                var d = s - o;
                float len = d.magnitude, dead = radius * 0.12f;
                if (len > dead)
                {
                    float m = Mathf.Min(1, (len - dead) / (radius * 0.7f));
                    ix = d.x / len * m;
                    iz = -d.y / len * m;
                }
            }
            if (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow)) ix -= 1;
            if (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow)) ix += 1;
            if (Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow)) iz -= 1;
            if (Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow)) iz += 1;
            float ax = 0, ay = 0;
            try
            {
                ax = Input.GetAxisRaw("Horizontal");
                ay = Input.GetAxisRaw("Vertical");
            }
            catch (Exception) { /* axes not configured */ }
            // keyboard already counted; only use the axes for analogue sticks
            if (Mathf.Abs(ax) + Mathf.Abs(ay) > 0.2f && ix == 0 && iz == 0)
            {
                ix += ax;
                iz -= ay;
            }
            double l = Math.Sqrt(ix * ix + iz * iz);
            if (l > 1)
            {
                ix /= l;
                iz /= l;
            }
            if (!enabled) ix = iz = 0;
            if ((ix != 0 || iz != 0) && onFirstMove != null)
            {
                var f = onFirstMove;
                onFirstMove = null;
                f();
            }
            x = ix;
            z = iz;
        }

        public void SetEnabled(bool on)
        {
            enabled = on;
            if (!on) Release();
        }

        public void ReleaseAll()
        {
            Release();
        }
    }
}
