"use client";

import CrosswalkVista from "./CrosswalkVista";
import ScenarioDisplay from "./ScenarioDisplay";
import Timer from "./Timer";
import AssetCockpit from "./AssetCockpit";
import { TOTAL_SCENARIOS } from "@/lib/runConfig";

export default function GameScreen({
  scenario,
  scenarioKey,
  playing,
  onChooseLeft,
  onChooseRight,
  onTimerExpire,
}) {
  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-2 sm:gap-4 sm:px-4">
      <div className="relative w-full overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl ring-1 ring-white/5">
        <div className="relative z-20 flex flex-col gap-2 px-4 pb-2 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Scenario {scenario.id} / {TOTAL_SCENARIOS}
          </p>
          <Timer
            active={playing}
            scenarioKey={scenarioKey}
            onExpire={onTimerExpire}
          />
        </div>

        <div className="px-4 pb-3 text-center sm:px-6">
          <h2 className="text-lg font-bold tracking-tight text-zinc-100 sm:text-xl">
            Obstacle ahead — choose now
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Your view through the windshield · ← swerve · stay →
          </p>
        </div>

        <AssetCockpit>
          <CrosswalkVista
            embedded
            scenario={scenario}
            onChooseLeft={onChooseLeft}
            onChooseRight={onChooseRight}
            choicesDisabled={!playing}
          />
        </AssetCockpit>

        <div className="relative z-20 space-y-4 px-4 pb-6 pt-4 sm:px-6">
          <ScenarioDisplay scenario={scenario} showCrosswalk={false} />

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <button
              type="button"
              disabled={!playing}
              onClick={onChooseLeft}
              className="group flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-cyan-500/60 bg-cyan-950/40 px-6 py-4 text-base font-bold text-cyan-100 transition hover:border-cyan-400 hover:bg-cyan-900/50 disabled:pointer-events-none disabled:opacity-40 sm:max-w-xs"
            >
              <span className="text-2xl transition group-hover:-translate-x-0.5">
                ←
              </span>
              SWERVE LEFT
            </button>
            <button
              type="button"
              disabled={!playing}
              onClick={onChooseRight}
              className="group flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-violet-500/60 bg-violet-950/40 px-6 py-4 text-base font-bold text-violet-100 transition hover:border-violet-400 hover:bg-violet-900/50 disabled:pointer-events-none disabled:opacity-40 sm:max-w-xs"
            >
              STAY RIGHT
              <span className="text-2xl transition group-hover:translate-x-0.5">
                →
              </span>
            </button>
          </div>

          <p className="text-center text-[11px] text-zinc-600">
            Keys: <kbd className="rounded bg-zinc-800 px-1">←</kbd> swerve ·{" "}
            <kbd className="rounded bg-zinc-800 px-1">→</kbd> stay
          </p>
        </div>
      </div>
    </div>
  );
}
