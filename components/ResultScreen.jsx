"use client";

export default function ResultScreen({
  choiceLabel,
  explanation,
  reactionMs,
  stats,
  statsLoading,
  statsError,
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-8 text-center shadow-2xl ring-1 ring-white/5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
        Outcome
      </p>
      <h2 className="text-2xl font-bold text-zinc-50">{choiceLabel}</h2>
      <p className="text-lg leading-relaxed text-zinc-300">{explanation}</p>
      <p className="font-mono text-sm text-amber-400/90">
        Reaction:{" "}
        {reactionMs != null ? `${Math.round(reactionMs)} ms` : "—"}
      </p>

      <div className="w-full rounded-xl border border-zinc-800 bg-black/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Global pulse (simulated)
        </p>
        {statsLoading && (
          <p className="text-sm text-zinc-500">Pulling live stats…</p>
        )}
        {statsError && (
          <p className="text-sm text-red-400/90">{statsError}</p>
        )}
        {!statsLoading && !statsError && stats && (
          <ul className="space-y-2 text-left text-sm text-zinc-300">
            <li className="flex justify-between gap-4">
              <span>Players swerving left</span>
              <span className="font-mono text-cyan-400">
                {stats.globalSwervePercent}%
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Players staying right</span>
              <span className="font-mono text-violet-400">
                {stats.globalStayPercent}%
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Would pick like you</span>
              <span className="font-mono text-emerald-400">
                {stats.playersAgreePercent}%
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Avg reaction (fake)</span>
              <span className="font-mono text-zinc-400">
                {stats.avgReactionMs} ms
              </span>
            </li>
          </ul>
        )}
      </div>

      <p className="animate-pulse text-xs text-zinc-600">
        Next scenario incoming…
      </p>
    </div>
  );
}
