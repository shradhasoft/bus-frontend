"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export type Period = "7d" | "30d" | "90d" | "1y" | "all";

export type OverviewMetric = {
  value: number;
  change: number;
  allTime?: number;
  avgTransaction?: number;
};

export type TimelinePoint = {
  date: string;
  total?: number;
  confirmed?: number;
  cancelled?: number;
  revenue?: number;
  bookings?: number;
};

export type StatusCount = {
  status: string;
  count: number;
};

export type PaymentMethod = {
  method: string;
  count: number;
  amount: number;
};

export type TopRoute = {
  route: string;
  bookings: number;
  revenue: number;
  passengers: number;
};

export type RecentBooking = {
  bookingId: string;
  status: string;
  paymentStatus: string;
  amount: number;
  route: string;
  travelDate: string;
  passengers: number;
  createdAt: string;
};

export type ActivityItem = {
  type: string;
  id: string;
  title: string;
  detail: string;
  status: "good" | "warn" | "risk";
  time: string;
};

export type RatingDistribution = {
  rating: number;
  count: number;
};

export type DashboardData = {
  period: string;
  overview: {
    totalBookings: OverviewMetric;
    totalRevenue: OverviewMetric;
    totalUsers: OverviewMetric;
    totalPassengers: OverviewMetric;
    cancellationRate: number;
    activeBuses: number;
    totalBuses: number;
  };
  bookings: {
    statusBreakdown: StatusCount[];
    timeline: TimelinePoint[];
  };
  revenue: {
    timeline: TimelinePoint[];
    paymentMethods: PaymentMethod[];
  };
  support: {
    tickets: {
      total: number;
      open: number;
      inProgress: number;
      resolved: number;
      closed: number;
      highPriority: number;
      change: number;
    };
    callbacks: {
      total: number;
      pending: number;
      inProgress: number;
      called: number;
      closed: number;
    };
  };
  rentals: {
    total: number;
    new: number;
    inProgress: number;
    quoted: number;
    closed: number;
    change: number;
  };
  reviews: {
    total: number;
    avgRating: number;
    approved: number;
    pending: number;
    distribution: RatingDistribution[];
  };
  offers: {
    total: number;
    active: number;
    totalRedemptions: number;
  };
  topRoutes: TopRoute[];
  recentBookings: RecentBooking[];
  recentActivity: ActivityItem[];
};

export function useDashboardAnalytics(initialPeriod: Period = "30d") {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchAnalytics = useCallback(async (p: Period) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch(
        `/admin/dashboard/analytics?period=${p}`,
        {
          method: "GET",
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics (${response.status})`);
      }

      const json = await response.json();
      if (!json.success) {
        throw new Error(json.message || "Failed to fetch analytics");
      }

      setData(json.data);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(period);
    return () => controllerRef.current?.abort();
  }, [period, fetchAnalytics]);

  const refresh = useCallback(() => {
    fetchAnalytics(period);
  }, [period, fetchAnalytics]);

  return { data, loading, error, period, setPeriod, refresh };
}
