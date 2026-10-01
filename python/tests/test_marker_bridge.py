from __future__ import annotations

import csv
import json
import sys
import tempfile
import unittest
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_DIR))

from marker_bridge import (
    BridgeProtocolError,
    BridgeRuntime,
    decode_marker_frame,
    process_marker,
)
from marker_core import (
    EventLogger,
    SerialMarkerTransport,
    load_marker_config,
    load_serial_config,
)


def envelope(label: str, *, source: str = "driver_moral_simulator", marker_id: str = "m1") -> dict:
    return {
        "type": "marker",
        "protocol_version": 2,
        "id": marker_id,
        "source": source,
        "label": label,
        "client_monotonic_ms": 12.5,
        "client_utc": "2026-01-01T00:00:00.000Z",
    }


class FakeSerial:
    def __init__(self, **kwargs: object) -> None:
        self.kwargs = kwargs
        self.is_open = True
        self.writes: list[bytes] = []

    def write(self, data: bytes) -> int:
        self.writes.append(data)
        return len(data)

    def close(self) -> None:
        self.is_open = False


class MarkerBridgeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.log_path = Path(self.temporary.name) / "bridge.csv"
        marker_config = load_marker_config(PYTHON_DIR / "config" / "markers.yaml")
        serial_config = load_serial_config(PYTHON_DIR / "config" / "serial.yaml")
        transport = SerialMarkerTransport(serial_config)
        transport.connect()
        logger = EventLogger(self.log_path, session_start_ns=1_000)
        self.addCleanup(logger.close)
        self.runtime = BridgeRuntime(
            marker_config=marker_config,
            serial_transport=transport,
            event_logger=logger,
            session_start_ns=1_000,
            lsl_enabled=False,
        )

    def process(self, value: dict, *, offset: int = 0) -> dict:
        return process_marker(
            self.runtime,
            value,
            received_ns=2_000 + offset,
            received_utc=datetime(2026, 1, 1, tzinfo=timezone.utc),
            connection_id="connection-1",
        )

    def rows(self) -> list[dict[str, str]]:
        with self.log_path.open(encoding="utf-8", newline="") as stream:
            return list(csv.DictReader(stream))

    def test_choice_ack_exposes_code_simulation_and_audit_row(self) -> None:
        reply = self.process(
            envelope("choice|session=run_1|trial=03|condition=baseline|side=left|rt_ms=412")
        )

        self.assertEqual(reply["type"], "ack")
        self.assertEqual(reply["marker_code"], 60)
        self.assertEqual(reply["marker_name"], "CHOICE_LEFT")
        self.assertEqual(reply["serial"]["status"], "simulated")
        self.assertTrue(reply["serial"]["success"])
        self.assertFalse(reply["emotivpro_verified"])
        rows = self.rows()
        self.assertEqual(rows[0]["session_id"], "run_1")
        self.assertEqual(rows[0]["marker_code"], "60")
        self.assertEqual(rows[0]["serial_simulated"], "True")

    def test_operator_test_routes_but_other_dashboard_event_stays_unmapped(self) -> None:
        test_reply = self.process(
            envelope("test_marker|phase=system", source="operator_dashboard", marker_id="test")
        )
        other_reply = self.process(
            envelope("consent_start|phase=consent", source="operator_dashboard", marker_id="other"),
            offset=1,
        )

        self.assertEqual(test_reply["marker_code"], 10)
        self.assertEqual(test_reply["serial"]["status"], "simulated")
        self.assertEqual(other_reply["type"], "ack")
        self.assertIsNone(other_reply["marker_code"])
        self.assertEqual(other_reply["serial"]["status"], "unmapped")
        self.assertEqual(self.rows()[1]["event_name"], "UNMAPPED")

    def test_unmapped_driver_choice_is_a_visible_nack_and_is_logged(self) -> None:
        reply = self.process(envelope("choice|session=run_1|trial=01|side=up"))

        self.assertEqual(reply["type"], "nack")
        self.assertIn("no configured serial route", reply["error"])
        self.assertTrue(reply["logged"])
        self.assertEqual(self.rows()[0]["event_name"], "UNMAPPED")

    def test_hardware_path_writes_expected_complete_trial_byte_sequence(self) -> None:
        marker_config = self.runtime.marker_config
        base_config = load_serial_config(PYTHON_DIR / "config" / "serial.yaml")
        hardware_config = replace(
            base_config,
            port="/dev/fake-sender",
            enabled=True,
            simulation_mode=False,
        )
        serial_instances: list[FakeSerial] = []

        def factory(**kwargs: object) -> FakeSerial:
            instance = FakeSerial(**kwargs)
            serial_instances.append(instance)
            return instance

        transport = SerialMarkerTransport(hardware_config, serial_factory=factory)
        transport.connect()
        with (
            tempfile.TemporaryDirectory() as directory,
            EventLogger(Path(directory) / "hardware.csv", session_start_ns=1_000) as logger,
        ):
                runtime = BridgeRuntime(
                    marker_config=marker_config,
                    serial_transport=transport,
                    event_logger=logger,
                    session_start_ns=1_000,
                    lsl_enabled=False,
                )
                labels = [
                    "session_start|session=run_1",
                    "trial_start|session=run_1|trial=01|condition=baseline",
                    "scenario_onset|session=run_1|trial=01|condition=baseline",
                    "choice|session=run_1|trial=01|condition=baseline|side=right|rt_ms=500",
                    "outcome_shown|session=run_1|trial=01|condition=baseline",
                    "trial_end|session=run_1|trial=01|condition=baseline",
                    "session_end|session=run_1",
                ]
                for index, label in enumerate(labels):
                    reply = process_marker(
                        runtime,
                        envelope(label, marker_id=f"m{index}"),
                        received_ns=2_000 + index,
                        received_utc=datetime(2026, 1, 1, tzinfo=timezone.utc),
                        connection_id="hardware-connection",
                    )
                    self.assertEqual(reply["serial"]["status"], "written")

        self.assertEqual(
            serial_instances[0].writes,
            [b"\x01", b"\x14", b"\x28", b"\x3d", b"\x50", b"\x15", b"\x02"],
        )
        transport.close()

    def test_decode_rejects_wrong_protocol_and_accepts_v2_json(self) -> None:
        decoded = decode_marker_frame(json.dumps(envelope("session_start")))
        self.assertEqual(decoded["source"], "driver_moral_simulator")
        invalid = envelope("session_start")
        invalid["protocol_version"] = 99
        with self.assertRaisesRegex(BridgeProtocolError, "unsupported"):
            decode_marker_frame(json.dumps(invalid))


if __name__ == "__main__":
    unittest.main()
