"use client";
import { useState, useSyncExternalStore } from "react";
import { giveConsent, hasConsent } from "@/lib/db";

export function Consent() {
  const consented = useSyncExternalStore(() => () => {}, hasConsent, () => true);
  const [dismissed, setDismissed] = useState(false);
  if (consented || dismissed) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" role="dialog" aria-modal aria-labelledby="consent-title">
      <div className="w-full max-w-md rounded-2xl bg-sheet p-6 shadow-xl">
        <h2 id="consent-title" className="font-display text-2xl font-bold">Before you record</h2>
        <ul className="mt-4 space-y-2 text-[16px] text-ink-soft">
          <li>MeowMemo uses your microphone only while you&apos;re recording.</li>
          <li>Your recordings, cat profiles and labels are saved on this device. You can delete any of them at any time.</li>
          <li>When you tap Analyse, that one clip is sent to the analysis server, processed, and not kept there.</li>
          <li>Results describe sound patterns. They are not a translation, and never a health check. If you&apos;re worried about your cat, talk to a vet.</li>
        </ul>
        <button
          onClick={() => {
            giveConsent();
            setDismissed(true);
          }}
          className="mt-6 w-full rounded-full bg-ink py-3 font-bold text-paper"
        >
          I understand
        </button>
      </div>
    </div>
  );
}
