"""Write reports/MODEL_CARD.md from reports/metrics.json, so every number in it is real."""
import json
from pathlib import Path

m = json.loads(Path("reports/metrics.json").read_text())
c, d = m["context"], m.get("detector")
pct = lambda x: "n/a" if x is None else f"{100 * x:.0f}%"  # noqa: E731
f2 = lambda x: f"{x:.2f}"  # noqa: E731

cm = c["confusion_matrix"]
names = ["food", "brushing", "isolation"]
cm_rows = "\n".join(f"| **{n}** | " + " | ".join(str(v) for v in cm[i]) + " |" for i, n in enumerate(names))
sel = "\n".join(
    f"| {t} | {pct(v['coverage'])} | {pct(v['accuracy_when_answering'])} |" for t, v in c["selective"].items()
)

det = "Not trained (ESC-50 not provided). Every non-silent clip is reported as \"uncertain\"."
if d:
    det = f"""Model: {d['model']}, scored on individual sound events (a clip counts as its most cat-like sound).
Clip duration is excluded because it identified the dataset, not the animal: an earlier version
caught 0% of ESC-50 cats. {d['n_positive']} cat clips (CatMeows + ESC-50 cat class) vs {d['n_negative']} other
ESC-50 sounds. Evaluation: {d['evaluation']}.

| Metric (held-out data) | Value |
|---|---|
| F1 when saying "likely" | {f2(d['f1_at_likely'])} |
| Precision when saying "likely" | {pct(d['precision_at_likely'])} |
| Recall when saying "likely" (all cats) | {pct(d['recall_at_likely'])} |
| Recall on CatMeows cats | {pct(d['recall_catmeows_at_likely'])} |
| Recall on ESC-50 cats (different recordings) | {pct(d['recall_esc50_cats_at_likely'])} |
| ESC-50 cats at least "uncertain" (not dismissed) | {pct(d['esc50_cats_at_least_uncertain'])} |
| Dog clips wrongly called "likely cat" | {pct(d['false_likely_rate']['dog'])} |
| Human-sound clips wrongly called "likely cat" | {pct(d['false_likely_rate']['people'])} |
| Share of clips: likely / uncertain / not detected | {pct(d['decision_share']['likely'])} / {pct(d['decision_share']['uncertain'])} / {pct(d['decision_share']['not_detected'])} |

Thresholds: "likely" at p >= {d['thresholds']['likely']}, "not detected" below {d['thresholds']['not_detected_below']}, "uncertain" between.
The gap between CatMeows recall and ESC-50 cat recall shows how much the detector depends on recording conditions.

![Detector confusion matrix](detector_confusion_matrix.png)"""

card = f"""# MeowMemo model card

Version `{m['model_version']}`. Features: MFCC + delta statistics, spectral shape, pitch (YIN), duration, at 8 kHz.

## What it does
1. **Cat detector**: is this clip a cat vocalization? Answers likely / uncertain / not detected.
2. **Context matcher**: which of three CatMeows recording situations does the meow most resemble:
   waiting for food, being brushed, or alone in an unfamiliar room.

## What it does not do
It does not translate meows, read emotions, or detect pain or illness. The three situations are how the
recordings were collected, not what the cats felt. Real life has many more situations than three.

## Context matcher
Model: {c['model']}. {c['n_clips']} meows from {c['n_cats']} cats ({c['clips_per_context']}).
Evaluation: **{c['evaluation']}**. Each cat is tested by a model that never heard that cat.

| Metric | Macro-F1 |
|---|---|
| This model, unseen cats | **{f2(c['macro_f1_unseen_cats'])}** |
| Always guess the most common situation | {f2(c['macro_f1_majority_baseline'])} |
| Random guessing | {f2(c['macro_f1_chance_baseline'])} |
| Same model, random clip split (leaky, for comparison only) | {f2(c['macro_f1_random_clip_split_LEAKY'])} |

Accuracy on unseen cats: {pct(c['accuracy_unseen_cats'])}. The leaky number is higher because the same cat's
other meows end up in training; it is not a fair estimate and the app does not use it.

Confusion matrix (rows = actual, columns = predicted):

| | food | brushing | isolation |
|---|---|---|---|
{cm_rows}

![Context confusion matrix](context_confusion_matrix.png)

**Abstaining.** If the top situation's probability is below {c['abstain_threshold']}, the app says it is unsure
and lists all competitive situations instead of naming one.

| Threshold | Clips answered | Accuracy when answering |
|---|---|---|
{sel}

Per-cat accuracy ranges from {pct(min(c['per_cat_accuracy'].values()))} to {pct(max(c['per_cat_accuracy'].values()))}, so results vary a lot by cat.

## Cat detector
{det}

## Data and licences
- CatMeows (Ludovico et al., Zenodo 4008297): research / non-commercial use. 21 cats (Maine Coon and European Shorthair), recorded in Italy at 8 kHz.
- ESC-50 (Piczak, 2015): CC BY-NC 3.0. 2,000 five-second clips, 50 classes, 40 cats.
This project is non-commercial coursework. A commercial version would need new, licensed data.

## Known limitations
- Tiny dataset: two breeds, one country, one microphone setup, three situations.
- Phone microphones, background noise and distance differ from the training recordings.
- No numeric confidence is shown to users, because the probabilities are not calibrated for real homes.
- Next research step: test whether an owner's own labelled examples improve accuracy for their cat over this generic baseline.
"""
Path("reports/MODEL_CARD.md").write_text(card)
print("Wrote reports/MODEL_CARD.md")
