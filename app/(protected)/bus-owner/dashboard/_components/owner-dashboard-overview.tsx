"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bus,
  Gauge,
  Loader2,
  MapPinned,
  MessageSquareText,
  RefreshCw,
  Route,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";

import { apiUrl } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

type OwnerBusRecord = {
  _id: string;
  busName?: string | null;
  busNumber?: string | null;
  operator?: string | null;
  totalSeats?: number;
  availableSeats?: number;
  isActive?: boolean;
  route?: {
    routeCode?: string | null;
    origin?: string | null;
    destination?: string | null;
  } | null;
};

type OwnerOperationalBus = {
  _id: string;
  busName?: string;
  busNumber?: string;
  route?: {
    routeCode?: string;
    origin?: string;
    destination?: string;
  };
  conductor?: {
    _id?: string;
    fullName?: string;
    email?: string;
    isActive?: boolean;
    isBlocked?: boolean;
  } | null;
};

type ConductorRecord = {
  _id: string;
  fullName?: string;
  email?: string;
  isActive?: boolean;
  isBlocked?: boolean;
  assignedBusCount?: number;
};

type OwnerReviewStats = {
  avgRating?: number;
  totalReviews?: number;
  distribution?: Record<string, number>;
};

type OwnerBusSummary = {
  busId: string;
  busName?: string | null;
  busNumber?: string | null;
  avgRating?: number;
  reviewCount?: number;
};

const MAX_PAGE_FETCH = 30;
const OWNER_BASE_PATH = "/bus-owner/dashboard";

const formatSyncTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const percent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const getBusLabel = (bus?: { busName?: string | null; busNumber?: string | null }) =>
  `${bus?.busName || "Unnamed bus"} (${bus?.busNumber || "-"})`;

const getRouteLabel = (bus?: {
  route?: {
    origin?: string | null;
    destination?: string | null;
  } | null;
}) => `${bus?.route?.origin || "-"} -> ${bus?.route?.destination || "-"}`;

export default function OwnerDashboardOverview() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const [allBuses, setAllBuses] = useState<OwnerBusRecord[]>([]);
  const [operationalBuses, setOperationalBuses] = useState<OwnerOperationalBus[]>([]);
  const [conductors, setConductors] = useState<ConductorRecord[]>([]);
  const [reviewStats, setReviewStats] = useState<OwnerReviewStats>({});
  const [reviewBusSummaries, setReviewBusSummaries] = useState<OwnerBusSummary[]>([]);

  const buildHeaders = useCallback(async () => {
    const token = await firebaseAuth.currentUser?.getIdToken().catch(() => null);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const fetchJson = useCallback(
    async (path: string) => {
      const headers = await buildHeaders();
      const response = await fetch(apiUrl(path), {
        method: "GET",
        credentials: "include",
        headers,
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || `Request failed for ${path}`);
      }
      return payload;
    },
    [buildHeaders],
  );

  const fetchAllOwnerBuses = useCallback(async () => {
    const records: OwnerBusRecord[] = [];
    let page = 1;
    let totalPages = 1;
    let loops = 0;

    while (loops < MAX_PAGE_FETCH && page <= totalPages) {
      const payload = await fetchJson(`/admin/buses?page=${page}&limit=100`);
      const data = payload?.data ?? {};
      const rows = Array.isArray(data?.buses) ? data.buses : [];
      records.push(...rows);
      totalPages = Math.max(1, Number(data?.totalPages || 1));
      const hasNext = Boolean(data?.hasNext) || page < totalPages;
      if (!hasNext) break;
      page += 1;
      loops += 1;
    }

    const dedupe = new Map<string, OwnerBusRecord>();
    records.forEach((row) => {
      if (!row?._id) return;
      dedupe.set(row._id, row);
    });
    return Array.from(dedupe.values());
  }, [fetchJson]);

  const fetchAllOwnerConductors = useCallback(async () => {
    const records: ConductorRecord[] = [];
    let page = 1;
    let totalPages = 1;
    let loops = 0;

    while (loops < MAX_PAGE_FETCH && page <= totalPages) {
      const payload = await fetchJson(
        `/v1/telemetry/owner/conductors?page=${page}&limit=100`,
      );
      const data = payload?.data ?? {};
      const rows = Array.isArray(data?.conductors) ? data.conductors : [];
      records.push(...rows);
      totalPages = Math.max(1, Number(data?.totalPages || 1));
      const hasNext = Boolean(data?.hasNext) || page < totalPages;
      if (!hasNext) break;
      page += 1;
      loops += 1;
    }

    const dedupe = new Map<string, ConductorRecord>();
    records.forEach((row) => {
      if (!row?._id) return;
      dedupe.set(row._id, row);
    });
    return Array.from(dedupe.values());
  }, [fetchJson]);

  const loadDashboard = useCallback(
    async (options?: { background?: boolean }) => {
      const background = Boolean(options?.background);
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [busResult, operationalResult, conductorResult, reviewResult] =
          await Promise.allSettled([
            fetchAllOwnerBuses(),
            fetchJson("/v1/telemetry/owner/buses"),
            fetchAllOwnerConductors(),
            fetchJson("/api/reviews/owner/overview?page=1&limit=10"),
          ]);

        const failedModules: string[] = [];
        let hasSuccessfulModule = false;

        if (busResult.status === "fulfilled") {
          setAllBuses(busResult.value);
          hasSuccessfulModule = true;
        } else {
          failedModules.push("fleet");
        }

        if (operationalResult.status === "fulfilled") {
          setOperationalBuses(
            Array.isArray(operationalResult.value?.data)
              ? operationalResult.value.data
              : [],
          );
          hasSuccessfulModule = true;
        } else {
          failedModules.push("operations");
        }

        if (conductorResult.status === "fulfilled") {
          setConductors(conductorResult.value);
          hasSuccessfulModule = true;
        } else {
          failedModules.push("conductors");
        }

        if (reviewResult.status === "fulfilled") {
          setReviewStats(reviewResult.value?.data?.stats || {});
          setReviewBusSummaries(
            Array.isArray(reviewResult.value?.data?.busSummaries)
              ? reviewResult.value.data.busSummaries
              : [],
          );
          hasSuccessfulModule = true;
        } else {
          failedModules.push("reviews");
        }

        if (hasSuccessfulModule) {
          setLastSync(new Date().toISOString());
        }

        if (failedModules.length > 0) {
          setError(
            `Some modules are unavailable right now: ${failedModules.join(
              ", ",
            )}. Data shown may be partial.`,
          );
        }
      } catch (requestError) {
        setError(
          (requestError as Error).message || "Unable to load owner dashboard.",
        );
      } finally {
        if (background) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [fetchAllOwnerBuses, fetchAllOwnerConductors, fetchJson],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadDashboard({ background: true });
    }, 30000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadDashboard]);

  const operationalMap = useMemo(() => {
    const map = new Map<string, OwnerOperationalBus>();
    operationalBuses.forEach((bus) => {
      if (!bus?._id) return;
      map.set(bus._id, bus);
    });
    return map;
  }, [operationalBuses]);

  const reviewBusSummaryMap = useMemo(() => {
    const map = new Map<string, OwnerBusSummary>();
    reviewBusSummaries.forEach((summary) => {
      if (!summary?.busId) return;
      map.set(summary.busId, summary);
    });
    return map;
  }, [reviewBusSummaries]);

  const totalBuses = allBuses.length;
  const activeBuses = allBuses.filter((bus) => bus.isActive === true).length;
  const inactiveBuses = Math.max(totalBuses - activeBuses, 0);

  const totalSeats = allBuses.reduce(
    (sum, bus) => sum + Number(bus.totalSeats || 0),
    0,
  );
  const availableSeats = allBuses.reduce(
    (sum, bus) => sum + Number(bus.availableSeats || 0),
    0,
  );
  const occupiedSeats = Math.max(totalSeats - availableSeats, 0);
  const seatOccupancyRate = totalSeats > 0 ? (occupiedSeats / totalSeats) * 100 : 0;

  const assignedActiveBuses = operationalBuses.filter(
    (bus) => Boolean(bus?.conductor?._id),
  ).length;
  const assignmentCoverage =
    activeBuses > 0 ? (assignedActiveBuses / activeBuses) * 100 : 0;
  const unassignedActiveBuses = Math.max(activeBuses - assignedActiveBuses, 0);

  const totalConductors = conductors.length;
  const activeConductors = conductors.filter(
    (conductor) => conductor.isActive === true && conductor.isBlocked !== true,
  ).length;
  const blockedConductors = conductors.filter(
    (conductor) => conductor.isBlocked === true,
  ).length;
  const unassignedConductors = conductors.filter(
    (conductor) => Number(conductor.assignedBusCount || 0) === 0,
  ).length;

  const uniqueOperators = new Set(
    allBuses
      .map((bus) => String(bus.operator || "").trim())
      .filter((operator) => operator.length > 0),
  ).size;
  const uniqueRoutes = new Set(
    allBuses
      .map((bus) => {
        if (bus.route?.routeCode) return `CODE:${bus.route.routeCode}`;
        const origin = String(bus.route?.origin || "").trim();
        const destination = String(bus.route?.destination || "").trim();
        const hasStops = origin.length > 0 || destination.length > 0;
        return hasStops ? `PAIR:${origin}::${destination}` : "";
      })
      .filter((token) => token.length > 0),
  ).size;

  const avgRating = Number(reviewStats.avgRating || 0);
  const totalReviews = Number(reviewStats.totalReviews || 0);
  const zeroReviewBuses = allBuses.filter((bus) => {
    const summary = reviewBusSummaryMap.get(bus._id);
    return Number(summary?.reviewCount || 0) === 0;
  }).length;

  const topRatedBuses = useMemo(
    () =>
      [...reviewBusSummaries]
        .filter((summary) => Number(summary.reviewCount || 0) > 0)
        .sort((first, second) => {
          const ratingDelta =
            Number(second.avgRating || 0) - Number(first.avgRating || 0);
          if (ratingDelta !== 0) return ratingDelta;
          return Number(second.reviewCount || 0) - Number(first.reviewCount || 0);
        })
        .slice(0, 5),
    [reviewBusSummaries],
  );

  const ratingDistribution = useMemo(() => {
    const distribution = reviewStats.distribution || {};
    return [5, 4, 3, 2, 1].map((stars) => {
      const count = Number(distribution[String(stars)] || 0);
      const ratio = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
      return {
        stars,
        count,
        ratio,
      };
    });
  }, [reviewStats.distribution, totalReviews]);

  const spotlightBuses = useMemo(
    () =>
      [...allBuses]
        .sort((first, second) => {
          if (Boolean(second.isActive) !== Boolean(first.isActive)) {
            return second.isActive ? 1 : -1;
          }
          return String(first.busName || "").localeCompare(String(second.busName || ""));
        })
        .slice(0, 8),
    [allBuses],
  );

  if (loading && allBuses.length === 0) {
    return (
      <div className="grid min-h-[45vh] place-items-center rounded-3xl border border-slate-200/80 bg-white/80 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading owner dashboard...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Owner Command Center
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Fleet Overview & Insights
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Unified view of fleet performance, conductor health, and customer sentiment.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDashboard({ background: true })}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-sky-200/80 bg-sky-50 px-4 py-3 dark:border-sky-500/30 dark:bg-sky-500/10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
            Fleet Size
          </p>
          <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-sky-800 dark:text-sky-200">
            <Bus className="h-5 w-5" />
            {totalBuses}
          </p>
          <p className="mt-1 text-xs text-sky-700/80 dark:text-sky-200/80">
            {activeBuses} active / {inactiveBuses} inactive
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50 px-4 py-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">
            Conductors
          </p>
          <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-indigo-800 dark:text-indigo-200">
            <Users className="h-5 w-5" />
            {totalConductors}
          </p>
          <p className="mt-1 text-xs text-indigo-700/80 dark:text-indigo-200/80">
            {activeConductors} active, {blockedConductors} blocked
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
            Customer Rating
          </p>
          <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-amber-800 dark:text-amber-200">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            {avgRating.toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/80">
            {totalReviews} total reviews
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            Seat Occupancy
          </p>
          <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-emerald-800 dark:text-emerald-200">
            <Gauge className="h-5 w-5" />
            {percent(seatOccupancyRate).toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-200/80">
            {occupiedSeats} occupied / {totalSeats} total
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900/70">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Operational Health
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Fleet & Assignment Coverage
              </h2>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Last sync: {formatSyncTime(lastSync)}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Active Fleet Ratio</span>
                <span>{totalBuses > 0 ? ((activeBuses / totalBuses) * 100).toFixed(1) : "0.0"}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className="h-2 rounded-full bg-sky-500"
                  style={{
                    width: `${percent(totalBuses > 0 ? (activeBuses / totalBuses) * 100 : 0)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Conductor Assignment Coverage</span>
                <span>{percent(assignmentCoverage).toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${percent(assignmentCoverage)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Conductor Availability</span>
                <span>
                  {totalConductors > 0
                    ? ((activeConductors / totalConductors) * 100).toFixed(1)
                    : "0.0"}
                  %
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{
                    width: `${percent(
                      totalConductors > 0 ? (activeConductors / totalConductors) * 100 : 0,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Operators
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {uniqueOperators}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Routes
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {uniqueRoutes}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Unassigned Buses
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {unassignedActiveBuses}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Top Rated Buses
            </p>
            {topRatedBuses.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Ratings will appear after your buses receive reviews.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {topRatedBuses.map((bus) => (
                  <div
                    key={bus.busId}
                    className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/40 dark:bg-amber-500/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-amber-800 dark:text-amber-200">
                        {getBusLabel(bus)}
                      </p>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-200/80">
                        {Number(bus.reviewCount || 0)} reviews
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {Number(bus.avgRating || 0).toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Rating Distribution
            </p>
            <div className="mt-3 space-y-2">
              {ratingDistribution.map((item) => (
                <div key={item.stars}>
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      {item.stars}
                      <Star className="h-3 w-3 fill-current text-amber-400" />
                    </span>
                    <span>
                      {item.count} ({item.ratio.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10">
                    <div
                      className="h-2 rounded-full bg-amber-400"
                      style={{ width: `${percent(item.ratio)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Risk Alerts
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Active buses without conductor
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {unassignedActiveBuses}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <ShieldCheck className="h-4 w-4 text-rose-500" />
                  Blocked conductors
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {blockedConductors}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <MessageSquareText className="h-4 w-4 text-indigo-500" />
                  Buses with zero reviews
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {zeroReviewBuses}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Users className="h-4 w-4 text-cyan-500" />
                  Conductors with no assignment
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {unassignedConductors}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900/70">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Quick Actions
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Jump to operational modules to take action.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "Manage Conductor",
              description: "Create, edit, and assign conductors.",
              href: `${OWNER_BASE_PATH}/manage-conductor`,
              icon: Users,
              tone:
                "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-200",
            },
            {
              label: "Manage Buses",
              description: "Update bus details and fleet readiness.",
              href: `${OWNER_BASE_PATH}/manage-buses`,
              icon: Bus,
              tone:
                "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200",
            },
            {
              label: "Boarded Users",
              description: "Check live seat boarding blueprints.",
              href: `${OWNER_BASE_PATH}/boarded-users`,
              icon: BadgeCheck,
              tone:
                "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
            },
            {
              label: "Track Bus",
              description: "Monitor location and telemetry.",
              href: `${OWNER_BASE_PATH}/track-bus`,
              icon: MapPinned,
              tone:
                "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/15 dark:text-cyan-200",
            },
            {
              label: "Manage Reviews",
              description: "View owner-scoped ratings and feedback.",
              href: `${OWNER_BASE_PATH}/manage-reviews`,
              icon: Star,
              tone:
                "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
            },
          ].map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              className={cn(
                "group rounded-2xl border p-3 text-left transition hover:-translate-y-0.5",
                item.tone,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <item.icon className="h-4 w-4 shrink-0" />
                <ArrowRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </div>
              <p className="mt-2 text-sm font-semibold">{item.label}</p>
              <p className="mt-1 text-[11px] opacity-80">{item.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900/70">
        <div className="border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Fleet Snapshot
          </p>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100/95 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Bus</th>
                <th className="px-4 py-3 font-semibold">Route</th>
                <th className="px-4 py-3 font-semibold">Seats</th>
                <th className="px-4 py-3 font-semibold">Conductor</th>
                <th className="px-4 py-3 font-semibold">Rating</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {spotlightBuses.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-300"
                  >
                    No buses available in your fleet.
                  </td>
                </tr>
              ) : (
                spotlightBuses.map((bus) => {
                  const operationalRow = operationalMap.get(bus._id);
                  const summary = reviewBusSummaryMap.get(bus._id);
                  const rating = Number(summary?.avgRating || 0);
                  return (
                    <tr
                      key={bus._id}
                      className="bg-white/60 transition hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {getBusLabel(bus)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {bus.operator || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        <p>{getRouteLabel(bus)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          <Route className="mr-1 inline h-3 w-3" />
                          {bus.route?.routeCode || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {Number(bus.availableSeats || 0)} / {Number(bus.totalSeats || 0)}
                      </td>
                      <td className="px-4 py-3">
                        {operationalRow?.conductor?._id ? (
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {operationalRow.conductor.fullName || "Assigned"}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {operationalRow.conductor.email || "-"}
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {rating > 0 ? rating.toFixed(1) : "No ratings"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                            bus.isActive
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200"
                              : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200",
                          )}
                        >
                          {bus.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
