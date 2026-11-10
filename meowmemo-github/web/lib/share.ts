"use client";
import type { UserLabel } from "./types";

// Playful captions. These are jokes chosen from a fixed list, never model output.
const CAPTIONS: Record<UserLabel, string[]> = {
  food: ["The bowl is visibly empty. Please advise.", "Dinner was due four minutes ago.", "I have been starving since breakfast."],
  brushing: ["I will allow three more strokes.", "This is a spa, not a wrestling match.", "Fine. The left side too."],
  isolation: ["Where did everyone go?", "New room. Strong opinions.", "Hello? Is this thing on?"],
  other: ["I have a complaint and it is long.", "No further questions.", "You know what you did."],
  unknown: ["I have a complaint and it is long.", "No further questions.", "You know what you did."],
};

export function captionFor(label: UserLabel, seed: string) {
  const list = CAPTIONS[label];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (g.measureText(test).width > max && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function makeShareCard(opts: { catName: string; caption: string; peaks: number[]; photo?: Blob }): Promise<Blob> {
  await document.fonts.ready;
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const ink = "#1e2a4a", paper = "#eef1f6", marigold = "#f2b33d", soft = "#5b6680";

  g.fillStyle = paper;
  g.fillRect(0, 0, W, H);

  // Cat photo or initial
  const cx = 160, cy = 190, r = 80;
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = marigold;
  g.fill();
  g.clip();
  if (opts.photo) {
    const bmp = await createImageBitmap(opts.photo);
    g.drawImage(bmp, cx - r, cy - r, r * 2, r * 2);
  } else {
    g.fillStyle = ink;
    g.font = "800 90px 'Bricolage Grotesque Variable'";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(opts.catName.slice(0, 1).toUpperCase(), cx, cy + 4);
  }
  g.restore();

  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = ink;
  g.font = "800 88px 'Bricolage Grotesque Variable'";
  g.fillText(opts.catName, 280, 220);

  // Waveform
  const top = 380, wh = 260, left = 80, ww = W - 160;
  const bar = ww / opts.peaks.length;
  opts.peaks.forEach((p, i) => {
    const h = Math.max(6, p * wh);
    g.fillStyle = i % 2 ? ink : "#2d3c64";
    g.beginPath();
    g.roundRect(left + i * bar + bar * 0.15, top + wh / 2 - h / 2, bar * 0.7, h, 4);
    g.fill();
  });

  // Caption
  g.font = "800 76px 'Bricolage Grotesque Variable'";
  g.fillStyle = ink;
  const lines = wrap(g, `“${opts.caption}”`, W - 160);
  lines.slice(0, 4).forEach((l, i) => g.fillText(l, 80, 800 + i * 92));

  // Honesty label, deliberately large
  g.fillStyle = marigold;
  g.beginPath();
  g.roundRect(80, H - 210, 520, 72, 36);
  g.fill();
  g.fillStyle = ink;
  g.font = "700 38px 'Atkinson Hyperlegible'";
  g.fillText("For fun. Not a translation.", 112, H - 161);
  g.fillStyle = soft;
  g.font = "400 34px 'Atkinson Hyperlegible'";
  g.fillText("MeowMemo · a journal for your cat's sounds", 80, H - 70);

  return new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
}

export async function shareOrDownload(blob: Blob, name: string) {
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
