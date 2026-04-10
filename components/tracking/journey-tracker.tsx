"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Script from "next/script";
import {
  Activity,
  ArrowLeft,
  Bus as BusIcon,
  CheckCircle2,
  Circle,
  Clock3,
  Loader2,
  MapPin,
  Navigation2,
  Timer,
} from "lucide-react";

import { computeETA, type RouteStopWithTrips, type ETAResult } from "@/lib/eta";
import { apiFetch } from "@/lib/api";
import {
  getSocketClientScriptUrl,
  getSocketNamespaceUrl,
  SOCKET_PATH,
} from "@/lib/realtime";
import type { MapMarker } from "@/components/tracking/live-map";

// ─── types ───────────────────────────────────────────────────────────

type TripTime = { hours: number; minutes: number };

type JourneyStop = {
  city: string | null;
  stopCode: string | null;
  lat: number | null;
  lng: number | null;
  arrivalTime: TripTime | null;
  departureTime: TripTime | null;
  distanceFromOrigin: number | null;
};

type JourneyTrackingData = {
  bookingId: string;
  busNumber: string;
  busName: string;
  busId: number;
  operator: string;
  features: Record<string, unknown> | null;
  direction: string;
  boardingPoint: string;
  droppingPoint: string;
  travelDate: string;
  departureTime: TripTime | null;
  arrivalTime: TripTime | null;
  segmentDurationMinutes: number | null;
  routeOrigin: string | null;
  routeDestination: string | null;
  routeDistance: number | null;
  routeStops: JourneyStop[];
};

type LiveLocation = {
  busNumber: string;
  tripKey?: string | null;
  lat: number;
  lng: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  recordedAt?: string | null;
  ingestedAt?: string | null;
  confidence?: string | null;
  source?: string | null;
  ageSeconds?: number | null;
  isStale?: boolean;
};

type BrowserSocket = {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  emit: (
    event: string,
    payload?: unknown,
    callback?: (...args: unknown[]) => void,
  ) => void;
  removeAllListeners?: () => void;
  disconnect: () => void;
};

declare global {
  interface Window {
    io?: (url: string, options?: Record<string, unknown>) => BrowserSocket;
  }
}

const LiveMap = dynamic(() => import("@/components/tracking/live-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[420px] place-items-center text-sm text-slate-500 dark:text-slate-400">
      Loading map...
    </div>
  ),
});

const FALLBACK_CENTER = { lat: 20.5937, lng: 78.9629 };

// ─── helpers ─────────────────────────────────────────────────────────

const normalizeBusNumber = (value?: string | null) =>
  String(value || "")
    .trim()
    .toUpperCase();

const formatClock = (t?: TripTime | null) => {
  if (!t) return "--:--";
  const h = t.hours % 12 || 12;
  const m = String(t.minutes).padStart(2, "0");
  const ampm = t.hours >= 12 ? "PM" : "AM";
  return `${h}:${m} ${ampm}`;
};

const normalizeCityToken = (v: string | null | undefined) =>
  String(v || "")
    .trim()
    .toLowerCase();

const formatDuration = (mins: number | null | undefined) => {
  if (mins == null || !Number.isFinite(mins)) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const formatSpeed = (speedMs: number | null | undefined) => {
  if (speedMs == null || !Number.isFinite(speedMs)) return null;
  return `${Math.round(speedMs * 3.6)} km/h`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

// ─── component ───────────────────────────────────────────────────────

type JourneyTrackerProps = {
  bookingId: string;
};

const JourneyTracker = ({ bookingId }: JourneyTrackerProps) => {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<JourneyTrackingData | null>(null);
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [socketStatus, setSocketStatus] = useState<
    "idle" | "connecting" | "connected" | "disconnected"
  >("idle");
  const [socketClientReady, setSocketClientReady] = useState(false);

  const socketRef = useRef<BrowserSocket | null>(null);
  const subscribedBusRef = useRef<string | null>(null);

  const busNumber = useMemo(
    () => normalizeBusNumber(data?.busNumber),
    [data?.busNumber],
  );
  const busNumberRef = useRef(busNumber);
  useEffect(() => {
    busNumberRef.current = busNumber;
  }, [busNumber]);

  // ─── geolocation (reserved for ETA from user's own position) ───
  // const geo = useGeolocation();

  // ─── auth helper ───
  const getAuthHeaders = useCallback(async (): Promise<
    Record<string, string>
  > => {
    const { firebaseAuth } = await import("@/lib/firebase/client");
    const user = firebaseAuth.currentUser;
    if (!user) return {} as Record<string, string>;
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }, []);

  // ─── fetch journey data ───
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(
          `/mybookings/${encodeURIComponent(bookingId)}/journey-tracking`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to load journey data.");
        }
        if (!cancelled) {
          setData(payload.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || "Unable to load journey data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [bookingId, getAuthHeaders]);

  // ─── fetch latest bus location ───
  const fetchLatest = useCallback(async (bn: string) => {
    try {
      const response = await apiFetch(
        `/v1/tracking/bus/${encodeURIComponent(bn)}/latest`,
        { method: "GET", cache: "no-store" },
      );
      const payload = await response.json().catch(() => ({}));
      const live = payload?.data?.liveLocation;
      if (
        live &&
        Number.isFinite(Number(live.lat)) &&
        Number.isFinite(Number(live.lng))
      ) {
        setLiveLocation({
          ...live,
          lat: Number(live.lat),
          lng: Number(live.lng),
        });
      }
    } catch {
      // silent
    }
  }, []);

  // Fetch on bus number resolved
  useEffect(() => {
    if (!busNumber) return;
    fetchLatest(busNumber).catch(() => {});
  }, [busNumber, fetchLatest]);

  // ─── Socket.IO ───
  useEffect(() => {
    if (!socketClientReady) return;
    if (typeof window === "undefined" || typeof window.io !== "function")
      return;

    setSocketStatus("connecting");
    const socket = window.io(getSocketNamespaceUrl("/tracking"), {
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      withCredentials: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketStatus("connected");
      const active = busNumberRef.current;
      if (active) {
        socket.emit("tracking:subscribe", { busNumber: active });
        subscribedBusRef.current = active;
      }
    });

    socket.on("disconnect", () => setSocketStatus("disconnected"));
    socket.on("connect_error", () => setSocketStatus("disconnected"));

    socket.on("tracking.location", (payload: unknown) => {
      const loc = payload as LiveLocation;
      const active = busNumberRef.current;
      const payloadBus = normalizeBusNumber(loc?.busNumber);
      if (!active || !payloadBus || payloadBus !== active) return;
      if (
        !Number.isFinite(Number(loc.lat)) ||
        !Number.isFinite(Number(loc.lng))
      ) {
        return;
      }
      setLiveLocation({
        ...loc,
        lat: Number(loc.lat),
        lng: Number(loc.lng),
      });
    });

    return () => {
      const sub = subscribedBusRef.current;
      if (sub) {
        socket.emit("tracking:unsubscribe", { busNumber: sub });
        subscribedBusRef.current = null;
      }
      socket.removeAllListeners?.();
      socket.disconnect();
      socketRef.current = null;
      setSocketStatus("idle");
    };
  }, [socketClientReady]);

  // Subscribe to correct bus when busNumber changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || socketStatus !== "connected") return;

    const sub = subscribedBusRef.current;
    if (sub && sub !== busNumber) {
      socket.emit("tracking:unsubscribe", { busNumber: sub });
    }
    if (busNumber && sub !== busNumber) {
      socket.emit("tracking:subscribe", { busNumber });
      subscribedBusRef.current = busNumber;
    }
  }, [busNumber, socketStatus]);

  // Polling fallback
  useEffect(() => {
    if (!busNumber) return;
    if (socketStatus === "connected") return;
    const interval = setInterval(() => {
      fetchLatest(busNumber).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [busNumber, socketStatus, fetchLatest]);

  // ─── ETA computation ───
  const etaResult: ETAResult | null = useMemo(() => {
    if (!data?.routeStops?.length) return null;
    if (!liveLocation) return null;

    // Build stops in the shape computeETA expects
    const boardingToken = normalizeCityToken(data.droppingPoint);
    const droppingStop = data.routeStops.find(
      (s) => normalizeCityToken(s.city) === boardingToken,
    );

    if (!droppingStop || droppingStop.lat == null || droppingStop.lng == null)
      return null;

    // Use dropping point as the "user location" for ETA to destination
    const stopsForETA: RouteStopWithTrips[] = data.routeStops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        city: s.city || "",
        location: { lat: s.lat!, lng: s.lng! },
        upTrip: s.arrivalTime
          ? {
              arrivalTime: s.arrivalTime,
              departureTime: s.departureTime || s.arrivalTime,
              distanceFromOrigin: s.distanceFromOrigin ?? undefined,
            }
          : undefined,
        downTrip: s.arrivalTime
          ? {
              arrivalTime: s.arrivalTime,
              departureTime: s.departureTime || s.arrivalTime,
              distanceFromOrigin: s.distanceFromOrigin ?? undefined,
            }
          : undefined,
      }));

    const direction =
      data.direction === "return" ? ("down" as const) : ("up" as const);

    return computeETA(
      { lat: liveLocation.lat, lng: liveLocation.lng },
      liveLocation.speed,
      { lat: droppingStop.lat, lng: droppingStop.lng },
      stopsForETA,
      direction,
    );
  }, [data, liveLocation]);

  // ─── map data ───
  const routePoints = useMemo(() => {
    if (!data?.routeStops) return [];
    return data.routeStops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({ lat: s.lat!, lng: s.lng! }));
  }, [data]);

  const mapMarkers = useMemo(() => {
    if (!data?.routeStops) return [];
    const markers: MapMarker[] = [];
    const boardingToken = normalizeCityToken(data.boardingPoint);
    const droppingToken = normalizeCityToken(data.droppingPoint);

    for (const stop of data.routeStops) {
      if (stop.lat == null || stop.lng == null) continue;
      const token = normalizeCityToken(stop.city);
      if (token === boardingToken) {
        markers.push({
          position: { lat: stop.lat, lng: stop.lng },
          type: "boarding",
          label: `🟢 ${stop.city} (Boarding Point)`,
        });
      } else if (token === droppingToken) {
        markers.push({
          position: { lat: stop.lat, lng: stop.lng },
          type: "dropping",
          label: `🔴 ${stop.city} (Dropping Point)`,
        });
      } else {
        markers.push({
          position: { lat: stop.lat, lng: stop.lng },
          type: "stop",
          label: stop.city || "Stop",
        });
      }
    }

    // Bus live marker
    if (liveLocation) {
      markers.push({
        position: { lat: liveLocation.lat, lng: liveLocation.lng },
        type: "bus",
        label: `${data.busName || "Bus"} — Live`,
        pulse: true,
        heading: liveLocation.heading,
      });
    }

    return markers;
  }, [data, liveLocation]);

  const mapCenter = useMemo(() => {
    if (liveLocation) return { lat: liveLocation.lat, lng: liveLocation.lng };
    if (routePoints.length > 0) return routePoints[0];
    return FALLBACK_CENTER;
  }, [liveLocation, routePoints]);

  // ─── timeline: determine bus progress ───
  const busProgressIndex = useMemo(() => {
    if (!data?.routeStops?.length || !liveLocation) return -1;
    // Find the nearest stop to bus
    let minDist = Infinity;
    let minIdx = -1;
    for (let i = 0; i < data.routeStops.length; i++) {
      const s = data.routeStops[i];
      if (s.lat == null || s.lng == null) continue;
      const dlat = s.lat - liveLocation.lat;
      const dlng = s.lng - liveLocation.lng;
      const dist = dlat * dlat + dlng * dlng;
      if (dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    }
    return minIdx;
  }, [data, liveLocation]);

  // ─── connection badge ───
  const socketBadge =
    socketStatus === "connected"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : socketStatus === "connecting"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";

  // ─── RENDER ───
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#0b1120]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-indigo-400/30" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-300/40 dark:shadow-indigo-900/40">
              <BusIcon className="h-6 w-6 text-white" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Loading journey data
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Preparing your live tracking view...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-[#0b1120]">
        <div className="w-full max-w-sm rounded-3xl border border-rose-200/80 bg-white p-8 text-center shadow-xl dark:border-rose-500/20 dark:bg-[#141c2e]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/15">
            <MapPin className="h-6 w-6 text-rose-500" />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
            {error || "Unable to load journey tracking data."}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Please check your booking ID or try again later.
          </p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-200/50 transition-all hover:shadow-xl hover:shadow-rose-300/50 active:scale-[0.97] dark:shadow-none"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-[#0b1120] dark:via-[#0f172a] dark:to-[#0b1120]">
      <Script
        src={getSocketClientScriptUrl()}
        strategy="afterInteractive"
        onLoad={() => setSocketClientReady(true)}
      />

      {/* ─── Route Header Bar ─── */}
      <div
        className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#0f172a]/80"
        style={{ paddingTop: "80px" }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BusIcon className="h-4 w-4 shrink-0 text-indigo-500" />
              <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base dark:text-white">
                {data.boardingPoint} → {data.droppingPoint}
              </h1>
            </div>
            <p className="truncate text-[11px] text-slate-400 sm:text-xs dark:text-slate-500">
              {data.busName} • {data.busNumber} • {data.bookingId}
            </p>
          </div>

          {/* Live badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sm:px-3 sm:text-xs ${socketBadge}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${socketStatus === "connected" ? "animate-pulse bg-emerald-400" : socketStatus === "connecting" ? "animate-pulse bg-amber-400" : "bg-slate-400"}`}
            />
            <span className="hidden sm:inline">
              {socketStatus === "connected"
                ? "LIVE"
                : socketStatus.toUpperCase()}
            </span>
            <Activity className="h-3 w-3 sm:hidden" />
          </span>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          {/* ─── Map Column ─── */}
          <div className="w-full lg:flex-1 lg:min-w-0">
            <div className="relative z-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/40 dark:border-white/[0.08] dark:bg-[#141c2e] dark:shadow-none">
              <div className="relative h-[40vh] min-h-[280px] sm:h-[50vh] sm:min-h-[350px] lg:h-[calc(100vh-200px)] lg:min-h-[500px]">
                <LiveMap
                  center={mapCenter}
                  route={routePoints}
                  markers={mapMarkers}
                  fitBounds={!liveLocation}
                  routeColor="#6366f1"
                  zoom={12}
                />
              </div>
            </div>
          </div>

          {/* ─── Info Panel ─── */}
          <div className="w-full shrink-0 lg:w-[360px] xl:w-[380px]">
            <div className="flex flex-col gap-4">
              {/* ── ETA Card ── */}
              <div className="relative overflow-hidden rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 p-5 text-white shadow-xl shadow-indigo-300/30 dark:border-indigo-400/10 dark:shadow-indigo-950/40 sm:p-6">
                {/* Decorative circles */}
                <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/[0.06]" />
                <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/[0.04]" />

                <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200/80 sm:text-xs">
                  Estimated Arrival
                </p>
                {liveLocation ? (
                  <>
                    <p className="relative mt-1.5 text-3xl font-extrabold tracking-tight sm:mt-2 sm:text-4xl">
                      {etaResult?.etaMinutes != null
                        ? formatDuration(etaResult.etaMinutes)
                        : "Calculating..."}
                    </p>
                    <p className="relative mt-1 text-xs text-indigo-200/90 sm:text-sm">
                      {etaResult?.etaLabel || `to ${data.droppingPoint}`}
                    </p>
                    <div className="relative mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
                      <div className="rounded-xl bg-white/[0.12] px-3 py-2.5 backdrop-blur-sm">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-200/70 sm:text-[10px]">
                          Distance
                        </p>
                        <p className="mt-0.5 text-sm font-bold sm:text-base">
                          {etaResult?.distanceToStopKm != null
                            ? `${etaResult.distanceToStopKm.toFixed(1)} km`
                            : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/[0.12] px-3 py-2.5 backdrop-blur-sm">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-200/70 sm:text-[10px]">
                          Speed
                        </p>
                        <p className="mt-0.5 text-sm font-bold sm:text-base">
                          {formatSpeed(liveLocation.speed) || "—"}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="relative mt-4 flex items-center gap-2.5 rounded-xl bg-white/[0.08] px-4 py-3 text-sm text-indigo-200/90">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting for live bus location...
                  </div>
                )}
              </div>

              {/* ── Journey Details Card ── */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#141c2e] sm:p-5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 sm:text-xs">
                  Journey Details
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:gap-y-4">
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 sm:text-xs">
                      Departure
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                      {formatClock(data.departureTime)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 sm:text-xs">
                      Arrival
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                      {formatClock(data.arrivalTime)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 sm:text-xs">
                      Duration
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                      {formatDuration(data.segmentDurationMinutes)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 sm:text-xs">
                      Last Update
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                      {liveLocation
                        ? formatDateTime(liveLocation.recordedAt)
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Route Timeline ── */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#141c2e] sm:p-5">
                <p className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 sm:text-xs">
                  <Navigation2 className="h-3.5 w-3.5" />
                  Route ({data.routeStops.length} stops)
                </p>
                <div className="max-h-[300px] space-y-0 overflow-y-auto pr-1 scrollbar-thin sm:max-h-[360px]">
                  {data.routeStops.map((stop, idx) => {
                    const isBoarding =
                      normalizeCityToken(stop.city) ===
                      normalizeCityToken(data.boardingPoint);
                    const isDropping =
                      normalizeCityToken(stop.city) ===
                      normalizeCityToken(data.droppingPoint);
                    const isPassed =
                      busProgressIndex >= 0 && idx < busProgressIndex;
                    const isCurrent =
                      busProgressIndex >= 0 && idx === busProgressIndex;
                    const isLast = idx === data.routeStops.length - 1;

                    return (
                      <div
                        key={`${stop.city}-${idx}`}
                        className="relative flex gap-3"
                      >
                        {/* Vertical line */}
                        {!isLast && (
                          <div
                            className={`absolute left-[11px] top-6 h-full w-0.5 ${
                              isPassed
                                ? "bg-emerald-400 dark:bg-emerald-500/60"
                                : "bg-slate-200 dark:bg-slate-700/60"
                            }`}
                          />
                        )}

                        {/* Circle / Icon */}
                        <div className="relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center">
                          {isBoarding ? (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-200/50 dark:shadow-emerald-900/40">
                              <MapPin className="h-3.5 w-3.5" />
                            </div>
                          ) : isDropping ? (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-md shadow-rose-200/50 dark:shadow-rose-900/40">
                              <MapPin className="h-3.5 w-3.5" />
                            </div>
                          ) : isCurrent ? (
                            <div className="flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-indigo-500 text-white shadow-md shadow-indigo-300/50 ring-[3px] ring-indigo-200/60 dark:ring-indigo-500/25 dark:shadow-indigo-900/40">
                              <BusIcon className="h-3 w-3" />
                            </div>
                          ) : isPassed ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                          )}
                        </div>

                        {/* Label */}
                        <div
                          className={`min-w-0 pb-4 ${isCurrent ? "pt-0" : ""}`}
                        >
                          <p
                            className={`truncate text-sm font-semibold ${
                              isBoarding
                                ? "text-emerald-600 dark:text-emerald-400"
                                : isDropping
                                  ? "text-rose-600 dark:text-rose-400"
                                  : isCurrent
                                    ? "text-indigo-600 dark:text-indigo-400"
                                    : isPassed
                                      ? "text-slate-400 dark:text-slate-500"
                                      : "text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {stop.city || "Unknown Stop"}
                            {isBoarding && (
                              <span className="ml-1.5 inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 sm:ml-2">
                                Board
                              </span>
                            )}
                            {isDropping && (
                              <span className="ml-1.5 inline-block rounded-full bg-rose-100 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 sm:ml-2">
                                Drop
                              </span>
                            )}
                            {isCurrent && (
                              <span className="ml-1.5 inline-block rounded-full bg-indigo-100 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 sm:ml-2">
                                Bus here
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 sm:text-xs">
                            <Clock3 className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {formatClock(stop.arrivalTime)}
                              {stop.departureTime &&
                              stop.departureTime !== stop.arrivalTime
                                ? ` — ${formatClock(stop.departureTime)}`
                                : ""}
                            </span>
                          </p>
                          {stop.distanceFromOrigin != null && (
                            <p className="mt-0.5 text-[10px] text-slate-400/80 dark:text-slate-600">
                              {stop.distanceFromOrigin.toFixed(1)} km from
                              origin
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Status Footer ── */}
              {liveLocation && (
                <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 px-3.5 py-2.5 backdrop-blur-sm dark:border-white/[0.05] dark:bg-white/[0.03]">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
                    <Timer className="h-3 w-3 shrink-0" />
                    <span>
                      Updated{" "}
                      {liveLocation.ageSeconds != null
                        ? `${liveLocation.ageSeconds}s ago`
                        : formatDateTime(liveLocation.recordedAt)}
                    </span>
                    {liveLocation.confidence && (
                      <span className="ml-auto rounded-full bg-slate-200/80 px-2 py-0.5 text-[9px] font-bold dark:bg-slate-700/80">
                        {liveLocation.confidence}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JourneyTracker;
