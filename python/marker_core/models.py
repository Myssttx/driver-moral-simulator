"""Immutable records shared by marker routing, transport, and logging."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from types import MappingProxyType
from typing import Any


@dataclass(frozen=True, slots=True)
class MarkerDefinition:
    """One configured route from a browser event to a serial byte."""

    code: int
    name: str
    category: str
    origin: str
    event_type: str
    match: Mapping[str, str] = field(default_factory=dict)
    description: str = ""

    def __post_init__(self) -> None:
        object.__setattr__(self, "match", MappingProxyType(dict(self.match)))

    @property
    def route_key(self) -> tuple[str, str, tuple[tuple[str, str], ...]]:
        return self.origin, self.event_type, tuple(sorted(self.match.items()))


@dataclass(frozen=True, slots=True)
class ParsedMarker:
    """A validated pipe-delimited browser marker label."""

    raw_label: str
    event_type: str
    fields: Mapping[str, str]

    def __post_init__(self) -> None:
        object.__setattr__(self, "fields", MappingProxyType(dict(self.fields)))


@dataclass(frozen=True, slots=True)
class SerialSendResult:
    """Observable result of one attempt to write a marker byte."""

    code: int
    start_ns: int
    end_ns: int
    success: bool
    simulated: bool = False
    error: str | None = None

    @property
    def duration_ms(self) -> float:
        return (self.end_ns - self.start_ns) / 1_000_000


@dataclass(frozen=True, slots=True)
class EventRecord:
    """One locally auditable marker event and its serial-write outcome."""

    event_uuid: str
    client_event_id: str | None
    session_id: str
    participant_id: str
    trial: int | str | None
    marker_code: int | None
    event_name: str
    category: str
    origin: str
    event_type: str
    raw_label: str
    monotonic_ns: int
    elapsed_seconds: float
    utc_timestamp: datetime
    lsl_timestamp: float | None
    lsl_push_success: bool | None
    lsl_error: str | None
    serial_send_start_ns: int | None
    serial_send_end_ns: int | None
    serial_duration_ms: float | None
    serial_success: bool | None
    condition: str | None = None
    choice: str | None = None
    metadata_json: str = "{}"
    serial_error: str | None = None
    serial_simulated: bool | None = None

    def __post_init__(self) -> None:
        if not self.event_uuid.strip():
            raise ValueError("event_uuid must be non-empty")
        if self.utc_timestamp.tzinfo is None or self.utc_timestamp.utcoffset() is None:
            raise ValueError("utc_timestamp must be timezone-aware")
        if self.utc_timestamp.utcoffset() != timedelta(0):
            raise ValueError("utc_timestamp must be expressed in UTC")
        if self.monotonic_ns < 0:
            raise ValueError("monotonic_ns must be non-negative")
        if self.serial_send_start_ns is not None and self.serial_send_start_ns < 0:
            raise ValueError("serial_send_start_ns must be non-negative")
        if self.serial_send_end_ns is not None and self.serial_send_end_ns < 0:
            raise ValueError("serial_send_end_ns must be non-negative")
        if (
            self.serial_send_start_ns is not None
            and self.serial_send_end_ns is not None
            and self.serial_send_end_ns < self.serial_send_start_ns
        ):
            raise ValueError("serial_send_end_ns cannot precede serial_send_start_ns")

    def to_csv_row(self) -> dict[str, Any]:
        """Return a stable CSV-safe representation."""

        return {
            "event_uuid": self.event_uuid,
            "client_event_id": "" if self.client_event_id is None else self.client_event_id,
            "session_id": self.session_id,
            "participant_id": self.participant_id,
            "trial": "" if self.trial is None else self.trial,
            "marker_code": "" if self.marker_code is None else self.marker_code,
            "event_name": self.event_name,
            "category": self.category,
            "origin": self.origin,
            "event_type": self.event_type,
            "raw_label": self.raw_label,
            "monotonic_ns": self.monotonic_ns,
            "elapsed_seconds": f"{self.elapsed_seconds:.9f}",
            "utc_timestamp": self.utc_timestamp.isoformat(),
            "lsl_timestamp": (
                "" if self.lsl_timestamp is None else f"{self.lsl_timestamp:.9f}"
            ),
            "lsl_push_success": (
                "" if self.lsl_push_success is None else self.lsl_push_success
            ),
            "lsl_error": "" if self.lsl_error is None else self.lsl_error,
            "serial_send_start_ns": (
                "" if self.serial_send_start_ns is None else self.serial_send_start_ns
            ),
            "serial_send_end_ns": (
                "" if self.serial_send_end_ns is None else self.serial_send_end_ns
            ),
            "serial_duration_ms": (
                "" if self.serial_duration_ms is None else f"{self.serial_duration_ms:.6f}"
            ),
            "serial_success": "" if self.serial_success is None else self.serial_success,
            "condition": "" if self.condition is None else self.condition,
            "choice": "" if self.choice is None else self.choice,
            "metadata_json": self.metadata_json,
            "serial_error": "" if self.serial_error is None else self.serial_error,
            "serial_simulated": (
                "" if self.serial_simulated is None else self.serial_simulated
            ),
        }
