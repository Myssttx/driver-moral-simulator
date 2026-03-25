"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GameScreen from "@/components/GameScreen";
import ResultScreen from "@/components/ResultScreen";
import CartoonPerson from "@/components/CartoonPerson";
import CartoonPet from "@/components/CartoonPet";
import { SCENARIOS } from "@/data/scenarios";
import { variantForAge } from "@/lib/ageIcons";
import { roleLegendCaption } from "@/lib/roles";

const RESULT_VISIBLE_MS = 2400;
const BETWEEN_SCENARIOS_MS = 1000;
const LEGEND_PEOPLE = [
  { age: 10, attire: "student", label: "Child", gender: "female", skinTone: "light" },
  { age: 32, attire: "professional", label: "Adult", gender: "male", skinTone: "tan" },
  { age: 72, attire: "medical", label: "Elder", gender: "female", skinTone: "dark" },
];
const LEGEND_ROLES = [
  "professional",
  "medical",
  "worker",
  "student",
  "athlete",
  "casual",
];
const LEGEND_SKIN_TONES = ["veryLight", "light", "medium", "tan", "dark"];

function buildExplanation(scenario, choice) {
  const leftN = scenario.left.count;
  const rightN = scenario.right.count;
  const swerveLeft = choice === "left";
  if (swerveLeft) {
    return `You saved ${rightN} on the right but sacrificed ${leftN} on the left.`;
  }
  return `You saved ${leftN} on the left but sacrificed ${rightN} on the right.`;
}

function choiceLabel(choice) {
  if (choice === "left") return "You swerved LEFT";
  if (choice === "right") return "You stayed RIGHT";
  return "Time up — defaulted to STAY RIGHT";
}

export default function Home() {
  const [phase, setPhase] = useState("consent");
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [decisions, setDecisions] = useState([]);
  const [runId, setRunId] = useState(null);
  const [runStartedAt, setRunStartedAt] = useState(null);
  const [lastOutcome, setLastOutcome] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [diskLogStatus, setDiskLogStatus] = useState("idle"); // idle|saving|saved|error
  const [diskLogError, setDiskLogError] = useState(null);

  const scenarioStartRef = useRef(0);
  const scenarioIndexRef = useRef(0);
  const decidedRef = useRef(false);
  const diskLoggedRef = useRef(false);
  scenarioIndexRef.current = scenarioIndex;

  const scenario = SCENARIOS[scenarioIndex];

  const recordDecision = useCallback((choice, reactionMs) => {
    if (decidedRef.current) return;
    decidedRef.current = true;

    const idx = scenarioIndexRef.current;
    const sc = SCENARIOS[idx];
    const entry = {
      scenarioId: sc.id,
      choice,
      reactionMs,
    };
    setDecisions((d) => [...d, entry]);
    setLastOutcome({
      scenario: sc,
      choice,
      reactionMs,
      explanation: buildExplanation(sc, choice),
      label: choiceLabel(choice),
    });
    setPlaying(false);
    setPhase("result");
    setStats(null);
    setStatsError(null);
    setStatsLoading(true);
  }, []);

  const startRun = () => {
    const now = Date.now();
    setRunId(`run_${now}_${Math.random().toString(16).slice(2)}`);
    setRunStartedAt(new Date(now).toISOString());
    diskLoggedRef.current = false;
    setDiskLogStatus("idle");
    setDiskLogError(null);
    decidedRef.current = false;
    setDecisions([]);
    setScenarioIndex(0);
    setLastOutcome(null);
    setPhase("playing");
  };

  useEffect(() => {
    if (phase !== "playing") return;
    decidedRef.current = false;
    scenarioStartRef.current = Date.now();
    setPlaying(true);
  }, [phase, scenarioIndex]);

  const handleChooseLeft = useCallback(() => {
    if (!playing) return;
    const rt = Date.now() - scenarioStartRef.current;
    recordDecision("left", rt);
  }, [playing, recordDecision]);

  const handleChooseRight = useCallback(() => {
    if (!playing) return;
    const rt = Date.now() - scenarioStartRef.current;
    recordDecision("right", rt);
  }, [playing, recordDecision]);

  const handleTimerExpire = useCallback(() => {
    if (!playing) return;
    const rt = Date.now() - scenarioStartRef.current;
    recordDecision("timeout", rt);
  }, [playing, recordDecision]);

  useEffect(() => {
    if (phase !== "result") return;

    let cancelled = false;
    fetch("/api/stats")
      .then((r) => {
        if (!r.ok) throw new Error("Stats failed");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setStatsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatsError("Could not load stats.");
          setStatsLoading(false);
        }
      });

    const t1 = setTimeout(() => {
      if (!cancelled) setPhase("gap");
    }, RESULT_VISIBLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(t1);
    };
  }, [phase, lastOutcome?.scenario?.id]);

  useEffect(() => {
    if (phase !== "gap") return;

    const idx = scenarioIndexRef.current;
    const t = setTimeout(() => {
      if (idx >= SCENARIOS.length - 1) {
        setPhase("summary");
      } else {
        setScenarioIndex(idx + 1);
        setPhase("playing");
      }
    }, BETWEEN_SCENARIOS_MS);

    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing" || !playing) return;

    const onKey = (e) => {
      if (e.repeat) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleChooseLeft();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleChooseRight();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, playing, handleChooseLeft, handleChooseRight]);

  const replay = () => {
    setPhase("consent");
    setScenarioIndex(0);
    setLastOutcome(null);
    setDecisions([]);
    setPlaying(false);
    setConsentChecked(false);
    setRunId(null);
    setRunStartedAt(null);
    diskLoggedRef.current = false;
    setDiskLogStatus("idle");
    setDiskLogError(null);
  };

  const downloadAllRunsCSV = async () => {
    const res = await fetch("/api/decisions-log");
    if (!res.ok) throw new Error("No CSV data yet.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "decisions_all_runs.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  useEffect(() => {
    if (phase !== "summary") return;
    if (!runId) return;
    if (decisions.length === 0) return;
    if (diskLoggedRef.current) return;

    diskLoggedRef.current = true;
    setDiskLogStatus("saving");
    setDiskLogError(null);

    fetch("/api/decisions-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId,
        startedAt: runStartedAt,
        decisions,
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to write CSV.");
        return r.json();
      })
      .then(() => setDiskLogStatus("saved"))
      .catch((e) => {
        setDiskLogStatus("error");
        setDiskLogError(e?.message ?? "Failed to write CSV.");
      });
  }, [phase, runId, runStartedAt, decisions.length]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/80 py-4 text-center">
        <h1 className="text-xl font-black tracking-tight text-zinc-50 sm:text-2xl">
          Driver Moral Simulator
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          First-person ethics at speed — no wrong answers, only tradeoffs.
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        {phase === "consent" && (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-6 shadow-2xl ring-1 ring-white/5 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Judge
            </p>
            <h2 className="text-2xl font-bold text-zinc-50">Rules and consent</h2>
            <div className="space-y-4 rounded-xl border border-zinc-800 bg-black/35 p-4 text-left text-sm leading-relaxed text-zinc-300">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  The scenario
                </p>
                <p className="mt-1.5">
                  You are deciding for a vehicle that cannot avoid everyone ahead: something is in the road, and
                  you must choose which side of the crosswalk bears the outcome.{" "}
                  <span className="font-semibold text-zinc-200">
                    Continue in your lane and affect one group, or swerve and affect the other
                  </span>
                  — there is no third path that saves everyone.
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  What’s in the scene
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-1.5 text-zinc-300">
                  <li>
                    <span className="font-semibold text-zinc-200">Two lanes</span> with a crosswalk in view from
                    the driver’s perspective.
                  </li>
                  <li>
                    <span className="font-semibold text-zinc-200">Pedestrians</span> (and sometimes{" "}
                    <span className="font-semibold text-zinc-200">pets</span>) on each side.
                  </li>
                  <li>
                    <span className="font-semibold text-zinc-200">Crossing status</span> is shown for each zone:
                    legal crossing vs jaywalking, similar to who has the walk at a signal.
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Your role
                </p>
                <p className="mt-1.5">
                  You act as the judge from <span className="font-semibold text-zinc-200">inside the car</span>.
                  Each scenario presents{" "}
                  <span className="font-semibold text-zinc-200">two possible outcomes</span> — impact on the left
                  group if you swerve, or on the right group if you stay. Pick one before time runs out using the
                  highlighted zones or buttons (or arrow keys).
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  After the run
                </p>
                <p className="mt-1.5">
                  You’ll complete <span className="font-semibold text-amber-400/95">20</span> scenarios with a short
                  outcome after each, then a <span className="font-semibold text-zinc-200">summary</span> of this
                  session. Progress is shown as you go (scenario number / 20).
                </p>
              </div>
              <p className="border-t border-zinc-800 pt-3 text-zinc-400">
                You have <span className="font-semibold text-amber-400">15 seconds</span> per scenario. Your
                choices and reaction times are recorded for this run.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-700/80 bg-zinc-900/60 px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500"
              />
              <span className="text-sm leading-snug text-zinc-300">
                I understand the rules and consent to my decision data being recorded for this session.
              </span>
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!consentChecked}
                onClick={() => setPhase("legend")}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-3 text-base font-bold text-black shadow-lg shadow-orange-900/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {phase === "legend" && (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-6 shadow-2xl ring-1 ring-white/5 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Quick legend
            </p>
            <h2 className="text-2xl font-bold text-zinc-50">What the emoticons mean</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-black/35 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Age icons (same as gameplay)
                </p>
                <p className="mb-2 text-[10px] leading-snug text-zinc-500">
                  Hair style indicates gender (male vs female), matching the scene.
                </p>
                <div className="flex items-end justify-between gap-2">
                  {LEGEND_PEOPLE.map((p) => (
                    <div key={`${p.age}-${p.attire}`} className="flex flex-1 flex-col items-center gap-1">
                      <CartoonPerson
                        variant={variantForAge(p.age)}
                        attire={p.attire}
                        gender={p.gender ?? "male"}
                        skinTone={p.skinTone ?? "medium"}
                        className="h-auto w-full max-w-[70px]"
                      />
                      <p className="text-[11px] font-semibold text-zinc-300">
                        {p.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-black/35 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Crossing status
                </p>
                <div className="space-y-2">
                  <div className="rounded-md border-2 border-solid border-emerald-600/60 bg-emerald-500/10 p-2">
                    <span className="rounded bg-emerald-800 px-2 py-0.5 text-[11px] font-black uppercase text-white">
                      ✓ Legal crossing
                    </span>
                  </div>
                  <div className="rounded-md border-2 border-dashed border-orange-500 bg-orange-400/12 p-2">
                    <span className="rounded bg-orange-600 px-2 py-0.5 text-[11px] font-black uppercase text-white">
                      ⚠ Jaywalking
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/35 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                Role labels (same HUD text)
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {LEGEND_ROLES.map((role, idx) => (
                  <div
                    key={role}
                    className="rounded-lg border border-zinc-700/70 bg-zinc-900/70 px-2 py-2 text-center"
                  >
                    <CartoonPerson
                      variant="adult"
                      attire={role}
                      gender={idx % 2 === 0 ? "male" : "female"}
                      skinTone={LEGEND_SKIN_TONES[idx % LEGEND_SKIN_TONES.length]}
                      className="mx-auto h-auto w-full max-w-[54px]"
                    />
                    <p className="mt-1 text-center text-[11px] font-semibold leading-snug text-zinc-200">
                      {roleLegendCaption(role)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/35 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                Pets (same art in the windshield)
              </p>
              <p className="mb-3 text-[10px] leading-snug text-zinc-500">
                Dogs and cats count as their own crossing figures — same HUD labels as in play.
              </p>
              <div className="flex flex-wrap items-end justify-center gap-10">
                <div className="flex flex-col items-center gap-1">
                  <CartoonPet
                    species="dog"
                    className="h-auto w-full max-w-[58px] drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)]"
                  />
                  <p className="text-[11px] font-semibold text-zinc-200">Dog</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <CartoonPet
                    species="cat"
                    className="h-auto w-full max-w-[58px] drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)]"
                  />
                  <p className="text-[11px] font-semibold text-zinc-200">Cat</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPhase("consent")}
                className="rounded-xl border border-zinc-600 px-6 py-3 font-semibold text-zinc-200 transition hover:border-zinc-400 hover:bg-zinc-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={startRun}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-3 text-base font-bold text-black shadow-lg shadow-orange-900/30 transition hover:brightness-110 active:scale-[0.98]"
              >
                Start run
              </button>
            </div>
          </div>
        )}

        {phase === "playing" && scenario && (
          <GameScreen
            scenario={scenario}
            scenarioKey={scenario.id}
            playing={playing}
            onChooseLeft={handleChooseLeft}
            onChooseRight={handleChooseRight}
            onTimerExpire={handleTimerExpire}
          />
        )}

        {phase === "gap" && (
          <div className="flex flex-col items-center gap-3 animate-pulse">
            <div className="h-1 w-32 rounded-full bg-zinc-700" />
            <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
              Next scenario
            </p>
          </div>
        )}

        {phase === "result" && lastOutcome && (
          <ResultScreen
            choiceLabel={lastOutcome.label}
            explanation={lastOutcome.explanation}
            reactionMs={lastOutcome.reactionMs}
            stats={stats}
            statsLoading={statsLoading}
            statsError={statsError}
          />
        )}

        {phase === "summary" && (
          <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Run complete
            </p>
            <h2 className="text-2xl font-bold">20 scenarios cleared</h2>
            <p className="text-sm text-zinc-400">
              Logged {decisions.length} decisions for this run.
            </p>
            <p className="text-xs text-zinc-500">
              Saved to `data/exports/decisions_all_runs.csv` on the server.
            </p>
            {diskLogStatus === "saving" && (
              <p className="text-xs text-zinc-400">Saving CSV…</p>
            )}
            {diskLogStatus === "error" && (
              <p className="text-xs text-red-400">CSV save failed: {diskLogError}</p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                disabled={decisions.length === 0}
                onClick={downloadAllRunsCSV}
                className="rounded-xl border border-zinc-600 px-6 py-3 font-semibold text-zinc-200 transition hover:border-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Download all runs CSV
              </button>
              <button
                type="button"
                onClick={replay}
                className="rounded-xl border border-zinc-600 px-6 py-3 font-semibold text-zinc-200 transition hover:border-zinc-400 hover:bg-zinc-800"
              >
                Play again
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
