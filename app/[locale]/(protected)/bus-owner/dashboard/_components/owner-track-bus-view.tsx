"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Script from "next/script";
import {
  Activity,
  Clock3,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { apiUrl } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";
import {
  getSocketClientScriptUrl,
  getSocketNamespaceUrl,
  SOCKET_PATH,
} from "@/lib/realtime";

type RouteStop = {
  city?: string;
  location?: {
    lat?: number;
    lng?: number;
  };
};

type OwnerBusRecord = {
  _id: string;
  busId?: number;
  busName?: string;
  busNumber?: string;
  operator?: string;
  route?: {
    routeCode?: string;
    origin?: string;
    destination?: string;
    stops?: RouteStop[];
  };
  conductor?: {
    _id?: string;
    fullName?: string;
    email?: string;
    phone?: string;
  } | null;
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
    <div className="grid h-full min-h-[420px] place-items-center text-sm text-slate-500 dark:text-slate-300">
      Loading map...
    </div>
  ),
});

const FALLBACK_CENTER = { lat: 20.5937, lng: 78.9629 };

const normalizeBusNumber = (value?: string | null) =>
  String(value || "")
    .trim()
    .toUpperCase();

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

const toNumberOrNull = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const OwnerTrackBusView = () => {
  const [query, setQuery] = useState("");
  const [buses, setBuses] = useState<OwnerBusRecord[]>([]);
  const [busesLoading, setBusesLoading] = useState(false);
  const [busesError, setBusesError] = useState<string | null>(null);

  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(false);

  const [socketStatus, setSocketStatus] = useState<
    "idle" | "connecting" | "connected" | "disconnected"
  >("idle");
  const [socketError, setSocketError] = useState<string | null>(null);
  const [socketClientReady, setSocketClientReady] = useState(false);

  const socketRef = useRef<BrowserSocket | null>(null);
  const subscribedBusRef = useRef<string | null>(null);

  const getAuthHeaders = useCallback(async () => {
    const token = await firebaseAuth.currentUser
      ?.getIdToken()
      .catch(() => null);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const selectedBus = useMemo(
    () => buses.find((bus) => bus._id === selectedBusId) ?? null,
    [buses, selectedBusId],
  );

  const selectedBusNumber = useMemo(
    () => normalizeBusNumber(selectedBus?.busNumber),
    [selectedBus?.busNumber],
  );

  const selectedBusNumberRef = useRef(selectedBusNumber);

  useEffect(() => {
    selectedBusNumberRef.current = selectedBusNumber;
  }, [selectedBusNumber]);

  const filteredBuses = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return buses;

    return buses.filter((bus) => {
      const haystack = [
        bus.busName,
        bus.busNumber,
        bus.operator,
        bus.route?.routeCode,
        bus.route?.origin,
        bus.route?.destination,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [buses, query]);

  const routePoints = useMemo(() => {
    const stops = selectedBus?.route?.stops || [];
    return stops
      .map((stop) => {
        const lat = Number(stop.location?.lat);
        const lng = Number(stop.location?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
      })
      .filter(Boolean) as Array<{ lat: number; lng: number }>;
  }, [selectedBus]);

  const mapCenter = useMemo(() => {
    if (liveLocation?.lat !== undefined && liveLocation?.lng !== undefined) {
      return { lat: liveLocation.lat, lng: liveLocation.lng };
    }
    if (routePoints.length > 0) {
      return routePoints[0];
    }
    return FALLBACK_CENTER;
  }, [liveLocation, routePoints]);

  const loadOwnerBuses = useCallback(async () => {
    setBusesLoading(true);
    setBusesError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(apiUrl("/v1/telemetry/owner/buses"), {
        method: "GET",
        credentials: "include",
        headers,
        cache: "no-store",
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to load owner buses.");
      }

      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setBuses(rows);
      setSelectedBusId((previous) => {
        if (
          previous &&
          rows.some((row: OwnerBusRecord) => row._id === previous)
        ) {
          return previous;
        }
        return rows[0]?._id || null;
      });
    } catch (error) {
      setBuses([]);
      setSelectedBusId(null);
      setBusesError((error as Error).message || "Unable to load owner buses.");
    } finally {
      setBusesLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    void loadOwnerBuses();
  }, [loadOwnerBuses]);

  const fetchLatest = useCallback(
    async (busNumber: string) => {
      const normalized = normalizeBusNumber(busNumber);
      if (!normalized) {
        setLiveLocation(null);
        return;
      }

      setLoadingLatest(true);
      setSocketError(null);
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(
          apiUrl(
            `/v1/telemetry/owner/buses/${encodeURIComponent(normalized)}/latest`,
          ),
          {
            method: "GET",
            credentials: "include",
            headers,
            cache: "no-store",
          },
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to fetch live location.");
        }

        const live = payload?.data?.liveLocation;
        const lat = toNumberOrNull(live?.lat);
        const lng = toNumberOrNull(live?.lng);

        if (lat === null || lng === null) {
          setLiveLocation(null);
          return;
        }

        setLiveLocation({
          busNumber: normalizeBusNumber(live?.busNumber || normalized),
          tripKey: live?.tripKey ?? null,
          lat,
          lng,
          accuracy: toNumberOrNull(live?.accuracy),
          speed: toNumberOrNull(live?.speed),
          heading: toNumberOrNull(live?.heading),
          recordedAt: live?.recordedAt ?? null,
          ingestedAt: live?.ingestedAt ?? null,
          confidence: live?.confidence ?? "unknown",
          source: live?.source ?? null,
          ageSeconds: toNumberOrNull(live?.ageSeconds),
          isStale: Boolean(live?.isStale),
        });
        setSocketError(null);
      } catch (error) {
        setSocketError(
          (error as Error).message || "Unable to fetch live location.",
        );
      } finally {
        setLoadingLatest(false);
      }
    },
    [getAuthHeaders],
  );

  useEffect(() => {
    if (!selectedBusNumber) {
      setLiveLocation(null);
      return;
    }

    void fetchLatest(selectedBusNumber);
  }, [selectedBusNumber, fetchLatest]);

  const unsubscribeFromBus = useCallback((busNumber: string) => {
    const normalized = normalizeBusNumber(busNumber);
    if (!normalized) return;

    socketRef.current?.emit("tracking:unsubscribe", { busNumber: normalized });
    if (subscribedBusRef.current === normalized) {
      subscribedBusRef.current = null;
    }
  }, []);

  const subscribeToBus = useCallback((busNumber: string) => {
    const normalized = normalizeBusNumber(busNumber);
    if (!normalized || !socketRef.current) return;

    socketRef.current.emit(
      "tracking:subscribe",
      { busNumber: normalized },
      (ack: unknown) => {
        const payload = ack as { success?: boolean; message?: string };
        if (!payload?.success) {
          setSocketError(payload?.message || "Subscribe failed.");
          return;
        }
        subscribedBusRef.current = normalized;
      },
    );
  }, []);

  useEffect(() => {
    if (!socketClientReady) return;
    if (typeof window === "undefined" || typeof window.io !== "function")
      return;

    setSocketStatus("connecting");
    setSocketError(null);

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
      setSocketError(null);
      const activeBusNumber = selectedBusNumberRef.current;
      if (activeBusNumber) {
        subscribeToBus(activeBusNumber);
      }
    });

    socket.on("disconnect", () => {
      setSocketStatus("disconnected");
    });

    socket.on("connect_error", (error: unknown) => {
      const err = error as { message?: string };
      setSocketStatus("disconnected");
      setSocketError(err?.message || "Socket connection failed.");
    });

    socket.on("tracking.location", (payload: unknown) => {
      const livePayload = payload as LiveLocation;
      const activeBusNumber = selectedBusNumberRef.current;
      const payloadBusNumber = normalizeBusNumber(livePayload?.busNumber);
      if (!activeBusNumber || payloadBusNumber !== activeBusNumber) {
        return;
      }

      const lat = toNumberOrNull(livePayload?.lat);
      const lng = toNumberOrNull(livePayload?.lng);
      if (lat === null || lng === null) {
        return;
      }

      setLiveLocation({
        ...livePayload,
        lat,
        lng,
      });
    });

    return () => {
      const subscribedBusNumber = subscribedBusRef.current;
      if (subscribedBusNumber) {
        socket.emit("tracking:unsubscribe", { busNumber: subscribedBusNumber });
        subscribedBusRef.current = null;
      }

      socket.removeAllListeners?.();
      socket.disconnect();
      socketRef.current = null;
      setSocketStatus("idle");
    };
  }, [socketClientReady, subscribeToBus]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || socketStatus !== "connected") return;

    const subscribedBusNumber = subscribedBusRef.current;
    if (subscribedBusNumber && subscribedBusNumber !== selectedBusNumber) {
      unsubscribeFromBus(subscribedBusNumber);
    }

    if (selectedBusNumber && subscribedBusNumber !== selectedBusNumber) {
      subscribeToBus(selectedBusNumber);
    }
  }, [selectedBusNumber, socketStatus, subscribeToBus, unsubscribeFromBus]);

  useEffect(() => {
    if (!selectedBusNumber) return;
    if (socketStatus === "connected") return;

    const timer = setInterval(() => {
      void fetchLatest(selectedBusNumber);
    }, 20000);

    return () => clearInterval(timer);
  }, [fetchLatest, selectedBusNumber, socketStatus]);

  const socketBadgeClass =
    socketStatus === "connected"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
      : socketStatus === "connecting"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        : "border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200";

  const fleetCount = buses.length;
  const activeBusLabel = selectedBus?.busName || selectedBus?.busNumber || "-";

  return (
    <div className="space-y-6">
      <Script
        src={getSocketClientScriptUrl()}
        strategy="afterInteractive"
        onLoad={() => setSocketClientReady(true)}
        onError={() =>
          setSocketError(
            "Unable to load realtime client script. Polling fallback active.",
          )
        }
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Owner Fleet Operations
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">
            Track Your Buses In Real Time
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
            View live location only for buses owned by your account.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${socketBadgeClass}`}
          >
            <Activity className="h-4 w-4" />
            {socketStatus.toUpperCase()}
          </span>
          <button
            type="button"
            onClick={() => void loadOwnerBuses()}
            disabled={busesLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
          >
            {busesLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh Fleet
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Owner Buses
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {fleetCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Eligible for realtime tracking
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Selected Bus
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
            {activeBusLabel}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {selectedBus?.route?.origin || "-"} to{" "}
            {selectedBus?.route?.destination || "-"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Last Update
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
            {formatDateTime(liveLocation?.recordedAt)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {liveLocation?.ageSeconds !== undefined &&
            liveLocation?.ageSeconds !== null
              ? `${liveLocation.ageSeconds}s ago`
              : "No location yet"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="mb-4">
            <label
              htmlFor="owner-track-bus-filter"
              className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400"
            >
              Search Owner Buses
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="owner-track-bus-filter"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Bus name, number, route"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
              />
            </div>
          </div>

          {busesError ? (
            <p className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              {busesError}
            </p>
          ) : null}

          <div className="max-h-[590px] space-y-2 overflow-y-auto pr-1">
            {busesLoading ? (
              <div className="grid min-h-36 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading buses...
                </span>
              </div>
            ) : filteredBuses.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-300">
                No owner buses found.
              </p>
            ) : (
              filteredBuses.map((bus) => {
                const active = selectedBus?._id === bus._id;
                return (
                  <button
                    key={bus._id}
                    type="button"
                    onClick={() => setSelectedBusId(bus._id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-slate-300 bg-slate-100 dark:border-white/20 dark:bg-white/10"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-[#0f172a] dark:hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {bus.busName || "Unnamed Bus"}
                      </p>
                      {bus.conductor ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200">
                          <UserRound className="h-3 w-3" />
                          Assigned
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                      {bus.busNumber || "NO NUMBER"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                      {bus.route?.origin || "-"} to{" "}
                      {bus.route?.destination || "-"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f172a]">
          <div className="grid gap-4 border-b border-slate-200 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Bus
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {selectedBus?.busName || "-"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedBus?.busNumber || "-"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Route
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {(selectedBus?.route?.origin || "-") +
                  " -> " +
                  (selectedBus?.route?.destination || "-")}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedBus?.route?.routeCode || "-"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Last Update
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {formatDateTime(liveLocation?.recordedAt)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {liveLocation?.ageSeconds !== undefined &&
                liveLocation?.ageSeconds !== null
                  ? `${liveLocation.ageSeconds}s ago`
                  : "No live data"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Confidence
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {(liveLocation?.confidence || "unknown").toUpperCase()}
              </p>
              <p
                className={`text-xs font-semibold ${
                  liveLocation?.isStale
                    ? "text-amber-600 dark:text-amber-300"
                    : "text-emerald-600 dark:text-emerald-300"
                }`}
              >
                {liveLocation?.isStale ? "STALE" : "LIVE"}
              </p>
            </div>
          </div>

          <div className="h-[520px] bg-slate-100 dark:bg-[#111827]">
            <LiveMap
              center={mapCenter}
              marker={
                liveLocation
                  ? { lat: liveLocation.lat, lng: liveLocation.lng }
                  : null
              }
              route={routePoints}
              zoom={liveLocation ? 14 : 11}
            />
          </div>

          <div className="grid gap-3 border-t border-slate-200 px-5 py-4 text-xs sm:grid-cols-4 dark:border-white/10">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                Accuracy
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {liveLocation?.accuracy !== undefined &&
                liveLocation?.accuracy !== null
                  ? `${Math.round(liveLocation.accuracy)} m`
                  : "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                Speed
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {liveLocation?.speed !== undefined &&
                liveLocation?.speed !== null
                  ? `${(Number(liveLocation.speed) * 3.6).toFixed(1)} km/h`
                  : "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                Direction
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {liveLocation?.heading !== undefined &&
                liveLocation?.heading !== null
                  ? `${Math.round(Number(liveLocation.heading))}°`
                  : "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                Status
              </p>
              <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Clock3 className="h-4 w-4" />
                {loadingLatest
                  ? "Refreshing..."
                  : liveLocation
                    ? "Receiving updates"
                    : "Waiting"}
              </p>
            </div>
          </div>

          {socketError ? (
            <div className="border-t border-rose-100 bg-rose-50 px-5 py-3 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {socketError}
            </div>
          ) : null}

          {!selectedBus ? (
            <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-300">
              <ShieldCheck className="mr-1 inline h-4 w-4" />
              Select one of your buses to start tracking.
            </div>
          ) : null}

          {!selectedBus && busesLoading ? (
            <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-300">
              <MapPin className="mr-1 inline h-4 w-4" />
              Fetching owner fleet...
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default OwnerTrackBusView;
