/* MeowMemo audio features, in plain JavaScript.
 *
 * This one file is used in two places:
 *   - Node, at training time (compute_features.js), to turn every dataset clip into numbers;
 *   - the browser, at analysis time, to turn the user's clip into the same numbers.
 * Because both run this exact code, the model sees training and real clips the same way.
 *
 * All audio is mono Float64Array at 8 kHz (CatMeows' native rate).
 */
(function (root) {
  "use strict";

  const SR = 8000;
  const NFFT = 512;
  const HOP = 128;
  const NMELS = 40;
  const NMFCC = 20;
  const SILENCE_RMS = 0.005;
  const TOP_DB = 30;
  const YIN_FRAME = 1024;
  const FMIN = 150;
  const FMAX = 1500;

  // ---------- FFT (radix-2, in place) ----------
  const fftCache = {};
  function fftTables(n) {
    if (fftCache[n]) return fftCache[n];
    const rev = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      rev[i] = r;
    }
    const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      cos[i] = Math.cos((2 * Math.PI * i) / n);
      sin[i] = -Math.sin((2 * Math.PI * i) / n);
    }
    return (fftCache[n] = { rev, cos, sin });
  }
  function fft(re, im) {
    const n = re.length;
    const { rev, cos, sin } = fftTables(n);
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < half; j++) {
          const k = j * step;
          const a = i + j, b = a + half;
          const tr = re[b] * cos[k] - im[b] * sin[k];
          const ti = re[b] * sin[k] + im[b] * cos[k];
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
  }

  const HANN = (() => {
    const w = new Float64Array(NFFT);
    for (let i = 0; i < NFFT; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / NFFT);
    return w;
  })();

  function nFrames(len) {
    return 1 + Math.floor(len / HOP);
  }

  /** Centered frames (zero padded by frameLen/2 on each side). */
  function frameAt(y, t, frameLen) {
    const out = new Float64Array(frameLen);
    const start = t * HOP - frameLen / 2;
    for (let i = 0; i < frameLen; i++) {
      const k = start + i;
      out[i] = k >= 0 && k < y.length ? y[k] : 0;
    }
    return out;
  }

  /** Magnitude spectrogram: array of frames, each Float64Array(NFFT/2+1). */
  function magSpec(y) {
    const T = nFrames(y.length);
    const bins = NFFT / 2 + 1;
    const S = [];
    for (let t = 0; t < T; t++) {
      const f = frameAt(y, t, NFFT);
      const re = new Float64Array(NFFT), im = new Float64Array(NFFT);
      for (let i = 0; i < NFFT; i++) re[i] = f[i] * HANN[i];
      fft(re, im);
      const m = new Float64Array(bins);
      for (let k = 0; k < bins; k++) m[k] = Math.hypot(re[k], im[k]);
      S.push(m);
    }
    return S;
  }

  // ---------- Mel / MFCC ----------
  const hz2mel = (f) => 2595 * Math.log10(1 + f / 700);
  const mel2hz = (m) => 700 * (Math.pow(10, m / 2595) - 1);
  const FREQS = (() => {
    const f = new Float64Array(NFFT / 2 + 1);
    for (let k = 0; k < f.length; k++) f[k] = (k * SR) / NFFT;
    return f;
  })();
  const MEL_FB = (() => {
    const lo = hz2mel(0), hi = hz2mel(SR / 2);
    const pts = [];
    for (let i = 0; i < NMELS + 2; i++) pts.push(mel2hz(lo + ((hi - lo) * i) / (NMELS + 1)));
    const fb = [];
    for (let m = 0; m < NMELS; m++) {
      const a = pts[m], b = pts[m + 1], c = pts[m + 2];
      const w = new Float64Array(FREQS.length);
      const norm = 2 / (c - a);
      for (let k = 0; k < FREQS.length; k++) {
        const f = FREQS[k];
        let v = 0;
        if (f > a && f <= b) v = (f - a) / (b - a);
        else if (f > b && f < c) v = (c - f) / (c - b);
        w[k] = v * norm;
      }
      fb.push(w);
    }
    return fb;
  })();
  const DCT = (() => {
    const d = [];
    for (let k = 0; k < NMFCC; k++) {
      const row = new Float64Array(NMELS);
      const s = k === 0 ? Math.sqrt(1 / NMELS) : Math.sqrt(2 / NMELS);
      for (let n = 0; n < NMELS; n++) row[n] = s * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * NMELS));
      d.push(row);
    }
    return d;
  })();

  function mfcc(S) {
    const T = S.length;
    const logm = [];
    let maxDb = -Infinity;
    for (let t = 0; t < T; t++) {
      const row = new Float64Array(NMELS);
      for (let m = 0; m < NMELS; m++) {
        const w = MEL_FB[m];
        let e = 0;
        for (let k = 0; k < w.length; k++) if (w[k]) e += w[k] * S[t][k] * S[t][k];
        row[m] = 10 * Math.log10(Math.max(e, 1e-10));
        if (row[m] > maxDb) maxDb = row[m];
      }
      logm.push(row);
    }
    const floor = maxDb - 80;
    const out = [];
    for (let k = 0; k < NMFCC; k++) out.push(new Float64Array(T));
    for (let t = 0; t < T; t++) {
      const row = logm[t];
      for (let m = 0; m < NMELS; m++) if (row[m] < floor) row[m] = floor;
      for (let k = 0; k < NMFCC; k++) {
        let s = 0;
        for (let m = 0; m < NMELS; m++) s += DCT[k][m] * row[m];
        out[k][t] = s;
      }
    }
    return out; // [coef][time]
  }

  function delta(rows, N = 4) {
    let denom = 0;
    for (let n = 1; n <= N; n++) denom += 2 * n * n;
    return rows.map((r) => {
      const T = r.length, d = new Float64Array(T);
      for (let t = 0; t < T; t++) {
        let s = 0;
        for (let n = 1; n <= N; n++) {
          const a = r[Math.min(T - 1, t + n)], b = r[Math.max(0, t - n)];
          s += n * (a - b);
        }
        d[t] = s / denom;
      }
      return d;
    });
  }

  // ---------- frame-level descriptors ----------
  function spectralShape(S) {
    const T = S.length;
    const centroid = new Float64Array(T), bandwidth = new Float64Array(T);
    const rolloff = new Float64Array(T), flatness = new Float64Array(T);
    for (let t = 0; t < T; t++) {
      const m = S[t];
      let sum = 0, fs = 0;
      for (let k = 0; k < m.length; k++) { sum += m[k]; fs += FREQS[k] * m[k]; }
      const c = sum > 0 ? fs / sum : 0;
      let bw = 0;
      if (sum > 0) {
        for (let k = 0; k < m.length; k++) bw += m[k] * (FREQS[k] - c) ** 2;
        bw = Math.sqrt(bw / sum);
      }
      let cum = 0, ro = 0;
      if (sum > 0) {
        for (let k = 0; k < m.length; k++) {
          cum += m[k];
          if (cum >= 0.85 * sum) { ro = FREQS[k]; break; }
        }
      }
      let lg = 0, ar = 0;
      for (let k = 0; k < m.length; k++) {
        const p = Math.max(m[k] * m[k], 1e-10);
        lg += Math.log(p); ar += p;
      }
      centroid[t] = c; bandwidth[t] = bw; rolloff[t] = ro;
      flatness[t] = Math.exp(lg / m.length) / (ar / m.length);
    }
    return { centroid, bandwidth, rolloff, flatness };
  }

  function zcrRms(y) {
    const T = nFrames(y.length);
    const zcr = new Float64Array(T), rms = new Float64Array(T);
    for (let t = 0; t < T; t++) {
      const f = frameAt(y, t, NFFT);
      let z = 0, e = 0;
      for (let i = 0; i < NFFT; i++) {
        e += f[i] * f[i];
        if (i > 0 && (f[i] >= 0) !== (f[i - 1] >= 0)) z++;
      }
      zcr[t] = z / NFFT;
      rms[t] = Math.sqrt(e / NFFT);
    }
    return { zcr, rms };
  }

  /** YIN pitch estimate per frame (Hz); NaN for frames with no energy. */
  function yin(y) {
    const T = nFrames(y.length);
    const tauMin = Math.floor(SR / FMAX), tauMax = Math.ceil(SR / FMIN);
    const W = YIN_FRAME - tauMax;
    const f0 = new Float64Array(T);
    const d = new Float64Array(tauMax + 2);
    for (let t = 0; t < T; t++) {
      const x = frameAt(y, t, YIN_FRAME);
      for (let tau = 1; tau <= tauMax + 1; tau++) {
        let s = 0;
        for (let j = 0; j < W; j++) { const v = x[j] - x[j + tau]; s += v * v; }
        d[tau] = s;
      }
      // cumulative mean normalised difference
      const c = new Float64Array(tauMax + 2);
      let run = 0, ok = true;
      c[0] = 1;
      for (let tau = 1; tau <= tauMax + 1; tau++) {
        run += d[tau];
        if (run <= 0) { ok = false; break; }
        c[tau] = (d[tau] * tau) / run;
      }
      if (!ok) { f0[t] = NaN; continue; }
      let best = -1;
      for (let tau = tauMin; tau <= tauMax; tau++) {
        if (c[tau] < 0.1 && c[tau] <= c[tau - 1] && c[tau] <= c[tau + 1]) { best = tau; break; }
      }
      if (best < 0) {
        best = tauMin;
        for (let tau = tauMin; tau <= tauMax; tau++) if (c[tau] < c[best]) best = tau;
      }
      // parabolic interpolation
      let shift = 0;
      const a = c[best - 1], b = c[best], e = c[best + 1];
      const den = a - 2 * b + e;
      if (best > 1 && den !== 0) shift = Math.max(-1, Math.min(1, (0.5 * (a - e)) / den));
      f0[t] = SR / (best + shift);
    }
    return f0;
  }

  // ---------- segmentation ----------
  /** Non-silent intervals [start, end) in samples, `topDb` below the loudest frame. */
  function nonSilent(y, topDb = TOP_DB) {
    const { rms } = zcrRms(y);
    let mx = 0;
    for (const r of rms) mx = Math.max(mx, r);
    if (mx === 0) return [];
    const thr = mx * Math.pow(10, -topDb / 20);
    const out = [];
    let start = -1;
    for (let t = 0; t < rms.length; t++) {
      const on = rms[t] > thr;
      if (on && start < 0) start = t;
      if (!on && start >= 0) { out.push([start, t]); start = -1; }
    }
    if (start >= 0) out.push([start, rms.length]);
    return out.map(([a, b]) => [Math.min(y.length, a * HOP), Math.min(y.length, b * HOP)]);
  }

  function activeSegment(y) {
    const iv = nonSilent(y);
    if (!iv.length) return y;
    const a = iv[0][0], b = iv[iv.length - 1][1];
    return b - a > SR * 0.1 ? y.slice(a, b) : y;
  }

  /** Split a clip into separate sound events (one meow each), 0.25-2.5 s long. */
  function segments(y, minS = 0.25, maxS = 2.5) {
    const iv = nonSilent(y);
    const merged = [];
    for (const [a, b] of iv) {
      if (merged.length && a - merged[merged.length - 1][1] < 0.15 * SR) merged[merged.length - 1][1] = b;
      else merged.push([a, b]);
    }
    const out = [];
    const step = Math.floor(maxS * SR);
    for (const [a, b] of merged) {
      if (b - a < minS * SR) continue;
      for (let s = a; s < b; s += step) {
        const seg = y.slice(s, Math.min(s + step, b));
        if (seg.length >= minS * SR) out.push(seg);
      }
    }
    return out;
  }

  function isSilent(y) {
    if (y.length < SR * 0.1) return true;
    let e = 0;
    for (const v of y) e += v * v;
    return Math.sqrt(e / y.length) < SILENCE_RMS;
  }

  // ---------- summary vector ----------
  const mean = (a) => { let s = 0; for (const v of a) s += v; return s / a.length; };
  const std = (a) => { const m = mean(a); let s = 0; for (const v of a) s += (v - m) ** 2; return Math.sqrt(s / a.length); };
  function percentile(a, p) {
    const s = Array.from(a).sort((x, y) => x - y);
    const pos = ((s.length - 1) * p) / 100, lo = Math.floor(pos), hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  }
  function median(a) { return percentile(a, 50); }

  /** 96 numbers describing a sound. The last one is its duration (the detector ignores it). */
  function extract(yIn) {
    let y = activeSegment(Float64Array.from(yIn));
    if (y.length < 2048) { const p = new Float64Array(2048); p.set(y); y = p; }
    let peak = 0;
    for (const v of y) peak = Math.max(peak, Math.abs(v));
    if (peak > 0) y = y.map((v) => v / peak);

    const S = magSpec(y);
    const mf = mfcc(S);
    const d1 = delta(mf);
    const sh = spectralShape(S);
    const zr = zcrRms(y);
    let f0 = Array.from(yin(y)).filter(Number.isFinite);
    if (!f0.length) f0 = [0];

    const v = [];
    const stats = (rows) => { for (const r of rows) v.push(mean(r)); for (const r of rows) v.push(std(r)); };
    stats(mf); stats(d1);
    stats([sh.centroid]); stats([sh.bandwidth]); stats([sh.rolloff]); stats([sh.flatness]);
    stats([zr.zcr]); stats([zr.rms]);
    v.push(median(f0), std(f0), percentile(f0, 90) - percentile(f0, 10));
    v.push(y.length / SR);
    return v;
  }

  /** Pitch summary for the "what this is based on" panel. */
  function describePitch(seg) {
    let peak = 0;
    for (const v of seg) peak = Math.max(peak, Math.abs(v));
    const y = peak > 0 ? seg.map((v) => v / peak) : seg;
    const f0 = Array.from(yin(y)).filter(Number.isFinite);
    if (f0.length < 4) return null;
    const third = Math.max(1, Math.floor(f0.length / 3));
    const s = median(f0.slice(0, third)), e = median(f0.slice(-third));
    const shape = e > s * 1.15 ? "rising" : e < s * 0.87 ? "falling" : "fairly level";
    return { hz: Math.round(median(f0) / 10) * 10, shape };
  }

  // ---------- band-limiting ----------
  // Keep 100-3400 Hz only. Above ~3.4 kHz, recordings differ mostly by how they were made and
  // resampled (phone, browser, ffmpeg), not by the animal; below 100 Hz is hum and handling noise.
  // Training and the page both apply this, so neither depends on that band.
  const BAND = (() => {
    const taps = 129, mid = (taps - 1) / 2, h = new Float64Array(taps);
    const lp = (fc, n) => (n === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * n) / (Math.PI * n));
    for (let i = 0; i < taps; i++) {
      const n = i - mid;
      const win = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (taps - 1));
      h[i] = (lp(3400 / SR, n) - lp(100 / SR, n)) * win;
    }
    return h;
  })();
  function bandLimit(y) {
    const h = BAND, mid = (h.length - 1) / 2, out = new Float64Array(y.length);
    for (let i = 0; i < y.length; i++) {
      let s = 0;
      const lo = Math.max(0, i - mid), hi = Math.min(y.length - 1, i + mid);
      for (let k = lo; k <= hi; k++) s += y[k] * h[k - i + mid];
      out[i] = s;
    }
    return out;
  }

  /** Any audio -> what the model reads: 8 kHz, 100-3400 Hz. Use this everywhere. */
  function toModelAudio(samples, rate) {
    return bandLimit(resample(samples, rate, SR));
  }

  /** Pitch over time for one sound (for the result chart): [{t: seconds, hz}] for voiced frames. */
  function pitchTrack(seg, maxPoints = 60) {
    let peak = 0;
    for (const v of seg) peak = Math.max(peak, Math.abs(v));
    const y = peak > 0 ? seg.map((v) => v / peak) : seg;
    const f0 = yin(y);
    const pts = [];
    for (let i = 0; i < f0.length; i++) if (Number.isFinite(f0[i])) pts.push({ t: (i * HOP) / SR, hz: f0[i] });
    if (pts.length <= maxPoints) return pts;
    const step = pts.length / maxPoints, out = [];
    for (let i = 0; i < maxPoints; i++) out.push(pts[Math.floor(i * step)]);
    return out;
  }

  // ---------- resampling (browser input -> 8 kHz) ----------
  /** Windowed-sinc low-pass + resample. Used in the browser for any input rate. */
  function resample(x, fromRate, toRate = SR) {
    if (fromRate === toRate) return Float64Array.from(x);
    const ratio = toRate / fromRate;
    const cutoff = Math.min(1, ratio) * 0.45; // cycles per input sample, a bit under Nyquist
    const half = Math.ceil(16 / Math.min(1, ratio));
    const outLen = Math.floor(x.length * ratio);
    const out = new Float64Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const c = i / ratio;
      const lo = Math.max(0, Math.ceil(c - half)), hi = Math.min(x.length - 1, Math.floor(c + half));
      let s = 0, ws = 0;
      for (let k = lo; k <= hi; k++) {
        const t = k - c;
        const sinc = t === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * t) / (Math.PI * t);
        const win = 0.5 + 0.5 * Math.cos((Math.PI * t) / half);
        const w = sinc * win;
        s += x[k] * w; ws += w;
      }
      out[i] = ws ? s / ws : 0;
    }
    return out;
  }

  const api = { SR, toModelAudio, pitchTrack, extract, segments, activeSegment, isSilent, describePitch, resample, N_FEATURES: 96 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MeowFeatures = api;
})(typeof self !== "undefined" ? self : this);
