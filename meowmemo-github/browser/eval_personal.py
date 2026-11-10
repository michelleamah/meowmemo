"""Does learning from an owner's own labels help? A simulation on CatMeows.

For each of the 21 cats, the general model is one that never heard that cat (leave-one-cat-out).
We then pretend the owner has labelled m of their cat's other meows, build the same small
per-cat model the web page builds (nearest centroids in standardised feature space), blend it
with the general model exactly as the page does, and score the clip. Repeated over random
choices of which m clips were labelled.

Writes reports/personal_eval.json and prints a table.
"""
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import f1_score
from sklearn.model_selection import LeaveOneGroupOut

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "api"))
import train  # noqa: E402

TAU = 1.0     # softness of the personal model's distances (std units, per sqrt(dim))
K0 = 6        # personal weight w = n / (n + K0), capped below
W_MAX = 0.6
MIN_PER_SITUATION_COVERED = 2  # need labels in at least 2 situations


def personal_proba(x, ex_X, ex_y, mean, std):
    """Same maths as personal.js."""
    z = (x - mean) / std
    out = np.zeros(3)
    present = np.zeros(3, bool)
    for k in range(3):
        m = ex_y == k
        if m.any():
            c = ((ex_X[m] - mean) / std).mean(axis=0)
            d = np.sqrt(((z - c) ** 2).mean())
            out[k] = np.exp(-d / TAU)
            present[k] = True
    if present.sum() < MIN_PER_SITUATION_COVERED:
        return None, 0.0
    out = out / out.sum()
    n = len(ex_y)
    return out, min(W_MAX, n / (n + K0))


def main():
    X = np.load(HERE / "reports/features_cache.npz")["X_cm"]
    rows = train.load_catmeows(sys.argv[1] if len(sys.argv) > 1 else "../data/catmeows")
    y = np.array([train.CONTEXT_NAMES.index(c) for _, c, _ in rows])
    cats = np.array([c for *_, c in rows])
    mean, std = X.mean(axis=0), X.std(axis=0) + 1e-9

    model = train.candidates("context")["forest"]
    general = train.oof_proba(model, X, y, cats, LeaveOneGroupOut())  # never saw that cat

    rng = np.random.default_rng(0)
    results = {}
    for m in [0, 3, 5, 10, 15]:
        y_true, y_gen, y_mix, used = [], [], [], 0
        for _ in range(5):  # repeats over which clips the owner labelled
            for cat in np.unique(cats):
                idx = np.where(cats == cat)[0]
                for i in idx:
                    others = idx[idx != i]
                    lab = rng.choice(others, size=min(m, len(others)), replace=False) if m else np.array([], int)
                    g = general[i]
                    p = g
                    if len(lab):
                        pp, w = personal_proba(X[i], X[lab], y[lab], mean, std)
                        if pp is not None:
                            p = (1 - w) * g + w * pp
                            used += 1
                    y_true.append(y[i]); y_gen.append(g.argmax()); y_mix.append(p.argmax())
        y_true, y_gen, y_mix = map(np.array, (y_true, y_gen, y_mix))
        results[m] = {
            "general_accuracy": float((y_gen == y_true).mean()),
            "personal_accuracy": float((y_mix == y_true).mean()),
            "general_macro_f1": float(f1_score(y_true, y_gen, average="macro")),
            "personal_macro_f1": float(f1_score(y_true, y_mix, average="macro")),
            "share_with_personal_model": used / len(y_true),
        }
        r = results[m]
        print(f"labels={m:2d}  general acc {r['general_accuracy']:.3f}  with owner's labels {r['personal_accuracy']:.3f}"
              f"   F1 {r['general_macro_f1']:.3f} -> {r['personal_macro_f1']:.3f}")
    out = {"tau": TAU, "k0": K0, "w_max": W_MAX, "by_labels": results,
           "method": "leave-one-cat-out general model + per-cat nearest-centroid model from m labelled clips of the same cat, 5 random repeats"}
    (HERE / "reports/personal_eval.json").write_text(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
