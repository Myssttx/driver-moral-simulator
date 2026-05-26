"""LSL marker bridge for the browser-based Moral Machine game.

Why this exists
---------------
The game is a Next.js / React app running in a browser, and browsers cannot
publish on Lab Streaming Layer (no native UDP/multicast). This script is a
tiny localhost WebSocket server that:

  1. Owns a single `pylsl.StreamOutlet` named ``MoralMachineMarkers`` that
     EmotivPRO will discover on the LAN and record alongside the EEG.
  2. Accepts WebSocket connections from the game.
  3. For every text frame received from the game, immediately calls
     ``outlet.push_sample([label])``. The sample carries an automatic
     ``pylsl.local_clock()`` timestamp, which is what EmotivPRO uses to
     align the marker to the EEG sample stream.

The browser pays one localhost-WS hop of latency before the LSL push. On
the same machine that is ~sub-millisecond — well under the EEG sample
period at 256 Hz (~3.9 ms). Do not run this bridge across the network
from the game; keep it on localhost. (You CAN run it on a different
machine from EmotivPRO — LSL itself handles that sync.)

Launch order for a session
--------------------------
  1. Start EmotivPRO, begin a recording, confirm the LSL inlet is armed.
  2. Start this bridge:        python python/marker_bridge.py
  3. Start the game (npm run dev) and open it in the browser.
  4. Start the Python session logger (session_logger.py) for the CSV
     cross-check and pre-flight validation.

The bridge logs every marker it pushes to stdout, so the operator can
eyeball that markers are firing in real time during the session.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import signal
import sys
from dataclasses import dataclass

try:
    import pylsl
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "pylsl is not installed. Run: pip install -r python/requirements.txt"
    ) from exc

try:
    import websockets
    from websockets.asyncio.server import serve
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "websockets is not installed. Run: pip install -r python/requirements.txt"
    ) from exc


# ---------------------------------------------------------------------------
# Configuration
#
# These are the values that must match across the four components of the
# pipeline (game, bridge, session logger, EmotivPRO LSL config). Change
# them in ONE place only.
# ---------------------------------------------------------------------------

# LSL outlet identity. Discovered by EmotivPRO and by session_logger.py.
STREAM_NAME = "MoralMachineMarkers"
STREAM_TYPE = "Markers"
STREAM_SOURCE_ID = "moral-machine-bridge-v1"  # fixed so restarts reconnect cleanly
STREAM_CHANNEL_FORMAT = pylsl.cf_string
STREAM_CHANNEL_COUNT = 1
STREAM_NOMINAL_SRATE = pylsl.IRREGULAR_RATE  # markers are event-driven

# WebSocket server defaults. The game's lslMarkers hook must point here.
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 7779
DEFAULT_PATH = "/markers"  # informational; we accept any path

# LAB DECISION: maximum marker label length we accept. Long enough for the
# pipe-delimited schema with all current fields. Bumping this is fine; the
# guard is here to catch a runaway client sending blobs instead of labels.
MAX_LABEL_BYTES = 1024


# ---------------------------------------------------------------------------
# Bridge
# ---------------------------------------------------------------------------

log = logging.getLogger("marker_bridge")


@dataclass
class BridgeStats:
    markers_pushed: int = 0
    clients_connected: int = 0
    clients_ever: int = 0


def build_outlet() -> pylsl.StreamOutlet:
    """Create the single LSL outlet shared by every WS connection."""
    info = pylsl.StreamInfo(
        name=STREAM_NAME,
        type=STREAM_TYPE,
        channel_count=STREAM_CHANNEL_COUNT,
        nominal_srate=STREAM_NOMINAL_SRATE,
        channel_format=STREAM_CHANNEL_FORMAT,
        source_id=STREAM_SOURCE_ID,
    )
    # Stamp a bit of provenance into the XML metadata so a post-hoc
    # inspector knows where this stream came from.
    desc = info.desc()
    desc.append_child_value("manufacturer", "McMahan Lab")
    desc.append_child_value("software", "driver-moral-simulator/marker_bridge.py")
    desc.append_child_value("schema", "event_type|trial=NN|condition=XXX|...")
    return pylsl.StreamOutlet(info)


async def handle_client(
    websocket: "websockets.asyncio.server.ServerConnection",
    outlet: pylsl.StreamOutlet,
    stats: BridgeStats,
) -> None:
    """One WS connection = one game tab. Markers stream from client to LSL."""
    peer = websocket.remote_address
    stats.clients_connected += 1
    stats.clients_ever += 1
    log.info("client connected (%s) — active=%d total=%d",
             peer, stats.clients_connected, stats.clients_ever)

    try:
        # Send a hello so the client knows the bridge accepted it.
        await websocket.send(json.dumps({
            "type": "hello",
            "stream_name": STREAM_NAME,
            "lsl_clock": pylsl.local_clock(),
        }))

        async for raw in websocket:
            # Accept either a raw text frame (the marker label itself) or
            # a JSON envelope {"label": "..."}. The game's lslMarkers hook
            # uses raw text; the JSON form is here for ad-hoc testing.
            if isinstance(raw, (bytes, bytearray)):
                if len(raw) > MAX_LABEL_BYTES:
                    log.warning("dropping oversized binary frame (%d bytes)", len(raw))
                    continue
                label = raw.decode("utf-8", errors="replace")
            else:
                label = raw

            label = label.strip()
            if not label:
                continue
            if len(label.encode("utf-8")) > MAX_LABEL_BYTES:
                log.warning("dropping oversized label (%d bytes)", len(label))
                continue

            if label.startswith("{"):
                try:
                    parsed = json.loads(label)
                    label = str(parsed.get("label", "")).strip()
                except json.JSONDecodeError:
                    log.warning("malformed JSON frame, ignoring: %r", label[:80])
                    continue
                if not label:
                    continue

            # Push to LSL. push_sample takes the timestamp implicitly via
            # pylsl.local_clock() — the same clock EmotivPRO uses for sync.
            ts = pylsl.local_clock()
            outlet.push_sample([label], timestamp=ts)
            stats.markers_pushed += 1

            log.info("marker #%d  t=%.6f  %s", stats.markers_pushed, ts, label)

            # ACK back to the browser so the game can confirm the push
            # landed in LSL (useful for in-tab debugging overlays).
            try:
                await websocket.send(json.dumps({
                    "type": "ack",
                    "label": label,
                    "lsl_clock": ts,
                    "n": stats.markers_pushed,
                }))
            except websockets.ConnectionClosed:
                break

    except websockets.ConnectionClosed as exc:
        log.info("client %s disconnected: %s", peer, exc)
    except Exception:  # noqa: BLE001
        log.exception("unexpected error in client handler (%s)", peer)
    finally:
        stats.clients_connected -= 1
        log.info("client gone (%s) — active=%d", peer, stats.clients_connected)


async def run(host: str, port: int) -> None:
    outlet = build_outlet()
    stats = BridgeStats()

    log.info("LSL outlet ready  name=%s  type=%s  source_id=%s",
             STREAM_NAME, STREAM_TYPE, STREAM_SOURCE_ID)
    log.info("WS server listening on  ws://%s:%d%s", host, port, DEFAULT_PATH)
    log.info("press Ctrl-C to stop")

    stop = asyncio.Event()

    def _request_stop(*_: object) -> None:
        log.info("shutdown requested")
        stop.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _request_stop)
        except NotImplementedError:
            # Windows: fall back to default KeyboardInterrupt handling.
            pass

    async with serve(
        lambda ws: handle_client(ws, outlet, stats),
        host,
        port,
        max_size=MAX_LABEL_BYTES * 4,  # small frames only
        ping_interval=20,
        ping_timeout=20,
    ):
        await stop.wait()

    log.info("bye — pushed %d markers over %d connection(s)",
             stats.markers_pushed, stats.clients_ever)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Bridge browser markers to a pylsl outlet for EmotivPRO.",
    )
    parser.add_argument("--host", default=DEFAULT_HOST,
                        help=f"WS bind host (default: {DEFAULT_HOST}).")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help=f"WS bind port (default: {DEFAULT_PORT}).")
    parser.add_argument("--verbose", action="store_true",
                        help="DEBUG-level logging.")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s  %(levelname)-7s %(name)s  %(message)s",
        datefmt="%H:%M:%S",
    )

    try:
        asyncio.run(run(args.host, args.port))
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
