"""Assemble the single-file MeowMemo web page (dist/index.html) from its parts."""
import base64
import glob
import io
import json
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).parent
DATA = HERE.parent / "data"


def wav_b64(y, sr=8000):
    buf = io.BytesIO()
    sf.write(buf, np.asarray(y, dtype=np.float32), sr, format="WAV", subtype="PCM_16")
    return base64.b64encode(buf.getvalue()).decode()


def samples():
    # Two meows from one CatMeows cat waiting for food, joined into a 2-15 s clip.
    meows = sorted(glob.glob(str(DATA / "catmeows/dataset/F_BAC01_*.wav")))[:2]
    gap = np.zeros(3200)
    cat = np.concatenate([gap] + [x for m in meows for x in (sf.read(m)[0], gap)])
    dog = sf.read(sorted(glob.glob(str(DATA / "esc50/esc8k/*-0.wav")))[0])[0]
    note = ("Sample from the {} dataset. The model learned from this recording, so it says little about "
            "accuracy; try a clip of your own cat for a real test.")
    return {
        "cat": {"wav": wav_b64(cat), "note": note.format("CatMeows (Ludovico et al.)")},
        "dog": {"wav": wav_b64(dog), "note": note.format("ESC-50 (Piczak, freesound.org, CC BY-NC)")},
    }


def main():
    page = (HERE / "page.template.html").read_text()
    model = (HERE / "model.json").read_text()
    metrics = json.loads((HERE / "reports/metrics.json").read_text())
    slim = {"context": {k: metrics["context"][k] for k in ["accuracy_unseen_cats", "selective", "abstain_threshold", "macro_f1_unseen_cats"]},
            "detector": {k: metrics["detector"][k] for k in ["recall_catmeows_at_likely", "recall_esc50_cats_at_likely", "false_likely_rate"]}}
    pe = HERE / "reports/personal_eval.json"
    if pe.exists():
        slim["personal"] = json.loads(pe.read_text())["by_labels"]
    parts = {
        "/*FEATURES_JS*/": (HERE / "features.js").read_text(),
        "/*MODEL_JS*/": (HERE / "model.js").read_text(),
        "/*ILLUS_JS*/": (HERE / "illustrations.js").read_text(),
        "/*STYLE_CSS*/": (HERE / "style.css").read_text(),
        "/*MODEL_JSON*/": model,
        "/*METRICS_JSON*/": json.dumps(slim),
        "/*SAMPLES_JSON*/": json.dumps(samples()),
    }
    for k, v in parts.items():
        assert k in page, k
        assert "</script" not in v.lower(), f"{k} would close its script tag"
        page = page.replace(k, v)
    out = HERE / "dist" / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(page)
    print(f"Wrote {out} ({out.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
