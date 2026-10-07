// Voxel models, terrain blocks and decor. Vertex colour = sRGB albedo, alpha = glow flag.
// Per-instance colour multiplier (linear) and white hit flash for instanced enemies.
Shader "Cubeborn/Voxel"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Color", Color) = (1,1,1,1)
        _Flash ("Flash", Float) = 0
        _Unlit ("Unlit", Float) = 0
        _Dither ("Dither", Float) = 0
        _Sway ("Sway", Float) = 0
        _Flat ("Flat", Color) = (0,0,0,0)
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        Pass
        {
            Tags { "LightMode"="ForwardBase" }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #pragma multi_compile_fwdbase nolightmap nodirlightmap nodynlightmap novertexlight
            #pragma multi_compile_instancing
            #pragma instancing_options nolightprobe nolodfade
            #include "UnityCG.cginc"
            #include "AutoLight.cginc"
            #include "CubebornCommon.cginc"

            sampler2D _MainTex;
            float _Unlit;
            float _Dither;
            float _Sway;
            float4 _Flat;

            UNITY_INSTANCING_BUFFER_START(Props)
                UNITY_DEFINE_INSTANCED_PROP(float4, _Color)
                UNITY_DEFINE_INSTANCED_PROP(float, _Flash)
            UNITY_INSTANCING_BUFFER_END(Props)

            struct appdata
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
                float4 color : COLOR;
                float2 uv : TEXCOORD0;
                float3 sway : TEXCOORD1;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float2 uv : TEXCOORD0;
                float3 wpos : TEXCOORD1;
                float3 wnorm : TEXCOORD2;
                float4 col : TEXCOORD3;
                float2 fx : TEXCOORD4;
                SHADOW_COORDS(5)
            };

            v2f vert(appdata v)
            {
                UNITY_SETUP_INSTANCE_ID(v);
                v2f o;
                UNITY_INITIALIZE_OUTPUT(v2f, o);
                if (_Sway > 0.5)
                {
                    v.vertex.x += sin(_CB_Time * 2.2 + v.sway.x) * v.sway.y;
                    v.vertex.z -= cos(_CB_Time * 1.7 + v.sway.x) * v.sway.z;
                }
                o.pos = UnityObjectToClipPos(v.vertex);
                o.wpos = mul(unity_ObjectToWorld, v.vertex).xyz;
                o.wnorm = UnityObjectToWorldNormal(v.normal);
                float4 c = UNITY_ACCESS_INSTANCED_PROP(Props, _Color);
                o.col = float4(SrgbToLin(v.color.rgb) * c.rgb, v.color.a);
                o.uv = v.uv;
                o.fx = float2(UNITY_ACCESS_INSTANCED_PROP(Props, _Flash), -UnityObjectToViewPos(v.vertex.xyz).z);
                TRANSFER_SHADOW(o);
                return o;
            }

            float4 frag(v2f i) : SV_Target
            {
                if (_Flat.a > 0.5) return float4(_Flat.rgb, 1.0);
                if (_Dither > 0.5)
                {
                    // blocks between the camera and the hero dissolve with an ordered dither
                    float3 w = float3(i.wpos.x, i.wpos.y, -i.wpos.z);
                    float2 dd = w.xz - (_CB_Focus.xz + float2(0.0, 2.2));
                    dd.y *= 0.75;
                    float pd = length(dd);
                    if (w.y > 1.2 && pd < 5.0 && w.z > _CB_Focus.z - 0.6)
                    {
                        float k = (1.0 - smoothstep(3.0, 5.0, pd)) * saturate(w.y - 1.2) * 0.85;
                        const float4x4 bayer = float4x4(0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
                        int ix = (int)fmod(floor(i.pos.x), 4.0);
                        int iy = (int)fmod(floor(i.pos.y), 4.0);
                        if (bayer[iy][ix] / 16.0 < k) discard;
                    }
                }
                float4 tex = tex2D(_MainTex, i.uv);
                float3 albedo = SrgbToLin(tex.rgb) * i.col.rgb;
                float3 outc;
                if (_Unlit > 0.5)
                {
                    outc = albedo;
                }
                else
                {
                    float shadow = SHADOW_ATTENUATION(i);
                    outc = albedo * CBLight(normalize(i.wnorm), i.wpos, shadow);
                    outc = lerp(outc, albedo * 1.35, i.col.a);
                    outc = lerp(outc, float3(1.0, 0.97, 0.92), saturate(i.fx.x));
                }
                return float4(CBFog(LinToSrgb(outc), i.fx.y), 1.0);
            }
            ENDCG
        }

        Pass
        {
            Tags { "LightMode"="ShadowCaster" }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #pragma multi_compile_shadowcaster
            #pragma multi_compile_instancing
            #pragma instancing_options nolightprobe nolodfade
            #include "UnityCG.cginc"

            struct v2f
            {
                V2F_SHADOW_CASTER;
            };

            v2f vert(appdata_base v)
            {
                UNITY_SETUP_INSTANCE_ID(v);
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
