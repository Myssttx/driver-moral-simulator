"""EEG session logger: detects and records LSL markers alongside a live session.

Why this exists
----------------
EmotivPRO is the authoritative EEG recorder — this script never touches raw
EEG samples and never saves them. Its only job is to sit on the LSL network
during a session and:

  1. Pre-flight check: confirm the marker stream published by
     ``marker_bridge.py`` (see that file) is actually up before the operator
     starts the real recording. Fails loudly if it isn't found in time.
  2. Detect every marker pushed to that stream in real time and write it,
     with its LSL timestamp, to a parallel behavioral CSV — a second, portable
     copy of the marker log independent of whatever EmotivPRO exports.
  3. Optionally watch the raw EEG LSL stream just to prove signal is flowing
     (min/max/RMS per channel, printed to stdout) — a sanity check for the
     operator, not a recording. No EEG sample is ever written to disk here.

Launch order for a session
---------------------------
  1. Start EmotivPRO, arm a recording, confirm its LSL inlet is receiving.
  2. Start the marker bridge:   python python/marker_bridge.py
  3. Start this logger:         python python/session_logger.py
  4. Start the dashboard (npm run dev) and run the session.
  5. Ctrl-C here when the session ends; the CSV + metadata sidecar are
     flushed and closed, and a summary is printed.

Post-session, ``analyze_session.py`` cross-checks this CSV's marker count
against what EmotivPRO recorded to catch dropped markers.
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import signal
import sys
import time
from dataclasses import dataclass, field

try:
    import pylsl
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "pylsl is not installed. Run: pip install -r python/requirements.txt"
    ) from exc


# ---------------------------------------------------------------------------
# Configuration
#
# These must match the other components of the pipeline (game, bridge,
# EmotivPRO LSL config). Change them in ONE place; keep this file's
# MARKER_STREAM_NAME in sync with marker_bridge.py's STREAM_NAME.
# ---------------------------------------------------------------------------

# LAB DECISION: must equal marker_bridge.py's STREAM_NAME.
MARKER_STREAM_NAME = "SplitOrStealProtocolMarkers"
MARKER_STREAM_SOURCE_ID = "split-or-steal-protocol-bridge-v1"

# LAB DECISION: how long to wait for the marker stream to appear before
# giving up. Long enough to cover the bridge's own startup + LSL discovery
# broadcast interval, short enough that a genuinely absent bridge is caught
# before the operator wastes a session on it.
STREAM_RESOLVE_TIMEOUT_S = 10.0

# LAB DECISION: EEG sanity monitor is opt-in (--monitor-eeg) since it is not
# required for marker logging to work, and requires the headset stream to
# already be resolvable on LSL (only true once EmotivPRO has a live signal).
EEG_STREAM_TYPE = "EEG"
EEG_CHECK_INTERVAL_S = 2.0

# LAB DECISION: CSV schema. Extra marker fields beyond event_type/trial/
# condition are preserved verbatim in extra_json so no field is ever lost,
# even if the schema grows.
CSV_FIELDNAMES = [
    "marker_index",
    "lsl_timestamp",
    "event_type",
    "trial",
    "condition",
    "extra_json",
    "raw_label",
]

log = logging.getLogger("session_logger")


@dataclass
class SessionStats:
    markers_logged: int = 0
    first_marker_ts: float | None = None
    last_marker_ts: float | None = None
    eeg_channel_count: int = 0
    eeg_samples_seen: int = 0


def parse_marker(label: str) -> dict:
    """Parse the pipe-delimited schema: event_type|trial=NN|condition=XXX|...

    Unknown/extra key=value fields are kept in "extra" rather than dropped.
    A label with no '=' fields at all is still valid (event_type only).
    """
    parts = [p for p in label.split("|") if p != ""]
    if not parts:
        return {"event_type": "", "trial": "", "condition": "", "extra": {}}

    event_type = parts[0]
    trial = ""
    condition = ""
    extra: dict[str, str] = {}

    for part in parts[1:]:
        if "=" not in part:
            # Malformed field-ish token; keep it visible rather than silently
            # dropping it.
            extra[f"unparsed_{len(extra)}"] = part
            continue
        key, _, value = part.partition("=")
        if key == "trial":
            trial = value
        elif key == "condition":
            condition = value
        else:
            extra[key] = value

    return {"event_type": event_type, "trial": trial, "condition": condition, "extra": extra}


def resolve_marker_inlet(timeout: float) -> "pylsl.StreamInlet":
    log.info("resolving marker stream %r (timeout=%.1fs)...", MARKER_STREAM_NAME, timeout)
    streams = pylsl.resolve_byprop("name", MARKER_STREAM_NAME, timeout=timeout)
    if not streams:
        raise SystemExit(
            f"FATAL: marker stream '{MARKER_STREAM_NAME}' not found after "
            f"{timeout:.1f}s. Is python/marker_bridge.py running? Refusing "
            f"to start a session logger with no marker source."
        )
    info = streams[0]
    if info.source_id() and info.source_id() != MARKER_STREAM_SOURCE_ID:
        log.warning(
            "marker stream source_id=%r does not match expected %r — "
            "make sure this is the intended bridge instance.",
            info.source_id(), MARKER_STREAM_SOURCE_ID,
        )
    inlet = pylsl.StreamInlet(info, max_buflen=360, recover=True)
    log.info(
        "marker stream resolved: name=%s type=%s source_id=%s",
        info.name(), info.type(), info.source_id(),
    )
    return inlet


def resolve_eeg_inlet(timeout: float) -> "pylsl.StreamInlet | None":
    log.info("resolving EEG stream (type=%r, timeout=%.1fs)...", EEG_STREAM_TYPE, timeout)
    streams = pylsl.resolve_byprop("type", EEG_STREAM_TYPE, timeout=timeout)
    if not streams:
        log.warning(
            "no EEG stream (type=%r) found after %.1fs — sanity monitor "
            "disabled for this session. Marker logging continues regardless.",
            EEG_STREAM_TYPE, timeout,
        )
        return None
    info = streams[0]
    inlet = pylsl.StreamInlet(info, max_buflen=360, recover=True)
    log.info(
        "EEG stream resolved: name=%s channels=%d srate=%.1fHz",
        info.name(), info.channel_count(), info.nominal_srate(),
    )
    return inlet


def check_output_path(path: str, force: bool) -> None:
    if os.path.exists(path) and not force:
        raise SystemExit(
            f"FATAL: output file already exists: {path}\n"
            f"Refusing to silently overwrite a prior session's data. "
            f"Pass --force to overwrite or choose a different --output path."
        )
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def default_output_path() -> str:
    # Matches the python/sessions/ path already carved out in .gitignore —
    # session CSVs stay on the lab machine, not in git.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    return os.path.join(script_dir, "sessions", f"session_{stamp}.csv")


def run(args: argparse.Namespace) -> int:
    check_output_path(args.output, args.force)
    sidecar_path = os.path.splitext(args.output)[0] + ".meta.json"
    check_output_path(sidecar_path, args.force)

    marker_inlet = resolve_marker_inlet(args.timeout)

    eeg_inlet = None
    if args.monitor_eeg:
        eeg_inlet = resolve_eeg_inlet(args.timeout)
        if eeg_inlet is None and args.require_eeg:
            raise SystemExit(
                "FATAL: --require-eeg was set but no EEG stream was found."
            )

    stats = SessionStats()
    if eeg_inlet is not None:
        stats.eeg_channel_count = eeg_inlet.info().channel_count()

    running = True

    def _request_stop(*_: object) -> None:
        nonlocal running
        log.info("shutdown requested")
        running = False

    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, _request_stop)

    session_start_ts = pylsl.local_clock()
    log.info("session logger started at lsl_time=%.6f — writing to %s", session_start_ts, args.output)
    log.info("press Ctrl-C to stop")

    last_eeg_check = 0.0

    with open(args.output, "w", newline="", encoding="utf-8", buffering=1) as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()

        while running:
            sample, ts = marker_inlet.pull_sample(timeout=0.5)
            if sample is not None:
                label = sample[0].strip()
                if label:
                    stats.markers_logged += 1
                    if stats.first_marker_ts is None:
                        stats.first_marker_ts = ts
                    stats.last_marker_ts = ts

                    parsed = parse_marker(label)
                    writer.writerow({
                        "marker_index": stats.markers_logged,
                        "lsl_timestamp": f"{ts:.6f}",
                        "event_type": parsed["event_type"],
                        "trial": parsed["trial"],
                        "condition": parsed["condition"],
                        "extra_json": json.dumps(parsed["extra"], separators=(",", ":")),
                        "raw_label": label,
                    })
                    f.flush()
                    log.info("marker #%d  t=%.6f  %s", stats.markers_logged, ts, label)

            if eeg_inlet is not None:
                now = time.monotonic()
                if now - last_eeg_check >= EEG_CHECK_INTERVAL_S:
                    last_eeg_check = now
                    chunk, _timestamps = eeg_inlet.pull_chunk(timeout=0.0, max_samples=2048)
                    if chunk:
                        stats.eeg_samples_seen += len(chunk)
                        n_ch = stats.eeg_channel_count or (len(chunk[0]) if chunk[0] else 0)
                        mins = [min(row[c] for row in chunk) for c in range(n_ch)]
                        maxs = [max(row[c] for row in chunk) for c in range(n_ch)]
                        log.info(
                            "[eeg sanity] +%d samples  ch_min=%s  ch_max=%s",
                            len(chunk),
                            ["%.1f" % v for v in mins],
                            ["%.1f" % v for v in maxs],
                        )
                    else:
                        log.warning("[eeg sanity] no EEG samples arrived in the last %.1fs", EEG_CHECK_INTERVAL_S)

    session_end_ts = pylsl.local_clock()
    duration_s = session_end_ts - session_start_ts

    with open(sidecar_path, "w", encoding="utf-8") as f:
        json.dump({
            "marker_stream_name": MARKER_STREAM_NAME,
            "output_csv": args.output,
            "session_start_lsl_time": session_start_ts,
            "session_end_lsl_time": session_end_ts,
            "duration_s": duration_s,
            "markers_logged": stats.markers_logged,
            "first_marker_lsl_time": stats.first_marker_ts,
            "last_marker_lsl_time": stats.last_marker_ts,
            "eeg_monitored": eeg_inlet is not None,
            "eeg_samples_seen": stats.eeg_samples_seen,
        }, f, indent=2)

    log.info(
        "bye — logged %d markers over %.1fs. CSV=%s  metadata=%s",
        stats.markers_logged, duration_s, args.output, sidecar_path,
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Detect and log LSL markers to CSV during an EEG session. "
                    "Never records raw EEG — EmotivPRO remains authoritative for that.",
    )
    parser.add_argument("-o", "--output", default=None,
                        help="CSV path to write markers to (default: sessions/session_<UTC timestamp>.csv).")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite --output / its metadata sidecar if they already exist.")
    parser.add_argument("--timeout", type=float, default=STREAM_RESOLVE_TIMEOUT_S,
                        help=f"Seconds to wait when resolving LSL streams (default: {STREAM_RESOLVE_TIMEOUT_S}).")
    parser.add_argument("--monitor-eeg", action="store_true",
                        help="Also watch the live EEG LSL stream and print signal sanity stats (never saved to disk).")
    parser.add_argument("--require-eeg", action="store_true",
                        help="With --monitor-eeg, fail the whole session if no EEG stream is found.")
    parser.add_argument("--verbose", action="store_true", help="DEBUG-level logging.")
    args = parser.parse_args(argv)

    if args.output is None:
        args.output = default_output_path()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s  %(levelname)-7s %(name)s  %(message)s",
        datefmt="%H:%M:%S",
    )

    try:
        return run(args)
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
