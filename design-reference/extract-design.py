#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "surtidor.pen"
OUTPUT = Path(__file__).resolve().parent / "frames"

FRAME_NAMES = {
    "d0yaSA": "principal-desktop",
    "coEwt": "principal-movil",
    "JYmYz": "selector-zona-desktop",
    "MLRlB": "hoy-movil",
    "sHq6P": "selector-zona-movil",
    "bi8Au": "evolucion-desktop",
    "lLXW9": "evolucion-movil",
    "wC99O": "articulo-hoy-desktop",
    "Iqts8": "articulo-hoy-movil",
    "SQ2EH": "estados-interactivos",
}

source = json.loads(SOURCE.read_text())
frames = {node["id"]: node for node in source["children"]}
OUTPUT.mkdir(parents=True, exist_ok=True)

manifest = {
    "source": str(SOURCE),
    "version": source.get("version"),
    "variables": source.get("variables", {}),
    "frames": [],
}

for frame_id, slug in FRAME_NAMES.items():
    frame = frames[frame_id]
    target = OUTPUT / f"{slug}.json"
    target.write_text(json.dumps(frame, ensure_ascii=False, indent=2) + "\n")
    manifest["frames"].append({
        "id": frame_id,
        "name": frame.get("name"),
        "width": frame.get("width"),
        "height": frame.get("height"),
        "file": str(target.relative_to(Path(__file__).resolve().parent)),
    })

(Path(__file__).resolve().parent / "manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
)
