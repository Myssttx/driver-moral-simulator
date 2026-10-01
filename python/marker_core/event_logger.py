"""Crash-conscious append-only CSV logging for serial marker attempts."""

from __future__ import annotations

import csv
import logging
import os
import threading
import time
from collections.abc import Callable, Sequence
from pathlib import Path
from types import TracebackType
from typing import IO, Self

from .models import EventRecord

log = logging.getLogger(__name__)


class EventLogError(IOError):
    """An event cannot be durably appended to its local audit log."""


EVENT_FIELDS: tuple[str, ...] = (
    "event_uuid",
    "client_event_id",
    "session_id",
    "participant_id",
    "trial",
    "marker_code",
    "event_name",
    "category",
    "origin",
    "event_type",
    "raw_label",
    "monotonic_ns",
    "elapsed_seconds",
    "utc_timestamp",
    "lsl_timestamp",
    "lsl_push_success",
    "lsl_error",
    "serial_send_start_ns",
    "serial_send_end_ns",
    "serial_duration_ms",
    "serial_success",
    "condition",
    "choice",
    "metadata_json",
    "serial_error",
    "serial_simulated",
)


class EventLogger:
    """Append and flush every marker event before returning to the bridge."""

    fieldnames: Sequence[str] = EVENT_FIELDS

    def __init__(
        self,
        path: str | os.PathLike[str],
        *,
        session_start_ns: int | None = None,
        fsync_interval_events: int = 0,
        clock_ns: Callable[[], int] | None = None,
    ) -> None:
        if (
            isinstance(fsync_interval_events, bool)
            or not isinstance(fsync_interval_events, int)
            or fsync_interval_events < 0
        ):
            raise ValueError("fsync_interval_events must be an integer >= 0")
        clock_ns = clock_ns or time.perf_counter_ns
        self.path = Path(path)
        self.session_start_ns = clock_ns() if session_start_ns is None else int(session_start_ns)
        self.fsync_interval_events = fsync_interval_events
        self._lock = threading.RLock()
        self._closed = False
        self._events_since_fsync = 0
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self._event_file, self._event_writer, self._event_uuids = self._open_append_csv(
                self.path,
                EVENT_FIELDS,
                identity_field="event_uuid",
            )
        except (OSError, EventLogError) as exc:
            if isinstance(exc, EventLogError):
                raise
            raise EventLogError(f"cannot open event log {self.path}: {exc}") from exc

    @staticmethod
    def _open_append_csv(
        path: Path,
        fieldnames: Sequence[str],
        *,
        identity_field: str | None = None,
    ) -> tuple[IO[str], csv.DictWriter, set[str]]:
        existed_with_data = path.is_file() and path.stat().st_size > 0
        identities: set[str] = set()
        if existed_with_data:
            with path.open("rb") as raw_handle:
                raw_handle.seek(-1, os.SEEK_END)
                if raw_handle.read(1) not in {b"\n", b"\r"}:
                    raise EventLogError(
                        f"refusing to append to {path}: existing CSV ends with an incomplete row"
                    )
            with path.open("r", encoding="utf-8", newline="") as existing_handle:
                try:
                    reader = csv.DictReader(existing_handle, strict=True)
                    if reader.fieldnames != list(fieldnames):
                        raise EventLogError(
                            f"refusing to append to {path}: existing CSV header does not match schema"
                        )
                    if identity_field is not None:
                        for row in reader:
                            identity = (row.get(identity_field) or "").strip()
                            if identity:
                                identities.add(identity)
                except csv.Error as exc:
                    raise EventLogError(f"cannot read existing CSV {path}: {exc}") from exc
        handle = path.open("a", encoding="utf-8", newline="", buffering=1)
        writer = csv.DictWriter(
            handle,
            fieldnames=fieldnames,
            extrasaction="raise",
            lineterminator="\n",
        )
        if not existed_with_data:
            writer.writeheader()
            handle.flush()
        return handle, writer, identities

    @property
    def closed(self) -> bool:
        return self._closed

    def append(self, record: EventRecord) -> EventRecord:
        if not isinstance(record, EventRecord):
            raise TypeError("record must be an EventRecord")
        with self._lock:
            self._ensure_open()
            event_uuid = record.event_uuid.strip()
            if event_uuid in self._event_uuids:
                raise EventLogError(f"duplicate event_uuid cannot be appended: {event_uuid}")
            try:
                self._event_writer.writerow(record.to_csv_row())
                self._event_file.flush()
                self._events_since_fsync += 1
                if (
                    self.fsync_interval_events > 0
                    and self._events_since_fsync >= self.fsync_interval_events
                ):
                    os.fsync(self._event_file.fileno())
                    self._events_since_fsync = 0
                self._event_uuids.add(event_uuid)
            except (OSError, csv.Error, ValueError) as exc:
                log.exception("Failed to append marker event %s", event_uuid)
                raise EventLogError(
                    f"failed to append event {event_uuid} to {self.path}: {exc}"
                ) from exc
        return record

    log_event = append

    def flush(self, *, force_fsync: bool = False) -> None:
        with self._lock:
            self._ensure_open()
            try:
                self._event_file.flush()
                if force_fsync:
                    os.fsync(self._event_file.fileno())
                    self._events_since_fsync = 0
            except OSError as exc:
                raise EventLogError(f"failed to flush event log: {exc}") from exc

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            errors: list[BaseException] = []
            try:
                self._event_file.flush()
                os.fsync(self._event_file.fileno())
            except OSError as exc:
                errors.append(exc)
            finally:
                try:
                    self._event_file.close()
                except OSError as exc:
                    errors.append(exc)
            self._closed = True
            if errors:
                raise EventLogError(f"failed while closing event log: {errors[0]}") from errors[0]

    def _ensure_open(self) -> None:
        if self._closed:
            raise EventLogError("event logger is closed")

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> bool:
        self.close()
        return False
