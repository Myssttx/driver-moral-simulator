"use client";

import { useCallback, useMemo, useState } from "react";
import { formatMarker, useLSLMarkers } from "@/lib/lslMarkers";

const LSL_ENABLED =
  (process.env.NEXT_PUBLIC_LSL_ENABLED ?? "true").toLowerCase() !== "false";

const BRIDGE_LABEL = "ws://127.0.0.1:7779/markers";
const STREAM_LABEL = "SplitOrStealProtocolMarkers";

const PROTOCOL_SECTIONS = [
  {
    id: "setup",
    label: "Setup",
    stepRange: "Steps 1-7",
    events: [
      { id: "session_start", marker: "session_start", label: "Session start", step: "00", phase: "session" },
      { id: "consent_start", marker: "consent_start", label: "Introduction and consent start", step: "01", phase: "consent" },
      { id: "consent_signed", marker: "consent_signed", label: "Consent signed", step: "04", phase: "consent" },
      { id: "pre_survey_start", marker: "pre_task_survey_start", label: "Pre-task survey start", step: "05", phase: "survey" },
      { id: "pre_survey_complete", marker: "pre_task_survey_complete", label: "Pre-task survey complete", step: "05", phase: "survey" },
      { id: "equipment_setup_start", marker: "equipment_setup_start", label: "Equipment setup start", step: "06", phase: "equipment" },
      { id: "emotiv_setup_complete", marker: "emotiv_setup_complete", label: "Emotiv setup complete", step: "06", phase: "equipment" },
      { id: "emotibit_setup_complete", marker: "emotibit_setup_complete", label: "EmotiBit setup complete", step: "06", phase: "equipment" },
      { id: "baseline_start", marker: "baseline_start", label: "Baseline recording start", step: "07", phase: "baseline" },
      { id: "baseline_end", marker: "baseline_end", label: "Baseline recording end", step: "07", phase: "baseline" },
    ],
  },
  {
    id: "split_or_steal",
    label: "Split-or-Steal",
    stepRange: "Steps 8-15",
    events: [
      { id: "sos_rules_start", marker: "sos_rules_start", label: "Rules explanation start", step: "08", phase: "split_or_steal" },
      { id: "sos_rules_end", marker: "sos_rules_end", label: "Rules explanation complete", step: "08", phase: "split_or_steal" },
      { id: "sos_practice_prompt", marker: "sos_practice_prompt", label: "Practice round prompt shown", step: "09", phase: "split_or_steal", round: "practice" },
      { id: "sos_human_prompt", marker: "sos_human_prompt", label: "Human round prompt shown", step: "10", phase: "split_or_steal", round: "human", opponent_kind: "human" },
      { id: "sos_ai_prompt", marker: "sos_ai_prompt", label: "AI round prompt shown", step: "12", phase: "split_or_steal", round: "ai", opponent_kind: "ai" },
      { id: "sos_unknown_prompt", marker: "sos_unknown_prompt", label: "Unknown round prompt shown", step: "14", phase: "split_or_steal", round: "unknown", opponent_kind: "unknown" },
    ],
  },
  {
    id: "trolley",
    label: "Trolley",
    stepRange: "Steps 16-17",
    events: [
      { id: "trolley_rules_start", marker: "trolley_rules_start", label: "Trolley rules start", step: "16", phase: "trolley" },
      { id: "trolley_rules_end", marker: "trolley_rules_end", label: "Trolley rules complete", step: "16", phase: "trolley" },
      { id: "trolley_task_start", marker: "trolley_task_start", label: "Trolley task start", step: "17", phase: "trolley" },
      { id: "trolley_task_end", marker: "trolley_task_end", label: "Trolley task end", step: "17", phase: "trolley" },
    ],
  },
  {
    id: "post_task",
    label: "Post-task",
    stepRange: "Steps 18-20",
    events: [
      { id: "equipment_removal_start", marker: "equipment_removal_start", label: "Equipment removal start", step: "18", phase: "post_task" },
      { id: "equipment_removed", marker: "equipment_removed", label: "Equipment removed", step: "18", phase: "post_task" },
      { id: "post_survey_start", marker: "post_task_survey_start", label: "Post-task survey start", step: "19", phase: "post_task" },
      { id: "post_survey_complete", marker: "post_task_survey_complete", label: "Post-task survey complete", step: "19", phase: "post_task" },
      { id: "debrief_start", marker: "debrief_start", label: "Debrief start", step: "20", phase: "debrief" },
      { id: "debrief_end", marker: "debrief_end", label: "Debrief complete", step: "20", phase: "debrief" },
      { id: "session_end", marker: "session_end", label: "Session end", step: "20", phase: "session" },
    ],
  },
];

const ROUND_CONFIGS = [
  { id: "practice", label: "Practice", step: "09", opponentKind: "practice" },
  { id: "human", label: "Human", step: "10", opponentKind: "human" },
  { id: "ai", label: "AI", step: "12", opponentKind: "ai" },
  { id: "unknown", label: "Unknown", step: "14", opponentKind: "unknown" },
];

const SERIAL_TASKS = [
  { id: "after_human", label: "After human", step: "11", afterRound: "human" },
  { id: "after_ai", label: "After AI", step: "13", afterRound: "ai" },
  { id: "after_unknown", label: "After unknown", step: "15", afterRound: "unknown" },
];

const CHOICES = ["split", "steal"];

function createSessionId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `sos_${stamp}`;
}

function emptyRoundState() {
  return ROUND_CONFIGS.reduce((acc, round) => {
    acc[round.id] = {
      participantChoice: null,
      opponentChoice: null,
      startedAt: null,
      ended: false,
    };
    return acc;
  }, {});
}

function emptySerialState() {
  return SERIAL_TASKS.reduce((acc, task, index) => {
    acc[task.id] = {
      startNumber: String(700 - index * 70),
      startedAt: null,
      ended: false,
    };
    return acc;
  }, {});
}

function payoffFor(participantChoice, opponentChoice) {
  if (!participantChoice || !opponentChoice) return null;
  if (participantChoice === "split" && opponentChoice === "split") {
    return { participant: 50, opponent: 50 };
  }
  if (participantChoice === "split" && opponentChoice === "steal") {
    return { participant: 0, opponent: 100 };
  }
  if (participantChoice === "steal" && opponentChoice === "split") {
    return { participant: 100, opponent: 0 };
  }
  return { participant: 0, opponent: 0 };
}

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function markerSafe(value, fallback = "unassigned") {
  const cleaned = String(value ?? "").trim().replace(/[|=]/g, "_");
  return cleaned || fallback;
}

function downloadCsv(rows, sessionId) {
  const header = ["local_time", "delivery", "event_label", "marker"];
  const csv = [
    header.join(","),
    ...rows.map((row) => [
      csvEscape(row.localTime),
      csvEscape(row.delivery),
      csvEscape(row.eventLabel),
      csvEscape(row.marker),
    ].join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sessionId}_lsl_marker_log.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function StatusPill({ status }) {
  const state = {
    open: ["bg-emerald-400", "text-emerald-200", "Bridge connected"],
    connecting: ["bg-amber-400", "text-amber-200", "Bridge connecting"],
    closed: ["bg-rose-500", "text-rose-200", "Bridge closed"],
    disabled: ["bg-zinc-500", "text-zinc-300", "Markers disabled"],
  }[status] ?? ["bg-zinc-500", "text-zinc-300", `Bridge ${status}`];

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-semibold">
      <span className={`h-2.5 w-2.5 rounded-full ${state[0]}`} />
      <span className={state[1]}>{state[2]}</span>
    </span>
  );
}

function ProtocolButton({ event, isDone, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={`grid w-full grid-cols-[4.5rem_1fr_6.5rem] items-center gap-3 border-b border-zinc-800 px-4 py-3 text-left transition hover:bg-zinc-900/80 ${
        isDone ? "bg-emerald-950/25" : "bg-zinc-950"
      }`}
    >
      <span className="font-mono text-xs text-zinc-500">Step {event.step}</span>
      <span className="min-w-0 text-sm font-semibold text-zinc-100">{event.label}</span>
      <span
        className={`rounded-full px-2 py-1 text-center text-xs font-semibold ${
          isDone ? "bg-emerald-500/15 text-emerald-200" : "bg-cyan-500/10 text-cyan-200"
        }`}
      >
        {isDone ? "Sent" : "Send"}
      </span>
    </button>
  );
}

export default function SplitOrStealDashboard() {
  const [sessionId, setSessionId] = useState(createSessionId);
  const [participantId, setParticipantId] = useState("");
  const [counterbalance, setCounterbalance] = useState("rules_first");
  const [activeSectionId, setActiveSectionId] = useState(PROTOCOL_SECTIONS[0].id);
  const [completedEvents, setCompletedEvents] = useState({});
  const [eventLog, setEventLog] = useState([]);
  const [roundState, setRoundState] = useState(emptyRoundState);
  const [serialState, setSerialState] = useState(emptySerialState);

  const { pushMarker, status: lslStatus, lastAck } = useLSLMarkers({
    enabled: LSL_ENABLED,
  });

  const activeSection = useMemo(
    () => PROTOCOL_SECTIONS.find((section) => section.id === activeSectionId) ?? PROTOCOL_SECTIONS[0],
    [activeSectionId],
  );

  const completedCount = useMemo(
    () => Object.keys(completedEvents).length,
    [completedEvents],
  );

  const sendMarker = useCallback((marker, fields, eventLabel) => {
    const label = formatMarker(marker, {
      session: markerSafe(sessionId, "no_session"),
      participant: markerSafe(participantId),
      counterbalance,
      ...fields,
    });
    const sent = pushMarker(label);
    const localTime = new Date().toISOString();
    setEventLog((rows) => [
      {
        id: `${Date.now()}_${rows.length}`,
        localTime,
        delivery: sent ? "sent" : "buffered",
        eventLabel,
        marker: label,
      },
      ...rows,
    ].slice(0, 250));
    return sent;
  }, [counterbalance, participantId, pushMarker, sessionId]);

  const sendProtocolEvent = useCallback((event) => {
    sendMarker(event.marker, {
      step: event.step,
      phase: event.phase,
      round: event.round,
      opponent_kind: event.opponent_kind,
    }, event.label);
    setCompletedEvents((prev) => ({
      ...prev,
      [event.id]: new Date().toISOString(),
    }));
  }, [sendMarker]);

  const sendRoundMarker = useCallback((round, marker, fields, eventLabel) => {
    sendMarker(marker, {
      phase: "split_or_steal",
      step: round.step,
      round: round.id,
      opponent_kind: round.opponentKind,
      ...(fields ?? {}),
    }, eventLabel);
  }, [sendMarker]);

  const startRound = useCallback((round) => {
    setRoundState((prev) => ({
      ...prev,
      [round.id]: { ...prev[round.id], startedAt: Date.now(), ended: false },
    }));
    sendRoundMarker(round, "sos_round_start", null, `${round.label} round start`);
  }, [sendRoundMarker]);

  const chooseForRound = useCallback((round, actor, choice) => {
    setRoundState((prev) => ({
      ...prev,
      [round.id]: {
        ...prev[round.id],
        [actor === "participant" ? "participantChoice" : "opponentChoice"]: choice,
      },
    }));
    sendRoundMarker(round, "sos_choice", { actor, choice }, `${round.label} ${actor} ${choice}`);
  }, [sendRoundMarker]);

  const revealOutcome = useCallback((round) => {
    const state = roundState[round.id];
    const payoff = payoffFor(state.participantChoice, state.opponentChoice);
    if (!payoff) return;
    sendRoundMarker(round, "sos_outcome_shown", {
      participant_choice: state.participantChoice,
      opponent_choice: state.opponentChoice,
      participant_payoff: payoff.participant,
      opponent_payoff: payoff.opponent,
    }, `${round.label} outcome shown`);
  }, [roundState, sendRoundMarker]);

  const endRound = useCallback((round) => {
    setRoundState((prev) => ({
      ...prev,
      [round.id]: { ...prev[round.id], ended: true },
    }));
    sendRoundMarker(round, "sos_round_end", null, `${round.label} round end`);
  }, [sendRoundMarker]);

  const generateSerialNumber = useCallback((task) => {
    const n = String(100 + Math.floor(Math.random() * 900));
    setSerialState((prev) => ({
      ...prev,
      [task.id]: { ...prev[task.id], startNumber: n },
    }));
  }, []);

  const setSerialNumber = useCallback((task, value) => {
    const clean = value.replace(/\D/g, "").slice(0, 3);
    setSerialState((prev) => ({
      ...prev,
      [task.id]: { ...prev[task.id], startNumber: clean },
    }));
  }, []);

  const startSerial = useCallback((task) => {
    const startNumber = serialState[task.id].startNumber || "unassigned";
    setSerialState((prev) => ({
      ...prev,
      [task.id]: { ...prev[task.id], startedAt: Date.now(), ended: false },
    }));
    sendMarker("serial_sevens_start", {
      phase: "distractor",
      step: task.step,
      task: task.id,
      after_round: task.afterRound,
      start_number: startNumber,
    }, `${task.label} serial sevens start`);
  }, [sendMarker, serialState]);

  const endSerial = useCallback((task) => {
    const state = serialState[task.id];
    const durationS = state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : undefined;
    setSerialState((prev) => ({
      ...prev,
      [task.id]: { ...prev[task.id], ended: true },
    }));
    sendMarker("serial_sevens_end", {
      phase: "distractor",
      step: task.step,
      task: task.id,
      after_round: task.afterRound,
      start_number: state.startNumber || "unassigned",
      duration_s: durationS,
    }, `${task.label} serial sevens end`);
  }, [sendMarker, serialState]);

  const startFreshSession = useCallback(() => {
    setSessionId(createSessionId());
    setCompletedEvents({});
    setEventLog([]);
    setRoundState(emptyRoundState());
    setSerialState(emptySerialState());
  }, []);

  const signalAdjustment = useCallback(() => {
    sendMarker("signal_quality_adjustment", {
      phase: "equipment",
      event: "emotiv_rewet_or_adjustment",
    }, "Emotiv signal adjustment");
  }, [sendMarker]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/95 px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-200">Split-or-Steal Protocol</p>
            <h1 className="text-2xl font-bold text-zinc-50">LSL Marker Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={lslStatus} />
            <button
              type="button"
              onClick={() => sendMarker("test_marker", { phase: "system", event: "operator_test" }, "Test marker")}
              className="rounded-md border border-cyan-700 bg-cyan-950 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400"
            >
              Send test marker
            </button>
            <button
              type="button"
              onClick={startFreshSession}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500"
            >
              New session
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[17rem_minmax(0,1fr)_24rem]">
        <aside className="space-y-4">
          <section className="border border-zinc-800 bg-zinc-900/70">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-bold text-zinc-100">Session</h2>
            </div>
            <div className="space-y-3 p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-zinc-400">Session ID</span>
                <input
                  value={sessionId}
                  onChange={(event) => setSessionId(event.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-zinc-400">Participant ID</span>
                <input
                  value={participantId}
                  onChange={(event) => setParticipantId(event.target.value)}
                  placeholder="optional"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-zinc-400">Counterbalance</span>
                <select
                  value={counterbalance}
                  onChange={(event) => setCounterbalance(event.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500"
                >
                  <option value="rules_first">Rules first</option>
                  <option value="human_first">Human round first</option>
                </select>
              </label>
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
                <p className="font-mono text-zinc-300">{STREAM_LABEL}</p>
                <p className="mt-1 font-mono">{BRIDGE_LABEL}</p>
                <p className="mt-2">Sent events: {completedCount}</p>
                <p>Last ACK: {lastAck?.n ? `#${lastAck.n}` : "none"}</p>
              </div>
            </div>
          </section>

          <section className="border border-zinc-800 bg-zinc-900/70">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-bold text-zinc-100">Protocol</h2>
            </div>
            <nav className="divide-y divide-zinc-800">
              {PROTOCOL_SECTIONS.map((section) => {
                const sent = section.events.filter((event) => completedEvents[event.id]).length;
                const active = section.id === activeSectionId;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSectionId(section.id)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left transition ${
                      active ? "bg-cyan-500/10 text-cyan-100" : "bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{section.label}</span>
                      <span className="block text-xs text-zinc-500">{section.stepRange}</span>
                    </span>
                    <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                      {sent}/{section.events.length}
                    </span>
                  </button>
                );
              })}
            </nav>
          </section>
        </aside>

        <div className="space-y-4">
          <section className="border border-zinc-800 bg-zinc-900/70">
            <div className="flex flex-col gap-2 border-b border-zinc-800 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-50">{activeSection.label}</h2>
                <p className="text-sm text-zinc-500">{activeSection.stepRange}</p>
              </div>
              {activeSection.id === "trolley" && (
                <a
                  href="/"
                  target="_blank"
                  className="rounded-md border border-amber-700 bg-amber-950 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-400"
                >
                  Open trolley task
                </a>
              )}
            </div>
            <div>
              {activeSection.events.map((event) => (
                <ProtocolButton
                  key={event.id}
                  event={event}
                  isDone={Boolean(completedEvents[event.id])}
                  onClick={sendProtocolEvent}
                />
              ))}
            </div>
          </section>

          <section className="border border-zinc-800 bg-zinc-900/70">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-lg font-bold text-zinc-50">Split-or-Steal Rounds</h2>
            </div>
            <div className="divide-y divide-zinc-800">
              {ROUND_CONFIGS.map((round) => {
                const state = roundState[round.id];
                const payoff = payoffFor(state.participantChoice, state.opponentChoice);
                return (
                  <div key={round.id} className="grid gap-3 bg-zinc-950 px-4 py-4 xl:grid-cols-[9rem_1fr_1fr_8rem] xl:items-center">
                    <div>
                      <p className="text-sm font-bold text-zinc-100">{round.label}</p>
                      <p className="font-mono text-xs text-zinc-500">Step {round.step}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startRound(round)}
                        className="rounded-md border border-cyan-700 bg-cyan-950 px-3 py-2 text-sm font-semibold text-cyan-100 hover:border-cyan-400"
                      >
                        Start
                      </button>
                      {CHOICES.map((choice) => (
                        <button
                          key={`${round.id}-participant-${choice}`}
                          type="button"
                          onClick={() => chooseForRound(round, "participant", choice)}
                          className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                            state.participantChoice === choice
                              ? "border-emerald-400 bg-emerald-950 text-emerald-100"
                              : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500"
                          }`}
                        >
                          Participant {choice}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CHOICES.map((choice) => (
                        <button
                          key={`${round.id}-opponent-${choice}`}
                          type="button"
                          onClick={() => chooseForRound(round, "opponent", choice)}
                          className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                            state.opponentChoice === choice
                              ? "border-violet-400 bg-violet-950 text-violet-100"
                              : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-zinc-500"
                          }`}
                        >
                          Opponent {choice}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <button
                        type="button"
                        disabled={!payoff}
                        onClick={() => revealOutcome(round)}
                        className="rounded-md border border-amber-700 bg-amber-950 px-3 py-2 text-sm font-semibold text-amber-100 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Reveal
                      </button>
                      <button
                        type="button"
                        onClick={() => endRound(round)}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 hover:border-zinc-500"
                      >
                        End
                      </button>
                      {payoff && (
                        <p className="basis-full text-xs text-zinc-500 xl:text-right">
                          Payoff P{payoff.participant} O{payoff.opponent}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="border border-zinc-800 bg-zinc-900/70">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-lg font-bold text-zinc-50">Serial Sevens</h2>
            </div>
            <div className="divide-y divide-zinc-800">
              {SERIAL_TASKS.map((task) => {
                const state = serialState[task.id];
                return (
                  <div key={task.id} className="grid gap-3 bg-zinc-950 px-4 py-4 md:grid-cols-[9rem_10rem_1fr] md:items-center">
                    <div>
                      <p className="text-sm font-bold text-zinc-100">{task.label}</p>
                      <p className="font-mono text-xs text-zinc-500">Step {task.step}</p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={state.startNumber}
                        onChange={(event) => setSerialNumber(task, event.target.value)}
                        inputMode="numeric"
                        className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => generateSerialNumber(task)}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 hover:border-zinc-500"
                      >
                        Generate
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <button
                        type="button"
                        onClick={() => startSerial(task)}
                        className="rounded-md border border-cyan-700 bg-cyan-950 px-3 py-2 text-sm font-semibold text-cyan-100 hover:border-cyan-400"
                      >
                        Start
                      </button>
                      <button
                        type="button"
                        onClick={() => endSerial(task)}
                        className="rounded-md border border-rose-700 bg-rose-950 px-3 py-2 text-sm font-semibold text-rose-100 hover:border-rose-400"
                      >
                        End
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="border border-zinc-800 bg-zinc-900/70">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-bold text-zinc-100">Fast Markers</h2>
              <button
                type="button"
                onClick={signalAdjustment}
                className="rounded-md border border-amber-700 bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:border-amber-400"
              >
                Emotiv adjust
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4">
              <button
                type="button"
                onClick={() => sendMarker("operator_note", { phase: "operator", event: "pause" }, "Pause note")}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:border-zinc-500"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={() => sendMarker("operator_note", { phase: "operator", event: "resume" }, "Resume note")}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 hover:border-zinc-500"
              >
                Resume
              </button>
            </div>
          </section>

          <section className="border border-zinc-800 bg-zinc-900/70">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-bold text-zinc-100">Marker Log</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={eventLog.length === 0}
                  onClick={() => downloadCsv(eventLog.slice().reverse(), sessionId)}
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  CSV
                </button>
                <button
                  type="button"
                  disabled={eventLog.length === 0}
                  onClick={() => setEventLog([])}
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="max-h-[42rem] overflow-auto">
              {eventLog.length === 0 ? (
                <p className="px-4 py-6 text-sm text-zinc-500">No markers sent yet.</p>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {eventLog.map((entry) => (
                    <div key={entry.id} className="bg-zinc-950 px-4 py-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold text-zinc-100">{entry.eventLabel}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          entry.delivery === "sent" ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"
                        }`}>
                          {entry.delivery}
                        </span>
                      </div>
                      <p className="font-mono text-[11px] leading-5 text-zinc-500">{entry.marker}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
