"""Builds the Berserker in Blender from the voxel dump (bevelled cubes, vertex colours), renders a
turnaround and exports a .glb.  python3 tools/blender/buildBerserker.py vox.json outdir"""
import json, math, sys, os
import bpy, bmesh
from mathutils import Vector

src, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
D = json.load(open(src))
res, S = D['res'], D['scale']
bones = D['bones']

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# template: bevelled unit cube
tb = bmesh.new()
bmesh.ops.create_cube(tb, size=1.0)
bmesh.ops.bevel(tb, geom=list(tb.edges), offset=0.14, segments=2, affect='EDGES', profile=0.6)
tverts = [v.co.copy() for v in tb.verts]
tfaces = [[v.index for v in f.verts] for f in tb.faces]
tb.free()

cells = {}
for v in D['voxels']:
    cells[(v['b'], v['i'], v['j'], v['k'])] = v

def srgb_to_lin(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

bm = bmesh.new()
col_layer = bm.loops.layers.color.new('Col')
glow_layer = bm.faces.layers.int.new('glow')
import random
random.seed(3)

# greedy-merge same-colour voxels of a bone into boxes, so the figure reads as larger blocks with
# bevels only where the shape or the colour changes (the look of the reference renders)
groups = {}
for (b, i, j, k), v in cells.items():
    groups.setdefault((b, v['c'], v['g']), set()).add((i, j, k))
n = 0
for (b, c, gl), cs in groups.items():
    left = set(cs)
    for start in sorted(cs):
        if start not in left:
            continue
        i0, j0, k0 = start
        i1 = i0
        while (i1 + 1, j0, k0) in left: i1 += 1
        j1 = j0
        while all((x, j1 + 1, k0) in left for x in range(i0, i1 + 1)): j1 += 1
        k1 = k0
        while all((x, y, k1 + 1) in left for x in range(i0, i1 + 1) for y in range(j0, j1 + 1)): k1 += 1
        for x in range(i0, i1 + 1):
            for y in range(j0, j1 + 1):
                for z in range(k0, k1 + 1):
                    left.discard((x, y, z))
        at = bones.get(b, {'at': [0, 0, 0]})['at']
        lo = Vector((at[0] + i0 * res, at[1] + j0 * res, at[2] + k0 * res))
        hi = Vector((at[0] + (i1 + 1) * res, at[1] + (j1 + 1) * res, at[2] + (k1 + 1) * res))
        size3 = hi - lo
        cen = (lo + hi) / 2
        # three (x, y up, z forward) -> blender (x, -z, y)
        p = Vector((cen.x, -cen.z, cen.y)) * S
        sz = Vector((size3.x, size3.z, size3.y)) * S
        bev = min(sz) * 0.16 + res * S * 0.02
        jit = 1.0 + (random.random() - 0.5) * 0.08
        rgba = (srgb_to_lin(((c >> 16) & 255)) * jit, srgb_to_lin(((c >> 8) & 255)) * jit, srgb_to_lin((c & 255)) * jit, 1.0)
        # bevelled box: template cube scaled per axis keeps the bevel width proportional, so rebuild
        tb2 = bmesh.new()
        bmesh.ops.create_cube(tb2, size=1.0)
        for vv in tb2.verts:
            vv.co = Vector((vv.co.x * sz.x, vv.co.y * sz.y, vv.co.z * sz.z))
        bmesh.ops.bevel(tb2, geom=list(tb2.edges), offset=bev, segments=2, affect='EDGES', profile=0.6)
        vmap = {}
        for vv in tb2.verts:
            vmap[vv.index] = bm.verts.new(p + vv.co)
        for f in tb2.faces:
            face = bm.faces.new([vmap[vv.index] for vv in f.verts])
            face[glow_layer] = gl
            for loop in face.loops:
                loop[col_layer] = rgba
        tb2.free()
        n += 1
mesh = bpy.data.meshes.new('Berserker')
bm.to_mesh(mesh)
bm.free()
obj = bpy.data.objects.new('Berserker', mesh)
scene.collection.objects.link(obj)
for p in mesh.polygons:
    p.use_smooth = False
print('boxes', n, 'faces', len(mesh.polygons))

# materials: body (vertex colour) and glowing eyes / runes
mat = bpy.data.materials.new('body')
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes['Principled BSDF']
vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.75
glow = bpy.data.materials.new('glow')
glow.use_nodes = True
g = glow.node_tree.nodes['Principled BSDF']
g.inputs['Emission Color'].default_value = (1.0, 0.05, 0.03, 1)
g.inputs['Emission Strength'].default_value = 6.0
g.inputs['Base Color'].default_value = (1.0, 0.1, 0.05, 1)
obj.data.materials.append(mat)
obj.data.materials.append(glow)
gl = mesh.attributes['glow'].data
for p, a in zip(mesh.polygons, gl):
    p.material_index = 1 if a.value else 0

# export the model (rest pose) for the game
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(outdir, 'berserker.glb'), use_selection=True)

# lighting and render setup
world = bpy.data.worlds.new('w'); scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.012, 0.013, 0.017, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
def light(name, kind, loc, energy, color, size=1.0):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color
    if kind == 'AREA': ld.size = size
    lo = bpy.data.objects.new(name, ld); lo.location = loc
    scene.collection.objects.link(lo)
    d = Vector((0, 0, 1.1)) - Vector(loc)
    lo.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return lo
light('key', 'AREA', (2.5, -4.0, 4.0), 900, (1.0, 0.93, 0.85), 3.0)
light('fill', 'AREA', (-3.5, -2.5, 2.0), 250, (0.8, 0.85, 1.0), 4.0)
light('rim', 'AREA', (0.0, 4.0, 3.0), 180, (1.0, 0.55, 0.5), 3.0)
light('rimb', 'AREA', (-2.0, 4.0, 3.0), 300, (1.0, 0.95, 0.9), 3.0)
floor_me = bpy.data.meshes.new('floor')
fb = bmesh.new(); bmesh.ops.create_grid(fb, x_segments=1, y_segments=1, size=6); fb.to_mesh(floor_me); fb.free()
floor = bpy.data.objects.new('floor', floor_me); scene.collection.objects.link(floor)
fm = bpy.data.materials.new('floor'); fm.use_nodes = True
fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.02, 0.02, 0.025, 1)
floor_me.materials.append(fm)

cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = 2.9
cam = bpy.data.objects.new('cam', cam_d); scene.collection.objects.link(cam); scene.camera = cam
scene.render.engine = 'CYCLES'
scene.cycles.samples = int(os.environ.get('SAMPLES', '48'))
scene.cycles.use_denoising = True
scene.render.resolution_x = 520
scene.render.resolution_y = 800
scene.render.film_transparent = False
views = [('front', 0), ('angle', 35), ('left', 90), ('back', 180), ('right', 270)]
H = 2.3 / 2
for name, deg in views:
    a = math.radians(deg)
    # orbit the camera around the model (the model faces -Y)
    cam.location = (math.sin(a) * -10 * -1 if False else 10 * math.sin(a), -10 * math.cos(a), H)
    cam.location = (10 * math.sin(a), -10 * math.cos(a), H + 0.15)
    d = Vector((0, 0, H)) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(outdir, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', name)
