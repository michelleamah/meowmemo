// How much does the detector move when the same clip takes a different technical path
// (upsampled to 44.1 or 48 kHz and back, as a browser does)? Usage: node robustness.js files.json
const F = require("./features.js"), M = require("./model.js"), fs = require("fs");
const model = JSON.parse(fs.readFileSync(__dirname + "/model.json"));
const files = JSON.parse(fs.readFileSync(process.argv[2]));
function raw(p) { const b = fs.readFileSync(p); const n = (b.length - 44) / 2, y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = b.readInt16LE(44 + i * 2) / 32768; return y; }
function score(y) { let s = F.segments(y); if (!s.length) s = [F.activeSegment(y)];
  const X = s.map(F.extract);
  return { det: Math.max(...X.map((x) => M.predictProba(model.detector, x.slice(0, model.detector_cols))[1])),
           ctx: X.map((x) => M.predictProba(model.context, x)).reduce((a, p) => a.map((v, k) => v + p[k] / X.length), [0, 0, 0]) }; }
const band = (p) => (p >= 0.6 ? "likely" : p < 0.3 ? "not" : "unsure");
let dsum = 0, flips = 0, ctxFlips = 0;
for (const f of files) {
  const y = raw(f);
  const a = score(F.toModelAudio(y, 8000));
  for (const r of [44100, 48000]) {
    const b = score(F.toModelAudio(F.resample(y, 8000, r), r));
    dsum += Math.abs(a.det - b.det);
    if (band(a.det) !== band(b.det)) flips++;
    const am = a.ctx.indexOf(Math.max(...a.ctx)), bm = b.ctx.indexOf(Math.max(...b.ctx));
    if (am !== bm) ctxFlips++;
  }
}
const n = files.length * 2;
console.log(`${files.length} clips x 2 paths: mean detector change ${(dsum / n).toFixed(3)}, detector answer changed ${(100 * flips / n).toFixed(1)}%, top situation changed ${(100 * ctxFlips / n).toFixed(1)}%`);
