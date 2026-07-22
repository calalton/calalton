# Blender headless: import the Cal Alton SVG, inflate it into a soft 3D
# "pillow" mark (solidify + rounded bevel + subdivision), assign a glossy
# material and export a glTF binary for react-three-fiber.
#
# Run:  blender -b -P scripts/blender-inflate.py -- <in.svg> <out.glb>
import bpy
import sys

argv = sys.argv
argv = argv[argv.index("--") + 1 :] if "--" in argv else []
svg_path = argv[0] if len(argv) > 0 else "public/cal-alton-logo.svg"
out_path = argv[1] if len(argv) > 1 else "public/cal-alton-logo.glb"

# --- tunables -------------------------------------------------------------
TARGET_SIZE = 2.0      # normalise longest edge to this many units
THICKNESS = 0.62       # solidify depth (the "puff") — higher = more bubbly
BEVEL_WIDTH = 0.09     # rim rounding
BEVEL_SEGMENTS = 6
SUBSURF = 1            # smoothing → pillow
DECIMATE = 0.4         # collapse ratio to keep the glb web-light
# -------------------------------------------------------------------------

# Fresh, empty scene.
bpy.ops.wm.read_factory_settings(use_empty=True)

# The SVG importer ships as a built-in add-on; enable defensively.
try:
    bpy.ops.preferences.addon_enable(module="io_curve_svg")
except Exception:
    pass

bpy.ops.import_curve.svg(filepath=svg_path)

curves = [o for o in bpy.context.scene.objects if o.type == "CURVE"]
if not curves:
    raise RuntimeError("No curves imported from SVG: " + svg_path)

# Filled, flat curves so conversion produces solid faces (letter holes kept).
for o in curves:
    o.data.dimensions = "2D"
    o.data.fill_mode = "BOTH"

bpy.ops.object.select_all(action="DESELECT")
for o in curves:
    o.select_set(True)
bpy.context.view_layer.objects.active = curves[0]
bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active

bpy.ops.object.convert(target="MESH")
obj = bpy.context.view_layer.objects.active

# Centre + normalise size.
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
obj.location = (0.0, 0.0, 0.0)
dims = obj.dimensions
scale = TARGET_SIZE / max(dims.x, dims.y, 1e-6)
obj.scale = (scale, scale, scale)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Clean geometry: merge doubles, recalc normals.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.0005)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")

# Inflate stack: thickness → rounded rim → smooth into a pillow.
sol = obj.modifiers.new("Solidify", "SOLIDIFY")
sol.thickness = THICKNESS
sol.offset = 0.0
sol.use_even_offset = True

bev = obj.modifiers.new("Bevel", "BEVEL")
bev.width = BEVEL_WIDTH
bev.segments = BEVEL_SEGMENTS
bev.limit_method = "ANGLE"
bev.angle_limit = 0.523599  # 30°

sub = obj.modifiers.new("Subsurf", "SUBSURF")
sub.levels = SUBSURF
sub.render_levels = SUBSURF

dec = obj.modifiers.new("Decimate", "DECIMATE")
dec.decimate_type = "COLLAPSE"
dec.ratio = DECIMATE

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
for m in list(obj.modifiers):
    bpy.ops.object.modifier_apply(modifier=m.name)

bpy.ops.object.shade_smooth()

# Stand it up to face the camera (glTF is Y-up; Blender Z-up).
obj.rotation_euler = (1.5708, 0.0, 0.0)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

# Glossy off-white material (react-three-fiber can override).
mat = bpy.data.materials.new("CalAlton")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs["Base Color"].default_value = (0.90, 0.95, 0.96, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.22
    bsdf.inputs["Metallic"].default_value = 0.0
obj.data.materials.clear()
obj.data.materials.append(mat)

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
)
print("EXPORTED", out_path)
