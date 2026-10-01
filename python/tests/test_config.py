from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_DIR))

from marker_core import ConfigurationError, load_marker_config, load_serial_config


class MarkerConfigTests(unittest.TestCase):
    def test_project_configuration_loads_and_indexes_all_routes(self) -> None:
        config = load_marker_config(PYTHON_DIR / "config" / "markers.yaml")

        self.assertEqual(len(config), 10)
        self.assertEqual(config.require("SCENARIO_ONSET").code, 40)
        self.assertEqual(config.by_code[10].name, "SERIAL_TEST")

    def test_duplicate_code_is_rejected(self) -> None:
        body = """schema_version: 1
markers:
  - {code: 1, name: A, category: c, origin: driver_moral_simulator, event_type: a}
  - {code: 1, name: B, category: c, origin: driver_moral_simulator, event_type: b}
"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "markers.yaml"
            path.write_text(body, encoding="utf-8")
            with self.assertRaisesRegex(ConfigurationError, "duplicate marker code"):
                load_marker_config(path)

    def test_duplicate_route_is_rejected(self) -> None:
        body = """schema_version: 1
markers:
  - {code: 1, name: A, category: c, origin: driver_moral_simulator, event_type: choice, match: {side: left}}
  - {code: 2, name: B, category: c, origin: driver_moral_simulator, event_type: choice, match: {side: left}}
"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "markers.yaml"
            path.write_text(body, encoding="utf-8")
            with self.assertRaisesRegex(ConfigurationError, "duplicate marker route"):
                load_marker_config(path)

    def test_overlapping_partial_routes_are_rejected_at_startup(self) -> None:
        body = """schema_version: 1
markers:
  - {code: 1, name: DEFAULT, category: c, origin: driver_moral_simulator, event_type: choice, match: {}}
  - {code: 2, name: LEFT, category: c, origin: driver_moral_simulator, event_type: choice, match: {side: left}}
"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "markers.yaml"
            path.write_text(body, encoding="utf-8")
            with self.assertRaisesRegex(ConfigurationError, "overlapping marker routes"):
                load_marker_config(path)

    def test_serial_flow_control_settings_load_explicitly(self) -> None:
        config = load_serial_config(PYTHON_DIR / "config" / "serial.yaml")

        self.assertFalse(config.xonxoff)
        self.assertFalse(config.rtscts)
        self.assertFalse(config.dsrdtr)
        self.assertTrue(config.simulation_mode)


if __name__ == "__main__":
    unittest.main()
