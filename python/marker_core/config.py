"""Strict YAML loading and deterministic browser-marker routing."""

from __future__ import annotations

import math
from collections.abc import Iterator, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from types import MappingProxyType
from typing import Any

import yaml

from .models import MarkerDefinition, ParsedMarker


class ConfigurationError(ValueError):
    """A configuration file is missing, malformed, or inconsistent."""


class MarkerLabelError(ValueError):
    """A browser marker label cannot be parsed without information loss."""


class AmbiguousMarkerError(RuntimeError):
    """More than one configured serial marker matched an incoming event."""


def _load_yaml(path: str | Path) -> dict[str, Any]:
    config_path = Path(path)
    try:
        with config_path.open("r", encoding="utf-8") as stream:
            loaded = yaml.safe_load(stream)
    except FileNotFoundError as exc:
        raise ConfigurationError(f"configuration file not found: {config_path}") from exc
    except OSError as exc:
        raise ConfigurationError(f"cannot read configuration file {config_path}: {exc}") from exc
    except yaml.YAMLError as exc:
        raise ConfigurationError(f"invalid YAML in {config_path}: {exc}") from exc
    if not isinstance(loaded, dict):
        raise ConfigurationError(f"configuration root must be a mapping: {config_path}")
    return loaded


def _required_string(mapping: Mapping[str, Any], key: str, context: str) -> str:
    value = mapping.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ConfigurationError(f"{context}.{key} must be a non-empty string")
    return value.strip()


def _boolean(mapping: Mapping[str, Any], key: str, default: bool) -> bool:
    value = mapping.get(key, default)
    if not isinstance(value, bool):
        raise ConfigurationError(f"serial.{key} must be true or false")
    return value


def _nonnegative_float(mapping: Mapping[str, Any], key: str, default: float) -> float:
    value = mapping.get(key, default)
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(float(value))
        or float(value) < 0
    ):
        raise ConfigurationError(f"serial.{key} must be a finite number >= 0")
    return float(value)


@dataclass(frozen=True, slots=True)
class MarkerConfig:
    """Validated definitions with lookup and routing indexes."""

    markers: tuple[MarkerDefinition, ...]
    minimum_code: int = 1
    maximum_code: int = 255
    _by_name: Mapping[str, MarkerDefinition] = field(init=False, repr=False, compare=False)
    _by_code: Mapping[int, MarkerDefinition] = field(init=False, repr=False, compare=False)
    _by_event: Mapping[tuple[str, str], tuple[MarkerDefinition, ...]] = field(
        init=False, repr=False, compare=False
    )

    def __post_init__(self) -> None:
        if not self.markers:
            raise ConfigurationError("markers must not be empty")
        if not (0 <= self.minimum_code <= self.maximum_code <= 255):
            raise ConfigurationError("marker code bounds must fit in one unsigned byte")

        names: set[str] = set()
        codes: set[int] = set()
        routes: set[tuple[str, str, tuple[tuple[str, str], ...]]] = set()
        grouped: dict[tuple[str, str], list[MarkerDefinition]] = {}
        for marker in self.markers:
            if not isinstance(marker, MarkerDefinition):
                raise ConfigurationError("markers must contain MarkerDefinition objects")
            if isinstance(marker.code, bool) or not isinstance(marker.code, int):
                raise ConfigurationError(f"marker {marker.name!r} code must be an integer")
            if not self.minimum_code <= marker.code <= self.maximum_code:
                raise ConfigurationError(
                    f"marker {marker.name!r} code {marker.code} is outside configured range "
                    f"{self.minimum_code}..{self.maximum_code}"
                )
            for field_name in ("name", "category", "origin", "event_type"):
                value = getattr(marker, field_name)
                if not isinstance(value, str) or not value.strip():
                    raise ConfigurationError(
                        f"marker {marker.name!r} {field_name} must be a non-empty string"
                    )
            if marker.name in names:
                raise ConfigurationError(f"duplicate marker name {marker.name!r}")
            if marker.code in codes:
                raise ConfigurationError(f"duplicate marker code {marker.code}")
            if marker.route_key in routes:
                raise ConfigurationError(
                    f"duplicate marker route for origin={marker.origin!r}, "
                    f"event_type={marker.event_type!r}, match={dict(marker.match)!r}"
                )
            names.add(marker.name)
            codes.add(marker.code)
            routes.add(marker.route_key)
            grouped.setdefault((marker.origin, marker.event_type), []).append(marker)

        # Two different partial-match rules overlap unless at least one shared
        # key requires conflicting values. Reject that at startup instead of
        # discovering an ambiguous code while a participant is recording.
        for (origin, event_type), candidates in grouped.items():
            for index, left in enumerate(candidates):
                for right in candidates[index + 1 :]:
                    conflicts = any(
                        key in right.match and right.match[key] != value
                        for key, value in left.match.items()
                    )
                    if not conflicts:
                        raise ConfigurationError(
                            "overlapping marker routes for "
                            f"origin={origin!r}, event_type={event_type!r}: "
                            f"{left.name!r} and {right.name!r}"
                        )

        object.__setattr__(
            self, "_by_name", MappingProxyType({marker.name: marker for marker in self.markers})
        )
        object.__setattr__(
            self, "_by_code", MappingProxyType({marker.code: marker for marker in self.markers})
        )
        object.__setattr__(
            self,
            "_by_event",
            MappingProxyType({key: tuple(value) for key, value in grouped.items()}),
        )

    def __iter__(self) -> Iterator[MarkerDefinition]:
        return iter(self.markers)

    def __len__(self) -> int:
        return len(self.markers)

    @property
    def by_name(self) -> Mapping[str, MarkerDefinition]:
        return self._by_name

    @property
    def by_code(self) -> Mapping[int, MarkerDefinition]:
        return self._by_code

    def require(self, name: str) -> MarkerDefinition:
        try:
            return self._by_name[name]
        except KeyError as exc:
            raise KeyError(f"unknown marker name: {name!r}") from exc

    def route(
        self,
        origin: str,
        event_type: str,
        fields: Mapping[str, object] | None = None,
    ) -> MarkerDefinition | None:
        """Return the unique matching route, or ``None`` when intentionally unmapped."""

        if not isinstance(origin, str) or not origin.strip():
            raise ValueError("origin must be a non-empty string")
        if not isinstance(event_type, str) or not event_type.strip():
            raise ValueError("event_type must be a non-empty string")
        normalized_fields = {
            str(key): str(value)
            for key, value in (fields or {}).items()
            if value is not None
        }
        candidates = self._by_event.get((origin.strip(), event_type.strip()), ())
        matches = [
            marker
            for marker in candidates
            if all(normalized_fields.get(key) == value for key, value in marker.match.items())
        ]
        if len(matches) > 1:
            names = ", ".join(marker.name for marker in matches)
            raise AmbiguousMarkerError(
                f"ambiguous marker route for {origin!r}/{event_type!r}: {names}"
            )
        return matches[0] if matches else None


@dataclass(frozen=True, slots=True)
class SerialConfig:
    """Validated pyserial settings for the EmotivPRO marker connection."""

    port: str | None = None
    baudrate: int = 115_200
    bytesize: int = 8
    parity: str = "N"
    stopbits: float = 1.0
    timeout_seconds: float = 1.0
    write_timeout_seconds: float = 1.0
    xonxoff: bool = False
    rtscts: bool = False
    dsrdtr: bool = False
    enabled: bool = False
    simulation_mode: bool = True
    on_serial_failure: str = "warning"
    encoding: str = "uint8"
    minimum_code: int = 1
    maximum_code: int = 255
    raw: Mapping[str, Any] = field(default_factory=dict, repr=False, compare=False)

    def __post_init__(self) -> None:
        if self.port is not None and (not isinstance(self.port, str) or not self.port.strip()):
            raise ConfigurationError("serial.port must be a non-empty string or null")
        for key in ("enabled", "simulation_mode", "xonxoff", "rtscts", "dsrdtr"):
            if not isinstance(getattr(self, key), bool):
                raise ConfigurationError(f"serial.{key} must be true or false")
        if self.enabled and not self.simulation_mode and not self.port:
            raise ConfigurationError("serial.port is required for real serial transmission")
        if isinstance(self.baudrate, bool) or not isinstance(self.baudrate, int) or self.baudrate <= 0:
            raise ConfigurationError("serial.baudrate must be a positive integer")
        if self.bytesize not in {5, 6, 7, 8}:
            raise ConfigurationError("serial.bytesize must be 5, 6, 7, or 8")
        if not isinstance(self.parity, str) or self.parity.upper() not in {"N", "E", "O", "M", "S"}:
            raise ConfigurationError("serial.parity must be N, E, O, M, or S")
        if (
            isinstance(self.stopbits, bool)
            or not isinstance(self.stopbits, (int, float))
            or float(self.stopbits) not in {1.0, 1.5, 2.0}
        ):
            raise ConfigurationError("serial.stopbits must be 1, 1.5, or 2")
        for key in ("timeout_seconds", "write_timeout_seconds"):
            value = getattr(self, key)
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(float(value))
                or float(value) < 0
            ):
                raise ConfigurationError(f"serial.{key} must be a finite number >= 0")
        if (
            not isinstance(self.on_serial_failure, str)
            or self.on_serial_failure.lower() not in {"warning", "pause", "abort"}
        ):
            raise ConfigurationError("serial.on_serial_failure must be warning, pause, or abort")
        if not isinstance(self.encoding, str) or self.encoding.lower() != "uint8":
            raise ConfigurationError("only serial encoding 'uint8' is supported")
        if (
            isinstance(self.minimum_code, bool)
            or not isinstance(self.minimum_code, int)
            or isinstance(self.maximum_code, bool)
            or not isinstance(self.maximum_code, int)
            or not (0 <= self.minimum_code <= self.maximum_code <= 255)
        ):
            raise ConfigurationError("uint8 bounds must satisfy 0 <= minimum <= maximum <= 255")

        object.__setattr__(self, "port", self.port.strip() if self.port else None)
        object.__setattr__(self, "parity", self.parity.upper())
        object.__setattr__(self, "stopbits", float(self.stopbits))
        object.__setattr__(self, "timeout_seconds", float(self.timeout_seconds))
        object.__setattr__(self, "write_timeout_seconds", float(self.write_timeout_seconds))
        object.__setattr__(self, "on_serial_failure", self.on_serial_failure.lower())
        object.__setattr__(self, "encoding", self.encoding.lower())

    def as_dict(self) -> dict[str, Any]:
        if self.raw:
            return dict(self.raw)
        return {
            "port": self.port,
            "baudrate": self.baudrate,
            "bytesize": self.bytesize,
            "parity": self.parity,
            "stopbits": self.stopbits,
            "timeout_seconds": self.timeout_seconds,
            "write_timeout_seconds": self.write_timeout_seconds,
            "xonxoff": self.xonxoff,
            "rtscts": self.rtscts,
            "dsrdtr": self.dsrdtr,
            "enabled": self.enabled,
            "simulation_mode": self.simulation_mode,
            "on_serial_failure": self.on_serial_failure,
            "encoding": self.encoding,
            "minimum_code": self.minimum_code,
            "maximum_code": self.maximum_code,
        }


def load_marker_config(path: str | Path) -> MarkerConfig:
    loaded = _load_yaml(path)
    schema_version = loaded.get("schema_version", 1)
    if schema_version != 1:
        raise ConfigurationError("markers.schema_version must be 1")
    minimum_code = loaded.get("minimum_code", 1)
    maximum_code = loaded.get("maximum_code", 255)
    for key, value in (("minimum_code", minimum_code), ("maximum_code", maximum_code)):
        if isinstance(value, bool) or not isinstance(value, int):
            raise ConfigurationError(f"markers.{key} must be an integer")

    raw_markers = loaded.get("markers")
    if not isinstance(raw_markers, list) or not raw_markers:
        raise ConfigurationError("markers must be a non-empty list")
    definitions: list[MarkerDefinition] = []
    for index, item in enumerate(raw_markers):
        context = f"markers[{index}]"
        if not isinstance(item, dict):
            raise ConfigurationError(f"{context} must be a mapping")
        code = item.get("code")
        if isinstance(code, bool) or not isinstance(code, int):
            raise ConfigurationError(f"{context}.code must be an integer")
        raw_match = item.get("match", {})
        if not isinstance(raw_match, dict):
            raise ConfigurationError(f"{context}.match must be a mapping")
        match: dict[str, str] = {}
        for raw_key, raw_value in raw_match.items():
            if not isinstance(raw_key, str) or not raw_key.strip():
                raise ConfigurationError(f"{context}.match keys must be non-empty strings")
            if not isinstance(raw_value, str) or not raw_value.strip():
                raise ConfigurationError(f"{context}.match.{raw_key} must be a non-empty string")
            match[raw_key.strip()] = raw_value.strip()
        description = item.get("description", "")
        if not isinstance(description, str):
            raise ConfigurationError(f"{context}.description must be a string")
        definitions.append(
            MarkerDefinition(
                code=code,
                name=_required_string(item, "name", context),
                category=_required_string(item, "category", context),
                origin=_required_string(item, "origin", context),
                event_type=_required_string(item, "event_type", context),
                match=match,
                description=description.strip(),
            )
        )
    return MarkerConfig(tuple(definitions), minimum_code, maximum_code)


def load_serial_config(path: str | Path) -> SerialConfig:
    loaded = _load_yaml(path)
    port = loaded.get("port")
    if port is not None and (not isinstance(port, str) or not port.strip()):
        raise ConfigurationError("serial.port must be a non-empty string or null")
    integer_values = {
        "baudrate": loaded.get("baudrate", 115_200),
        "bytesize": loaded.get("bytesize", 8),
        "minimum_code": loaded.get("minimum_code", 1),
        "maximum_code": loaded.get("maximum_code", 255),
    }
    for key, value in integer_values.items():
        if isinstance(value, bool) or not isinstance(value, int):
            raise ConfigurationError(f"serial.{key} must be an integer")
    parity = loaded.get("parity", "N")
    on_failure = loaded.get("on_serial_failure", "warning")
    encoding = loaded.get("encoding", "uint8")
    for key, value in (
        ("parity", parity),
        ("on_serial_failure", on_failure),
        ("encoding", encoding),
    ):
        if not isinstance(value, str) or not value.strip():
            raise ConfigurationError(f"serial.{key} must be a non-empty string")
    stopbits = loaded.get("stopbits", 1)
    if isinstance(stopbits, bool) or not isinstance(stopbits, (int, float)):
        raise ConfigurationError("serial.stopbits must be numeric")

    return SerialConfig(
        port=port.strip() if isinstance(port, str) else None,
        baudrate=integer_values["baudrate"],
        bytesize=integer_values["bytesize"],
        parity=parity.strip(),
        stopbits=float(stopbits),
        timeout_seconds=_nonnegative_float(loaded, "timeout_seconds", 1.0),
        write_timeout_seconds=_nonnegative_float(loaded, "write_timeout_seconds", 1.0),
        xonxoff=_boolean(loaded, "xonxoff", False),
        rtscts=_boolean(loaded, "rtscts", False),
        dsrdtr=_boolean(loaded, "dsrdtr", False),
        enabled=_boolean(loaded, "enabled", False),
        simulation_mode=_boolean(loaded, "simulation_mode", True),
        on_serial_failure=on_failure.strip(),
        encoding=encoding.strip(),
        minimum_code=integer_values["minimum_code"],
        maximum_code=integer_values["maximum_code"],
        raw=MappingProxyType(dict(loaded)),
    )


def parse_marker_label(label: str) -> ParsedMarker:
    """Parse ``event_type|key=value`` without silently discarding malformed data."""

    if not isinstance(label, str) or not label.strip():
        raise MarkerLabelError("marker label must be a non-empty string")
    raw_label = label.strip()
    parts = raw_label.split("|")
    event_type = parts[0].strip()
    if not event_type:
        raise MarkerLabelError("marker event_type must be non-empty")
    fields: dict[str, str] = {}
    for index, part in enumerate(parts[1:], start=1):
        if "=" not in part:
            raise MarkerLabelError(f"marker field {index} is missing '=': {part!r}")
        key, value = part.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key or not value:
            raise MarkerLabelError(f"marker field {index} has an empty key or value")
        if key in fields:
            raise MarkerLabelError(f"duplicate marker field {key!r}")
        fields[key] = value
    return ParsedMarker(raw_label=raw_label, event_type=event_type, fields=fields)


def route_marker(
    markers: MarkerConfig,
    origin: str,
    event_type: str,
    fields: Mapping[str, object] | None = None,
) -> MarkerDefinition | None:
    """Functional wrapper around :meth:`MarkerConfig.route`."""

    if not isinstance(markers, MarkerConfig):
        raise TypeError("markers must be a MarkerConfig")
    return markers.route(origin, event_type, fields)
