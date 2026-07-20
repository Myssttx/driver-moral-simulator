"use client";

/**
 * Browser-side LSL marker client.
 *
 * The browser app cannot publish directly on Lab Streaming Layer — browsers have
 * no native UDP/multicast. Instead, we connect to a small Python WebSocket
 * bridge running on localhost (see python/marker_bridge.py) which owns the
 * actual pylsl outlet that EmotivPRO is recording.
 *
 * Hard rules from the lab brief, encoded here:
 *
 *   1. Every marker is pushed at the SAME code point as the visual event
 *      it timestamps — never deferred, never coroutined. The push call
 *      here is synchronous from the caller's perspective: it enqueues the
 *      frame on the WebSocket immediately. Browser -> localhost latency is
 *      sub-millisecond.
 *
 *   2. Timestamps come from LSL, not from `Date.now()` or `performance.now()`.
 *      We carry NO client-side timestamp — the bridge stamps the sample with
 *      `pylsl.local_clock()` at the instant of `outlet.push_sample()`, which
 *      is what EmotivPRO uses to align the marker to the EEG stream.
 *
 *   3. If the bridge is not reachable, marker pushes silently buffer up to
 *      a small in-memory cap and replay on reconnect. The UI surfaces the
 *      connection state via `useLSLMarkers().status` so an operator can see
 *      the bridge is down BEFORE starting a recording. Refusing to start a
 *      session when LSL is down is enforced upstream by the operator workflow,
 *      not here — the browser app itself remains
 *      playable for development / standalone use without a bridge.
 *
 * Marker label schema (pipe-delimited):
 *   event_type|trial=NN|condition=XXX|side=...|rt_ms=...|...
 * EmotivPRO may only store the integer part of numeric marker values, so
 * the label string is where the real information lives. The bridge passes
 * the label through as a string sample without parsing.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// LAB DECISION: bridge endpoint. Must match python/marker_bridge.py's
// --host / --port. localhost-only by default to avoid accidental
// cross-machine clock skew in development.
const DEFAULT_BRIDGE_URL = "ws://127.0.0.1:7779/markers";

// LAB DECISION: how many markers to hold in memory if the bridge briefly
// disconnects mid-session. 256 covers ~12+ trials at 20 markers/trial,
// which is way more than realistic transient outages. Set to 0 to drop
// instead of buffering.
const OFFLINE_BUFFER_CAP = 256;

// Backoff schedule for auto-reconnect, in ms. We want the operator to
// notice if the bridge is genuinely down, so we don't back off forever.
const RECONNECT_DELAYS_MS = [250, 500, 1000, 2000, 4000];

/**
 * Hook returning a stable `pushMarker(label)` function and a connection
 * status string ("connecting" | "open" | "closed" | "disabled").
 *
 * Pass `{ enabled: false }` to no-op the whole thing — useful in dev /
 * standalone play when no EEG rig is hooked up.
 */
export function useLSLMarkers({
  url = DEFAULT_BRIDGE_URL,
  enabled = true,
} = {}) {
  const [status, setStatus] = useState(enabled ? "connecting" : "disabled");
  const [lastAck, setLastAck] = useState(null);

  const wsRef = useRef(null);
  const bufferRef = useRef([]); // labels queued while disconnected
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const connectRef = useRef(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const flushBuffer = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const buf = bufferRef.current;
    while (buf.length > 0) {
      const label = buf.shift();
      try {
        ws.send(label);
      } catch (err) {
        // Re-queue the label and bail: connection is going down.
        buf.unshift(label);
        console.warn("[lslMarkers] send failed, requeued:", err);
        return;
      }
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!enabledRef.current) return;
    if (reconnectTimerRef.current != null) return;
    const attempt = reconnectAttemptRef.current;
    const delay =
      RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
    reconnectAttemptRef.current = attempt + 1;
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connectRef.current?.();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    if (!enabledRef.current) {
      setStatus("disabled");
      return;
    }
    if (typeof WebSocket === "undefined") {
      // SSR / non-browser environment — nothing to do.
      return;
    }

    setStatus("connecting");
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.error("[lslMarkers] WebSocket constructor failed:", err);
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setStatus("open");
      flushBuffer();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg && msg.type === "ack") {
          setLastAck(msg);
        }
      } catch {
        // Bridge sends only JSON; ignore anything else silently.
      }
    };

    ws.onerror = () => {
      // The "error" event is followed by "close"; let the close handler
      // own the reconnect logic. We just leave a breadcrumb.
      console.warn("[lslMarkers] WebSocket error");
    };

    ws.onclose = () => {
      wsRef.current = null;
      setStatus("closed");
      scheduleReconnect();
    };
  }, [url, flushBuffer, scheduleReconnect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (!enabled) {
      const statusTimer = setTimeout(() => setStatus("disabled"), 0);
      return () => clearTimeout(statusTimer);
    }
    const connectTimer = setTimeout(() => connect(), 0);
    return () => {
      clearTimeout(connectTimer);
      if (reconnectTimerRef.current != null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        try {
          ws.close(1000, "component unmount");
        } catch {
          /* ignore */
        }
      }
    };
  }, [enabled, connect]);

  /**
   * Synchronously enqueue a marker for the bridge.
   *
   * If the bridge is connected, this calls `ws.send(label)` immediately so
   * the label reaches `outlet.push_sample()` within ~1 ms. If the bridge
   * is not connected, the label is buffered (up to OFFLINE_BUFFER_CAP) and
   * flushed on reconnect, with a console warning.
   *
   * Returns `true` if the marker hit the wire, `false` if it was buffered
   * or dropped. Callers do not need to await anything — this is fire-and-
   * forget on the event-loop sense.
   */
  const pushMarker = useCallback((label) => {
    if (!enabledRef.current) return false;
    if (typeof label !== "string" || label.length === 0) {
      console.warn("[lslMarkers] ignored non-string / empty label:", label);
      return false;
    }
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(label);
        return true;
      } catch (err) {
        console.warn("[lslMarkers] direct send failed, buffering:", err);
      }
    }
    // Buffer with cap.
    const buf = bufferRef.current;
    if (buf.length >= OFFLINE_BUFFER_CAP) {
      console.error(
        "[lslMarkers] offline buffer full, dropping marker:",
        label,
      );
      return false;
    }
    buf.push(label);
    return false;
  }, []);

  return { pushMarker, status, lastAck };
}

/**
 * Format a marker label per the lab schema.
 *
 *   event_type|trial=NN|condition=XXX|key=value|...
 *
 * Pass `extras` as a plain object of additional fields. Keys/values are
 * coerced to strings; values containing `|` or `=` are rejected (would
 * break the parser in analyze_session.py).
 *
 * Examples:
 *   formatMarker("session_start")
 *   formatMarker("trial_start", { trial: 7, condition: "age_dilemma" })
 *   formatMarker("choice", { trial: 7, condition: "age_dilemma",
 *                            side: "left", rt_ms: 2340 })
 */
export function formatMarker(eventType, extras) {
  if (typeof eventType !== "string" || !eventType) {
    throw new TypeError("formatMarker: eventType must be a non-empty string");
  }
  const parts = [eventType];
  if (extras && typeof extras === "object") {
    for (const [rawKey, rawValue] of Object.entries(extras)) {
      if (rawValue === undefined || rawValue === null) continue;
      const key = String(rawKey);
      const value = String(rawValue);
      if (
        key.includes("|") ||
        key.includes("=") ||
        value.includes("|") ||
        value.includes("=")
      ) {
        throw new Error(
          `formatMarker: forbidden char in field ${key}=${value} ` +
            `(pipe-delimited schema would corrupt)`,
        );
      }
      // Zero-pad trial numbers for sortability (trial=07 not trial=7).
      const formatted = key === "trial" ? String(value).padStart(2, "0") : value;
      parts.push(`${key}=${formatted}`);
    }
  }
  return parts.join("|");
}
