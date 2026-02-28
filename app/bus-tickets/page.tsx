"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bus,
  Check,
  Clock,
  Filter,
  MapPin,
  MessageSquare,
  Star,
  X,
} from "lucide-react";

import BusSearchForm from "@/components/bus-search-form";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

type SearchResult = {
  _id: string;
  busId?: number;
  busName?: string;
  busNumber?: string;
  operator?: string;
  totalSeats?: number;
  availableSeats?: number;
  farePerPassenger?: number;
  departureTime?: string;
  arrivalTime?: string;
  journeyDuration?: {
    formatted?: string;
  };
  direction?: "forward" | "return";
  boardingPoint?: string;
  droppingPoint?: string;
  route?: {
    origin?: string;
    destination?: string;
    routeCode?: string;
    stops?: {
      city?: string;
      arrivalTime?: { hours?: number; minutes?: number } | string | null;
      departureTime?: { hours?: number; minutes?: number } | string | null;
    }[];
    cancellationPolicy?: {
      before24h?: number;
      before12h?: number;
      noShow?: number;
    };
  };
  amenities?: {
    ac?: boolean;
    wifi?: boolean;
    chargingPoints?: boolean;
    toilet?: boolean;
    waterBottle?: boolean;
    blanket?: boolean;
    entertainment?: boolean;
  };
  features?: {
    busType?: string;
    deckCount?: number;
  };
  travelDate?: string;
  dayOfWeek?: string;
  operatingDays?: string[];
};

type BusDetails = {
  _id: string;
  busId?: number;
  busName?: string;
  busNumber?: string;
  operator?: string;
  totalSeats?: number;
  availableSeats?: number;
  farePerKm?: number;
  amenities?: SearchResult["amenities"];
  features?: SearchResult["features"] & {
    gpsTracking?: boolean;
    emergencyExit?: boolean;
    cctv?: boolean;
    wheelchairAccessible?: boolean;
  };
  route?: {
    routeCode?: string;
    origin?: string;
    destination?: string;
    duration?: { hours?: number; minutes?: number };
    stops?: {
      city?: string;
      arrivalTime?: { hours?: number; minutes?: number } | string | null;
      departureTime?: { hours?: number; minutes?: number } | string | null;
    }[];
    cancellationPolicy?: {
      before24h?: number;
      before12h?: number;
      noShow?: number;
    };
  };
  operatingDays?: string[];
  ratings?: number;
  reviews?: { rating?: number; comment?: string; createdAt?: string }[];
  model?: string;
  year?: number;
  insurance?: {
    provider?: string;
    policyNumber?: string;
    expiry?: string | Date;
  };
  currentDirection?: "forward" | "return";
  timing?: {
    departureTime?: string;
    arrivalTime?: string;
  };
};

type SeatLayoutElement = {
  type?: string;
  position?: { x?: number; y?: number };
  size?: { w?: number; h?: number };
  seatId?: string;
  status?: "available" | "booked" | "locked";
  available?: boolean;
  seat?: {
    label?: string;
    kind?: string;
    class?: string;
    fareGroup?: string;
    flags?: {
      nearWindow?: boolean;
      ladiesSeat?: boolean;
      blocked?: boolean;
      accessible?: boolean;
    };
  };
};

type SeatLayoutDeck = {
  deck?: string;
  grid?: { rows?: number; cols?: number };
  elements?: SeatLayoutElement[];
};

type SeatLayoutData = {
  seatLayout?: {
    layoutType?: string;
    orientation?: { front?: string; driverSide?: string };
    decks?: SeatLayoutDeck[];
    seats?: SeatLayoutElement["seat"][];
  } | null;
  direction?: "forward" | "return";
  travelDate?: string;
  availableSeats?: number;
  bookedSeats?: number;
  temporarilyLocked?: number;
};

type SelectedSeat = {
  key: string;
  label: string;
  seatId?: string;
  deck?: string;
  fare?: number;
};

type FetchError = {
  status?: number;
  message: string;
};

type PublicReview = {
  _id: string;
  user?: { _id?: string; fullName?: string };
  rating: number;
  comment?: string;
  createdAt: string;
  context?: string;
};

type ReviewStats = {
  avgRating: number;
  count: number;
  distribution: Record<number, number>;
};

type BusReviewsData = {
  reviews: PublicReview[];
  total: number;
  totalPages: number;
  currentPage: number;
  stats: ReviewStats;
};

type BusReviewsState = {
  loading: boolean;
  error: string | null;
  data: BusReviewsData | null;
};

const formatFare = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `₹${new Intl.NumberFormat("en-IN").format(Math.round(value))}`;
};

const formatClockTime = (value?: string) => {
  if (!value) return "--:--";
  const trimmed = value.trim();
  if (/am|pm/i.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return trimmed;
  const hours = Number(match[1]);
  const minutes = match[2];
  if (!Number.isFinite(hours)) return trimmed;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(hour12).padStart(2, "0")}:${minutes} ${period}`;
};

const parseTimeToMinutes = (value?: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  const meridiemMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (meridiemMatch) {
    const hours = Number(meridiemMatch[1]);
    const minutes = Number(meridiemMatch[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    const period = meridiemMatch[3].toUpperCase();
    const hour24 = period === "PM" ? (hours % 12) + 12 : hours % 12;
    return hour24 * 60 + minutes;
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const formatDuration = (
  value?: { hours?: number; minutes?: number } | null,
) => {
  if (!value) return "--";
  const hours = Number(value.hours ?? 0);
  const minutes = Number(value.minutes ?? 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "--";
  if (hours === 0 && minutes === 0) return "--";
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.join(" ");
};

const formatTimeValue = (
  value?: { hours?: number; minutes?: number } | string | null,
) => {
  if (!value) return "--:--";
  if (typeof value === "string") return formatClockTime(value);
  const hours = typeof value.hours === "number" ? value.hours : 0;
  const minutes = typeof value.minutes === "number" ? value.minutes : 0;
  return formatClockTime(
    `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
  );
};

const formatDateLabel = (value?: string | Date | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const buildBusDetailsKey = (busId: string, direction?: string) =>
  `${busId}_${direction || "forward"}`;

const BUS_TYPE_OPTIONS = [
  "Seater",
  "Sleeper",
  "Semi-Sleeper",
  "Luxury",
  "AC",
  "Non-AC",
];

const AMENITY_OPTIONS = [
  { key: "ac", label: "AC" },
  { key: "wifi", label: "Wi-Fi" },
  { key: "chargingPoints", label: "Charging points" },
  { key: "toilet", label: "Toilet" },
  { key: "waterBottle", label: "Water bottle" },
  { key: "blanket", label: "Blanket" },
  { key: "entertainment", label: "Entertainment" },
];

const SAFETY_FEATURE_OPTIONS = [
  { key: "gpsTracking", label: "GPS tracking" },
  { key: "emergencyExit", label: "Emergency exit" },
  { key: "cctv", label: "CCTV surveillance" },
  { key: "wheelchairAccessible", label: "Wheelchair accessible" },
];

const OPERATING_DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const sortOperatingDays = (days?: string[]) => {
  if (!Array.isArray(days)) return [];
  const daySet = new Set(days);
  const ordered = OPERATING_DAY_ORDER.filter((day) => daySet.has(day));
  const remainder = days.filter((day) => !OPERATING_DAY_ORDER.includes(day));
  return [...ordered, ...remainder];
};

const DEPARTURE_SLOTS = [
  { id: "before-6", label: "Before 6 AM", min: 0, max: 360 },
  { id: "6-12", label: "6 AM - 12 PM", min: 360, max: 720 },
  { id: "12-18", label: "12 PM - 6 PM", min: 720, max: 1080 },
  { id: "after-18", label: "After 6 PM", min: 1080, max: 1440 },
];

const normalizeSeatToken = (value?: string) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const getSeatElementClasses = (
  element: SeatLayoutElement,
  isSelected = false,
) => {
  const type = normalizeSeatToken(element.type);
  if (type !== "SEAT") {
    if (type === "AISLE") {
      return "bg-slate-100 dark:bg-slate-700/30 border border-dashed border-slate-200 dark:border-slate-600 text-[10px] text-slate-300 dark:text-slate-500";
    }
    if (type === "DRIVER") {
      return "bg-slate-100 dark:bg-slate-700/40 border border-slate-300 dark:border-slate-500 text-slate-500 dark:text-slate-400";
    }
    return "bg-slate-200 dark:bg-slate-700/30 text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.1em]";
  }

  const status = element.status || "available";
  const flags = element.seat?.flags || {};

  if (isSelected) {
    return "bg-rose-500 border border-rose-500 text-white shadow-sm shadow-rose-500/20";
  }

  if (flags.blocked) {
    return "bg-slate-200 dark:bg-slate-700/40 border border-slate-300 dark:border-slate-500 text-slate-400";
  }

  if (status === "booked") {
    return "bg-slate-300 dark:bg-slate-600 border border-slate-300 dark:border-slate-500 text-slate-500 dark:text-slate-400 line-through";
  }

  if (status === "locked") {
    return "bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400";
  }

  if (flags.ladiesSeat) {
    return "bg-rose-50 dark:bg-rose-900/20 border border-rose-400 dark:border-rose-500 text-rose-600 dark:text-rose-400";
  }

  if (flags.accessible) {
    return "bg-sky-50 dark:bg-sky-900/20 border border-sky-400 dark:border-sky-500 text-sky-700 dark:text-sky-400";
  }

  return "bg-white dark:bg-slate-700/40 border border-slate-300 dark:border-slate-500 text-slate-800 dark:text-slate-200";
};

const isSeatSelectable = (element: SeatLayoutElement) => {
  const type = normalizeSeatToken(element.type);
  if (type !== "SEAT") return false;
  if (element.available === false) return false;
  if (element.seat?.flags?.blocked) return false;
  const status = element.status || "available";
  if (status === "booked" || status === "locked") return false;
  return true;
};

const getSeatSelectionLabel = (element: SeatLayoutElement) => {
  if (element.seat?.label) return element.seat.label;
  if (element.seatId) return element.seatId;
  const x = element.position?.x ?? 0;
  const y = element.position?.y ?? 0;
  return `Seat ${x + 1}-${y + 1}`;
};

const getSeatSelectionKey = (deckKey: string, element: SeatLayoutElement) => {
  const label = element.seat?.label || element.seatId;
  if (label) return `${deckKey}:${label}`;
  const x = element.position?.x ?? 0;
  const y = element.position?.y ?? 0;
  return `${deckKey}:${x}-${y}`;
};

const getSeatElementLabel = (element: SeatLayoutElement) => {
  const type = normalizeSeatToken(element.type);
  if (type === "SEAT") {
    return element.seat?.label || element.seatId || "Seat";
  }
  if (type === "DRIVER") return "Driver";
  if (type === "DOOR") return "Door";
  if (type === "STAIRS") return "Stairs";
  if (type === "WC") return "WC";
  if (type === "ENTRY") return "Entry";
  if (type === "EXIT") return "Exit";
  return "";
};

const titleCase = (value?: string) => {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const BusTicketsContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const origin = searchParams.get("origin") ?? "";
  const destination = searchParams.get("destination") ?? "";
  const date = searchParams.get("date") ?? "";
  const directionParam = searchParams.get("direction");
  const direction =
    directionParam === "forward" ||
    directionParam === "return" ||
    directionParam === "both"
      ? directionParam
      : "both";

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FetchError | null>(null);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [selectedBusTypes, setSelectedBusTypes] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [selectedDepartureSlots, setSelectedDepartureSlots] = useState<
    string[]
  >([]);
  const [expandedBusId, setExpandedBusId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedBus, setSelectedBus] = useState<SearchResult | null>(null);
  const [seatLayouts, setSeatLayouts] = useState<
    Record<
      string,
      {
        loading: boolean;
        error: string | null;
        data: SeatLayoutData | null;
      }
    >
  >({});
  const [busDetails, setBusDetails] = useState<
    Record<
      string,
      {
        loading: boolean;
        error: string | null;
        data: BusDetails | null;
      }
    >
  >({});
  const [selectedSeatsByTrip, setSelectedSeatsByTrip] = useState<
    Record<string, SelectedSeat[]>
  >({});
  const [busReviews, setBusReviews] = useState<Record<string, BusReviewsState>>(
    {},
  );

  const hasQuery = useMemo(
    () => Boolean(origin && destination && date),
    [origin, destination, date],
  );

  const priceBounds = useMemo(() => {
    const fares = results
      .map((bus) => bus.farePerPassenger)
      .filter((value): value is number => typeof value === "number");
    if (!fares.length) {
      return { min: 0, max: 0 };
    }
    return {
      min: Math.floor(Math.min(...fares)),
      max: Math.ceil(Math.max(...fares)),
    };
  }, [results]);

  const operatorOptions = useMemo(() => {
    const operators = new Set<string>();
    results.forEach((bus) => {
      if (bus.operator) operators.add(bus.operator);
    });
    return Array.from(operators).sort((a, b) => a.localeCompare(b));
  }, [results]);

  const busTypeOptions = useMemo(() => {
    const types = new Set<string>();
    results.forEach((bus) => {
      if (bus.features?.busType) types.add(bus.features.busType);
    });
    const combined = new Set([...BUS_TYPE_OPTIONS, ...types]);
    return Array.from(combined);
  }, [results]);

  useEffect(() => {
    setPriceRange([priceBounds.min, priceBounds.max]);
    setSelectedBusTypes([]);
    setSelectedAmenities([]);
    setSelectedOperators([]);
    setSelectedDepartureSlots([]);
    setExpandedBusId(null);
    setDetailsOpen(false);
    setSelectedBus(null);
    setSelectedSeatsByTrip({});
  }, [origin, destination, date, direction, priceBounds.min, priceBounds.max]);

  useEffect(() => {
    if (!hasQuery) {
      setResults([]);
      setError({
        message: "Enter origin, destination, and travel date to search buses.",
      });
      return;
    }

    let active = true;
    const controller = new AbortController();

    const loadResults = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          origin,
          destination,
          date,
          direction,
        });

        const response = await fetch(
          `${apiUrl("/search-bus")}?${params.toString()}`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          },
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message =
            data?.message || "Unable to load bus results right now.";
          throw { status: response.status, message } as FetchError;
        }

        const items = Array.isArray(data?.data) ? data.data : [];
        if (active) {
          setResults(items);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const payload = err as FetchError;
        if (active) {
          setResults([]);
          setError({
            status: payload.status,
            message: payload.message || "Unable to load bus results right now.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadResults();

    return () => {
      active = false;
      controller.abort();
    };
  }, [origin, destination, date, direction, hasQuery]);

  const filteredResults = useMemo(() => {
    return results.filter((bus) => {
      const fare = bus.farePerPassenger;
      if (typeof fare === "number") {
        if (fare < priceRange[0] || fare > priceRange[1]) {
          return false;
        }
      }

      if (selectedBusTypes.length > 0) {
        const type = bus.features?.busType || "";
        if (!selectedBusTypes.includes(type)) return false;
      }

      if (selectedOperators.length > 0) {
        const operator = bus.operator || "";
        if (!selectedOperators.includes(operator)) return false;
      }

      if (selectedAmenities.length > 0) {
        const amenities = bus.amenities || {};
        const matchesAll = selectedAmenities.every(
          (key) => (amenities as Record<string, boolean>)[key],
        );
        if (!matchesAll) return false;
      }

      if (selectedDepartureSlots.length > 0) {
        const minutes = parseTimeToMinutes(bus.departureTime);
        if (minutes === null) return false;
        const matchesSlot = DEPARTURE_SLOTS.some((slot) => {
          if (!selectedDepartureSlots.includes(slot.id)) return false;
          return minutes >= slot.min && minutes < slot.max;
        });
        if (!matchesSlot) return false;
      }

      return true;
    });
  }, [
    results,
    priceRange,
    selectedBusTypes,
    selectedAmenities,
    selectedOperators,
    selectedDepartureSlots,
  ]);

  const selectedDetailsKey = selectedBus
    ? buildBusDetailsKey(selectedBus._id, selectedBus.direction)
    : null;
  const selectedDetailsState = selectedDetailsKey
    ? busDetails[selectedDetailsKey]
    : null;

  const loadBusDetails = async (bus: SearchResult, force = false) => {
    if (!bus?._id) return;
    const key = buildBusDetailsKey(bus._id, bus.direction);

    if (!force && (busDetails[key]?.data || busDetails[key]?.loading)) {
      return;
    }

    setBusDetails((prev) => ({
      ...prev,
      [key]: {
        loading: true,
        error: null,
        data: prev[key]?.data ?? null,
      },
    }));

    try {
      const response = await fetch(
        `${apiUrl(`/bus-details/${bus._id}`)}?direction=${bus.direction || "forward"}`,
        {
          method: "GET",
          credentials: "include",
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to load bus details.");
      }
      setBusDetails((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          error: null,
          data: payload?.data || null,
        },
      }));
    } catch (err) {
      setBusDetails((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          error: (err as Error).message || "Unable to load bus details.",
          data: prev[key]?.data ?? null,
        },
      }));
    }
  };

  const loadBusReviews = useCallback(
    async (busId: string) => {
      if (!busId) return;
      if (busReviews[busId]?.data || busReviews[busId]?.loading) return;

      setBusReviews((prev) => ({
        ...prev,
        [busId]: { loading: true, error: null, data: null },
      }));

      try {
        const response = await fetch(
          `${apiUrl("/api/reviews/bus/" + busId)}?limit=20`,
          { method: "GET" },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to load reviews.");
        }
        setBusReviews((prev) => ({
          ...prev,
          [busId]: { loading: false, error: null, data: payload?.data || null },
        }));
      } catch (err) {
        setBusReviews((prev) => ({
          ...prev,
          [busId]: {
            loading: false,
            error: (err as Error).message || "Unable to load reviews.",
            data: null,
          },
        }));
      }
    },
    [busReviews],
  );

  const openBusDetails = (bus: SearchResult) => {
    setSelectedBus(bus);
    setDetailsOpen(true);
    void loadBusDetails(bus);
    void loadBusReviews(bus._id);
  };

  const handleDetailsOpenChange = (open: boolean) => {
    setDetailsOpen(open);
    if (!open) {
      setSelectedBus(null);
    }
  };

  const toggleSeatLayout = async (bus: SearchResult) => {
    if (!bus?._id) return;
    const key = `${bus._id}_${date}_${bus.direction || "forward"}_${bus.boardingPoint || ""}_${bus.droppingPoint || ""}`;

    if (expandedBusId === bus._id) {
      setExpandedBusId(null);
      return;
    }

    setExpandedBusId(bus._id);

    if (seatLayouts[key]?.data || seatLayouts[key]?.loading) {
      return;
    }

    setSeatLayouts((prev) => ({
      ...prev,
      [key]: { loading: true, error: null, data: null },
    }));

    try {
      const seatLayoutParams = new URLSearchParams({
        busId: bus._id,
        travelDate: date,
        direction: bus.direction || "forward",
      });
      if (bus.boardingPoint) {
        seatLayoutParams.set("boardingPoint", bus.boardingPoint);
      }
      if (bus.droppingPoint) {
        seatLayoutParams.set("droppingPoint", bus.droppingPoint);
      }

      const response = await fetch(
        `${apiUrl("/bus-seat-layout")}?${seatLayoutParams.toString()}`,
        {
          method: "GET",
          credentials: "include",
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to load seat layout.");
      }
      setSeatLayouts((prev) => ({
        ...prev,
        [key]: { loading: false, error: null, data: payload?.data || null },
      }));
    } catch (err) {
      setSeatLayouts((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          error: (err as Error).message || "Unable to load seat layout.",
          data: null,
        },
      }));
    }
  };

  const resetFilters = () => {
    setPriceRange([priceBounds.min, priceBounds.max]);
    setSelectedBusTypes([]);
    setSelectedAmenities([]);
    setSelectedOperators([]);
    setSelectedDepartureSlots([]);
  };

  const handleSearch = (params: {
    origin: string;
    destination: string;
    date: string;
    direction?: "forward" | "return" | "both";
  }) => {
    const query = new URLSearchParams({
      origin: params.origin,
      destination: params.destination,
      date: params.date,
      direction: params.direction ?? "both",
    });
    router.push(`/bus-tickets?${query.toString()}`);
  };

  const detailsData = selectedDetailsState?.data;
  const routeInfo = detailsData?.route ?? selectedBus?.route;
  const amenities = detailsData?.amenities ?? selectedBus?.amenities;
  const features = detailsData?.features ?? selectedBus?.features;
  const busName = detailsData?.busName ?? selectedBus?.busName ?? "Bus Service";
  const operatorName =
    detailsData?.operator ?? selectedBus?.operator ?? "Operator";
  const busNumber = detailsData?.busNumber ?? selectedBus?.busNumber;
  const busType = features?.busType;
  const deckCount = features?.deckCount;
  const ratingValue =
    typeof detailsData?.ratings === "number" && detailsData.ratings > 0
      ? detailsData.ratings
      : null;
  const reviewCount = detailsData?.reviews?.length ?? 0;
  const travelDateLabel = selectedBus?.travelDate
    ? formatDateLabel(selectedBus.travelDate)
    : "";
  const departureTime =
    detailsData?.timing?.departureTime ?? selectedBus?.departureTime;
  const arrivalTime =
    detailsData?.timing?.arrivalTime ?? selectedBus?.arrivalTime;
  const durationLabel = detailsData?.route?.duration
    ? formatDuration(detailsData.route.duration)
    : selectedBus?.journeyDuration?.formatted || "--";
  const availableSeats =
    selectedBus?.availableSeats ?? detailsData?.availableSeats;
  const totalSeats = selectedBus?.totalSeats ?? detailsData?.totalSeats;
  const operatingDays = sortOperatingDays(
    detailsData?.operatingDays ?? selectedBus?.operatingDays,
  );
  const routeStops = Array.isArray(routeInfo?.stops)
    ? (routeInfo?.stops ?? [])
    : [];
  const farePerPassengerLabel =
    typeof selectedBus?.farePerPassenger === "number"
      ? formatFare(selectedBus.farePerPassenger)
      : null;
  const infoRows = [
    { label: "Bus number", value: busNumber },
    { label: "Model", value: detailsData?.model },
    {
      label: "Year",
      value: typeof detailsData?.year === "number" ? `${detailsData.year}` : "",
    },
    {
      label: "Bus ID",
      value:
        typeof detailsData?.busId === "number" ? `${detailsData.busId}` : "",
    },
    {
      label: "Decks",
      value: typeof deckCount === "number" ? `${deckCount}` : "",
    },
    {
      label: "Fare per km",
      value:
        typeof detailsData?.farePerKm === "number"
          ? formatFare(detailsData.farePerKm)
          : "",
    },
  ].filter((row) => row.value);
  const detailsTabClass =
    "rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300 data-[state=active]:border-rose-500 data-[state=active]:bg-rose-500 data-[state=active]:text-white";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-rose-50/30 dark:from-[#0b1020] dark:via-slate-900 dark:to-slate-900 pb-16 pt-24">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500 dark:text-rose-400">
            Bus Tickets
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            Find buses for your route
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Use the search below to view available buses and timings.
          </p>
        </div>

        <div className="relative z-30 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4 shadow-sm dark:shadow-black/20 backdrop-blur-sm">
          <BusSearchForm
            initialFrom={origin}
            initialTo={destination}
            initialDate={date}
            direction={direction}
            onSearch={handleSearch}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4 shadow-sm dark:shadow-black/20 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                  <Filter className="h-4 w-4" />
                  Filters
                </div>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors"
                >
                  Clear all
                </button>
              </div>

              <div className="mt-4">
                <Accordion
                  type="multiple"
                  defaultValue={[
                    "bus-type",
                    "price",
                    "departure",
                    "amenities",
                    "operator",
                  ]}
                >
                  <AccordionItem value="bus-type">
                    <AccordionTrigger>Bus Type</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-2">
                        {busTypeOptions.map((type) => (
                          <label
                            key={type}
                            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                          >
                            <Checkbox
                              checked={selectedBusTypes.includes(type)}
                              onCheckedChange={(checked) =>
                                setSelectedBusTypes((prev) =>
                                  checked
                                    ? [...prev, type]
                                    : prev.filter((item) => item !== type),
                                )
                              }
                            />
                            {type}
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="price">
                    <AccordionTrigger>Price Range</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        <Slider
                          value={priceRange}
                          min={priceBounds.min}
                          max={priceBounds.max}
                          step={1}
                          onValueChange={(value) =>
                            setPriceRange([value[0], value[1]])
                          }
                          disabled={priceBounds.max === 0}
                        />
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>₹{priceRange[0]}</span>
                          <span>₹{priceRange[1]}</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="departure">
                    <AccordionTrigger>Departure Time</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-2">
                        {DEPARTURE_SLOTS.map((slot) => (
                          <label
                            key={slot.id}
                            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                          >
                            <Checkbox
                              checked={selectedDepartureSlots.includes(slot.id)}
                              onCheckedChange={(checked) =>
                                setSelectedDepartureSlots((prev) =>
                                  checked
                                    ? [...prev, slot.id]
                                    : prev.filter((item) => item !== slot.id),
                                )
                              }
                            />
                            {slot.label}
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="amenities">
                    <AccordionTrigger>Amenities</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-2">
                        {AMENITY_OPTIONS.map((item) => (
                          <label
                            key={item.key}
                            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                          >
                            <Checkbox
                              checked={selectedAmenities.includes(item.key)}
                              onCheckedChange={(checked) =>
                                setSelectedAmenities((prev) =>
                                  checked
                                    ? [...prev, item.key]
                                    : prev.filter((key) => key !== item.key),
                                )
                              }
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="operator">
                    <AccordionTrigger>Bus Partner</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-2">
                        {operatorOptions.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            No operators found.
                          </p>
                        ) : (
                          operatorOptions.map((operator) => (
                            <label
                              key={operator}
                              className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                            >
                              <Checkbox
                                checked={selectedOperators.includes(operator)}
                                onCheckedChange={(checked) =>
                                  setSelectedOperators((prev) =>
                                    checked
                                      ? [...prev, operator]
                                      : prev.filter(
                                          (item) => item !== operator,
                                        ),
                                  )
                                }
                              />
                              {operator}
                            </label>
                          ))
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          </aside>

          <section className="space-y-4">
            {!loading && !error && results.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{filteredResults.length} buses found</span>
                <span>Sorted by departure time</span>
              </div>
            ) : null}

            {loading && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-6 text-sm text-slate-500 dark:text-slate-400">
                Loading available buses...
              </div>
            )}

            {!loading && error && (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-6 text-sm text-rose-700 dark:text-rose-400">
                <p>{error.message}</p>
                {error.status === 401 && (
                  <div className="mt-4">
                    <Button asChild>
                      <Link href="/login">Sign in to search</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!loading && !error && results.length === 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-6 text-sm text-slate-500 dark:text-slate-400">
                No buses found for this route and date. Try another date or city
                pair.
              </div>
            )}

            {!loading &&
              !error &&
              results.length > 0 &&
              filteredResults.length === 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-6 text-sm text-slate-500 dark:text-slate-400">
                  No buses match the selected filters.
                </div>
              )}

            {!loading && !error && filteredResults.length > 0 && (
              <div className="space-y-4">
                {filteredResults.map((bus) => {
                  const seatsLeft =
                    typeof bus.availableSeats === "number"
                      ? bus.availableSeats
                      : null;
                  const totalSeats =
                    typeof bus.totalSeats === "number" ? bus.totalSeats : null;

                  return (
                    <div
                      key={bus._id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-5 shadow-sm dark:shadow-black/20 backdrop-blur-sm transition-all hover:shadow-md dark:hover:shadow-black/30 hover:border-slate-300 dark:hover:border-slate-600"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                            <span>{bus.route?.routeCode || "Route"}</span>
                            {bus.direction && (
                              <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                                {bus.direction === "return"
                                  ? "Return"
                                  : "Forward"}
                              </span>
                            )}
                            {bus.dayOfWeek && (
                              <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                                {bus.dayOfWeek}
                              </span>
                            )}
                          </div>
                          <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                            {bus.busName || "Bus Service"}
                          </h2>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {bus.operator || "Operator"}
                            {bus.features?.busType
                              ? ` • ${bus.features.busType}`
                              : ""}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {bus.boardingPoint || origin} →{" "}
                              {bus.droppingPoint || destination}
                            </span>
                            {bus.busNumber ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1">
                                <Bus className="h-3.5 w-3.5" />
                                {bus.busNumber}
                              </span>
                            ) : null}
                            {bus.travelDate ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1">
                                <Clock className="h-3.5 w-3.5" />
                                {bus.travelDate}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="min-w-[260px] flex items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-700 pt-4 text-sm text-slate-600 dark:text-slate-300 lg:border-t-0 lg:border-l lg:border-r lg:px-4 lg:pt-0">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                              Depart
                            </p>
                            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                              {formatClockTime(bus.departureTime)}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              {bus.boardingPoint || origin}
                            </p>
                          </div>
                          <div className="flex flex-col items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                            <span>
                              {bus.journeyDuration?.formatted || "--"}
                            </span>
                            <span className="h-px w-16 bg-slate-200 dark:bg-slate-600" />
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                              Arrive
                            </p>
                            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                              {formatClockTime(bus.arrivalTime)}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              {bus.droppingPoint || destination}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-3 lg:items-end">
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                              From
                            </p>
                            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                              {formatFare(bus.farePerPassenger)}
                            </p>
                          </div>
                          <Button
                            className="rounded-full bg-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500 shadow-sm shadow-rose-500/20"
                            onClick={() => toggleSeatLayout(bus)}
                          >
                            {expandedBusId === bus._id
                              ? "Hide Seats"
                              : "Select Seats"}
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-rose-300 hover:text-rose-600 dark:hover:border-rose-500 dark:hover:text-rose-400"
                            onClick={() => openBusDetails(bus)}
                          >
                            Bus details
                          </Button>
                          {seatsLeft !== null && totalSeats !== null ? (
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              {seatsLeft} seats left
                            </div>
                          ) : null}
                          {seatsLeft !== null && totalSeats !== null ? (
                            <div className="text-xs text-slate-400 dark:text-slate-500">
                              {seatsLeft}/{totalSeats} available
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {expandedBusId === bus._id ? (
                        <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                          {(() => {
                            const key = `${bus._id}_${date}_${bus.direction || "forward"}_${bus.boardingPoint || ""}_${bus.droppingPoint || ""}`;
                            const state = seatLayouts[key];
                            if (!state || state.loading) {
                              return (
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-6 text-sm text-slate-500 dark:text-slate-400">
                                  Loading seat layout...
                                </div>
                              );
                            }
                            if (state.error) {
                              return (
                                <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-6 text-sm text-rose-700 dark:text-rose-400">
                                  {state.error}
                                </div>
                              );
                            }
                            const layout = state.data?.seatLayout;
                            const decks = layout?.decks || [];
                            if (!layout || decks.length === 0) {
                              return (
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-6 text-sm text-slate-500 dark:text-slate-400">
                                  Seat layout not available.
                                </div>
                              );
                            }
                            const layoutSeats = Array.isArray(layout.seats)
                              ? layout.seats
                              : [];
                            const fareChip = formatFare(bus.farePerPassenger);
                            const seatKinds = new Set<string>();
                            const seatClasses = new Set<string>();
                            layoutSeats.forEach((seat) => {
                              if (seat?.kind) seatKinds.add(seat.kind);
                              if (seat?.class) seatClasses.add(seat.class);
                            });
                            const seatCategories = Array.from(
                              new Set([
                                ...Array.from(seatKinds),
                                ...Array.from(seatClasses),
                              ]),
                            )
                              .map(titleCase)
                              .filter(Boolean);
                            const selectedSeats =
                              selectedSeatsByTrip[key] ?? [];
                            const selectedSeatKeys = new Set(
                              selectedSeats.map((seat) => seat.key),
                            );
                            const seatFareValue =
                              typeof bus.farePerPassenger === "number"
                                ? bus.farePerPassenger
                                : null;
                            const totalFareValue =
                              seatFareValue !== null
                                ? seatFareValue * selectedSeats.length
                                : null;

                            return (
                              <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-rose-200 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/30 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                                      All
                                    </span>
                                    {fareChip !== "N/A" ? (
                                      <span className="rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/40 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        {fareChip}
                                      </span>
                                    ) : null}
                                  </div>
                                  {seatCategories.length > 0 ? (
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                        Seat categories
                                      </span>
                                      {seatCategories.map((category) => (
                                        <span
                                          key={category}
                                          className="rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/40 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                                        >
                                          {category}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex h-4 w-6 rounded-[6px] border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700/40" />
                                    Available
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex h-4 w-6 rounded-[6px] border border-rose-400 dark:border-rose-500 bg-rose-50 dark:bg-rose-900/20" />
                                    For Female
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex h-4 w-6 rounded-[6px] border border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/30" />
                                    Locked
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex h-4 w-6 rounded-[6px] border border-slate-300 dark:border-slate-500 bg-slate-300 dark:bg-slate-600" />
                                    Booked
                                  </div>
                                </div>

                                <Tabs
                                  defaultValue={decks[0]?.deck || "deck-0"}
                                  className="space-y-4"
                                >
                                  <TabsList className="flex flex-wrap gap-2 bg-transparent p-0">
                                    {decks.map((deck, index) => {
                                      const label =
                                        deck.deck || `Deck ${index + 1}`;
                                      return (
                                        <TabsTrigger
                                          key={label}
                                          value={deck.deck || `deck-${index}`}
                                          className="rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300 data-[state=active]:border-rose-500 data-[state=active]:bg-rose-500 data-[state=active]:text-white"
                                        >
                                          {label}
                                        </TabsTrigger>
                                      );
                                    })}
                                  </TabsList>

                                  {decks.map((deck, index) => {
                                    const deckKey =
                                      deck.deck || `deck-${index}`;
                                    const deckLabel =
                                      deck.deck || `Deck ${index + 1}`;
                                    const rows = deck.grid?.rows || 0;
                                    const cols = deck.grid?.cols || 0;
                                    const elements = deck.elements || [];
                                    const deckName = normalizeSeatToken(
                                      deck.deck,
                                    );
                                    const isLowerDeck = deckName === "LOWER";
                                    const normalizedElements = isLowerDeck
                                      ? elements
                                      : elements.filter(
                                          (element) =>
                                            normalizeSeatToken(element.type) !==
                                            "DRIVER",
                                        );
                                    const hasDriver = normalizedElements.some(
                                      (element) =>
                                        normalizeSeatToken(element.type) ===
                                        "DRIVER",
                                    );
                                    const front =
                                      layout?.orientation?.front?.toUpperCase() ||
                                      "TOP";
                                    const driverSide =
                                      layout?.orientation?.driverSide?.toUpperCase() ||
                                      "LEFT";
                                    const seatPositions = normalizedElements
                                      .map((element) => {
                                        if (
                                          normalizeSeatToken(element.type) !==
                                          "SEAT"
                                        ) {
                                          return null;
                                        }
                                        return {
                                          x: element.position?.x ?? 0,
                                          y: element.position?.y ?? 0,
                                        };
                                      })
                                      .filter(
                                        (
                                          value,
                                        ): value is { x: number; y: number } =>
                                          Boolean(value),
                                      );
                                    const frontRowIndex =
                                      seatPositions.length > 0
                                        ? front === "BOTTOM"
                                          ? Math.max(
                                              ...seatPositions.map(
                                                (pos) => pos.y,
                                              ),
                                            )
                                          : Math.min(
                                              ...seatPositions.map(
                                                (pos) => pos.y,
                                              ),
                                            )
                                        : null;
                                    const frontRowSeats =
                                      frontRowIndex === null
                                        ? []
                                        : seatPositions
                                            .filter(
                                              (pos) => pos.y === frontRowIndex,
                                            )
                                            .sort((a, b) => a.x - b.x);
                                    const targetSeatPlacement =
                                      frontRowSeats.length >= 2
                                        ? (() => {
                                            const sideTarget =
                                              driverSide === "RIGHT"
                                                ? cols - 1
                                                : 0;
                                            let bestPair: {
                                              left: { x: number; y: number };
                                              right: { x: number; y: number };
                                              distance: number;
                                              sideBias: number;
                                              gap: number;
                                            } | null = null;

                                            for (
                                              let i = 0;
                                              i < frontRowSeats.length - 1;
                                              i += 1
                                            ) {
                                              for (
                                                let j = i + 1;
                                                j < frontRowSeats.length;
                                                j += 1
                                              ) {
                                                const left = frontRowSeats[i];
                                                const right = frontRowSeats[j];
                                                const midpoint =
                                                  (left.x + right.x) / 2;
                                                const distance = Math.abs(
                                                  midpoint - sideTarget,
                                                );
                                                const sideBias =
                                                  driverSide === "RIGHT"
                                                    ? -midpoint
                                                    : midpoint;
                                                const gap = right.x - left.x;

                                                if (
                                                  !bestPair ||
                                                  distance <
                                                    bestPair.distance ||
                                                  (distance ===
                                                    bestPair.distance &&
                                                    sideBias <
                                                      bestPair.sideBias) ||
                                                  (distance ===
                                                    bestPair.distance &&
                                                    sideBias ===
                                                      bestPair.sideBias &&
                                                    gap < bestPair.gap)
                                                ) {
                                                  bestPair = {
                                                    left,
                                                    right,
                                                    distance,
                                                    sideBias,
                                                    gap,
                                                  };
                                                }
                                              }
                                            }

                                            if (!bestPair) return null;

                                            return {
                                              colStart: bestPair.left.x,
                                              colSpan:
                                                bestPair.right.x -
                                                bestPair.left.x +
                                                1,
                                              rowStart: bestPair.left.y,
                                            };
                                          })()
                                        : null;

                                    const isSoftElement = (type: string) =>
                                      type === "AISLE" || type === "GAP";

                                    const occupied = new Set<string>();
                                    normalizedElements.forEach((element) => {
                                      const type = normalizeSeatToken(
                                        element.type,
                                      );
                                      if (type && isSoftElement(type)) return;
                                      const x = element.position?.x ?? 0;
                                      const y = element.position?.y ?? 0;
                                      const w = element.size?.w ?? 1;
                                      const h = element.size?.h ?? 1;
                                      for (let dx = 0; dx < w; dx += 1) {
                                        for (let dy = 0; dy < h; dy += 1) {
                                          occupied.add(`${x + dx}:${y + dy}`);
                                        }
                                      }
                                    });

                                    const preferredRow =
                                      front === "BOTTOM" ? rows - 1 : 0;
                                    const preferredCol =
                                      driverSide === "RIGHT" ? cols - 1 : 0;
                                    const fallbackRow =
                                      front === "BOTTOM" ? 0 : rows - 1;
                                    const fallbackCol =
                                      driverSide === "RIGHT" ? 0 : cols - 1;

                                    const driverCandidates = [
                                      { x: preferredCol, y: preferredRow },
                                      { x: fallbackCol, y: preferredRow },
                                      { x: preferredCol, y: fallbackRow },
                                      { x: fallbackCol, y: fallbackRow },
                                    ].filter(
                                      (candidate) =>
                                        candidate.x >= 0 &&
                                        candidate.y >= 0 &&
                                        candidate.x < cols &&
                                        candidate.y < rows,
                                    );

                                    const driverPlacement =
                                      isLowerDeck &&
                                      !hasDriver &&
                                      rows > 0 &&
                                      cols > 0
                                        ? driverCandidates.find(
                                            (candidate) =>
                                              !occupied.has(
                                                `${candidate.x}:${candidate.y}`,
                                              ),
                                          )
                                        : null;
                                    const isFiveByFive =
                                      rows === 5 && cols === 5;
                                    const showDriverBadge =
                                      isLowerDeck &&
                                      !hasDriver &&
                                      !driverPlacement &&
                                      isFiveByFive;
                                    const driverBadgePlacement =
                                      showDriverBadge && targetSeatPlacement
                                        ? targetSeatPlacement
                                        : null;
                                    const driverPadClass = showDriverBadge
                                      ? "pt-12"
                                      : "";

                                    const deckElements = driverPlacement
                                      ? [
                                          ...normalizedElements,
                                          {
                                            type: "DRIVER",
                                            position: driverPlacement,
                                            size: { w: 1, h: 1 },
                                          },
                                        ]
                                      : normalizedElements;

                                    return (
                                      <TabsContent
                                        key={deckKey}
                                        value={deckKey}
                                      >
                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4 shadow-sm dark:shadow-black/20">
                                          <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                            <span>{deck.deck || "Deck"}</span>
                                            <span>
                                              {rows} x {cols}
                                            </span>
                                          </div>
                                          <div
                                            className={cn(
                                              "relative",
                                              driverPadClass,
                                            )}
                                          >
                                            <div
                                              className="grid gap-2"
                                              style={{
                                                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                                                gridAutoRows: "40px",
                                              }}
                                            >
                                              {driverBadgePlacement ? (
                                                <div
                                                  className="pointer-events-none z-10 flex h-10 w-10 items-center justify-center justify-self-center self-start rounded-lg border border-slate-300 dark:border-slate-500 bg-slate-100 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400 shadow-sm -translate-y-full"
                                                  style={{
                                                    gridColumn: `${driverBadgePlacement.colStart + 1} / span ${driverBadgePlacement.colSpan}`,
                                                    gridRow: `${driverBadgePlacement.rowStart + 1} / span 1`,
                                                    transform:
                                                      "translateY(calc(-100% - 8px))",
                                                  }}
                                                >
                                                  <svg
                                                    viewBox="0 0 24 24"
                                                    className="h-5 w-5"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.6"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    aria-hidden="true"
                                                  >
                                                    <circle
                                                      cx="12"
                                                      cy="12"
                                                      r="9"
                                                    />
                                                    <circle
                                                      cx="12"
                                                      cy="12"
                                                      r="2"
                                                      fill="currentColor"
                                                      stroke="none"
                                                    />
                                                    <path d="M3 12h5" />
                                                    <path d="M16 12h5" />
                                                    <path d="M8 12l-3.5 6" />
                                                    <path d="M16 12l3.5 6" />
                                                  </svg>
                                                  <span className="sr-only">
                                                    Driver
                                                  </span>
                                                </div>
                                              ) : null}
                                              {deckElements.map(
                                                (element, elementIndex) => {
                                                  const x =
                                                    element.position?.x ?? 0;
                                                  const y =
                                                    element.position?.y ?? 0;
                                                  const w =
                                                    element.size?.w ?? 1;
                                                  const h =
                                                    element.size?.h ?? 1;
                                                  const label =
                                                    getSeatElementLabel(
                                                      element,
                                                    );
                                                  const elementType =
                                                    normalizeSeatToken(
                                                      element.type,
                                                    );
                                                  const isSeat =
                                                    elementType === "SEAT";
                                                  const isDriver =
                                                    elementType === "DRIVER";
                                                  const seatFare =
                                                    fareChip !== "N/A"
                                                      ? fareChip
                                                      : "";
                                                  const seatLabel =
                                                    getSeatSelectionLabel(
                                                      element,
                                                    );
                                                  const seatKey =
                                                    getSeatSelectionKey(
                                                      deckKey,
                                                      element,
                                                    );
                                                  const seatSelectable =
                                                    isSeatSelectable(element);
                                                  const seatSelected =
                                                    isSeat &&
                                                    selectedSeatKeys.has(
                                                      seatKey,
                                                    );
                                                  const elementClassName = cn(
                                                    "flex items-center justify-center rounded-md text-[10px] font-semibold",
                                                    isSeat &&
                                                      "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1",
                                                    isSeat &&
                                                      seatSelectable &&
                                                      "cursor-pointer hover:border-rose-300 hover:text-black",
                                                    isSeat &&
                                                      !seatSelectable &&
                                                      "cursor-not-allowed opacity-70",
                                                    isDriver && "z-10",
                                                    getSeatElementClasses(
                                                      element,
                                                      seatSelected,
                                                    ),
                                                  );

                                                  const gridStyle = {
                                                    gridColumn: `${x + 1} / span ${w}`,
                                                    gridRow: `${y + 1} / span ${h}`,
                                                  };

                                                  if (isSeat) {
                                                    return (
                                                      <button
                                                        key={`${deckKey}-${elementIndex}`}
                                                        type="button"
                                                        className={
                                                          elementClassName
                                                        }
                                                        style={gridStyle}
                                                        disabled={
                                                          !seatSelectable
                                                        }
                                                        aria-pressed={
                                                          seatSelected
                                                        }
                                                        onClick={() => {
                                                          if (!seatSelectable)
                                                            return;
                                                          setSelectedSeatsByTrip(
                                                            (prev) => {
                                                              const current =
                                                                prev[key] ?? [];
                                                              const alreadySelected =
                                                                current.some(
                                                                  (seat) =>
                                                                    seat.key ===
                                                                    seatKey,
                                                                );
                                                              if (
                                                                alreadySelected
                                                              ) {
                                                                return {
                                                                  ...prev,
                                                                  [key]:
                                                                    current.filter(
                                                                      (seat) =>
                                                                        seat.key !==
                                                                        seatKey,
                                                                    ),
                                                                };
                                                              }
                                                              return {
                                                                ...prev,
                                                                [key]: [
                                                                  ...current,
                                                                  {
                                                                    key: seatKey,
                                                                    label:
                                                                      seatLabel,
                                                                    seatId:
                                                                      element.seatId,
                                                                    deck: deckLabel,
                                                                    fare:
                                                                      seatFareValue ??
                                                                      undefined,
                                                                  },
                                                                ],
                                                              };
                                                            },
                                                          );
                                                        }}
                                                      >
                                                        <div className="flex flex-col items-center leading-tight">
                                                          <span className="text-[9px] font-semibold uppercase text-current opacity-70">
                                                            {label}
                                                          </span>
                                                          {seatFare ? (
                                                            <span className="text-[10px] font-semibold text-current">
                                                              {seatFare}
                                                            </span>
                                                          ) : null}
                                                        </div>
                                                      </button>
                                                    );
                                                  }

                                                  return (
                                                    <div
                                                      key={`${deckKey}-${elementIndex}`}
                                                      className={
                                                        elementClassName
                                                      }
                                                      style={gridStyle}
                                                    >
                                                      {isDriver ? (
                                                        <div className="flex flex-col items-center gap-0.5 text-[9px] uppercase tracking-[0.2em] text-current">
                                                          <svg
                                                            viewBox="0 0 24 24"
                                                            className="h-4 w-4"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1.6"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            aria-hidden="true"
                                                          >
                                                            <circle
                                                              cx="12"
                                                              cy="12"
                                                              r="9"
                                                            />
                                                            <circle
                                                              cx="12"
                                                              cy="12"
                                                              r="2"
                                                              fill="currentColor"
                                                              stroke="none"
                                                            />
                                                            <path d="M3 12h5" />
                                                            <path d="M16 12h5" />
                                                            <path d="M8 12l-3.5 6" />
                                                            <path d="M16 12l3.5 6" />
                                                          </svg>
                                                          <span className="sr-only">
                                                            Driver
                                                          </span>
                                                        </div>
                                                      ) : (
                                                        label
                                                      )}
                                                    </div>
                                                  );
                                                },
                                              )}
                                            </div>
                                            {showDriverBadge &&
                                            !driverBadgePlacement ? (
                                              <div
                                                className={cn(
                                                  "pointer-events-none absolute z-10 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-500 bg-slate-100 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400 shadow-sm",
                                                  "top-2",
                                                  driverSide === "RIGHT"
                                                    ? "right-2"
                                                    : "left-2",
                                                )}
                                              >
                                                <svg
                                                  viewBox="0 0 24 24"
                                                  className="h-5 w-5"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="1.6"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  aria-hidden="true"
                                                >
                                                  <circle
                                                    cx="12"
                                                    cy="12"
                                                    r="9"
                                                  />
                                                  <circle
                                                    cx="12"
                                                    cy="12"
                                                    r="2"
                                                    fill="currentColor"
                                                    stroke="none"
                                                  />
                                                  <path d="M3 12h5" />
                                                  <path d="M16 12h5" />
                                                  <path d="M8 12l-3.5 6" />
                                                  <path d="M16 12l3.5 6" />
                                                </svg>
                                                <span className="sr-only">
                                                  Driver
                                                </span>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      </TabsContent>
                                    );
                                  })}
                                </Tabs>

                                {selectedSeats.length > 0 ? (
                                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4 shadow-sm dark:shadow-black/20">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                          Selected seats
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {selectedSeats.map((seat) => (
                                            <span
                                              key={seat.key}
                                              className="rounded-full border border-rose-200 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/30 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400"
                                            >
                                              {seat.label}
                                            </span>
                                          ))}
                                        </div>
                                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                                          Total fare{" "}
                                          <span className="font-semibold text-slate-900 dark:text-white">
                                            {totalFareValue !== null
                                              ? formatFare(totalFareValue)
                                              : "N/A"}
                                          </span>
                                        </p>
                                      </div>
                                      <Button
                                        className="rounded-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-sm shadow-emerald-500/20"
                                        onClick={() => {
                                          const seatTokens = selectedSeats
                                            .map((seat) => seat.label)
                                            .filter(Boolean)
                                            .join(",");
                                          const params = new URLSearchParams({
                                            busId: bus._id,
                                            travelDate: date,
                                            direction:
                                              bus.direction || "forward",
                                            seats: seatTokens,
                                            boardingPoint:
                                              bus.boardingPoint || origin,
                                            droppingPoint:
                                              bus.droppingPoint || destination,
                                          });
                                          if (bus.busName) {
                                            params.set("busName", bus.busName);
                                          }
                                          if (bus.operator) {
                                            params.set(
                                              "operator",
                                              bus.operator,
                                            );
                                          }
                                          if (
                                            typeof bus.farePerPassenger ===
                                            "number"
                                          ) {
                                            params.set(
                                              "fare",
                                              `${bus.farePerPassenger}`,
                                            );
                                          }
                                          router.push(
                                            `/checkout?${params.toString()}`,
                                          );
                                        }}
                                      >
                                        Proceed to payment
                                        <ArrowRight className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40 p-4 text-sm text-slate-500 dark:text-slate-400">
                                    Select seats to continue.
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
      <Dialog open={detailsOpen} onOpenChange={handleDetailsOpenChange}>
        <DialogContent className="left-auto right-0 top-0 h-screen w-full max-w-xl translate-x-0 translate-y-0 rounded-none border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0 sm:rounded-none">
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 pr-12">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                Bus Details
              </p>
              <DialogTitle className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {selectedBus ? busName : "Bus Details"}
              </DialogTitle>
              {selectedBus ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {operatorName}
                </p>
              ) : null}
              {selectedBus ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  {busNumber ? (
                    <span className="rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1 font-semibold">
                      {busNumber}
                    </span>
                  ) : null}
                  {busType ? (
                    <span className="rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1 font-semibold">
                      {busType}
                    </span>
                  ) : null}
                  {typeof deckCount === "number" ? (
                    <span className="rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1 font-semibold">
                      {deckCount} deck{deckCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {selectedBus?.direction ? (
                    <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 font-semibold text-slate-600 dark:text-slate-300">
                      {selectedBus.direction === "return"
                        ? "Return"
                        : "Forward"}{" "}
                      trip
                    </span>
                  ) : null}
                  {travelDateLabel ? (
                    <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 font-semibold text-slate-600 dark:text-slate-300">
                      {travelDateLabel}
                    </span>
                  ) : null}
                  {ratingValue !== null ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-1 font-semibold text-amber-700 dark:text-amber-400">
                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      {ratingValue.toFixed(1)}
                      {reviewCount ? (
                        <span className="text-[11px] font-medium text-amber-600">
                          ({reviewCount})
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {!selectedBus ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-4 text-sm text-slate-500 dark:text-slate-400">
                  Select a bus to view details.
                </div>
              ) : !selectedDetailsState || selectedDetailsState.loading ? (
                <div className="space-y-4">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  </div>
                  <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                </div>
              ) : selectedDetailsState.error ? (
                <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-400">
                  <p>{selectedDetailsState.error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-400 hover:border-rose-300 dark:hover:border-rose-600"
                    onClick={() => {
                      if (selectedBus) {
                        void loadBusDetails(selectedBus, true);
                      }
                    }}
                  >
                    Try again
                  </Button>
                </div>
              ) : !detailsData ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-4 text-sm text-slate-500 dark:text-slate-400">
                  Bus details are not available right now.
                </div>
              ) : (
                <Tabs defaultValue="overview" className="space-y-4">
                  <TabsList className="flex h-auto flex-wrap gap-2 bg-transparent p-0">
                    <TabsTrigger value="overview" className={detailsTabClass}>
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="amenities" className={detailsTabClass}>
                      Amenities
                    </TabsTrigger>
                    <TabsTrigger value="route" className={detailsTabClass}>
                      Route
                    </TabsTrigger>
                    <TabsTrigger value="policies" className={detailsTabClass}>
                      Policies
                    </TabsTrigger>
                    <TabsTrigger value="reviews" className={detailsTabClass}>
                      Reviews
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                          Departure
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                          {formatClockTime(departureTime)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {selectedBus?.boardingPoint ||
                            routeInfo?.origin ||
                            origin}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                          Arrival
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                          {formatClockTime(arrivalTime)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {selectedBus?.droppingPoint ||
                            routeInfo?.destination ||
                            destination}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                          Duration
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                          {durationLabel}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {routeInfo?.routeCode || "Route"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                          Seats
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                          {typeof availableSeats === "number" &&
                          typeof totalSeats === "number"
                            ? `${availableSeats} / ${totalSeats}`
                            : "N/A"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Available
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        Bus info
                      </p>
                      {infoRows.length > 0 ? (
                        <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                          {infoRows.map((row) => (
                            <div
                              key={row.label}
                              className="flex items-center justify-between"
                            >
                              <span>{row.label}</span>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {row.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                          No additional bus information available.
                        </p>
                      )}
                    </div>

                    {farePerPassengerLabel ? (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                          Fare
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                          {farePerPassengerLabel}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Base fare per passenger
                        </p>
                      </div>
                    ) : null}

                    {operatingDays.length > 0 ? (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                          Operating days
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                          {operatingDays.map((day) => (
                            <span
                              key={day}
                              className="rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 px-3 py-1 font-semibold"
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="amenities" className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        Passenger amenities
                      </p>
                      {amenities ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {AMENITY_OPTIONS.map((item) => {
                            const available = Boolean(
                              (amenities as Record<string, boolean>)[item.key],
                            );
                            return (
                              <div
                                key={item.key}
                                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm dark:text-slate-300"
                              >
                                <span>{item.label}</span>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 text-xs font-semibold",
                                    available
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-slate-400 dark:text-slate-500",
                                  )}
                                >
                                  {available ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <X className="h-3.5 w-3.5" />
                                  )}
                                  {available ? "Available" : "Unavailable"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                          Amenities information is not available.
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        Safety & accessibility
                      </p>
                      {features ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {SAFETY_FEATURE_OPTIONS.map((item) => {
                            const enabled = Boolean(
                              (features as Record<string, boolean>)[item.key],
                            );
                            return (
                              <div
                                key={item.key}
                                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm dark:text-slate-300"
                              >
                                <span>{item.label}</span>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 text-xs font-semibold",
                                    enabled
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-slate-400 dark:text-slate-500",
                                  )}
                                >
                                  {enabled ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <X className="h-3.5 w-3.5" />
                                  )}
                                  {enabled ? "Yes" : "No"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                          Feature information is not available.
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="route" className="space-y-4">
                    {routeInfo ? (
                      <>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                            Route
                          </p>
                          <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                            {routeInfo.origin || origin} →{" "}
                            {routeInfo.destination || destination}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                            {routeInfo.routeCode ? (
                              <span className="rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/40 px-3 py-1 font-semibold text-slate-600 dark:text-slate-300">
                                {routeInfo.routeCode}
                              </span>
                            ) : null}
                            {durationLabel !== "--" ? (
                              <span className="rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/40 px-3 py-1 font-semibold text-slate-600 dark:text-slate-300">
                                {durationLabel}
                              </span>
                            ) : null}
                            {routeStops.length > 0 ? (
                              <span className="rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/40 px-3 py-1 font-semibold text-slate-600 dark:text-slate-300">
                                {routeStops.length} stops
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {routeStops.length > 0 ? (
                          <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4">
                            <div className="absolute left-6 top-6 h-[calc(100%-3rem)] w-px bg-slate-200 dark:bg-slate-700" />
                            <div className="space-y-6">
                              {routeStops.map((stop, index) => {
                                const label = stop.city || `Stop ${index + 1}`;
                                const isTerminal =
                                  index === 0 ||
                                  index === routeStops.length - 1;
                                return (
                                  <div
                                    key={`${label}-${index}`}
                                    className="relative pl-10"
                                  >
                                    <span
                                      className={cn(
                                        "absolute left-4 top-1.5 h-4 w-4 rounded-full border-2",
                                        isTerminal
                                          ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30"
                                          : "border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700/40",
                                      )}
                                    />
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                      {label}
                                    </p>
                                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                                      <span>
                                        Arrive{" "}
                                        {formatTimeValue(stop.arrivalTime)}
                                      </span>
                                      <span>
                                        Depart{" "}
                                        {formatTimeValue(stop.departureTime)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-4 text-sm text-slate-500 dark:text-slate-400">
                            Stop information is not available.
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-4 text-sm text-slate-500 dark:text-slate-400">
                        Route details are not available.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="policies" className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        Cancellation policy
                      </p>
                      {routeInfo?.cancellationPolicy ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          {[
                            {
                              label: "Before 24 hours",
                              value: routeInfo.cancellationPolicy.before24h,
                            },
                            {
                              label: "Before 12 hours",
                              value: routeInfo.cancellationPolicy.before12h,
                            },
                            {
                              label: "No show",
                              value: routeInfo.cancellationPolicy.noShow,
                            },
                          ].map((policy) => (
                            <div
                              key={policy.label}
                              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3"
                            >
                              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                {policy.label}
                              </p>
                              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                                {typeof policy.value === "number"
                                  ? `${policy.value}%`
                                  : "N/A"}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Cancellation fee
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                          Cancellation policy information is not available.
                        </p>
                      )}
                    </div>

                    {detailsData?.insurance ? (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                          Insurance
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex items-center justify-between">
                            <span>Provider</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {detailsData.insurance.provider || "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Policy</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {detailsData.insurance.policyNumber || "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Expiry</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {formatDateLabel(detailsData.insurance.expiry) ||
                                "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="reviews" className="space-y-4">
                    {(() => {
                      const reviewState = selectedBus
                        ? busReviews[selectedBus._id]
                        : null;
                      if (!reviewState || reviewState.loading) {
                        return (
                          <div className="space-y-3">
                            <div className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                            <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                            <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                          </div>
                        );
                      }
                      if (reviewState.error) {
                        return (
                          <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-400">
                            {reviewState.error}
                          </div>
                        );
                      }
                      const rd = reviewState.data;
                      if (!rd || rd.total === 0) {
                        return (
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-6 text-center">
                            <MessageSquare className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                            <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                              No reviews yet
                            </p>
                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                              Be the first to review this bus after your trip!
                            </p>
                          </div>
                        );
                      }
                      const { stats, reviews: revList } = rd;
                      const maxDist = Math.max(
                        ...Object.values(stats.distribution),
                        1,
                      );
                      return (
                        <>
                          {/* Rating Summary */}
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4">
                            <div className="flex items-start gap-5">
                              <div className="text-center">
                                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                                  {stats.avgRating.toFixed(1)}
                                </p>
                                <div className="mt-1 flex items-center justify-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className={cn(
                                        "h-3.5 w-3.5",
                                        s <= Math.round(stats.avgRating)
                                          ? "fill-amber-500 text-amber-500"
                                          : "text-slate-300 dark:text-slate-600",
                                      )}
                                    />
                                  ))}
                                </div>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {stats.count} review
                                  {stats.count !== 1 ? "s" : ""}
                                </p>
                              </div>
                              <div className="flex-1 space-y-1.5">
                                {[5, 4, 3, 2, 1].map((star) => {
                                  const count = stats.distribution[star] ?? 0;
                                  const pct =
                                    maxDist > 0 ? (count / maxDist) * 100 : 0;
                                  return (
                                    <div
                                      key={star}
                                      className="flex items-center gap-2 text-xs"
                                    >
                                      <span className="w-3 text-right font-semibold text-slate-600 dark:text-slate-300">
                                        {star}
                                      </span>
                                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                        <div
                                          className="h-full rounded-full bg-amber-500 transition-all"
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className="w-5 text-right text-slate-500 dark:text-slate-400">
                                        {count}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Review List */}
                          <div className="space-y-3">
                            {revList.map((review) => {
                              const reviewDate = new Date(review.createdAt);
                              const now = new Date();
                              const diffMs =
                                now.getTime() - reviewDate.getTime();
                              const diffDays = Math.floor(
                                diffMs / (1000 * 60 * 60 * 24),
                              );
                              let timeAgo = "today";
                              if (diffDays >= 365) {
                                const years = Math.floor(diffDays / 365);
                                timeAgo = `${years}y ago`;
                              } else if (diffDays >= 30) {
                                const months = Math.floor(diffDays / 30);
                                timeAgo = `${months}mo ago`;
                              } else if (diffDays >= 7) {
                                const weeks = Math.floor(diffDays / 7);
                                timeAgo = `${weeks}w ago`;
                              } else if (diffDays >= 1) {
                                timeAgo = `${diffDays}d ago`;
                              }
                              const userName =
                                review.user?.fullName || "Anonymous";
                              return (
                                <div
                                  key={review._id}
                                  className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-xs font-bold text-white shadow-sm">
                                        {userName.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                          {userName}
                                        </p>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                          {timeAgo}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                      {[1, 2, 3, 4, 5].map((s) => (
                                        <Star
                                          key={s}
                                          className={cn(
                                            "h-3.5 w-3.5",
                                            s <= review.rating
                                              ? "fill-amber-500 text-amber-500"
                                              : "text-slate-300 dark:text-slate-600",
                                          )}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                  {review.comment ? (
                                    <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                      {review.comment}
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const BusTicketsPage = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff1f2,_#f8fafc_40%)] px-4 pb-14 pt-24 sm:px-6 lg:px-8 flex items-center justify-center">
          Loading buses...
        </div>
      }
    >
      <BusTicketsContent />
    </Suspense>
  );
};

export default BusTicketsPage;
