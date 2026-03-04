"""
5_apply_skin.py
Transfers material/texture data from a textured GLB to a skinned GLB at the binary level.
No Blender needed — operates directly on GLB structure.

Usage:
  python 5_apply_skin.py --source textured.glb --target animated.glb --output final.glb
"""

import argparse
import json
import struct

def read_glb(path):
    """Read a GLB file, return (json_data, bin_data)."""
    with open(path, 'rb') as f:
        magic = f.read(4)
        assert magic == b'glTF', f"Not a GLB: {path}"
        version = struct.unpack('<I', f.read(4))[0]
        total_len = struct.unpack('<I', f.read(4))[0]

        # JSON chunk
        json_len = struct.unpack('<I', f.read(4))[0]
        json_type = f.read(4)
        json_bytes = f.read(json_len)
        json_data = json.loads(json_bytes)

        # BIN chunk
        bin_data = b''
        remaining = total_len - 12 - 8 - json_len
        if remaining > 0:
            bin_len = struct.unpack('<I', f.read(4))[0]
            bin_type = f.read(4)
            bin_data = f.read(bin_len)

    return json_data, bin_data


def write_glb(path, json_data, bin_data):
    """Write a GLB file from json_data + bin_data."""
    json_bytes = json.dumps(json_data, separators=(',', ':')).encode('utf-8')
    # Pad JSON to 4-byte boundary with spaces
    while len(json_bytes) % 4 != 0:
        json_bytes += b' '
    # Pad BIN to 4-byte boundary with zeros
    while len(bin_data) % 4 != 0:
        bin_data += b'\x00'

    total = 12 + 8 + len(json_bytes) + 8 + len(bin_data)

    with open(path, 'wb') as f:
        f.write(b'glTF')
        f.write(struct.pack('<I', 2))
        f.write(struct.pack('<I', total))
        # JSON chunk
        f.write(struct.pack('<I', len(json_bytes)))
        f.write(b'JSON')
        f.write(json_bytes)
        # BIN chunk
        f.write(struct.pack('<I', len(bin_data)))
        f.write(b'BIN\x00')
        f.write(bin_data)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Textured GLB (material source)")
    parser.add_argument("--target", required=True, help="Animated GLB (no materials)")
    parser.add_argument("--output", required=True, help="Output GLB path")
    args = parser.parse_args()

    src_json, src_bin = read_glb(args.source)
    tgt_json, tgt_bin = read_glb(args.target)

    src_materials = src_json.get("materials", [])
    src_textures = src_json.get("textures", [])
    src_images = src_json.get("images", [])
    src_samplers = src_json.get("samplers", [])

    if not src_materials:
        print("[WARN] Source has no materials, copying target as-is")
        write_glb(args.output, tgt_json, tgt_bin)
        return

    # Count existing accessors/bufferViews in target to offset indices
    tgt_buffer_views = tgt_json.get("bufferViews", [])
    tgt_accessors = tgt_json.get("accessors", [])
    bv_offset = len(tgt_buffer_views)

    # Copy image binary data from source to target
    # Images reference bufferViews which reference the binary buffer
    new_buffer_views = []
    new_images = []
    image_index_map = {}  # src image index → tgt image index

    tgt_images = tgt_json.get("images", [])
    tgt_image_base = len(tgt_images)

    for i, img in enumerate(src_images):
        if "bufferView" in img:
            # Get the source bufferView
            src_bv = src_json["bufferViews"][img["bufferView"]]
            offset = src_bv.get("byteOffset", 0)
            length = src_bv["byteLength"]

            # Extract image bytes from source binary
            img_bytes = src_bin[offset:offset + length]

            # Add to target binary at current end
            tgt_bin_offset = len(tgt_bin)
            # Pad to 4-byte boundary
            while len(tgt_bin) % 4 != 0:
                tgt_bin += b'\x00'
            tgt_bin_offset = len(tgt_bin)
            tgt_bin += img_bytes

            # Create new bufferView in target
            new_bv_index = len(tgt_buffer_views) + len(new_buffer_views)
            new_buffer_views.append({
                "buffer": 0,
                "byteOffset": tgt_bin_offset,
                "byteLength": length,
            })

            # Create new image reference
            new_img = {"bufferView": new_bv_index, "mimeType": img.get("mimeType", "image/png")}
            new_images.append(new_img)
            image_index_map[i] = tgt_image_base + len(new_images) - 1

        elif "uri" in img:
            # URI-based image, copy as-is
            new_images.append(dict(img))
            image_index_map[i] = tgt_image_base + len(new_images) - 1

    # Update target bufferViews
    tgt_buffer_views.extend(new_buffer_views)
    tgt_json["bufferViews"] = tgt_buffer_views

    # Update target images
    tgt_images.extend(new_images)
    tgt_json["images"] = tgt_images

    # Copy samplers
    tgt_samplers = tgt_json.get("samplers", [])
    sampler_offset = len(tgt_samplers)
    tgt_samplers.extend(src_samplers)
    tgt_json["samplers"] = tgt_samplers

    # Copy textures with remapped image/sampler indices
    tgt_textures = tgt_json.get("textures", [])
    texture_offset = len(tgt_textures)
    for tex in src_textures:
        new_tex = {}
        if "source" in tex:
            new_tex["source"] = image_index_map.get(tex["source"], tex["source"])
        if "sampler" in tex:
            new_tex["sampler"] = tex["sampler"] + sampler_offset
        tgt_textures.append(new_tex)
    tgt_json["textures"] = tgt_textures

    # Copy materials with remapped texture indices
    tgt_materials = tgt_json.get("materials", [])
    mat_offset = len(tgt_materials)

    for mat in src_materials:
        new_mat = json.loads(json.dumps(mat))  # deep copy
        # Remap texture indices in pbrMetallicRoughness
        pbr = new_mat.get("pbrMetallicRoughness", {})
        for key in ("baseColorTexture", "metallicRoughnessTexture"):
            if key in pbr:
                pbr[key]["index"] = pbr[key]["index"] + texture_offset
        # Remap other texture references
        for key in ("normalTexture", "occlusionTexture", "emissiveTexture"):
            if key in new_mat:
                new_mat[key]["index"] = new_mat[key]["index"] + texture_offset
        tgt_materials.append(new_mat)
    tgt_json["materials"] = tgt_materials

    # Assign first source material to all mesh primitives that have no material
    for mesh in tgt_json.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if prim.get("material") is None:
                prim["material"] = mat_offset  # first copied material

    # Update buffer length
    if tgt_json.get("buffers"):
        tgt_json["buffers"][0]["byteLength"] = len(tgt_bin)

    write_glb(args.output, tgt_json, tgt_bin)
    print(f"[SKIN] Applied {len(src_materials)} materials, {len(new_images)} images -> {args.output}")


if __name__ == "__main__":
    main()
