"use client";
import { useEffect, useRef } from "react";

type Props = {
  peaks: number[];
  height?: number;
  /** Fractions 0..1 of the clip kept after trimming; outside is dimmed. */
  keep?: [number, number];
  /** Playback position 0..1. */
  progress?: number;
  label?: string;
};

export function Waveform({ peaks, height = 96, keep = [0, 1], progress, label = "Waveform of the recording" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      canvas.width = w * dpr;
      canvas.height = height * dpr;
      const g = canvas.getContext("2d")!;
      g.scale(dpr, dpr);
      g.clearRect(0, 0, w, height);
      const css = getComputedStyle(document.documentElement);
      const ink = css.getPropertyValue("--ink").trim();
      const faint = css.getPropertyValue("--rule").trim();
      const accent = css.getPropertyValue("--marigold").trim();
      const bar = w / peaks.length;
      const mid = height / 2;
      peaks.forEach((p, i) => {
        const x = i * bar;
        const frac = (i + 0.5) / peaks.length;
        const inside = frac >= keep[0] && frac <= keep[1];
        const played = progress !== undefined && frac <= progress && inside;
        g.fillStyle = played ? accent : inside ? ink : faint;
        const h = Math.max(2, p * (height - 8));
        g.beginPath();
        g.roundRect(x + bar * 0.18, mid - h / 2, Math.max(1.5, bar * 0.64), h, 2);
        g.fill();
      });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [peaks, height, keep, progress]);

  return <canvas ref={ref} role="img" aria-label={label} className="block w-full" style={{ height }} />;
}
