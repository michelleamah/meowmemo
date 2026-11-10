"""Audio loading and feature extraction shared by training and inference.

Everything is resampled to 8 kHz mono because CatMeows was recorded at 8 kHz;
training and inference must see audio the same way.
"""
import subprocess
import tempfile

import librosa
import numpy as np

SR = 8000
N_MFCC = 20
SILENCE_RMS = 0.005
DETECTOR_COLS = slice(0, -1)  # every feature except duration  # below this the clip is treated as silence


def load_audio(path: str, start: float | None = None, end: float | None = None) -> np.ndarray:
    """Load any format ffmpeg understands (webm/opus, mp4, wav, mp3...) as 8 kHz mono float32."""
    y = None
    try:
        y, _ = librosa.load(path, sr=SR, mono=True)
    except Exception:
        # Browser recordings (webm/opus, mp4/aac) go through ffmpeg.
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), tmp.name],
                check=True,
            )
            y, _ = librosa.load(tmp.name, sr=SR, mono=True)
    if start is not None or end is not None:
        a = int((start or 0) * SR)
        b = int(end * SR) if end is not None else len(y)
        y = y[a:b]
    return y.astype(np.float32)


def active_segment(y: np.ndarray) -> np.ndarray:
    """Trim leading/trailing silence so features describe the sound, not the gaps."""
    if len(y) == 0:
        return y
    trimmed, _ = librosa.effects.trim(y, top_db=30)
    return trimmed if len(trimmed) > SR * 0.1 else y


def segments(y: np.ndarray, min_s: float = 0.25, max_s: float = 2.5) -> list[np.ndarray]:
    """Split a clip into individual sound events (e.g. one meow each).

    A 5-second household clip and a 1-second lab meow then look alike to the model:
    both become ~1 s events. Without this, the detector learns clip length and
    recording setup instead of what a cat sounds like.
    """
    if len(y) == 0:
        return []
    peak = np.max(np.abs(y))
    if peak == 0:
        return []
    iv = librosa.effects.split(y, top_db=30, frame_length=512, hop_length=128)
    merged = []
    for a, b in iv:  # join events separated by tiny gaps
        if merged and a - merged[-1][1] < 0.15 * SR:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    out = []
    for a, b in merged:
        if b - a < min_s * SR:
            continue
        step = int(max_s * SR)
        for s in range(a, b, step):  # chop long events into windows
            seg = y[s:min(s + step, b)]
            if len(seg) >= min_s * SR:
                out.append(seg)
    return out


def is_silent(y: np.ndarray) -> bool:
    if len(y) < SR * 0.1:
        return True
    return float(np.sqrt(np.mean(y**2))) < SILENCE_RMS


def extract(y: np.ndarray) -> np.ndarray:
    """Fixed-length summary vector: MFCC + deltas + spectral shape + pitch statistics."""
    y = active_segment(y)
    if len(y) < 2048:
        y = np.pad(y, (0, 2048 - len(y)))
    peak = np.max(np.abs(y))
    if peak > 0:
        y = y / peak  # loudness-normalise so mic gain doesn't matter

    mfcc = librosa.feature.mfcc(y=y, sr=SR, n_mfcc=N_MFCC, n_fft=512, hop_length=128)
    d1 = librosa.feature.delta(mfcc, width=9)  # >=17 frames guaranteed by the padding above
    centroid = librosa.feature.spectral_centroid(y=y, sr=SR, n_fft=512, hop_length=128)
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=SR, n_fft=512, hop_length=128)
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=SR, n_fft=512, hop_length=128)
    flatness = librosa.feature.spectral_flatness(y=y, n_fft=512, hop_length=128)
    zcr = librosa.feature.zero_crossing_rate(y, frame_length=512, hop_length=128)
    rms = librosa.feature.rms(y=y, frame_length=512, hop_length=128)

    f0 = librosa.yin(y, fmin=150, fmax=1500, sr=SR, frame_length=1024, hop_length=128)
    f0 = f0[np.isfinite(f0)]
    if len(f0) == 0:
        f0 = np.zeros(1)

    def stats(m):
        return np.concatenate([m.mean(axis=1), m.std(axis=1)])

    pitch = np.array([np.median(f0), f0.std(), np.percentile(f0, 90) - np.percentile(f0, 10)])
    dur = np.array([len(y) / SR])
    return np.concatenate(
        [stats(mfcc), stats(d1), stats(centroid), stats(bandwidth), stats(rolloff),
         stats(flatness), stats(zcr), stats(rms), pitch, dur]
    ).astype(np.float32)
