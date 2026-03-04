"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  Route,
  Shield,
  ToggleLeft,
  ToggleRight,
  Wifi,
  Zap,
} from "lucide-react";

import { apiUrl } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";

/* ───────────────────── Types ───────────────────── */

type TimeObj = { hours: number; minutes: number };

type RouteStop = {
  city: string;
  stopCode?: string;
  location?: { lat: number; lng: number };
  upTrip?: {
    arrivalTime: TimeObj;
    departureTime: TimeObj;
    distanceFromOrigin: number;
  };
  downTrip?: {
    arrivalTime: TimeObj;
    departureTime: TimeObj;
    distanceFromOrigin: number;
  };
};

type BusRoute = {
  routeCode: string;
  origin: string;
  destination: string;
  distance: number;
  duration?: TimeObj;
  stops: RouteStop[];
};

type BusAmenities = {
  ac?: boolean;
  wifi?: boolean;
  chargingPoints?: boolean;
  toilet?: boolean;
  waterBottle?: boolean;
  blanket?: boolean;
  entertainment?: boolean;
};

type BusFeatures = {
  busType?: string;
  deckCount?: number;
  gpsTracking?: boolean;
  emergencyExit?: boolean;
  cctv?: boolean;
  wheelchairAccessible?: boolean;
};

type BusData = {
  _id: string;
  busId: number;
  busName: string;
  busNumber: string;
  operator: string;
  totalSeats: number;
  farePerKm: number;
  model?: string;
  year?: number;
  ratings?: number;
  isActive?: boolean;
  isInactiveToday?: boolean;
  amenities?: BusAmenities;
  features?: BusFeatures;
  route?: BusRoute;
  operatingDays?: string[];
  inactiveDates?: string[];
  forwardTrip?: { departureTime: TimeObj; arrivalTime: TimeObj };
  returnTrip?: { departureTime: TimeObj; arrivalTime: TimeObj };
  insurance?: { provider?: string; policyNumber?: string; expiry?: string };
};

type Assignment = {
  _id: string;
  busName?: string;
  busNumber?: string;
  operator?: string;
  route?: { routeCode?: string; origin?: string; destination?: string };
  inactiveDates?: string[];
};

/* ───────────────────── Helpers ───────────────────── */

const formatTime = (t?: TimeObj) => {
  if (!t || typeof t.hours !== "number") return "-";
  const h = t.hours % 12 || 12;
  const period = t.hours >= 12 ? "PM" : "AM";
  return `${h}:${String(t.minutes).padStart(2, "0")} ${period}`;
};

const formatDuration = (t?: TimeObj) => {
  if (!t) return "-";
  return `${t.hours}h ${t.minutes}m`;
};

const todayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const AMENITY_CONFIG: {
  key: keyof BusAmenities;
  label: string;
  icon: string;
}[] = [
  { key: "ac", label: "AC", icon: "❄️" },
  { key: "wifi", label: "WiFi", icon: "📶" },
  { key: "chargingPoints", label: "Charging", icon: "🔌" },
  { key: "toilet", label: "Toilet", icon: "🚻" },
  { key: "waterBottle", label: "Water", icon: "💧" },
  { key: "blanket", label: "Blanket", icon: "🛏️" },
  { key: "entertainment", label: "Entertainment", icon: "🎬" },
];

const OPERATING_DAYS_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/* ───────────────────── Calendar ───────────────────── */

type CalendarProps = {
  month: number;
  year: number;
  inactiveDates: Set<string>;
  togglingDate: string | null;
  onToggle: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

const InactiveCalendar = ({
  month,
  year,
  inactiveDates,
  togglingDate,
  onToggle,
  onPrevMonth,
  onNextMonth,
}: CalendarProps) => {
  const today = todayStr();

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      result.push(dateStr);
    }
    return result;
  }, [month, year]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold text-slate-800">
          {MONTH_NAMES[month]} {year}
        </h3>
        <button
          type="button"
          onClick={onNextMonth}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400"
          >
            {d}
          </div>
        ))}
        {cells.map((dateStr, idx) => {
          if (!dateStr) {
            return <div key={`empty-${idx}`} className="h-10" />;
          }
          const isInactive = inactiveDates.has(dateStr);
          const isToday = dateStr === today;
          const isToggling = togglingDate === dateStr;
          const isPast = dateStr < today;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => !isPast && onToggle(dateStr)}
              disabled={isPast || isToggling}
              title={
                isPast
                  ? "Past date"
                  : isInactive
                    ? "Click to reactivate"
                    : "Click to mark inactive"
              }
              className={`
                relative flex h-10 items-center justify-center rounded-xl text-xs font-semibold transition-all duration-200
                ${
                  isPast
                    ? "cursor-not-allowed text-slate-300"
                    : isInactive
                      ? "border-2 border-rose-300 bg-rose-100 text-rose-700 shadow-sm hover:bg-rose-200"
                      : "border border-slate-200/80 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                }
                ${isToday ? "ring-2 ring-blue-400 ring-offset-1" : ""}
                ${isToggling ? "animate-pulse" : ""}
              `}
            >
              {isToggling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                parseInt(dateStr.slice(-2), 10)
              )}
              {isInactive && !isToggling ? (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-rose-300 bg-rose-100" />
          Inactive
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-slate-200 bg-white" />
          Active
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-400 ring-1 ring-blue-300 ring-offset-1" />
          Today
        </span>
      </div>
    </div>
  );
};

/* ───────────────────── Main Page ───────────────────── */

const ManageBusPage = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedBusId, setSelectedBusId] = useState("");
  const [busDetail, setBusDetail] = useState<BusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingDate, setTogglingDate] = useState<string | null>(null);
  const [toggleSuccess, setToggleSuccess] = useState<string | null>(null);

  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());

  const inactiveDatesSet = useMemo(
    () => new Set(busDetail?.inactiveDates || []),
    [busDetail?.inactiveDates],
  );

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

  /* ── Load assignments ── */
  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await buildHeaders();
      const res = await fetch(apiUrl("/v1/telemetry/assignments"), {
        credentials: "include",
        headers,
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.message || "Failed to load assignments");
      const rows: Assignment[] = Array.isArray(data?.data) ? data.data : [];
      setAssignments(rows);
      setSelectedBusId((prev) => {
        if (rows.length === 0) return "";
        if (prev && rows.some((r) => r._id === prev)) return prev;
        return rows[0]._id;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [buildHeaders]);

  /* ── Load bus details ── */
  const loadBusDetail = useCallback(
    async (busId: string) => {
      if (!busId) return;
      setDetailLoading(true);
      setError(null);
      try {
        const headers = await buildHeaders();
        const res = await fetch(
          apiUrl(`/v1/telemetry/conductor/buses/${busId}/details`),
          {
            credentials: "include",
            headers,
            cache: "no-store",
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data?.message || "Failed to load bus details");
        setBusDetail(data?.data || null);
      } catch (e) {
        setError((e as Error).message);
        setBusDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [buildHeaders],
  );

  /* ── Toggle inactive date ── */
  const handleToggleDate = useCallback(
    async (dateStr: string) => {
      if (!selectedBusId || togglingDate) return;
      const isCurrentlyInactive = inactiveDatesSet.has(dateStr);
      setTogglingDate(dateStr);
      setToggleSuccess(null);
      setError(null);
      try {
        const headers = await buildHeaders();
        const res = await fetch(
          apiUrl(
            `/v1/telemetry/conductor/buses/${selectedBusId}/inactive-date`,
          ),
          {
            method: "PATCH",
            credentials: "include",
            headers,
            body: JSON.stringify({
              date: dateStr,
              active: isCurrentlyInactive,
            }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Failed to toggle date");
        // Update local state
        setBusDetail((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            inactiveDates: data?.data?.inactiveDates || prev.inactiveDates,
            isInactiveToday:
              dateStr === todayStr()
                ? !isCurrentlyInactive
                  ? false
                  : true
                : prev.isInactiveToday,
          };
        });
        setToggleSuccess(
          isCurrentlyInactive
            ? `Bus reactivated for ${dateStr}`
            : `Bus marked inactive for ${dateStr}`,
        );
        setTimeout(() => setToggleSuccess(null), 3000);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setTogglingDate(null);
      }
    },
    [selectedBusId, togglingDate, inactiveDatesSet, buildHeaders],
  );

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    if (selectedBusId) loadBusDetail(selectedBusId);
  }, [selectedBusId, loadBusDetail]);

  const bus = busDetail;
  const activeAmenities = AMENITY_CONFIG.filter((a) => bus?.amenities?.[a.key]);
  const operatingDaysSorted = (bus?.operatingDays || []).sort(
    (a, b) => OPERATING_DAYS_ORDER.indexOf(a) - OPERATING_DAYS_ORDER.indexOf(b),
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fee2e2,_#f8fafc_45%)]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* ───── Header ───── */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-500">
              Conductor Console
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Manage Bus
            </h1>
          </div>
          <button
            type="button"
            onClick={() => loadAssignments()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* ───── Bus selector ───── */}
        {assignments.length > 1 ? (
          <div className="mb-6">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Select Bus
            </label>
            <select
              value={selectedBusId}
              onChange={(e) => setSelectedBusId(e.target.value)}
              className="h-11 w-full max-w-md rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-rose-400"
            >
              {assignments.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.busName || "Unnamed"} ({a.busNumber || "-"})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* ───── Error / Success banners ───── */}
        {error ? (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}
        {toggleSuccess ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition-all duration-300">
            {toggleSuccess}
          </div>
        ) : null}

        {/* ───── Loading skeleton ───── */}
        {(detailLoading || loading) && !bus ? (
          <div className="grid min-h-[40vh] place-items-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
              <p className="text-sm font-semibold text-slate-500">
                Loading bus details...
              </p>
            </div>
          </div>
        ) : null}

        {/* ───── No assignments ───── */}
        {!loading && assignments.length === 0 ? (
          <div className="grid min-h-[40vh] place-items-center rounded-3xl border border-slate-200/80 bg-white/90 shadow-xl shadow-rose-100/40 backdrop-blur">
            <div className="text-center">
              <Bus className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">
                No buses assigned to you yet.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Contact your bus owner or admin to assign a bus.
              </p>
            </div>
          </div>
        ) : null}

        {/* ───── Bus details ───── */}
        {bus ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* ── Left column: Bus info ── */}
            <div className="space-y-6">
              {/* Status banner */}
              <div
                className={`flex items-center gap-3 rounded-3xl border px-5 py-4 shadow-lg backdrop-blur transition-all duration-300 ${
                  bus.isInactiveToday
                    ? "border-rose-200 bg-rose-50/90 shadow-rose-100/40"
                    : "border-emerald-200 bg-emerald-50/90 shadow-emerald-100/40"
                }`}
              >
                {bus.isInactiveToday ? (
                  <ToggleLeft className="h-6 w-6 text-rose-500" />
                ) : (
                  <ToggleRight className="h-6 w-6 text-emerald-500" />
                )}
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {bus.isInactiveToday ? "Inactive Today" : "Active Today"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {bus.isInactiveToday
                      ? "This bus is hidden from ticket search and tracking today."
                      : "This bus is visible in ticket search and tracking."}
                  </p>
                </div>
              </div>

              {/* Bus identity card */}
              <div className="rounded-3xl border border-rose-100/80 bg-white/90 p-6 shadow-xl shadow-rose-100/40 backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Bus Identity
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {bus.busName}
                    </h2>
                    <p className="text-sm font-semibold text-slate-500">
                      {bus.busNumber}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-2xl bg-slate-900 p-3 shadow-lg shadow-slate-900/30">
                    <Bus className="h-6 w-6 text-white" />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoCell label="Operator" value={bus.operator} />
                  <InfoCell
                    label="Bus Type"
                    value={bus.features?.busType || "-"}
                  />
                  <InfoCell
                    label="Total Seats"
                    value={String(bus.totalSeats)}
                  />
                  <InfoCell
                    label="Fare / km"
                    value={`₹${bus.farePerKm?.toFixed(2)}`}
                  />
                  <InfoCell
                    label="Deck Count"
                    value={String(bus.features?.deckCount || 1)}
                  />
                  <InfoCell
                    label="Rating"
                    value={
                      bus.ratings
                        ? `${bus.ratings.toFixed(1)} ⭐`
                        : "No ratings"
                    }
                  />
                  {bus.model ? (
                    <InfoCell label="Model" value={bus.model} />
                  ) : null}
                  {bus.year ? (
                    <InfoCell label="Year" value={String(bus.year)} />
                  ) : null}
                </div>
              </div>

              {/* Route info */}
              {bus.route ? (
                <div className="rounded-3xl border border-rose-100/80 bg-white/90 p-6 shadow-xl shadow-rose-100/40 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-rose-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Route Information
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-900">
                      {bus.route.origin}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="text-lg font-bold text-slate-900">
                      {bus.route.destination}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {bus.route.routeCode}
                    </span>
                    <span className="flex items-center gap-1">
                      <Route className="h-3 w-3" />
                      {bus.route.distance?.toFixed(1)} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(bus.route.duration)}
                    </span>
                  </div>

                  {/* Trip timings */}
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Forward Trip
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {formatTime(bus.forwardTrip?.departureTime)} →{" "}
                        {formatTime(bus.forwardTrip?.arrivalTime)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Return Trip
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {formatTime(bus.returnTrip?.departureTime)} →{" "}
                        {formatTime(bus.returnTrip?.arrivalTime)}
                      </p>
                    </div>
                  </div>

                  {/* Stops */}
                  {bus.route.stops?.length > 0 ? (
                    <div className="mt-5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Stops ({bus.route.stops.length})
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {bus.route.stops.map((stop, i) => (
                          <span
                            key={stop.stopCode || i}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600"
                          >
                            <MapPin className="h-3 w-3 text-rose-400" />
                            {stop.city}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Amenities + Features + Operating Days */}
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Amenities */}
                <div className="rounded-3xl border border-rose-100/80 bg-white/90 p-5 shadow-xl shadow-rose-100/40 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-rose-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Amenities
                    </p>
                  </div>
                  {activeAmenities.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeAmenities.map((a) => (
                        <span
                          key={a.key}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                        >
                          <span>{a.icon}</span>
                          {a.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-400">
                      No amenities listed.
                    </p>
                  )}
                </div>

                {/* Features */}
                <div className="rounded-3xl border border-rose-100/80 bg-white/90 p-5 shadow-xl shadow-rose-100/40 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-rose-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Safety & Features
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bus.features?.gpsTracking ? (
                      <FeatureBadge label="GPS Tracking" />
                    ) : null}
                    {bus.features?.emergencyExit ? (
                      <FeatureBadge label="Emergency Exit" />
                    ) : null}
                    {bus.features?.cctv ? <FeatureBadge label="CCTV" /> : null}
                    {bus.features?.wheelchairAccessible ? (
                      <FeatureBadge label="Wheelchair" />
                    ) : null}
                    {!bus.features?.gpsTracking &&
                    !bus.features?.emergencyExit &&
                    !bus.features?.cctv &&
                    !bus.features?.wheelchairAccessible ? (
                      <p className="text-xs text-slate-400">
                        No features listed.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Operating Days */}
              <div className="rounded-3xl border border-rose-100/80 bg-white/90 p-5 shadow-xl shadow-rose-100/40 backdrop-blur">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-rose-500" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Operating Days
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {OPERATING_DAYS_ORDER.map((day) => {
                    const isActive = operatingDaysSorted.includes(day);
                    return (
                      <span
                        key={day}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          isActive
                            ? "border-slate-300 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-300"
                        }`}
                      >
                        {day.slice(0, 3)}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Right column: Calendar ── */}
            <aside className="space-y-6">
              <div className="sticky top-28 space-y-6">
                <div className="rounded-3xl border border-rose-100/80 bg-white/90 p-5 shadow-xl shadow-rose-100/40 backdrop-blur">
                  <div className="mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-rose-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Inactive Schedule
                    </p>
                  </div>
                  <p className="mb-4 text-xs text-slate-500">
                    Click on a date to toggle the bus inactive/active for that
                    day. Inactive buses are hidden from ticket search and
                    tracking.
                  </p>
                  <InactiveCalendar
                    month={calMonth}
                    year={calYear}
                    inactiveDates={inactiveDatesSet}
                    togglingDate={togglingDate}
                    onToggle={handleToggleDate}
                    onPrevMonth={() => {
                      if (calMonth === 0) {
                        setCalMonth(11);
                        setCalYear((y) => y - 1);
                      } else {
                        setCalMonth((m) => m - 1);
                      }
                    }}
                    onNextMonth={() => {
                      if (calMonth === 11) {
                        setCalMonth(0);
                        setCalYear((y) => y + 1);
                      } else {
                        setCalMonth((m) => m + 1);
                      }
                    }}
                  />
                </div>

                {/* Summary stats */}
                <div className="rounded-3xl border border-rose-100/80 bg-white/90 p-5 shadow-xl shadow-rose-100/40 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Inactive Dates Summary
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {inactiveDatesSet.size}
                  </p>
                  <p className="text-xs text-slate-500">
                    {inactiveDatesSet.size === 0
                      ? "No scheduled inactive dates"
                      : inactiveDatesSet.size === 1
                        ? "1 date marked inactive"
                        : `${inactiveDatesSet.size} dates marked inactive`}
                  </p>
                  {inactiveDatesSet.size > 0 ? (
                    <div className="mt-3 max-h-32 space-y-1 overflow-y-auto">
                      {Array.from(inactiveDatesSet)
                        .sort()
                        .map((d) => (
                          <div
                            key={d}
                            className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs"
                          >
                            <span className="font-semibold text-rose-700">
                              {d}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleDate(d)}
                              disabled={togglingDate === d || d < todayStr()}
                              className="text-[10px] font-bold uppercase tracking-wider text-rose-500 transition hover:text-rose-700 disabled:opacity-40"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/* ───────────────────── Sub‑components ───────────────────── */

const InfoCell = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
  </div>
);

const FeatureBadge = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
    <Zap className="h-3 w-3" />
    {label}
  </span>
);

export default ManageBusPage;
