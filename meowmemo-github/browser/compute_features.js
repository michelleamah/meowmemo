// Usage: node compute_features.js filelist.json out.json [workers]
// filelist.json: ["path/a.wav", ...]  (16-bit PCM mono WAV at 8 kHz)
// out.json: [{ clip: [96 numbers], segments: [[96 numbers], ...] }, ...] in the same order.
const fs = require("fs");
const os = require("os");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const F = require("./features.js");

function readWav(path) {
  const b = fs.readFileSync(path);
  if (b.toString("ascii", 0, 4) !== "RIFF") throw new Error("not a WAV: " + path);
  let off = 12, fmt = null;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === "fmt ") fmt = { ch: b.readUInt16LE(off + 10), rate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === "data") {
      if (!fmt || fmt.bits !== 16) throw new Error("need 16-bit PCM: " + path);
      const n = Math.floor(size / 2 / fmt.ch), y = new Float64Array(n);
      for (let i = 0; i < n; i++) y[i] = b.readInt16LE(off + 8 + i * 2 * fmt.ch) / 32768;
      return F.toModelAudio(y, fmt.rate);
    }
    off += 8 + size + (size % 2);
  }
  throw new Error("no data chunk: " + path);
}

function featurize(path) {
  const y = readWav(path);
  const segs = F.segments(y);
  return { clip: F.extract(y), segments: (segs.length ? segs : [y]).map(F.extract) };
}

if (isMainThread) {
  const [list, out, nw] = process.argv.slice(2);
  const files = JSON.parse(fs.readFileSync(list, "utf8"));
  const workers = Math.min(Number(nw) || os.cpus().length, files.length);
  const results = new Array(files.length);
  let done = 0, finished = 0;
  for (let w = 0; w < workers; w++) {
    const idx = files.map((_, i) => i).filter((i) => i % workers === w);
    const worker = new Worker(__filename, { workerData: { files, idx } });
    worker.on("message", ({ i, r }) => {
      results[i] = r;
      if (++done % 200 === 0) console.error(`  ${done}/${files.length}`);
    });
    worker.on("error", (e) => { console.error(e); process.exit(1); });
    worker.on("exit", () => {
      if (++finished === workers) fs.writeFileSync(out, JSON.stringify(results));
    });
  }
} else {
  for (const i of workerData.idx) parentPort.postMessage({ i, r: featurize(workerData.files[i]) });
}
