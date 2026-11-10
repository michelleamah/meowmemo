"""Train the in-browser MeowMemo model and export it as model.json.

Features come from features.js (run in Node), the same code the web page runs, so the
model sees training clips and users' clips identically. Evaluation reuses train.py:
leave-one-cat-out for situations, grouped folds for the cat detector.

Usage (from this folder):
    python train_browser.py --catmeows ../data/catmeows --esc50 ../data/esc50
"""
import argparse
import datetime as dt
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "api"))
import train  # noqa: E402  (shared evaluation code)

from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier  # noqa: E402
from sklearn.pipeline import Pipeline  # noqa: E402

DET_COLS = slice(0, 95)  # all features except duration


def js_features(paths):
    with tempfile.TemporaryDirectory() as d:
        lst, out = Path(d) / "files.json", Path(d) / "feats.json"
        lst.write_text(json.dumps([str(p) for p in paths]))
        subprocess.run(["node", str(HERE / "compute_features.js"), str(lst), str(out)], check=True)
        return json.loads(out.read_text())


# ---------- export sklearn models to plain JSON the page can evaluate ----------
def export_forest(m: RandomForestClassifier):
    trees = []
    for est in m.estimators_:
        t = est.tree_
        v = t.value[:, 0, :]
        v = v / v.sum(axis=1, keepdims=True)
        trees.append({
            "f": t.feature.tolist(),
            "t": [float(x) for x in t.threshold],
            "l": t.children_left.tolist(),
            "r": t.children_right.tolist(),
            "v": np.round(v, 6).tolist(),
        })
    return {"type": "forest", "classes": m.classes_.tolist(), "trees": trees}


def export_hgb(m: HistGradientBoostingClassifier):
    assert len(m.classes_) == 2, "binary only"
    trees = []
    for it in m._predictors:
        n = it[0].nodes
        trees.append({
            "f": n["feature_idx"].tolist(),
            "t": [float(x) for x in n["num_threshold"]],
            "l": n["left"].tolist(),
            "r": n["right"].tolist(),
            "leaf": n["is_leaf"].astype(int).tolist(),
            "v": [float(x) for x in n["value"]],
        })
    return {"type": "hgb", "classes": m.classes_.tolist(),
            "baseline": float(np.ravel(m._baseline_prediction)[0]), "trees": trees}


def export_logreg(p: Pipeline):
    sc, lr = p.steps[0][1], p.steps[-1][1]
    return {"type": "logreg", "classes": lr.classes_.tolist(), "mean": sc.mean_.tolist(),
            "scale": sc.scale_.tolist(), "coef": lr.coef_.tolist(), "intercept": lr.intercept_.tolist()}


def export(m):
    if isinstance(m, RandomForestClassifier):
        return export_forest(m)
    if isinstance(m, HistGradientBoostingClassifier):
        return export_hgb(m)
    return export_logreg(m)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catmeows", required=True)
    ap.add_argument("--esc50", required=True)
    args = ap.parse_args()

    reports = HERE / "reports"
    reports.mkdir(exist_ok=True)
    version = "meowmemo-web-" + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M")
    report = {"model_version": version, "features": "features.js (same code in training and in the page)"}

    cm_rows = train.load_catmeows(args.catmeows)
    esc_rows = train.load_esc50(args.esc50)
    print(f"Computing features with features.js for {len(cm_rows) + len(esc_rows)} clips...")
    cache = reports / "js_features.json"
    if cache.exists():
        feats = json.loads(cache.read_text())
    else:
        feats = js_features([p for p, *_ in cm_rows] + [p for p, *_ in esc_rows])
        cache.write_text(json.dumps(feats))
    X_cm = np.array([f["clip"] for f in feats[: len(cm_rows)]])
    F = [np.array(f["segments"]) for f in feats]
    np.savez_compressed(reports / "features_cache.npz", X_cm=X_cm)

    print("Training situation model...")
    # Forest, not the slightly higher-F1 logistic regression: the forest's confidence actually
    # separates right from wrong answers (66% vs 53% overall at the 0.5 cut-off), so "unsure" means
    # something. The logistic model was overconfident and abstaining barely changed its accuracy.
    ctx_model, ctx_t = train.train_context(cm_rows, X_cm, reports, report, force_model="forest")
    report["context"]["model_choice"] = "forest: confidence separates right from wrong answers; logreg was overconfident"

    print("Training cat detector...")
    det_model, det_t = train.train_detector(cm_rows, esc_rows, reports, report, F=F, cols=DET_COLS)

    model = {
        "model_version": version,
        "contexts": train.CONTEXT_NAMES,
        "context_abstain_below": ctx_t,
        "detector_thresholds": det_t,
        "detector_cols": 95,
        "context": export(ctx_model),
        "detector": export(det_model),
        # For the on-device personal model (personal.js): standardise features the same way.
        "feature_mean": [round(float(v), 6) for v in X_cm.mean(axis=0)],
        "feature_std": [round(float(v) + 1e-9, 6) for v in X_cm.std(axis=0)],
        "personal": {"tau": 1.0, "k0": 6, "w_max": 0.6, "min_situations": 2},
        "stats": {
            "n_cat_clips": report["detector"]["n_positive"],
            "n_other_clips": report["detector"]["n_negative"],
            "n_meows": report["context"]["n_clips"],
            "n_cats": report["context"]["n_cats"],
        },
    }
    (HERE / "model.json").write_text(json.dumps(model, separators=(",", ":")))
    (reports / "metrics.json").write_text(json.dumps(report, indent=2))

    # Reference predictions so the page's JS evaluation can be checked against sklearn.
    ref_idx = list(range(0, len(feats), 25))
    ref = []
    for i in ref_idx:
        seg = F[i]
        ref.append({
            "segments": seg.tolist(),
            "detector": det_model.predict_proba(seg[:, DET_COLS])[:, 1].tolist(),
            "context": ctx_model.predict_proba(seg).tolist(),
        })
    (reports / "parity_reference.json").write_text(json.dumps(ref))
    size = (HERE / "model.json").stat().st_size / 1e6
    print(f"Saved model.json ({size:.1f} MB), {version}")


if __name__ == "__main__":
    main()
