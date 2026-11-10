"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AddCat } from "@/components/AddCat";
import { CatPicker } from "@/components/CatPicker";
import { LabelForm } from "@/components/LabelForm";
import { ResultCard } from "@/components/ResultCard";
import { Waveform } from "@/components/Waveform";
import { analyse } from "@/lib/api";
import { decode, MAX_S, micError, MIN_S, pickMime } from "@/lib/audio";
import { listCats, newId, saveRecording } from "@/lib/db";
import { captionFor, makeShareCard, shareOrDownload } from "@/lib/share";
import type { AnalysisResult, Cat, UserLabel } from "@/lib/types";

type Clip = { blob: Blob; mime: string; url: string; duration: number; peaks: number[] };
type Stage = "idle" | "recording" | "clip" | "analysing" | "result" | "saved";

export default function RecordPage() {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [catId, setCatId] = useState<string>();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<Clip>();
  const [trim, setTrim] = useState<[number, number]>([0, 0]);
  const [progress, setProgress] = useState<number>();
  const [result, setResult] = useState<AnalysisResult>();
  const [label, setLabel] = useState<UserLabel>();
  const [note, setNote] = useState("");
  const [savedId, setSavedId] = useState<string>();
  const [shareMsg, setShareMsg] = useState("");

  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    listCats().then((c) => {
      setCats(c);
      if (c.length) setCatId(c[c.length - 1].id);
    });
  }, []);

  const loadClip = useCallback(async (blob: Blob, mime: string) => {
    setError("");
    try {
      const { duration, peaks } = await decode(blob);
      if (duration < MIN_S) {
        setStage("idle");
        return setError(`That clip is ${duration.toFixed(1)} s. Record at least ${MIN_S} seconds.`);
      }
      if (clip) URL.revokeObjectURL(clip.url);
      setClip({ blob, mime, url: URL.createObjectURL(blob), duration, peaks });
      setTrim([0, Math.min(duration, MAX_S)]);
      setResult(undefined);
      setLabel(undefined);
      setNote("");
      setStage("clip");
    } catch {
      setStage("idle");
      setError("That file couldn't be read as audio. Try WAV, MP3 or M4A.");
    }
  }, [clip]);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearInterval(timer.current);
        const type = rec.mimeType || mime || "audio/webm";
        loadClip(new Blob(chunks, { type }), type);
      };
      recorder.current = rec;
      rec.start();
      const t0 = Date.now();
      setElapsed(0);
      setStage("recording");
      timer.current = window.setInterval(() => {
        const s = (Date.now() - t0) / 1000;
        setElapsed(s);
        if (s >= MAX_S && rec.state === "recording") rec.stop();
      }, 100);
    } catch (e) {
      setError(micError(e));
    }
  }

  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function play() {
    const a = audio.current;
    if (!a || !clip) return;
    a.currentTime = trim[0];
    a.play();
  }

  async function runAnalysis() {
    if (!clip) return;
    setStage("analysing");
    setError("");
    try {
      setResult(await analyse(clip.blob, clip.mime, trim[0], trim[1]));
      setStage("result");
    } catch (e) {
      setError((e as Error).message);
      setStage("clip");
    }
  }

  async function save() {
    if (!clip || !result || !catId) return;
    const id = newId();
    await saveRecording({
      id,
      catId,
      audio: clip.blob,
      mime: clip.mime,
      createdAt: Date.now(),
      trimStart: trim[0],
      trimEnd: trim[1],
      result,
      modelVersion: result.model_version,
      userLabel: label ?? "unknown",
      note: note.trim(),
    });
    setSavedId(id);
    setStage("saved");
  }

  function reset() {
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(undefined);
    setResult(undefined);
    setShareMsg("");
    setStage("idle");
  }

  async function share() {
    if (!clip || !savedId) return;
    const cat = cats?.find((c) => c.id === catId);
    const blob = await makeShareCard({
      catName: cat?.name ?? "My cat",
      caption: captionFor(label ?? "unknown", savedId),
      peaks: clip.peaks,
      photo: cat?.photo,
    });
    const how = await shareOrDownload(blob, `meowmemo-${cat?.name ?? "cat"}.png`);
    setShareMsg(how === "downloaded" ? "Card saved to your downloads." : how === "shared" ? "Card shared." : "");
  }

  const len = trim[1] - trim[0];
  const cat = cats?.find((c) => c.id === catId);

  if (cats === null) return null;

  return (
    <>
      <header>
        <h1 className="font-display text-[44px] font-extrabold leading-[1.05] tracking-tight">What was that sound?</h1>
        <p className="mt-3 max-w-[34ch] text-ink-soft">
          Record a meow, see which situation it resembles, then note what was really happening.
        </p>
      </header>

      {cats.length === 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl font-bold">First, who&apos;s the cat?</h2>
          <div className="mt-3">
            <AddCat
              onAdded={(c) => {
                setCats([c]);
                setCatId(c.id);
              }}
            />
          </div>
        </section>
      ) : (
        <>
          <div className="mt-6">
            <CatPicker cats={cats} value={catId} onChange={setCatId} />
          </div>

          {(stage === "idle" || stage === "recording") && (
            <section className="mt-10 flex flex-col items-center text-center">
              <button
                onClick={stage === "recording" ? stopRecording : startRecording}
                aria-label={stage === "recording" ? "Stop recording" : "Start recording"}
                className={`flex h-40 w-40 items-center justify-center rounded-full bg-marigold text-[#1e2a4a] shadow-[0_8px_0_0_var(--ink)] transition active:translate-y-1 active:shadow-[0_4px_0_0_var(--ink)] ${
                  stage === "recording" ? "recording-pulse" : ""
                }`}
              >
                {stage === "recording" ? (
                  <span className="h-12 w-12 rounded-lg bg-[#1e2a4a]" />
                ) : (
                  <svg viewBox="0 0 64 64" className="h-20 w-20" aria-hidden>
                    {/* a cat's ear-and-mic glyph */}
                    <path d="M14 30 L18 8 L28 20 H36 L46 8 L50 30 C50 42 42 50 32 50 C22 50 14 42 14 30Z" fill="currentColor" />
                    <circle cx="25" cy="31" r="3" fill="#f2b33d" />
                    <circle cx="39" cy="31" r="3" fill="#f2b33d" />
                    <path d="M28 40 Q32 43 36 40" stroke="#f2b33d" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <p className="mt-6 font-display text-2xl font-bold tabular-nums" aria-live="polite">
                {stage === "recording" ? `${elapsed.toFixed(1)} s` : "Tap to record"}
              </p>
              <p className="mt-1 text-ink-soft">
                {stage === "recording"
                  ? elapsed < MIN_S
                    ? `Keep going, at least ${MIN_S} s`
                    : `Tap to stop. Stops by itself at ${MAX_S} s`
                  : `${MIN_S}-${MAX_S} seconds, close to your cat`}
              </p>
              {stage === "idle" && (
                <label className="mt-6 cursor-pointer rounded-full border-2 border-ink px-5 py-2 font-bold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-marigold">
                  Upload a clip instead
                  <input
                    type="file"
                    accept="audio/*,.m4a,.wav,.mp3,.webm,.ogg"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) loadClip(f, f.type || "audio/*");
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </section>
          )}

          {error && (
            <p role="alert" className="mt-6 rounded-xl border-2 border-rose p-3 text-rose">
              {error}
            </p>
          )}

          {clip && stage !== "idle" && stage !== "recording" && (
            <section className="mt-8 space-y-5">
              <div className="rounded-2xl border border-rule bg-sheet p-4">
                <Waveform
                  peaks={clip.peaks}
                  keep={[trim[0] / clip.duration, trim[1] / clip.duration]}
                  progress={progress}
                />
                <audio
                  ref={audio}
                  src={clip.url}
                  preload="auto"
                  onTimeUpdate={(e) => {
                    const a = e.currentTarget;
                    setProgress(a.currentTime / clip.duration);
                    if (a.currentTime >= trim[1]) {
                      a.pause();
                      setProgress(undefined);
                    }
                  }}
                  onEnded={() => setProgress(undefined)}
                />
                <div className="mt-3 flex items-center justify-between">
                  <button onClick={play} className="rounded-full bg-paper px-4 py-2 font-bold">
                    Play
                  </button>
                  <span className={`tabular-nums ${len < MIN_S || len > MAX_S ? "text-rose" : "text-ink-soft"}`}>
                    {len.toFixed(1)} s selected
                  </span>
                </div>

                {stage === "clip" && (
                  <div className="mt-4 grid gap-3">
                    <label className="text-[15px]">
                      <span className="flex justify-between">
                        Start <span className="tabular-nums text-ink-soft">{trim[0].toFixed(1)} s</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={clip.duration}
                        step={0.1}
                        value={trim[0]}
                        onChange={(e) => setTrim([Math.min(+e.target.value, trim[1] - MIN_S), trim[1]])}
                        className="w-full"
                      />
                    </label>
                    <label className="text-[15px]">
                      <span className="flex justify-between">
                        End <span className="tabular-nums text-ink-soft">{trim[1].toFixed(1)} s</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={clip.duration}
                        step={0.1}
                        value={trim[1]}
                        onChange={(e) => setTrim([trim[0], Math.max(+e.target.value, trim[0] + MIN_S)])}
                        className="w-full"
                      />
                    </label>
                  </div>
                )}
              </div>

              {(stage === "clip" || stage === "analysing") && (
                <div className="flex gap-3">
                  <button
                    onClick={runAnalysis}
                    disabled={stage === "analysing" || len < MIN_S || len > MAX_S}
                    className="flex-1 rounded-full bg-ink py-3 font-bold text-paper disabled:opacity-50"
                  >
                    {stage === "analysing" ? "Analysing…" : "Analyse"}
                  </button>
                  <button onClick={reset} className="rounded-full px-5 py-3 font-bold text-ink-soft">
                    Discard
                  </button>
                </div>
              )}
              {len > MAX_S && stage === "clip" && (
                <p className="text-rose">Trim the clip to {MAX_S} seconds or less.</p>
              )}

              {result && (stage === "result" || stage === "saved") && <ResultCard result={result} />}

              {stage === "result" && (
                <section className="rounded-2xl border border-rule bg-sheet p-5">
                  <LabelForm label={label} note={note} onLabel={setLabel} onNote={setNote} />
                  <div className="mt-5 flex gap-3">
                    <button onClick={save} className="flex-1 rounded-full bg-ink py-3 font-bold text-paper">
                      Save to {cat?.name}&apos;s journal
                    </button>
                    <button onClick={reset} className="rounded-full px-5 py-3 font-bold text-ink-soft">
                      Discard
                    </button>
                  </div>
                </section>
              )}

              {stage === "saved" && (
                <section className="rounded-2xl bg-ink p-5 text-paper" aria-live="polite">
                  <p className="font-display text-2xl font-bold">Saved to {cat?.name}&apos;s journal</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button onClick={reset} className="rounded-full bg-marigold px-5 py-2.5 font-bold text-[#1e2a4a]">
                      Record another
                    </button>
                    <button onClick={share} className="rounded-full border-2 border-paper px-5 py-2.5 font-bold">
                      Make a share card
                    </button>
                    <Link href="/journal" className="rounded-full px-3 py-2.5 font-bold underline underline-offset-4">
                      Open journal
                    </Link>
                  </div>
                  {shareMsg && <p className="mt-3">{shareMsg}</p>}
                  <p className="mt-3 text-[15px] opacity-80">Share cards use a joke caption and say so on the card. Nothing is posted anywhere unless you share it.</p>
                </section>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
