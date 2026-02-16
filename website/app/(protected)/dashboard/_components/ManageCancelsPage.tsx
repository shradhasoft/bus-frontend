"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Eye,
  Search,
  Ticket,
  Trash2,
  UserRound,
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

type Passenger = {
  name: string;
  age?: number;
  gender?: "male" | "female" | "other";
  seatNumber: string;
  mobileNumber?: string;
  identification?: {
    type?: "aadhar" | "passport" | "dl";
    number?: string;
  };
};

type BookingUser = {
  id?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
};

type BookingBus = {
  id?: string | null;
  name?: string | null;
  number?: string | null;
  operator?: string | null;
};

type BookingRecord = {
  id: string;
  bookingId: string;
  bookingStatus: "pending" | "confirmed" | "cancelled" | "completed";
  paymentStatus: "pending" | "paid" | "refunded" | "partial-refund";
  lifecycleBucket: "upcoming" | "cancelled" | "completed";
  travelDate: string;
  boardingPoint: string;
  droppingPoint: string;
  totalAmount: number;
  currency?: string;
  passengerCount: number;
  passengers: Passenger[];
  seats: string[];
  direction?: "forward" | "return";
  createdAt?: string;
  updatedAt?: string;
  user?: BookingUser | null;
  bus?: BookingBus | null;
  cancellation?: {
    reason?: string;
    requestedAt?: string;
    processedAt?: string;
    refundAmount?: number;
    refundStatus?: "pending" | "success" | "failed";
    refundError?: string;
  } | null;
};

type BookingSummary = {
  total: number;
  upcoming: number;
  cancelled: number;
  completed: number;
};

type BookingListResponse = {
  success?: boolean;
  message?: string;
  data?: BookingRecord[];
  total?: number;
  page?: number;
  totalPages?: number;
  summary?: BookingSummary;
};

type BookingDetailResponse = {
  success?: boolean;
  message?: string;
  data?: BookingRecord;
};

type PassengerForm = {
  name: string;
  age: string;
  gender: "male" | "female" | "other";
  seatNumber: string;
  mobileNumber: string;
  identificationType: "aadhar" | "passport" | "dl";
  identificationNumber: string;
};

type BookingFormState = {
  userId: string;
  busId: string;
  travelDate: string;
  direction: "forward" | "return";
  boardingPoint: string;
  droppingPoint: string;
  bookingStatus: "pending" | "confirmed" | "cancelled" | "completed";
  paymentStatus: "pending" | "paid" | "refunded" | "partial-refund";
  paymentMethod:
    | "wallet"
    | "upi"
    | "card"
    | "credit_card"
    | "debit_card"
    | "netbanking"
    | "razorpay"
    | "emi";
  cancellationReason: string;
  passengers: PassengerForm[];
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
  "partial-refund": "Partial Refund",
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  pending:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
  confirmed:
    "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
  cancelled:
    "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200",
  completed:
    "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200",
  paid: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
  refunded:
    "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700 dark:border-fuchsia-500/40 dark:bg-fuchsia-500/15 dark:text-fuchsia-200",
  "partial-refund":
    "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-200",
};

const EMPTY_SUMMARY: BookingSummary = {
  total: 0,
  upcoming: 0,
  cancelled: 0,
  completed: 0,
};

const DEFAULT_PASSENGER: PassengerForm = {
  name: "",
  age: "",
  gender: "male",
  seatNumber: "",
  mobileNumber: "",
  identificationType: "aadhar",
  identificationNumber: "",
};

const DEFAULT_FORM: BookingFormState = {
  userId: "",
  busId: "",
  travelDate: "",
  direction: "forward",
  boardingPoint: "",
  droppingPoint: "",
  bookingStatus: "pending",
  paymentStatus: "pending",
  paymentMethod: "wallet",
  cancellationReason: "",
  passengers: [{ ...DEFAULT_PASSENGER }],
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatDateInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatCurrency = (value?: number, currency = "INR") => {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `₹${value.toFixed(2)}`;
  }
};

const getDisplayName = (booking: BookingRecord) =>
  booking.user?.fullName || booking.user?.email || "Unknown user";

const getInitials = (value: string) => {
  const parts = value.trim().split(" ").filter(Boolean);
  if (!parts.length) return "U";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

const bookingToFormState = (booking: BookingRecord): BookingFormState => ({
  userId: booking.user?.id || "",
  busId: booking.bus?.id || "",
  travelDate: formatDateInput(booking.travelDate),
  direction: booking.direction === "return" ? "return" : "forward",
  boardingPoint: booking.boardingPoint || "",
  droppingPoint: booking.droppingPoint || "",
  bookingStatus:
    booking.bookingStatus === "completed"
      ? "completed"
      : booking.bookingStatus === "cancelled"
        ? "cancelled"
        : booking.bookingStatus === "confirmed"
          ? "confirmed"
          : "pending",
  paymentStatus:
    booking.paymentStatus === "paid"
      ? "paid"
      : booking.paymentStatus === "refunded"
        ? "refunded"
        : booking.paymentStatus === "partial-refund"
          ? "partial-refund"
          : "pending",
  paymentMethod: "wallet",
  cancellationReason: booking.cancellation?.reason || "",
  passengers: booking.passengers?.length
    ? booking.passengers.map((passenger) => ({
        name: passenger.name || "",
        age:
          typeof passenger.age === "number" && Number.isFinite(passenger.age)
            ? String(passenger.age)
            : "",
        gender:
          passenger.gender === "female" || passenger.gender === "other"
            ? passenger.gender
            : "male",
        seatNumber: passenger.seatNumber || "",
        mobileNumber: passenger.mobileNumber || "",
        identificationType:
          passenger.identification?.type === "passport" ||
          passenger.identification?.type === "dl"
            ? passenger.identification.type
            : "aadhar",
        identificationNumber: passenger.identification?.number || "",
      }))
    : [{ ...DEFAULT_PASSENGER }],
});

const ManageCancelsPage = () => {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [summary, setSummary] = useState<BookingSummary>(EMPTY_SUMMARY);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [status, setStatus] = useState("cancelled");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [direction, setDirection] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("-travelDate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(
    null,
  );

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">(
    "create",
  );
  const [formState, setFormState] = useState<BookingFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BookingRecord | null>(null);
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

  const loadBookings = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        params.set("tab", tab);
        params.set("sort", sort);
        if (search) params.set("search", search);
        if (status) params.set("status", status);
        if (paymentStatus) params.set("paymentStatus", paymentStatus);
        if (direction) params.set("direction", direction);
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);

        const response = await fetch(
          apiUrl(`/admin/bookings?${params.toString()}`),
          {
            method: "GET",
            credentials: "include",
            signal,
          },
        );
        const payload = (await response
          .json()
          .catch(() => ({}))) as BookingListResponse;
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load bookings.");
        }

        setBookings(Array.isArray(payload.data) ? payload.data : []);
        setSummary(payload.summary ?? EMPTY_SUMMARY);
        const totalCount = Number(payload.total) || 0;
        setTotal(totalCount);
        const calculatedPages = Math.max(1, Math.ceil(totalCount / limit));
        if (page > calculatedPages) {
          setPage(calculatedPages);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || "Something went wrong.");
        }
      } finally {
        setLoading(false);
      }
    },
    [
      direction,
      fromDate,
      limit,
      page,
      paymentStatus,
      search,
      sort,
      status,
      tab,
      toDate,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadBookings(controller.signal);
    return () => controller.abort();
  }, [loadBookings]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const handleFetchDetail = useCallback(async (bookingRef: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(
        apiUrl(`/admin/bookings/${encodeURIComponent(bookingRef)}`),
        {
          method: "GET",
          credentials: "include",
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as BookingDetailResponse;
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load booking detail.");
      }
      if (!payload.data) {
        throw new Error("Booking details are unavailable.");
      }
      return payload.data;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openView = async (record: BookingRecord) => {
    setFormError(null);
    try {
      const detail = await handleFetchDetail(record.bookingId || record.id);
      setSelectedBooking(detail);
      setFormMode("view");
      setFormState(bookingToFormState(detail));
      setFormOpen(true);
    } catch (err) {
      setError((err as Error).message || "Unable to load booking details.");
    }
  };

  const setPassenger = (index: number, updates: Partial<PassengerForm>) => {
    setFormState((prev) => ({
      ...prev,
      passengers: prev.passengers.map((passenger, passengerIndex) =>
        passengerIndex === index ? { ...passenger, ...updates } : passenger,
      ),
    }));
  };

  const addPassenger = () => {
    setFormState((prev) => ({
      ...prev,
      passengers: [...prev.passengers, { ...DEFAULT_PASSENGER }],
    }));
  };

  const removePassenger = (index: number) => {
    setFormState((prev) => {
      if (prev.passengers.length <= 1) return prev;
      return {
        ...prev,
        passengers: prev.passengers.filter(
          (_, passengerIndex) => passengerIndex !== index,
        ),
      };
    });
  };

  const validateForm = (mode: "create" | "edit") => {
    if (mode === "create") {
      if (!formState.userId.trim() || !formState.busId.trim()) {
        return "User ID and Bus ID are required.";
      }
    }

    if (
      !formState.travelDate ||
      !formState.boardingPoint.trim() ||
      !formState.droppingPoint.trim()
    ) {
      return "Travel date, boarding point, and dropping point are required.";
    }

    if (!formState.passengers.length) {
      return "At least one passenger is required.";
    }

    for (let index = 0; index < formState.passengers.length; index += 1) {
      const passenger = formState.passengers[index];
      if (!passenger.name.trim() || passenger.name.trim().length < 2) {
        return `Passenger ${index + 1}: name is invalid.`;
      }
      const age = Number(passenger.age);
      if (!Number.isInteger(age) || age < 1 || age > 120) {
        return `Passenger ${index + 1}: age must be between 1 and 120.`;
      }
      if (!/^[6-9]\d{9}$/.test(passenger.mobileNumber.trim())) {
        return `Passenger ${index + 1}: mobile number must be 10 digits.`;
      }
      if (!passenger.seatNumber.trim()) {
        return `Passenger ${index + 1}: seat is required.`;
      }
    }

    return null;
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formMode === "view") return;
    const mode = formMode === "create" ? "create" : "edit";
    if (mode === "edit" && !selectedBooking) {
      setFormError("Select a booking to update.");
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
      const payload = {
        travelDate: formState.travelDate,
        direction: formState.direction,
        boardingPoint: formState.boardingPoint.trim(),
        droppingPoint: formState.droppingPoint.trim(),
        bookingStatus: formState.bookingStatus,
        paymentStatus: formState.paymentStatus,
        paymentMethod: formState.paymentMethod,
        cancellationReason: formState.cancellationReason.trim() || undefined,
        passengers: formState.passengers.map((passenger) => ({
          name: passenger.name.trim(),
          age: Number(passenger.age),
          gender: passenger.gender,
          seatNumber: passenger.seatNumber.trim(),
          mobileNumber: passenger.mobileNumber.trim(),
          identification: {
            type: passenger.identificationType,
            number: passenger.identificationNumber.trim() || undefined,
          },
        })),
      };

      const endpoint =
        mode === "create"
          ? apiUrl("/admin/bookings")
          : apiUrl(
              `/admin/bookings/${encodeURIComponent(
                selectedBooking?.bookingId || selectedBooking?.id || "",
              )}`,
            );

      const requestPayload =
        mode === "create"
          ? {
              ...payload,
              userId: formState.userId.trim(),
              busId: formState.busId.trim(),
            }
          : payload;

      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to save booking.");
      }

      setFormOpen(false);
      setSelectedBooking(null);
      setFormState(DEFAULT_FORM);
      const controller = new AbortController();
      await loadBookings(controller.signal);
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
        apiUrl(
          `/admin/bookings/${encodeURIComponent(deleteTarget.bookingId || deleteTarget.id)}`,
        ),
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete booking.");
      }
      setDeleteTarget(null);
      const controller = new AbortController();
      await loadBookings(controller.signal);
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
            Cancellation Center
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Manage Cancels
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
            {total.toLocaleString()} total - page {page} of {totalPages}
          </p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.1)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search booking, route, passenger..."
              className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            />
          </div>

          <select
            value={tab}
            onChange={(event) => {
              setTab(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="all">All lifecycle</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="">All booking status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={paymentStatus}
            onChange={(event) => {
              setPaymentStatus(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="">All payment status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
            <option value="partial-refund">Partial Refund</option>
          </select>

          <select
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="">Both directions</option>
            <option value="forward">Forward</option>
            <option value="return">Return</option>
          </select>

          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="-travelDate">Latest travel</option>
            <option value="travelDate">Earliest travel</option>
            <option value="-createdAt">Latest created</option>
            <option value="createdAt">Earliest created</option>
            <option value="-amount">Highest amount</option>
            <option value="amount">Lowest amount</option>
          </select>

          <Input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl"
          />

          <Input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-2xl"
          />

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

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {[
            { label: "Total", value: summary.total, tone: "text-slate-600" },
            {
              label: "Upcoming",
              value: summary.upcoming,
              tone: "text-emerald-700 dark:text-emerald-200",
            },
            {
              label: "Completed",
              value: summary.completed,
              tone: "text-sky-700 dark:text-sky-200",
            },
            {
              label: "Cancelled",
              value: summary.cancelled,
              tone: "text-rose-700 dark:text-rose-200",
            },
          ].map((chip) => (
            <span
              key={chip.label}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50 px-3 py-1 dark:border-white/10 dark:bg-white/5",
                chip.tone,
              )}
            >
              {chip.label}: <strong>{chip.value}</strong>
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.1)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
        <div className="max-h-[580px] overflow-auto no-scrollbar">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100/95 text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Booking</th>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Route</th>
                <th className="px-6 py-4 font-semibold">Travel</th>
                <th className="px-6 py-4 font-semibold">Refund</th>
                <th className="px-6 py-4 font-semibold">Reason</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300"
                  >
                    Loading bookings...
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300"
                  >
                    No bookings found.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const displayName = getDisplayName(booking);
                  return (
                    <tr
                      key={booking.id}
                      className="bg-white/60 transition hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                    >
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {booking.bookingId}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {booking.bus?.name || "Bus"}{" "}
                            {booking.bus?.number
                              ? `(${booking.bus.number})`
                              : ""}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Seats: {booking.seats.join(", ")}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">
                            {getInitials(displayName)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {displayName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {booking.user?.email ||
                                booking.user?.phone ||
                                "-"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        <p className="font-medium">
                          {booking.boardingPoint} to {booking.droppingPoint}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Direction: {booking.direction || "forward"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        <p>{formatDate(booking.travelDate)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Created: {formatDate(booking.createdAt)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        <div className="space-y-1">
                          <p className="font-semibold text-xs uppercase tracking-wide">
                            {formatCurrency(
                              booking.cancellation?.refundAmount || 0,
                              booking.currency || "INR",
                            )}
                          </p>
                          <div className="flex items-center gap-1">
                            <span
                              className={cn(
                                "text-xs font-semibold px-2 py-0.5 rounded-full border",
                                booking.cancellation?.refundStatus === "failed"
                                  ? "bg-rose-50 border-rose-200 text-rose-700"
                                  : booking.cancellation?.refundStatus ===
                                      "success"
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : "bg-slate-50 border-slate-200 text-slate-600",
                              )}
                            >
                              {booking.cancellation?.refundStatus || "Pending"}
                            </span>
                          </div>
                          {booking.cancellation?.refundError ? (
                            <p className="text-[10px] text-rose-600 max-w-[150px] leading-tight">
                              {booking.cancellation.refundError}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        <p
                          className="text-xs max-w-[150px] truncate"
                          title={booking.cancellation?.reason}
                        >
                          {booking.cancellation?.reason || "-"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em]",
                              STATUS_BADGE_STYLES[booking.bookingStatus] ||
                                STATUS_BADGE_STYLES.pending,
                            )}
                          >
                            {BOOKING_STATUS_LABELS[booking.bookingStatus] ||
                              booking.bookingStatus}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em]",
                              STATUS_BADGE_STYLES[booking.paymentStatus] ||
                                STATUS_BADGE_STYLES.pending,
                            )}
                          >
                            {PAYMENT_STATUS_LABELS[booking.paymentStatus] ||
                              booking.paymentStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void openView(booking)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(booking)}
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
                    : "border-slate-200/80 dark:border-white/10",
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
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              {formMode === "create"
                ? "Create booking"
                : formMode === "edit"
                  ? "Edit booking"
                  : "Booking details"}
            </DialogTitle>
            <DialogDescription>
              {formMode === "create"
                ? "Create an admin booking with passengers, fare, and seat allocation."
                : formMode === "edit"
                  ? "Update booking status, payment state, travel date, and passenger details."
                  : "Review the complete booking details."}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Loading booking details...
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    User ID
                  </label>
                  <Input
                    value={formState.userId}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        userId: event.target.value,
                      }))
                    }
                    placeholder="Mongo user id"
                    disabled={isReadOnly || formMode === "edit" || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Bus ID
                  </label>
                  <Input
                    value={formState.busId}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        busId: event.target.value,
                      }))
                    }
                    placeholder="Mongo bus id"
                    disabled={isReadOnly || formMode === "edit" || submitting}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Travel Date
                  </label>
                  <Input
                    type="date"
                    value={formState.travelDate}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        travelDate: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Direction
                  </label>
                  <select
                    value={formState.direction}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        direction: event.target.value as "forward" | "return",
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 shadow-xs focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                  >
                    <option value="forward">Forward</option>
                    <option value="return">Return</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Payment Method
                  </label>
                  <select
                    value={formState.paymentMethod}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        paymentMethod: event.target
                          .value as BookingFormState["paymentMethod"],
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 shadow-xs focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                  >
                    <option value="wallet">Wallet</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="netbanking">Netbanking</option>
                    <option value="razorpay">Razorpay</option>
                    <option value="emi">EMI</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Boarding Point
                  </label>
                  <Input
                    value={formState.boardingPoint}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        boardingPoint: event.target.value,
                      }))
                    }
                    placeholder="City name"
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Dropping Point
                  </label>
                  <Input
                    value={formState.droppingPoint}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        droppingPoint: event.target.value,
                      }))
                    }
                    placeholder="City name"
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Booking Status
                  </label>
                  <select
                    value={formState.bookingStatus}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        bookingStatus: event.target
                          .value as BookingFormState["bookingStatus"],
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 shadow-xs focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Payment Status
                  </label>
                  <select
                    value={formState.paymentStatus}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        paymentStatus: event.target
                          .value as BookingFormState["paymentStatus"],
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 shadow-xs focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="refunded">Refunded</option>
                    <option value="partial-refund">Partial Refund</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Cancellation Reason
                </label>
                <Input
                  value={formState.cancellationReason}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      cancellationReason: event.target.value,
                    }))
                  }
                  placeholder="Required for cancelled bookings"
                  disabled={isReadOnly || submitting}
                />
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <UserRound className="h-4 w-4 text-slate-500" />
                    Passengers ({formState.passengers.length})
                  </p>
                  {!isReadOnly ? (
                    <button
                      type="button"
                      onClick={addPassenger}
                      className="rounded-xl border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                    >
                      Add passenger
                    </button>
                  ) : null}
                </div>

                {formState.passengers.map((passenger, index) => (
                  <div
                    key={`${index}-${passenger.seatNumber}`}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Passenger {index + 1}
                      </p>
                      {!isReadOnly && formState.passengers.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removePassenger(index)}
                          className="text-xs font-semibold text-rose-600"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Input
                        value={passenger.name}
                        onChange={(event) =>
                          setPassenger(index, { name: event.target.value })
                        }
                        placeholder="Full name"
                        disabled={isReadOnly || submitting}
                      />
                      <Input
                        value={passenger.age}
                        onChange={(event) =>
                          setPassenger(index, { age: event.target.value })
                        }
                        placeholder="Age"
                        inputMode="numeric"
                        disabled={isReadOnly || submitting}
                      />
                      <select
                        value={passenger.gender}
                        onChange={(event) =>
                          setPassenger(index, {
                            gender: event.target
                              .value as PassengerForm["gender"],
                          })
                        }
                        disabled={isReadOnly || submitting}
                        className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 shadow-xs focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      <Input
                        value={passenger.seatNumber}
                        onChange={(event) =>
                          setPassenger(index, {
                            seatNumber: event.target.value,
                          })
                        }
                        placeholder="Seat ID (e.g. UPPER-1A)"
                        disabled={isReadOnly || submitting}
                      />
                      <Input
                        value={passenger.mobileNumber}
                        onChange={(event) =>
                          setPassenger(index, {
                            mobileNumber: event.target.value,
                          })
                        }
                        placeholder="10-digit mobile"
                        inputMode="numeric"
                        disabled={isReadOnly || submitting}
                      />
                      <select
                        value={passenger.identificationType}
                        onChange={(event) =>
                          setPassenger(index, {
                            identificationType: event.target
                              .value as PassengerForm["identificationType"],
                          })
                        }
                        disabled={isReadOnly || submitting}
                        className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 shadow-xs focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                      >
                        <option value="aadhar">Aadhar</option>
                        <option value="passport">Passport</option>
                        <option value="dl">DL</option>
                      </select>
                      <Input
                        value={passenger.identificationNumber}
                        onChange={(event) =>
                          setPassenger(index, {
                            identificationNumber: event.target.value,
                          })
                        }
                        placeholder="ID number"
                        disabled={isReadOnly || submitting}
                        className="sm:col-span-2 lg:col-span-3"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {selectedBooking && formMode !== "create" ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  <div className="flex flex-wrap gap-4">
                    <span className="inline-flex items-center gap-1">
                      <Ticket className="h-3.5 w-3.5" />
                      {selectedBooking.bookingId}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Created {formatDate(selectedBooking.createdAt)}
                    </span>
                  </div>
                </div>
              ) : null}

              {formError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
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
            <DialogTitle>Delete booking</DialogTitle>
            <DialogDescription>
              This will permanently remove booking{" "}
              <strong>{deleteTarget?.bookingId || "N/A"}</strong> and related
              seat/payment references. This action cannot be undone.
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
              {deleting ? "Deleting..." : "Delete booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageCancelsPage;
