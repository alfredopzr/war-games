#!/usr/bin/env python3
"""
3_merge_animations.py
Blender headless script: merges multiple single-animation GLBs into one GLB with named NLA strips.
Optionally transfers materials from a textured source model (--skin).

Usage:
  blender --background --python 3_merge_animations.py -- \
    --output path/to/merged.glb \
    --skin path/to/textured.glb \
    --clip idle path/to/idle.glb \
    --clip move path/to/move.glb \
    --clip attack path/to/attack.glb \
    --clip hit path/to/hit.glb \
    --clip death path/to/death.glb
"""

import bpy
import sys
import os

# ── Parse args (after Blender's -- separator) ──

argv = sys.argv
separator = argv.index("--")
script_args = argv[separator + 1:]

import argparse
parser = argparse.ArgumentParser()
parser.add_argument("--output", required=True, help="Output GLB path")
parser.add_argument("--skin", required=False, help="Textured GLB to transfer materials from")
parser.add_argument("--clip", nargs=2, action="append", metavar=("NAME", "PATH"),
                    help="Clip name and GLB path (repeat for each clip)")
args = parser.parse_args(script_args)

OUTPUT_PATH = args.output
SKIN_PATH = args.skin
clips = args.clip  # list of [name, path] pairs

print(f"[MERGE] {len(clips)} clips → {OUTPUT_PATH}")
if SKIN_PATH:
    print(f"[MERGE] Skin source: {SKIN_PATH}")

# ── Clean scene ──

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 24

# ── Import first clip as base ──

first_name, first_path = clips[0]
print(f"  [IMPORT] base: {first_name} ← {first_path}")
bpy.ops.import_scene.gltf(filepath=first_path)

# Find the armature and mesh
base_armature = None
base_mesh_obj = None
for obj in bpy.data.objects:
    if obj.type == 'ARMATURE':
        base_armature = obj
    if obj.type == 'MESH':
        base_mesh_obj = obj

if not base_armature:
    print("[ERROR] No armature found in first clip")
    sys.exit(1)

# ── Import skin and transfer materials ──

if SKIN_PATH and base_mesh_obj:
    # Import the textured model into the scene
    before_import = set(bpy.data.objects[:])
    bpy.ops.import_scene.gltf(filepath=SKIN_PATH)
    skin_objects = set(bpy.data.objects[:]) - before_import

    # Find the skin mesh
    skin_mesh = None
    for obj in skin_objects:
        if obj.type == 'MESH' and obj.data.materials:
            skin_mesh = obj
            break

    if skin_mesh:
        # Transfer materials: clear target, copy from skin
        base_mesh_obj.data.materials.clear()
        for mat_slot in skin_mesh.material_slots:
            mat = mat_slot.material
            if mat:
                # Ensure material has a fake user so it's not garbage collected
                mat.use_fake_user = True
                base_mesh_obj.data.materials.append(mat)

        # Also set material index on all polygons to 0 (first material)
        for poly in base_mesh_obj.data.polygons:
            poly.material_index = 0

        print(f"  [SKIN] Transferred {len(base_mesh_obj.data.materials)} materials")
    else:
        print(f"  [SKIN] No textured mesh found in skin model")

    # Remove skin objects from scene
    for obj in skin_objects:
        bpy.data.objects.remove(obj, do_unlink=True)

# Ensure animation data exists
if not base_armature.animation_data:
    base_armature.animation_data_create()

# Grab the first action and push to NLA
first_action = base_armature.animation_data.action
if first_action:
    first_action.name = first_name
    track = base_armature.animation_data.nla_tracks.new()
    track.name = first_name
    strip = track.strips.new(name=first_name, start=0, action=first_action)
    strip.name = first_name
    base_armature.animation_data.action = None
    print(f"  [NLA] {first_name}: {int(first_action.frame_range[1])} frames")
else:
    print(f"  [WARN] No action found in {first_name}")

# Track existing objects to identify imports
existing_objects = set(bpy.data.objects[:])

# ── Import remaining clips ──

for clip_name, clip_path in clips[1:]:
    print(f"  [IMPORT] {clip_name} ← {clip_path}")
    bpy.ops.import_scene.gltf(filepath=clip_path)

    # Find newly imported armature
    new_armature = None
    for obj in bpy.data.objects:
        if obj not in existing_objects and obj.type == 'ARMATURE':
            new_armature = obj
            break

    if not new_armature or not new_armature.animation_data:
        print(f"  [WARN] No armature/action found in {clip_name}, skipping")
        new_objects = set(bpy.data.objects[:]) - existing_objects
        for obj in new_objects:
            bpy.data.objects.remove(obj, do_unlink=True)
        existing_objects = set(bpy.data.objects[:])
        continue

    action = new_armature.animation_data.action
    if action:
        action.name = clip_name
        track = base_armature.animation_data.nla_tracks.new()
        track.name = clip_name
        strip = track.strips.new(name=clip_name, start=0, action=action)
        strip.name = clip_name
        print(f"  [NLA] {clip_name}: {int(action.frame_range[1])} frames")
    else:
        print(f"  [WARN] No action in {clip_name}")

    # Delete imported duplicate objects
    new_objects = set(bpy.data.objects[:]) - existing_objects
    for obj in new_objects:
        bpy.data.objects.remove(obj, do_unlink=True)

    existing_objects = set(bpy.data.objects[:])

# ── Export ──

os.makedirs(os.path.dirname(os.path.abspath(OUTPUT_PATH)), exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    export_format='GLB',
    export_animations=True,
    export_nla_strips=True,
    export_nla_strips_merged_animation_name='',
    export_current_frame=False,
    export_skins=True,
    export_morph=True,
    export_image_format='AUTO',
    export_materials='EXPORT',
    use_selection=True,
    export_yup=True,
)

print(f"[MERGE] Exported: {OUTPUT_PATH}")
