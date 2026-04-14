"use client";

import React, { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Bus,
  HeadphonesIcon,
  IndianRupee,
  Loader2,
  RefreshCw,
  Star,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDashboardAnalytics,
  type DashboardData,
  type Period,
} from "./use-dashboard-analytics";

// --- Utility ---

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value}`;
};

const formatNumber = (value: number) => {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString("en-IN");
};

const formatDate = (dateStr: string) => {
  if (dateStr.includes("-W") || dateStr.match(/^\d{4}-\d{2}$/)) return dateStr;
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
};

const timeAgo = (dateStr: string) => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const CHART_COLORS = {
  primary: "#6366f1",
  secondary: "#8b5cf6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  muted: "#94a3b8",
};

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#e0e7ff"];

const STATUS_COLORS: Record<string, string> = {
  confirmed: CHART_COLORS.success,
  completed: CHART_COLORS.info,
  pending: CHART_COLORS.warning,
  cancelled: CHART_COLORS.danger,
};

// --- Sub-components ---

function EmptyChart({
  message = "No data available for this period",
}: {
  message?: string;
}) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center">
      <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function KpiCard({
  title,
  value,
  change,
  icon: Icon,
  suffix,
  description,
}: {
  title: string;
  value: string;
  change: number;
  icon: LucideIcon;
  suffix?: string;
  description?: string;
}) {
  const isPositive = change >= 0;
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="rounded-lg bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {suffix && (
            <span className="text-sm text-muted-foreground">{suffix}</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1">
          {change !== 0 ? (
            <>
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                  isPositive ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {isPositive ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(change)}%
              </span>
              <span className="text-xs text-muted-foreground">
                vs prev period
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              No change from prev period
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <div className="flex items-center gap-2">
        {color && (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter?: (value: number, name?: string) => string;
}) {
  if (!active || !payload?.length) return null;
  // For PieChart, label is undefined — use the slice name from payload instead
  const displayLabel =
    label || (payload.length === 1 ? payload[0].name : undefined);
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      {displayLabel && (
        <p className="mb-1 font-medium text-muted-foreground">
          {label ? formatDate(label) : displayLabel}
        </p>
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

function StatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    confirmed: "default",
    completed: "secondary",
    pending: "outline",
    cancelled: "destructive",
    paid: "default",
    refunded: "destructive",
  };
  return (
    <Badge variant={variants[status] || "outline"} className="text-[10px]">
      {status}
    </Badge>
  );
}

function ActivityDot({ status }: { status: "good" | "warn" | "risk" }) {
  const colors = {
    good: "bg-emerald-500",
    warn: "bg-amber-500",
    risk: "bg-rose-500",
  };
  return <span className={`h-2 w-2 rounded-full ${colors[status]}`} />;
}

// --- Main Component ---

type DashboardAnalyticsProps = {
  role: "admin" | "superadmin";
};

export default function DashboardAnalytics({ role }: DashboardAnalyticsProps) {
  const { data, loading, error, period, setPeriod, refresh } =
    useDashboardAnalytics("30d");

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading dashboard analytics...
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">Failed to load analytics</p>
          <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
          <button
            onClick={refresh}
            className="mt-2 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <DashboardHeader
        role={role}
        period={period}
        onPeriodChange={setPeriod}
        onRefresh={refresh}
        loading={loading}
      />
      <KpiSection data={data} />
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          {role === "superadmin" && (
            <TabsTrigger value="operations">Operations</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab data={data} role={role} />
        </TabsContent>
        <TabsContent value="bookings" className="space-y-6">
          <BookingsTab data={data} />
        </TabsContent>
        <TabsContent value="revenue" className="space-y-6">
          <RevenueTab data={data} />
        </TabsContent>
        {role === "superadmin" && (
          <TabsContent value="operations" className="space-y-6">
            <OperationsTab data={data} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// --- Header ---

function DashboardHeader({
  role,
  period,
  onPeriodChange,
  onRefresh,
  loading,
}: {
  role: string;
  period: Period;
  onPeriodChange: (p: Period) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {role === "superadmin" ? "Super Admin" : "Admin"} Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          {role === "superadmin"
            ? "Complete platform analytics and operational control"
            : "Booking analytics and operational overview"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={period}
          onValueChange={(v) => onPeriodChange(v as Period)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>
    </div>
  );
}

// --- KPI Section ---

function KpiSection({ data }: { data: DashboardData }) {
  const { overview } = data;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Total Bookings"
        value={formatNumber(overview.totalBookings.value)}
        change={overview.totalBookings.change}
        icon={BookOpen}
        description={`${formatNumber(overview.totalBookings.allTime || 0)} all time`}
      />
      <KpiCard
        title="Revenue"
        value={formatCurrency(overview.totalRevenue.value)}
        change={overview.totalRevenue.change}
        icon={IndianRupee}
        description={`Avg ₹${formatNumber(overview.totalRevenue.avgTransaction || 0)} per txn`}
      />
      <KpiCard
        title="New Users"
        value={formatNumber(overview.totalUsers.value)}
        change={overview.totalUsers.change}
        icon={Users}
        description={`${formatNumber(overview.totalUsers.allTime || 0)} total users`}
      />
      <KpiCard
        title="Passengers"
        value={formatNumber(overview.totalPassengers.value)}
        change={overview.totalPassengers.change}
        icon={Users}
        description={`${overview.cancellationRate}% cancellation rate`}
      />
    </div>
  );
}

// --- Overview Tab ---

function OverviewTab({
  data,
  role: _role,
}: {
  data: DashboardData;
  role: string;
}) {
  return (
    <>
      {/* Revenue + Bookings Chart */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend</CardTitle>
            <CardDescription>Revenue over selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full min-w-0">
              {data.revenue.timeline.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={400}
                  minHeight={300}
                >
                  <AreaChart data={data.revenue.timeline}>
                    <defs>
                      <linearGradient
                        id="revenueGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={CHART_COLORS.primary}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={CHART_COLORS.primary}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                    />
                    <Tooltip
                      content={
                        <ChartTooltipContent formatter={formatCurrency} />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={CHART_COLORS.primary}
                      fill="url(#revenueGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No revenue data for this period" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Booking Status</CardTitle>
            <CardDescription>Distribution across statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {data.bookings.statusBreakdown.length > 0 ? (
              <>
                <div className="h-[200px] w-full min-w-0">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={250}
                    minHeight={200}
                  >
                    <PieChart>
                      <Pie
                        data={data.bookings.statusBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="count"
                        nameKey="status"
                      >
                        {data.bookings.statusBreakdown.map((entry, index) => (
                          <Cell
                            key={entry.status}
                            fill={
                              STATUS_COLORS[entry.status] ||
                              PIE_COLORS[index % PIE_COLORS.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {data.bookings.statusBreakdown.map((s) => (
                    <MiniStat
                      key={s.status}
                      label={s.status}
                      value={s.count}
                      color={STATUS_COLORS[s.status] || CHART_COLORS.muted}
                    />
                  ))}
                </div>
              </>
            ) : (
              <EmptyChart message="No bookings in this period" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Routes + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Top Routes</CardTitle>
            <CardDescription>Most booked routes this period</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topRoutes.length > 0 ? (
              <div className="h-[300px] w-full min-w-0">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={400}
                  minHeight={300}
                >
                  <BarChart
                    data={data.topRoutes}
                    layout="vertical"
                    margin={{ left: 0, right: 10 }}
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
                    />
                    <YAxis
                      type="category"
                      dataKey="route"
                      width={150}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="bookings"
                      fill={CHART_COLORS.primary}
                      radius={[0, 4, 4, 0]}
                      barSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No route data for this period
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest platform events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentActivity.length > 0 ? (
                data.recentActivity.slice(0, 7).map((activity) => (
                  <div
                    key={`${activity.type}-${activity.id}`}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <ActivityDot status={activity.status} />
                    <div className="flex-1 space-y-0.5">
                      <p className="text-sm font-medium leading-tight">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.detail}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                      {timeAgo(activity.time)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No recent activity
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats: Buses, Support, Reviews */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Bus className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Fleet</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <MiniStat
                label="Active"
                value={data.overview.activeBuses}
                color={CHART_COLORS.success}
              />
              <MiniStat
                label="Inactive"
                value={data.overview.totalBuses - data.overview.activeBuses}
                color={CHART_COLORS.muted}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <HeadphonesIcon className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Support Tickets</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <MiniStat
                label="Open"
                value={data.support.tickets.open}
                color={CHART_COLORS.warning}
              />
              <MiniStat
                label="High Priority"
                value={data.support.tickets.highPriority}
                color={CHART_COLORS.danger}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Reviews</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  {data.reviews.avgRating}
                </span>
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-xs text-muted-foreground">
                  ({data.reviews.total} reviews)
                </span>
              </div>
              <MiniStat
                label="Pending Approval"
                value={data.reviews.pending}
                color={CHART_COLORS.warning}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Offers</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <MiniStat
                label="Active"
                value={data.offers.active}
                color={CHART_COLORS.success}
              />
              <MiniStat
                label="Redemptions"
                value={data.offers.totalRedemptions}
                color={CHART_COLORS.primary}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// --- Bookings Tab ---

function BookingsTab({ data }: { data: DashboardData }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Booking Trends</CardTitle>
          <CardDescription>
            Daily breakdown of confirmed vs cancelled bookings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full min-w-0">
            {data.bookings.timeline.length > 0 ? (
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={400}
                minHeight={350}
              >
                <BarChart data={data.bookings.timeline}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="confirmed"
                    fill={CHART_COLORS.success}
                    radius={[0, 0, 0, 0]}
                    barSize={16}
                    stackId="stack"
                  />
                  <Bar
                    dataKey="cancelled"
                    fill={CHART_COLORS.danger}
                    radius={[4, 4, 0, 0]}
                    barSize={16}
                    stackId="stack"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No booking trends for this period" />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Bookings</CardTitle>
          <CardDescription>Latest bookings across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Booking ID</th>
                  <th className="pb-2 pr-4 font-medium">Route</th>
                  <th className="pb-2 pr-4 font-medium">Passengers</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recentBookings.map((b) => (
                  <tr key={b.bookingId} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-mono text-xs">
                      {b.bookingId}
                    </td>
                    <td className="py-3 pr-4 max-w-[200px] truncate">
                      {b.route}
                    </td>
                    <td className="py-3 pr-4">{b.passengers}</td>
                    <td className="py-3 pr-4 font-medium">
                      {formatCurrency(b.amount)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {timeAgo(b.createdAt)}
                    </td>
                  </tr>
                ))}
                {data.recentBookings.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No bookings found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Routes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Route Performance</CardTitle>
          <CardDescription>
            Revenue and passenger metrics per route
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Route</th>
                  <th className="pb-2 pr-4 font-medium text-right">Bookings</th>
                  <th className="pb-2 pr-4 font-medium text-right">
                    Passengers
                  </th>
                  <th className="pb-2 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.topRoutes.map((r) => (
                  <tr key={r.route} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{r.route}</td>
                    <td className="py-3 pr-4 text-right">
                      {formatNumber(r.bookings)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {formatNumber(r.passengers)}
                    </td>
                    <td className="py-3 text-right font-medium">
                      {formatCurrency(r.revenue)}
                    </td>
                  </tr>
                ))}
                {data.topRoutes.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No route data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// --- Revenue Tab ---

function RevenueTab({ data }: { data: DashboardData }) {
  const totalPaymentAmount = useMemo(
    () => data.revenue.paymentMethods.reduce((sum, m) => sum + m.amount, 0),
    [data.revenue.paymentMethods],
  );

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Over Time</CardTitle>
            <CardDescription>
              Revenue from confirmed and completed bookings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full min-w-0">
              {data.revenue.timeline.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={400}
                  minHeight={300}
                >
                  <AreaChart data={data.revenue.timeline}>
                    <defs>
                      <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={CHART_COLORS.success}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={CHART_COLORS.success}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                    />
                    <Tooltip
                      content={
                        <ChartTooltipContent formatter={formatCurrency} />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={CHART_COLORS.success}
                      fill="url(#revGrad2)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No revenue data for this period" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Methods</CardTitle>
            <CardDescription>
              Transaction volume by payment method
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.revenue.paymentMethods.length > 0 ? (
              <>
                <div className="h-[200px] w-full min-w-0">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={250}
                    minHeight={200}
                  >
                    <PieChart>
                      <Pie
                        data={data.revenue.paymentMethods}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="amount"
                        nameKey="method"
                      >
                        {data.revenue.paymentMethods.map((_, index) => (
                          <Cell
                            key={index}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={
                          <ChartTooltipContent formatter={formatCurrency} />
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-2">
                  {data.revenue.paymentMethods.map((m, i) => (
                    <div
                      key={m.method}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                          }}
                        />
                        <span className="capitalize text-muted-foreground">
                          {m.method.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">
                          {formatCurrency(m.amount)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {totalPaymentAmount > 0
                            ? Math.round((m.amount / totalPaymentAmount) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No payment data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bookings per day with revenue overlay */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Daily Bookings &amp; Revenue
          </CardTitle>
          <CardDescription>
            Number of bookings alongside revenue generated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full min-w-0">
            {data.revenue.timeline.length > 0 ? (
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={400}
                minHeight={300}
              >
                <BarChart data={data.revenue.timeline}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(v) => formatCurrency(v)}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) =>
                          name === "revenue"
                            ? formatCurrency(value)
                            : String(value)
                        }
                      />
                    }
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="bookings"
                    fill={CHART_COLORS.primary}
                    radius={[4, 4, 0, 0]}
                    barSize={16}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="revenue"
                    fill={CHART_COLORS.success}
                    radius={[4, 4, 0, 0]}
                    barSize={16}
                    opacity={0.6}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No daily booking &amp; revenue data for this period" />
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// --- Operations Tab (Super Admin only) ---

function OperationsTab({ data }: { data: DashboardData }) {
  const ticketData = [
    {
      name: "Open",
      value: data.support.tickets.open,
      color: CHART_COLORS.warning,
    },
    {
      name: "In Progress",
      value: data.support.tickets.inProgress,
      color: CHART_COLORS.info,
    },
    {
      name: "Resolved",
      value: data.support.tickets.resolved,
      color: CHART_COLORS.success,
    },
    {
      name: "Closed",
      value: data.support.tickets.closed,
      color: CHART_COLORS.muted,
    },
  ];

  const rentalData = [
    { name: "New", value: data.rentals.new, color: CHART_COLORS.info },
    {
      name: "In Progress",
      value: data.rentals.inProgress,
      color: CHART_COLORS.warning,
    },
    { name: "Quoted", value: data.rentals.quoted, color: CHART_COLORS.primary },
    { name: "Closed", value: data.rentals.closed, color: CHART_COLORS.success },
  ];

  const callbackData = [
    {
      name: "Pending",
      value: data.support.callbacks.pending,
      color: CHART_COLORS.warning,
    },
    {
      name: "In Progress",
      value: data.support.callbacks.inProgress,
      color: CHART_COLORS.info,
    },
    {
      name: "Called",
      value: data.support.callbacks.called,
      color: CHART_COLORS.success,
    },
    {
      name: "Closed",
      value: data.support.callbacks.closed,
      color: CHART_COLORS.muted,
    },
  ];

  return (
    <>
      {/* Support Tickets + Callbacks + Rentals */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Support Tickets</CardTitle>
                <CardDescription>
                  {data.support.tickets.total} total this period
                </CardDescription>
              </div>
              <Badge
                variant={
                  data.support.tickets.highPriority > 0
                    ? "destructive"
                    : "secondary"
                }
              >
                {data.support.tickets.highPriority} high priority
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] w-full min-w-0">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={200}
                minHeight={180}
              >
                <PieChart>
                  <Pie
                    data={ticketData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {ticketData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              {ticketData.map((d) => (
                <MiniStat
                  key={d.name}
                  label={d.name}
                  value={d.value}
                  color={d.color}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Callback Requests</CardTitle>
            <CardDescription>
              {data.support.callbacks.total} total requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] w-full min-w-0">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={200}
                minHeight={180}
              >
                <PieChart>
                  <Pie
                    data={callbackData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {callbackData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              {callbackData.map((d) => (
                <MiniStat
                  key={d.name}
                  label={d.name}
                  value={d.value}
                  color={d.color}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Rental Requests</CardTitle>
                <CardDescription>
                  {data.rentals.total} this period
                </CardDescription>
              </div>
              {data.rentals.change !== 0 && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                    data.rentals.change >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {data.rentals.change >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(data.rentals.change)}%
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] w-full min-w-0">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={200}
                minHeight={180}
              >
                <PieChart>
                  <Pie
                    data={rentalData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {rentalData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              {rentalData.map((d) => (
                <MiniStat
                  key={d.name}
                  label={d.name}
                  value={d.value}
                  color={d.color}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews Deep Dive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review Analytics</CardTitle>
          <CardDescription>
            Rating distribution and approval status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-4 flex items-center gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">
                    {data.reviews.avgRating}
                  </span>
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{data.reviews.total} total reviews</p>
                  <p>
                    {data.reviews.approved} approved, {data.reviews.pending}{" "}
                    pending
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {data.reviews.distribution.map((d) => {
                  const percentage =
                    data.reviews.total > 0
                      ? Math.round((d.count / data.reviews.total) * 100)
                      : 0;
                  return (
                    <div key={d.rating} className="flex items-center gap-3">
                      <span className="w-12 text-sm font-medium">
                        {d.rating} star
                      </span>
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-amber-400 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs text-muted-foreground">
                        {d.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="h-[220px] w-full min-w-0">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={300}
                  minHeight={220}
                >
                  <BarChart data={data.reviews.distribution}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="rating"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}★`}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="count"
                      fill="#fbbf24"
                      radius={[4, 4, 0, 0]}
                      barSize={30}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Offers Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offer Performance</CardTitle>
            <CardDescription>Active offers and redemptions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">{data.offers.total}</p>
                <p className="text-xs text-muted-foreground">Total Offers</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {data.offers.active}
                </p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-indigo-600">
                  {formatNumber(data.offers.totalRedemptions)}
                </p>
                <p className="text-xs text-muted-foreground">Redemptions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform Health</CardTitle>
            <CardDescription>Key operational indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">Fleet Utilization</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-emerald-500 transition-all"
                      style={{
                        width: `${
                          data.overview.totalBuses > 0
                            ? Math.round(
                                (data.overview.activeBuses /
                                  data.overview.totalBuses) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {data.overview.totalBuses > 0
                      ? Math.round(
                          (data.overview.activeBuses /
                            data.overview.totalBuses) *
                            100,
                        )
                      : 0}
                    %
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">Ticket Resolution</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-indigo-500 transition-all"
                      style={{
                        width: `${
                          data.support.tickets.total > 0
                            ? Math.round(
                                ((data.support.tickets.resolved +
                                  data.support.tickets.closed) /
                                  data.support.tickets.total) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {data.support.tickets.total > 0
                      ? Math.round(
                          ((data.support.tickets.resolved +
                            data.support.tickets.closed) /
                            data.support.tickets.total) *
                            100,
                        )
                      : 0}
                    %
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">Cancellation Rate</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-rose-500 transition-all"
                      style={{
                        width: `${data.overview.cancellationRate}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {data.overview.cancellationRate}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">Review Approval</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-amber-500 transition-all"
                      style={{
                        width: `${
                          data.reviews.total > 0
                            ? Math.round(
                                (data.reviews.approved / data.reviews.total) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {data.reviews.total > 0
                      ? Math.round(
                          (data.reviews.approved / data.reviews.total) * 100,
                        )
                      : 0}
                    %
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
