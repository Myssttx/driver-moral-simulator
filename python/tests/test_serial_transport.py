from __future__ import annotations

import sys
import unittest
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_DIR))

from marker_core import SerialConfig, SerialMarkerTransport, SerialSendError


class FakeSerial:
    def __init__(self, *, fail: bool = False, short_write: bool = False, **kwargs: object) -> None:
        self.kwargs = kwargs
        self.fail = fail
        self.short_write = short_write
        self.writes: list[bytes] = []
        self.is_open = True
        self.closed = False

    def write(self, data: bytes) -> int:
        if self.fail:
            raise OSError("test cable disconnected")
        self.writes.append(data)
        return 0 if self.short_write else len(data)

    def close(self) -> None:
        self.closed = True
        self.is_open = False


class SerialTransportTests(unittest.TestCase):
    def real_config(self) -> SerialConfig:
        return SerialConfig(
            port="/dev/test",
            enabled=True,
            simulation_mode=False,
            xonxoff=False,
            rtscts=True,
            dsrdtr=False,
        )

    def test_real_send_is_exactly_one_raw_byte_with_no_delimiter(self) -> None:
        instances: list[FakeSerial] = []

        def factory(**kwargs: object) -> FakeSerial:
            instance = FakeSerial(**kwargs)
            instances.append(instance)
            return instance

        transport = SerialMarkerTransport(self.real_config(), serial_factory=factory)
        self.assertTrue(transport.connect())
        result = transport.send(200)

        self.assertTrue(result.success)
        self.assertFalse(result.simulated)
        self.assertEqual(instances[0].writes, [b"\xc8"])
        self.assertEqual(len(instances[0].writes[0]), 1)
        self.assertIs(instances[0].kwargs["rtscts"], True)
        self.assertIs(instances[0].kwargs["xonxoff"], False)
        self.assertIs(instances[0].kwargs["dsrdtr"], False)

    def test_simulation_records_explicit_simulated_success(self) -> None:
        config = SerialConfig(port=None, enabled=False, simulation_mode=True)
        transport = SerialMarkerTransport(config)
        self.assertTrue(transport.connect())
        result = transport.send(60)
        self.assertTrue(result.success)
        self.assertTrue(result.simulated)
        self.assertEqual(transport.status, "SIMULATION")

    def test_write_exception_is_preserved_in_failed_result(self) -> None:
        transport = SerialMarkerTransport(
            self.real_config(),
            serial_factory=lambda **kwargs: FakeSerial(fail=True, **kwargs),
        )
        transport.connect()
        with self.assertRaises(SerialSendError) as captured:
            transport.send(61)
        self.assertFalse(captured.exception.result.success)
        self.assertIn("cable disconnected", captured.exception.result.error)

    def test_short_write_is_a_failure(self) -> None:
        transport = SerialMarkerTransport(
            self.real_config(),
            serial_factory=lambda **kwargs: FakeSerial(short_write=True, **kwargs),
        )
        transport.connect()
        with self.assertRaisesRegex(SerialSendError, "short serial write"):
            transport.send(62)


if __name__ == "__main__":
    unittest.main()
