import React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Flag,
  Flame,
  MapPinned,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Manrope, Space_Grotesk } from "next/font/google";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-dash-display",
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-dash-body",
});

type Metric = {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "flat";
  hint: string;
};

type Activity = {
  title: string;
  meta: string;
  status: "good" | "warn" | "risk";
  tag: string;
};

type QuickAction = {
  label: string;
  description: string;
};

type Alert = {
  title: string;
  detail: string;
  tone: "info" | "warning" | "danger";
};

type TimelineItem = {
  time: string;
  title: string;
  detail: string;
};

type Accent = {
  from: string;
  to: string;
  glow: string;
  tint: string;
};

type RoleDashboardProps = {
  title: string;
  subtitle: string;
  roleLabel: string;
  accent: Accent;
  navItems: string[];
  metrics: Metric[];
  spotlight: {
    title: string;
    description: string;
    stats: { label: string; value: string }[];
  };
  activities: Activity[];
  actions: QuickAction[];
  alerts: Alert[];
  timeline: TimelineItem[];
};

const trendStyles: Record<Metric["trend"], {
  icon: React.ReactNode;
  className: string;
}> = {
  up: {
    icon: <ArrowUpRight className="h-4 w-4" />,
    className: "text-emerald-600 bg-emerald-50",
  },
  down: {
    icon: <ArrowDownRight className="h-4 w-4" />,
    className: "text-rose-600 bg-rose-50",
  },
  flat: {
    icon: <ArrowUpRight className="h-4 w-4 rotate-45" />,
    className: "text-slate-600 bg-slate-100",
  },
};

const statusStyles: Record<Activity["status"], string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  risk: "bg-rose-500",
};

const alertStyles: Record<Alert["tone"], string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
};

const RoleDashboard = ({
  title,
  subtitle,
  roleLabel,
  accent,
  navItems,
  metrics,
  spotlight,
  activities,
  actions,
  alerts,
  timeline,
}: RoleDashboardProps) => {
  return (
    <div
      className={`${displayFont.variable} ${bodyFont.variable} font-[var(--font-dash-body)] relative min-h-screen overflow-hidden bg-[#f6f2ea] text-slate-900 dark:bg-slate-950 dark:text-white`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-32 -left-24 h-80 w-80 rounded-full blur-3xl opacity-45"
          style={{ background: accent.glow }}
        />
        <div
          className="absolute top-32 right-0 h-96 w-96 rounded-full blur-3xl opacity-35"
          style={{ background: accent.tint }}
        />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/70 to-transparent dark:from-slate-900/70" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-14 pt-10 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              {roleLabel}
            </p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white md:text-4xl font-[var(--font-dash-display)]">
              {title}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-300">
              {subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
              <Sparkles className="h-4 w-4" />
              Live Control
            </span>
            <button className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-md shadow-slate-900/20 transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-white dark:text-slate-900">
              <ShieldCheck className="h-4 w-4" />
              Secure Ops
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr_320px]">
          <aside className="order-2 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60 lg:order-none lg:sticky lg:top-8">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Command Deck</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Navigation stack
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2 text-sm">
              {navItems.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-2xl border border-transparent bg-slate-50 px-4 py-3 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-200/80 hover:bg-white hover:shadow-sm dark:bg-slate-900/40 dark:text-slate-200 dark:hover:border-white/10"
                >
                  <span>{item}</span>
                  <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200/60 bg-white/70 p-4 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-[0.2em]">
                  System Pulse
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Stable
                </span>
              </div>
              <p className="mt-3 leading-relaxed">
                Processing speed is steady and all critical services are green.
              </p>
            </div>
          </aside>

          <main className="order-1 space-y-6 lg:order-none">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => {
                const trend = trendStyles[metric.trend];
                return (
                  <div
                    key={metric.label}
                    className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        {metric.label}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${trend.className}`}
                      >
                        {trend.icon}
                        {metric.change}
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                      {metric.value}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {metric.hint}
                    </p>
                  </div>
                );
              })}
            </section>

            <section
              className="rounded-3xl p-6 shadow-[0_25px_60px_rgba(15,23,42,0.12)]"
              style={{
                backgroundImage: `linear-gradient(120deg, ${accent.from}, ${accent.to})`,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
                    Spotlight
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950 font-[var(--font-dash-display)]">
                    {spotlight.title}
                  </h2>
                  <p className="mt-2 max-w-lg text-sm text-slate-700">
                    {spotlight.description}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-md shadow-slate-900/20 transition hover:-translate-y-0.5">
                    <Flag className="h-4 w-4" />
                    Escalate
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-full border border-slate-900/20 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-800">
                    <FileText className="h-4 w-4" />
                    Report
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {spotlight.stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-slate-800"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-600">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_25px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Live activities
                    </p>
                    <h3 className="mt-2 text-lg font-semibold">Operational feed</h3>
                  </div>
                  <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">
                    View all
                  </button>
                </div>
                <div className="mt-5 space-y-3">
                  {activities.map((activity) => (
                    <div
                      key={activity.title}
                      className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {activity.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {activity.meta}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
                          {activity.tag}
                        </span>
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${statusStyles[activity.status]}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_25px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Workflows
                    </p>
                    <h3 className="mt-2 text-lg font-semibold">
                      Pipeline health
                    </h3>
                  </div>
                  <Flame className="h-5 w-5 text-amber-500" />
                </div>
                <div className="mt-5 space-y-4">
                  {actions.map((action) => (
                    <div
                      key={action.label}
                      className="rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200"
                    >
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {action.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {action.description}
                      </p>
                      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200/70 dark:bg-slate-700">
                        <div
                          className="h-1.5 rounded-full bg-slate-900 dark:bg-white"
                          style={{ width: "72%" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </main>

          <aside className="order-3 space-y-5 lg:order-none lg:sticky lg:top-8">
            <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Alerts
                </p>
                <Bell className="h-4 w-4 text-slate-500" />
              </div>
              <div className="mt-4 space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.title}
                    className={`rounded-2xl border px-4 py-3 text-xs ${alertStyles[alert.tone]}`}
                  >
                    <p className="font-semibold">{alert.title}</p>
                    <p className="mt-1 text-[11px] opacity-80">
                      {alert.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Shift timeline
                </p>
                <CalendarClock className="h-4 w-4 text-slate-500" />
              </div>
              <div className="mt-4 space-y-4">
                {timeline.map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {item.time}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Compliance
                </p>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/50">
                  <span className="text-slate-600 dark:text-slate-300">
                    Audit sync
                  </span>
                  <span className="text-xs font-semibold text-emerald-600">
                    Passing
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/50">
                  <span className="text-slate-600 dark:text-slate-300">
                    Safety checks
                  </span>
                  <span className="text-xs font-semibold text-emerald-600">
                    98%
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-900/50">
                  <span className="text-slate-600 dark:text-slate-300">
                    Response SLA
                  </span>
                  <span className="text-xs font-semibold text-amber-500">
                    2 hrs
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_25px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Field map
                </p>
                <MapPinned className="h-4 w-4 text-slate-500" />
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-5 text-white shadow-inner">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Zones active
                </p>
                <p className="mt-2 text-2xl font-semibold">12 live</p>
                <div className="mt-4 flex gap-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <span
                      key={`zone-${index}`}
                      className="h-3 w-3 rounded-full bg-emerald-400"
                    />
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default RoleDashboard;
