#!/usr/bin/env python3
"""
1_generate.py
4-stage pipeline: text-to-image → multi-view → 3D → retexture

Usage:
  python 1_generate.py --status                  # checklist of all assets + stage progress
  python 1_generate.py --all                     # full pipeline, all .glb assets
  python 1_generate.py --all --limit 5           # process first 5 pending units
  python 1_generate.py --unit infantry_engineer   # single unit
  python 1_generate.py --retry-failed             # retry failed units only
  python 1_generate.py --preview-only             # stage 1 only (front view PNGs)
  python 1_generate.py --from-previews            # skip stage 1, run stages 2-4
  python 1_generate.py --dry-run                  # parse prompts only, no API calls
"""

import argparse
import base64
import copy
import json
import re
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import subprocess
import requests

# ── Config ────────────────────────────────────────────────────────────────────

CONFIG_PATH = Path(__file__).parent / "config.json"
with open(CONFIG_PATH) as f:
    CONFIG = json.load(f)

MESHY_API_KEY = CONFIG["meshy_api_key"]
MESHY_BASE_URL = "https://api.meshy.ai"
PIPELINE_DIR = Path(__file__).parent
PREVIEWS_DIR = PIPELINE_DIR / CONFIG["paths"]["previews_dir"]
RAW_DIR = PIPELINE_DIR / CONFIG["paths"]["raw_dir"]
FINAL_DIR = PIPELINE_DIR / CONFIG["paths"]["final_dir"]
ANIMATED_DIR = PIPELINE_DIR / CONFIG["paths"]["animated_dir"]
RIGGED_DIR = PIPELINE_DIR / "rigged"
MESHY_ANIMS_DIR = PIPELINE_DIR / "meshy_anims"
LOGS_DIR = PIPELINE_DIR / CONFIG["paths"]["logs_dir"]
LOG_FILE = LOGS_DIR / "generation_log.json"
STYLE_SUFFIX = CONFIG["style_suffix"]
POLL_INTERVAL = CONFIG["poll_interval_seconds"]
ANIM_CONFIG = CONFIG.get("meshy_animation", {})
HUMANOID_TYPES = ANIM_CONFIG.get("humanoid_unit_types", [])

MESHY_HEADERS = {
    "Authorization": f"Bearer {MESHY_API_KEY}",
    "Content-Type": "application/json",
}


# ── ASSETS.md Parser ──────────────────────────────────────────────────────────

def parse_assets_md(path: str) -> list[dict]:
    """
    Extract asset definitions from ASSETS.md.
    Only picks up entries with .glb filenames (skips .png icons/effects).
    """
    with open(path) as f:
        content = f.read()

    units = []
    unit_blocks = re.split(r'\n(?=### )', content)

    for block in unit_blocks:
        file_match = re.search(r'\*\*File\*\*:\s*`([^`]+\.glb)`', block)
        if not file_match:
            continue

        filename = file_match.group(1).replace('.glb', '')
        parts = filename.split('_')
        if len(parts) < 2:
            continue

        unit_type = parts[0]
        faction = '_'.join(parts[1:])

        subject_match = re.search(r'\*\*Subject\*\*:\s*(.+?)(?=\n\*\*|\n\n|\Z)', block, re.DOTALL)
        subject = subject_match.group(1).strip() if subject_match else ""

        markers_match = re.search(r'\*\*Visual markers\*\*.*?\n((?:- .+\n?)+)', block)
        markers = markers_match.group(1).strip() if markers_match else ""

        colors_match = re.search(r'\*\*Colors\*\*:\s*(.+?)(?=\n\*\*|\n\n|\Z)', block, re.DOTALL)
        colors = colors_match.group(1).strip() if colors_match else ""

        silhouette_match = re.search(r'\*\*Silhouette\*\*:\s*(.+?)(?=\n\*\*|\n\n|\Z)', block, re.DOTALL)
        silhouette = silhouette_match.group(1).strip() if silhouette_match else ""

        prompt = build_prompt(subject, markers, colors, silhouette)

        units.append({
            "filename": filename,
            "unit_type": unit_type,
            "faction": faction,
            "subject": subject,
            "prompt": prompt,
        })

    print(f"[PARSER] Found {len(units)} assets in ASSETS.md")
    return units


def build_prompt(subject: str, markers: str, colors: str, silhouette: str) -> str:
    """
    Build a structured prompt from ASSETS.md fields.
    Format: Subject → Visual markers → Silhouette → Colors → Style suffix.
    No truncation — Meshy API accepts long prompts despite what the UI says.
    """
    sections = []

    if subject:
        sections.append(re.sub(r'\s+', ' ', subject).strip())

    if markers:
        items = []
        for line in markers.split('\n'):
            line = line.strip().lstrip('- ').strip()
            if line:
                items.append(line)
        sections.append(', '.join(items))

    if silhouette:
        sections.append(re.sub(r'\s+', ' ', silhouette).strip())

    if colors:
        sections.append(re.sub(r'\s+', ' ', colors).strip())

    sections.append(STYLE_SUFFIX)

    return '\n\n'.join(sections)


# ── Stage 1: Meshy Text to Image ─────────────────────────────────────────────

def submit_text_to_image(prompt: str) -> str | None:
    """Submit text-to-image task. Returns task_id."""
    payload = {
        "ai_model": CONFIG["stage1"]["ai_model"],
        "prompt": prompt,
    }

    resp = requests.post(
        f"{MESHY_BASE_URL}/openapi/v1/text-to-image",
        headers=MESHY_HEADERS,
        json=payload,
        timeout=30,
    )

    if resp.status_code not in (200, 202):
        print(f"  [ERROR] S1 submit failed: {resp.status_code} {resp.text}")
        return None

    data = resp.json()
    task_id = data.get("result") or data.get("id")
    print(f"  [S1 SUBMIT] Task ID: {task_id}")
    return task_id


def poll_text_to_image(task_id: str, name: str) -> dict | None:
    """Poll text-to-image until SUCCEEDED or FAILED."""
    while True:
        resp = requests.get(
            f"{MESHY_BASE_URL}/openapi/v1/text-to-image/{task_id}",
            headers=MESHY_HEADERS,
            timeout=30,
        )

        if resp.status_code != 200:
            print(f"  [ERROR] S1 poll failed: {resp.status_code}")
            return None

        task = resp.json()
        status = task.get("status")
        progress = task.get("progress", 0)
        print(f"  [S1 POLL] {name} — {status} {progress}%", end="\r")

        if status == "SUCCEEDED":
            print(f"\n  [S1 DONE] {name}")
            return task

        if status in ("FAILED", "EXPIRED", "CANCELED"):
            print(f"\n  [S1 FAIL] {name} — {status}")
            return None

        time.sleep(POLL_INTERVAL)


# ── Stage 2: Meshy Image to Image (Multi-View) ───────────────────────────────

def submit_image_to_image(prompt: str, preview_path: Path) -> str | None:
    """Submit image-to-image with multi-view enabled. Returns task_id."""
    img_bytes = preview_path.read_bytes()
    b64 = base64.b64encode(img_bytes).decode("ascii")
    data_uri = f"data:image/png;base64,{b64}"

    payload = {
        "ai_model": CONFIG["stage2"]["ai_model"],
        "prompt": prompt,
        "reference_image_urls": [data_uri],
        "generate_multi_view": True,
    }

    resp = requests.post(
        f"{MESHY_BASE_URL}/openapi/v1/image-to-image",
        headers=MESHY_HEADERS,
        json=payload,
        timeout=60,
    )

    if resp.status_code not in (200, 202):
        print(f"  [ERROR] S2 submit failed: {resp.status_code} {resp.text}")
        return None

    data = resp.json()
    task_id = data.get("result") or data.get("id")
    print(f"  [S2 SUBMIT] Task ID: {task_id}")
    return task_id


def poll_image_to_image(task_id: str, name: str) -> dict | None:
    """Poll image-to-image until SUCCEEDED or FAILED."""
    while True:
        resp = requests.get(
            f"{MESHY_BASE_URL}/openapi/v1/image-to-image/{task_id}",
            headers=MESHY_HEADERS,
            timeout=30,
        )

        if resp.status_code != 200:
            print(f"  [ERROR] S2 poll failed: {resp.status_code}")
            return None

        task = resp.json()
        status = task.get("status")
        progress = task.get("progress", 0)
        print(f"  [S2 POLL] {name} — {status} {progress}%", end="\r")

        if status == "SUCCEEDED":
            print(f"\n  [S2 DONE] {name}")
            return task

        if status in ("FAILED", "EXPIRED", "CANCELED"):
            print(f"\n  [S2 FAIL] {name} — {status}")
            return None

        time.sleep(POLL_INTERVAL)


# ── Stage 3: Meshy Multi-Image to 3D ─────────────────────────────────────────

def submit_multi_image_to_3d(image_urls: list[str]) -> str | None:
    """Submit multi-image-to-3d task. Returns task_id."""
    payload = {
        "image_urls": image_urls,
        "ai_model": CONFIG["stage3"]["ai_model"],
        "target_polycount": CONFIG["stage3"]["target_polycount"],
        "enable_pbr": CONFIG["stage3"]["enable_pbr"],
    }

    resp = requests.post(
        f"{MESHY_BASE_URL}/openapi/v1/multi-image-to-3d",
        headers=MESHY_HEADERS,
        json=payload,
        timeout=30,
    )

    if resp.status_code not in (200, 202):
        print(f"  [ERROR] S3 submit failed: {resp.status_code} {resp.text}")
        return None

    data = resp.json()
    task_id = data.get("result") or data.get("id")
    print(f"  [S3 SUBMIT] Task ID: {task_id}")
    return task_id


def poll_multi_image_to_3d(task_id: str, name: str) -> dict | None:
    """Poll multi-image-to-3d until SUCCEEDED or FAILED."""
    while True:
        resp = requests.get(
            f"{MESHY_BASE_URL}/openapi/v1/multi-image-to-3d/{task_id}",
            headers=MESHY_HEADERS,
            timeout=30,
        )

        if resp.status_code != 200:
            print(f"  [ERROR] S3 poll failed: {resp.status_code}")
            return None

        task = resp.json()
        status = task.get("status")
        progress = task.get("progress", 0)
        print(f"  [S3 POLL] {name} — {status} {progress}%", end="\r")

        if status == "SUCCEEDED":
            print(f"\n  [S3 DONE] {name}")
            return task

        if status in ("FAILED", "EXPIRED", "CANCELED"):
            print(f"\n  [S3 FAIL] {name} — {status}")
            return None

        time.sleep(POLL_INTERVAL)


# ── Stage 4: Meshy Retexture ─────────────────────────────────────────────────

def submit_retexture(remesh_task_id: str, preview_path: Path) -> str | None:
    """Submit retexture task using remesh task ID + front view as style reference."""
    img_bytes = preview_path.read_bytes()
    b64 = base64.b64encode(img_bytes).decode("ascii")
    data_uri = f"data:image/png;base64,{b64}"

    payload = {
        "input_task_id": remesh_task_id,
        "image_style_url": data_uri,
        "ai_model": "meshy-6",
        "enable_pbr": False,
        "remove_lighting": True,
    }

    resp = requests.post(
        f"{MESHY_BASE_URL}/openapi/v1/retexture",
        headers=MESHY_HEADERS,
        json=payload,
        timeout=60,
    )

    if resp.status_code not in (200, 202):
        print(f"  [ERROR] S4 submit failed: {resp.status_code} {resp.text}")
        return None

    data = resp.json()
    task_id = data.get("result") or data.get("id")
    print(f"  [S4 SUBMIT] Task ID: {task_id}")
    return task_id


def poll_retexture(task_id: str, name: str) -> dict | None:
    """Poll retexture until SUCCEEDED or FAILED."""
    while True:
        resp = requests.get(
            f"{MESHY_BASE_URL}/openapi/v1/retexture/{task_id}",
            headers=MESHY_HEADERS,
            timeout=30,
        )

        if resp.status_code != 200:
            print(f"  [ERROR] S4 poll failed: {resp.status_code}")
            return None

        task = resp.json()
        status = task.get("status")
        progress = task.get("progress", 0)
        print(f"  [S4 POLL] {name} — {status} {progress}%", end="\r")

        if status == "SUCCEEDED":
            print(f"\n  [S4 DONE] {name}")
            return task

        if status in ("FAILED", "EXPIRED", "CANCELED"):
            print(f"\n  [S4 FAIL] {name} — {status}")
            return None

        time.sleep(POLL_INTERVAL)


# ── Stage 5: Meshy Rigging ────────────────────────────────────────────────────

def submit_rigging(height_meters: float, input_task_id: str = None, model_url: str = None) -> str | None:
    """Submit rigging task for a humanoid model. Returns task_id.
    Use input_task_id for Meshy task reference, or model_url for direct GLB upload."""
    payload = {"height_meters": height_meters}
    if model_url:
        payload["model_url"] = model_url
    elif input_task_id:
        payload["input_task_id"] = input_task_id

    resp = requests.post(
        f"{MESHY_BASE_URL}/openapi/v1/rigging",
        headers=MESHY_HEADERS,
        json=payload,
        timeout=30,
    )

    if resp.status_code not in (200, 202):
        print(f"  [ERROR] S5 submit failed: {resp.status_code} {resp.text}")
        return None

    data = resp.json()
    task_id = data.get("result") or data.get("id")
    print(f"  [S5 SUBMIT] Task ID: {task_id}")
    return task_id


def poll_rigging(task_id: str, name: str) -> dict | None:
    """Poll rigging until SUCCEEDED or FAILED."""
    while True:
        resp = requests.get(
            f"{MESHY_BASE_URL}/openapi/v1/rigging/{task_id}",
            headers=MESHY_HEADERS,
            timeout=30,
        )

        if resp.status_code != 200:
            print(f"  [ERROR] S5 poll failed: {resp.status_code}")
            return None

        task = resp.json()
        status = task.get("status")
        progress = task.get("progress", 0)
        print(f"  [S5 POLL] {name} — {status} {progress}%", end="\r")

        if status == "SUCCEEDED":
            print(f"\n  [S5 DONE] {name}")
            return task

        if status in ("FAILED", "EXPIRED", "CANCELED"):
            print(f"\n  [S5 FAIL] {name} — {status}")
            return None

        time.sleep(POLL_INTERVAL)


# ── Stage 6: Meshy Animation ─────────────────────────────────────────────────

def submit_animation(rig_task_id: str, action_id: int, fps: int) -> str | None:
    """Submit animation task. Returns task_id."""
    payload = {
        "rig_task_id": rig_task_id,
        "action_id": action_id,
        "post_process": {
            "operation_type": "change_fps",
            "fps": fps,
        },
    }

    resp = requests.post(
        f"{MESHY_BASE_URL}/openapi/v1/animations",
        headers=MESHY_HEADERS,
        json=payload,
        timeout=30,
    )

    if resp.status_code not in (200, 202):
        print(f"  [ERROR] S6 submit failed: {resp.status_code} {resp.text}")
        return None

    data = resp.json()
    task_id = data.get("result") or data.get("id")
    print(f"  [S6 SUBMIT] Task ID: {task_id}")
    return task_id


def poll_animation(task_id: str, name: str, clip_name: str) -> dict | None:
    """Poll animation until SUCCEEDED or FAILED."""
    while True:
        resp = requests.get(
            f"{MESHY_BASE_URL}/openapi/v1/animations/{task_id}",
            headers=MESHY_HEADERS,
            timeout=30,
        )

        if resp.status_code != 200:
            print(f"  [ERROR] S6 poll failed: {resp.status_code}")
            return None

        task = resp.json()
        status = task.get("status")
        progress = task.get("progress", 0)
        print(f"  [S6 POLL] {name}/{clip_name} — {status} {progress}%", end="\r")

        if status == "SUCCEEDED":
            print(f"\n  [S6 DONE] {name}/{clip_name}")
            return task

        if status in ("FAILED", "EXPIRED", "CANCELED"):
            print(f"\n  [S6 FAIL] {name}/{clip_name} — {status}")
            return None

        time.sleep(POLL_INTERVAL)


def get_action_ids(faction: str) -> dict[str, int]:
    """Merge default action IDs with faction-specific overrides."""
    ids = dict(ANIM_CONFIG.get("default_action_ids", {}))
    overrides = ANIM_CONFIG.get("faction_action_ids", {}).get(faction, {})
    ids.update(overrides)
    return ids


def animate_clip(rig_task_id: str, filename: str, clip_name: str, action_id: int,
                 fps: int, anim_dir: Path, entry: dict) -> bool:
    """Submit, poll, and download one animation clip. Returns True on success."""
    log_key = f"stage6_anim_{clip_name}"
    log_key_tid = f"stage6_anim_{clip_name}_task_id"
    clip_dest = anim_dir / f"{clip_name}.glb"

    anim_task_id = submit_animation(rig_task_id, action_id, fps)
    if not anim_task_id:
        entry[log_key] = "failed"
        return False

    task = poll_animation(anim_task_id, filename, clip_name)
    if not task:
        entry[log_key] = "failed"
        entry[log_key_tid] = anim_task_id
        return False

    # Animation API returns result.glb_url or result.animation_glb_url
    result_data = task.get("result", {})
    glb_url = (
        result_data.get("glb_url")
        or result_data.get("animation_glb_url")
        or task.get("model_urls", {}).get("glb")
    )
    if not glb_url:
        print(f"  [ERROR] S6/{clip_name} returned no glb URL. Keys: {list(result_data.keys())}")
        entry[log_key] = "failed"
        return False

    if not download_file(glb_url, clip_dest):
        entry[log_key] = "failed"
        return False

    entry[log_key] = "success"
    entry[log_key_tid] = anim_task_id
    return True


# ── Download ──────────────────────────────────────────────────────────────────

def download_file(url: str, dest: Path) -> bool:
    """Download file from URL to dest path."""
    resp = requests.get(url, timeout=120)
    if resp.status_code != 200:
        print(f"  [ERROR] Download failed: {resp.status_code}")
        return False

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(resp.content)
    size_kb = len(resp.content) // 1024
    print(f"  [SAVE] {dest.name} ({size_kb}kb)")
    return True


# ── Log Management ────────────────────────────────────────────────────────────

LOG_LOCK = threading.Lock()


def load_log() -> dict:
    if LOG_FILE.exists():
        with open(LOG_FILE) as f:
            return json.load(f)
    return {}


def save_log(log: dict):
    LOGS_DIR.mkdir(exist_ok=True)
    with LOG_LOCK:
        snapshot = copy.deepcopy(log)
    with open(LOG_FILE, 'w') as f:
        json.dump(snapshot, f, indent=2)


# ── Unit Processing ──────────────────────────────────────────────────────────

def process_unit(unit: dict, log: dict, preview_only: bool = False,
                  from_previews: bool = False, rig_only: bool = False) -> str:
    """
    Process one unit through all stages.
    Stages 1-4: Meshy generation pipeline (all units).
    Stages 5-7: Meshy rig + animate + Blender merge (humanoid units only).
    Returns: 'skipped' | 'success' | 'failed' | 'preview'
    """
    filename = unit["filename"]
    glb_dest = RAW_DIR / f"{filename}.glb"
    final_dest = FINAL_DIR / f"{filename}.glb"
    preview_dest = PREVIEWS_DIR / f"{filename}.png"
    entry = log.get(filename, {})

    is_humanoid = unit["unit_type"] in HUMANOID_TYPES

    # Already fully done
    if not rig_only and final_dest.exists() and entry.get("status") == "success":
        print(f"[SKIP] {filename} — already complete")
        return "skipped"

    # --rig-only: skip to stages 5-7 for humanoids only
    if rig_only:
        if not is_humanoid:
            print(f"[SKIP] {filename} — not humanoid, skipping rig")
            return "skipped"
        if entry.get("stage4") != "success":
            print(f"[SKIP] {filename} — stage 4 not complete, cannot rig")
            return "skipped"
        # Fall through to stages 5-7 below (stages 1-4 skipped)

    print(f"\n[UNIT] {filename}")

    # ── Stage 1: Meshy Text to Image ──
    if rig_only:
        pass  # skip stages 1-4
    elif not from_previews:
        if preview_dest.exists() and entry.get("stage1") == "success":
            print(f"  [S1 SKIP] Preview exists")
        else:
            task_id = submit_text_to_image(unit["prompt"])
            if not task_id:
                entry["stage1"] = "failed"
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            task = poll_text_to_image(task_id, filename)
            if not task:
                entry["stage1"] = "failed"
                entry["stage1_task_id"] = task_id
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            image_urls = task.get("image_urls", [])
            if not image_urls:
                print(f"  [ERROR] S1 returned no image_urls")
                entry["stage1"] = "failed"
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            if not download_file(image_urls[0], preview_dest):
                entry["stage1"] = "failed"
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            entry["stage1"] = "success"
            entry["stage1_task_id"] = task_id
            log[filename] = entry
            save_log(log)

    if not rig_only:
        if preview_only:
            entry["status"] = "preview_done"
            log[filename] = entry
            return "preview"

        # Verify preview exists before stage 2
        if not preview_dest.exists():
            print(f"  [ERROR] No preview at {preview_dest}")
            entry["status"] = "failed"
            log[filename] = entry
            return "failed"

        # ── Stage 2: Meshy Image to Image (Multi-View) ──
        multiview_urls = entry.get("stage2_image_urls")

        if entry.get("stage2") == "success" and multiview_urls:
            print(f"  [S2 SKIP] Multi-view URLs cached")
        else:
            task_id = submit_image_to_image(unit["prompt"], preview_dest)
            if not task_id:
                entry["stage2"] = "failed"
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            task = poll_image_to_image(task_id, filename)
            if not task:
                entry["stage2"] = "failed"
                entry["stage2_task_id"] = task_id
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            multiview_urls = task.get("image_urls", [])
            if not multiview_urls:
                print(f"  [ERROR] S2 returned no image_urls")
                entry["stage2"] = "failed"
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            entry["stage2"] = "success"
            entry["stage2_task_id"] = task_id
            entry["stage2_image_urls"] = multiview_urls
            log[filename] = entry
            save_log(log)

        # ── Stage 3: Meshy Multi-Image to 3D ──
        if entry.get("stage3") == "success" and glb_dest.exists():
            print(f"  [S3 SKIP] Raw GLB exists")
        else:
            task_id = submit_multi_image_to_3d(multiview_urls)
            if not task_id:
                entry["stage3"] = "failed"
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            task = poll_multi_image_to_3d(task_id, filename)
            if not task:
                entry["stage3"] = "failed"
                entry["stage3_task_id"] = task_id
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            glb_url = task.get("model_urls", {}).get("glb")
            if not glb_url:
                print(f"  [ERROR] S3 returned no glb URL")
                entry["stage3"] = "failed"
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            if not download_file(glb_url, glb_dest):
                entry["stage3"] = "failed"
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            entry["stage3"] = "success"
            entry["stage3_task_id"] = task_id
            log[filename] = entry
            save_log(log)

        # ── Stage 4: Meshy Retexture ──
        s3_task_id = entry.get("stage3_task_id")

        if entry.get("stage4") == "success" and final_dest.exists():
            print(f"  [S4 SKIP] Final GLB exists")
        else:
            retexture_task_id = submit_retexture(s3_task_id, preview_dest)
            if not retexture_task_id:
                entry["stage4"] = "failed"
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            task = poll_retexture(retexture_task_id, filename)
            if not task:
                entry["stage4"] = "failed"
                entry["stage4_task_id"] = retexture_task_id
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            glb_url = task.get("model_urls", {}).get("glb")
            if not glb_url:
                print(f"  [ERROR] S4 returned no glb URL")
                entry["stage4"] = "failed"
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            if not download_file(glb_url, final_dest):
                entry["stage4"] = "failed"
                entry["status"] = "failed"
                log[filename] = entry
                return "failed"

            entry["stage4"] = "success"
            entry["stage4_task_id"] = retexture_task_id
            log[filename] = entry
            save_log(log)

    # ── Stages 5-7: Humanoid rigging + animation ──
    if is_humanoid:
        anim_dir = MESHY_ANIMS_DIR / filename
        animated_dest = ANIMATED_DIR / f"{filename}.glb"
        clip_names = ["idle", "move", "attack", "hit", "death"]

        # Check if already fully animated
        if entry.get("stage7_merge") == "success" and animated_dest.exists():
            print(f"  [S5-7 SKIP] Animated GLB exists")
        else:
            # ── Stage 4b: Decimate for rigging (< 300k faces) ──
            decimated_dest = RIGGED_DIR / f"{filename}_decimated.glb"
            if entry.get("stage4b_decimate") == "success" and decimated_dest.exists():
                print(f"  [S4b SKIP] Decimated GLB exists")
            else:
                blender_path = CONFIG.get("blender_path", "blender")
                decimate_script = PIPELINE_DIR / "4_decimate.py"
                target_faces = ANIM_CONFIG.get("decimate_target", 250000)

                decimated_dest.parent.mkdir(parents=True, exist_ok=True)
                cmd = [
                    blender_path, "--background", "--python", str(decimate_script),
                    "--",
                    "--input", str(final_dest),
                    "--output", str(decimated_dest),
                    "--target-faces", str(target_faces),
                ]
                print(f"  [S4b DECIMATE] Running Blender decimate to {target_faces} faces...")
                result = subprocess.run(cmd, capture_output=True, timeout=120)

                if result.returncode != 0:
                    stderr = result.stderr.decode("utf-8", errors="replace")[-500:]
                    print(f"  [S4b FAIL] Blender decimate failed:\n{stderr}")
                    entry["stage4b_decimate"] = "failed"
                    entry["status"] = "failed"
                    log[filename] = entry
                    return "failed"

                entry["stage4b_decimate"] = "success"
                log[filename] = entry
                save_log(log)
                print(f"  [S4b DONE] {filename}")

            # ── Stage 5: Rig ──
            if entry.get("stage5_rig") == "success" and entry.get("stage5_rig_task_id"):
                print(f"  [S5 SKIP] Rig exists")
            else:
                # Upload decimated GLB as data URI for rigging
                glb_bytes = decimated_dest.read_bytes()
                b64 = base64.b64encode(glb_bytes).decode("ascii")
                data_uri = f"data:application/octet-stream;base64,{b64}"

                rig_task_id = submit_rigging(
                    ANIM_CONFIG.get("height_meters", 1.7),
                    model_url=data_uri,
                )
                if not rig_task_id:
                    entry["stage5_rig"] = "failed"
                    entry["status"] = "failed"
                    log[filename] = entry
                    return "failed"

                task = poll_rigging(rig_task_id, filename)
                if not task:
                    entry["stage5_rig"] = "failed"
                    entry["stage5_rig_task_id"] = rig_task_id
                    entry["status"] = "failed"
                    log[filename] = entry
                    return "failed"

                rigged_dest = RIGGED_DIR / f"{filename}.glb"
                result_data = task.get("result", {})
                glb_url = result_data.get("rigged_character_glb_url")
                if not glb_url:
                    print(f"  [ERROR] S5 returned no glb URL. Keys: {list(result_data.keys())}")
                    entry["stage5_rig"] = "failed"
                    entry["status"] = "failed"
                    log[filename] = entry
                    return "failed"

                if not download_file(glb_url, rigged_dest):
                    entry["stage5_rig"] = "failed"
                    entry["status"] = "failed"
                    log[filename] = entry
                    return "failed"

                entry["stage5_rig"] = "success"
                entry["stage5_rig_task_id"] = rig_task_id
                log[filename] = entry
                save_log(log)

            # ── Stage 6: Animate (5 clips in parallel) ──
            rig_task_id = entry.get("stage5_rig_task_id")
            action_ids = get_action_ids(unit["faction"])
            fps = ANIM_CONFIG.get("fps", 24)
            anim_dir.mkdir(parents=True, exist_ok=True)

            # Find clips that still need processing
            pending_clips = []
            for cn in clip_names:
                log_key = f"stage6_anim_{cn}"
                clip_dest = anim_dir / f"{cn}.glb"
                if entry.get(log_key) == "success" and clip_dest.exists():
                    print(f"  [S6 SKIP] {cn} clip exists")
                else:
                    pending_clips.append(cn)

            if pending_clips:
                results_s6 = {}

                def run_clip(cn):
                    return cn, animate_clip(
                        rig_task_id, filename, cn, action_ids[cn], fps, anim_dir, entry
                    )

                with ThreadPoolExecutor(max_workers=5) as pool:
                    futures = {pool.submit(run_clip, cn): cn for cn in pending_clips}
                    for future in as_completed(futures):
                        cn, ok = future.result()
                        results_s6[cn] = ok

                log[filename] = entry
                save_log(log)

                if not all(results_s6.values()):
                    failed_clips = [cn for cn, ok in results_s6.items() if not ok]
                    print(f"  [S6 FAIL] Failed clips: {', '.join(failed_clips)}")
                    entry["status"] = "failed"
                    log[filename] = entry
                    return "failed"

            # ── Stage 7: Merge clips in Blender ──
            if entry.get("stage7_merge") == "success" and animated_dest.exists():
                print(f"  [S7 SKIP] Merged animation exists")
            else:
                blender_path = CONFIG.get("blender_path", "blender")
                merge_script = PIPELINE_DIR / "3_merge_animations.py"
                clip_args = []
                for cn in clip_names:
                    clip_args.extend(["--clip", cn, str(anim_dir / f"{cn}.glb")])

                animated_dest.parent.mkdir(parents=True, exist_ok=True)
                cmd = [
                    blender_path, "--background", "--python", str(merge_script),
                    "--",
                    "--output", str(animated_dest),
                    *clip_args,
                ]
                print(f"  [S7 MERGE] Running Blender merge...")
                result = subprocess.run(cmd, capture_output=True, timeout=120)

                if result.returncode != 0:
                    stderr = result.stderr.decode("utf-8", errors="replace")[-500:]
                    print(f"  [S7 FAIL] Blender merge failed:\n{stderr}")
                    entry["stage7_merge"] = "failed"
                    entry["status"] = "failed"
                    log[filename] = entry
                    return "failed"

                entry["stage7_merge"] = "success"
                log[filename] = entry
                save_log(log)
                print(f"  [S7 DONE] {filename}")

            # ── Stage 8: Apply skin (texture transfer) ──
            if entry.get("stage8_skin") == "success" and animated_dest.exists():
                print(f"  [S8 SKIP] Skin already applied")
            else:
                skin_script = PIPELINE_DIR / "5_apply_skin.py"
                # Apply skin to a temp file, then replace the animated output
                skinned_tmp = animated_dest.with_suffix(".skinned.glb")
                cmd = [
                    sys.executable, str(skin_script),
                    "--source", str(final_dest),
                    "--target", str(animated_dest),
                    "--output", str(skinned_tmp),
                ]
                print(f"  [S8 SKIN] Applying textures...")
                result = subprocess.run(cmd, capture_output=True, timeout=60)

                if result.returncode != 0:
                    stderr = result.stderr.decode("utf-8", errors="replace")[-500:]
                    print(f"  [S8 FAIL] Skin transfer failed:\n{stderr}")
                    entry["stage8_skin"] = "failed"
                    entry["status"] = "failed"
                    log[filename] = entry
                    return "failed"

                # Replace animated output with skinned version
                skinned_tmp.replace(animated_dest)
                entry["stage8_skin"] = "success"
                log[filename] = entry
                save_log(log)
                print(f"  [S8 DONE] {filename}")

    entry["status"] = "success"
    entry["unit_type"] = unit["unit_type"]
    entry["faction"] = unit["faction"]
    log[filename] = entry
    return "success"


# ── Status Checklist ──────────────────────────────────────────────────────────

STAGE_ICONS = {"success": "+", "failed": "X", "": "-"}

def print_status(all_units: list[dict], log: dict):
    """Print a checklist of all assets with per-stage progress."""
    counts = {"done": 0, "partial": 0, "pending": 0, "failed": 0}
    current_group = None

    for unit in all_units:
        fn = unit["filename"]
        entry = log.get(fn, {})
        s1 = entry.get("stage1", "")
        s2 = entry.get("stage2", "")
        s3 = entry.get("stage3", "")
        s4 = entry.get("stage4", "")
        overall = entry.get("status", "")

        # Group header by faction
        group = unit["faction"] if unit["unit_type"] != "prop" else "props"
        if group != current_group:
            current_group = group
            print(f"\n  {group.upper()}")

        # Icons
        i1 = STAGE_ICONS.get(s1, "?")
        i2 = STAGE_ICONS.get(s2, "?")
        i3 = STAGE_ICONS.get(s3, "?")
        i4 = STAGE_ICONS.get(s4, "?")

        if overall == "success":
            tag = "[DONE]"
            counts["done"] += 1
        elif overall == "failed":
            tag = "[FAIL]"
            counts["failed"] += 1
        elif s1 or s2 or s3 or s4:
            tag = "[....]"
            counts["partial"] += 1
        else:
            tag = "[    ]"
            counts["pending"] += 1

        # Extra columns for humanoid units
        extra = ""
        if unit["unit_type"] in HUMANOID_TYPES:
            i5 = STAGE_ICONS.get(entry.get("stage5_rig", ""), "?")
            anim_done = sum(1 for c in ["idle", "move", "attack", "hit", "death"]
                           if entry.get(f"stage6_anim_{c}") == "success")
            i6 = f"{anim_done}/5"
            i7 = STAGE_ICONS.get(entry.get("stage7_merge", ""), "?")
            i8 = STAGE_ICONS.get(entry.get("stage8_skin", ""), "?")
            extra = f"  S5[{i5}] S6[{i6}] S7[{i7}] S8[{i8}]"

        print(f"    {tag} {fn:<30s}  S1[{i1}] S2[{i2}] S3[{i3}] S4[{i4}]{extra}")

    total = len(all_units)
    print(f"\n  TOTAL: {total}")
    print(f"  Done: {counts['done']}  Partial: {counts['partial']}  Pending: {counts['pending']}  Failed: {counts['failed']}")
    remaining = total - counts["done"]
    if remaining > 0:
        print(f"  Remaining: {remaining}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="4-stage pipeline: text-to-image → multi-view → 3D → retexture"
    )

    # Unit selection
    parser.add_argument("--all", action="store_true", help="Process all assets")
    parser.add_argument("--unit", type=str, help="Process single unit by filename (without .glb)")
    parser.add_argument("--retry-failed", action="store_true", help="Retry failed units")
    parser.add_argument("--limit", type=int, help="Max units to process in this run")
    parser.add_argument("--assets", type=str, help="Path to ASSETS.md (default: from config)")

    # Execution control
    parser.add_argument("--status", action="store_true", help="Show checklist of all assets and their progress")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, show prompts, no API calls")
    parser.add_argument("--preview-only", action="store_true", help="Stage 1 only — generate front view PNGs")
    parser.add_argument("--from-previews", action="store_true", help="Skip stage 1, run stages 2+3 from existing previews")
    parser.add_argument("--rig-only", action="store_true", help="Skip stages 1-4, run stages 5-7 only (rig + animate + merge) for humanoid units")
    parser.add_argument("--workers", type=int, default=1, help="Concurrent units to process (default: 1, max ~6 for 20-task queue)")

    args = parser.parse_args()

    # Resolve ASSETS.md path
    if args.assets:
        assets_path = Path(args.assets)
    else:
        assets_path = PIPELINE_DIR / CONFIG["paths"]["assets_md"]

    if not assets_path.exists():
        print(f"[ERROR] ASSETS.md not found at {assets_path}")
        sys.exit(1)

    all_units = parse_assets_md(str(assets_path))
    log = load_log()

    # Status checklist
    if args.status:
        print_status(all_units, log)
        sys.exit(0)

    # Filter units
    if args.unit:
        units = [u for u in all_units if u["filename"] == args.unit]
        if not units:
            print(f"[ERROR] Unit '{args.unit}' not found in ASSETS.md")
            sys.exit(1)

    elif args.retry_failed:
        failed = {k for k, v in log.items() if v.get("status") == "failed"}
        units = [u for u in all_units if u["filename"] in failed]
        print(f"[RETRY] {len(units)} failed units")

    elif args.all:
        units = all_units

    else:
        parser.print_help()
        sys.exit(0)

    # Apply limit
    if args.limit and args.limit > 0:
        units = units[:args.limit]
        print(f"[LIMIT] Processing {len(units)} units")

    # Dry run — show prompts only (no API key needed)
    if args.dry_run:
        for u in units:
            print(f"\n{'='*60}")
            print(f"FILE: {u['filename']}.glb")
            print(f"TYPE: {u['unit_type']} | FACTION: {u['faction']}")
            print(f"PROMPT ({len(u['prompt'])} chars):")
            print(u['prompt'])
        sys.exit(0)

    # Process units
    results = {"success": 0, "failed": 0, "skipped": 0, "preview": 0}
    results_lock = threading.Lock()
    counter = [0]
    counter_lock = threading.Lock()

    def run_unit(unit):
        with counter_lock:
            counter[0] += 1
            idx = counter[0]
        print(f"\n[{idx}/{len(units)}]", end=" ")
        result = process_unit(
            unit, log,
            preview_only=args.preview_only,
            from_previews=args.from_previews,
            rig_only=args.rig_only,
        )
        with results_lock:
            results[result] += 1
        save_log(log)
        return result

    workers = min(args.workers, len(units))

    if workers <= 1:
        for unit in units:
            run_unit(unit)
    else:
        print(f"[PARALLEL] {workers} workers, 10 queue slots")
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(run_unit, u): u for u in units}
            for future in as_completed(futures):
                future.result()

    # Summary
    print(f"\n{'='*60}")
    parts = [f"{k.title()}: {v}" for k, v in results.items() if v > 0]
    print(f"[DONE] {' | '.join(parts)}")
    print(f"[LOG] {LOG_FILE}")

    if results["failed"] > 0:
        failed_units = [k for k, v in log.items() if v.get("status") == "failed"]
        print(f"[FAILED]: {', '.join(failed_units)}")
        print("Run with --retry-failed to retry")


if __name__ == "__main__":
    main()
