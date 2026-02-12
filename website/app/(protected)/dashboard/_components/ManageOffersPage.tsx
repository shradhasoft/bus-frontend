"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  Eye,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
} from "lucide-react";

import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type OfferStatus = "active" | "upcoming" | "expired" | "inactive" | "deleted";
type DiscountType = "percentage" | "fixed";
type ApplicableFor = "all" | "routes" | "buses" | "users";

type OfferRecord = {
  id: string;
  title?: string | null;
  description?: string | null;
  code?: string | null;
  discountType?: DiscountType | string | null;
  discountValue?: number | null;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive?: boolean;
  isDeleted?: boolean;
  status?: OfferStatus | string | null;
  applicableFor?: ApplicableFor | string | null;
  specificRoutes?: string[];
  specificBuses?: string[];
  specificUsers?: string[];
  usageLimit?: number | null;
  usageLimitPerUser?: number | null;
  usedCount?: number;
  metadata?: Record<string, unknown>;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type OfferSummary = {
  total: number;
  active: number;
  upcoming: number;
  expired: number;
  inactive: number;
  deleted: number;
};

type OfferListResponse = {
  success?: boolean;
  message?: string;
  data?: OfferRecord[];
  total?: number;
  page?: number;
  totalPages?: number;
  summary?: OfferSummary;
};

type OfferDetailResponse = {
  success?: boolean;
  message?: string;
  data?: OfferRecord;
};

type OfferFormState = {
  title: string;
  description: string;
  code: string;
  discountType: DiscountType;
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  applicableFor: ApplicableFor;
  specificRoutes: string;
  specificBuses: string;
  specificUsers: string;
  usageLimit: string;
  usageLimitPerUser: string;
  metadataJson: string;
};

const EMPTY_SUMMARY: OfferSummary = {
  total: 0,
  active: 0,
  upcoming: 0,
  expired: 0,
  inactive: 0,
  deleted: 0,
};

const STATUS_STYLES: Record<OfferStatus, string> = {
  active:
    "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
  upcoming:
    "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200",
  expired:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
  inactive:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200",
  deleted:
    "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200",
};

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const normalizeStatus = (value?: string | null): OfferStatus => {
  if (
    value === "active" ||
    value === "upcoming" ||
    value === "expired" ||
    value === "inactive" ||
    value === "deleted"
  ) {
    return value;
  }
  return "inactive";
};

const formatDiscount = (row: OfferRecord) => {
  const value = Number(row.discountValue || 0);
  if (!Number.isFinite(value) || value <= 0) return "N/A";
  if (row.discountType === "percentage") {
    return `${value}%`;
  }
  return `₹${value.toFixed(2)}`;
};

const DEFAULT_FORM = (): OfferFormState => {
  const now = new Date();
  const until = new Date(now);
  until.setDate(until.getDate() + 7);

  return {
    title: "",
    description: "",
    code: "",
    discountType: "percentage",
    discountValue: "",
    minOrderAmount: "",
    maxDiscountAmount: "",
    validFrom: toDateTimeLocal(now.toISOString()),
    validUntil: toDateTimeLocal(until.toISOString()),
    isActive: true,
    applicableFor: "all",
    specificRoutes: "",
    specificBuses: "",
    specificUsers: "",
    usageLimit: "",
    usageLimitPerUser: "",
    metadataJson: "",
  };
};

const rowToForm = (row: OfferRecord): OfferFormState => ({
  title: row.title || "",
  description: row.description || "",
  code: row.code || "",
  discountType: row.discountType === "fixed" ? "fixed" : "percentage",
  discountValue:
    typeof row.discountValue === "number" ? String(row.discountValue) : "",
  minOrderAmount:
    typeof row.minOrderAmount === "number" ? String(row.minOrderAmount) : "",
  maxDiscountAmount:
    typeof row.maxDiscountAmount === "number" ? String(row.maxDiscountAmount) : "",
  validFrom: toDateTimeLocal(row.validFrom),
  validUntil: toDateTimeLocal(row.validUntil),
  isActive: row.isActive !== false,
  applicableFor:
    row.applicableFor === "routes" ||
    row.applicableFor === "buses" ||
    row.applicableFor === "users"
      ? row.applicableFor
      : "all",
  specificRoutes: Array.isArray(row.specificRoutes)
    ? row.specificRoutes.join(", ")
    : "",
  specificBuses: Array.isArray(row.specificBuses)
    ? row.specificBuses.join(", ")
    : "",
  specificUsers: Array.isArray(row.specificUsers)
    ? row.specificUsers.join(", ")
    : "",
  usageLimit: typeof row.usageLimit === "number" ? String(row.usageLimit) : "",
  usageLimitPerUser:
    typeof row.usageLimitPerUser === "number"
      ? String(row.usageLimitPerUser)
      : "",
  metadataJson:
    row.metadata && Object.keys(row.metadata).length > 0
      ? JSON.stringify(row.metadata, null, 2)
      : "",
});

const splitCommaValues = (value: string) =>
  Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const ManageOffersPage = () => {
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [summary, setSummary] = useState<OfferSummary>(EMPTY_SUMMARY);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [discountTypeFilter, setDiscountTypeFilter] = useState("");
  const [applicableForFilter, setApplicableForFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [selectedOffer, setSelectedOffer] = useState<OfferRecord | null>(null);
  const [formState, setFormState] = useState<OfferFormState>(DEFAULT_FORM());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<OfferRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const pageNumbers = useMemo(() => {
    const window = 2;
    const start = Math.max(1, page - window);
    const end = Math.min(totalPages, page + window);
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  }, [page, totalPages]);

  const loadOffers = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        params.set("status", statusFilter);
        if (search) params.set("search", search);
        if (discountTypeFilter) params.set("discountType", discountTypeFilter);
        if (applicableForFilter) params.set("applicableFor", applicableForFilter);

        const response = await fetch(apiUrl(`/admin/offers?${params.toString()}`), {
          method: "GET",
          credentials: "include",
          signal,
        });
        const payload = (await response.json().catch(() => ({}))) as OfferListResponse;
        if (!response.ok) {
          throw new Error(payload.message || "Failed to load offers.");
        }

        const rows = Array.isArray(payload.data) ? payload.data : [];
        const totalCount = Number(payload.total) || 0;

        setOffers(rows);
        setSummary(payload.summary || EMPTY_SUMMARY);
        setTotal(totalCount);

        const computedPages = Math.max(1, Math.ceil(totalCount / limit));
        if (page > computedPages) {
          setPage(computedPages);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || "Something went wrong.");
        }
      } finally {
        setLoading(false);
      }
    },
    [page, limit, statusFilter, search, discountTypeFilter, applicableForFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadOffers(controller.signal);
    return () => controller.abort();
  }, [loadOffers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchOfferDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(apiUrl(`/admin/offers/${id}`), {
        method: "GET",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => ({}))) as OfferDetailResponse;
      if (!response.ok) {
        throw new Error(payload.message || "Unable to load offer details.");
      }
      if (!payload.data) {
        throw new Error("Offer details are unavailable.");
      }
      return payload.data;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openCreate = () => {
    setFormMode("create");
    setSelectedOffer(null);
    setFormState(DEFAULT_FORM());
    setFormError(null);
    setFormOpen(true);
  };

  const openView = async (row: OfferRecord) => {
    setFormError(null);
    try {
      const detail = await fetchOfferDetail(row.id);
      setSelectedOffer(detail);
      setFormMode("view");
      setFormState(rowToForm(detail));
      setFormOpen(true);
    } catch (err) {
      setError((err as Error).message || "Unable to load offer details.");
    }
  };

  const openEdit = async (row: OfferRecord) => {
    setFormError(null);
    try {
      const detail = await fetchOfferDetail(row.id);
      setSelectedOffer(detail);
      setFormMode("edit");
      setFormState(rowToForm(detail));
      setFormOpen(true);
    } catch (err) {
      setError((err as Error).message || "Unable to load offer details.");
    }
  };

  const validateForm = () => {
    if (!formState.title.trim()) return "Title is required.";
    if (!formState.code.trim()) return "Code is required.";

    const discount = Number(formState.discountValue);
    if (!Number.isFinite(discount) || discount <= 0) {
      return "Discount value must be greater than 0.";
    }

    const validFrom = new Date(formState.validFrom);
    const validUntil = new Date(formState.validUntil);
    if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) {
      return "Valid from and valid until are required.";
    }
    if (validUntil <= validFrom) {
      return "Valid until must be after valid from.";
    }

    if (formState.applicableFor === "routes" && !formState.specificRoutes.trim()) {
      return "At least one route code is required for route-specific offers.";
    }
    if (formState.applicableFor === "buses" && !formState.specificBuses.trim()) {
      return "At least one bus ID is required for bus-specific offers.";
    }
    if (formState.applicableFor === "users" && !formState.specificUsers.trim()) {
      return "At least one user ID is required for user-specific offers.";
    }

    if (formState.metadataJson.trim()) {
      try {
        const parsed = JSON.parse(formState.metadataJson);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return "Metadata must be a JSON object.";
        }
      } catch {
        return "Metadata must be valid JSON.";
      }
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formMode === "view") return;

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const mode = formMode === "create" ? "create" : "edit";
    if (mode === "edit" && !selectedOffer?.id) {
      setFormError("Offer selection is missing.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const metadata = formState.metadataJson.trim()
        ? JSON.parse(formState.metadataJson)
        : {};

      const payload = {
        title: formState.title.trim(),
        description: formState.description.trim(),
        code: formState.code.trim().toUpperCase(),
        discountType: formState.discountType,
        discountValue: Number(formState.discountValue),
        minOrderAmount: formState.minOrderAmount.trim()
          ? Number(formState.minOrderAmount)
          : null,
        maxDiscountAmount: formState.maxDiscountAmount.trim()
          ? Number(formState.maxDiscountAmount)
          : null,
        validFrom: new Date(formState.validFrom).toISOString(),
        validUntil: new Date(formState.validUntil).toISOString(),
        isActive: formState.isActive,
        applicableFor: formState.applicableFor,
        specificRoutes:
          formState.applicableFor === "routes"
            ? splitCommaValues(formState.specificRoutes).map((item) =>
                item.toUpperCase(),
              )
            : [],
        specificBuses:
          formState.applicableFor === "buses"
            ? splitCommaValues(formState.specificBuses)
            : [],
        specificUsers:
          formState.applicableFor === "users"
            ? splitCommaValues(formState.specificUsers)
            : [],
        usageLimit: formState.usageLimit.trim() ? Number(formState.usageLimit) : null,
        usageLimitPerUser: formState.usageLimitPerUser.trim()
          ? Number(formState.usageLimitPerUser)
          : null,
        metadata,
      };

      const endpoint =
        mode === "create"
          ? apiUrl("/admin/offers")
          : apiUrl(`/admin/offers/${encodeURIComponent(selectedOffer?.id || "")}`);

      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to save offer.");
      }

      setFormOpen(false);
      setSelectedOffer(null);
      setFormState(DEFAULT_FORM());
      const controller = new AbortController();
      await loadOffers(controller.signal);
    } catch (err) {
      setFormError((err as Error).message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(
        apiUrl(`/admin/offers/${encodeURIComponent(deleteTarget.id)}`),
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete offer.");
      }
      setDeleteTarget(null);
      const controller = new AbortController();
      await loadOffers(controller.signal);
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally {
      setDeleting(false);
    }
  };

  const startIndex = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = total === 0 ? 0 : Math.min(page * limit, total);
  const isReadOnly = formMode === "view";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Manage Offers
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Offers</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
            {total.toLocaleString()} total - page {page} of {totalPages}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-900"
        >
          <Plus className="h-4 w-4" />
          Add Offer
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Total
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {summary.total}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/15">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-200">
            Active
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-800 dark:text-emerald-100">
            {summary.active}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 p-4 shadow-sm dark:border-sky-500/40 dark:bg-sky-500/15">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-700 dark:text-sky-200">
            Upcoming
          </p>
          <p className="mt-2 text-2xl font-semibold text-sky-800 dark:text-sky-100">
            {summary.upcoming}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/15">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-700 dark:text-amber-200">
            Expired
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-800 dark:text-amber-100">
            {summary.expired}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-slate-100/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/10">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300">
            Inactive
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-white">
            {summary.inactive}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 p-4 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/15">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-700 dark:text-rose-200">
            Deleted
          </p>
          <p className="mt-2 text-2xl font-semibold text-rose-800 dark:text-rose-100">
            {summary.deleted}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.1)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search title, code..."
              className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="expired">Expired</option>
            <option value="inactive">Inactive</option>
            <option value="deleted">Deleted</option>
          </select>

          <select
            value={discountTypeFilter}
            onChange={(event) => {
              setDiscountTypeFilter(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="">All discount types</option>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </select>

          <select
            value={applicableForFilter}
            onChange={(event) => {
              setApplicableForFilter(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="">All scopes</option>
            <option value="all">All</option>
            <option value="routes">Routes</option>
            <option value="buses">Buses</option>
            <option value="users">Users</option>
          </select>

          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.1)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
        <div className="max-h-[620px] overflow-auto no-scrollbar">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100/95 text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Offer</th>
                <th className="px-6 py-4 font-semibold">Code</th>
                <th className="px-6 py-4 font-semibold">Discount</th>
                <th className="px-6 py-4 font-semibold">Scope</th>
                <th className="px-6 py-4 font-semibold">Usage</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Validity</th>
                <th className="px-6 py-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500 dark:text-slate-300">
                    Loading offers...
                  </td>
                </tr>
              ) : offers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500 dark:text-slate-300">
                    No offers found.
                  </td>
                </tr>
              ) : (
                offers.map((row) => {
                  const status = normalizeStatus(row.status);
                  return (
                    <tr
                      key={row.id}
                      className="bg-white/60 transition hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {row.title || "Untitled Offer"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {row.description || "No description"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                          <Tag className="h-3.5 w-3.5" />
                          {row.code || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        <div>{formatDiscount(row)}</div>
                        {typeof row.minOrderAmount === "number" ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Min ₹{row.minOrderAmount.toFixed(2)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        {row.applicableFor || "all"}
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        <div>
                          {Number(row.usedCount || 0)} /{" "}
                          {typeof row.usageLimit === "number" ? row.usageLimit : "∞"}
                        </div>
                        {typeof row.usageLimitPerUser === "number" ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Per user: {row.usageLimitPerUser}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                            STATUS_STYLES[status],
                          )}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        <div className="text-xs">From: {formatDate(row.validFrom)}</div>
                        <div className="text-xs">To: {formatDate(row.validUntil)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openView(row)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row)}
                            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 px-6 py-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          <span>
            Showing {startIndex} - {endIndex} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300"
            >
              Prev
            </button>
            {pageNumbers.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPage(value)}
                className={cn(
                  "rounded-lg border px-3 py-1",
                  value === page
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                    : "border-slate-200/80 text-slate-600 dark:border-white/10 dark:text-slate-300",
                )}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300"
            >
              Last
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgePercent className="h-5 w-5" />
              {formMode === "create"
                ? "Create offer"
                : formMode === "edit"
                  ? "Edit offer"
                  : "Offer details"}
            </DialogTitle>
            <DialogDescription>
              {formMode === "create"
                ? "Create a new promotional offer for user bookings."
                : formMode === "edit"
                  ? "Update offer rules, validity, and targeting."
                  : "Review full offer configuration and constraints."}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Loading offer details...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Title
                  </label>
                  <Input
                    value={formState.title}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, title: event.target.value }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Promo Code
                  </label>
                  <Input
                    value={formState.code}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Description
                </label>
                <Input
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, description: event.target.value }))
                  }
                  disabled={isReadOnly || submitting}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Discount Type
                  </label>
                  <select
                    value={formState.discountType}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        discountType: event.target.value as DiscountType,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Discount Value
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.discountValue}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, discountValue: event.target.value }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Active
                  </label>
                  <select
                    value={formState.isActive ? "true" : "false"}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        isActive: event.target.value === "true",
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Valid From
                  </label>
                  <Input
                    type="datetime-local"
                    value={formState.validFrom}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, validFrom: event.target.value }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Valid Until
                  </label>
                  <Input
                    type="datetime-local"
                    value={formState.validUntil}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, validUntil: event.target.value }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Min Order Amount
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.minOrderAmount}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, minOrderAmount: event.target.value }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Max Discount Amount
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.maxDiscountAmount}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, maxDiscountAmount: event.target.value }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Scope
                  </label>
                  <select
                    value={formState.applicableFor}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        applicableFor: event.target.value as ApplicableFor,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="all">All</option>
                    <option value="routes">Routes</option>
                    <option value="buses">Buses</option>
                    <option value="users">Users</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Usage Limit
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={formState.usageLimit}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, usageLimit: event.target.value }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Per User Limit
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={formState.usageLimitPerUser}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        usageLimitPerUser: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>

              {formState.applicableFor === "routes" ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Route Codes (comma-separated)
                  </label>
                  <Input
                    value={formState.specificRoutes}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, specificRoutes: event.target.value }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
              ) : null}

              {formState.applicableFor === "buses" ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Bus IDs (comma-separated)
                  </label>
                  <Input
                    value={formState.specificBuses}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, specificBuses: event.target.value }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
              ) : null}

              {formState.applicableFor === "users" ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    User IDs (comma-separated)
                  </label>
                  <Input
                    value={formState.specificUsers}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, specificUsers: event.target.value }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Metadata JSON (optional)
                </label>
                <textarea
                  value={formState.metadataJson}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, metadataJson: event.target.value }))
                  }
                  disabled={isReadOnly || submitting}
                  rows={4}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              {formError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
                  {formError}
                </div>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  Close
                </Button>
                {!isReadOnly ? (
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : "Save"}
                  </Button>
                ) : null}
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete offer</DialogTitle>
            <DialogDescription>
              This will soft delete{" "}
              <strong>{deleteTarget?.code || deleteTarget?.title || "selected offer"}</strong>
              . Existing bookings keep their historical pricing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageOffersPage;
