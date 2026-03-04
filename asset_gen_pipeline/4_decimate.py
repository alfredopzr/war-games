"""
4_decimate.py
Blender headless script: decimates a GLB to a target face count.

Usage:
  blender --background --python 4_decimate.py -- --input path/to/input.glb --output path/to/output.glb --target-faces 250000
"""

import bpy
import sys
import os

argv = sys.argv
separator = argv.index("--")
script_args = argv[separator + 1:]

import argparse
parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--target-faces", type=int, default=250000)
args = parser.parse_args(script_args)

INPUT_PATH = args.input
OUTPUT_PATH = args.output
TARGET_FACES = args.target_faces

# ── Import ──

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=INPUT_PATH)

# Find root mesh
obj = None
for o in bpy.data.objects:
    if o.type == 'MESH' and o.parent is None:
        obj = o
        break
if obj is None:
    for o in bpy.data.objects:
        if o.type == 'MESH':
            obj = o
            break
if obj is None:
    print("[ERROR] No mesh found")
    sys.exit(1)

# ── Decimate ──

face_count = len(obj.data.polygons)
print(f"[DECIMATE] Input: {face_count} faces, target: {TARGET_FACES}")

if face_count > TARGET_FACES:
    ratio = TARGET_FACES / face_count
    mod = obj.modifiers.new(name="Decimate", type='DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = ratio
    mod.use_collapse_triangulate = True

    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)

    new_count = len(obj.data.polygons)
    print(f"[DECIMATE] Output: {new_count} faces (ratio: {ratio:.4f})")
else:
    print(f"[DECIMATE] Already under {TARGET_FACES}, copying as-is")

# ── Export ──

os.makedirs(os.path.dirname(os.path.abspath(OUTPUT_PATH)), exist_ok=True)

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    export_format='GLB',
    export_animations=False,
    export_skins=True,
    export_morph=True,
    use_selection=True,
    export_yup=True,
)

print(f"[DECIMATE] Exported: {OUTPUT_PATH}")
