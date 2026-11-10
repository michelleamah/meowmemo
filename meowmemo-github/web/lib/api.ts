"use client";
import { extFor } from "./audio";
import type { AnalysisResult } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function analyse(blob: Blob, mime: string, start: number, end: number): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("file", blob, "clip" + extFor(mime));
  form.append("start", start.toFixed(2));
  form.append("end", end.toFixed(2));
  let res: Response;
  try {
    res = await fetch(`${API_URL}/analyze`, { method: "POST", body: form });
  } catch {
    throw new Error("Couldn't reach the analysis server. Check your connection and try again.");
  }
  if (!res.ok) {
    const detail = await res.json().then((j) => j.detail).catch(() => null);
    if (res.status === 503) throw new Error("The analysis model isn't ready on the server yet.");
    throw new Error(detail ?? `Analysis failed (error ${res.status}).`);
  }
  return res.json();
}
