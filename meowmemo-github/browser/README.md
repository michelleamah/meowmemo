# MeowMemo web edition (runs entirely in the browser)

This is the version published as a Claude artifact. It does everything the main app does,
except live microphone recording, which hosted Claude pages don't allow. Users add a clip
from their phone's voice recorder or files instead.

There is no server. The trained model is built into the page, and clips never leave the device.

| File | What it is |
|---|---|
| `features.js` | Audio features (MFCC, pitch, spectral shape) in plain JavaScript. Used for training (in Node) **and** in the page, so both see sound identically. |
| `compute_features.js` | Runs `features.js` over the dataset WAV files in Node. |
| `train_browser.py` | Trains and evaluates the models with the same tests as `api/train.py`, then exports them to `model.json`. |
| `model.js` | Runs the exported scikit-learn models in JavaScript. |
| `check_parity.js` | Checks that `model.js` gives the same probabilities as scikit-learn. |
| `eval_personal.py` | Tests learning from an owner's own labels on the study cats (`reports/personal_eval.json`). |
| `illustrations.js`, `style.css` | The page's drawings and look. |
| `page.template.html` | The page: analyse, journal, cat profiles, share cards. |
| `build.py` | Puts everything into one file, `dist/index.html`. |
| `reports/` | Scores, confusion matrices and the model card for this model. |

Rebuild:

```bash
python train_browser.py --catmeows ../data/catmeows --esc50 ../data/esc50   # ~7 min
node check_parity.js
python build.py
```

The ESC-50 audio must first be converted to 8 kHz mono WAV, for example:
`for f in ESC-50-master/audio/*.wav; do ffmpeg -i "$f" -ac 1 -ar 8000 esc8k/$(basename "$f"); done`

## Learning from your labels

Every clip you label as food, brushing or alone becomes a training example for that cat, kept on your device.
Once a cat has labels in at least 2 situations, new clips are compared with them (nearest situation average
in standardised feature space) and blended with the general model; your labels count for n / (n + 6) of the
answer, at most 60%. The Journal shows a leave-one-out check on your own labels.

Simulation on the 21 study cats (general model never heard the cat; owner labels m of its other clips, 5 repeats):

| Owner's labels | Situation right |
|---|---|
| 0 | 52% |
| 3 | 59% |
| 5 | 62% |
| 10 | 67% |
| 15 | 68% |

Caveat: each study cat's clips were recorded in a few sessions, so some of the gain may come from matching the
recording session rather than the cat. A pilot with real owners would test this.
