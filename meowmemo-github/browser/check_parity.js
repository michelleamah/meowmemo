// Checks that model.js gives the same probabilities as scikit-learn did in Python.
// Usage: node check_parity.js
const fs = require("fs");
const M = require("./model.js");
const model = JSON.parse(fs.readFileSync(__dirname + "/model.json", "utf8"));
const ref = JSON.parse(fs.readFileSync(__dirname + "/reports/parity_reference.json", "utf8"));
let worst = 0, n = 0;
for (const r of ref) {
  r.segments.forEach((x, i) => {
    const d = M.predictProba(model.detector, x.slice(0, model.detector_cols))[1];
    worst = Math.max(worst, Math.abs(d - r.detector[i]));
    M.predictProba(model.context, x).forEach((p, k) => (worst = Math.max(worst, Math.abs(p - r.context[i][k]))));
    n++;
  });
}
console.log(`Compared ${n} sounds. Largest difference from scikit-learn: ${worst.toExponential(2)}`);
process.exit(worst < 1e-4 ? 0 : 1);
