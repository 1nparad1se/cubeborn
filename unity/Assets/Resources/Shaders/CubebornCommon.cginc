// Shared lighting for Cubeborn. Mirrors the three.js Lambert pipeline of the web build:
// colours are linearised, lit by a hemisphere light, one directional sun and up to six
// point lights, then encoded to sRGB in the shader (the project runs in Gamma space so
// blending happens on encoded values, like WebGL) and fogged in sRGB.
#ifndef CUBEBORN_COMMON
#define CUBEBORN_COMMON

float3 _CB_HemiSky;
float3 _CB_HemiGround;
float3 _CB_SunCol;
float3 _CB_SunDir;
float4 _CB_FogCol;
float _CB_FogNear;
float _CB_FogFar;
float _CB_FogOn;
float4 _CB_PLPos[6];
float4 _CB_PLCol[6];
float _CB_PLCount;
float _CB_Time;
float _CB_Surge;
float4 _CB_Focus;

float3 SrgbToLin(float3 c)
{
    c = max(c, 0.0);
    float3 lo = c / 12.92;
    float3 hi = pow((c + 0.055) / 1.055, 2.4);
    return lerp(hi, lo, step(c, 0.04045));
}

float3 LinToSrgb(float3 c)
{
    c = max(c, 0.0);
    float3 lo = c * 12.92;
    float3 hi = 1.055 * pow(c, 1.0 / 2.4) - 0.055;
    return lerp(hi, lo, step(c, 0.0031308));
}

// Irradiance * BRDF_Lambert (1/PI), multiply by the linear albedo.
float3 CBLight(float3 n, float3 wpos, float shadow)
{
    float3 irr = lerp(_CB_HemiGround, _CB_HemiSky, 0.5 * n.y + 0.5);
    irr += _CB_SunCol * saturate(dot(n, _CB_SunDir)) * shadow;
    int cnt = (int)_CB_PLCount;
    for (int k = 0; k < 6; k++)
    {
        if (k < cnt)
        {
            float3 L = _CB_PLPos[k].xyz - wpos;
            float d = max(length(L), 0.0001);
            float fall = 1.0 / max(pow(d, 1.6), 0.01);
            float q = saturate(1.0 - pow(d / _CB_PLPos[k].w, 4.0));
            fall *= q * q;
            irr += _CB_PLCol[k].rgb * fall * saturate(dot(n, L / d));
        }
    }
    return irr * 0.31830988618;
}

float3 CBFog(float3 srgb, float depth)
{
    float f = smoothstep(_CB_FogNear, _CB_FogFar, depth) * _CB_FogOn;
    return lerp(srgb, _CB_FogCol.rgb, f);
}

#endif
