/* Runs the exported scikit-learn models (model.json) on feature vectors.
 * Mirrors scikit-learn's own predict_proba; check_parity.js compares the two. */
(function (root) {
  "use strict";

  function forest(m, x) {
    const out = new Array(m.classes.length).fill(0);
    for (const t of m.trees) {
      let n = 0;
      // scikit-learn casts inputs to float32 before comparing with thresholds
      while (t.l[n] !== -1) n = Math.fround(x[t.f[n]]) <= t.t[n] ? t.l[n] : t.r[n];
      const v = t.v[n];
      for (let k = 0; k < out.length; k++) out[k] += v[k];
    }
    return out.map((s) => s / m.trees.length);
  }

  function hgb(m, x) {
    let raw = m.baseline;
    for (const t of m.trees) {
      let n = 0;
      while (!t.leaf[n]) n = x[t.f[n]] <= t.t[n] ? t.l[n] : t.r[n];
      raw += t.v[n];
    }
    const p = 1 / (1 + Math.exp(-raw));
    return [1 - p, p];
  }

  function logreg(m, x) {
    const z = m.mean.map((mu, i) => (x[i] - mu) / m.scale[i]);
    const logits = m.coef.map((w, k) => w.reduce((s, wi, i) => s + wi * z[i], m.intercept[k]));
    const mx = Math.max(...logits);
    const e = logits.map((l) => Math.exp(l - mx));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
  }

  function predictProba(m, x) {
    if (m.type === "forest") return forest(m, x);
    if (m.type === "hgb") return hgb(m, x);
    return logreg(m, x);
  }

  /**
   * The on-device personal model: nearest situation centroids among one cat's labelled clips,
   * in standardised feature space. Same maths as eval_personal.py, which tested it.
   * examples: [{x: number[], k: 0|1|2}] (k = situation index). Returns null until the cat has
   * labelled clips in at least `min_situations` situations.
   */
  function personalProba(model, x, examples) {
    const cfg = model.personal, mean = model.feature_mean, std = model.feature_std;
    if (!cfg || !mean || !examples.length) return null;
    const dim = x.length, K = model.contexts.length;
    const z = x.map((v, i) => (v - mean[i]) / std[i]);
    const out = new Array(K).fill(0);
    let covered = 0;
    for (let k = 0; k < K; k++) {
      const ex = examples.filter((e) => e.k === k);
      if (!ex.length) continue;
      covered++;
      let d = 0;
      for (let i = 0; i < dim; i++) {
        let c = 0;
        for (const e of ex) c += (e.x[i] - mean[i]) / std[i];
        c /= ex.length;
        d += (z[i] - c) ** 2;
      }
      out[k] = Math.exp(-Math.sqrt(d / dim) / cfg.tau);
    }
    if (covered < cfg.min_situations) return null;
    const s = out.reduce((a, b) => a + b, 0);
    const n = examples.length;
    return { proba: out.map((v) => v / s), weight: Math.min(cfg.w_max, n / (n + cfg.k0)), n, covered };
  }

  /** General probabilities blended with the personal model (or unchanged when there is none). */
  function blend(general, personal) {
    if (!personal) return general.slice();
    return general.map((g, k) => (1 - personal.weight) * g + personal.weight * personal.proba[k]);
  }

  const api = { predictProba, personalProba, blend };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MeowModel = api;
})(typeof self !== "undefined" ? self : this);
