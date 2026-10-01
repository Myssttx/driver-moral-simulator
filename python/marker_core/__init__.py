"""Configuration-first serial marker primitives for the browser bridge.

The package deliberately contains no browser or LSL code.  ``marker_bridge``
owns orchestration while this package owns deterministic label routing, the
one-byte serial protocol, and the append-only local audit record.
"""

from .config import (
    AmbiguousMarkerError,
    ConfigurationError,
    MarkerConfig,
    MarkerLabelError,
    SerialConfig,
    load_marker_config,
    load_serial_config,
    parse_marker_label,
    route_marker,
)
from .event_logger import EVENT_FIELDS, EventLogError, EventLogger
from .models import EventRecord, MarkerDefinition, ParsedMarker, SerialSendResult
from .serial_transport import (
    SerialConnectionError,
    SerialDisabledError,
    SerialMarkerTransport,
    SerialNotConnectedError,
    SerialProtocolError,
    SerialSendError,
    SerialTransportError,
)

__all__ = [
    "EVENT_FIELDS",
    "AmbiguousMarkerError",
    "ConfigurationError",
    "EventLogError",
    "EventLogger",
    "EventRecord",
    "MarkerConfig",
    "MarkerDefinition",
    "MarkerLabelError",
    "ParsedMarker",
    "SerialConfig",
    "SerialConnectionError",
    "SerialDisabledError",
    "SerialMarkerTransport",
    "SerialNotConnectedError",
    "SerialProtocolError",
    "SerialSendError",
    "SerialSendResult",
    "SerialTransportError",
    "load_marker_config",
    "load_serial_config",
    "parse_marker_label",
    "route_marker",
]
