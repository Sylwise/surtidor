#!/usr/bin/env python3
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "surtidor.pen"
OUTPUT = HERE / "frames"

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
    "qvNsS": "provincias-mas-baratas-desktop",
    "rBOk6": "provincias-mas-baratas-movil",
    "PEvnN": "marcas-mas-baratas-desktop",
    "sqQ5d": "marcas-mas-baratas-movil",
    "mflc5": "capitales-provincia-desktop",
    "HfY4I": "capitales-provincia-movil",
    "KZy8w": "minimo-nacional-desktop",
    "i2enp": "minimo-nacional-movil",
    "Y7RxG": "marcas-analisis-fiscal-desktop",
    "ZN4E1": "marcas-analisis-fiscal-movil",
    "tHmiP": "principal-cabecera-integrada-desktop",
    "H6Hff": "principal-cabecera-integrada-movil",
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
    frame = frames.get(frame_id)
    if frame is None:
        continue
    target = OUTPUT / f"{slug}.json"
    target.write_text(json.dumps(frame, ensure_ascii=False, indent=2) + "\n")
    manifest["frames"].append({
        "id": frame_id,
        "name": frame.get("name"),
        "width": frame.get("width"),
        "height": frame.get("height"),
        "file": str(target.relative_to(HERE)),
    })

(HERE / "manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
)
