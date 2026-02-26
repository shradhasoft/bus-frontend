"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bus, Eye, Loader2, RefreshCw, Search } from "lucide-react";

import { apiUrl } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import BoardedUsersBlueprint from "@/app/(protected)/conductor/dashboard/boarded-users/_components/boarded-users-blueprint";

type BusRow = {
  _id: string;
  busName?: string | null;
  busNumber?: string | null;
  operator?: string | null;
  busOwnerEmail?: string | null;
  totalSeats?: number;
  availableSeats?: number;
  isActive?: boolean;
  features?: {
    busType?: string | null;
  } | null;
  route?: {
    routeCode?: string | null;
    origin?: string | null;
    destination?: string | null;
  } | null;
  updatedAt?: string;
};

type TextFilters = {
  search: string;
  ownerEmail: string;
  operator: string;
  routeCode: string;
};

const BUS_TYPE_OPTIONS = [
  "Sleeper",
  "Seater",
  "Semi-Sleeper",
  "Luxury",
  "AC",
  "Non-AC",
  "Volvo",
];

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getBusName = (bus: BusRow) =>
  bus.busName?.trim() || bus.busNumber?.trim() || "Unnamed bus";

const getBusRouteLabel = (bus: BusRow) => {
  if (bus.route?.origin && bus.route?.destination) {
    return `${bus.route.origin} -> ${bus.route.destination}`;
  }
  return "-";
};

const getRoleScopeLabel = (pathname: string) =>
  pathname.startsWith("/super-admin/")
    ? "Super Admin Fleet Ops"
    : "Admin Fleet Ops";

const buildPathWithQuery = (pathname: string, params: URLSearchParams) => {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};

export default function AdminBoardedUsersHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedBusId = String(searchParams.get("busId") || "").trim();
  const isBlueprintView = selectedBusId.length > 0;

  const [buses, setBuses] = useState<BusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(Math.max(total, 0) / limit)),
    [limit, total],
  );

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [busTypeFilter, setBusTypeFilter] = useState("");
  const [textFilters, setTextFilters] = useState<TextFilters>({
    search: "",
    ownerEmail: "",
    operator: "",
    routeCode: "",
  });
  const [debouncedTextFilters, setDebouncedTextFilters] = useState<TextFilters>({
    search: "",
    ownerEmail: "",
    operator: "",
    routeCode: "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedTextFilters({
        search: textFilters.search.trim(),
        ownerEmail: textFilters.ownerEmail.trim(),
        operator: textFilters.operator.trim(),
        routeCode: textFilters.routeCode.trim(),
      });
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [textFilters]);

  const hasActiveFilters = useMemo(
    () =>
      statusFilter !== "all" ||
      Boolean(busTypeFilter) ||
      Boolean(textFilters.search.trim()) ||
      Boolean(textFilters.ownerEmail.trim()) ||
      Boolean(textFilters.operator.trim()) ||
      Boolean(textFilters.routeCode.trim()),
    [busTypeFilter, statusFilter, textFilters],
  );

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

  const loadBuses = useCallback(
    async (options?: { background?: boolean }) => {
      const isBackground = Boolean(options?.background);
      if (isBackground) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const headers = await buildHeaders();
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (debouncedTextFilters.search) {
          params.set("search", debouncedTextFilters.search);
        }
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (busTypeFilter) {
          params.set("busType", busTypeFilter);
        }
        if (debouncedTextFilters.ownerEmail) {
          params.set("ownerEmail", debouncedTextFilters.ownerEmail);
        }
        if (debouncedTextFilters.operator) {
          params.set("operator", debouncedTextFilters.operator);
        }
        if (debouncedTextFilters.routeCode) {
          params.set("routeCode", debouncedTextFilters.routeCode);
        }

        const response = await fetch(apiUrl(`/admin/buses?${params.toString()}`), {
          method: "GET",
          credentials: "include",
          headers,
          cache: "no-store",
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to load buses.");
        }

        const data = payload?.data ?? {};
        const rows = Array.isArray(data?.buses) ? data.buses : [];
        setBuses(rows);
        setTotal(Number(data?.total) || 0);
      } catch (requestError) {
        setBuses([]);
        setTotal(0);
        setError((requestError as Error).message || "Unable to load buses.");
      } finally {
        if (isBackground) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [buildHeaders, busTypeFilter, debouncedTextFilters, limit, page, statusFilter],
  );

  useEffect(() => {
    if (isBlueprintView) return;
    void loadBuses();
  }, [isBlueprintView, loadBuses]);

  useEffect(() => {
    if (isBlueprintView) return;
    const timer = window.setInterval(() => {
      void loadBuses({ background: true });
    }, 30000);
    return () => {
      window.clearInterval(timer);
    };
  }, [isBlueprintView, loadBuses]);

  const clearFilters = () => {
    setStatusFilter("all");
    setBusTypeFilter("");
    setTextFilters({
      search: "",
      ownerEmail: "",
      operator: "",
      routeCode: "",
    });
    setPage(1);
  };

  const openBlueprint = (busId: string) => {
    if (!busId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("busId", busId);
    router.push(buildPathWithQuery(pathname, params));
  };

  const closeBlueprint = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("busId");
    router.push(buildPathWithQuery(pathname, params));
  };

  const startIndex = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = total === 0 ? 0 : Math.min(page * limit, total);

  if (isBlueprintView) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={closeBlueprint}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Bus List
        </button>
        <BoardedUsersBlueprint mode="admin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {getRoleScopeLabel(pathname)}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Boarded Users
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Search buses, apply filters, and open boarded-seat blueprint.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadBuses({ background: true })}
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

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900/70">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Search
            </span>
            <span className="mt-1 flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 dark:border-white/10 dark:bg-white/5">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={textFilters.search}
                onChange={(event) => {
                  setTextFilters((prev) => ({ ...prev, search: event.target.value }));
                  setPage(1);
                }}
                placeholder="Bus name, number, route, owner..."
                className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200"
              />
            </span>
          </label>

          <label>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as "all" | "active" | "inactive");
                setPage(1);
              }}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:[color-scheme:dark]"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <label>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Bus Type
            </span>
            <select
              value={busTypeFilter}
              onChange={(event) => {
                setBusTypeFilter(event.target.value);
                setPage(1);
              }}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:[color-scheme:dark]"
            >
              <option value="">All types</option>
              {BUS_TYPE_OPTIONS.map((busType) => (
                <option key={busType} value={busType}>
                  {busType}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Operator
            </span>
            <input
              value={textFilters.operator}
              onChange={(event) => {
                setTextFilters((prev) => ({ ...prev, operator: event.target.value }));
                setPage(1);
              }}
              placeholder="Filter operator"
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            />
          </label>

          <label>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Owner Email
            </span>
            <input
              value={textFilters.ownerEmail}
              onChange={(event) => {
                setTextFilters((prev) => ({ ...prev, ownerEmail: event.target.value }));
                setPage(1);
              }}
              placeholder="owner@example.com"
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            />
          </label>

          <label>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Route Code
            </span>
            <input
              value={textFilters.routeCode}
              onChange={(event) => {
                setTextFilters((prev) => ({ ...prev, routeCode: event.target.value }));
                setPage(1);
              }}
              placeholder="BHU-KJR"
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {startIndex} - {endIndex} of {total.toLocaleString()} buses
          </p>
          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:[color-scheme:dark]"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900/70">
        <div className="max-h-[620px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100/95 text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Bus</th>
                <th className="px-6 py-4 font-semibold">Operator</th>
                <th className="px-6 py-4 font-semibold">Route</th>
                <th className="px-6 py-4 font-semibold">Owner</th>
                <th className="px-6 py-4 font-semibold">Seats</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Updated</th>
                <th className="px-6 py-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300"
                  >
                    Loading buses...
                  </td>
                </tr>
              ) : buses.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300"
                  >
                    No buses match current filters.
                  </td>
                </tr>
              ) : (
                buses.map((bus) => (
                  <tr
                    key={bus._id}
                    className="bg-white/60 transition hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                          <Bus className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {getBusName(bus)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {bus.busNumber || "-"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                      {bus.operator || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-700 dark:text-slate-200">
                        {getBusRouteLabel(bus)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {bus.route?.routeCode || "-"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                      {bus.busOwnerEmail || "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                      {bus.availableSeats ?? "-"} / {bus.totalSeats ?? "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                      {bus.features?.busType || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                          bus.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200"
                            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
                        )}
                      >
                        {bus.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                      {formatDate(bus.updatedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => openBlueprint(bus._id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:-translate-y-0.5 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-200"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View Blueprint
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/70 px-6 py-4 text-xs dark:border-white/10">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            First
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            Prev
          </button>
          <span className="rounded-lg bg-slate-900 px-3 py-1 font-semibold text-white dark:bg-white dark:text-slate-900">
            {page}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            Last
          </button>
        </div>
      </section>
    </div>
  );
}
