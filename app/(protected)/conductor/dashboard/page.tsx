"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CloudUpload,
  Locate,
  Navigation,
  Play,
  RefreshCw,
  Square,
  WifiOff,
} from "lucide-react";

import { apiUrl } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";

type Assignment = {
  _id: string;
  busName?: string;
  busNumber?: string;
  operator?: string;
  route?: {
    routeCode?: string;
    origin?: string;
    destination?: string;
  };
};

type QueuePoint = {
  busNumber: string;
  seq: number;
  lat: number;
  lng: number;
  ts: number;
  acc?: number | null;
  spd?: number | null;
  hdg?: number | null;
};

type LocationPoint = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  capturedAt: string;
};

const LiveMap = dynamic(() => import("@/components/tracking/live-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[420px] place-items-center text-sm text-slate-500">
      Loading map...
    </div>
  ),
});

const QUEUE_KEY = "tracking_queue_v1";
const DEVICE_ID_KEY = "tracking_device_id_v1";
const BATCH_SIZE = 20;
const MIN_INTERVAL_MS = 5000;
const MIN_DISTANCE_METERS = 15;

const FALLBACK_CENTER = { lat: 20.5937, lng: 78.9629 };

const toRad = (value: number) => (value * Math.PI) / 180;

const distanceMeters = (
  first: { lat: number; lng: number },
  second: { lat: number; lng: number },
) => {
  const earthRadius = 6371000;
  const dLat = toRad(second.lat - first.lat);
  const dLng = toRad(second.lng - first.lng);
  const lat1 = toRad(first.lat);
  const lat2 = toRad(second.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return earthRadius * c;
};

const readQueue = (): QueuePoint[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (points: QueuePoint[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(points));
};

const getSeqKey = (busNumber: string) =>
  `tracking_seq_${String(busNumber).trim().toUpperCase()}`;

const nextSequence = (busNumber: string) => {
  if (typeof window === "undefined") return Date.now();
  const key = getSeqKey(busNumber);
  const current = Number(window.localStorage.getItem(key) || 0);
  const next = Number.isFinite(current) ? current + 1 : Date.now();
  window.localStorage.setItem(key, String(next));
  return next;
};

const getDeviceId = () => {
  if (typeof window === "undefined") return "web-conductor";
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  window.localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const ConductorDashboardPage = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  const [selectedBusNumber, setSelectedBusNumber] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [retryDelayMs, setRetryDelayMs] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(
    null,
  );

  const watchIdRef = useRef<number | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushingRef = useRef(false);
  const backoffRef = useRef(1000);
  const lastCapturedRef = useRef<{
    lat: number;
    lng: number;
    ts: number;
  } | null>(null);

  const selectedBus = useMemo(
    () =>
      assignments.find((item) => item.busNumber === selectedBusNumber) || null,
    [assignments, selectedBusNumber],
  );

  const mapCenter = useMemo(() => {
    if (currentLocation) {
      return { lat: currentLocation.lat, lng: currentLocation.lng };
    }
    return FALLBACK_CENTER;
  }, [currentLocation]);

  const buildHeaders = useCallback(async () => {
    const token = await firebaseAuth.currentUser
      ?.getIdToken()
      .catch(() => null);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, []);

  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    setAssignmentsError(null);

    try {
      const headers = await buildHeaders();
      const response = await fetch(apiUrl("/v1/telemetry/assignments"), {
        method: "GET",
        credentials: "include",
        headers,
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to load assigned buses.");
      }

      const rows = Array.isArray(data?.data) ? data.data : [];
      setAssignments(rows);
      setSelectedBusNumber((current) => {
        if (rows.length === 0) return "";
        if (
          current &&
          rows.some((item: Assignment) => item.busNumber === current)
        ) {
          return current;
        }
        return String(rows[0].busNumber || "");
      });
    } catch (error) {
      setAssignmentsError(
        (error as Error).message || "Unable to load assignments.",
      );
    } finally {
      setAssignmentsLoading(false);
    }
  }, [buildHeaders]);

  const updateQueueCount = useCallback(() => {
    const queue = readQueue();
    setQueueCount(queue.length);
  }, []);

  const scheduleRetry = useCallback((callback: () => void) => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }
    const delay = Math.min(backoffRef.current, 30000);
    setRetryDelayMs(delay);
    retryTimerRef.current = setTimeout(() => {
      setRetryDelayMs(0);
      callback();
    }, delay);
    backoffRef.current = Math.min(backoffRef.current * 2, 30000);
  }, []);

  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;

    const queue = readQueue();
    if (queue.length === 0) {
      setQueueCount(0);
      return;
    }

    flushingRef.current = true;
    setSending(true);
    setLastError(null);

    try {
      const first = queue[0];
      const targetBus = first.busNumber;
      const batch = queue
        .filter((point) => point.busNumber === targetBus)
        .slice(0, BATCH_SIZE);

      const payload = {
        busNumber: targetBus,
        deviceId: getDeviceId(),
        seq: batch[0]?.seq,
        points: batch.map((point) => ({
          lat: point.lat,
          lng: point.lng,
          ts: point.ts,
          acc: point.acc,
          spd: point.spd,
          hdg: point.hdg,
          seq: point.seq,
        })),
      };

      const headers = await buildHeaders();
      const response = await fetch(apiUrl("/v1/telemetry/location"), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 429) {
        setLastError("Rate limited by server. Retrying with backoff.");
        scheduleRetry(() => {
          flushQueue().catch(() => {});
        });
        return;
      }

      if (!response.ok) {
        throw new Error(data?.message || "Failed to send telemetry batch.");
      }

      const sentKeys = new Set(
        batch.map((point) => `${point.busNumber}:${point.seq}`),
      );
      const remaining = queue.filter(
        (point) => !sentKeys.has(`${point.busNumber}:${point.seq}`),
      );
      writeQueue(remaining);
      setQueueCount(remaining.length);
      setLastSentAt(new Date().toISOString());
      setRetryDelayMs(0);
      backoffRef.current = 1000;

      if (remaining.length > 0) {
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
        }
        flushTimerRef.current = setTimeout(() => {
          flushQueue().catch(() => {});
        }, 250);
      }
    } catch (error) {
      setLastError((error as Error).message || "Telemetry upload failed.");
      scheduleRetry(() => {
        flushQueue().catch(() => {});
      });
    } finally {
      setSending(false);
      flushingRef.current = false;
    }
  }, [buildHeaders, scheduleRetry]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(() => {
    if (!selectedBusNumber) {
      setLastError("Select an assigned bus first.");
      return;
    }

    if (!("geolocation" in navigator)) {
      setLastError("Geolocation is not available in this browser.");
      return;
    }

    setLastError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const tsMs = position.timestamp || Date.now();

        const nowPoint = { lat, lng, ts: tsMs };
        const previous = lastCapturedRef.current;

        const enoughTime = !previous || tsMs - previous.ts >= MIN_INTERVAL_MS;
        const enoughDistance =
          !previous ||
          distanceMeters(
            { lat: previous.lat, lng: previous.lng },
            { lat, lng },
          ) >= MIN_DISTANCE_METERS;

        setCurrentLocation({
          lat,
          lng,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          capturedAt: new Date(tsMs).toISOString(),
        });

        if (!enoughTime && !enoughDistance) return;

        const point: QueuePoint = {
          busNumber: selectedBusNumber,
          seq: nextSequence(selectedBusNumber),
          lat,
          lng,
          ts: Math.floor(tsMs / 1000),
          acc: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
          spd: Number.isFinite(position.coords.speed)
            ? position.coords.speed
            : null,
          hdg: Number.isFinite(position.coords.heading)
            ? position.coords.heading
            : null,
        };

        const queue = readQueue();
        queue.push(point);
        writeQueue(queue);
        setQueueCount(queue.length);
        lastCapturedRef.current = nowPoint;

        flushQueue().catch(() => {});
      },
      (error) => {
        setLastError(error.message || "Unable to read location.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      },
    );

    setIsTracking(true);
  }, [flushQueue, selectedBusNumber]);

  useEffect(() => {
    loadAssignments().catch(() => {});
    updateQueueCount();
  }, [loadAssignments, updateQueueCount]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isTracking) return;
      flushQueue().catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [isTracking, flushQueue]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadAssignments().catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, [loadAssignments]);

  useEffect(() => {
    return () => {
      stopTracking();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [stopTracking]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fee2e2,_#f8fafc_45%)]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-500">
              Conductor Console
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Real-time Telemetry Uplink
            </h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow">
            <Activity className="h-4 w-4" />
            {isTracking ? "TRACKING ON" : "TRACKING OFF"}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-4 rounded-3xl border border-rose-100/80 bg-white/90 p-4 shadow-xl shadow-rose-100/40 backdrop-blur">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Assigned Bus
                </label>
                <button
                  type="button"
                  onClick={() => loadAssignments().catch(() => {})}
                  disabled={assignmentsLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>
              <select
                value={selectedBusNumber}
                onChange={(event) => setSelectedBusNumber(event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-rose-400"
                disabled={assignmentsLoading}
              >
                {assignments.length === 0 ? (
                  <option value="">No assignments</option>
                ) : (
                  assignments.map((assignment) => (
                    <option
                      key={assignment._id}
                      value={assignment.busNumber || ""}
                    >
                      {assignment.busName || "Unnamed"} (
                      {assignment.busNumber || "-"})
                    </option>
                  ))
                )}
              </select>
              {assignmentsError ? (
                <p className="mt-2 text-xs font-semibold text-rose-600">
                  {assignmentsError}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                Route
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {(selectedBus?.route?.origin || "-") +
                  " -> " +
                  (selectedBus?.route?.destination || "-")}
              </p>
              <p className="text-xs text-slate-500">
                {selectedBus?.route?.routeCode || "-"}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button
                type="button"
                onClick={startTracking}
                disabled={isTracking || !selectedBusNumber}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Play className="h-4 w-4" />
                Start
              </button>
              <button
                type="button"
                onClick={stopTracking}
                disabled={!isTracking}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs">
                <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Queue
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {queueCount}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs">
                <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Upload
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {sending ? "Sending..." : "Idle"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs">
                <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Last Sent
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDateTime(lastSentAt)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs">
                <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Retry In
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {retryDelayMs > 0
                    ? `${Math.ceil(retryDelayMs / 1000)}s`
                    : "-"}
                </p>
              </div>
            </div>

            {lastError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                <AlertTriangle className="mr-1 inline h-4 w-4" />
                {lastError}
              </div>
            ) : null}
          </aside>

          <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/60">
            <div className="grid gap-4 border-b border-slate-200 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Bus
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedBus?.busName || "-"}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedBus?.busNumber || "-"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Operator
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedBus?.operator || "-"}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedBus?.route?.routeCode || "-"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Live Coordinates
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {currentLocation
                    ? `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`
                    : "-"}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDateTime(currentLocation?.capturedAt)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Status
                </p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {isTracking ? (
                    <Locate className="h-4 w-4" />
                  ) : (
                    <WifiOff className="h-4 w-4" />
                  )}
                  {isTracking ? "Capturing" : "Stopped"}
                </p>
                <p className="text-xs text-slate-500">
                  {sending ? "Uploading telemetry" : "Awaiting updates"}
                </p>
              </div>
            </div>

            <div className="h-[520px] bg-slate-100">
              <LiveMap
                center={mapCenter}
                marker={
                  currentLocation
                    ? { lat: currentLocation.lat, lng: currentLocation.lng }
                    : null
                }
                route={[]}
                zoom={currentLocation ? 15 : 10}
              />
            </div>

            <div className="grid gap-3 border-t border-slate-200 px-5 py-4 text-xs sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Accuracy
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {currentLocation?.accuracy
                    ? `${Math.round(currentLocation.accuracy)} m`
                    : "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Speed
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {currentLocation?.speed
                    ? `${(currentLocation.speed * 3.6).toFixed(1)} km/h`
                    : "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Direction
                </p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Navigation className="h-4 w-4" />
                  {currentLocation?.heading !== undefined &&
                  currentLocation?.heading !== null
                    ? `${Math.round(currentLocation.heading)}°`
                    : "-"}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
              <CloudUpload className="mr-1 inline h-4 w-4" />
              Telemetry is sent in reliable HTTPS batches with offline queue +
              retry.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ConductorDashboardPage;
