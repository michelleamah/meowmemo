# MeowMemo

A journal for your cat's sounds. Record or upload a 2-15 second clip, and MeowMemo tells you whether it sounds
like a cat and which of three recorded situations the meow most resembles (waiting for food, being brushed, alone
in an unfamiliar room). You then note what was really happening, and it's saved to your cat's journal.

It is **not** a cat-to-English translator. It never shows made-up confidence numbers, says "unsure" when the
evidence is weak, and never claims to detect pain or illness.

**Live demo:** [MeowMemo](https://claude.ai/artifact/KxNu2FpNf4nwjg26bbRmUq), published as a Claude artifact. It runs
entirely in the browser; see `browser/README.md`. Hosted Claude pages can't use the microphone, so the demo takes
uploaded clips (a phone's voice recorder works); the full app below records live.

**Proposal:** [docs/PROPOSAL.md](docs/PROPOSAL.md), the one-page project proposal.

```
browser/  The live demo: one web page with the model built in (features.js, model.js, build.py).
web/   Next.js 16 + TypeScript + Tailwind. Recording, trimming, results, cat profiles, journal, share cards.
       Everything is stored in the browser (IndexedDB).
api/   Python FastAPI + librosa + scikit-learn. Trains the models and serves POST /analyze.
```

## Run it locally

You need Node 20+, Python 3.11+ and ffmpeg (`brew install ffmpeg` on Mac).

### 1. Get the data

- **CatMeows**: download `dataset.zip` from https://zenodo.org/records/4008297 and unzip it.
- **ESC-50**: download from https://github.com/karolpiczak/ESC-50 (Code → Download ZIP) and unzip it.
  Optional, but without it the app can't tell a cat from a dog or a person.

### 2. Train the models

```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python train.py --catmeows ../data/CatMeows --esc50 ../data/ESC-50-master
python make_model_card.py
```

This prints the scores, saves `model/models.joblib`, and writes `reports/metrics.json`, two confusion-matrix
images and `reports/MODEL_CARD.md`. Training takes a few minutes, mostly feature extraction.

### 3. Start the API

```bash
uvicorn main:app --reload --port 8000
```

Check http://localhost:8000/health. It shows `"model_ready": true` once training has run.

### 4. Start the web app

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. Microphone recording works on `localhost`. On a phone the page must be served
over https (see Deploy).

## Deploy (free tiers)

- **API**: Render, Railway or Hugging Face Spaces using `api/Dockerfile`. The `model/` and `reports/`
  folders must be included. Set `ALLOWED_ORIGINS` to your web app's URL.
- **Web**: Vercel. Set `NEXT_PUBLIC_API_URL` to the API's https URL.

## How the model is evaluated

- CatMeows is split **by cat** (leave-one-cat-out). A random clip split puts the same cat in both training and
  test data and inflates the score. `metrics.json` reports both so you can see the gap.
- The cat detector is tested on held-out cats and held-out ESC-50 folds. It scores each separate sound in a clip
  and ignores clip length, because a first version learned "short CatMeows recording" instead of "cat" and caught
  0% of ESC-50 cats.
- Reported: macro-F1, a confusion matrix, majority and chance baselines, per-cat accuracy, how often the app
  abstains, and false alarms on dogs and human sounds.
- See `api/reports/MODEL_CARD.md` for the numbers. Headline results (version `meowmemo-20261023-1000`):

| Test (cats / recordings the model never trained on) | Result |
|---|---|
| Situation matcher, macro-F1 | 0.43 (random guessing 0.33; leaky random split 0.66) |
| Situation matcher, accuracy when it answers instead of saying "unsure" | 63%, on 33% of clips |
| Detector: CatMeows cats called "likely cat" | 86% |
| Detector: ESC-50 cats (different recordings) called "likely cat" | 60% |
| Detector: dogs / human sounds wrongly called "likely cat" | 0% / 4% |

The trained model is included in `api/model/`, so you can skip step 2 unless you want to retrain.

## Integrity rules the code follows

- Every result shown in the app is what `/analyze` computed from the uploaded audio. If the model isn't
  trained, the API returns an error instead of a placeholder answer.
- Silent clips and non-cat sounds are reported as "not detected"; weak context matches are labelled "unsure".
- No numeric confidence is shown. The model's probabilities are not calibrated for real homes.
- Share cards use a joke caption from a fixed list and are labelled "For fun. Not a translation."
- Audio stays on the device except the one clip sent for analysis, which the API processes in a temp file and
  does not keep.

## Limitations

21 cats, two breeds, one country, three situations, 8 kHz recordings. Phone mics and real homes sound different.
Treat results as a starting point for your own journal, not as facts about your cat.

## Data licences

CatMeows: research / non-commercial. ESC-50: CC BY-NC 3.0. This is non-commercial coursework.
