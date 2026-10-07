// Additive unlit glows (beams, rings, telegraphs, sparks). Instance colour is linear * brightness.
Shader "Cubeborn/Glow"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Color", Color) = (1,1,1,1)
        _UseTex ("Use texture", Float) = 0
        [Enum(UnityEngine.Rendering.CompareFunction)] _ZTest ("ZTest", Float) = 4
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
        Blend SrcAlpha One
        ZWrite Off
        Cull Off
        ZTest [_ZTest]
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #pragma multi_compile_instancing
            #pragma instancing_options nolightprobe nolodfade
            #include "UnityCG.cginc"
            #include "CubebornCommon.cginc"

            sampler2D _MainTex;
            float _UseTex;

            UNITY_INSTANCING_BUFFER_START(Props)
                UNITY_DEFINE_INSTANCED_PROP(float4, _Color)
            UNITY_INSTANCING_BUFFER_END(Props)

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float2 uv : TEXCOORD0;
                float3 col : TEXCOORD1;
            };

            v2f vert(appdata v)
            {
                UNITY_SETUP_INSTANCE_ID(v);
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv;
                o.col = UNITY_ACCESS_INSTANCED_PROP(Props, _Color).rgb;
                return o;
            }

            float4 frag(v2f i) : SV_Target
            {
                float3 c = i.col;
                float a = 1.0;
                if (_UseTex > 0.5)
                {
                    float4 t = tex2D(_MainTex, i.uv);
                    c *= t.rgb;
                    a = t.a;
                }
                return float4(LinToSrgb(c), a);
            }
            ENDCG
        }
    }
}
