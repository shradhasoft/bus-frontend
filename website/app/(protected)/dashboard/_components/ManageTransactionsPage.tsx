"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CircleCheckBig,
  CircleX,
  Eye,
  Pencil,
  Plus,
  Search,
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

type TransactionStatus =
  | "pending"
  | "success"
  | "failed"
  | "refunded"
  | "partial_refund";

type TransactionMethod =
  | "credit_card"
  | "debit_card"
  | "netbanking"
  | "upi"
  | "wallet"
  | "razorpay"
  | "card"
  | "emi";

type BookingSnapshot = {
  id?: string | null;
  bookingId?: string | null;
  travelDate?: string | null;
  boardingPoint?: string | null;
  droppingPoint?: string | null;
  bookingStatus?: string | null;
  paymentStatus?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
};

type UserSnapshot = {
  id?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
};

type RefundRecord = {
  amount?: number;
  reason?: string;
  processedAt?: string;
  gatewayRefundId?: string;
  status?: "pending" | "processed" | "failed";
};

type TransactionRecord = {
  id: string;
  paymentId?: string | null;
  amount?: number | null;
  currency?: string | null;
  method?: TransactionMethod | string | null;
  status?: TransactionStatus | string | null;
  attempts?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  gatewayReference?: string | null;
  refunds?: RefundRecord[];
  gatewayResponse?: Record<string, unknown>;
  booking?: BookingSnapshot | null;
  user?: UserSnapshot | null;
};

type TransactionSummary = {
  total: number;
  pending: number;
  success: number;
  failed: number;
  refunded: number;
  partial_refund: number;
};

type TransactionListResponse = {
  success?: boolean;
  message?: string;
  data?: TransactionRecord[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  summary?: TransactionSummary;
};

type TransactionDetailResponse = {
  success?: boolean;
  message?: string;
  data?: TransactionRecord;
};

type TransactionFormState = {
  bookingRef: string;
  paymentId: string;
  amount: string;
  currency: "INR" | "USD" | "EUR";
  method: TransactionMethod;
  status: TransactionStatus;
  attempts: string;
  gatewayReference: string;
  adminNote: string;
};

const EMPTY_SUMMARY: TransactionSummary = {
  total: 0,
  pending: 0,
  success: 0,
  failed: 0,
  refunded: 0,
  partial_refund: 0,
};

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "Pending",
  success: "Success",
  failed: "Failed",
  refunded: "Refunded",
  partial_refund: "Partial Refund",
};

const STATUS_STYLES: Record<TransactionStatus, string> = {
  pending:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
  success:
    "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
  failed:
    "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200",
  refunded:
    "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700 dark:border-fuchsia-500/40 dark:bg-fuchsia-500/15 dark:text-fuchsia-200",
  partial_refund:
    "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-200",
};

const DEFAULT_FORM: TransactionFormState = {
  bookingRef: "",
  paymentId: "",
  amount: "",
  currency: "INR",
  method: "razorpay",
  status: "pending",
  attempts: "1",
  gatewayReference: "",
  adminNote: "",
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatCurrency = (value?: number | null, currency = "INR") => {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

const formatMethodLabel = (method?: string | null) => {
  if (!method) return "N/A";
  return method
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

const normalizeStatus = (value?: string | null): TransactionStatus => {
  switch (value) {
    case "success":
    case "failed":
    case "refunded":
    case "partial_refund":
    case "pending":
      return value;
    default:
      return "pending";
  }
};

const getDisplayUser = (record: TransactionRecord) =>
  record.user?.fullName || record.user?.email || "Unknown user";

const getInitials = (value: string) => {
  const parts = value.trim().split(" ").filter(Boolean);
  if (!parts.length) return "U";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

const recordToForm = (record: TransactionRecord): TransactionFormState => ({
  bookingRef: record.booking?.bookingId || "",
  paymentId: record.paymentId || "",
  amount:
    typeof record.amount === "number" && Number.isFinite(record.amount)
      ? String(record.amount)
      : "",
  currency:
    record.currency === "USD" || record.currency === "EUR"
      ? record.currency
      : "INR",
  method:
    record.method === "credit_card" ||
    record.method === "debit_card" ||
    record.method === "netbanking" ||
    record.method === "upi" ||
    record.method === "wallet" ||
    record.method === "card" ||
    record.method === "emi"
      ? record.method
      : "razorpay",
  status: normalizeStatus(record.status),
  attempts:
    typeof record.attempts === "number" && Number.isFinite(record.attempts)
      ? String(record.attempts)
      : "1",
  gatewayReference: record.gatewayReference || "",
  adminNote:
    typeof record.gatewayResponse?.adminNote === "string"
      ? record.gatewayResponse.adminNote
      : "",
});

const ManageTransactionsPage = () => {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [summary, setSummary] = useState<TransactionSummary>(EMPTY_SUMMARY);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [sort, setSort] = useState("-createdAt");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionRecord | null>(null);
  const [formState, setFormState] = useState<TransactionFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TransactionRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = useMemo(() => {
    if (!total) return 1;
    return Math.max(1, Math.ceil(total / limit));
  }, [limit, total]);

  const pageNumbers = useMemo(() => {
    const window = 2;
    const start = Math.max(1, page - window);
    const end = Math.min(totalPages, page + window);
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  }, [page, totalPages]);

  const loadTransactions = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        params.set("sort", sort);
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        if (methodFilter) params.set("method", methodFilter);
        if (currencyFilter) params.set("currency", currencyFilter);
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);

        const response = await fetch(
          apiUrl(`/admin/transactions?${params.toString()}`),
          {
            method: "GET",
            credentials: "include",
            signal,
          }
        );

        const payload = (await response.json().catch(() => ({}))) as TransactionListResponse;
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load transactions.");
        }

        const rows = Array.isArray(payload.data) ? payload.data : [];
        const totalCount = Number(payload.total) || 0;

        setTransactions(rows);
        setSummary(payload.summary ?? EMPTY_SUMMARY);
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
    [currencyFilter, fromDate, limit, methodFilter, page, search, sort, statusFilter, toDate]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadTransactions(controller.signal);
    return () => controller.abort();
  }, [loadTransactions]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchTransactionDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(apiUrl(`/admin/transactions/${id}`), {
        method: "GET",
        credentials: "include",
      });

      const payload = (await response.json().catch(() => ({}))) as TransactionDetailResponse;
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load transaction details.");
      }
      if (!payload.data) {
        throw new Error("Transaction details are unavailable.");
      }
      return payload.data;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openCreate = () => {
    setFormMode("create");
    setSelectedTransaction(null);
    setFormState(DEFAULT_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openView = async (record: TransactionRecord) => {
    setFormError(null);
    try {
      const detail = await fetchTransactionDetail(record.id);
      setSelectedTransaction(detail);
      setFormMode("view");
      setFormState(recordToForm(detail));
      setFormOpen(true);
    } catch (err) {
      setError((err as Error).message || "Unable to load transaction details.");
    }
  };

  const openEdit = async (record: TransactionRecord) => {
    setFormError(null);
    try {
      const detail = await fetchTransactionDetail(record.id);
      setSelectedTransaction(detail);
      setFormMode("edit");
      setFormState(recordToForm(detail));
      setFormOpen(true);
    } catch (err) {
      setError((err as Error).message || "Unable to load transaction details.");
    }
  };

  const validateForm = (mode: "create" | "edit") => {
    if (mode === "create" && !formState.bookingRef.trim()) {
      return "Booking ID is required for transaction creation.";
    }

    const amountValue = Number(formState.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return "Amount must be greater than 0.";
    }

    const attemptsValue = Number(formState.attempts);
    if (!Number.isInteger(attemptsValue) || attemptsValue < 1) {
      return "Attempts must be a whole number greater than 0.";
    }

    return null;
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formMode === "view") return;

    const mode = formMode === "create" ? "create" : "edit";
    if (mode === "edit" && !selectedTransaction?.id) {
      setFormError("Select a transaction to edit.");
      return;
    }

    const validationError = validateForm(mode);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const gatewayResponsePayload: Record<string, unknown> = {};
      if (formState.adminNote.trim()) {
        gatewayResponsePayload.adminNote = formState.adminNote.trim();
      }

      const payload = {
        ...(mode === "create"
          ? {
              bookingId: formState.bookingRef.trim(),
              paymentId: formState.paymentId.trim() || undefined,
            }
          : {}),
        amount: Number(formState.amount),
        currency: formState.currency,
        method: formState.method,
        status: formState.status,
        attempts: Number(formState.attempts),
        gatewayReference: formState.gatewayReference.trim() || undefined,
        gatewayResponse:
          Object.keys(gatewayResponsePayload).length > 0
            ? gatewayResponsePayload
            : undefined,
      };

      const endpoint =
        mode === "create"
          ? apiUrl("/admin/transactions")
          : apiUrl(`/admin/transactions/${encodeURIComponent(selectedTransaction?.id || "")}`);

      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to save transaction.");
      }

      setFormOpen(false);
      setSelectedTransaction(null);
      setFormState(DEFAULT_FORM);

      const controller = new AbortController();
      await loadTransactions(controller.signal);
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
        apiUrl(`/admin/transactions/${encodeURIComponent(deleteTarget.id)}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete transaction.");
      }
      setDeleteTarget(null);
      const controller = new AbortController();
      await loadTransactions(controller.signal);
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
    <div className="relative space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Manage Transactions
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Transactions
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
            {total.toLocaleString()} total - page {page} of {totalPages}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-900"
          >
            <Plus className="h-4 w-4" />
            Add Transaction
          </button>
        </div>
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
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/15">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-700 dark:text-amber-200">
            Pending
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-800 dark:text-amber-100">
            {summary.pending}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/15">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-200">
            Success
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-800 dark:text-emerald-100">
            {summary.success}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 p-4 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/15">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-700 dark:text-rose-200">
            Failed
          </p>
          <p className="mt-2 text-2xl font-semibold text-rose-800 dark:text-rose-100">
            {summary.failed}
          </p>
        </div>
        <div className="rounded-2xl border border-fuchsia-200/80 bg-fuchsia-50/80 p-4 shadow-sm dark:border-fuchsia-500/40 dark:bg-fuchsia-500/15">
          <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-700 dark:text-fuchsia-200">
            Refunded
          </p>
          <p className="mt-2 text-2xl font-semibold text-fuchsia-800 dark:text-fuchsia-100">
            {summary.refunded}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-200/80 bg-violet-50/80 p-4 shadow-sm dark:border-violet-500/40 dark:bg-violet-500/15">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-700 dark:text-violet-200">
            Partial Refund
          </p>
          <p className="mt-2 text-2xl font-semibold text-violet-800 dark:text-violet-100">
            {summary.partial_refund}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.1)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search payment, booking, user..."
              className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="partial_refund">Partial refund</option>
          </select>

          <select
            value={methodFilter}
            onChange={(event) => {
              setMethodFilter(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="">All methods</option>
            <option value="razorpay">Razorpay</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="credit_card">Credit Card</option>
            <option value="debit_card">Debit Card</option>
            <option value="netbanking">Netbanking</option>
            <option value="wallet">Wallet</option>
            <option value="emi">EMI</option>
          </select>

          <select
            value={currencyFilter}
            onChange={(event) => {
              setCurrencyFilter(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="">All currencies</option>
            <option value="INR">INR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>

          <Input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border-slate-200/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-900/70"
          />

          <Input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border-slate-200/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-slate-900/70"
          />

          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="-createdAt">Latest created</option>
            <option value="createdAt">Earliest created</option>
            <option value="-updatedAt">Latest updated</option>
            <option value="updatedAt">Earliest updated</option>
            <option value="-amount">Highest amount</option>
            <option value="amount">Lowest amount</option>
          </select>

          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
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
                <th className="px-6 py-4 font-semibold">Transaction</th>
                <th className="px-6 py-4 font-semibold">Booking</th>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Method</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Created</th>
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
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300"
                  >
                    No transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((record) => {
                  const status = normalizeStatus(record.status);
                  const displayUser = getDisplayUser(record);
                  return (
                    <tr
                      key={record.id}
                      className="bg-white/60 transition hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {record.paymentId || "N/A"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Ref: {record.gatewayReference || "N/A"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {record.booking?.bookingId || "N/A"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {record.booking?.boardingPoint || "-"} to{" "}
                            {record.booking?.droppingPoint || "-"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">
                            {getInitials(displayUser)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {displayUser}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {record.user?.email || "No email"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(record.amount, record.currency || "INR")}
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        {formatMethodLabel(record.method)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                            STATUS_STYLES[status]
                          )}
                        >
                          {STATUS_LABELS[status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        {formatDate(record.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        {formatDate(record.updatedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openView(record)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(record)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(record)}
                            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:-translate-y-0.5 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200"
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
            {pageNumbers.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPage(value)}
                className={cn(
                  "rounded-lg border px-3 py-1 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5",
                  value === page
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                    : "border-slate-200/80 dark:border-white/10"
                )}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Last
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              {formMode === "create"
                ? "Create transaction"
                : formMode === "edit"
                  ? "Edit transaction"
                  : "Transaction details"}
            </DialogTitle>
            <DialogDescription>
              {formMode === "create"
                ? "Create a manual transaction record linked to a booking."
                : formMode === "edit"
                  ? "Update transaction settlement details."
                  : "Review full transaction information and metadata."}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Loading transaction details...
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Booking ID
                  </label>
                  <Input
                    value={formState.bookingRef}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        bookingRef: event.target.value,
                      }))
                    }
                    disabled={formMode !== "create" || submitting}
                    placeholder="BK-20260213-XXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Payment ID
                  </label>
                  <Input
                    value={formState.paymentId}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        paymentId: event.target.value,
                      }))
                    }
                    disabled={formMode !== "create" || submitting}
                    placeholder="Optional (auto-generated if empty)"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Amount
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.amount}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        amount: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Currency
                  </label>
                  <select
                    value={formState.currency}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        currency: event.target.value as "INR" | "USD" | "EUR",
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 shadow-xs focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Method
                  </label>
                  <select
                    value={formState.method}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        method: event.target.value as TransactionMethod,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 shadow-xs focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                  >
                    <option value="razorpay">Razorpay</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="netbanking">Netbanking</option>
                    <option value="wallet">Wallet</option>
                    <option value="emi">EMI</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Status
                  </label>
                  <select
                    value={formState.status}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        status: event.target.value as TransactionStatus,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 shadow-xs focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                  >
                    <option value="pending">Pending</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                    <option value="partial_refund">Partial Refund</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Attempts
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={formState.attempts}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        attempts: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Gateway Reference
                  </label>
                  <Input
                    value={formState.gatewayReference}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        gatewayReference: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    placeholder="pay_XXX / order_XXX"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Admin Note
                  </label>
                  <Input
                    value={formState.adminNote}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        adminNote: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    placeholder="Optional settlement note"
                  />
                </div>
              </div>

              {selectedTransaction?.gatewayResponse ? (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-xs dark:border-white/10 dark:bg-white/5">
                  <p className="mb-2 font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                    Gateway Payload
                  </p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-slate-700 dark:text-slate-200">
                    {JSON.stringify(selectedTransaction.gatewayResponse, null, 2)}
                  </pre>
                </div>
              ) : null}

              {formError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
                  {formError}
                </div>
              ) : null}

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormOpen(false)}
                >
                  Close
                </Button>
                {!isReadOnly ? (
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : "Save changes"}
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
            <DialogTitle>Delete transaction</DialogTitle>
            <DialogDescription>
              This removes transaction{" "}
              <strong>{deleteTarget?.paymentId || deleteTarget?.id || "N/A"}</strong>
              . Settled transactions cannot be deleted.
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
              {deleting ? "Deleting..." : "Delete transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Operational Notes
          </p>
          <p className="mt-2 text-slate-700 dark:text-slate-200">
            Create manual transactions only when gateway callbacks are unavailable
            and reconciliation requires a controlled override.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Settlement State
          </p>
          <p className="mt-2 inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CircleCheckBig className="h-4 w-4" />
            Success/refund entries are treated as settled records.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Data Integrity
          </p>
          <p className="mt-2 inline-flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <CircleX className="h-4 w-4" />
            Deletion is restricted for settled transactions to preserve audit
            history.
          </p>
        </div>
      </section>
    </div>
  );
};

export default ManageTransactionsPage;
