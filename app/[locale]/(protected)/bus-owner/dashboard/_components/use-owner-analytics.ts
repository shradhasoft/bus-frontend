"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";

export type OwnerAnalyticsBus = {
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

export type OwnerOperationalBus = {
  _id: string;
  busName?: string;
  busNumber?: string;
  route?: { routeCode?: string; origin?: string; destination?: string };
  conductor?: {
    _id?: string;
    fullName?: string;
    email?: string;
    isActive?: boolean;
    isBlocked?: boolean;
  } | null;
};

export type OwnerConductor = {
  _id: string;
  fullName?: string;
  email?: string;
  isActive?: boolean;
  isBlocked?: boolean;
  assignedBusCount?: number;
};

export type OwnerBusSummary = {
  busId: string;
  busName?: string | null;
  busNumber?: string | null;
  avgRating?: number;
  reviewCount?: number;
  busProfileRating?: number;
};

export type OwnerReviewStats = {
  avgRating?: number;
  totalReviews?: number;
  distribution?: Record<string, number>;
};

export type TodaySeatSummary = {
  totalSeats: number;
  totalBooked: number;
  totalBoarded: number;
  date: string; // YYYY-MM-DD
};

export type OwnerAnalyticsData = {
  buses: OwnerAnalyticsBus[];
  operationalBuses: OwnerOperationalBus[];
  conductors: OwnerConductor[];
  reviewStats: OwnerReviewStats;
  busSummaries: OwnerBusSummary[];
  todaySeatSummary: TodaySeatSummary;
  lastSync: string | null;
};

const MAX_PAGE_FETCH = 30;

export function useOwnerAnalytics() {
  const [data, setData] = useState<OwnerAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildHeaders = useCallback(async (): Promise<
    Record<string, string>
  > => {
    const token = await firebaseAuth.currentUser
      ?.getIdToken()
      .catch(() => null);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, []);

  const fetchJson = useCallback(
    async (path: string) => {
      const headers = await buildHeaders();
      const res = await fetch(apiUrl(path), {
        method: "GET",
        credentials: "include",
        headers,
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload?.message || `Request failed: ${path}`);
      return payload;
    },
    [buildHeaders],
  );

  const fetchAllPages = useCallback(
    async <T>(
      pathFn: (page: number) => string,
      extract: (payload: unknown) => {
        rows: T[];
        totalPages: number;
        hasNext: boolean;
      },
    ): Promise<T[]> => {
      const records: T[] = [];
      let page = 1;
      let totalPages = 1;
      let loops = 0;
      while (loops < MAX_PAGE_FETCH && page <= totalPages) {
        const payload = await fetchJson(pathFn(page));
        const { rows, totalPages: tp, hasNext } = extract(payload);
        records.push(...rows);
        totalPages = Math.max(1, tp);
        if (!hasNext) break;
        page += 1;
        loops += 1;
      }
      return records;
    },
    [fetchJson],
  );

  const fetchTodaySeatSummary = useCallback(
    async (activeBuses: OwnerAnalyticsBus[]): Promise<TodaySeatSummary> => {
      const today = new Date();
      const todayStr = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");

      const onlyActive = activeBuses.filter((b) => b.isActive);

      // Cap at 20 buses to avoid overloading the server with parallel requests.
      // For owners with >20 buses, only the first 20 contribute to today's booked count.
      const MAX_BLUEPRINT_FETCH = 20;
      const busesToFetch = onlyActive.slice(0, MAX_BLUEPRINT_FETCH);

      const results = await Promise.allSettled(
        busesToFetch.map((bus) =>
          fetchJson(
            `/boarding-blueprint?busId=${bus._id}&travelDate=${todayStr}`,
          ),
        ),
      );

      let totalSeats = 0;
      let totalBooked = 0;
      let totalBoarded = 0;

      results.forEach((result, i) => {
        const bus = busesToFetch[i];
        if (result.status === "fulfilled") {
          const summary = result.value?.data?.summary;
          if (summary) {
            // Use the blueprint's totalSeats (from seatLayout) — more accurate
            totalSeats += Number(summary.totalSeats || bus.totalSeats || 0);
            totalBooked += Number(summary.totalBooked || 0);
            totalBoarded += Number(summary.totalBoarded || 0);
          } else {
            // Blueprint returned but no summary — fall back to static seat count
            totalSeats += Number(bus.totalSeats || 0);
          }
        } else {
          // Request failed — count seats as available (conservative)
          totalSeats += Number(bus.totalSeats || 0);
        }
      });

      // For buses beyond the fetch cap, add their seat counts but not bookings
      // (we don't know today's bookings for them without fetching)
      onlyActive.slice(MAX_BLUEPRINT_FETCH).forEach((bus) => {
        totalSeats += Number(bus.totalSeats || 0);
      });

      return { totalSeats, totalBooked, totalBoarded, date: todayStr };
    },
    [fetchJson],
  );

  const load = useCallback(
    async (background = false) => {
      if (background) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [busResult, opResult, conductorResult, reviewResult] =
          await Promise.allSettled([
            fetchAllPages(
              (p) => `/admin/buses?page=${p}&limit=100`,
              (payload: any) => ({
                rows: Array.isArray(payload?.data?.buses)
                  ? payload.data.buses
                  : [],
                totalPages: Number(payload?.data?.totalPages || 1),
                hasNext: Boolean(payload?.data?.hasNext),
              }),
            ),
            fetchJson("/v1/telemetry/owner/buses"),
            fetchAllPages(
              (p) => `/v1/telemetry/owner/conductors?page=${p}&limit=100`,
              (payload: any) => ({
                rows: Array.isArray(payload?.data?.conductors)
                  ? payload.data.conductors
                  : [],
                totalPages: Number(payload?.data?.totalPages || 1),
                hasNext: Boolean(payload?.data?.hasNext),
              }),
            ),
            fetchJson("/api/reviews/owner/overview?page=1&limit=10"),
          ]);

        const failedModules: string[] = [];

        const buses =
          busResult.status === "fulfilled"
            ? busResult.value
            : (failedModules.push("fleet"), [] as OwnerAnalyticsBus[]);

        const operationalBuses =
          opResult.status === "fulfilled"
            ? Array.isArray(opResult.value?.data)
              ? opResult.value.data
              : []
            : (failedModules.push("operations"), [] as OwnerOperationalBus[]);

        const conductors =
          conductorResult.status === "fulfilled"
            ? conductorResult.value
            : (failedModules.push("conductors"), [] as OwnerConductor[]);

        const reviewStats =
          reviewResult.status === "fulfilled"
            ? (reviewResult.value?.data?.stats ?? {})
            : (failedModules.push("reviews"), {} as OwnerReviewStats);

        const busSummaries =
          reviewResult.status === "fulfilled"
            ? Array.isArray(reviewResult.value?.data?.busSummaries)
              ? reviewResult.value.data.busSummaries
              : []
            : ([] as OwnerBusSummary[]);

        // Fetch today's actual seat occupancy from boarding blueprints
        const todaySeatSummary = await fetchTodaySeatSummary(buses).catch(
          () => ({
            totalSeats: buses.reduce(
              (s, b) => s + Number(b.totalSeats || 0),
              0,
            ),
            totalBooked: 0,
            totalBoarded: 0,
            date: new Date().toISOString().slice(0, 10),
          }),
        );

        setData({
          buses,
          operationalBuses,
          conductors,
          reviewStats,
          busSummaries,
          todaySeatSummary,
          lastSync: new Date().toISOString(),
        });

        if (failedModules.length > 0) {
          setError(
            `Some modules are unavailable: ${failedModules.join(", ")}. Data may be partial.`,
          );
        }
      } catch (err) {
        setError((err as Error).message || "Unable to load analytics.");
      } finally {
        if (background) setRefreshing(false);
        else setLoading(false);
      }
    },
    [fetchAllPages, fetchJson, fetchTodaySeatSummary],
  );

  useEffect(() => {
    void load();
    intervalRef.current = setInterval(() => void load(true), 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  const refresh = useCallback(() => void load(true), [load]);

  return { data, loading, refreshing, error, refresh };
}
