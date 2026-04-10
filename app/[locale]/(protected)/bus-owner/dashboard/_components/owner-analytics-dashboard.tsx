"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bus,
  CheckCircle2,
  Gauge,
  Loader2,
  MapPin,
  RefreshCw,
  Route,
  ShieldAlert,
  Star,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  useOwnerAnalytics,
  type OwnerAnalyticsBus,
  type OwnerBusSummary,
  type OwnerConductor,
  type OwnerOperationalBus,
} from "./use-owner-analytics";

// ─── Constants ───────────────────────────────────────────────────────────────

const OWNER_BASE = "/bus-owner/dashboard";

const CHART_COLORS = {
  primary: "#6366f1",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  muted: "#94a3b8",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
};

const STAR_COLOR = "#fbbf24";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pct = (v: number) =>
  Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0));

const fmtPct = (v: number) => `${pct(v).toFixed(1)}%`;

const getBusLabel = (bus?: {
  busName?: string | null;
  busNumber?: string | null;
}) => `${bus?.busName || "Unnamed"} (${bus?.busNumber || "-"})`;

const getRouteLabel = (bus?: {
  route?: { origin?: string | null; destination?: string | null } | null;
}) =>
  bus?.route?.origin && bus?.route?.destination
    ? `${bus.route.origin} → ${bus.route.destination}`
    : "No route";

const formatSync = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ message = "No data available" }: { message?: string }) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center">
      <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
  accent,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  trend?: { value: number; label?: string };
  accent?: "blue" | "indigo" | "emerald" | "amber" | "rose" | "cyan" | "purple";
}) {
  const accentMap = {
    blue: "from-blue-500/10 to-blue-500/5 border-blue-200 dark:border-blue-500/30",
    indigo:
      "from-indigo-500/10 to-indigo-500/5 border-indigo-200 dark:border-indigo-500/30",
    emerald:
      "from-emerald-500/10 to-emerald-500/5 border-emerald-200 dark:border-emerald-500/30",
    amber:
      "from-amber-500/10 to-amber-500/5 border-amber-200 dark:border-amber-500/30",
    rose: "from-rose-500/10 to-rose-500/5 border-rose-200 dark:border-rose-500/30",
    cyan: "from-cyan-500/10 to-cyan-500/5 border-cyan-200 dark:border-cyan-500/30",
    purple:
      "from-purple-500/10 to-purple-500/5 border-purple-200 dark:border-purple-500/30",
  };
  const iconMap = {
    blue: "text-blue-500",
    indigo: "text-indigo-500",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    rose: "text-rose-500",
    cyan: "text-cyan-500",
    purple: "text-purple-500",
  };
  const a = accent ?? "indigo";
  const isPositive = (trend?.value ?? 0) >= 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border bg-linear-to-br",
        accentMap[a],
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="rounded-lg bg-background/60 p-2 backdrop-blur-sm">
          <Icon className={cn("h-4 w-4", iconMap[a])} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        {trend !== undefined && (
          <div className="mt-1 flex items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                isPositive ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {isPositive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(trend.value)}%
            </span>
            {trend.label && (
              <span className="text-xs text-muted-foreground">
                {trend.label}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProgressBar({
  label,
  value,
  max,
  color = "bg-indigo-500",
  showPct = true,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  showPct?: boolean;
}) {
  const ratio = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <span>
          {value}/{max}
          {showPct && ` (${fmtPct(ratio)})`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-2 rounded-full transition-all duration-500", color)}
          style={{ width: `${pct(ratio)}%` }}
        />
      </div>
    </div>
  );
}

function RiskBadge({
  count,
  label,
  icon: Icon,
  severity,
}: {
  count: number;
  label: string;
  icon: LucideIcon;
  severity: "warn" | "danger" | "info";
}) {
  const styles = {
    warn: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    danger:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
    info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
  };
  const iconStyles = {
    warn: "text-amber-500",
    danger: "text-rose-500",
    info: "text-blue-500",
  };
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border px-3 py-2.5",
        styles[severity],
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <Icon className={cn("h-4 w-4 shrink-0", iconStyles[severity])} />
        {label}
      </span>
      <span
        className={cn(
          "min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-bold",
          count > 0
            ? severity === "danger"
              ? "bg-rose-500 text-white"
              : severity === "warn"
                ? "bg-amber-500 text-white"
                : "bg-blue-500 text-white"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </div>
  );
}

function TooltipContent({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter?: (v: number, name?: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const displayLabel =
    label || (payload.length === 1 ? payload[0].name : undefined);
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      {displayLabel && (
        <p className="mb-1 font-medium text-muted-foreground">{displayLabel}</p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {payload.length > 1 && (
            <span className="capitalize text-muted-foreground">
              {entry.name}:
            </span>
          )}
          <span className="font-medium">
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function QuickActionCard({
  label,
  description,
  href: _href,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
        accent,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="rounded-lg bg-background/40 p-2">
          <Icon className="h-4 w-4" />
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-[11px] opacity-75">{description}</p>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OwnerAnalyticsDashboard() {
  const { data, loading, refreshing, error, refresh } = useOwnerAnalytics();
  const router = useRouter();

  // ── Derived metrics ──────────────────────────────────────────────────────
  const buses = useMemo(() => data?.buses ?? [], [data?.buses]);
  const operationalBuses = useMemo(
    () => data?.operationalBuses ?? [],
    [data?.operationalBuses],
  );
  const conductors = data?.conductors ?? [];
  const reviewStats = data?.reviewStats ?? {};
  const busSummaries = useMemo(
    () => data?.busSummaries ?? [],
    [data?.busSummaries],
  );

  const totalBuses = buses.length;
  const activeBuses = buses.filter((b) => b.isActive).length;
  const inactiveBuses = Math.max(totalBuses - activeBuses, 0);

  // Today's actual seat occupancy from boarding blueprints (not the stale static counter)
  const todaySeatSummary = data?.todaySeatSummary ?? {
    totalSeats: buses.reduce((s, b) => s + Number(b.totalSeats || 0), 0),
    totalBooked: 0,
    totalBoarded: 0,
    date: new Date().toISOString().slice(0, 10),
  };
  const totalSeats = todaySeatSummary.totalSeats;
  const occupiedSeats = todaySeatSummary.totalBooked;
  const availableSeats = Math.max(totalSeats - occupiedSeats, 0);
  const occupancyRate = totalSeats > 0 ? (occupiedSeats / totalSeats) * 100 : 0;

  const opMap = useMemo(() => {
    const m = new Map<string, (typeof operationalBuses)[0]>();
    operationalBuses.forEach((b) => b._id && m.set(b._id, b));
    return m;
  }, [operationalBuses]);

  const summaryMap = useMemo(() => {
    const m = new Map<string, OwnerBusSummary>();
    busSummaries.forEach((s) => s.busId && m.set(s.busId, s));
    return m;
  }, [busSummaries]);

  const assignedBuses = operationalBuses.filter((b) =>
    Boolean(b.conductor?._id),
  ).length;
  const assignmentCoverage =
    activeBuses > 0 ? (assignedBuses / activeBuses) * 100 : 0;
  const unassignedActiveBuses = Math.max(activeBuses - assignedBuses, 0);

  const totalConductors = conductors.length;
  const activeConductors = conductors.filter(
    (c) => c.isActive && !c.isBlocked,
  ).length;
  const blockedConductors = conductors.filter((c) => c.isBlocked).length;
  const unassignedConductors = conductors.filter(
    (c) => Number(c.assignedBusCount || 0) === 0,
  ).length;
  const conductorAvailability =
    totalConductors > 0 ? (activeConductors / totalConductors) * 100 : 0;

  const avgRating = Number(reviewStats.avgRating || 0);
  const totalReviews = Number(reviewStats.totalReviews || 0);

  const uniqueRoutes = useMemo(
    () =>
      new Set(
        buses
          .map((b) => {
            if (b.route?.routeCode) return `CODE:${b.route.routeCode}`;
            const o = (b.route?.origin || "").trim();
            const d = (b.route?.destination || "").trim();
            return o || d ? `${o}::${d}` : "";
          })
          .filter(Boolean),
      ).size,
    [buses],
  );

  const zeroReviewBuses = buses.filter(
    (b) => Number(summaryMap.get(b._id)?.reviewCount || 0) === 0,
  ).length;

  const topRatedBuses = useMemo(
    () =>
      [...busSummaries]
        .filter((s) => Number(s.reviewCount || 0) > 0)
        .sort(
          (a, b) =>
            Number(b.avgRating || 0) - Number(a.avgRating || 0) ||
            Number(b.reviewCount || 0) - Number(a.reviewCount || 0),
        )
        .slice(0, 6),
    [busSummaries],
  );

  const ratingDistribution = useMemo(() => {
    const dist = reviewStats.distribution || {};
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: Number(dist[String(stars)] || 0),
      ratio:
        totalReviews > 0
          ? (Number(dist[String(stars)] || 0) / totalReviews) * 100
          : 0,
    }));
  }, [reviewStats.distribution, totalReviews]);

  // Chart data
  const fleetStatusData = [
    { name: "Active", value: activeBuses, fill: CHART_COLORS.success },
    { name: "Inactive", value: inactiveBuses, fill: CHART_COLORS.muted },
  ].filter((d) => d.value > 0);

  const conductorStatusData = [
    { name: "Active", value: activeConductors, fill: CHART_COLORS.primary },
    { name: "Blocked", value: blockedConductors, fill: CHART_COLORS.danger },
    {
      name: "Unassigned",
      value: Math.max(unassignedConductors - blockedConductors, 0),
      fill: CHART_COLORS.warning,
    },
  ].filter((d) => d.value > 0);

  const seatData = [
    { name: "Booked Today", value: occupiedSeats, fill: CHART_COLORS.primary },
    {
      name: "Available Today",
      value: availableSeats,
      fill: CHART_COLORS.success,
    },
  ].filter((d) => d.value > 0);

  const ratingBarData = ratingDistribution.map((d) => ({
    name: `${d.stars}★`,
    count: d.count,
  }));

  const busPerformanceData = useMemo(
    () =>
      busSummaries
        .filter((s) => Number(s.reviewCount || 0) > 0)
        .slice(0, 8)
        .map((s) => ({
          name: s.busNumber || s.busName || "Bus",
          rating: Number(s.avgRating || 0),
          reviews: Number(s.reviewCount || 0),
        })),
    [busSummaries],
  );

  // ── Loading / Error states ────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Owner Command Center
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Fleet Analytics & Insights
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unified view of fleet performance, conductor health, and customer
            sentiment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.lastSync && (
            <span className="hidden rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
              Synced {formatSync(data.lastSync)}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
            />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {error}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Fleet Size"
          value={totalBuses}
          sub={`${activeBuses} active · ${inactiveBuses} inactive`}
          icon={Bus}
          accent="blue"
        />
        <KpiCard
          title="Conductors"
          value={totalConductors}
          sub={`${activeConductors} active · ${blockedConductors} blocked`}
          icon={Users}
          accent="indigo"
        />
        <KpiCard
          title="Customer Rating"
          value={avgRating > 0 ? avgRating.toFixed(1) : "—"}
          sub={`${totalReviews} total reviews`}
          icon={Star}
          accent="amber"
        />
        <KpiCard
          title="Today's Seat Occupancy"
          value={fmtPct(occupancyRate)}
          sub={`${occupiedSeats} booked / ${totalSeats} total · ${todaySeatSummary.date}`}
          icon={Gauge}
          accent="emerald"
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fleet">Fleet</TabsTrigger>
          <TabsTrigger value="conductors">Conductors</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-6">
          <OverviewTab
            activeBuses={activeBuses}
            totalBuses={totalBuses}
            assignedBuses={assignedBuses}
            assignmentCoverage={assignmentCoverage}
            activeConductors={activeConductors}
            totalConductors={totalConductors}
            conductorAvailability={conductorAvailability}
            occupancyRate={occupancyRate}
            occupiedSeats={occupiedSeats}
            totalSeats={totalSeats}
            todayDate={todaySeatSummary.date}
            uniqueRoutes={uniqueRoutes}
            unassignedActiveBuses={unassignedActiveBuses}
            blockedConductors={blockedConductors}
            zeroReviewBuses={zeroReviewBuses}
            unassignedConductors={unassignedConductors}
            fleetStatusData={fleetStatusData}
            conductorStatusData={conductorStatusData}
            seatData={seatData}
            topRatedBuses={topRatedBuses}
            ratingDistribution={ratingDistribution}
            totalReviews={totalReviews}
            avgRating={avgRating}
            router={router}
          />
        </TabsContent>

        {/* ── Fleet Tab ── */}
        <TabsContent value="fleet" className="space-y-6">
          <FleetTab
            buses={buses}
            opMap={opMap}
            summaryMap={summaryMap}
            activeBuses={activeBuses}
            totalBuses={totalBuses}
            occupancyRate={occupancyRate}
            uniqueRoutes={uniqueRoutes}
            assignmentCoverage={assignmentCoverage}
            assignedBuses={assignedBuses}
          />
        </TabsContent>

        {/* ── Conductors Tab ── */}
        <TabsContent value="conductors" className="space-y-6">
          <ConductorsTab
            conductors={conductors}
            totalConductors={totalConductors}
            activeConductors={activeConductors}
            blockedConductors={blockedConductors}
            unassignedConductors={unassignedConductors}
            conductorStatusData={conductorStatusData}
          />
        </TabsContent>

        {/* ── Reviews Tab ── */}
        <TabsContent value="reviews" className="space-y-6">
          <ReviewsTab
            avgRating={avgRating}
            totalReviews={totalReviews}
            ratingDistribution={ratingDistribution}
            ratingBarData={ratingBarData}
            busPerformanceData={busPerformanceData}
            topRatedBuses={topRatedBuses}
            busSummaries={busSummaries}
          />
        </TabsContent>
      </Tabs>

      {/* ── Quick Actions ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
          <CardDescription>Jump to operational modules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                label: "Manage Conductors",
                description: "Create, edit, and assign conductors",
                href: `${OWNER_BASE}/manage-conductor`,
                icon: Users,
                accent:
                  "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200",
              },
              {
                label: "Manage Buses",
                description: "Update bus details and fleet readiness",
                href: `${OWNER_BASE}/manage-buses`,
                icon: Bus,
                accent:
                  "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
              },
              {
                label: "Boarded Users",
                description: "Check live seat boarding blueprints",
                href: `${OWNER_BASE}/boarded-users`,
                icon: CheckCircle2,
                accent:
                  "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
              },
              {
                label: "Track Bus",
                description: "Monitor location and telemetry",
                href: `${OWNER_BASE}/track-bus`,
                icon: MapPin,
                accent:
                  "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200",
              },
              {
                label: "Manage Reviews",
                description: "View ratings and customer feedback",
                href: `${OWNER_BASE}/manage-reviews`,
                icon: Star,
                accent:
                  "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
              },
            ].map((item) => (
              <QuickActionCard
                key={item.href}
                {...item}
                onClick={() => router.push(item.href)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  activeBuses,
  totalBuses,
  assignedBuses,
  assignmentCoverage: _assignmentCoverage,
  activeConductors,
  totalConductors,
  conductorAvailability: _conductorAvailability,
  occupancyRate: _occupancyRate,
  occupiedSeats,
  totalSeats,
  todayDate,
  uniqueRoutes,
  unassignedActiveBuses,
  blockedConductors,
  zeroReviewBuses,
  unassignedConductors,
  fleetStatusData,
  conductorStatusData: _conductorStatusData,
  seatData,
  topRatedBuses,
  ratingDistribution,
  totalReviews,
  avgRating,
  router: _router,
}: {
  activeBuses: number;
  totalBuses: number;
  assignedBuses: number;
  assignmentCoverage: number;
  activeConductors: number;
  totalConductors: number;
  conductorAvailability: number;
  occupancyRate: number;
  occupiedSeats: number;
  totalSeats: number;
  todayDate: string;
  uniqueRoutes: number;
  unassignedActiveBuses: number;
  blockedConductors: number;
  zeroReviewBuses: number;
  unassignedConductors: number;
  fleetStatusData: { name: string; value: number; fill: string }[];
  conductorStatusData: { name: string; value: number; fill: string }[];
  seatData: { name: string; value: number; fill: string }[];
  topRatedBuses: OwnerBusSummary[];
  ratingDistribution: { stars: number; count: number; ratio: number }[];
  totalReviews: number;
  avgRating: number;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      {/* Operational Health + Donut Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Operational Health</CardTitle>
            <CardDescription>
              Fleet, conductor, and seat coverage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ProgressBar
              label="Active Fleet Ratio"
              value={activeBuses}
              max={totalBuses}
              color="bg-blue-500"
            />
            <ProgressBar
              label="Conductor Assignment Coverage"
              value={assignedBuses}
              max={Math.max(activeBuses, 1)}
              color="bg-indigo-500"
            />
            <ProgressBar
              label="Conductor Availability"
              value={activeConductors}
              max={Math.max(totalConductors, 1)}
              color="bg-emerald-500"
            />
            <ProgressBar
              label="Seat Occupancy"
              value={occupiedSeats}
              max={Math.max(totalSeats, 1)}
              color="bg-amber-500"
            />
            <div className="mt-2 grid grid-cols-3 gap-3 pt-2">
              {[
                {
                  label: "Routes",
                  value: uniqueRoutes,
                  color: "text-blue-600",
                },
                {
                  label: "Assigned Buses",
                  value: assignedBuses,
                  color: "text-indigo-600",
                },
                {
                  label: "Unassigned",
                  value: unassignedActiveBuses,
                  color:
                    unassignedActiveBuses > 0
                      ? "text-rose-600"
                      : "text-emerald-600",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border bg-muted/30 px-3 py-2 text-center"
                >
                  <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Fleet donut */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Fleet Status</CardTitle>
            </CardHeader>
            <CardContent>
              {fleetStatusData.length > 0 ? (
                <>
                  <div className="h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={fleetStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={38}
                          outerRadius={60}
                          paddingAngle={3}
                          dataKey="value"
                          nameKey="name"
                        >
                          {fleetStatusData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<TooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-1 space-y-1">
                    {fleetStatusData.map((d) => (
                      <div
                        key={d.name}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: d.fill }}
                          />
                          {d.name}
                        </span>
                        <span className="font-semibold">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState message="No fleet data" />
              )}
            </CardContent>
          </Card>

          {/* Seat donut */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Today&apos;s Seat Occupancy
              </CardTitle>
              <CardDescription className="text-xs">{todayDate}</CardDescription>
            </CardHeader>
            <CardContent>
              {seatData.length > 0 ? (
                <>
                  <div className="h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={seatData}
                          cx="50%"
                          cy="50%"
                          innerRadius={38}
                          outerRadius={60}
                          paddingAngle={3}
                          dataKey="value"
                          nameKey="name"
                        >
                          {seatData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<TooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-1 space-y-1">
                    {seatData.map((d) => (
                      <div
                        key={d.name}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: d.fill }}
                          />
                          {d.name}
                        </span>
                        <span className="font-semibold">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState message="No seat data" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Risk Alerts + Top Rated + Rating Distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Alerts</CardTitle>
            <CardDescription>Items requiring your attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <RiskBadge
              count={unassignedActiveBuses}
              label="Active buses without conductor"
              icon={AlertTriangle}
              severity="warn"
            />
            <RiskBadge
              count={blockedConductors}
              label="Blocked conductors"
              icon={ShieldAlert}
              severity="danger"
            />
            <RiskBadge
              count={zeroReviewBuses}
              label="Buses with zero reviews"
              icon={Star}
              severity="info"
            />
            <RiskBadge
              count={unassignedConductors}
              label="Conductors with no assignment"
              icon={Users}
              severity="warn"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Rated Buses</CardTitle>
            <CardDescription>Ranked by customer rating</CardDescription>
          </CardHeader>
          <CardContent>
            {topRatedBuses.length === 0 ? (
              <EmptyState message="No reviews yet. Ratings will appear after customers review your buses." />
            ) : (
              <div className="space-y-2">
                {topRatedBuses.map((bus, i) => (
                  <div
                    key={bus.busId}
                    className="flex items-center gap-3 rounded-xl border bg-muted/20 px-3 py-2"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {getBusLabel(bus)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {bus.reviewCount} reviews
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                      <Star className="h-3 w-3 fill-current" />
                      {Number(bus.avgRating || 0).toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rating Distribution</CardTitle>
            <CardDescription>
              {totalReviews} reviews · avg{" "}
              {avgRating > 0 ? avgRating.toFixed(1) : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {ratingDistribution.map((d) => (
              <div key={d.stars} className="flex items-center gap-3">
                <span className="flex w-8 shrink-0 items-center gap-0.5 text-xs font-semibold text-muted-foreground">
                  {d.stars}
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${pct(d.ratio)}%` }}
                  />
                </div>
                <span className="w-14 text-right text-xs text-muted-foreground">
                  {d.count} ({d.ratio.toFixed(0)}%)
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── Fleet Tab ────────────────────────────────────────────────────────────────

function FleetTab({
  buses,
  opMap,
  summaryMap,
  activeBuses,
  totalBuses,
  occupancyRate,
  uniqueRoutes,
  assignedBuses: _assignedBuses,
}: {
  buses: OwnerAnalyticsBus[];
  opMap: Map<string, OwnerOperationalBus>;
  summaryMap: Map<string, OwnerBusSummary>;
  activeBuses: number;
  totalBuses: number;
  occupancyRate: number;
  uniqueRoutes: number;
  assignmentCoverage: number;
  assignedBuses: number;
}) {
  const routeFrequency = useMemo(() => {
    const freq = new Map<string, number>();
    buses.forEach((b) => {
      const key = getRouteLabel(b);
      if (key !== "No route") freq.set(key, (freq.get(key) || 0) + 1);
    });
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([route, count]) => ({ route, count }));
  }, [buses]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Buses"
          value={totalBuses}
          icon={Bus}
          accent="blue"
        />
        <KpiCard
          title="Active Buses"
          value={activeBuses}
          sub={`${fmtPct(totalBuses > 0 ? (activeBuses / totalBuses) * 100 : 0)} of fleet`}
          icon={CheckCircle2}
          accent="emerald"
        />
        <KpiCard
          title="Seat Occupancy"
          value={fmtPct(occupancyRate)}
          icon={Gauge}
          accent="amber"
        />
        <KpiCard
          title="Unique Routes"
          value={uniqueRoutes}
          icon={Route}
          accent="cyan"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buses per Route</CardTitle>
          <CardDescription>
            Number of buses assigned to each route
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            {routeFrequency.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={routeFrequency}
                  layout="vertical"
                  margin={{ left: 0, right: 16 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="route"
                    width={160}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<TooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill={CHART_COLORS.primary}
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No route data available" />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fleet Snapshot</CardTitle>
          <CardDescription>
            All buses with conductor and rating details
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Bus</th>
                  <th className="px-4 py-3 font-medium">Route</th>
                  <th className="px-4 py-3 font-medium">Seats</th>
                  <th className="px-4 py-3 font-medium">Conductor</th>
                  <th className="px-4 py-3 font-medium">Rating</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {buses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No buses in your fleet
                    </td>
                  </tr>
                ) : (
                  buses.map((bus) => {
                    const op = opMap.get(bus._id);
                    const summary = summaryMap.get(bus._id);
                    const rating = Number(summary?.avgRating || 0);
                    return (
                      <tr
                        key={bus._id}
                        className="transition hover:bg-muted/20"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold">{getBusLabel(bus)}</p>
                          <p className="text-xs text-muted-foreground">
                            {bus.operator || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <p>{getRouteLabel(bus)}</p>
                          {bus.route?.routeCode && (
                            <p className="text-xs">{bus.route.routeCode}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {Number(bus.availableSeats || 0)}/
                          {Number(bus.totalSeats || 0)}
                        </td>
                        <td className="px-4 py-3">
                          {op?.conductor?._id ? (
                            <div>
                              <p className="font-medium">
                                {op.conductor.fullName || "Assigned"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {op.conductor.email || "—"}
                              </p>
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-300 text-amber-600"
                            >
                              Unassigned
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {rating > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                              <Star className="h-3 w-3 fill-current" />
                              {rating.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No ratings
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={bus.isActive ? "default" : "secondary"}
                            className={
                              bus.isActive
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300"
                                : ""
                            }
                          >
                            {bus.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Conductors Tab ───────────────────────────────────────────────────────────

function ConductorsTab({
  conductors,
  totalConductors,
  activeConductors,
  blockedConductors,
  unassignedConductors,
  conductorStatusData,
}: {
  conductors: OwnerConductor[];
  totalConductors: number;
  activeConductors: number;
  blockedConductors: number;
  unassignedConductors: number;
  conductorStatusData: { name: string; value: number; fill: string }[];
}) {
  const assignedConductors = totalConductors - unassignedConductors;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Conductors"
          value={totalConductors}
          icon={Users}
          accent="indigo"
        />
        <KpiCard
          title="Active"
          value={activeConductors}
          sub={`${fmtPct(totalConductors > 0 ? (activeConductors / totalConductors) * 100 : 0)} availability`}
          icon={CheckCircle2}
          accent="emerald"
        />
        <KpiCard
          title="Blocked"
          value={blockedConductors}
          sub={blockedConductors > 0 ? "Requires attention" : "All clear"}
          icon={ShieldAlert}
          accent={blockedConductors > 0 ? "rose" : "emerald"}
        />
        <KpiCard
          title="Unassigned"
          value={unassignedConductors}
          sub={
            unassignedConductors > 0 ? "Need bus assignment" : "All assigned"
          }
          icon={AlertTriangle}
          accent={unassignedConductors > 0 ? "amber" : "emerald"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Conductor Status Breakdown
            </CardTitle>
            <CardDescription>
              Distribution by availability status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conductorStatusData.length > 0 ? (
              <>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={conductorStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {conductorStatusData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<TooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {conductorStatusData.map((d) => (
                    <div
                      key={d.name}
                      className="rounded-xl border bg-muted/20 p-3 text-center"
                    >
                      <p
                        className="text-lg font-bold"
                        style={{ color: d.fill }}
                      >
                        {d.value}
                      </p>
                      <p className="text-xs text-muted-foreground">{d.name}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState message="No conductor data" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assignment Coverage</CardTitle>
            <CardDescription>
              How many conductors are assigned to buses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressBar
              label="Assigned conductors"
              value={assignedConductors}
              max={Math.max(totalConductors, 1)}
              color="bg-indigo-500"
            />
            <ProgressBar
              label="Active conductors"
              value={activeConductors}
              max={Math.max(totalConductors, 1)}
              color="bg-emerald-500"
            />
            <ProgressBar
              label="Blocked conductors"
              value={blockedConductors}
              max={Math.max(totalConductors, 1)}
              color="bg-rose-500"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-muted/20 p-4 text-center">
                <p className="text-2xl font-bold text-indigo-600">
                  {assignedConductors}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Assigned</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 text-center">
                <p
                  className={cn(
                    "text-2xl font-bold",
                    unassignedConductors > 0
                      ? "text-amber-600"
                      : "text-emerald-600",
                  )}
                >
                  {unassignedConductors}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Unassigned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conductor Roster</CardTitle>
          <CardDescription>
            All conductors with assignment status
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Assigned Buses</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {conductors.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No conductors found
                    </td>
                  </tr>
                ) : (
                  conductors.map((c) => (
                    <tr key={c._id} className="transition hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">
                        {c.fullName || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.email || "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {Number(c.assignedBusCount || 0)}
                      </td>
                      <td className="px-4 py-3">
                        {c.isBlocked ? (
                          <Badge variant="destructive">Blocked</Badge>
                        ) : c.isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Reviews Tab ──────────────────────────────────────────────────────────────

function ReviewsTab({
  avgRating,
  totalReviews,
  ratingDistribution,
  ratingBarData,
  busPerformanceData,
  topRatedBuses: _topRatedBuses,
  busSummaries,
}: {
  avgRating: number;
  totalReviews: number;
  ratingDistribution: { stars: number; count: number; ratio: number }[];
  ratingBarData: { name: string; count: number }[];
  busPerformanceData: { name: string; rating: number; reviews: number }[];
  topRatedBuses: OwnerBusSummary[];
  busSummaries: OwnerBusSummary[];
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          title="Average Rating"
          value={avgRating > 0 ? `${avgRating.toFixed(1)} ★` : "—"}
          sub="Across all buses"
          icon={Star}
          accent="amber"
        />
        <KpiCard
          title="Total Reviews"
          value={totalReviews}
          sub="All time"
          icon={TrendingUp}
          accent="indigo"
        />
        <KpiCard
          title="Buses Reviewed"
          value={
            busSummaries.filter((s) => Number(s.reviewCount || 0) > 0).length
          }
          sub={`of ${busSummaries.length} total buses`}
          icon={Bus}
          accent="blue"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Rating distribution bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rating Distribution</CardTitle>
            <CardDescription>Number of reviews per star rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              {ratingBarData.some((d) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ratingBarData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<TooltipContent />} />
                    <Bar
                      dataKey="count"
                      fill={STAR_COLOR}
                      radius={[4, 4, 0, 0]}
                      barSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No reviews yet" />
              )}
            </div>
            {/* Progress bars */}
            <div className="mt-4 space-y-2">
              {ratingDistribution.map((d) => (
                <div key={d.stars} className="flex items-center gap-3">
                  <span className="flex w-8 shrink-0 items-center gap-0.5 text-xs font-semibold text-muted-foreground">
                    {d.stars}
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${pct(d.ratio)}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs text-muted-foreground">
                    {d.count} ({d.ratio.toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bus performance chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bus Performance</CardTitle>
            <CardDescription>Average rating per bus (top 8)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {busPerformanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={busPerformanceData}
                    layout="vertical"
                    margin={{ left: 0, right: 16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      type="number"
                      domain={[0, 5]}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={80}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={
                        <TooltipContent
                          formatter={(v, name) =>
                            name === "rating" ? v.toFixed(1) : String(v)
                          }
                        />
                      }
                    />
                    <Bar
                      dataKey="rating"
                      fill={STAR_COLOR}
                      radius={[0, 4, 4, 0]}
                      barSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No bus review data available" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-bus review summary table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Bus Review Summary</CardTitle>
          <CardDescription>
            Rating breakdown for each bus in your fleet
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Bus</th>
                  <th className="px-4 py-3 font-medium text-right">Reviews</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Avg Rating
                  </th>
                  <th className="px-4 py-3 font-medium">Rating Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {busSummaries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No review data available
                    </td>
                  </tr>
                ) : (
                  busSummaries.map((s) => {
                    const rating = Number(s.avgRating || 0);
                    const ratioPct = (rating / 5) * 100;
                    return (
                      <tr
                        key={s.busId}
                        className="transition hover:bg-muted/20"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold">{getBusLabel(s)}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {Number(s.reviewCount || 0)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {rating > 0 ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                              <Star className="h-3.5 w-3.5 fill-current" />
                              {rating.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-amber-400 transition-all duration-500"
                              style={{ width: `${pct(ratioPct)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
