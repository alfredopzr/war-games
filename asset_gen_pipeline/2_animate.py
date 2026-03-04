"""
2_animate.py
Blender headless animation script.
Imports a remeshed .glb, adds 5 animation clips, exports animated .glb.

Usage (called by pipeline, or directly):
  blender --background --python 2_animate.py -- --input path/to/unit.glb --output path/to/output.glb

Clips embedded:
  idle    2.5s loop  - subtle bob/hover
  move    1.0s loop  - forward lean
  attack  0.6s once  - forward punch/recoil
  hit     0.4s once  - backward stagger
  death   1.0s once  - collapse forward

All animation is root object transform (location + rotation).
No skeleton required. Works on any single-mesh Meshy output.
"""

import bpy
import sys
import math
import os

# ── Parse args ────────────────────────────────────────────────────────────────

argv = sys.argv
try:
    separator = argv.index("--")
    script_args = argv[separator + 1:]
except ValueError:
    print("[ERROR] No arguments after --")
    sys.exit(1)

import argparse
parser = argparse.ArgumentParser()
parser.add_argument("--input",  required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--target-tris", type=int, default=50000)
args = parser.parse_args(script_args)

INPUT_PATH  = args.input
OUTPUT_PATH = args.output
TARGET_TRIS = args.target_tris

# ── Preset detection from filename ───────────────────────────────────────────

filename = os.path.basename(INPUT_PATH).lower()

if "prop_command" in filename:
    preset = "command_tower"
elif "prop_" in filename:
    preset = "prop"
elif any(x in filename for x in ["scout_engineer", "scout_warden", "scout_current"]):
    preset = "drone"
elif any(x in filename for x in ["tank", "artillery", "scout_caravaner", "scout_greaser", "scout_pistolero"]):
    preset = "vehicle"
else:
    preset = "humanoid"  # infantry, recon

print(f"[ANIMATE] {filename} → preset: {preset}")

# ── Scene setup ───────────────────────────────────────────────────────────────

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=INPUT_PATH)

# Get root mesh object
obj = None
for o in bpy.data.objects:
    if o.type == 'MESH' and o.parent is None:
        obj = o
        break

if obj is None:
    # Fallback: take first mesh
    for o in bpy.data.objects:
        if o.type == 'MESH':
            obj = o
            break

if obj is None:
    print("[ERROR] No mesh object found in GLB")
    sys.exit(1)

print(f"[ANIMATE] Target object: '{obj.name}'")

# ── Decimate to target tri count ─────────────────────────────────────────────

tri_count = len(obj.data.polygons)
print(f"[DECIMATE] Input: {tri_count} faces")

if tri_count > TARGET_TRIS:
    ratio = TARGET_TRIS / tri_count
    mod = obj.modifiers.new(name="Decimate", type='DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = ratio
    mod.use_collapse_triangulate = True

    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)

    new_count = len(obj.data.polygons)
    print(f"[DECIMATE] Output: {new_count} faces (ratio: {ratio:.4f})")
else:
    print(f"[DECIMATE] Already under {TARGET_TRIS}, skipping")

# Get model height for scaling keyframe values
verts_world = [obj.matrix_world @ v.co for v in obj.data.vertices]
zs = [v.z for v in verts_world]
ys = [v.y for v in verts_world]
model_height = max(zs) - min(zs)
model_depth  = max(ys) - min(ys)
print(f"[ANIMATE] Model height: {model_height:.3f}  depth: {model_depth:.3f}")

# Scale factors — all keyframe values relative to model size
H = model_height  # height reference
D = model_depth   # depth reference

# ── FPS and frame counts ──────────────────────────────────────────────────────

FPS = 24
bpy.context.scene.render.fps = FPS

def frames(seconds):
    return int(round(seconds * FPS))

# ── Helper: create action with keyframes ──────────────────────────────────────

def make_action(name, keyframes_loc, keyframes_rot):
    """
    keyframes_loc: list of (frame, x, y, z)
    keyframes_rot: list of (frame, rx, ry, rz) in degrees
    Returns action object.
    """
    action = bpy.data.actions.new(name=name)
    obj.animation_data_create()
    obj.animation_data.action = action

    # Blender 5.0 layered actions: action → slot → layer → strip → channelbag → fcurves
    slot = action.slots.new(id_type='OBJECT', name=obj.name)
    obj.animation_data.action_slot = slot
    layer = action.layers.new("Layer")
    strip = layer.strips.new(type='KEYFRAME')
    channelbag = strip.channelbag(slot, ensure=True)

    # Location curves
    loc_curves = [channelbag.fcurves.new(data_path="location", index=i) for i in range(3)]
    for (frame, x, y, z) in keyframes_loc:
        for i, val in enumerate([x, y, z]):
            kf = loc_curves[i].keyframe_points.insert(frame, val)
            kf.interpolation = 'BEZIER'

    # Rotation curves (euler XYZ)
    obj.rotation_mode = 'XYZ'
    rot_curves = [channelbag.fcurves.new(data_path="rotation_euler", index=i) for i in range(3)]
    for (frame, rx, ry, rz) in keyframes_rot:
        for i, val in enumerate([math.radians(rx), math.radians(ry), math.radians(rz)]):
            kf = rot_curves[i].keyframe_points.insert(frame, val)
            kf.interpolation = 'BEZIER'

    return action


def push_to_nla(action, track_name, start_frame=0):
    """Push action to NLA track so it's embedded in the export."""
    # Force clean name on the action itself — this is what Three.js reads
    action.name = track_name
    obj.animation_data_create()
    track = obj.animation_data.nla_tracks.new()
    track.name = track_name
    strip = track.strips.new(name=track_name, start=start_frame, action=action)
    strip.name = track_name
    strip.action_frame_start = action.frame_range[0]
    strip.action_frame_end   = action.frame_range[1]
    return strip


# ── PRESETS ───────────────────────────────────────────────────────────────────

def build_humanoid():
    """
    Infantry, recon, scouts (humanoid units).
    Root transform only — whole mesh moves as one piece.
    """

    bob   = H * 0.018   # idle vertical bob
    lean  = 12.0        # forward lean degrees on move
    punch = D * 0.08    # attack forward distance
    stagger = 15.0      # hit backward degrees

    # IDLE — 60 frames loop, subtle vertical bob
    # Z oscillates up-down twice
    idle = make_action("idle",
        keyframes_loc=[
            (0,  0, 0, 0),
            (15, 0, 0, bob),
            (30, 0, 0, 0),
            (45, 0, 0, bob),
            (60, 0, 0, 0),
        ],
        keyframes_rot=[
            (0,  0, 0, 0),
            (15, 1, 0, 0),   # tiny forward sway
            (30, 0, 0, 0),
            (45, -1, 0, 0),  # tiny back sway
            (60, 0, 0, 0),
        ]
    )
    push_to_nla(idle, "idle", start_frame=0)

    # MOVE — 24 frames loop, forward lean held
    move = make_action("move",
        keyframes_loc=[
            (0,  0, 0, 0),
            (6,  0, 0, bob * 0.5),
            (12, 0, 0, 0),
            (18, 0, 0, bob * 0.5),
            (24, 0, 0, 0),
        ],
        keyframes_rot=[
            (0,  lean, 0, 0),
            (6,  lean + 2, 0, 0),
            (12, lean, 0, 0),
            (18, lean + 2, 0, 0),
            (24, lean, 0, 0),
        ]
    )
    push_to_nla(move, "move", start_frame=100)

    # ATTACK — 15 frames, punch forward and snap back
    attack = make_action("attack",
        keyframes_loc=[
            (0,  0, 0,       0),
            (5,  0, -punch,  0),   # punch forward (Y is depth)
            (8,  0, -punch * 1.3, 0),  # overshoot
            (15, 0, 0,       0),   # snap back
        ],
        keyframes_rot=[
            (0,  0,  0, 0),
            (5,  lean + 5, 0, 0),  # lunge
            (15, 0,  0, 0),
        ]
    )
    push_to_nla(attack, "attack", start_frame=200)

    # HIT — 10 frames, rock backward
    hit = make_action("hit",
        keyframes_loc=[
            (0,  0, 0, 0),
            (4,  0, D * 0.04, 0),  # knocked back
            (10, 0, 0, 0),
        ],
        keyframes_rot=[
            (0,   0, 0, 0),
            (4,  -stagger, 0, 0),  # snap back
            (10,  0, 0, 0),
        ]
    )
    push_to_nla(hit, "hit", start_frame=300)

    # DEATH — 24 frames, topple forward and drop
    death = make_action("death",
        keyframes_loc=[
            (0,  0, 0,  0),
            (8,  0, 0,  H * 0.1),   # slight lift before fall
            (24, 0, -D * 0.3, -H * 0.45),  # fall forward and down
        ],
        keyframes_rot=[
            (0,   0, 0, 0),
            (24,  85, 0, 0),  # face-plant forward
        ]
    )
    push_to_nla(death, "death", start_frame=400)

    print("[ANIMATE] Humanoid clips built: idle, move, attack, hit, death")


def build_vehicle():
    """
    Tanks, artillery. Hull as single rigid body.
    Heavier, slower motion. Recoil on attack.
    """

    bob    = H * 0.012
    lean   = 6.0        # vehicles lean less than infantry
    recoil = D * 0.06

    # IDLE — engine vibration, very subtle
    idle = make_action("idle",
        keyframes_loc=[
            (0,  0, 0, 0),
            (4,  0, 0, bob),
            (8,  0, 0, 0),
            (12, 0, 0, bob * 0.7),
            (16, 0, 0, 0),
            (20, 0, 0, bob),
            (24, 0, 0, 0),
        ],
        keyframes_rot=[
            (0,  0, 0, 0),
            (8,  0.5, 0, 0),
            (16, -0.3, 0, 0),
            (24, 0, 0, 0),
        ]
    )
    push_to_nla(idle, "idle", start_frame=0)

    # MOVE — hull tilts forward, bounces with terrain
    move = make_action("move",
        keyframes_loc=[
            (0,  0, 0, 0),
            (8,  0, 0, bob),
            (16, 0, 0, 0),
            (24, 0, 0, bob),
            (32, 0, 0, 0),
        ],
        keyframes_rot=[
            (0,  lean, 0, 0),
            (8,  lean + 1.5, 0, 0.5),
            (16, lean, 0, -0.5),
            (24, lean + 1.5, 0, 0),
            (32, lean, 0, 0),
        ]
    )
    push_to_nla(move, "move", start_frame=100)

    # ATTACK — recoil backward (whole hull kicks)
    attack = make_action("attack",
        keyframes_loc=[
            (0,  0, 0,      0),
            (4,  0, recoil, 0),   # kick back
            (7,  0, recoil * 1.2, 0),
            (15, 0, 0,      0),   # settle
        ],
        keyframes_rot=[
            (0,  0,  0, 0),
            (4,  -8, 0, 0),   # barrel rises on recoil
            (15, 0,  0, 0),
        ]
    )
    push_to_nla(attack, "attack", start_frame=200)

    # HIT — rock from impact direction
    hit = make_action("hit",
        keyframes_loc=[
            (0,  0, 0, 0),
            (5,  0, D * 0.03, bob * 2),
            (12, 0, 0, 0),
        ],
        keyframes_rot=[
            (0,   0, 0, 0),
            (5,  -10, 0, 3),
            (12,  0,  0, 0),
        ]
    )
    push_to_nla(hit, "hit", start_frame=300)

    # DEATH — tip sideways and settle
    death = make_action("death",
        keyframes_loc=[
            (0,  0, 0,  0),
            (10, 0, 0,  H * 0.08),
            (24, 0, 0, -H * 0.15),
        ],
        keyframes_rot=[
            (0,   0,  0,  0),
            (10,  5,  0,  15),
            (24,  10, 0,  88),  # tips onto side
        ]
    )
    push_to_nla(death, "death", start_frame=400)

    print("[ANIMATE] Vehicle clips built: idle, move, attack, hit, death")


def build_drone():
    """
    Scout drones. Hover oscillation, tilt on move.
    Single mesh — rotors are part of the same geometry.
    """

    hover_amp = H * 0.04   # hover bob amplitude
    hover_hz  = 1.0        # 1 oscillation per second
    tilt      = 18.0       # forward tilt on move

    # IDLE — hover bob, slight rotation drift
    idle_frames = frames(2.5)
    loc_kf = []
    rot_kf = []
    steps = 10
    for i in range(steps + 1):
        f = int((i / steps) * idle_frames)
        phase = (i / steps) * 2 * math.pi
        z_val = hover_amp * math.sin(phase)
        rot_z = math.degrees(math.sin(phase * 0.5) * math.radians(3))
        loc_kf.append((f, 0, 0, z_val))
        rot_kf.append((f, 0, 0, rot_z))

    idle = make_action("idle", loc_kf, rot_kf)
    push_to_nla(idle, "idle", start_frame=0)

    # MOVE — pitch forward
    move = make_action("move",
        keyframes_loc=[
            (0,  0, 0, 0),
            (6,  0, 0, hover_amp * 0.5),
            (12, 0, 0, 0),
            (18, 0, 0, hover_amp * 0.5),
            (24, 0, 0, 0),
        ],
        keyframes_rot=[
            (0,  tilt, 0, 0),
            (6,  tilt + 3, 0, 0),
            (12, tilt, 0, 0),
            (18, tilt + 3, 0, 0),
            (24, tilt, 0, 0),
        ]
    )
    push_to_nla(move, "move", start_frame=100)

    # ATTACK — dip toward target, recoil
    attack = make_action("attack",
        keyframes_loc=[
            (0,  0, 0,          0),
            (6,  0, -D * 0.12,  -hover_amp),   # dive
            (10, 0, -D * 0.15,  -hover_amp),
            (18, 0, 0,          0),             # recover
        ],
        keyframes_rot=[
            (0,  0,    0, 0),
            (6,  tilt + 15, 0, 0),
            (18, 0,    0, 0),
        ]
    )
    push_to_nla(attack, "attack", start_frame=200)

    # HIT — violent wobble
    hit = make_action("hit",
        keyframes_loc=[
            (0,  0,          0, 0),
            (3,  D * 0.05,  0, hover_amp * 2),
            (6, -D * 0.04,  0, -hover_amp),
            (10, 0,          0, 0),
        ],
        keyframes_rot=[
            (0,   0,  0,   0),
            (3,  -20, 0,  15),
            (6,   15, 0, -10),
            (10,  0,  0,   0),
        ]
    )
    push_to_nla(hit, "hit", start_frame=300)

    # DEATH — rotors stall, spiral down, crash
    death = make_action("death",
        keyframes_loc=[
            (0,  0, 0,  0),
            (8,  D * 0.08, 0, H * 0.15),   # brief lift
            (20, D * 0.2,  0, -H * 0.5),   # spiral down
            (24, D * 0.2,  0, -H * 0.55),  # crash
        ],
        keyframes_rot=[
            (0,   0,  0,   0),
            (8,   10, 0,  45),
            (20,  75, 0, 180),
            (24,  90, 0, 200),
        ]
    )
    push_to_nla(death, "death", start_frame=400)

    print("[ANIMATE] Drone clips built: idle, move, attack, hit, death")


def build_prop():
    """
    Static props. Just idle with no motion.
    Other clips are zero-movement stubs so Three.js doesn't error.
    """

    zero_loc = [(0, 0, 0, 0), (24, 0, 0, 0)]
    zero_rot = [(0, 0, 0, 0), (24, 0, 0, 0)]

    for clip_name, start in [("idle", 0), ("move", 100), ("attack", 200), ("hit", 300), ("death", 400)]:
        action = make_action(clip_name, zero_loc, zero_rot)
        push_to_nla(action, clip_name, start_frame=start)

    print("[ANIMATE] Prop clips built: all stubs")


def build_command_tower():
    """
    Command tower prop. Warning light blink via Z rotation pulse.
    Generator vibration.
    """

    # Idle — very subtle vibration (generator)
    idle = make_action("idle",
        keyframes_loc=[
            (0,  0, 0, 0),
            (3,  0, 0, H * 0.003),
            (6,  0, 0, 0),
            (9,  0, 0, H * 0.003),
            (12, 0, 0, 0),
        ],
        keyframes_rot=[
            (0,  0, 0, 0),
            (3,  0.2, 0, 0),
            (6,  0, 0, 0),
            (9,  -0.2, 0, 0),
            (12, 0, 0, 0),
        ]
    )
    push_to_nla(idle, "idle", start_frame=0)

    zero_loc = [(0, 0, 0, 0), (24, 0, 0, 0)]
    zero_rot = [(0, 0, 0, 0), (24, 0, 0, 0)]
    for clip_name, start in [("move", 100), ("attack", 200), ("hit", 300), ("death", 400)]:
        action = make_action(clip_name, zero_loc, zero_rot)
        push_to_nla(action, clip_name, start_frame=start)

    print("[ANIMATE] Command tower clips built")


# ── Run preset ────────────────────────────────────────────────────────────────

if preset == "humanoid":
    build_humanoid()
elif preset == "vehicle":
    build_vehicle()
elif preset == "drone":
    build_drone()
elif preset == "command_tower":
    build_command_tower()
else:
    build_prop()

# ── Export ────────────────────────────────────────────────────────────────────

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

# Select only the mesh object for export
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    export_format='GLB',
    export_animations=True,
    export_nla_strips=True,
    export_nla_strips_merged_animation_name='',  # keep individual strip names
    export_current_frame=False,
    export_skins=True,
    export_morph=True,
    use_selection=True,
    export_yup=True,          # Three.js Y-up convention
)

print(f"\n[ANIMATE] Exported: {OUTPUT_PATH}")
print(f"[ANIMATE] Done.")
