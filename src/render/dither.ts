/** Ordered-dither fade for geometry between the camera and the hero. */
export const DITHER = `
vec2 toCam = uCamDir;
vec2 rel = vWPos.xz - uFocus.xz;
float ahead = dot(rel, toCam);
vec2 dd = vec2(dot(rel, vec2(-toCam.y, toCam.x)), (ahead - 2.2) * 0.75);
float pd = length(dd);
float relY = vWPos.y - uFocus.y;
if (relY > 1.2 && pd < 5.0 && ahead > -0.6) {
  float k = (1.0 - smoothstep(3.0, 5.0, pd)) * clamp((relY - 1.2) / 1.0, 0.0, 1.0) * 0.85;
  int ix = int(mod(gl_FragCoord.x, 4.0)); int iy = int(mod(gl_FragCoord.y, 4.0));
  float bayer = (ix == 0 ? (iy == 0 ? 0.0 : iy == 1 ? 12.0 : iy == 2 ? 3.0 : 15.0) : ix == 1 ? (iy == 0 ? 8.0 : iy == 1 ? 4.0 : iy == 2 ? 11.0 : 7.0) : ix == 2 ? (iy == 0 ? 2.0 : iy == 1 ? 14.0 : iy == 2 ? 1.0 : 13.0) : (iy == 0 ? 10.0 : iy == 1 ? 6.0 : iy == 2 ? 9.0 : 5.0)) / 16.0;
  if (bayer < k) discard;
}`;
