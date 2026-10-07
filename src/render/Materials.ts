import * as THREE from 'three';

export interface VoxelMatOptions {
  map?: THREE.Texture;
  instanced?: boolean;
  /** Adds a uniform flash amount (for single meshes like the hero/bosses). */
  flashUniform?: { value: number };
  transparent?: boolean;
  opacity?: number;
  /** Fresnel rim light strength (hero models): separates them from the ground and crowds. */
  rim?: number | { value: number };
}

/**
 * Lambert material for voxel models: vertex colors, block texture, emissive "glow" vertices and
 * a per-instance (aFlash attribute) or per-mesh (uniform) white hit flash.
 */
export function makeVoxelMaterial(o: VoxelMatOptions = {}): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: o.map ?? null, transparent: !!o.transparent, opacity: o.opacity ?? 1 });
  const rim = o.rim === undefined ? null : typeof o.rim === 'number' ? { value: o.rim } : o.rim;
  mat.onBeforeCompile = (shader) => {
    if (o.flashUniform) shader.uniforms.uFlash = o.flashUniform;
    if (rim) shader.uniforms.uRim = rim;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aGlow;
varying float vGlow;
varying float vFlash;
${o.instanced ? 'attribute float aFlash;' : ''}
${o.flashUniform ? 'uniform float uFlash;' : ''}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vGlow = aGlow;
vFlash = ${o.instanced ? 'aFlash' : o.flashUniform ? 'uFlash' : '0.0'};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vGlow;\nvarying float vFlash;${rim ? '\nuniform float uRim;' : ''}`)
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
gl_FragColor.rgb = mix(gl_FragColor.rgb, diffuseColor.rgb * 1.35, vGlow);
${rim ? 'float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);\ngl_FragColor.rgb += vec3(1.0, 0.95, 0.85) * rimF * uRim;' : ''}
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.97, 0.92), clamp(vFlash, 0.0, 1.0));`,
      );
  };
  mat.customProgramCacheKey = () => `vox-${o.instanced ? 'i' : 'm'}-${o.flashUniform ? 'u' : ''}-${rim ? 'r' : ''}`;
  return mat;
}

/** Unlit additive material for glows, beams and telegraphs (instance color = intensity). */
export function makeGlowMaterial(map?: THREE.Texture, depthTest = true): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: map ?? null,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest,
    side: THREE.DoubleSide,
  });
}

/** Unlit opaque material with vertex colors (projectiles, glowing blocks). */
export function makeUnlitMaterial(map?: THREE.Texture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ vertexColors: true, map: map ?? null });
}
