using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Cubeborn.UI
{
    /// <summary>Tiny code-only UGUI toolkit: palette, fonts, generated sprites and layout helpers.</summary>
    public static class Kit
    {
        // palette (style.css :root)
        public static readonly Color Bg = C(0x120f1a), Panel = C(0x1d1828), Panel2 = C(0x272035), Edge = C(0x3d3352), EdgeHi = C(0x5a4c78);
        public static readonly Color Text = C(0xece6f6), Dim = C(0xa59bb8), Gold = C(0xffd23d), Green = C(0x5ad66a), GreenDk = C(0x2f8a3e);
        public static readonly Color Red = C(0xff4a5a), Blue = C(0x5ab4ff), Ink = C(0x0b0910);

        public static Font Px, Ui, UiBold;
        public static Sprite RoundSprite, BtnSprite, PanelSprite, CircleSprite, ArrowSprite, BarSprite, FrameSprite;

        public static Color C(int hex, float a = 1) => new Color(((hex >> 16) & 255) / 255f, ((hex >> 8) & 255) / 255f, (hex & 255) / 255f, a);

        public static void Init()
        {
            if (Px != null) return;
            Px = Resources.Load<Font>("Fonts/PressStart2P");
            Ui = Resources.Load<Font>("Fonts/Rubik-Medium");
            UiBold = Resources.Load<Font>("Fonts/Rubik-Bold");
            if (Ui == null) Ui = Font.CreateDynamicFontFromOSFont("Arial", 16);
            if (UiBold == null) UiBold = Ui;
            if (Px == null) Px = UiBold;
            RoundSprite = MakeRound(16, 5, false, false);
            PanelSprite = MakeRound(16, 5, true, false);
            BtnSprite = MakeRound(16, 4, true, true);
            FrameSprite = MakeFrame();
            BarSprite = MakeRound(8, 2, false, false);
            CircleSprite = MakeCircle(64);
            ArrowSprite = MakeArrow();
        }

        // ------------------------------------------------------------ generated sprites

        static Texture2D Tex(int w, int h)
        {
            return new Texture2D(w, h, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
        }

        /// <summary>Rounded rectangle, optionally with a dark outline and a bottom bevel (button look).</summary>
        static Sprite MakeRound(int size, int radius, bool outline, bool bevel)
        {
            int S = size;
            var t = Tex(S, S);
            var px = new Color32[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float dx = Math.Max(0, Math.Max(radius - 0.5f - x, x - (S - radius - 0.5f)));
                    float dy = Math.Max(0, Math.Max(radius - 0.5f - y, y - (S - radius - 0.5f)));
                    float d = Mathf.Sqrt(dx * dx + dy * dy);
                    if (d > radius) { px[y * S + x] = new Color32(0, 0, 0, 0); continue; }
                    Color c = Color.white;
                    if (outline && (d > radius - 1.5f || x == 0 || y == 0 || x == S - 1 || y == S - 1)) c = Ink;
                    else if (bevel && y <= 3) c = new Color(0.62f, 0.62f, 0.66f);
                    else if (bevel && y == S - 3) c = new Color(1.08f, 1.08f, 1.08f);
                    px[y * S + x] = c;
                }
            t.SetPixels32(px);
            t.Apply();
            int b = radius + 1;
            return Sprite.Create(t, new Rect(0, 0, S, S), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(b, b + (bevel ? 2 : 0), b, b));
        }

        /// <summary>Hollow 2px frame (selection highlight).</summary>
        static Sprite MakeFrame()
        {
            int S = 16;
            var t = Tex(S, S);
            var px = new Color32[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    bool edge = x < 2 || y < 2 || x >= S - 2 || y >= S - 2;
                    bool corner = (x < 2 || x >= S - 2) && (y < 2 || y >= S - 2) && (x == 0 || x == S - 1) && (y == 0 || y == S - 1);
                    px[y * S + x] = edge && !corner ? new Color32(255, 255, 255, 255) : new Color32(0, 0, 0, 0);
                }
            t.SetPixels32(px);
            t.Apply();
            return Sprite.Create(t, new Rect(0, 0, S, S), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(3, 3, 3, 3));
        }

        static Sprite MakeCircle(int S)
        {
            var t = Tex(S, S);
            t.filterMode = FilterMode.Bilinear;
            var px = new Color32[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float d = Mathf.Sqrt((x + 0.5f - S / 2f) * (x + 0.5f - S / 2f) + (y + 0.5f - S / 2f) * (y + 0.5f - S / 2f));
                    float a = Mathf.Clamp01(S / 2f - d);
                    px[y * S + x] = new Color32(255, 255, 255, (byte)(a * 255));
                }
            t.SetPixels32(px);
            t.Apply();
            return Sprite.Create(t, new Rect(0, 0, S, S), new Vector2(0.5f, 0.5f));
        }

        /// <summary>Arrow pointing to +x (off-screen indicators).</summary>
        static Sprite MakeArrow()
        {
            int S = 32;
            var t = Tex(S, S);
            t.filterMode = FilterMode.Bilinear;
            var px = new Color32[S * S];
            // polygon (12,0) (-6,-8) (-2,0) (-6,8) scaled x1.4 around the centre, dark outline
            Vector2[] poly = { new Vector2(12, 0), new Vector2(-6, -8), new Vector2(-2, 0), new Vector2(-6, 8) };
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    var p = new Vector2((x + 0.5f - S / 2f) / 1.25f, (y + 0.5f - S / 2f) / 1.25f);
                    bool inside = Inside(poly, p);
                    bool near = !inside && (Inside(poly, p + new Vector2(1.2f, 0)) || Inside(poly, p - new Vector2(1.2f, 0)) || Inside(poly, p + new Vector2(0, 1.2f)) || Inside(poly, p - new Vector2(0, 1.2f)));
                    px[y * S + x] = inside ? new Color32(255, 255, 255, 255) : near ? new Color32(0, 0, 0, 210) : new Color32(0, 0, 0, 0);
                }
            t.SetPixels32(px);
            t.Apply();
            return Sprite.Create(t, new Rect(0, 0, S, S), new Vector2(0.5f, 0.5f));
        }

        static bool Inside(Vector2[] poly, Vector2 p)
        {
            bool c = false;
            for (int i = 0, j = poly.Length - 1; i < poly.Length; j = i++)
                if ((poly[i].y > p.y) != (poly[j].y > p.y) && p.x < (poly[j].x - poly[i].x) * (p.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) c = !c;
            return c;
        }

        // ------------------------------------------------------------ element helpers

        public static RectTransform Rect(Transform parent, string name = "rect")
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.layer = 5;
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            return rt;
        }

        public static RectTransform Stretch(RectTransform rt, float l = 0, float t = 0, float r = 0, float b = 0)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(l, b);
            rt.offsetMax = new Vector2(-r, -t);
            return rt;
        }

        /// <summary>Anchors a rect at a normalised point with a fixed size.</summary>
        public static RectTransform Place(RectTransform rt, float ax, float ay, float w, float h, float x = 0, float y = 0, float px = -1, float py = -1)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(ax, ay);
            rt.pivot = new Vector2(px < 0 ? ax : px, py < 0 ? ay : py);
            rt.sizeDelta = new Vector2(w, h);
            rt.anchoredPosition = new Vector2(x, y);
            return rt;
        }

        public static Image Img(Transform parent, Sprite sprite, Color color, string name = "img")
        {
            var rt = Rect(parent, name);
            var img = rt.gameObject.AddComponent<Image>();
            img.sprite = sprite;
            img.color = color;
            if (sprite != null && sprite.border != Vector4.zero)
            {
                img.type = Image.Type.Sliced;
                img.pixelsPerUnitMultiplier = 0.6f;
            }
            img.raycastTarget = false;
            return img;
        }

        public static Image Box(Transform parent, Color color, Sprite sprite = null, string name = "box")
        {
            var img = Img(parent, sprite ?? RoundSprite, color, name);
            return img;
        }

        public static Text Txt(Transform parent, string text, int size, Color color, Font font = null, TextAnchor align = TextAnchor.MiddleLeft, string name = "text")
        {
            var rt = Rect(parent, name);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = font ?? Ui;
            t.fontSize = size;
            t.color = color;
            t.alignment = align;
            t.text = text ?? "";
            t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.supportRichText = true;
            t.lineSpacing = 1.1f;
            return t;
        }

        public static Outline Stroke(Graphic g, Color c, float d = 1.5f)
        {
            var o = g.gameObject.AddComponent<Outline>();
            o.effectColor = c;
            o.effectDistance = new Vector2(d, -d);
            return o;
        }

        public static Shadow Drop(Graphic g, Color c, float x = 0, float y = -2)
        {
            var s = g.gameObject.AddComponent<Shadow>();
            s.effectColor = c;
            s.effectDistance = new Vector2(x, y);
            return s;
        }

        public enum BtnStyle { Normal, Primary, Danger, Ghost }

        public static Color StyleColor(BtnStyle s) => s == BtnStyle.Primary ? Green : s == BtnStyle.Danger ? Red : s == BtnStyle.Ghost ? new Color(1, 1, 1, 0.08f) : Panel2;
        public static Color StyleText(BtnStyle s) => s == BtnStyle.Primary ? C(0x0d1a0f) : s == BtnStyle.Danger ? C(0x1a0a0c) : Text;

        /// <summary>Pixel-font button with the chunky bevel look; label may be null.</summary>
        public static Button Btn(Transform parent, string label, Action onClick, BtnStyle style = BtnStyle.Normal, int fontSize = 11, string name = "btn")
        {
            var rt = Rect(parent, name);
            var img = rt.gameObject.AddComponent<Image>();
            img.sprite = BtnSprite;
            img.type = Image.Type.Sliced;
            img.pixelsPerUnitMultiplier = 0.6f;
            img.color = StyleColor(style);
            var b = rt.gameObject.AddComponent<Button>();
            var cb = b.colors;
            cb.highlightedColor = new Color(1.12f, 1.12f, 1.12f);
            cb.pressedColor = new Color(0.8f, 0.8f, 0.8f);
            cb.disabledColor = new Color(0.55f, 0.55f, 0.55f, 0.8f);
            cb.fadeDuration = 0.05f;
            b.colors = cb;
            b.targetGraphic = img;
            if (onClick != null) b.onClick.AddListener(() => onClick());
            rt.gameObject.AddComponent<PressSink>();
            if (label != null)
            {
                var t = Txt(rt, label.ToUpperInvariant(), fontSize, StyleText(style), Px, TextAnchor.MiddleCenter, "label");
                Stretch(t.rectTransform, 8, 4, 8, 6);
            }
            return b;
        }

        public static Text Label(Button b) => b.transform.Find("label")?.GetComponent<Text>();

        public static void SetStyle(Button b, BtnStyle s)
        {
            b.targetGraphic.color = StyleColor(s);
            var l = Label(b);
            if (l != null) l.color = StyleText(s);
        }

        /// <summary>Invisible full-area clickable (cards, cells).</summary>
        public static Button Clickable(RectTransform rt, Action onClick)
        {
            var g = rt.GetComponent<Graphic>();
            if (g == null)
            {
                var img = rt.gameObject.AddComponent<Image>();
                img.color = new Color(0, 0, 0, 0);
                g = img;
            }
            g.raycastTarget = true;
            var b = rt.gameObject.AddComponent<Button>();
            b.transition = Selectable.Transition.None;
            b.onClick.AddListener(() => onClick());
            rt.gameObject.AddComponent<PressSink>();
            return b;
        }

        public static LayoutElement LE(Component c, float prefW = -1, float prefH = -1, float flexW = -1, float flexH = -1, float minW = -1, float minH = -1)
        {
            var le = c.gameObject.GetComponent<LayoutElement>() ?? c.gameObject.AddComponent<LayoutElement>();
            le.preferredWidth = prefW;
            le.preferredHeight = prefH;
            le.flexibleWidth = flexW;
            le.flexibleHeight = flexH;
            le.minWidth = minW;
            le.minHeight = minH;
            return le;
        }

        public static VerticalLayoutGroup VBox(Transform parent, float spacing = 6, int pad = 0, TextAnchor align = TextAnchor.UpperLeft, string name = "vbox", bool expandW = true)
        {
            var rt = Rect(parent, name);
            var g = rt.gameObject.AddComponent<VerticalLayoutGroup>();
            g.spacing = spacing;
            g.padding = new RectOffset(pad, pad, pad, pad);
            g.childAlignment = align;
            g.childControlWidth = true;
            g.childControlHeight = true;
            g.childForceExpandWidth = expandW;
            g.childForceExpandHeight = false;
            return g;
        }

        public static HorizontalLayoutGroup HBox(Transform parent, float spacing = 6, int pad = 0, TextAnchor align = TextAnchor.MiddleLeft, string name = "hbox")
        {
            var rt = Rect(parent, name);
            var g = rt.gameObject.AddComponent<HorizontalLayoutGroup>();
            g.spacing = spacing;
            g.padding = new RectOffset(pad, pad, pad, pad);
            g.childAlignment = align;
            g.childControlWidth = true;
            g.childControlHeight = true;
            g.childForceExpandWidth = false;
            g.childForceExpandHeight = false;
            return g;
        }

        public static GridLayoutGroup Grid(Transform parent, float cw, float ch, float spacing = 6, string name = "grid")
        {
            var rt = Rect(parent, name);
            var g = rt.gameObject.AddComponent<GridLayoutGroup>();
            g.cellSize = new Vector2(cw, ch);
            g.spacing = new Vector2(spacing, spacing);
            g.childAlignment = TextAnchor.UpperLeft;
            return g;
        }

        public static ContentSizeFitter FitV(Component c)
        {
            var f = c.gameObject.GetComponent<ContentSizeFitter>() ?? c.gameObject.AddComponent<ContentSizeFitter>();
            f.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            return f;
        }

        public static ContentSizeFitter FitBoth(Component c)
        {
            var f = FitV(c);
            f.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
            return f;
        }

        /// <summary>Vertical scroll view filling its parent; returns the content rect (a VBox).</summary>
        public static RectTransform Scroll(Transform parent, out ScrollRect sr, float spacing = 6, int pad = 0, string name = "scroll")
        {
            var view = Rect(parent, name);
            var bg = view.gameObject.AddComponent<Image>();
            bg.color = new Color(0, 0, 0, 0);
            bg.raycastTarget = true;
            view.gameObject.AddComponent<RectMask2D>();
            sr = view.gameObject.AddComponent<ScrollRect>();
            sr.horizontal = false;
            sr.vertical = true;
            sr.movementType = ScrollRect.MovementType.Clamped;
            sr.scrollSensitivity = 30;
            sr.inertia = true;
            sr.decelerationRate = 0.12f;
            var content = VBox(view, spacing, pad, TextAnchor.UpperLeft, "content");
            var crt = (RectTransform)content.transform;
            crt.anchorMin = new Vector2(0, 1);
            crt.anchorMax = new Vector2(1, 1);
            crt.pivot = new Vector2(0.5f, 1);
            crt.offsetMin = crt.offsetMax = Vector2.zero;
            FitV(content);
            sr.content = crt;
            sr.viewport = view;
            return crt;
        }

        public static void Clear(Transform t)
        {
            for (int i = t.childCount - 1; i >= 0; i--)
            {
                var c = t.GetChild(i).gameObject;
                c.SetActive(false);
                UnityEngine.Object.Destroy(c);
            }
        }

        public static string Hex(int c) => "#" + (c & 0xffffff).ToString("x6");
        public static string Col(string text, Color c) => "<color=#" + ColorUtility.ToHtmlStringRGB(c) + ">" + text + "</color>";
    }

    /// <summary>Plays the UI sound and a small press offset for any clickable.</summary>
    public class PressSink : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
    {
        Vector3 basePos;
        bool down;

        public void OnPointerDown(PointerEventData e)
        {
            if (down) return;
            down = true;
            basePos = transform.localScale;
            transform.localScale = basePos * 0.96f;
        }

        public void OnPointerUp(PointerEventData e) => Release();
        public void OnPointerExit(PointerEventData e) => Release();

        void Release()
        {
            if (!down) return;
            down = false;
            transform.localScale = basePos;
        }

        void OnDisable() => Release();
    }
}
