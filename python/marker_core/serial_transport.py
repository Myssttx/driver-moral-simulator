"""Thread-safe pyserial transport for exact unsigned-byte marker writes."""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable, Mapping
from types import TracebackType
from typing import Any, Protocol, Self

from .config import SerialConfig
from .models import SerialSendResult

log = logging.getLogger(__name__)


class SerialLike(Protocol):
    is_open: bool

    def write(self, data: bytes) -> int | None: ...

    def close(self) -> None: ...


class SerialTransportError(RuntimeError):
    """Base class for explicit serial transport failures."""


class SerialConnectionError(SerialTransportError):
    """Opening or closing the configured port failed."""


class SerialSendError(SerialTransportError):
    """A marker write failed; ``result`` preserves timing and cause."""

    def __init__(self, message: str, result: SerialSendResult) -> None:
        super().__init__(message)
        self.result = result


class SerialDisabledError(SerialSendError):
    """Neither real serial transmission nor simulation is enabled."""


class SerialNotConnectedError(SerialSendError):
    """A real send was requested before an explicit connection."""


class SerialProtocolError(SerialSendError):
    """A marker cannot be represented by the configured protocol."""


class SerialMarkerTransport:
    """Send one configured marker code as exactly one raw unsigned byte."""

    def __init__(
        self,
        config: SerialConfig | Mapping[str, Any],
        *,
        serial_factory: Callable[..., SerialLike] | None = None,
        clock_ns: Callable[[], int] | None = None,
    ) -> None:
        if isinstance(config, Mapping):
            config = SerialConfig(**dict(config))
        if not isinstance(config, SerialConfig):
            raise TypeError("config must be a SerialConfig or compatible mapping")
        self.config = config
        self._serial_factory = serial_factory
        self._clock_ns = clock_ns or time.perf_counter_ns
        self._serial: SerialLike | None = None
        self._lock = threading.RLock()
        self._history: list[SerialSendResult] = []

    @property
    def history(self) -> tuple[SerialSendResult, ...]:
        with self._lock:
            return tuple(self._history)

    @property
    def connected(self) -> bool:
        with self._lock:
            if self.config.simulation_mode:
                return True
            return bool(self._serial is not None and getattr(self._serial, "is_open", True))

    @property
    def status(self) -> str:
        if self.config.simulation_mode:
            return "SIMULATION"
        if not self.config.enabled:
            return "DISABLED"
        return "CONNECTED" if self.connected else "DISCONNECTED"

    def connect(self) -> bool:
        """Open the configured real port outside the timing-critical send path."""

        with self._lock:
            if self.config.simulation_mode:
                log.info("Serial marker transport ready in simulation mode")
                return True
            if not self.config.enabled:
                log.warning("Serial marker transport is disabled")
                return False
            if self.connected:
                return True
            factory = self._serial_factory
            if factory is None:
                try:
                    import serial  # type: ignore[import-not-found]
                except ImportError as exc:
                    raise SerialConnectionError(
                        "pyserial is required for real serial marker transmission"
                    ) from exc
                if self.config.port and "://" in self.config.port:
                    def factory(**kwargs: Any) -> SerialLike:
                        url = kwargs.pop("port")
                        return serial.serial_for_url(url, **kwargs)
                else:
                    factory = serial.Serial
            try:
                self._serial = factory(
                    port=self.config.port,
                    baudrate=self.config.baudrate,
                    bytesize=self.config.bytesize,
                    parity=self.config.parity,
                    stopbits=self.config.stopbits,
                    timeout=self.config.timeout_seconds,
                    write_timeout=self.config.write_timeout_seconds,
                    xonxoff=self.config.xonxoff,
                    rtscts=self.config.rtscts,
                    dsrdtr=self.config.dsrdtr,
                )
            except Exception as exc:
                self._serial = None
                log.exception("Failed to open serial port %s", self.config.port)
                raise SerialConnectionError(
                    f"failed to open serial port {self.config.port!r}: {exc}"
                ) from exc
            log.info("Serial port connected: %s at %d baud", self.config.port, self.config.baudrate)
            return True

    open = connect

    def send(self, code: int) -> SerialSendResult:
        """Write one byte or raise an error carrying a failed result."""

        start_ns = self._clock_ns()
        with self._lock:
            if isinstance(code, bool) or not isinstance(code, int):
                return self._raise_send_failure(
                    code=code if isinstance(code, int) else -1,
                    start_ns=start_ns,
                    message="marker code must be an integer",
                    exception_type=SerialProtocolError,
                )
            if not self.config.minimum_code <= code <= self.config.maximum_code:
                return self._raise_send_failure(
                    code=code,
                    start_ns=start_ns,
                    message=(
                        f"marker code {code} is outside configured range "
                        f"{self.config.minimum_code}..{self.config.maximum_code}"
                    ),
                    exception_type=SerialProtocolError,
                )
            if not 0 <= code <= 255:
                return self._raise_send_failure(
                    code=code,
                    start_ns=start_ns,
                    message=f"marker code {code} cannot be encoded as uint8",
                    exception_type=SerialProtocolError,
                )
            if self.config.simulation_mode:
                result = SerialSendResult(
                    code=code,
                    start_ns=start_ns,
                    end_ns=self._clock_ns(),
                    success=True,
                    simulated=True,
                )
                self._history.append(result)
                return result
            if not self.config.enabled:
                return self._raise_send_failure(
                    code=code,
                    start_ns=start_ns,
                    message="serial marker transport is disabled and simulation mode is off",
                    exception_type=SerialDisabledError,
                )
            if not self.connected or self._serial is None:
                return self._raise_send_failure(
                    code=code,
                    start_ns=start_ns,
                    message="serial marker transport is not connected",
                    exception_type=SerialNotConnectedError,
                )
            try:
                written = self._serial.write(bytes((code,)))
                if written != 1:
                    raise OSError(f"short serial write: expected 1 byte, wrote {written}")
            except Exception as exc:  # noqa: BLE001 - adapters raise varied write exceptions.
                return self._raise_send_failure(
                    code=code,
                    start_ns=start_ns,
                    message=f"serial marker write failed for code {code}: {exc}",
                    exception_type=SerialSendError,
                )
            result = SerialSendResult(
                code=code,
                start_ns=start_ns,
                end_ns=self._clock_ns(),
                success=True,
                simulated=False,
            )
            self._history.append(result)
            return result

    send_marker = send

    def _raise_send_failure(
        self,
        *,
        code: int,
        start_ns: int,
        message: str,
        exception_type: type[SerialSendError],
    ) -> Any:
        result = SerialSendResult(
            code=code,
            start_ns=start_ns,
            end_ns=self._clock_ns(),
            success=False,
            simulated=False,
            error=message,
        )
        self._history.append(result)
        log.error(message)
        raise exception_type(message, result)

    def close(self) -> None:
        with self._lock:
            serial_port = self._serial
            self._serial = None
            if serial_port is None:
                return
            try:
                serial_port.close()
            except Exception as exc:
                log.exception("Failed to close serial port %s", self.config.port)
                raise SerialConnectionError(
                    f"failed to close serial port {self.config.port!r}: {exc}"
                ) from exc

    disconnect = close

    def __enter__(self) -> Self:
        self.connect()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> bool:
        self.close()
        return False
