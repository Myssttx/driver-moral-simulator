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
        dashboard = route_marker(
            self.config, "operator_dashboard", "session_start", {}
        )
        participant = route_marker(
            self.config, "driver_moral_simulator", "session_start", {}
        )
        self.assertEqual(dashboard.name, "DASHBOARD_SESSION_START")
        self.assertEqual(dashboard.code, 100)
        self.assertEqual(participant.name, "SESSION_START")
        self.assertEqual(participant.code, 1)

    def test_all_dashboard_protocol_milestones_are_mapped(self) -> None:
        test = route_marker(self.config, "operator_dashboard", "test_marker", {})
        self.assertEqual(test.code, 10)
        expected = {
            "session_start": 100,
            "consent_start": 101,
            "consent_signed": 102,
            "pre_task_survey_start": 103,
            "pre_task_survey_complete": 104,
            "equipment_setup_start": 105,
            "emotiv_setup_complete": 106,
            "emotibit_setup_complete": 107,
            "baseline_start": 108,
            "baseline_end": 109,
            "sos_rules_start": 110,
            "sos_rules_end": 111,
            "sos_practice_prompt": 112,
            "sos_human_prompt": 113,
            "sos_ai_prompt": 114,
            "sos_unknown_prompt": 115,
            "trolley_rules_start": 116,
            "trolley_rules_end": 117,
            "trolley_task_start": 118,
            "trolley_task_end": 119,
            "equipment_removal_start": 120,
            "equipment_removed": 121,
            "post_task_survey_start": 122,
            "post_task_survey_complete": 123,
            "debrief_start": 124,
            "debrief_end": 125,
            "session_end": 126,
        }
        for event_type, code in expected.items():
            with self.subTest(event_type=event_type):
                marker = route_marker(
                    self.config, "operator_dashboard", event_type, {}
                )
                self.assertIsNotNone(marker)
                self.assertEqual(marker.code, code)

    def test_all_dashboard_round_controls_are_mapped(self) -> None:
        rounds = (
            ("practice", 130, 134, 150, 154),
            ("human", 131, 138, 151, 155),
            ("ai", 132, 142, 152, 156),
            ("unknown", 133, 146, 153, 157),
        )
        choice_offsets = {
            ("participant", "split"): 0,
            ("participant", "steal"): 1,
            ("opponent", "split"): 2,
            ("opponent", "steal"): 3,
        }
        for round_name, start_code, choice_base, outcome_code, end_code in rounds:
            with self.subTest(round=round_name, action="start"):
                marker = route_marker(
                    self.config,
                    "operator_dashboard",
                    "sos_round_start",
                    {"round": round_name},
                )
                self.assertEqual(marker.code, start_code)
            for (actor, choice), offset in choice_offsets.items():
                with self.subTest(
                    round=round_name, action="choice", actor=actor, choice=choice
                ):
                    marker = route_marker(
                        self.config,
                        "operator_dashboard",
                        "sos_choice",
                        {"round": round_name, "actor": actor, "choice": choice},
                    )
                    self.assertEqual(marker.code, choice_base + offset)
            with self.subTest(round=round_name, action="outcome"):
                marker = route_marker(
                    self.config,
                    "operator_dashboard",
                    "sos_outcome_shown",
                    {"round": round_name},
                )
                self.assertEqual(marker.code, outcome_code)
            with self.subTest(round=round_name, action="end"):
                marker = route_marker(
                    self.config,
                    "operator_dashboard",
                    "sos_round_end",
                    {"round": round_name},
                )
                self.assertEqual(marker.code, end_code)

    def test_all_dashboard_distractor_and_operator_controls_are_mapped(self) -> None:
        expected = (
            ("serial_sevens_start", {"task": "after_human"}, 160),
            ("serial_sevens_end", {"task": "after_human"}, 161),
            ("serial_sevens_start", {"task": "after_ai"}, 162),
            ("serial_sevens_end", {"task": "after_ai"}, 163),
            ("serial_sevens_start", {"task": "after_unknown"}, 164),
            ("serial_sevens_end", {"task": "after_unknown"}, 165),
            ("signal_quality_adjustment", {}, 170),
            ("operator_note", {"event": "pause"}, 171),
            ("operator_note", {"event": "resume"}, 172),
        )
        for event_type, fields, code in expected:
            with self.subTest(event_type=event_type, fields=fields):
                marker = route_marker(
                    self.config, "operator_dashboard", event_type, fields
                )
                self.assertIsNotNone(marker)
                self.assertEqual(marker.code, code)

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
