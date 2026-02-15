"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Script from "next/script";
import {
  Activity,
  ArrowRight,
  Bus as BusIcon,
  Clock3,
  Loader2,
  MapPin,
  Navigation2,
  RefreshCw,
  Search,
} from "lucide-react";

import { useGeolocation } from "@/hooks/useGeolocation";
import { computeETA, type RouteStopWithTrips, type ETAResult } from "@/lib/eta";

import { apiUrl } from "@/lib/api";
import {
  getSocketClientScriptUrl,
  getSocketNamespaceUrl,
  SOCKET_PATH,
} from "@/lib/realtime";

type TripTimeField = {
  hours: number;
  minutes: number;
};

type TripStopField = {
  arrivalTime?: TripTimeField;
  departureTime?: TripTimeField;
  distanceFromOrigin?: number;
};

type RouteStop = {
  city?: string;
  stopCode?: string;
  location?: {
    lat?: number;
    lng?: number;
  };
  upTrip?: TripStopField;
  downTrip?: TripStopField;
};

type TrackingBus = {
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
    <div className="grid h-full min-h-[420px] place-items-center text-sm text-slate-500">
      Loading map...
    </div>
  ),
});

const FALLBACK_CENTER = { lat: 20.5937, lng: 78.9629 };

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

const normalizeBusNumber = (value?: string | null) =>
  String(value || "")
    .trim()
    .toUpperCase();

type TrackBusViewProps = {
  embedded?: boolean;
};

const TrackBusView = ({ embedded = false }: TrackBusViewProps) => {
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<TrackingBus[]>([]);
  const [selectedBus, setSelectedBus] = useState<TrackingBus | null>(null);
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [socketStatus, setSocketStatus] = useState<
    "idle" | "connecting" | "connected" | "disconnected"
  >("idle");
  const [socketError, setSocketError] = useState<string | null>(null);
  const [socketClientReady, setSocketClientReady] = useState(false);

  // ─── live suggestion state ───
  const [suggestions, setSuggestions] = useState<TrackingBus[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  // Track whether we've already consumed the URL param to avoid re-triggering
  const initialSearchDoneRef = useRef(false);

  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const socketRef = useRef<BrowserSocket | null>(null);
  const subscribedBusRef = useRef<string | null>(null);

  const selectedBusNumber = useMemo(
    () => normalizeBusNumber(selectedBus?.busNumber),
    [selectedBus?.busNumber],
  );
  const selectedBusNumberRef = useRef(selectedBusNumber);

  useEffect(() => {
    selectedBusNumberRef.current = selectedBusNumber;
  }, [selectedBusNumber]);

  // ─── geolocation & ETA ───
  const geo = useGeolocation();

  const etaResult: ETAResult | null = useMemo(() => {
    if (!selectedBus?.route?.stops?.length) return null;
    if (!liveLocation) return null;
    if (geo.lat === null || geo.lng === null) return null;

    const stops = selectedBus.route.stops as RouteStopWithTrips[];
    return computeETA(
      { lat: liveLocation.lat, lng: liveLocation.lng },
      liveLocation.speed,
      { lat: geo.lat, lng: geo.lng },
      stops,
      "up",
    );
  }, [selectedBus, liveLocation, geo.lat, geo.lng]);

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
    if (routePoints.length) {
      return routePoints[0];
    }
    return FALLBACK_CENTER;
  }, [liveLocation, routePoints]);

  /* ─── debounced live suggestions ─── */
  const fetchSuggestions = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(
        apiUrl(`/v1/tracking/search?q=${encodeURIComponent(trimmed)}`),
        { method: "GET", cache: "no-store", signal: controller.signal },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Search failed.");

      const items: TrackingBus[] = Array.isArray(data?.data) ? data.data : [];
      setSuggestions(items);
      setShowSuggestions(true);
      setHighlightIdx(-1);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setSearchError((err as Error).message || "Search failed.");
      }
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (value.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      debounceRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, 350);
    },
    [fetchSuggestions],
  );

  const handleSelectSuggestion = useCallback((bus: TrackingBus) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedBus(bus);
    setResults([bus]);
    setQuery(bus.busName || bus.busNumber || "");
  }, []);

  /* ─── click outside to close suggestions ─── */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ─── keyboard navigation for suggestions ─── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1,
        );
      } else if (e.key === "Enter" && highlightIdx >= 0) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[highlightIdx]);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    },
    [showSuggestions, suggestions, highlightIdx, handleSelectSuggestion],
  );

  /* ─── explicit "Find" button search ─── */
  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      setSearchError("Enter bus name, number, or operator.");
      return;
    }

    setShowSuggestions(false);
    setSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(
        apiUrl(`/v1/tracking/search?q=${encodeURIComponent(q)}`),
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to search buses.");
      }

      const items = Array.isArray(data?.data) ? data.data : [];
      setResults(items);

      if (items.length > 0 && !selectedBus) {
        setSelectedBus(items[0]);
      }
    } catch (error) {
      setSearchError((error as Error).message || "Unable to search buses.");
    } finally {
      setSearching(false);
    }
  }, [query, selectedBus]);

  /* ─── cleanup debounce / abort on unmount ─── */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  /* ─── auto-fill from URL ?bus= param (hero page hand-off) ─── */
  useEffect(() => {
    if (initialSearchDoneRef.current) return;

    const busParam = searchParams.get("bus");
    if (!busParam) return;

    initialSearchDoneRef.current = true;
    const trimmed = busParam.trim();
    setQuery(trimmed);

    // Clean the URL param so refresh doesn't re-trigger
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("bus");
      window.history.replaceState(window.history.state, "", url.toString());
    }

    // Run search and auto-select the matching bus
    (async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const response = await fetch(
          apiUrl(`/v1/tracking/search?q=${encodeURIComponent(trimmed)}`),
          { method: "GET", cache: "no-store" },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || "Unable to search buses.");
        }
        const items: TrackingBus[] = Array.isArray(data?.data) ? data.data : [];
        setResults(items);

        // Auto-select: prefer exact bus-number match, otherwise first result
        const normalizedParam = normalizeBusNumber(trimmed);
        const exactMatch = items.find(
          (b) => normalizeBusNumber(b.busNumber) === normalizedParam,
        );
        if (exactMatch) {
          setSelectedBus(exactMatch);
        } else if (items.length > 0) {
          setSelectedBus(items[0]);
        }
      } catch (err) {
        setSearchError((err as Error).message || "Unable to search buses.");
      } finally {
        setSearching(false);
      }
    })();
  }, [searchParams]);

  const fetchLatest = useCallback(async (busNumber: string) => {
    setLoadingLatest(true);
    try {
      const response = await fetch(
        apiUrl(`/v1/tracking/bus/${encodeURIComponent(busNumber)}/latest`),
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to fetch live location.");
      }

      const live = data?.data?.liveLocation;
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
      } else {
        setLiveLocation(null);
      }
    } catch (error) {
      setSocketError(
        (error as Error).message || "Unable to fetch live location.",
      );
    } finally {
      setLoadingLatest(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedBusNumber) {
      setLiveLocation(null);
      return;
    }
    fetchLatest(selectedBusNumber).catch(() => {});
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
      (ack: { success: boolean; message?: string }) => {
        if (!ack?.success) {
          setSocketError(ack?.message || "Subscribe failed.");
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
      const activeBus = selectedBusNumberRef.current;
      if (activeBus) {
        subscribeToBus(activeBus);
      }
    });

    socket.on("disconnect", () => {
      setSocketStatus("disconnected");
    });

    socket.on("connect_error", (error: { message?: string }) => {
      setSocketStatus("disconnected");
      setSocketError(error?.message || "Socket connection failed.");
    });

    socket.on("tracking.location", (payload: LiveLocation) => {
      const activeBus = selectedBusNumberRef.current;
      const payloadBus = normalizeBusNumber(payload?.busNumber);
      if (!activeBus || !payloadBus || payloadBus !== activeBus) return;
      if (
        !Number.isFinite(Number(payload.lat)) ||
        !Number.isFinite(Number(payload.lng))
      ) {
        return;
      }

      setLiveLocation({
        ...payload,
        lat: Number(payload.lat),
        lng: Number(payload.lng),
      });
    });

    return () => {
      const subscribedBus = subscribedBusRef.current;
      if (subscribedBus) {
        socket.emit("tracking:unsubscribe", { busNumber: subscribedBus });
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

    const subscribedBus = subscribedBusRef.current;
    if (subscribedBus && subscribedBus !== selectedBusNumber) {
      unsubscribeFromBus(subscribedBus);
    }

    if (selectedBusNumber && subscribedBus !== selectedBusNumber) {
      subscribeToBus(selectedBusNumber);
    }
  }, [selectedBusNumber, socketStatus, subscribeToBus, unsubscribeFromBus]);

  // Polling fallback every 20s while socket is disconnected.
  useEffect(() => {
    if (!selectedBusNumber) return;
    if (socketStatus === "connected") return;

    const interval = setInterval(() => {
      fetchLatest(selectedBusNumber).catch(() => {});
    }, 20000);

    return () => clearInterval(interval);
  }, [selectedBusNumber, socketStatus, fetchLatest]);

  const socketBadgeClass =
    socketStatus === "connected"
      ? "bg-emerald-100 text-emerald-700"
      : socketStatus === "connecting"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-600";

  const shellClass = embedded
    ? "rounded-3xl border border-rose-100/80 bg-[radial-gradient(circle_at_top,_#fff1f2,_#f8fafc_40%)] px-4 pb-8 pt-6 shadow-xl shadow-rose-100/30 sm:px-6"
    : "min-h-screen bg-[radial-gradient(circle_at_top,_#fff1f2,_#f8fafc_40%)] px-4 pb-14 pt-24 sm:px-6 lg:px-8";

  return (
    <div className={shellClass}>
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
      <div className={`mx-auto ${embedded ? "max-w-full" : "max-w-7xl"}`}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-500">
              Live Tracking
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Track Your Bus in Real Time
            </h1>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${socketBadgeClass}`}
          >
            <Activity className="h-4 w-4" />
            {socketStatus.toUpperCase()}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="rounded-3xl border border-rose-100/80 bg-white/85 p-4 shadow-xl shadow-rose-100/40 backdrop-blur">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                runSearch().catch(() => {});
              }}
              className="mb-4 flex items-center gap-2"
            >
              <div className="relative flex-1" ref={searchWrapperRef}>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => handleInputChange(event.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search bus name or number"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-rose-400"
                  autoComplete="off"
                />

                {/* ─── live suggestion dropdown ─── */}
                {showSuggestions && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl shadow-black/10">
                    {searching && suggestions.length === 0 ? (
                      <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching buses…
                      </div>
                    ) : suggestions.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-500">
                        No buses found for &ldquo;{query.trim()}&rdquo;
                      </div>
                    ) : (
                      suggestions.slice(0, 8).map((bus, idx) => (
                        <button
                          key={bus._id}
                          type="button"
                          onClick={() => handleSelectSuggestion(bus)}
                          onMouseEnter={() => setHighlightIdx(idx)}
                          className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                            idx === highlightIdx
                              ? "bg-rose-50"
                              : "hover:bg-slate-50"
                          } ${idx > 0 ? "border-t border-slate-100" : ""}`}
                        >
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                              idx === highlightIdx
                                ? "bg-rose-500 text-white"
                                : "bg-rose-100 text-rose-600"
                            }`}
                          >
                            <BusIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {bus.busName || "Unnamed Bus"}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {bus.busNumber || "—"} ·{" "}
                              {bus.route?.origin && bus.route?.destination
                                ? `${bus.route.origin} → ${bus.route.destination}`
                                : "Route N/A"}
                            </p>
                          </div>
                          <ArrowRight
                            className={`h-4 w-4 shrink-0 transition ${
                              idx === highlightIdx
                                ? "text-rose-500"
                                : "text-slate-300 group-hover:text-rose-400"
                            }`}
                          />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="h-11 rounded-2xl bg-rose-500 px-4 text-sm font-semibold text-white transition hover:bg-rose-600"
                disabled={searching}
              >
                {searching ? "..." : "Find"}
              </button>
            </form>

            {searchError ? (
              <p className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {searchError}
              </p>
            ) : null}

            <div className="max-h-[580px] space-y-2 overflow-y-auto pr-1">
              {results.length === 0 && !showSuggestions ? (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  {query.trim().length > 0
                    ? "Type & click Find, or pick a suggestion above."
                    : "Search for a bus to get started."}
                </p>
              ) : results.length === 0 ? null : (
                results.map((bus) => {
                  const active = selectedBus?._id === bus._id;
                  return (
                    <button
                      key={bus._id}
                      type="button"
                      onClick={() => setSelectedBus(bus)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-rose-400 bg-rose-50"
                          : "border-slate-200 bg-white hover:border-rose-200"
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {bus.busName || "Unnamed Bus"}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                        {bus.busNumber || "NO NUMBER"}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {bus.route?.origin || "-"} to{" "}
                        {bus.route?.destination || "-"}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
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
                  Route
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {(selectedBus?.route?.origin || "-") +
                    " -> " +
                    (selectedBus?.route?.destination || "-")}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedBus?.route?.routeCode || "-"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Last Update
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDateTime(liveLocation?.recordedAt)}
                </p>
                <p className="text-xs text-slate-500">
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
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {(liveLocation?.confidence || "unknown").toUpperCase()}
                </p>
                <p
                  className={`text-xs font-semibold ${liveLocation?.isStale ? "text-amber-600" : "text-emerald-600"}`}
                >
                  {liveLocation?.isStale ? "STALE" : "LIVE"}
                </p>
              </div>
            </div>

            <div className="h-[520px] bg-slate-100">
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

            <div className="grid gap-3 border-t border-slate-200 px-5 py-4 text-xs sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Accuracy
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {liveLocation?.accuracy !== undefined &&
                  liveLocation?.accuracy !== null
                    ? `${Math.round(liveLocation.accuracy)} m`
                    : "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Speed
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {liveLocation?.speed !== undefined &&
                  liveLocation?.speed !== null
                    ? `${(Number(liveLocation.speed) * 3.6).toFixed(1)} km/h`
                    : "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Status
                </p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Clock3 className="h-4 w-4" />
                  {loadingLatest
                    ? "Refreshing..."
                    : liveLocation
                      ? "Receiving updates"
                      : "Waiting for location"}
                </p>
              </div>
            </div>

            {/* ─── ETA Card ─── */}
            {selectedBus && (
              <div className="border-t border-slate-200 px-5 py-4">
                {geo.loading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Detecting your location…
                  </div>
                ) : geo.error ? (
                  <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-amber-700">
                      <Navigation2 className="h-4 w-4" />
                      {geo.error}
                    </div>
                    <button
                      type="button"
                      onClick={geo.refresh}
                      className="rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-200"
                    >
                      <RefreshCw className="mr-1 inline h-3 w-3" />
                      Retry
                    </button>
                  </div>
                ) : etaResult ? (
                  <div className="rounded-2xl border border-emerald-200 bg-linear-to-r from-emerald-50 to-teal-50 px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            etaResult.status === "approaching"
                              ? "animate-pulse bg-emerald-500"
                              : etaResult.status === "at-stop"
                                ? "animate-ping bg-emerald-500"
                                : etaResult.status === "passed"
                                  ? "bg-slate-400"
                                  : "bg-amber-400"
                          }`}
                        />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                          Estimated Arrival
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={geo.refresh}
                        title="Refresh location"
                        className="rounded-md p-1 text-emerald-500 transition hover:bg-emerald-100"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xl font-bold text-emerald-800">
                          {etaResult.etaLabel}
                        </p>
                        <p className="mt-0.5 text-xs text-emerald-600">
                          <MapPin className="mr-1 inline h-3.5 w-3.5" />
                          {etaResult.nearestStop.city || "Nearest stop"}
                          <span className="ml-1 text-emerald-500">
                            ({etaResult.distanceToStopKm} km from you)
                          </span>
                        </p>
                      </div>
                      {etaResult.etaMinutes !== null &&
                        etaResult.etaMinutes > 0 && (
                          <p className="whitespace-nowrap text-xs font-medium text-emerald-600">
                            {(() => {
                              const now = new Date();
                              now.setMinutes(
                                now.getMinutes() + etaResult.etaMinutes!,
                              );
                              return `Arrives ~${now.toLocaleTimeString(
                                "en-IN",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}`;
                            })()}
                          </p>
                        )}
                    </div>
                  </div>
                ) : !liveLocation ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock3 className="h-4 w-4" />
                    ETA available once bus location is received.
                  </div>
                ) : null}
              </div>
            )}

            {socketError ? (
              <div className="border-t border-rose-100 bg-rose-50 px-5 py-3 text-xs font-semibold text-rose-700">
                {socketError}
              </div>
            ) : null}

            {!selectedBus ? (
              <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
                <MapPin className="mr-1 inline h-4 w-4" />
                Select a bus to start tracking.
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
};

export default TrackBusView;
