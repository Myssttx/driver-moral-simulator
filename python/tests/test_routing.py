from __future__ import annotations

import sys
import unittest
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_DIR))

from marker_core import (
    MarkerLabelError,
    load_marker_config,
    parse_marker_label,
    route_marker,
)


class RoutingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.config = load_marker_config(PYTHON_DIR / "config" / "markers.yaml")

    def test_choice_routes_are_distinct(self) -> None:
        expected = {"left": 60, "right": 61, "timeout": 62}
        for side, code in expected.items():
            with self.subTest(side=side):
                marker = route_marker(
                    self.config,
                    "driver_moral_simulator",
                    "choice",
                    {"side": side, "trial": "01"},
                )
                self.assertIsNotNone(marker)
                self.assertEqual(marker.code, code)

    def test_all_participant_game_event_codes(self) -> None:
        expected = {
            "session_start": 1,
            "session_end": 2,
            "trial_start": 20,
            "trial_end": 21,
            "scenario_onset": 40,
            "outcome_shown": 80,
        }
        for event_type, code in expected.items():
            with self.subTest(event_type=event_type):
                marker = route_marker(
                    self.config,
                    "driver_moral_simulator",
                    event_type,
                    {},
                )
                self.assertIsNotNone(marker)
                self.assertEqual(marker.code, code)

    def test_origin_is_part_of_the_route(self) -> None:
        self.assertIsNone(
            route_marker(self.config, "operator_dashboard", "session_start", {})
        )
        participant = route_marker(
            self.config, "driver_moral_simulator", "session_start", {}
        )
        self.assertEqual(participant.name, "SESSION_START")

    def test_only_dashboard_test_marker_is_mapped(self) -> None:
        test = route_marker(self.config, "operator_dashboard", "test_marker", {})
        self.assertEqual(test.code, 10)
        self.assertIsNone(
            route_marker(self.config, "operator_dashboard", "consent_start", {})
        )
        self.assertIsNone(
            route_marker(self.config, "operator_dashboard", "sos_round_start", {})
        )

    def test_unrecognized_choice_value_is_unmapped(self) -> None:
        self.assertIsNone(
            route_marker(
                self.config, "driver_moral_simulator", "choice", {"side": "up"}
            )
        )

    def test_pipe_label_parser_preserves_fields_and_rejects_duplicates(self) -> None:
        parsed = parse_marker_label(
            "choice|origin=driver_moral_simulator|trial=03|side=left|rt_ms=412"
        )
        self.assertEqual(parsed.event_type, "choice")
        self.assertEqual(parsed.fields["side"], "left")
        self.assertEqual(parsed.fields["rt_ms"], "412")
        with self.assertRaisesRegex(MarkerLabelError, "duplicate marker field"):
            parse_marker_label("choice|side=left|side=right")


if __name__ == "__main__":
    unittest.main()
