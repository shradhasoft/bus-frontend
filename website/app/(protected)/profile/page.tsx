"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Loader2,
  MapPin,
  Navigation2,
  PencilLine,
  ReceiptText,
  RefreshCcw,
  Search,
  Ticket,
  UserRound,
  X,
} from "lucide-react";

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
import { apiUrl } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

type TimeObject = {
  hours: number;
  minutes: number;
};

type BusSnapshot = {
  id?: string | null;
  name?: string | null;
  number?: string | null;
  operator?: string | null;
};

type Passenger = {
  name: string;
  age?: number;
  gender?: string;
  seatNumber: string;
  mobileNumber?: string;
  identification?: {
    type?: string;
    number?: string;
  };
};

type BookingListItem = {
  id: string;
  bookingId: string;
  bookingStatus: "pending" | "confirmed" | "cancelled" | "completed";
  paymentStatus?: string;
  lifecycleBucket: "upcoming" | "cancelled" | "completed";
  travelDate: string;
  boardingPoint: string;
  droppingPoint: string;
  passengers: Passenger[];
  passengerCount: number;
  primaryPassenger?: string | null;
  seats: string[];
  totalAmount: number;
  currency?: string;
  createdAt: string;
  canCancel: boolean;
  trip?: {
    direction?: string;
    origin?: string | null;
    destination?: string | null;
    departureTime?: TimeObject | null;
    arrivalTime?: TimeObject | null;
    segmentDurationMinutes?: number | null;
  };
  bus?: BusSnapshot | null;
};

type BookingDetail = BookingListItem & {
  route?: {
    code?: string | null;
    origin?: string | null;
    destination?: string | null;
    cancellationPolicy?: {
      before24h?: number;
      before12h?: number;
      noShow?: number;
    } | null;
  };
  payment?: {
    paymentId?: string | null;
    amount?: number | null;
    currency?: string | null;
    method?: string | null;
    status?: string | null;
    createdAt?: string | null;
    gatewayReference?: string | null;
  } | null;
  invoice?: {
    available?: boolean;
    downloadUrl?: string | null;
  };
};

type BookingSummary = {
  total: number;
  upcoming: number;
  cancelled: number;
  completed: number;
};

type BookingListResponse = {
  success: boolean;
  data?: BookingListItem[];
  page?: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
  summary?: BookingSummary;
  message?: string;
};

type BookingDetailResponse = {
  success: boolean;
  data?: BookingDetail;
  message?: string;
};

type ProfileUser = {
  fullName?: string;
  email?: string;
  phone?: string | null;
  dob?: string | null;
  gender?: "Male" | "Female" | "Other" | null;
  role?: string;
  createdAt?: string;
};

type ProfileFormState = {
  fullName: string;
  email: string;
  phone: string;
};

type ProfileResponse = {
  success: boolean;
  data?: {
    user?: ProfileUser;
  };
  message?: string;
};

type VisibleTab = "upcoming" | "cancelled" | "completed";

const TAB_OPTIONS: Array<{
  key: VisibleTab;
  label: string;
  summaryKey: keyof BookingSummary;
}> = [
  { key: "upcoming", label: "Upcoming", summaryKey: "upcoming" },
  { key: "cancelled", label: "Cancelled", summaryKey: "cancelled" },
  { key: "completed", label: "Completed", summaryKey: "completed" },
];

const DEFAULT_SUMMARY: BookingSummary = {
  total: 0,
  upcoming: 0,
  cancelled: 0,
  completed: 0,
};

const LIST_PAGE_SIZE = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

const STATUS_LABELS: Record<BookingListItem["lifecycleBucket"], string> = {
  upcoming: "Upcoming",
  cancelled: "Cancelled",
  completed: "Completed",
};

const STATUS_STYLES: Record<BookingListItem["lifecycleBucket"], string> = {
  upcoming:
    "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
  cancelled:
    "border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200",
  completed:
    "border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200",
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const toMinutes = (time?: TimeObject | null) =>
  isFiniteNumber(time?.hours) && isFiniteNumber(time?.minutes)
    ? time.hours * 60 + time.minutes
    : null;

const getVisibleTab = (raw: string | null): VisibleTab => {
  if (raw === "cancelled" || raw === "completed" || raw === "upcoming") {
    return raw;
  }
  return "upcoming";
};

const formatCurrency = (amount?: number | null, currency = "INR") => {
  if (!isFiniteNumber(amount)) return "N/A";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹${amount.toFixed(2)}`;
  }
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatClock = (time?: TimeObject | null) => {
  const totalMinutes = toMinutes(time);
  if (!isFiniteNumber(totalMinutes)) return "N/A";
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
};

const getDepartureDateTime = (booking: BookingListItem) => {
  const base = new Date(booking.travelDate);
  if (Number.isNaN(base.getTime())) return null;
  const departureMinutes = toMinutes(booking.trip?.departureTime);
  if (!isFiniteNumber(departureMinutes)) return base;
  const departure = new Date(base);
  departure.setHours(
    Math.floor(departureMinutes / 60),
    departureMinutes % 60,
    0,
    0,
  );
  return departure;
};

const getArrivalDateTime = (
  booking: BookingListItem,
  departure: Date | null,
) => {
  const duration = booking.trip?.segmentDurationMinutes;
  if (departure && isFiniteNumber(duration)) {
    return new Date(departure.getTime() + duration * 60000);
  }

  const base = new Date(booking.travelDate);
  if (Number.isNaN(base.getTime())) return null;
  const arrivalMinutes = toMinutes(booking.trip?.arrivalTime);
  if (!isFiniteNumber(arrivalMinutes)) return base;
  const arrival = new Date(base);
  arrival.setHours(Math.floor(arrivalMinutes / 60), arrivalMinutes % 60, 0, 0);

  if (departure && arrival.getTime() < departure.getTime()) {
    arrival.setDate(arrival.getDate() + 1);
  }
  return arrival;
};

const getStatusLabel = (booking: BookingListItem) =>
  STATUS_LABELS[booking.lifecycleBucket] ?? booking.bookingStatus;

const getPaymentMethodLabel = (value?: string | null) => {
  if (!value) return "N/A";
  return value
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

const resolveDownloadFilename = (
  contentDisposition: string | null,
  fallback: string,
) => {
  if (!contentDisposition) return fallback;

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]).replace(/[/\\]/g, "_");
    } catch {
      return utfMatch[1].replace(/[/\\]/g, "_");
    }
  }

  const plainMatch = contentDisposition.match(/filename="?([^\";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].replace(/[/\\]/g, "_");
  }

  return fallback;
};

const getProfileFormState = (user?: ProfileUser | null): ProfileFormState => ({
  fullName: user?.fullName?.trim() || "",
  email: user?.email?.trim() || "",
  phone: user?.phone?.trim() || "",
});

const ProfilePage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromQuery = useMemo(
    () => getVisibleTab(searchParams.get("tab")),
    [searchParams],
  );

  const [authReady, setAuthReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() =>
    getProfileFormState(null),
  );
  const [profileUpdateLoading, setProfileUpdateLoading] = useState(false);
  const [profileUpdateError, setProfileUpdateError] = useState<string | null>(
    null,
  );

  const [activeTab, setActiveTab] = useState<VisibleTab>(tabFromQuery);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [summary, setSummary] = useState<BookingSummary>(DEFAULT_SUMMARY);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedBooking, setSelectedBooking] = useState<BookingDetail | null>(
    null,
  );
  const [selectedBookingRef, setSelectedBookingRef] = useState<string | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setActiveTab(tabFromQuery);
  }, [tabFromQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setIsSignedIn(Boolean(user));
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeTab, debouncedSearch]);

  const getAuthHeaders = useCallback(async () => {
    const user = firebaseAuth.currentUser;
    if (!user) return {};
    try {
      const token = await user.getIdToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const controller = new AbortController();

    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(apiUrl("/profile/view"), {
          method: "GET",
          credentials: "include",
          headers,
          signal: controller.signal,
          cache: "no-store",
        });

        if (response.status === 401) {
          setProfile(null);
          setProfileError("Sign in to view your profile and bookings.");
          return;
        }

        const payload = (await response
          .json()
          .catch(() => ({}))) as ProfileResponse;
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to load profile.");
        }

        setProfile(payload?.data?.user ?? null);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setProfile(null);
        setProfileError(
          error instanceof Error
            ? error.message
            : "Unable to load profile details.",
        );
      } finally {
        setProfileLoading(false);
      }
    };

    void loadProfile();

    return () => controller.abort();
  }, [authReady, getAuthHeaders, reloadKey]);

  useEffect(() => {
    if (isEditProfileOpen) return;
    setProfileForm(getProfileFormState(profile));
  }, [isEditProfileOpen, profile]);

  useEffect(() => {
    if (!authReady) return;
    const controller = new AbortController();

    const loadBookings = async () => {
      setListLoading(true);
      setListError(null);
      try {
        const params = new URLSearchParams({
          tab: activeTab,
          page: String(page),
          limit: String(LIST_PAGE_SIZE),
        });
        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }

        const headers = await getAuthHeaders();
        const response = await fetch(
          apiUrl(`/mybookings?${params.toString()}`),
          {
            method: "GET",
            credentials: "include",
            headers,
            signal: controller.signal,
            cache: "no-store",
          },
        );

        if (response.status === 401) {
          setBookings([]);
          setSummary(DEFAULT_SUMMARY);
          setTotal(0);
          setTotalPages(1);
          setListError("Sign in to access your bookings.");
          return;
        }

        const payload = (await response
          .json()
          .catch(() => ({}))) as BookingListResponse;
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to load bookings.");
        }

        const resolvedBookings = Array.isArray(payload?.data)
          ? payload.data
          : [];
        const resolvedTotal = isFiniteNumber(payload?.total)
          ? payload.total
          : 0;
        const resolvedTotalPages =
          isFiniteNumber(payload?.totalPages) && payload.totalPages > 0
            ? payload.totalPages
            : 1;

        setBookings(resolvedBookings);
        setSummary(payload?.summary ?? DEFAULT_SUMMARY);
        setTotal(resolvedTotal);
        setTotalPages(resolvedTotalPages);
        if (page > resolvedTotalPages) {
          setPage(resolvedTotalPages);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setBookings([]);
        setSummary(DEFAULT_SUMMARY);
        setTotal(0);
        setTotalPages(1);
        setListError(
          error instanceof Error
            ? error.message
            : "Unable to load bookings right now.",
        );
      } finally {
        setListLoading(false);
      }
    };

    void loadBookings();

    return () => controller.abort();
  }, [activeTab, authReady, debouncedSearch, getAuthHeaders, page, reloadKey]);

  const openBookingDetail = useCallback(
    async (bookingRef: string) => {
      setSelectedBookingRef(bookingRef);
      setDetailLoading(true);
      setDetailError(null);
      setInvoiceError(null);
      setInvoiceDownloading(false);

      try {
        const headers = await getAuthHeaders();
        const response = await fetch(
          apiUrl(`/mybookings/${encodeURIComponent(bookingRef)}`),
          {
            method: "GET",
            credentials: "include",
            headers,
            cache: "no-store",
          },
        );

        const payload = (await response
          .json()
          .catch(() => ({}))) as BookingDetailResponse;
        if (!response.ok) {
          throw new Error(
            payload?.message || "Unable to load booking details.",
          );
        }

        if (!payload?.data) {
          throw new Error("Booking details are unavailable.");
        }

        setSelectedBooking(payload.data);
      } catch (error) {
        setSelectedBooking(null);
        setDetailError(
          error instanceof Error
            ? error.message
            : "Unable to load booking details.",
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [getAuthHeaders],
  );

  const handleTabChange = (nextTab: VisibleTab) => {
    setActiveTab(nextTab);
    setSelectedBooking(null);
    setSelectedBookingRef(null);
    setInvoiceError(null);
    setInvoiceDownloading(false);

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const handleRefresh = () => {
    setReloadKey((value) => value + 1);
  };

  const openEditProfileDialog = () => {
    if (!profile) return;
    setProfileForm(getProfileFormState(profile));
    setProfileUpdateError(null);
    setIsEditProfileOpen(true);
  };

  const handleEditProfileOpenChange = (open: boolean) => {
    if (profileUpdateLoading) return;
    if (open) {
      setProfileForm(getProfileFormState(profile));
    }
    setProfileUpdateError(null);
    setIsEditProfileOpen(open);
  };

  const handleProfileFieldChange =
    (field: keyof ProfileFormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setProfileForm((current) => ({ ...current, [field]: value }));
      if (profileUpdateError) {
        setProfileUpdateError(null);
      }
    };

  const hasProfileChanges = useMemo(() => {
    if (!profile) return false;
    const current = getProfileFormState(profile);
    return (
      profileForm.fullName.trim() !== current.fullName ||
      profileForm.email.trim().toLowerCase() !== current.email.toLowerCase() ||
      profileForm.phone.trim() !== current.phone
    );
  }, [profile, profileForm]);

  const handleProfileUpdate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!profile || profileUpdateLoading) return;

      const fullName = profileForm.fullName.trim();
      const email = profileForm.email.trim().toLowerCase();
      const phone = profileForm.phone.trim();

      if (fullName && fullName.length < 3) {
        setProfileUpdateError("Full name must be at least 3 characters.");
        return;
      }

      if (email && !EMAIL_REGEX.test(email)) {
        setProfileUpdateError("Please provide a valid email address.");
        return;
      }

      if (phone && !E164_PHONE_REGEX.test(phone)) {
        setProfileUpdateError(
          "Phone must be in E.164 format (for example, +917840009613).",
        );
        return;
      }

      const current = getProfileFormState(profile);
      const changedFields: Record<string, string> = {};
      if (fullName !== current.fullName) {
        changedFields.fullName = fullName;
      }
      if (email !== current.email.toLowerCase()) {
        changedFields.email = email;
      }
      if (phone !== current.phone) {
        changedFields.phone = phone;
      }

      if (Object.keys(changedFields).length === 0) {
        setIsEditProfileOpen(false);
        return;
      }

      setProfileUpdateLoading(true);
      setProfileUpdateError(null);
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(apiUrl("/profile/update"), {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify(changedFields),
          cache: "no-store",
        });

        const payload = (await response
          .json()
          .catch(() => ({}))) as ProfileResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload?.message || "Unable to update profile.");
        }

        setProfile(payload?.data?.user ?? profile);
        setIsEditProfileOpen(false);
      } catch (error) {
        setProfileUpdateError(
          error instanceof Error ? error.message : "Unable to update profile.",
        );
      } finally {
        setProfileUpdateLoading(false);
      }
    },
    [getAuthHeaders, profile, profileForm, profileUpdateLoading],
  );

  const activeDetail = selectedBooking;
  const activeDetailDeparture = activeDetail
    ? getDepartureDateTime(activeDetail)
    : null;
  const activeDetailArrival = activeDetail
    ? getArrivalDateTime(activeDetail, activeDetailDeparture)
    : null;

  const handleDownloadInvoice = useCallback(async () => {
    if (!activeDetail?.invoice?.downloadUrl || invoiceDownloading) return;

    setInvoiceDownloading(true);
    setInvoiceError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(apiUrl(activeDetail.invoice.downloadUrl), {
        method: "GET",
        credentials: "include",
        headers,
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(payload?.message || "Unable to download invoice.");
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error("Invoice file is empty.");
      }

      const fallbackName = `invoice-${activeDetail.bookingId || "booking"}.pdf`;
      const fileName = resolveDownloadFilename(
        response.headers.get("content-disposition"),
        fallbackName,
      );

      const fileUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = fileUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(fileUrl);
    } catch (error) {
      setInvoiceError(
        error instanceof Error ? error.message : "Unable to download invoice.",
      );
    } finally {
      setInvoiceDownloading(false);
    }
  }, [activeDetail, getAuthHeaders, invoiceDownloading]);

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 pb-4">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl dark:border-white/10">
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-200/90">
              My Profile
            </p>
            {profileLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading profile...
              </div>
            ) : profile ? (
              <>
                <h1 className="text-2xl font-semibold text-white">
                  {profile.fullName || "Traveller"}
                </h1>
                <p className="text-sm text-slate-200">
                  {profile.email || "No email available"}
                </p>
                <p className="text-sm text-slate-300">
                  {profile.phone || "Phone not added"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openEditProfileDialog}
                  className="w-fit border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  <PencilLine className="h-4 w-4" />
                  Edit Profile
                </Button>
              </>
            ) : (
              <p className="text-sm text-rose-200">
                {profileError || "Profile details unavailable."}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-200/80">
                Total trips
              </p>
              <p className="mt-2 text-2xl font-semibold">{summary.total}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-200/80">
                Active trips
              </p>
              <p className="mt-2 text-2xl font-semibold">{summary.upcoming}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-200/80">
                Completed
              </p>
              <p className="mt-2 text-2xl font-semibold">{summary.completed}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-200/80">
                Cancelled
              </p>
              <p className="mt-2 text-2xl font-semibold">{summary.cancelled}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172a]/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-white/5">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                  activeTab === tab.key
                    ? "bg-white text-slate-900 shadow dark:bg-white/15 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                {tab.label} ({summary[tab.summaryKey]})
              </button>
            ))}
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search booking, route or city"
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleRefresh}
              className="border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      {!isSignedIn && authReady ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="text-sm font-medium">
            You are not signed in. Please sign in to access your bookings.
          </p>
          <Button asChild className="mt-3">
            <Link href="/login">Go to Login</Link>
          </Button>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-4">
          {listLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-[#0f172a]/70 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading bookings...
              </div>
            </div>
          ) : listError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
              {listError}
            </div>
          ) : bookings.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-[#0f172a]/70 dark:text-slate-300">
              No bookings found for this tab.
            </div>
          ) : (
            bookings.map((booking) => {
              const departureDateTime = getDepartureDateTime(booking);
              const arrivalDateTime = getArrivalDateTime(
                booking,
                departureDateTime,
              );
              const isSelected =
                selectedBookingRef &&
                (selectedBookingRef === booking.bookingId ||
                  selectedBookingRef === booking.id);

              return (
                <article
                  key={booking.id}
                  className={cn(
                    "rounded-2xl border bg-white p-5 shadow-sm transition dark:bg-[#0f172a]/70",
                    isSelected
                      ? "border-sky-300 dark:border-sky-400/50"
                      : "border-slate-200 dark:border-white/10",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                        <MapPin className="h-4 w-4 text-slate-500" />
                        {booking.boardingPoint} to {booking.droppingPoint}
                      </div>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {booking.bus?.name || "Bus service"} • Booking ID{" "}
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {booking.bookingId}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                          STATUS_STYLES[booking.lifecycleBucket],
                        )}
                      >
                        {getStatusLabel(booking)}
                      </span>
                      <Button
                        type="button"
                        onClick={() =>
                          void openBookingDetail(
                            booking.bookingId || booking.id,
                          )
                        }
                        className="rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 px-5 text-white hover:from-sky-600 hover:to-indigo-700"
                      >
                        View Booking
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-sm dark:border-white/10 dark:bg-white/5 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        From
                      </p>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                        {formatClock(booking.trip?.departureTime)}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        {formatDate(departureDateTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        To
                      </p>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                        {formatClock(booking.trip?.arrivalTime)}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        {formatDate(arrivalDateTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Fare & seats
                      </p>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(
                          booking.totalAmount,
                          booking.currency || "INR",
                        )}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        {booking.passengerCount} passenger(s) •{" "}
                        {booking.seats.join(", ")}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })
          )}

          {totalPages > 1 && !listLoading ? (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0f172a]/70">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Showing page {page} of {totalPages} ({total} bookings)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172a]/70">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Booking Details
            </h2>
            {selectedBooking ? (
              <button
                type="button"
                aria-label="Close details"
                onClick={() => {
                  setSelectedBooking(null);
                  setSelectedBookingRef(null);
                  setDetailError(null);
                  setInvoiceError(null);
                  setInvoiceDownloading(false);
                }}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {detailLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading booking detail...
            </div>
          ) : detailError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
              {detailError}
            </div>
          ) : activeDetail ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {activeDetail.boardingPoint} to {activeDetail.droppingPoint}
                  </p>
                  <span
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                      STATUS_STYLES[activeDetail.lifecycleBucket],
                    )}
                  >
                    {getStatusLabel(activeDetail)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Booking ID: {activeDetail.bookingId}
                </p>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                    <Clock3 className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="font-medium">
                        {formatClock(activeDetail.trip?.departureTime)} to{" "}
                        {formatClock(activeDetail.trip?.arrivalTime)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(activeDetailDeparture)} to{" "}
                        {formatDate(activeDetailArrival)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                    <CalendarDays className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="font-medium">
                        Booked on {formatDateTime(activeDetail.createdAt)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Bus: {activeDetail.bus?.name || "N/A"}{" "}
                        {activeDetail.bus?.number
                          ? `(${activeDetail.bus.number})`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Track my journey button */}
                {activeDetail.bookingStatus === "confirmed" &&
                  activeDetail.lifecycleBucket === "upcoming" && (
                    <div className="mt-4">
                      <Link
                        href={`/track-journey/${encodeURIComponent(activeDetail.bookingId)}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 via-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200/50 transition hover:from-indigo-600 hover:via-indigo-700 hover:to-purple-700 hover:shadow-xl dark:shadow-indigo-500/20"
                      >
                        <Navigation2 className="h-4 w-4" />
                        Track my journey
                      </Link>
                    </div>
                  )}
              </div>

              <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <UserRound className="h-4 w-4 text-slate-500" />
                  Travellers ({activeDetail.passengers.length})
                </p>
                <div className="space-y-2">
                  {activeDetail.passengers.map((passenger, index) => (
                    <div
                      key={`${passenger.seatNumber}-${index}`}
                      className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5"
                    >
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {passenger.name || "Traveller"} • Seat{" "}
                        {passenger.seatNumber}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {passenger.age ? `${passenger.age} yrs` : "Age N/A"}
                        {passenger.gender ? ` • ${passenger.gender}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <CircleDollarSign className="h-4 w-4 text-slate-500" />
                  Payment
                </p>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">
                      Total amount
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(
                        activeDetail.payment?.amount ??
                          activeDetail.totalAmount,
                        activeDetail.payment?.currency ||
                          activeDetail.currency ||
                          "INR",
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">
                      Method
                    </dt>
                    <dd className="text-slate-700 dark:text-slate-200">
                      {getPaymentMethodLabel(activeDetail.payment?.method)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">
                      Status
                    </dt>
                    <dd className="text-slate-700 dark:text-slate-200">
                      {activeDetail.payment?.status ||
                        activeDetail.paymentStatus ||
                        "N/A"}
                    </dd>
                  </div>
                  {activeDetail.payment?.gatewayReference ? (
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500 dark:text-slate-400">
                        Transaction ref
                      </dt>
                      <dd className="break-all text-right text-slate-700 dark:text-slate-200">
                        {activeDetail.payment.gatewayReference}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <ReceiptText className="h-4 w-4 text-slate-500" />
                  Invoice
                </p>
                {activeDetail.invoice?.available ? (
                  activeDetail.invoice.downloadUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDownloadInvoice}
                      disabled={invoiceDownloading}
                    >
                      {invoiceDownloading
                        ? "Preparing invoice..."
                        : "Download invoice"}
                    </Button>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Invoice is available after payment settlement.
                    </p>
                  )
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Invoice is not available for this booking yet.
                  </p>
                )}
                {invoiceError ? (
                  <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">
                    {invoiceError}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-slate-300">
              <p className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                <Ticket className="h-4 w-4" />
                Select a booking to view full details.
              </p>
              <p className="mt-2">
                Use the “View Booking” button in the list to load ticket,
                traveller, and payment information.
              </p>
            </div>
          )}
        </aside>
      </section>

      <Dialog
        open={isEditProfileOpen}
        onOpenChange={handleEditProfileOpenChange}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your personal details for bookings and invoices.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleProfileUpdate}>
            <div className="space-y-1.5">
              <label
                htmlFor="profile-full-name"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
              >
                Full name
              </label>
              <Input
                id="profile-full-name"
                value={profileForm.fullName}
                onChange={handleProfileFieldChange("fullName")}
                placeholder="Enter your full name"
                autoComplete="name"
                disabled={profileUpdateLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="profile-email"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
              >
                Email
              </label>
              <Input
                id="profile-email"
                type="email"
                value={profileForm.email}
                onChange={handleProfileFieldChange("email")}
                placeholder="name@example.com"
                autoComplete="email"
                disabled={profileUpdateLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="profile-phone"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
              >
                Phone
              </label>
              <Input
                id="profile-phone"
                value={profileForm.phone}
                onChange={handleProfileFieldChange("phone")}
                placeholder="+917840009613"
                autoComplete="tel"
                disabled={profileUpdateLoading}
              />
              <p className="text-xs text-slate-500">
                Use international format, for example +917840009613.
              </p>
            </div>

            {profileUpdateError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                {profileUpdateError}
              </p>
            ) : null}

            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleEditProfileOpenChange(false)}
                disabled={profileUpdateLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  profileUpdateLoading || !profile || !hasProfileChanges
                }
              >
                {profileUpdateLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;
