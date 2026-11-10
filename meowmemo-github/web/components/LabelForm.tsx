"use client";
import { LABELS, type UserLabel } from "@/lib/types";

export function LabelForm({
  label,
  note,
  onLabel,
  onNote,
}: {
  label?: UserLabel;
  note: string;
  onLabel: (l: UserLabel) => void;
  onNote: (n: string) => void;
}) {
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="font-bold">What was actually happening?</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {LABELS.map((l) => (
            <label
              key={l.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-marigold ${
                label === l.id ? "border-ink bg-sheet font-bold" : "border-rule"
              }`}
            >
              <input type="radio" name="label" className="sr-only" checked={label === l.id} onChange={() => onLabel(l.id)} />
              <span aria-hidden className={`h-4 w-4 rounded-full border-2 ${label === l.id ? "border-ink bg-marigold" : "border-ink-soft"}`} />
              {l.text}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="note" className="font-bold">
          Note <span className="font-normal text-ink-soft">(optional)</span>
        </label>
        <textarea
          id="note"
          value={note}
          maxLength={280}
          onChange={(e) => onNote(e.target.value)}
          rows={2}
          placeholder="e.g. sitting by the door at 7am"
          className="mt-1 w-full rounded-xl border-2 border-rule bg-paper px-3 py-2"
        />
      </div>
    </div>
  );
}
