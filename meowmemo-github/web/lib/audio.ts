"use client";

export const MIN_S = 2;
export const MAX_S = 15;

export type Decoded = { duration: number; peaks: number[] };

/** Decode a clip and reduce it to `bins` peak values (0..1) for drawing. */
export async function decode(blob: Blob, bins = 160): Promise<Decoded> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / bins));
    const peaks: number[] = [];
    let max = 0;
    for (let i = 0; i < bins; i++) {
      let p = 0;
      for (let j = i * step; j < Math.min((i + 1) * step, data.length); j++) p = Math.max(p, Math.abs(data[j]));
      peaks.push(p);
      max = Math.max(max, p);
    }
    return { duration: buf.duration, peaks: peaks.map((p) => (max > 0 ? p / max : 0)) };
  } finally {
    ctx.close();
  }
}

/** Best container the browser can record. Chrome/Firefox: webm/opus. Safari: mp4/aac. */
export function pickMime(): string {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

export function extFor(mime: string) {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return ".m4a";
  if (mime.includes("ogg")) return ".ogg";
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return ".mp3";
  return ".webm";
}

export function micError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (!window.isSecureContext) return "Recording needs a secure (https) page. Open the app over https, or upload a clip instead.";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access is blocked. Allow it in your browser's site settings, or upload a clip instead.";
  if (name === "NotFoundError") return "No microphone was found. Connect one, or upload a clip instead.";
  return "The microphone couldn't start. Close other apps using it and try again, or upload a clip.";
}
