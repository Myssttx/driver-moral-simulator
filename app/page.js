"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GameScreen from "@/components/GameScreen";
import ResultScreen from "@/components/ResultScreen";
import LegendFigure from "@/components/LegendFigure";
import RasterSprite from "@/components/RasterSprite";
import { ORDERED_SCENARIOS } from "@/data/runOrder";
import { variantForAge } from "@/lib/ageIcons";
import { roleLegendCaption } from "@/lib/roles";
import { getHumanSpriteSrc, getPetSpriteSrc } from "@/lib/referenceSprites";
import { useLSLMarkers, formatMarker } from "@/lib/lslMarkers";
import {
  BETWEEN_SCENARIOS_MS,
  RESULT_VISIBLE_MS,
  TOTAL_SCENARIOS,
} from "@/lib/runConfig";

// LAB DECISION: the EEG marker bridge is on by default. The legacy environment
// variable name is retained for compatibility even though the bridge now owns
// serial, audit CSV, and optional LSL outputs.
const LSL_ENABLED =
  (process.env.NEXT_PUBLIC_LSL_ENABLED ?? "true").toLowerCase() !== "false";
const REQUIRE_SERIAL =
  (process.env.NEXT_PUBLIC_REQUIRE_SERIAL ?? "true").toLowerCase() !== "false";

// LAB DECISION: condition label per round, used in marker labels and
// for downstream epoch grouping. Mirrors the fixed 4-tier difficulty
// structure documented at the top of data/scenarios.js (5 scenarios per set).
//   set1_baseline       — pure count asymmetry, all legal adults
//   set2_legality_age   — jaywalking + child/elder introduced
//   set3_roles_pets     — counts tight, qualitative weighting
//   set4_max_dilemma    — equal counts, every variable active
function conditionForRoundIndex(roundIndexZeroBased) {
  const tier = Math.floor(roundIndexZeroBased / 5) + 1;
  switch (tier) {
    case 1: return "set1_baseline";
    case 2: return "set2_legality_age";
    case 3: return "set3_roles_pets";
    case 4: return "set4_max_dilemma";
    default: return `set${tier}`;
  }
}

const LEGEND_PEOPLE = [
  { age: 10, attire: "student", label: "Child" },
  { age: 32, attire: "professional", label: "Adult" },
  { age: 72, attire: "medical", label: "Elder" },
];
const LEGEND_ROLES = [
  "professional",
  "medical",
  "worker",
  "student",
  "athlete",
  "casual",
];
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

/**
 * Operator-facing bridge/serial preflight. A green state means the Python
 * process opened the configured sender port; it does not claim EmotivPRO has
 * recorded a byte. Export verification remains the receipt check.
 */
function MarkerStatusPill({ status, bridgeInfo, lastError }) {
  const serial = bridgeInfo?.serial;
  let tone;
  if (lastError) {
    tone = { dot: "bg-red-500", text: "text-red-300", label: lastError };
  } else if (status === "open" && serial?.mode === "hardware" && serial?.ready) {
    tone = { dot: "bg-emerald-400", text: "text-emerald-300", label: `Serial ready: ${serial.port}` };
  } else if (status === "open" && serial?.mode === "simulation") {
    tone = { dot: "bg-amber-400", text: "text-amber-300", label: "Serial simulation — no EmotivPRO bytes" };
  } else if (status === "open") {
    tone = { dot: "bg-cyan-400", text: "text-cyan-300", label: "Bridge ready; serial output is off" };
  } else {
    tone = {
      connecting: { dot: "bg-amber-400 animate-pulse", text: "text-amber-300", label: "Marker bridge connecting…" },
      handshaking: { dot: "bg-amber-400 animate-pulse", text: "text-amber-300", label: "Checking marker bridge…" },
      closed: { dot: "bg-red-500", text: "text-red-300", label: "Marker bridge DOWN — run blocked" },
      disabled: { dot: "bg-zinc-600", text: "text-zinc-400", label: "Marker bridge disabled (dev mode)" },
    }[status] ?? { dot: "bg-zinc-600", text: "text-zinc-400", label: `Marker bridge: ${status}` };
  }
  return (
    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-black/40 px-3 py-1 text-[11px] font-semibold">
      <span className={`inline-block h-2 w-2 rounded-full ${tone.dot}`} />
      <span className={tone.text}>{tone.label}</span>
    </div>
  );
}

export default function Home() {
  const [phase, setPhase] = useState("consent");
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [decisions, setDecisions] = useState([]);
  const [runId, setRunId] = useState(null);
  const [runStartedAt, setRunStartedAt] = useState(null);
  const [lastOutcome, setLastOutcome] = useState(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [diskLogStatus, setDiskLogStatus] = useState("idle"); // idle|saving|saved|error
  const [diskLogError, setDiskLogError] = useState(null);

  const scenarioStartRef = useRef(0);
  const scenarioIndexRef = useRef(0);
  const decidedRef = useRef(false);
  const diskLoggedRef = useRef(false);
  const runIdRef = useRef(null);

  const scenario = ORDERED_SCENARIOS[scenarioIndex];

  // One bridge call fans out to serial (raw uint8), the optional rich LSL
  // stream, and the append-only bridge CSV. The source is part of routing so
  // similarly named dashboard events cannot inject participant-task codes.
  const {
    pushMarker,
    status: markerStatus,
    bridgeInfo,
    lastError: markerError,
  } = useLSLMarkers({
    enabled: LSL_ENABLED,
    source: "driver_moral_simulator",
  });
  const serialReady = Boolean(
    bridgeInfo?.serial?.ready &&
      ["hardware", "simulation"].includes(bridgeInfo?.serial?.mode),
  );
  const markerReady =
    !LSL_ENABLED ||
    (markerStatus === "open" && !markerError && (!REQUIRE_SERIAL || serialReady));
  // Keep a stable ref so effect dependency arrays don't capture stale closures.
  const pushMarkerRef = useRef(pushMarker);

  useEffect(() => {
    scenarioIndexRef.current = scenarioIndex;
  }, [scenarioIndex]);

  useEffect(() => {
    pushMarkerRef.current = pushMarker;
  }, [pushMarker]);

  const recordDecision = useCallback((choice, reactionMs) => {
    if (decidedRef.current) return;
    decidedRef.current = true;

    const idx = scenarioIndexRef.current;
    const sc = ORDERED_SCENARIOS[idx];

    // CHOICE marker: response-locked event for ERP analysis. Push BEFORE
    // any state updates so the bridge receive/serial timestamps reflect the
    // participant's keypress or click, not a later React commit.
    pushMarkerRef.current(
      formatMarker("choice", {
        session: runIdRef.current,
        trial: sc.id,
        condition: conditionForRoundIndex(idx),
        side: choice, // "left" | "right" | "timeout"
        rt_ms: Math.round(reactionMs),
      }),
    );

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
  }, []);

  const startRun = () => {
    if (!markerReady) return;
    const now = Date.now();
    const nextRunId = `run_${now}`;
    runIdRef.current = nextRunId;
    if (
      LSL_ENABLED &&
      !pushMarkerRef.current(formatMarker("session_start", { session: nextRunId }))
    ) {
      runIdRef.current = null;
      return;
    }

    setRunId(nextRunId);
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

    const idx = scenarioIndexRef.current;
    const sc = ORDERED_SCENARIOS[idx];
    const cond = conditionForRoundIndex(idx);

    // TRIAL_START marker: trial bookend. Fired one render tick before the
    // scene is fully painted.
    pushMarkerRef.current(
      formatMarker("trial_start", {
        session: runIdRef.current,
        trial: sc.id,
        condition: cond,
      }),
    );

    // SCENARIO_ONSET marker: the primary STIMULUS-LOCKED software event for
    // ERP analysis. React effects run after commit and are not a photodiode;
    // validate display timing separately if sub-frame onset precision matters.
    pushMarkerRef.current(
      formatMarker("scenario_onset", {
        session: runIdRef.current,
        trial: sc.id,
        condition: cond,
      }),
    );

    const readyTimer = setTimeout(() => setPlaying(true), 0);
    return () => clearTimeout(readyTimer);
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

    // OUTCOME_SHOWN marker: the ResultScreen is now on-screen.
    // LAB DECISION: the current build always shows an outcome popup. If
    // a future protocol removes it for some trials, conditionally skip
    // this push.
    const sc = lastOutcome?.scenario;
    if (sc) {
      pushMarkerRef.current(
        formatMarker("outcome_shown", {
          session: runIdRef.current,
          trial: sc.id,
          condition: conditionForRoundIndex(scenarioIndexRef.current),
        }),
      );
    }

    const t1 = setTimeout(() => setPhase("gap"), RESULT_VISIBLE_MS);
    return () => clearTimeout(t1);
  }, [phase, lastOutcome?.scenario]);

  useEffect(() => {
    if (phase !== "gap") return;

    const idx = scenarioIndexRef.current;
    const sc = ORDERED_SCENARIOS[idx];

    // TRIAL_END marker: closes the trial, opens the inter-trial interval.
    pushMarkerRef.current(
      formatMarker("trial_end", {
        session: runIdRef.current,
        trial: sc.id,
        condition: conditionForRoundIndex(idx),
      }),
    );

    const t = setTimeout(() => {
      if (idx >= ORDERED_SCENARIOS.length - 1) {
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
    runIdRef.current = null;
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

  // SESSION_END marker: bookend matching session_start. Pushed once when
  // the participant reaches the summary screen, regardless of whether the
  // CSV save below succeeds.
  const sessionEndPushedRef = useRef(false);
  useEffect(() => {
    if (phase !== "summary") return;
    if (sessionEndPushedRef.current) return;
    sessionEndPushedRef.current = true;
    pushMarkerRef.current(
      formatMarker("session_end", { session: runIdRef.current }),
    );
  }, [phase]);

  // Reset the session_end latch when a new run starts.
  useEffect(() => {
    if (phase === "consent" || phase === "legend") {
      sessionEndPushedRef.current = false;
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "summary") return;
    if (!runId) return;
    if (decisions.length === 0) return;
    if (diskLoggedRef.current) return;

    diskLoggedRef.current = true;
    let ignore = false;
    const statusTimer = setTimeout(() => {
      if (ignore) return;
      setDiskLogStatus("saving");
      setDiskLogError(null);
    }, 0);

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
      .then(() => {
        if (!ignore) setDiskLogStatus("saved");
      })
      .catch((e) => {
        if (ignore) return;
        setDiskLogStatus("error");
        setDiskLogError(e?.message ?? "Failed to write CSV.");
      });

    return () => {
      ignore = true;
      clearTimeout(statusTimer);
    };
  }, [phase, runId, runStartedAt, decisions]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/80 py-4 text-center">
        <h1 className="text-xl font-black tracking-tight text-zinc-50 sm:text-2xl">
          Driver Moral Simulator
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          First-person ethics at speed — no wrong answers, only tradeoffs.
        </p>
        {LSL_ENABLED && (
          <MarkerStatusPill
            status={markerStatus}
            bridgeInfo={bridgeInfo}
            lastError={markerError}
          />
        )}
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
                  You’ll complete <span className="font-semibold text-amber-400/95">{TOTAL_SCENARIOS}</span> scenarios with a short
                  outcome after each, then a <span className="font-semibold text-zinc-200">summary</span> of this
                  session. Progress is shown as you go (scenario number / {TOTAL_SCENARIOS}).
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
            <h2 className="text-2xl font-bold text-zinc-50">What the crossing figures mean</h2>

            <p className="text-[11px] leading-relaxed text-zinc-400">
              Crossing figures are transparent PNG sprites (flat vector style). They are shown larger here than in the
              windshield so you can see detail — in play they scale to the road scene.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-black/35 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Age (same as gameplay)
                </p>
                <p className="mb-2 text-[10px] leading-snug text-zinc-500">
                  Child, adult, and elder each have their own generated sprite (HUD still shows the text label).
                </p>
                <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-4">
                  {LEGEND_PEOPLE.map((p) => (
                    <div key={`${p.age}-${p.attire}`} className="flex flex-col items-center gap-2">
                      <LegendFigure
                        src={getHumanSpriteSrc({
                          role: p.attire,
                          ageVariant: variantForAge(p.age),
                        })}
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
              <div className="grid gap-3 sm:grid-cols-3">
                {LEGEND_ROLES.map((role) => (
                  <div
                    key={role}
                    className="flex flex-col items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/70 px-2 py-3 text-center"
                  >
                    <LegendFigure src={getHumanSpriteSrc({ role, ageVariant: "adult" })} />
                    <p className="text-center text-[11px] font-semibold leading-snug text-zinc-200">
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
                Dog and cat use the same generated flat-vector style as the people.
              </p>
              <div className="flex flex-wrap items-end justify-center gap-8 sm:gap-12">
                <div className="flex flex-col items-center gap-2">
                  <LegendFigure
                    wide
                    src={getPetSpriteSrc("dog")}
                    imgClassName="drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
                  />
                  <p className="text-[11px] font-semibold text-zinc-200">Dog</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <LegendFigure
                    wide
                    src={getPetSpriteSrc("cat")}
                    imgClassName="drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
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
                disabled={!markerReady}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-3 text-base font-bold text-black shadow-lg shadow-orange-900/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Start run
              </button>
            </div>
            {!markerReady && (
              <p className="text-right text-xs font-semibold text-red-300">
                Start is blocked until the local marker bridge reports serial ready.
              </p>
            )}
          </div>
        )}

        {phase === "playing" && scenario && (
          <GameScreen
            scenario={scenario}
            scenarioKey={scenario.id}
            roundIndex={scenarioIndex + 1}
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
          />
        )}

        {phase === "summary" && (
          <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Run complete
            </p>
            <h2 className="text-2xl font-bold">{TOTAL_SCENARIOS} scenarios cleared</h2>
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
