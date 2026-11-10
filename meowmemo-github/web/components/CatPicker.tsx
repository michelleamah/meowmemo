"use client";
import { useEffect, useMemo } from "react";
import type { Cat } from "@/lib/types";

export function CatAvatar({ cat, size = 40 }: { cat: Cat; size?: number }) {
  const url = useMemo(() => (cat.photo ? URL.createObjectURL(cat.photo) : undefined), [cat.photo]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-marigold font-display font-bold text-[#1e2a4a]"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : cat.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function CatPicker({ cats, value, onChange }: { cats: Cat[]; value?: string; onChange: (id: string) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">Which cat?</legend>
      <div className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <label
            key={c.id}
            className={`flex cursor-pointer items-center gap-2 rounded-full border-2 py-1 pl-1 pr-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-marigold ${
              value === c.id ? "border-ink bg-sheet font-bold" : "border-rule text-ink-soft"
            }`}
          >
            <input type="radio" name="cat" className="sr-only" checked={value === c.id} onChange={() => onChange(c.id)} />
            <CatAvatar cat={c} size={32} />
            {c.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
