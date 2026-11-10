"""Train MeowMemo's two models and write an honest evaluation report.

1. Detector: "is this a cat vocalization?" Positives are CatMeows plus the ESC-50 cat
   class; negatives are the other 49 ESC-50 classes (dogs, people, rain, engines...).
2. Context: which of CatMeows' three recording situations does a meow most resemble?
   (waiting for food / being brushed / alone in an unfamiliar room)

Every evaluation splits by cat (CatMeows) or by ESC-50 fold, so no individual cat or
source recording appears in both training and test data.

Usage:
    python train.py --catmeows path/to/CatMeows [--esc50 path/to/ESC-50]
"""
import argparse
import datetime as dt
import json
import re
from pathlib import Path

import joblib
import matplotlib
import numpy as np
from joblib import Parallel, delayed
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import GroupKFold, LeaveOneGroupOut, StratifiedKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from features import DETECTOR_COLS, extract, load_audio, segments

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

CONTEXTS = {"F": "food", "B": "brushing", "I": "isolation"}
CONTEXT_NAMES = ["food", "brushing", "isolation"]
ESC_CAT = 5
ESC_GROUPS = {  # used only to report false positives on the sounds that matter most
    "dog": [0], "people": [20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
}
# CatMeows filename: C_NNNNN_BB_SS_OOOOO_RXX.wav  (C = context, NNNNN = cat id)
CM_RE = re.compile(r"^([BFI])_([A-Z0-9]+)_")
# ESC-50 filename: {fold}-{clip}-{take}-{target}.wav
ESC_RE = re.compile(r"^(\d)-\d+-[A-Z]-(\d+)\.wav$")


def feats(paths):
    def one(p):
        return extract(load_audio(str(p)))
    return np.vstack(Parallel(n_jobs=-1)(delayed(one)(p) for p in paths))


def load_catmeows(root):
    rows = []
    for p in sorted(Path(root).rglob("*.wav")):
        m = CM_RE.match(p.name)
        if m:
            rows.append((p, CONTEXTS[m.group(1)], m.group(2)))
    if not rows:
        raise SystemExit(f"No CatMeows .wav files found under {root}")
    return rows


def load_esc50(root):
    rows = []
    for p in sorted(Path(root).rglob("*.wav")):
        m = ESC_RE.match(p.name)
        if m:
            rows.append((p, int(m.group(2)), int(m.group(1))))
    return rows


def candidates(kind):
    return {  # context models; the detector's are in detector_models()
        "logreg": make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, class_weight="balanced", C=0.3)),
        "forest": RandomForestClassifier(n_estimators=400, min_samples_leaf=2, class_weight="balanced", n_jobs=-1, random_state=0),
    }


def oof_proba(model, X, y, groups, splitter):
    """Out-of-fold probabilities: every clip is scored by a model that never saw its group."""
    proba = np.zeros((len(y), len(np.unique(y))))
    for tr, te in splitter.split(X, y, groups):
        m = clone(model).fit(X[tr], y[tr])
        proba[te] = m.predict_proba(X[te])
    return proba


def plot_cm(cm, labels, path, title):
    fig, ax = plt.subplots(figsize=(4.2, 3.6))
    ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(labels)), labels)
    ax.set_yticks(range(len(labels)), labels)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_title(title, fontsize=10)
    for i in range(len(labels)):
        for j in range(len(labels)):
            ax.text(j, i, cm[i, j], ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def train_context(cm_rows, X_cm, out, report, force_model=None):
    y = np.array([CONTEXT_NAMES.index(c) for _, c, _ in cm_rows])
    cats = np.array([cat for _, _, cat in cm_rows])
    logo = LeaveOneGroupOut()

    results = {}
    for name, model in candidates("context").items():
        proba = oof_proba(model, X_cm, y, cats, logo)
        results[name] = (f1_score(y, proba.argmax(1), average="macro"), proba)
        print(f"  context {name}: macro-F1 on unseen cats = {results[name][0]:.3f}")
    best = force_model or max(results, key=lambda k: results[k][0])
    f1, proba = results[best]
    pred = proba.argmax(1)

    # Baselines, so the number means something.
    majority = f1_score(y, np.full_like(y, np.bincount(y).argmax()), average="macro")
    rng = np.random.default_rng(0)
    chance = np.mean([f1_score(y, rng.permutation(y), average="macro") for _ in range(200)])
    # Leakage demo: random clip split lets the same cat appear in train and test.
    leaky = oof_proba(candidates("context")[best], X_cm, y, None,
                      StratifiedKFold(5, shuffle=True, random_state=0))
    leaky_f1 = f1_score(y, leaky.argmax(1), average="macro")

    # Abstention: if the top context is below this, the app says "unsure which".
    conf = proba.max(1)
    sel = {}
    for t in [0.4, 0.5, 0.6, 0.7]:
        keep = conf >= t
        sel[str(t)] = {
            "coverage": float(keep.mean()),
            "accuracy_when_answering": float((pred[keep] == y[keep]).mean()) if keep.any() else None,
        }
    threshold = 0.5

    cm = confusion_matrix(y, pred)
    plot_cm(cm, CONTEXT_NAMES, out / "context_confusion_matrix.png", "Context (unseen cats)")

    report["context"] = {
        "model": best,
        "n_clips": int(len(y)),
        "n_cats": int(len(set(cats))),
        "clips_per_context": {n: int((y == i).sum()) for i, n in enumerate(CONTEXT_NAMES)},
        "macro_f1_unseen_cats": float(f1),
        "accuracy_unseen_cats": float((pred == y).mean()),
        "macro_f1_majority_baseline": float(majority),
        "macro_f1_chance_baseline": float(chance),
        "macro_f1_random_clip_split_LEAKY": float(leaky_f1),
        "per_cat_accuracy": {c: float((pred[cats == c] == y[cats == c]).mean()) for c in sorted(set(cats))},
        "confusion_matrix": cm.tolist(),
        "abstain_threshold": threshold,
        "selective": sel,
        "evaluation": f"leave-one-cat-out ({len(set(cats))} folds)",
    }
    final = clone(candidates("context")[best]).fit(X_cm, y)
    return final, threshold


def seg_feats(paths):
    """Per-sound-event features: a list with one (n_segments, n_features) array per clip."""
    def one(p):
        y = load_audio(str(p))
        segs = segments(y) or [y]
        return np.vstack([extract(s) for s in segs])
    return Parallel(n_jobs=-1)(delayed(one)(p) for p in paths)


def source_weights(y, src):
    """Give each (dataset, class) group equal total weight, so 40 ESC-50 cats count as much as 440 CatMeows clips."""
    w = np.ones(len(y))
    for s in np.unique(src):
        for c in (0, 1):
            mk = (src == s) & (y == c)
            if mk.any():
                w[mk] = 1 / mk.sum()
    return w * len(w) / w.sum()


def detector_models():
    return {
        "gradient_boosting": HistGradientBoostingClassifier(max_iter=400, learning_rate=0.05, random_state=0),
        "forest": RandomForestClassifier(n_estimators=600, min_samples_leaf=3, max_features=0.3, n_jobs=-1, random_state=0),
    }


def train_detector(cm_rows, esc_rows, out, report, F=None, cols=DETECTOR_COLS):
    """Cat vs not-cat, trained and scored on individual sound events.

    Duration is dropped (CatMeows clips are ~1 s, ESC-50 clips ~4 s, so it would
    identify the dataset rather than the animal). A clip's score is its most
    cat-like event.
    """
    if F is None:
        F = seg_feats([p for p, *_ in cm_rows] + [p for p, *_ in esc_rows])
    y = np.array([1] * len(cm_rows) + [int(t == ESC_CAT) for _, t, _ in esc_rows])
    targets = np.array([-1] * len(cm_rows) + [t for _, t, _ in esc_rows])
    src = np.array([0] * len(cm_rows) + [1] * len(esc_rows))
    cm_cats = sorted({cat for _, _, cat in cm_rows})
    cat_fold = {c: i % 5 for i, c in enumerate(cm_cats)}
    groups = np.array([cat_fold[cat] for _, _, cat in cm_rows] + [f - 1 for _, _, f in esc_rows])

    idx = np.concatenate([[i] * len(f) for i, f in enumerate(F)])
    X = np.vstack(F)[:, cols]
    ys, w = y[idx], source_weights(y[idx], src[idx])
    hi, lo = 0.6, 0.3

    def clip_scores(model):
        p = np.zeros(len(ys))
        for tr, te in GroupKFold(n_splits=5).split(X, ys, groups[idx]):
            m = clone(model).fit(X[tr], ys[tr], sample_weight=w[tr])
            p[te] = m.predict_proba(X[te])[:, 1]
        return np.array([p[idx == i].max() for i in range(len(F))])

    results = {}
    for name, model in detector_models().items():
        clip = clip_scores(model)
        likely = clip >= hi
        # Pick the model that best balances catching ESC-50 cats (other recordings) with few false alarms.
        score = likely[targets == ESC_CAT].mean() + likely[src == 0].mean() - 2 * likely[y == 0].mean()
        results[name] = (score, clip)
        print(f"  detector {name}: ESC-50 cats caught {likely[targets == ESC_CAT].mean():.2f}, "
              f"false alarms {likely[y == 0].mean():.3f}")
    best = max(results, key=lambda k: results[k][0])
    p = results[best][1]
    pred_likely = p >= hi

    def rate(mask, pred=pred_likely):
        return float(pred[mask].mean()) if mask.any() else None

    fp = {g: rate(np.isin(targets, ids)) for g, ids in ESC_GROUPS.items()}
    fp["any_non_cat"] = rate(y == 0)
    band = {
        "likely": float((p >= hi).mean()),
        "uncertain": float(((p >= lo) & (p < hi)).mean()),
        "not_detected": float((p < lo).mean()),
    }
    cm = confusion_matrix(y, pred_likely.astype(int))
    plot_cm(cm, ["not cat", "cat"], out / "detector_confusion_matrix.png", "Cat detector, 'likely' (held-out)")

    report["detector"] = {
        "model": best,
        "n_positive": int(y.sum()),
        "n_negative": int((1 - y).sum()),
        "f1_at_likely": float(f1_score(y, pred_likely)),
        "precision_at_likely": float(precision_score(y, pred_likely, zero_division=0)),
        "recall_at_likely": float(recall_score(y, pred_likely)),
        "recall_catmeows_at_likely": rate(src == 0),
        "recall_esc50_cats_at_likely": rate(targets == ESC_CAT),
        "esc50_cats_at_least_uncertain": rate(targets == ESC_CAT, p >= lo),
        "false_likely_rate": fp,
        "decision_share": band,
        "thresholds": {"likely": hi, "not_detected_below": lo},
        "confusion_matrix_at_likely": cm.tolist(),
        "evaluation": "5-fold grouped (cats and ESC-50 folds held out); sound events, clip = most cat-like event",
    }
    final = clone(detector_models()[best]).fit(X, ys, sample_weight=w)
    return final, {"likely": hi, "not_detected_below": lo}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catmeows", required=True)
    ap.add_argument("--esc50")
    ap.add_argument("--out", default="model")
    args = ap.parse_args()

    out = Path(args.out)
    reports = Path("reports")
    out.mkdir(exist_ok=True)
    reports.mkdir(exist_ok=True)
    version = "meowmemo-" + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M")
    report = {"model_version": version}

    cm_rows = load_catmeows(args.catmeows)
    print(f"CatMeows: {len(cm_rows)} clips from {len({c for *_, c in cm_rows})} cats")
    X_cm = feats([p for p, *_ in cm_rows])

    print("Training context classifier...")
    ctx_model, ctx_t = train_context(cm_rows, X_cm, reports, report)

    meta = {"model_version": version, "contexts": CONTEXT_NAMES, "context_abstain_below": ctx_t}
    bundle = {"context": ctx_model}

    esc_rows = load_esc50(args.esc50) if args.esc50 else []
    if esc_rows:
        print(f"ESC-50: {len(esc_rows)} clips")
        print("Training cat detector...")
        det_model, det_t = train_detector(cm_rows, esc_rows, reports, report)
        bundle["detector"] = det_model
        meta["detector"] = det_t
    else:
        print("No ESC-50: cat detector disabled; non-silent audio will be reported as 'uncertain'.")
        meta["detector"] = None
        report["detector"] = None

    joblib.dump(bundle, out / "models.joblib")
    (out / "meta.json").write_text(json.dumps(meta, indent=2))
    (reports / "metrics.json").write_text(json.dumps(report, indent=2))
    print(f"\nSaved {version}. Context macro-F1 on unseen cats: {report['context']['macro_f1_unseen_cats']:.3f}")


if __name__ == "__main__":
    main()
