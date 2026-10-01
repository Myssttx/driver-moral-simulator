"use client";

/**
 * Browser-side client for the local Python marker bridge.
 *
 * Browsers cannot safely own the experiment serial port or publish native
 * LSL. The hook therefore sends a versioned JSON envelope to the localhost
 * bridge at the exact existing event call site. The bridge captures the
 * authoritative receive time, writes one configured raw serial byte, pushes
 * the optional rich LSL label, durably logs the result, and returns an ACK.
 *
 * A disconnected marker is rejected, never buffered for replay. Replaying it
 * later would create a plausible marker at the wrong EEG time.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// LAB DECISION: bridge endpoint. Must match python/marker_bridge.py's
// --host / --port. localhost-only by default to avoid accidental
// cross-machine clock skew in development.
const DEFAULT_BRIDGE_URL = "ws://127.0.0.1:7779/markers";

// Backoff schedule for auto-reconnect, in ms. We want the operator to
// notice if the bridge is genuinely down, so we don't back off forever.
const RECONNECT_DELAYS_MS = [250, 500, 1000, 2000, 4000];
const PROTOCOL_VERSION = 2;

/**
 * Hook returning a stable `pushMarker(label)` function and a connection
 * status string ("connecting" | "handshaking" | "open" | "closed" |
 * "disabled"). `open` means the bridge hello has been validated.
 *
 * Pass `{ enabled: false }` to no-op the whole thing — useful in dev /
 * standalone play when no EEG rig is hooked up.
 */
export function useLSLMarkers({
  url = DEFAULT_BRIDGE_URL,
  enabled = true,
  source = "unknown_browser_client",
} = {}) {
  const [status, setStatus] = useState(enabled ? "connecting" : "disabled");
  const [lastAck, setLastAck] = useState(null);
  const [bridgeInfo, setBridgeInfo] = useState(null);
  const [lastError, setLastError] = useState(null);

  const wsRef = useRef(null);
  const readyRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const connectRef = useRef(null);
  const enabledRef = useRef(enabled);
  const markerCounterRef = useRef(0);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

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
      console.error("[markerBridge] WebSocket constructor failed:", err);
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      readyRef.current = false;
      setStatus("handshaking");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === "hello" && msg.protocol_version === PROTOCOL_VERSION) {
          readyRef.current = true;
          setBridgeInfo(msg);
          setLastError(null);
          setStatus("open");
        } else if (msg?.type === "ack") {
          setLastAck(msg);
          if (msg.serial?.status === "failed") {
            setLastError(msg.serial.error || "Serial marker write failed");
          } else {
            setLastError(null);
          }
        } else if (msg?.type === "nack") {
          setLastAck(msg);
          setLastError(msg.error || "Marker bridge rejected an event");
        }
      } catch (err) {
        console.warn("[markerBridge] invalid bridge response:", err);
      }
    };

    ws.onerror = () => {
      // The "error" event is followed by "close"; let the close handler
      // own the reconnect logic. We just leave a breadcrumb.
      console.warn("[markerBridge] WebSocket error");
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      readyRef.current = false;
      setBridgeInfo(null);
      setStatus("closed");
      scheduleReconnect();
    };
  }, [url, scheduleReconnect]);

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
      readyRef.current = false;
      if (ws) {
        try {
          ws.onclose = null;
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
   * Returns true only when the marker envelope was queued to a live, validated
   * bridge. The later ACK distinguishes serial write success, simulation, LSL
   * push success, and a rejected event.
   */
  const pushMarker = useCallback((label) => {
    if (!enabledRef.current) return false;
    if (typeof label !== "string" || label.length === 0) {
      console.warn("[markerBridge] ignored non-string / empty label:", label);
      return false;
    }
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && readyRef.current) {
      try {
        const sequence = ++markerCounterRef.current;
        const fallbackId = `${source}_${Date.now()}_${sequence}`;
        const markerId = globalThis.crypto?.randomUUID?.() ?? fallbackId;
        ws.send(JSON.stringify({
          type: "marker",
          protocol_version: PROTOCOL_VERSION,
          id: markerId,
          source,
          label,
          client_monotonic_ms:
            typeof performance === "undefined" ? null : performance.now(),
          client_utc: new Date().toISOString(),
        }));
        return true;
      } catch (err) {
        console.error("[markerBridge] direct marker send failed:", err);
        setLastError("Could not send marker to the local bridge");
        return false;
      }
    }
    console.error("[markerBridge] marker rejected while bridge is not ready:", label);
    setLastError("Marker rejected because the local bridge is not ready");
    return false;
  }, [source]);

  return { pushMarker, status, lastAck, bridgeInfo, lastError };
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
