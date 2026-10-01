"""Route browser experiment events to EmotivPRO serial markers and optional LSL.

For each valid localhost WebSocket frame this process captures timestamps,
resolves a configurable event route, writes exactly one raw serial byte,
optionally publishes the rich label to LSL, flushes an independent CSV record,
and returns a structured ACK/NACK.

An OS-level one-byte write is not proof that EmotivPRO recorded the marker.
Receipt must be checked in EmotivPRO and, for research use, in its EEG export.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import signal
import sys
import time
from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from marker_core import (
    ConfigurationError,
    EventLogError,
    EventLogger,
    EventRecord,
    MarkerConfig,
    MarkerLabelError,
    SerialConfig,
    SerialConnectionError,
    SerialMarkerTransport,
    SerialSendError,
    SerialSendResult,
    load_marker_config,
    load_serial_config,
    parse_marker_label,
    route_marker,
)

try:  # Optional when running serial-only or importing for tests.
    import pylsl  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - exercised by CLI preflight
    pylsl = None

try:  # Optional when importing protocol helpers for unit tests.
    import websockets  # type: ignore[import-not-found]
    from websockets.asyncio.server import serve
except ImportError:  # pragma: no cover - exercised by CLI preflight
    websockets = None
    serve = None


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_MARKER_CONFIG = SCRIPT_DIR / "config" / "markers.yaml"
DEFAULT_SERIAL_CONFIG = SCRIPT_DIR / "config" / "serial.yaml"
DEFAULT_SESSION_DIR = SCRIPT_DIR / "sessions"

STREAM_NAME = "SplitOrStealProtocolMarkers"
STREAM_TYPE = "Markers"
STREAM_SOURCE_ID = "split-or-steal-protocol-bridge-v2"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 7779
DEFAULT_PATH = "/markers"
MAX_LABEL_BYTES = 1024
MAX_FRAME_BYTES = 4096
PROTOCOL_VERSION = 2
BRIDGE_VERSION = "2.0.0"
CODEBOOK_VERSION = "driver-serial-v1"

log = logging.getLogger("marker_bridge")


class BridgeProtocolError(ValueError):
    """A WebSocket frame does not satisfy marker protocol v2."""


@dataclass(slots=True)
class BridgeStats:
    frames_received: int = 0
    events_logged: int = 0
    serial_written: int = 0
    serial_simulated: int = 0
    serial_failed: int = 0
    serial_unmapped: int = 0
    lsl_pushed: int = 0
    rejected: int = 0
    clients_connected: int = 0
    clients_ever: int = 0


@dataclass(slots=True)
class BridgeRuntime:
    marker_config: MarkerConfig
    serial_transport: SerialMarkerTransport
    event_logger: EventLogger
    session_start_ns: int
    lsl_enabled: bool
    outlet: Any | None = None
    stats: BridgeStats = field(default_factory=BridgeStats)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def serial_mode(config: SerialConfig) -> str:
    if config.simulation_mode:
        return "simulation"
    if config.enabled:
        return "hardware"
    return "off"


def serial_info(transport: SerialMarkerTransport) -> dict[str, Any]:
    config = transport.config
    mode = serial_mode(config)
    return {
        "mode": mode,
        "ready": mode == "simulation" or (mode == "hardware" and transport.connected),
        "status": transport.status.lower(),
        "port": config.port,
        "baudrate": config.baudrate,
        "bytesize": config.bytesize,
        "parity": config.parity,
        "stopbits": config.stopbits,
        "flow_control": {
            "xonxoff": config.xonxoff,
            "rtscts": config.rtscts,
            "dsrdtr": config.dsrdtr,
        },
        "wire_protocol": "one raw uint8 byte; no terminator",
    }


def default_event_log_path() -> Path:
    stamp = utc_now().strftime("%Y%m%dT%H%M%SZ")
    return DEFAULT_SESSION_DIR / f"bridge_{stamp}_markers.csv"


def decode_marker_frame(raw: str | bytes | bytearray) -> dict[str, Any]:
    """Decode protocol v2 JSON, retaining raw-label LSL compatibility.

    Legacy raw labels are accepted only as ``legacy_client`` events. They can
    still reach LSL and the audit CSV, but intentionally never match a serial
    route because they lack a trustworthy source identifier.
    """

    if isinstance(raw, (bytes, bytearray)):
        if len(raw) > MAX_FRAME_BYTES:
            raise BridgeProtocolError("binary marker frame exceeds size limit")
        try:
            text = bytes(raw).decode("utf-8", errors="strict")
        except UnicodeDecodeError as exc:
            raise BridgeProtocolError("binary marker frame is not valid UTF-8") from exc
    elif isinstance(raw, str):
        if len(raw.encode("utf-8")) > MAX_FRAME_BYTES:
            raise BridgeProtocolError("marker frame exceeds size limit")
        text = raw
    else:
        raise BridgeProtocolError("marker frame must be text or UTF-8 bytes")

    text = text.strip()
    if not text:
        raise BridgeProtocolError("marker frame is empty")

    if not text.startswith("{"):
        if len(text.encode("utf-8")) > MAX_LABEL_BYTES:
            raise BridgeProtocolError("legacy marker label exceeds size limit")
        return {
            "type": "marker",
            "protocol_version": 1,
            "id": None,
            "source": "legacy_client",
            "label": text,
            "client_monotonic_ms": None,
            "client_utc": None,
        }

    try:
        envelope = json.loads(text)
    except json.JSONDecodeError as exc:
        raise BridgeProtocolError(f"invalid marker JSON: {exc.msg}") from exc
    if not isinstance(envelope, dict):
        raise BridgeProtocolError("marker JSON root must be an object")
    if envelope.get("type") != "marker":
        raise BridgeProtocolError("marker frame type must be 'marker'")
    if envelope.get("protocol_version") != PROTOCOL_VERSION:
        raise BridgeProtocolError(
            f"unsupported marker protocol version {envelope.get('protocol_version')!r}"
        )

    marker_id = envelope.get("id")
    source = envelope.get("source")
    label = envelope.get("label")
    if not isinstance(marker_id, str) or not marker_id.strip() or len(marker_id) > 160:
        raise BridgeProtocolError("marker id must be a non-empty string <= 160 characters")
    if not isinstance(source, str) or not source.strip() or len(source) > 80:
        raise BridgeProtocolError("marker source must be a non-empty string <= 80 characters")
    if not isinstance(label, str) or not label.strip():
        raise BridgeProtocolError("marker label must be a non-empty string")
    if len(label.strip().encode("utf-8")) > MAX_LABEL_BYTES:
        raise BridgeProtocolError("marker label exceeds size limit")
    client_monotonic_ms = envelope.get("client_monotonic_ms")
    if client_monotonic_ms is not None and (
        isinstance(client_monotonic_ms, bool)
        or not isinstance(client_monotonic_ms, (int, float))
    ):
        raise BridgeProtocolError("client_monotonic_ms must be numeric or null")
    client_utc = envelope.get("client_utc")
    if client_utc is not None and not isinstance(client_utc, str):
        raise BridgeProtocolError("client_utc must be a string or null")

    return {
        "type": "marker",
        "protocol_version": PROTOCOL_VERSION,
        "id": marker_id.strip(),
        "source": source.strip(),
        "label": label.strip(),
        "client_monotonic_ms": client_monotonic_ms,
        "client_utc": client_utc,
    }


def _send_serial(
    runtime: BridgeRuntime,
    marker_code: int | None,
) -> tuple[SerialSendResult | None, dict[str, Any]]:
    mode = serial_mode(runtime.serial_transport.config)
    payload: dict[str, Any] = {
        "mode": mode,
        "attempted": False,
        "success": None,
        "simulated": mode == "simulation",
        "bytes_written": None,
        "started_monotonic_ns": None,
        "finished_monotonic_ns": None,
        "duration_ms": None,
        "error": None,
    }
    if marker_code is None:
        runtime.stats.serial_unmapped += 1
        payload["status"] = "unmapped"
        return None, payload
    if mode == "off":
        payload.update({"status": "off", "error": "serial output is disabled"})
        return None, payload

    payload["attempted"] = True
    try:
        result = runtime.serial_transport.send(marker_code)
    except SerialSendError as exc:
        result = exc.result

    status = "simulated" if result.success and result.simulated else (
        "written" if result.success else "failed"
    )
    if result.success and result.simulated:
        runtime.stats.serial_simulated += 1
    elif result.success:
        runtime.stats.serial_written += 1
    else:
        runtime.stats.serial_failed += 1
    payload.update({
        "status": status,
        "success": result.success,
        "simulated": result.simulated,
        "bytes_written": 1 if result.success and not result.simulated else 0,
        "started_monotonic_ns": result.start_ns,
        "finished_monotonic_ns": result.end_ns,
        "duration_ms": result.duration_ms,
        "error": result.error,
    })
    return result, payload


def _push_lsl(runtime: BridgeRuntime, label: str) -> tuple[float | None, bool | None, str | None]:
    if not runtime.lsl_enabled:
        return None, None, None
    try:
        timestamp = float(pylsl.local_clock())
        runtime.outlet.push_sample([label], timestamp=timestamp)
        runtime.stats.lsl_pushed += 1
        return timestamp, True, None
    except Exception as exc:  # pylsl errors are implementation/platform specific.
        message = f"LSL marker push failed: {exc}"
        log.exception(message)
        return None, False, message


def process_marker(
    runtime: BridgeRuntime,
    envelope: Mapping[str, Any],
    *,
    received_ns: int,
    received_utc: datetime,
    connection_id: str,
) -> dict[str, Any]:
    """Route, transmit, log, and acknowledge one already-decoded marker."""

    runtime.stats.frames_received += 1
    sequence = runtime.stats.frames_received
    origin = str(envelope["source"])
    client_event_id = envelope.get("id")
    parsed = parse_marker_label(str(envelope["label"]))
    definition = route_marker(
        runtime.marker_config,
        origin,
        parsed.event_type,
        parsed.fields,
    )

    serial_result, serial_payload = _send_serial(
        runtime,
        definition.code if definition is not None else None,
    )
    lsl_timestamp, lsl_success, lsl_error = _push_lsl(runtime, parsed.raw_label)

    metadata = {
        "connection_id": connection_id,
        "sequence": sequence,
        "protocol_version": envelope.get("protocol_version"),
        "client_monotonic_ms": envelope.get("client_monotonic_ms"),
        "client_utc": envelope.get("client_utc"),
        "fields": dict(parsed.fields),
        "serial_mode": serial_payload["mode"],
    }
    record = EventRecord(
        event_uuid=str(uuid4()),
        client_event_id=str(client_event_id) if client_event_id is not None else None,
        session_id=parsed.fields.get("session", "unassigned"),
        participant_id=parsed.fields.get("participant", "unassigned"),
        trial=parsed.fields.get("trial"),
        marker_code=definition.code if definition is not None else None,
        event_name=definition.name if definition is not None else "UNMAPPED",
        category=definition.category if definition is not None else "unmapped",
        origin=origin,
        event_type=parsed.event_type,
        raw_label=parsed.raw_label,
        monotonic_ns=received_ns,
        elapsed_seconds=(received_ns - runtime.session_start_ns) / 1_000_000_000,
        utc_timestamp=received_utc,
        lsl_timestamp=lsl_timestamp,
        lsl_push_success=lsl_success,
        lsl_error=lsl_error,
        serial_send_start_ns=serial_result.start_ns if serial_result else None,
        serial_send_end_ns=serial_result.end_ns if serial_result else None,
        serial_duration_ms=serial_result.duration_ms if serial_result else None,
        serial_success=serial_result.success if serial_result else None,
        condition=parsed.fields.get("condition"),
        choice=parsed.fields.get("side") or parsed.fields.get("choice"),
        metadata_json=json.dumps(metadata, sort_keys=True, separators=(",", ":")),
        serial_error=(
            serial_result.error if serial_result is not None else serial_payload.get("error")
        ),
        serial_simulated=serial_result.simulated if serial_result else None,
    )

    logged = True
    log_error: str | None = None
    try:
        runtime.event_logger.append(record)
        runtime.stats.events_logged += 1
    except EventLogError as exc:
        logged = False
        log_error = str(exc)
        log.exception("event audit CSV write failed")

    required_unmapped = origin == "driver_moral_simulator" and definition is None
    serial_unavailable = definition is not None and serial_payload["status"] == "off"
    serial_failed = serial_payload["status"] == "failed"
    lsl_failed = lsl_success is False
    failed = required_unmapped or serial_unavailable or serial_failed or lsl_failed or not logged
    if failed:
        runtime.stats.rejected += 1

    errors: list[str] = []
    if required_unmapped:
        errors.append(
            f"no configured serial route for {origin}/{parsed.event_type} fields={dict(parsed.fields)!r}"
        )
    if serial_unavailable:
        errors.append("serial output is disabled for a configured marker")
    if serial_failed and serial_payload.get("error"):
        errors.append(str(serial_payload["error"]))
    if lsl_failed and lsl_error:
        errors.append(lsl_error)
    if log_error:
        errors.append(f"audit log failed: {log_error}")

    marker_code = definition.code if definition is not None else None
    marker_name = definition.name if definition is not None else None
    log.log(
        logging.ERROR if failed else logging.INFO,
        "event #%d origin=%s type=%s code=%s serial=%s lsl=%s logged=%s",
        sequence,
        origin,
        parsed.event_type,
        marker_code,
        serial_payload["status"],
        lsl_success,
        logged,
    )

    return {
        "type": "nack" if failed else "ack",
        "protocol_version": PROTOCOL_VERSION,
        "id": client_event_id,
        "event_uuid": record.event_uuid,
        "sequence": sequence,
        "event_type": parsed.event_type,
        "label": parsed.raw_label,
        "marker_code": marker_code,
        "marker_name": marker_name,
        "received_monotonic_ns": received_ns,
        "received_utc": received_utc.isoformat(),
        "serial": serial_payload,
        "lsl": {
            "enabled": runtime.lsl_enabled,
            "attempted": runtime.lsl_enabled,
            "success": lsl_success,
            "timestamp": lsl_timestamp,
            "error": lsl_error,
        },
        "logged": logged,
        "emotivpro_verified": False,
        "failure_action": (
            runtime.serial_transport.config.on_serial_failure if serial_failed else None
        ),
        "error": "; ".join(errors) if errors else None,
    }


def build_outlet() -> Any:
    if pylsl is None:  # Defensive; CLI should catch this first.
        raise RuntimeError("pylsl is required unless --disable-lsl is used")
    info = pylsl.StreamInfo(
        name=STREAM_NAME,
        type=STREAM_TYPE,
        channel_count=1,
        nominal_srate=pylsl.IRREGULAR_RATE,
        channel_format=pylsl.cf_string,
        source_id=STREAM_SOURCE_ID,
    )
    desc = info.desc()
    desc.append_child_value("manufacturer", "McMahan Lab")
    desc.append_child_value("software", "driver-moral-simulator/marker_bridge.py")
    desc.append_child_value("schema", "event_type|trial=NN|condition=XXX|...")
    desc.append_child_value("serial_codebook", CODEBOOK_VERSION)
    return pylsl.StreamOutlet(info)


async def handle_client(websocket: Any, runtime: BridgeRuntime) -> None:
    peer = websocket.remote_address
    connection_id = str(uuid4())
    runtime.stats.clients_connected += 1
    runtime.stats.clients_ever += 1
    log.info(
        "client connected (%s) connection=%s active=%d",
        peer,
        connection_id,
        runtime.stats.clients_connected,
    )

    hello = {
        "type": "hello",
        "protocol_version": PROTOCOL_VERSION,
        "bridge_version": BRIDGE_VERSION,
        "connection_id": connection_id,
        "codebook_version": CODEBOOK_VERSION,
        "configured_serial_markers": len(runtime.marker_config),
        "serial": serial_info(runtime.serial_transport),
        "lsl": {
            "enabled": runtime.lsl_enabled,
            "ready": runtime.lsl_enabled and runtime.outlet is not None,
            "stream_name": STREAM_NAME if runtime.lsl_enabled else None,
        },
        "event_log": str(runtime.event_logger.path),
    }

    try:
        await websocket.send(json.dumps(hello))
        async for raw in websocket:
            # Capture before parsing, route lookup, serial, LSL, CSV, or UI.
            received_ns = time.perf_counter_ns()
            received_utc = utc_now()
            try:
                envelope = decode_marker_frame(raw)
                reply = process_marker(
                    runtime,
                    envelope,
                    received_ns=received_ns,
                    received_utc=received_utc,
                    connection_id=connection_id,
                )
            except (BridgeProtocolError, MarkerLabelError, ValueError) as exc:
                runtime.stats.rejected += 1
                log.warning("rejected marker frame from %s: %s", peer, exc)
                reply = {
                    "type": "nack",
                    "protocol_version": PROTOCOL_VERSION,
                    "id": None,
                    "received_monotonic_ns": received_ns,
                    "received_utc": received_utc.isoformat(),
                    "logged": False,
                    "emotivpro_verified": False,
                    "error": str(exc),
                }
            await websocket.send(json.dumps(reply))
    except Exception as exc:  # ConnectionClosed moved between websockets releases.
        connection_closed = getattr(websockets, "ConnectionClosed", None)
        if connection_closed is not None and isinstance(exc, connection_closed):
            log.info("client %s disconnected: %s", peer, exc)
        else:
            log.exception("unexpected error in client handler (%s)", peer)
    finally:
        runtime.stats.clients_connected -= 1
        log.info("client gone (%s) active=%d", peer, runtime.stats.clients_connected)


def marker_config_snapshot(config: MarkerConfig) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "minimum_code": config.minimum_code,
        "maximum_code": config.maximum_code,
        "markers": [
            {
                "code": marker.code,
                "name": marker.name,
                "category": marker.category,
                "origin": marker.origin,
                "event_type": marker.event_type,
                "match": dict(marker.match),
                "description": marker.description,
            }
            for marker in config
        ],
    }


def effective_serial_snapshot(config: SerialConfig) -> dict[str, Any]:
    return {
        "port": config.port,
        "baudrate": config.baudrate,
        "bytesize": config.bytesize,
        "parity": config.parity,
        "stopbits": config.stopbits,
        "timeout_seconds": config.timeout_seconds,
        "write_timeout_seconds": config.write_timeout_seconds,
        "xonxoff": config.xonxoff,
        "rtscts": config.rtscts,
        "dsrdtr": config.dsrdtr,
        "enabled": config.enabled,
        "simulation_mode": config.simulation_mode,
        "mode": serial_mode(config),
        "on_serial_failure": config.on_serial_failure,
        "encoding": config.encoding,
        "minimum_code": config.minimum_code,
        "maximum_code": config.maximum_code,
    }


def write_metadata(path: Path, metadata: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(dict(metadata), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


async def run_bridge(
    *,
    host: str,
    port: int,
    marker_config: MarkerConfig,
    serial_config: SerialConfig,
    lsl_enabled: bool,
    event_log_path: Path,
    fsync_interval_events: int,
) -> None:
    session_start_ns = time.perf_counter_ns()
    start_utc = utc_now()
    transport = SerialMarkerTransport(serial_config)
    transport.connect()
    try:
        event_logger = EventLogger(
            event_log_path,
            session_start_ns=session_start_ns,
            fsync_interval_events=fsync_interval_events,
        )
        try:
            outlet = build_outlet() if lsl_enabled else None
        except BaseException:
            event_logger.close()
            raise
    except BaseException:
        transport.close()
        raise
    runtime = BridgeRuntime(
        marker_config=marker_config,
        serial_transport=transport,
        event_logger=event_logger,
        session_start_ns=session_start_ns,
        lsl_enabled=lsl_enabled,
        outlet=outlet,
    )

    metadata_path = event_log_path.with_name(f"{event_log_path.stem}_metadata.json")
    metadata: dict[str, Any] = {
        "status": "RUNNING",
        "bridge_version": BRIDGE_VERSION,
        "protocol_version": PROTOCOL_VERSION,
        "codebook_version": CODEBOOK_VERSION,
        "start_utc": start_utc.isoformat(),
        "end_utc": None,
        "event_log": str(event_log_path),
        "lsl": {"enabled": lsl_enabled, "stream_name": STREAM_NAME if lsl_enabled else None},
        "serial_config_snapshot": effective_serial_snapshot(serial_config),
        "marker_config_snapshot": marker_config_snapshot(marker_config),
    }
    write_metadata(metadata_path, metadata)

    log.info(
        "serial ready mode=%s port=%s baud=%d",
        serial_mode(serial_config),
        serial_config.port,
        serial_config.baudrate,
    )
    if lsl_enabled:
        log.info("LSL outlet ready name=%s source_id=%s", STREAM_NAME, STREAM_SOURCE_ID)
    else:
        log.info("LSL output disabled (serial-only mode)")
    log.info("audit CSV %s", event_log_path)
    log.info("WS server listening on ws://%s:%d%s", host, port, DEFAULT_PATH)
    log.info("press Ctrl-C to stop")

    stop = asyncio.Event()

    def request_stop(*_: object) -> None:
        log.info("shutdown requested")
        stop.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, request_stop)
        except NotImplementedError:  # Windows fallback uses KeyboardInterrupt.
            pass

    final_status = "COMPLETED"
    try:
        if serve is None:  # Defensive; CLI should catch this first.
            raise RuntimeError("websockets is required to start the marker bridge")
        async with serve(
            lambda websocket: handle_client(websocket, runtime),
            host,
            port,
            max_size=MAX_FRAME_BYTES,
            ping_interval=20,
            ping_timeout=20,
        ):
            await stop.wait()
    except BaseException:
        final_status = "CRASHED"
        raise
    finally:
        close_errors: list[str] = []
        try:
            event_logger.close()
        except Exception as exc:
            close_errors.append(f"event log close failed: {exc}")
            log.exception("event log close failed")
        try:
            transport.close()
        except Exception as exc:
            close_errors.append(f"serial close failed: {exc}")
            log.exception("serial close failed")
        metadata.update({
            "status": final_status if not close_errors else "CRASHED",
            "end_utc": utc_now().isoformat(),
            "close_errors": close_errors,
            "stats": {
                field_name: getattr(runtime.stats, field_name)
                for field_name in runtime.stats.__dataclass_fields__
            },
        })
        write_metadata(metadata_path, metadata)
        log.info(
            "bridge stopped events=%d serial_written=%d simulated=%d failed=%d",
            runtime.stats.events_logged,
            runtime.stats.serial_written,
            runtime.stats.serial_simulated,
            runtime.stats.serial_failed,
        )


def list_serial_ports() -> int:
    try:
        from serial.tools import list_ports  # type: ignore[import-not-found]
    except ImportError:
        print("pyserial is not installed. Run: python3 -m pip install -r python/requirements.txt")
        return 2
    ports = sorted(list_ports.comports(), key=lambda item: item.device)
    if not ports:
        print("No serial ports detected.")
        return 0
    for port in ports:
        print(f"{port.device}\t{port.description or 'unknown device'}")
    return 0


def print_codebook(config: MarkerConfig) -> None:
    print("CODE\tORIGIN\tEVENT\tMATCH\tNAME")
    for marker in sorted(config, key=lambda item: item.code):
        match = ",".join(f"{key}={value}" for key, value in sorted(marker.match.items()))
        print(f"{marker.code}\t{marker.origin}\t{marker.event_type}\t{match or '-'}\t{marker.name}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Bridge browser markers to EmotivPRO serial and optional LSL.",
    )
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"WS bind host (default: {DEFAULT_HOST}).")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"WS port (default: {DEFAULT_PORT}).")
    parser.add_argument("--marker-config", type=Path, default=DEFAULT_MARKER_CONFIG)
    parser.add_argument("--serial-config", type=Path, default=DEFAULT_SERIAL_CONFIG)
    parser.add_argument("--event-log", type=Path, default=None, help="Audit CSV path (default: timestamped python/sessions file).")
    parser.add_argument("--fsync-interval-events", type=int, default=10, help="Force CSV to disk every N events; 0 disables periodic fsync (default: 10).")
    parser.add_argument("--disable-lsl", action="store_true", help="Do not create the LSL outlet; recommended for serial-only validation.")
    serial_group = parser.add_mutually_exclusive_group()
    serial_group.add_argument("--serial-port", help="Force hardware mode and use this sender endpoint.")
    serial_group.add_argument("--serial-simulate", action="store_true", help="Force simulated successful serial sends; no bytes leave the computer.")
    serial_group.add_argument("--serial-off", action="store_true", help="Disable serial output (LSL development only).")
    parser.add_argument("--list-serial-ports", action="store_true", help="List detected ports and exit.")
    parser.add_argument("--print-codebook", action="store_true", help="Print effective serial marker routes and exit.")
    parser.add_argument("--verbose", action="store_true", help="Enable DEBUG logging.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s  %(levelname)-7s %(name)s  %(message)s",
        datefmt="%H:%M:%S",
    )

    if args.list_serial_ports:
        return list_serial_ports()
    if args.fsync_interval_events < 0:
        log.error("--fsync-interval-events must be >= 0")
        return 2
    if not 1 <= args.port <= 65535:
        log.error("--port must be between 1 and 65535")
        return 2

    try:
        marker_config = load_marker_config(args.marker_config)
        serial_config = load_serial_config(args.serial_config)
        if args.serial_port:
            serial_config = replace(
                serial_config,
                port=args.serial_port,
                enabled=True,
                simulation_mode=False,
            )
        elif args.serial_simulate:
            serial_config = replace(
                serial_config,
                port=None,
                enabled=False,
                simulation_mode=True,
            )
        elif args.serial_off:
            serial_config = replace(
                serial_config,
                enabled=False,
                simulation_mode=False,
            )
    except ConfigurationError as exc:
        log.error("configuration error: %s", exc)
        return 2

    if args.print_codebook:
        print_codebook(marker_config)
        return 0
    if websockets is None or serve is None:
        log.error("websockets is not installed. Run: python3 -m pip install -r python/requirements.txt")
        return 2
    if not args.disable_lsl and pylsl is None:
        log.error("pylsl is not installed; install requirements or pass --disable-lsl")
        return 2

    event_log_path = args.event_log or default_event_log_path()
    try:
        asyncio.run(
            run_bridge(
                host=args.host,
                port=args.port,
                marker_config=marker_config,
                serial_config=serial_config,
                lsl_enabled=not args.disable_lsl,
                event_log_path=event_log_path,
                fsync_interval_events=args.fsync_interval_events,
            )
        )
    except KeyboardInterrupt:
        return 130
    except (SerialConnectionError, EventLogError, OSError, RuntimeError) as exc:
        log.error("bridge startup/runtime failure: %s", exc)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
