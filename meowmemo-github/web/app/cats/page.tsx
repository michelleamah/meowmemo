"use client";
import { useCallback, useEffect, useState } from "react";
import { AddCat } from "@/components/AddCat";
import { CatAvatar } from "@/components/CatPicker";
import { deleteCat, listCats, listRecordings } from "@/lib/db";
import type { Cat } from "@/lib/types";

export default function CatsPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refresh = useCallback(() => {
    Promise.all([listCats(), listRecordings()]).then(([cs, rs]) => {
      const c: Record<string, number> = {};
      rs.forEach((r) => (c[r.catId] = (c[r.catId] ?? 0) + 1));
      setCats(cs);
      setCounts(c);
    });
  }, []);
  useEffect(refresh, [refresh]);

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Your cats</h1>
      <p className="mt-2 text-ink-soft">Each recording belongs to one cat, so every cat gets their own journal.</p>

      {cats.length > 0 && (
        <ul className="mt-6 divide-y divide-rule rounded-2xl border border-rule bg-sheet">
          {cats.map((c) => (
            <li key={c.id} className="flex items-center gap-4 p-4">
              <CatAvatar cat={c} size={56} />
              <div className="flex-1">
                <p className="font-display text-xl font-bold">{c.name}</p>
                <p className="text-ink-soft">{counts[c.id] ?? 0} recordings</p>
              </div>
              <button
                className="rounded-full px-3 py-1.5 text-rose hover:bg-paper"
                onClick={async () => {
                  const n = counts[c.id] ?? 0;
                  if (confirm(`Delete ${c.name}${n ? ` and their ${n} recording${n > 1 ? "s" : ""}` : ""}? This can't be undone.`)) {
                    await deleteCat(c.id);
                    refresh();
                  }
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-display text-2xl font-bold">{cats.length ? "Add another cat" : "Add your first cat"}</h2>
      <div className="mt-3">
        <AddCat onAdded={refresh} />
      </div>
    </>
  );
}
