from __future__ import annotations

import csv
import sys
import tempfile
import unittest
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_DIR))

from marker_core import EVENT_FIELDS, EventLogError, EventLogger, EventRecord


def make_record(index: int = 1) -> EventRecord:
    return EventRecord(
        event_uuid=f"00000000-0000-4000-8000-{index:012d}",
        client_event_id=f"client-{index}",
        session_id="run_1",
        participant_id="P001",
        trial=3,
        marker_code=60,
        event_name="CHOICE_LEFT",
        category="response",
        origin="driver_moral_simulator",
        event_type="choice",
        raw_label="choice|origin=driver_moral_simulator|trial=03|side=left|rt_ms=412",
        monotonic_ns=1_000_000_000,
        elapsed_seconds=1.0,
        utc_timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
        lsl_timestamp=1234.5,
        lsl_push_success=True,
        lsl_error=None,
        serial_send_start_ns=1_000_000_100,
        serial_send_end_ns=1_000_000_200,
        serial_duration_ms=0.0001,
        serial_success=True,
        condition="baseline",
        choice="left",
        metadata_json='{"rt_ms":"412"}',
    )


class EventLoggerTests(unittest.TestCase):
    def test_append_is_visible_to_another_reader_before_close(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "markers.csv"
            logger = EventLogger(path)
            logger.append(make_record())

            with path.open(encoding="utf-8", newline="") as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(len(rows), 1)
            self.assertEqual(tuple(rows[0]), EVENT_FIELDS)
            self.assertEqual(rows[0]["raw_label"], make_record().raw_label)
            logger.close()

    def test_duplicate_uuid_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "markers.csv"
            with EventLogger(path) as logger:
                logger.append(make_record())
                with self.assertRaisesRegex(EventLogError, "duplicate event_uuid"):
                    logger.append(make_record())

    def test_unmapped_event_can_record_lsl_with_serial_fields_empty(self) -> None:
        record = replace(
            make_record(),
            marker_code=None,
            event_name="UNMAPPED",
            category="unmapped",
            serial_send_start_ns=None,
            serial_send_end_ns=None,
            serial_duration_ms=None,
            serial_success=None,
            serial_simulated=None,
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "markers.csv"
            with EventLogger(path) as logger:
                logger.append(record)
            with path.open(encoding="utf-8", newline="") as stream:
                row = next(csv.DictReader(stream))
            self.assertEqual(row["marker_code"], "")
            self.assertEqual(row["serial_success"], "")
            self.assertEqual(row["lsl_push_success"], "True")

    def test_reopen_refuses_wrong_schema(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "markers.csv"
            path.write_text("wrong,header\n", encoding="utf-8")
            with self.assertRaisesRegex(EventLogError, "header does not match schema"):
                EventLogger(path)

    def test_reopen_refuses_incomplete_last_row(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "markers.csv"
            path.write_text(",".join(EVENT_FIELDS), encoding="utf-8")
            with self.assertRaisesRegex(EventLogError, "incomplete row"):
                EventLogger(path)


if __name__ == "__main__":
    unittest.main()
