"""MeowMemo inference API.

POST /analyze  (multipart: file, optional start, end in seconds)
Returns what the models actually computed. There is no fallback or demo answer:
if the models are not trained, the endpoint returns 503.
"""
import json
import os
import tempfile
from pathlib import Path

import joblib
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from features import DETECTOR_COLS, SR, active_segment, extract, is_silent, load_audio, segments

HERE = Path(__file__).parent
MODEL_DIR = Path(os.environ.get("MODEL_DIR", HERE / "model"))
MAX_BYTES = 8 * 1024 * 1024
MIN_S, MAX_S = 1.5, 16.0  # small tolerance around the app's 2-15 s rule

CONTEXT_TEXT = {
    "food": "Sounds like meows recorded while cats were waiting for food",
    "brushing": "Sounds like meows recorded while cats were being brushed",
    "isolation": "Sounds like meows recorded while cats were alone in an unfamiliar room",
}

app = FastAPI(title="MeowMemo API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_models = None
_meta = None
_metrics = None


def models():
    global _models, _meta, _metrics
    if _models is None:
        if not (MODEL_DIR / "models.joblib").exists():
            raise HTTPException(503, "Model not trained yet. Run train.py first.")
        _models = joblib.load(MODEL_DIR / "models.joblib")
        _meta = json.loads((MODEL_DIR / "meta.json").read_text())
        metrics_path = HERE / "reports" / "metrics.json"
        _metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}
    return _models, _meta, _metrics


@app.get("/health")
def health():
    ready = (MODEL_DIR / "models.joblib").exists()
    out = {"ok": True, "model_ready": ready}
    if ready:
        _, meta, _ = models()
        out["model_version"] = meta["model_version"]
        out["detector_enabled"] = meta["detector"] is not None
    return out


@app.get("/metrics")
def metrics():
    _, _, m = models()
    return m


def describe_pitch(y):
    import librosa

    f0 = librosa.yin(y, fmin=150, fmax=1500, sr=SR, frame_length=1024, hop_length=128)
    f0 = f0[np.isfinite(f0)]
    if len(f0) < 4:
        return None
    third = max(1, len(f0) // 3)
    start, end = np.median(f0[:third]), np.median(f0[-third:])
    shape = "rising" if end > start * 1.15 else "falling" if end < start * 0.87 else "fairly level"
    return f"Main pitch around {int(round(np.median(f0), -1))} Hz, {shape} over the sound"


@app.post("/analyze")
async def analyze(file: UploadFile = File(...), start: float | None = Form(None), end: float | None = Form(None)):
    bundle, meta, metrics_ = models()
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Clip is too large (max 8 MB).")

    suffix = Path(file.filename or "clip").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        tmp.write(data)
        tmp.flush()
        try:
            y = load_audio(tmp.name, start, end)
        except Exception:
            raise HTTPException(400, "Couldn't read that audio file. Try WAV, MP3, M4A or a new recording.")

    dur = len(y) / SR
    if dur < MIN_S or dur > MAX_S:
        raise HTTPException(400, f"Clip is {dur:.1f} s. Please use 2-15 seconds.")

    base = {"model_version": meta["model_version"], "duration_s": round(dur, 2)}

    if is_silent(y):
        return {**base, "detection": "not_detected", "reason": "silence", "contexts": [],
                "context_unsure": True,
                "evidence": ["The clip is almost silent, so there was nothing to analyse."]}

    segs = segments(y) or [active_segment(y)]
    X = np.vstack([extract(s) for s in segs])
    sound = max(segs, key=len)
    n = len(segs)
    evidence = [f"Found {n} separate sound{'s' if n != 1 else ''} in the clip ({sum(len(s) for s in segs) / SR:.1f} s in total) and analysed each one."]
    pitch = describe_pitch(sound / (np.max(np.abs(sound)) or 1))
    if pitch:
        evidence.append(pitch + ".")

    det = meta["detector"]
    if det is None:
        detection = "uncertain"
        evidence.append("Cat-vs-other screening is not enabled in this build, so the app can't confirm this is a cat.")
    else:
        # The clip's score is its most cat-like sound, the same rule used in evaluation.
        p = float(bundle["detector"].predict_proba(X[:, DETECTOR_COLS])[:, 1].max())
        detection = "likely" if p >= det["likely"] else "not_detected" if p < det["not_detected_below"] else "uncertain"
        d = metrics_.get("detector") or {}
        evidence.append(
            f"Cat screening compares the sound with {d.get('n_positive', 'many')} cat clips and "
            f"{d.get('n_negative', 'many')} other sounds (dogs, people, traffic, rain...)."
        )

    if detection == "not_detected":
        return {**base, "detection": detection, "reason": "not_cat", "contexts": [],
                "context_unsure": True, "evidence": evidence}

    proba = bundle["context"].predict_proba(X).mean(axis=0)
    order = np.argsort(proba)[::-1]
    names = meta["contexts"]
    top = float(proba[order[0]])
    unsure = top < meta["context_abstain_below"]
    contexts = []
    for rank, i in enumerate(order):
        # Keep the closest match, plus others that are genuinely competitive.
        if rank == 0 or proba[i] >= 0.25:
            contexts.append({
                "id": names[i],
                "text": CONTEXT_TEXT[names[i]],
                "rank": "closest match" if rank == 0 and not unsure else "possible",
            })
    c = metrics_.get("context") or {}
    evidence.append(
        f"Situations come from CatMeows: {c.get('n_clips', 440)} meows from {c.get('n_cats', 21)} cats, "
        "recorded in only these 3 situations. Your cat may be in a different situation entirely."
    )
    return {**base, "detection": detection, "contexts": contexts, "context_unsure": unsure, "evidence": evidence}
