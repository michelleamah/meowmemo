import type { AnalysisResult } from "@/lib/types";

const HEADLINE: Record<AnalysisResult["detection"], string> = {
  likely: "This sounds like a cat",
  uncertain: "Possibly a cat. Hard to tell",
  not_detected: "No cat sound detected",
};

export function ResultCard({ result }: { result: AnalysisResult }) {
  const notCat = result.detection === "not_detected";
  return (
    <section aria-live="polite" className="rounded-2xl border border-rule bg-sheet p-5">
      <h2 className="font-display text-2xl font-bold">{HEADLINE[result.detection]}</h2>

      {notCat ? (
        <p className="mt-2 text-ink-soft">
          {result.reason === "silence"
            ? "The clip is almost silent. Try recording closer to your cat."
            : "This sound doesn't match the cat sounds the model knows. If it was your cat, save it anyway and label it, so the journal learns what your cat sounds like."}
        </p>
      ) : (
        <>
          <p className="mt-3 font-bold">
            {result.context_unsure ? "It could fit any of these situations:" : "It most resembles meows recorded when cats were:"}
          </p>
          <ul className="mt-2 space-y-2">
            {result.contexts.map((c) => (
              <li key={c.id} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${c.rank === "closest match" ? "bg-marigold" : "border-2 border-ink-soft"}`}
                />
                <span>
                  {c.text.replace(/^Sounds like meows recorded while cats were /, "")}
                  <span className="text-ink-soft"> ({c.rank})</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="mt-4 rounded-xl bg-paper p-3">
        <summary className="cursor-pointer font-bold">What this is based on</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-soft">
          {result.evidence.map((e) => (
            <li key={e}>{e}</li>
          ))}
          <li>Model version {result.model_version}.</li>
        </ul>
      </details>

      <p className="mt-4 border-l-4 border-marigold pl-3 text-[15px] text-ink-soft">
        This is a guess about which recorded situation the sound resembles, not a translation of what your cat means.
        You know what was actually happening, so tell the journal below.
      </p>
    </section>
  );
}
