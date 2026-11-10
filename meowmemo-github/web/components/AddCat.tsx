"use client";
import { useState } from "react";
import { newId, saveCat } from "@/lib/db";
import type { Cat } from "@/lib/types";

async function shrink(file: File, size = 320): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.85));
}

export function AddCat({ onAdded }: { onAdded: (cat: Cat) => void }) {
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<Blob>();
  const [error, setError] = useState("");

  return (
    <form
      className="space-y-4 rounded-2xl border border-rule bg-sheet p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Give your cat a name.");
        const cat: Cat = { id: newId(), name: name.trim().slice(0, 30), photo, createdAt: Date.now() };
        await saveCat(cat);
        setName("");
        setPhoto(undefined);
        setError("");
        onAdded(cat);
      }}
    >
      <div>
        <label htmlFor="cat-name" className="block font-bold">Cat&apos;s name</label>
        <input
          id="cat-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          className="mt-1 w-full rounded-xl border-2 border-rule bg-paper px-3 py-2"
          aria-invalid={!!error}
          aria-describedby={error ? "cat-name-error" : undefined}
        />
        {error && <p id="cat-name-error" className="mt-1 text-rose">{error}</p>}
      </div>
      <div>
        <label htmlFor="cat-photo" className="block font-bold">Photo <span className="font-normal text-ink-soft">(optional)</span></label>
        <input
          id="cat-photo"
          type="file"
          accept="image/*"
          className="mt-1 block w-full text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-4 file:py-2 file:font-bold file:text-ink"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              setPhoto(await shrink(f));
            } catch {
              setError("That photo couldn't be read. Try a JPG or PNG.");
            }
          }}
        />
      </div>
      <button className="rounded-full bg-ink px-6 py-2.5 font-bold text-paper">Add cat</button>
    </form>
  );
}
