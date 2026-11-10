"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatAvatar } from "@/components/CatPicker";
import { Waveform } from "@/components/Waveform";
import { decode } from "@/lib/audio";
import { deleteRecording, listCats, listRecordings, saveRecording } from "@/lib/db";
import { captionFor, makeShareCard, shareOrDownload } from "@/lib/share";
import { LABELS, labelText, type Cat, type Recording, type UserLabel } from "@/lib/types";

const DETECTION_TEXT = { likely: "Cat sound", uncertain: "Maybe a cat", not_detected: "No cat detected" };

function Entry({ rec, cat, onChange, onDelete }: { rec: Recording; cat?: Cat; onChange: (r: Recording) => void; onDelete: () => void }) {
  const [peaks, setPeaks] = useState<number[]>();
  const [duration, setDuration] = useState(1);
  const [progress, setProgress] = useState<number>();
  const audio = useRef<HTMLAudioElement>(null);
  const url = useMemo(() => URL.createObjectURL(rec.audio), [rec.audio]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  useEffect(() => {
    let live = true;
    decode(rec.audio, 120)
      .then((d) => {
        if (!live) return;
        setPeaks(d.peaks);
        setDuration(d.duration);
      })
      .catch(() => live && setPeaks([]));
    return () => {
      live = false;
    };
  }, [rec.audio]);

  const top = rec.result.contexts[0];
  const date = new Date(rec.createdAt);

  return (
    <li className="rounded-2xl border border-rule bg-sheet p-4">
      <div className="flex items-center gap-3">
        {cat && <CatAvatar cat={cat} size={36} />}
        <div className="flex-1">
          <p className="font-bold">{cat?.name ?? "Unknown cat"}</p>
          <p className="text-[15px] text-ink-soft">
            {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })},{" "}
            {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
        <button
          onClick={() => {
            const a = audio.current;
            if (!a) return;
            if (!a.paused) return a.pause();
            a.currentTime = rec.trimStart;
            a.play();
          }}
          className="rounded-full bg-paper px-4 py-2 font-bold"
        >
          Play
        </button>
      </div>

      {peaks && peaks.length > 0 && (
        <div className="mt-3">
          <Waveform peaks={peaks} height={56} keep={[rec.trimStart / duration, rec.trimEnd / duration]} progress={progress} />
        </div>
      )}
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            setProgress(a.currentTime / duration);
            if (a.currentTime >= rec.trimEnd) {
              a.pause();
              setProgress(undefined);
            }
          }}
          onPause={() => setProgress(undefined)}
        />
      )}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px]">
        <dt className="text-ink-soft">Model said</dt>
        <dd>
          {DETECTION_TEXT[rec.result.detection]}
          {top && rec.result.detection !== "not_detected" && `; ${rec.result.context_unsure ? "unsure, maybe" : "most like"} ${top.id}`}
        </dd>
        <dt className="text-ink-soft">You said</dt>
        <dd>
          <label className="sr-only" htmlFor={`label-${rec.id}`}>Your label</label>
          <select
            id={`label-${rec.id}`}
            value={rec.userLabel}
            onChange={(e) => onChange({ ...rec, userLabel: e.target.value as UserLabel })}
            className="rounded-lg border border-rule bg-paper px-2 py-0.5 font-bold"
          >
            {LABELS.map((l) => (
              <option key={l.id} value={l.id}>{l.text}</option>
            ))}
          </select>
        </dd>
        {rec.note && (
          <>
            <dt className="text-ink-soft">Note</dt>
            <dd>{rec.note}</dd>
          </>
        )}
      </dl>

      <div className="mt-3 flex gap-2">
        <button
          className="rounded-full px-3 py-1.5 font-bold hover:bg-paper"
          onClick={async () => {
            const blob = await makeShareCard({
              catName: cat?.name ?? "My cat",
              caption: captionFor(rec.userLabel, rec.id),
              peaks: peaks ?? [],
              photo: cat?.photo,
            });
            await shareOrDownload(blob, `meowmemo-${cat?.name ?? "cat"}.png`);
          }}
        >
          Share card
        </button>
        <button
          className="rounded-full px-3 py-1.5 text-rose hover:bg-paper"
          onClick={() => confirm("Delete this recording? This can't be undone.") && onDelete()}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

export default function JournalPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [recs, setRecs] = useState<Recording[] | null>(null);
  const [catFilter, setCatFilter] = useState("all");
  const [labelFilter, setLabelFilter] = useState("all");

  const refresh = useCallback(() => {
    Promise.all([listCats(), listRecordings()]).then(([c, r]) => {
      setCats(c);
      setRecs(r);
    });
  }, []);
  useEffect(refresh, [refresh]);

  const shown = useMemo(
    () => (recs ?? []).filter((r) => (catFilter === "all" || r.catId === catFilter) && (labelFilter === "all" || r.userLabel === labelFilter)),
    [recs, catFilter, labelFilter],
  );

  function exportCsv() {
    const rows = [["recorded_at", "cat", "user_label", "note", "model_detection", "model_top_context", "model_context_unsure", "model_version"]];
    (recs ?? []).forEach((r) =>
      rows.push([
        new Date(r.createdAt).toISOString(),
        cats.find((c) => c.id === r.catId)?.name ?? "",
        r.userLabel,
        r.note,
        r.result.detection,
        r.result.contexts[0]?.id ?? "",
        String(r.result.context_unsure),
        r.modelVersion,
      ]),
    );
    const csv = rows.map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "meowmemo-journal.csv";
    a.click();
  }

  if (recs === null) return null;

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Journal</h1>

      {recs.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-rule bg-sheet p-6">
          <p className="font-display text-xl font-bold">No recordings yet</p>
          <p className="mt-1 text-ink-soft">Saved meows show up here, with what the model guessed and what you said was happening.</p>
          <Link href="/" className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 font-bold text-paper">Record a meow</Link>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="text-[15px]">
              <span className="block text-ink-soft">Cat</span>
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="rounded-lg border border-rule bg-sheet px-3 py-2">
                <option value="all">All cats</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-[15px]">
              <span className="block text-ink-soft">Your label</span>
              <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className="rounded-lg border border-rule bg-sheet px-3 py-2">
                <option value="all">All labels</option>
                {LABELS.map((l) => <option key={l.id} value={l.id}>{labelText(l.id)}</option>)}
              </select>
            </label>
            <button onClick={exportCsv} className="ml-auto rounded-full px-3 py-2 text-[15px] font-bold underline underline-offset-4">
              Export CSV
            </button>
          </div>
          <p className="mt-3 text-[15px] text-ink-soft">{shown.length} of {recs.length} recordings</p>
          <ul className="mt-3 space-y-3">
            {shown.map((r) => (
              <Entry
                key={r.id}
                rec={r}
                cat={cats.find((c) => c.id === r.catId)}
                onChange={async (n) => {
                  await saveRecording(n);
                  refresh();
                }}
                onDelete={async () => {
                  await deleteRecording(r.id);
                  refresh();
                }}
              />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
