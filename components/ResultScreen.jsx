"use client";

export default function ResultScreen({ choiceLabel, explanation }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-8 text-center shadow-2xl ring-1 ring-white/5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
        Decision recorded
      </p>
      <h2 className="text-2xl font-bold text-zinc-50">{choiceLabel}</h2>
      {explanation && (
        <p className="text-lg leading-relaxed text-zinc-300">{explanation}</p>
      )}
      <p className="animate-pulse text-xs text-zinc-600">
        Next scenario incoming…
      </p>
    </div>
  );
}
