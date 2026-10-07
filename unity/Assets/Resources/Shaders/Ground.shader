// Ground plane: per-cell tile ids in _Cells pick 16px pixel-art tiles from _Atlas.
// Water/lava/bog/void scroll, runes pulse, liquids sparkle (emissive).
Shader "Cubeborn/Ground"
{
    Properties
    {
        _Cells ("Cells", 2D) = "black" {}
        _Atlas ("Atlas", 2D) = "white" {}
        _Size ("Size", Float) = 64
        _Tiles ("Tiles", Float) = 1
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry-10" }
        Pass
        {
            Tags { "LightMode"="ForwardBase" }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #pragma multi_compile_fwdbase nolightmap nodirlightmap nodynlightmap novertexlight
            #include "UnityCG.cginc"
            #include "AutoLight.cginc"
            #include "CubebornCommon.cginc"

            sampler2D _Cells;
            sampler2D _Atlas;
            float _Size;
            float _Tiles;
            float _Anim[32];

            struct appdata
            {
                float4 vertex : POSITION;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float3 wpos : TEXCOORD0;
                float depth : TEXCOORD1;
                SHADOW_COORDS(2)
            };

            v2f vert(appdata v)
            {
                v2f o;
                UNITY_INITIALIZE_OUTPUT(v2f, o);
                o.pos = UnityObjectToClipPos(v.vertex);
                o.wpos = mul(unity_ObjectToWorld, v.vertex).xyz;
                o.depth = -UnityObjectToViewPos(v.vertex.xyz).z;
                TRANSFER_SHADOW(o);
                return o;
            }

            float4 frag(v2f i) : SV_Target
            {
                float2 wxz = float2(i.wpos.x, -i.wpos.z);
                float2 cell = floor(wxz);
                float2 local = frac(wxz);
                float4 cd = tex2D(_Cells, (cell + 0.5) / _Size);
                float tile = floor(cd.r * 255.0 + 0.5);
                float variant = floor(cd.g * 255.0 + 0.5);
                float anim = _Anim[(int)clamp(tile, 0.0, 31.0)];
                float2 l = local;
                if (anim > 0.5 && anim < 4.5)
                {
                    float sp = anim == 2.0 ? 0.08 : 0.18;
                    l = frac(local + float2(floor(_CB_Time * sp * 16.0) / 16.0, floor(_CB_Time * sp * 8.0) / 16.0));
                }
                float2 auv = float2((tile + l.x) / _Tiles, 1.0 - (variant + l.y) / 4.0);
                float3 texel = SrgbToLin(tex2D(_Atlas, auv).rgb);
                float px = floor(local.x * 16.0);
                float py = floor(local.y * 16.0);
                float spark = step(0.985, frac(sin(dot(float2(px, py) + cell * 17.0 + floor(_CB_Time * 2.0), float2(12.9898, 78.233))) * 43758.5453));
                float3 emit = float3(0, 0, 0);
                if (anim == 1.0) emit = texel * 0.15 + float3(0.6, 0.8, 1.0) * spark * 0.5;
                if (anim == 2.0) emit = texel * (0.85 + 0.15 * sin(_CB_Time * 2.0 + cell.x * 0.7)) + float3(1.0, 0.8, 0.3) * spark * 0.6;
                if (anim == 3.0) emit = texel * 0.35 + float3(0.7, 1.0, 0.4) * spark * 0.4;
                if (anim == 4.0) emit = float3(0.35, 0.15, 0.8) * spark + texel * 0.2;
                if (anim == 5.0) emit = texel * (0.5 + 0.5 * sin(_CB_Time * 3.0)) * (0.6 + _CB_Surge * 1.5);
                if (anim == 6.0) emit = float3(0.8, 0.95, 1.0) * spark * 0.3;
                float shadow = SHADOW_ATTENUATION(i);
                float3 outc = texel * CBLight(float3(0, 1, 0), i.wpos, shadow) + emit;
                return float4(CBFog(LinToSrgb(outc), i.depth), 1.0);
            }
            ENDCG
        }

        Pass
        {
            Tags { "LightMode"="ShadowCaster" }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_shadowcaster
            #include "UnityCG.cginc"

            struct v2f
            {
                V2F_SHADOW_CASTER;
            };

            v2f vert(appdata_base v)
            {
                v2f o;
                TRANSFER_SHADOW_CASTER_NORMALOFFSET(o)
                return o;
            }

            float4 frag(v2f i) : SV_Target
            {
                SHADOW_CASTER_FRAGMENT(i)
            }
            ENDCG
        }
    }
}
