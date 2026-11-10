"use client";
// Browser-local storage (IndexedDB). Audio and cat photos never leave the device
// except for the single clip sent to the API when the user taps "Analyse".
import type { Cat, Recording } from "./types";

const DB_NAME = "meowmemo";
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("cats")) db.createObjectStore("cats", { keyPath: "id" });
      if (!db.objectStoreNames.contains("recordings")) {
        const s = db.createObjectStore("recordings", { keyPath: "id" });
        s.createIndex("catId", "catId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const newId = () => crypto.randomUUID();

export const listCats = async () =>
  (await tx<Cat[]>("cats", "readonly", (s) => s.getAll())).sort((a, b) => a.createdAt - b.createdAt);
export const saveCat = (cat: Cat) => tx("cats", "readwrite", (s) => s.put(cat));

export async function deleteCat(id: string) {
  const recs = await listRecordings();
  await Promise.all(recs.filter((r) => r.catId === id).map((r) => deleteRecording(r.id)));
  await tx("cats", "readwrite", (s) => s.delete(id));
}

export const listRecordings = async () =>
  (await tx<Recording[]>("recordings", "readonly", (s) => s.getAll())).sort((a, b) => b.createdAt - a.createdAt);
export const saveRecording = (r: Recording) => tx("recordings", "readwrite", (s) => s.put(r));
export const deleteRecording = (id: string) => tx("recordings", "readwrite", (s) => s.delete(id));

const CONSENT_KEY = "meowmemo-consent-v1";
export function hasConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === "yes";
  } catch {
    return false;
  }
}
export function giveConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "yes");
  } catch {}
}
