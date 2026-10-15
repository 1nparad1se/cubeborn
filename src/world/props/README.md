# World props library

Reusable world assets (reference sheets 1-10). Pure data in `src/world/props`, rendering in
`src/world/render/PropRenderer.ts`, textures in `src/world/textures`.

## Add a prop
1. Open your category file (`trees.ts`, `vegetation.ts`, `water.ts`, `stone.ts`, `camps.ts`,
   `bridges.ts`, `roads.ts`) and push a `PropDef` into its exported array. Never edit other
   categories' files; `index.ts` merges all arrays into `PROPS` (ids must be unique).
2. `build(ctx)` returns a `Model` (see `kit.ts`): boxes in **pixels**, 16 px = 1 sheet block =
   2/3 world unit (`PX = 1/24`); 3 blocks = 2 map cells. Origin = footprint centre on the ground,
   +y up; the camera looks from +x+z, so put the front on +z.
   - `m.box(x,y,z,w,h,d, tex, opts)` (min corner) / `m.cbox(cx,y,cz,...)` (centred).
   - `tex`: atlas name or `{ side, end, top, bottom, px, nx, pz, nz }`.
   - opts: `tint`, `glow` (+`flicker`), `bevel` (px, default 1), `rot {x,y,z,pivot}` (Euler YXZ),
     `uv` offset, `anim {kind: swing|flag|sway|flicker|bob|spin, pivot, axis, amp, speed}`, `noAO`.
   - `m.light(x,y,z,color,intensity,radius,flicker,day)`; `m.emit({kind: fire|embers|sparks|smoke|mist|fireflies|motes|drips, ...})`.
   - Reuse kit pieces: `lantern`, `flame`, `torch`, `post`, `stone`, `ivy`; cargo exports `crate`, `barrel`, `sack`.
   - Randomise with `ctx.rnd()` (seeded per instance), `ctx.variant` (< `variants`), `ctx.params`.
3. Footprint `size: [x, z]` in cells (or a function of params). `solid` true/false/per-cell fn.
   Walkable props (bridges, boardwalks, stairs, platforms) set `deck(fx, fz, ctx)` → deck height
   in whole blocks above the base (null = no deck); deck cells become floor even over water.
4. New textures: `defineTex('name', (x, y, h) => 0xRRGGBB | -1)` (16x16, -1 = transparent) —
   shared ones in `textures/atlas.ts`, category-only ones at the top of your file (import `defineTex`).
5. Check it: `npm run dev`, open `tools/rigview/props.html?cat=<cat>` (`&night=1`, `&ids=a,b`,
   `&v=<variant>`, `&t=<sec>`, `&anim=1`, `&zoom=`), compare with the sheet.

## Place props in a map (`place.ts`)
- `placeProp(t, id, x, z, { rot, variant, y, seed, params, yaw, scale, ifFree, noCollide })` —
  x,z = footprint centre (an N-cell side is centred at `cell + N/2`), rot = quarter turns.
- `placeAlong(t, id, points, { spacing })` — fences/palisades along a polyline (local +x follows it).
- `paintRoad(t, kind, points, width)` — road surface tiles (`textures/groundTiles.ts`:
  road_stone, road_dirt, path_forest, road_sand, boardwalk, path_mountain, path_swamp).
- `placeBridge(t, id, a, b)` — parametric prop with `params.length` (cells) spanning a→b.
Place props before `t.reach` is computed. Lights register on `t.lights` (nearest ones lit by the LightPool).
