"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Eye, Plus, Search, Trash2, Pencil, Bus, MapPin } from "lucide-react";
import { apiUrl } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MapPicker = dynamic(() => import("@/components/map-picker"), {
  ssr: false,
});

type TripTime = { hours?: number; minutes?: number } | string | null | undefined;

type SeatLayout = {
  schemaVersion?: number;
  version?: number;
  layoutType?: string;
  orientation?: { front?: string; driverSide?: string };
  decks?: SeatLayoutDeck[];
  seats?: SeatLayoutSeat[];
};

type SeatLayoutDeck = {
  deck?: string;
  grid?: { rows?: number; cols?: number };
  elements?: SeatLayoutElement[];
};

type SeatLayoutElement = {
  elementId?: string;
  type?: string;
  position?: { x?: number; y?: number };
  size?: { w?: number; h?: number };
  seatId?: string;
};

type SeatLayoutSeat = {
  seatId?: string;
  label?: string;
  kind?: string;
  class?: string;
  deck?: string;
  position?: { x?: number; y?: number };
  flags?: {
    nearWindow?: boolean;
    ladiesSeat?: boolean;
    blocked?: boolean;
    accessible?: boolean;
  };
};

type BusRouteStop = {
  city?: string;
  location?: {
    lat?: number;
    lng?: number;
  };
  upTrip?: {
    arrivalTime?: TripTime;
    departureTime?: TripTime;
  };
  downTrip?: {
    arrivalTime?: TripTime;
    departureTime?: TripTime;
  };
};

type CurrentUserProfile = {
  role?: string | null;
  email?: string | null;
};

type ApiErrorPayload = {
  message?: string;
  errors?: Array<{
    field?: string;
    message?: string;
  }>;
  error?: string;
  details?: string;
};

type RouteStopForm = {
  city: string;
  lat: string;
  lng: string;
  upArrival: string;
  upDeparture: string;
  downArrival: string;
  downDeparture: string;
};

type OwnerOption = {
  _id: string;
  email?: string | null;
  fullName?: string | null;
};

type GeoResult = {
  name: string;
  displayName?: string;
  lat: number;
  lng: number;
};

type BusRecord = {
  _id: string;
  busId?: number;
  busName?: string | null;
  busNumber?: string | null;
  operator?: string | null;
  busOwnerEmail?: string | null;
  totalSeats?: number;
  availableSeats?: number;
  isActive?: boolean;
  isDeleted?: boolean;
  features?: {
    busType?: string | null;
    deckCount?: number | null;
    gpsTracking?: boolean;
    emergencyExit?: boolean;
    cctv?: boolean;
    wheelchairAccessible?: boolean;
  } | null;
  amenities?: {
    ac?: boolean;
    wifi?: boolean;
    chargingPoints?: boolean;
    toilet?: boolean;
    waterBottle?: boolean;
    blanket?: boolean;
    entertainment?: boolean;
  } | null;
  route?: {
    routeCode?: string | null;
    origin?: string | null;
    destination?: string | null;
    stops?: BusRouteStop[];
  } | null;
  seatLayout?: Record<string, unknown> | null;
  farePerKm?: number;
  operatingDays?: string[];
  model?: string | null;
  year?: number | null;
  insurance?: {
    provider?: string | null;
    policyNumber?: string | null;
    expiry?: string | Date | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

type BusFormState = {
  busName: string;
  busNumber: string;
  operator: string;
  busOwnerEmail: string;
  totalSeats: string;
  farePerKm: string;
  busType: string;
  deckCount: string;
  layoutType: string;
  orientationFront: string;
  driverSide: string;
  seatKind: string;
  seatClass: string;
  isActive: boolean;
  operatingDays: string[];
  model: string;
  year: string;
  routeCode: string;
  routeOrigin: string;
  routeDestination: string;
  cancellationBefore24: string;
  cancellationBefore12: string;
  cancellationNoShow: string;
  routeStops: RouteStopForm[];
  amenities: {
    ac: boolean;
    wifi: boolean;
    chargingPoints: boolean;
    toilet: boolean;
    waterBottle: boolean;
    blanket: boolean;
    entertainment: boolean;
  };
  features: {
    gpsTracking: boolean;
    emergencyExit: boolean;
    cctv: boolean;
    wheelchairAccessible: boolean;
  };
  insuranceProvider: string;
  insurancePolicyNumber: string;
  insuranceExpiry: string;
};

const BUS_TYPES = [
  "Sleeper",
  "Seater",
  "Semi-Sleeper",
  "Luxury",
  "AC",
  "Non-AC",
  "Volvo",
];

const OPERATING_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const LAYOUT_CONFIGS: Record<string, { left: number; right: number }> = {
  "2x2": { left: 2, right: 2 },
  "2x1": { left: 2, right: 1 },
  "1x2": { left: 1, right: 2 },
  "1x1": { left: 1, right: 1 },
};

const SEAT_KINDS = ["SEATER", "SLEEPER"];
const SEAT_CLASSES = ["ECONOMY", "PREMIUM"];

const SELECT_CLASSES =
  "h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 shadow-xs focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_MAP_CENTER = { lat: 20.5937, lng: 78.9629 };
const DEFAULT_MAP_ZOOM = 4;

const createEmptyStop = (): RouteStopForm => ({
  city: "",
  lat: "",
  lng: "",
  upArrival: "",
  upDeparture: "",
  downArrival: "",
  downDeparture: "",
});

const DEFAULT_FORM: BusFormState = {
  busName: "",
  busNumber: "",
  operator: "",
  busOwnerEmail: "",
  totalSeats: "",
  farePerKm: "",
  busType: "Seater",
  deckCount: "1",
  layoutType: "2x2",
  orientationFront: "TOP",
  driverSide: "LEFT",
  seatKind: "SEATER",
  seatClass: "ECONOMY",
  isActive: true,
  operatingDays: [],
  model: "",
  year: "",
  routeCode: "",
  routeOrigin: "",
  routeDestination: "",
  cancellationBefore24: "",
  cancellationBefore12: "",
  cancellationNoShow: "",
  routeStops: [createEmptyStop(), createEmptyStop()],
  amenities: {
    ac: false,
    wifi: false,
    chargingPoints: false,
    toilet: false,
    waterBottle: false,
    blanket: false,
    entertainment: false,
  },
  features: {
    gpsTracking: false,
    emergencyExit: false,
    cctv: false,
    wheelchairAccessible: false,
  },
  insuranceProvider: "",
  insurancePolicyNumber: "",
  insuranceExpiry: "",
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

const formatTimeInput = (value: TripTime) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const hours = value.hours ?? 0;
    const minutes = value.minutes ?? 0;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}`;
  }
  return "";
};

const formatDateInput = (value?: string | Date | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const normalizeSeatToken = (value?: string | null) =>
  String(value || "").trim().toUpperCase();

const parseNumber = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isValidTimeInput = (value: string) =>
  /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);

const buildApiErrorMessage = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return "Unable to save bus.";
  }

  const normalizedPayload = payload as ApiErrorPayload;

  const baseMessage =
    typeof normalizedPayload.message === "string" &&
    normalizedPayload.message.trim()
      ? normalizedPayload.message
      : "Unable to save bus.";

  if (Array.isArray(normalizedPayload.errors) && normalizedPayload.errors.length > 0) {
    const details = normalizedPayload.errors
      .map((error) => {
        const field =
          typeof error?.field === "string" && error.field.trim()
            ? error.field
            : "field";
        const message =
          typeof error?.message === "string" && error.message.trim()
            ? error.message
            : "Invalid value";
        return `${field}: ${message}`;
      })
      .join(" | ");
    return `${baseMessage}: ${details}`;
  }

  if (
    typeof normalizedPayload.error === "string" &&
    normalizedPayload.error.trim()
  ) {
    return `${baseMessage}: ${normalizedPayload.error}`;
  }

  if (
    typeof normalizedPayload.details === "string" &&
    normalizedPayload.details.trim()
  ) {
    return `${baseMessage}: ${normalizedPayload.details}`;
  }

  return baseMessage;
};

const buildSeatLayoutFromForm = (state: BusFormState) => {
  const layoutConfig = LAYOUT_CONFIGS[state.layoutType];
  if (!layoutConfig) {
    return { layout: null, error: "Select a seat layout type.", meta: null };
  }

  const totalSeats = parseNumber(state.totalSeats);
  if (!totalSeats || totalSeats < 1) {
    return {
      layout: null,
      error: "Total seats must be a valid number.",
      meta: null,
    };
  }

  const deckCount = Number(state.deckCount) || 1;
  if (![1, 2].includes(deckCount)) {
    return { layout: null, error: "Deck count must be 1 or 2.", meta: null };
  }

  const seatKind = normalizeSeatToken(state.seatKind);
  if (!SEAT_KINDS.includes(seatKind)) {
    return { layout: null, error: "Select a valid seat kind.", meta: null };
  }

  const seatClass = normalizeSeatToken(state.seatClass);
  if (!SEAT_CLASSES.includes(seatClass)) {
    return { layout: null, error: "Select a valid seat class.", meta: null };
  }

  const seatsPerRow = layoutConfig.left + layoutConfig.right;
  if (seatsPerRow < 1 || seatsPerRow > 26) {
    return {
      layout: null,
      error: "Seats per row must be between 1 and 26.",
      meta: null,
    };
  }

  const deckNames = deckCount === 2 ? ["LOWER", "UPPER"] : ["LOWER"];
  let remainingSeats = totalSeats;
  const deckPlans: Array<{
    deckName: string;
    seatsForDeck: number;
    rows: number;
  }> = [];
  const decks: SeatLayoutDeck[] = [];
  const seats: SeatLayoutSeat[] = [];
  const rowsByDeck: Record<string, number> = {};
  const seatsByDeck: Record<string, number> = {};
  const cols = seatsPerRow + 1;

  for (let index = 0; index < deckNames.length; index += 1) {
    const deckName = deckNames[index];
    const seatsForDeck =
      index === deckNames.length - 1
        ? remainingSeats
        : Math.ceil(remainingSeats / (deckNames.length - index));
    remainingSeats -= seatsForDeck;
    const rows = Math.max(1, Math.ceil(seatsForDeck / seatsPerRow));

    if (rows > 99) {
      return {
        layout: null,
        error: "Too many rows. Reduce total seats or layout width.",
        meta: null,
      };
    }

    deckPlans.push({ deckName, seatsForDeck, rows });
  }

  const totalRows = deckPlans.reduce((sum, plan) => sum + plan.rows, 0);
  if (totalRows > 99) {
    return {
      layout: null,
      error: "Too many rows across decks. Reduce total seats or layout width.",
      meta: null,
    };
  }

  let rowOffset = 0;
  for (const plan of deckPlans) {
    const { deckName, seatsForDeck, rows } = plan;
    const elements: SeatLayoutElement[] = [];
    let seatCounter = 0;
    const deckPrefix = deckName.startsWith("U") ? "U" : "L";

    for (let row = 0; row < rows; row += 1) {
      elements.push({
        type: "AISLE",
        position: { x: layoutConfig.left, y: row },
        size: { w: 1, h: 1 },
      });

      for (let seatIndex = 0; seatIndex < seatsPerRow; seatIndex += 1) {
        if (seatCounter >= seatsForDeck) break;

        const rowNumber = rowOffset + row + 1;
        const seatLetter = String.fromCharCode(65 + seatIndex);
        const seatLabel = `${rowNumber}${seatLetter}`;
        const seatId = `${deckPrefix}-${seatLabel}`;
        const x =
          seatIndex < layoutConfig.left
            ? seatIndex
            : layoutConfig.left + 1 + (seatIndex - layoutConfig.left);
        const y = row;

        seats.push({
          seatId,
          label: seatLabel,
          kind: seatKind,
          class: seatClass,
          deck: deckName,
          position: { x, y },
        });

        elements.push({
          type: "SEAT",
          position: { x, y },
          size: { w: 1, h: 1 },
          seatId,
        });

        seatCounter += 1;
      }
    }

    decks.push({
      deck: deckName,
      grid: { rows, cols },
      elements,
    });
    rowsByDeck[deckName] = rows;
    seatsByDeck[deckName] = seatsForDeck;
    rowOffset += rows;
  }

  if (seats.length !== totalSeats) {
    return {
      layout: null,
      error: "Seat generation failed. Check inputs.",
      meta: null,
    };
  }

  return {
    layout: {
      schemaVersion: 1,
      version: 1,
      layoutType: state.layoutType,
      orientation: {
        front: normalizeSeatToken(state.orientationFront) || "TOP",
        driverSide: normalizeSeatToken(state.driverSide) || "LEFT",
      },
      decks,
      seats,
    },
    error: null,
    meta: { totalSeats, seatsPerRow, cols, rowsByDeck, seatsByDeck },
  };
};

const buildRouteFromForm = (state: BusFormState) => {
  const routeCode = state.routeCode.trim();
  const routeOrigin = state.routeOrigin.trim();
  const routeDestination = state.routeDestination.trim();

  if (!routeCode) {
    return { route: null, error: "Route code is required." };
  }
  if (!routeOrigin) {
    return { route: null, error: "Route origin is required." };
  }
  if (!routeDestination) {
    return { route: null, error: "Route destination is required." };
  }

  if (!state.routeStops.length || state.routeStops.length < 2) {
    return { route: null, error: "Add at least two route stops." };
  }

  const stops = [];
  for (const stop of state.routeStops) {
    const city = stop.city.trim();
    if (!city) {
      return { route: null, error: "Each stop must include a city." };
    }
    const lat = parseNumber(stop.lat);
    const lng = parseNumber(stop.lng);
    if (lat === null || lng === null) {
      return { route: null, error: "Each stop must include latitude and longitude." };
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { route: null, error: "Latitude/longitude values are out of range." };
    }
    if (!isValidTimeInput(stop.upArrival) || !isValidTimeInput(stop.upDeparture)) {
      return { route: null, error: "Up trip times must be valid HH:MM values." };
    }
    if (
      !isValidTimeInput(stop.downArrival) ||
      !isValidTimeInput(stop.downDeparture)
    ) {
      return { route: null, error: "Down trip times must be valid HH:MM values." };
    }

    stops.push({
      city,
      location: { lat, lng },
      upTrip: {
        arrivalTime: stop.upArrival,
        departureTime: stop.upDeparture,
      },
      downTrip: {
        arrivalTime: stop.downArrival,
        departureTime: stop.downDeparture,
      },
    });
  }

  const before24h = parseNumber(state.cancellationBefore24);
  const before12h = parseNumber(state.cancellationBefore12);
  const noShow = parseNumber(state.cancellationNoShow);

  const route: Record<string, unknown> = {
    routeCode,
    origin: routeOrigin,
    destination: routeDestination,
    stops,
  };

  if (before24h !== null || before12h !== null || noShow !== null) {
    route.cancellationPolicy = {
      ...(before24h !== null ? { before24h } : {}),
      ...(before12h !== null ? { before12h } : {}),
      ...(noShow !== null ? { noShow } : {}),
    };
  }

  return { route, error: null };
};

const getSeatFlagClass = (seat?: SeatLayoutSeat | null) => {
  const flags = seat?.flags;
  if (!flags) return "";
  if (flags.blocked) return "opacity-50 line-through";
  if (flags.ladiesSeat) return "ring-2 ring-pink-400";
  if (flags.accessible) return "ring-2 ring-emerald-400";
  if (flags.nearWindow) return "ring-2 ring-sky-400";
  return "";
};

const getElementStyles = (type: string) => {
  switch (type) {
    case "SEAT":
      return "bg-slate-900 text-white dark:bg-white dark:text-slate-900";
    case "AISLE":
      return "bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500";
    case "DOOR":
      return "bg-amber-200 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200";
    case "DRIVER":
      return "bg-indigo-200 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-200";
    case "STAIRS":
      return "bg-cyan-200 text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-200";
    case "WC":
      return "bg-emerald-200 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200";
    case "ENTRY":
      return "bg-sky-200 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200";
    case "EXIT":
      return "bg-rose-200 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200";
    case "GAP":
      return "bg-transparent text-transparent";
    default:
      return "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200";
  }
};

const getElementLabel = (type: string) => {
  switch (type) {
    case "AISLE":
      return "AISLE";
    case "DOOR":
      return "DOOR";
    case "DRIVER":
      return "DRIVER";
    case "STAIRS":
      return "STAIRS";
    case "WC":
      return "WC";
    case "ENTRY":
      return "ENTRY";
    case "EXIT":
      return "EXIT";
    default:
      return type;
  }
};

const getBusDisplayName = (bus: BusRecord) =>
  bus.busName || bus.busNumber || "Unnamed bus";

const buildFormStateFromBus = (bus: BusRecord): BusFormState => {
  const layout = bus.seatLayout as SeatLayout | null;
  const firstSeat = layout?.seats?.[0];
  const layoutType = layout?.layoutType ?? "2x2";
  const orientationFront =
    normalizeSeatToken(layout?.orientation?.front) || "TOP";
  const driverSide = normalizeSeatToken(layout?.orientation?.driverSide) || "LEFT";
  const seatKind =
    normalizeSeatToken(firstSeat?.kind) ||
    (bus.features?.busType?.toLowerCase().includes("sleeper")
      ? "SLEEPER"
      : "SEATER");
  const seatClass = normalizeSeatToken(firstSeat?.class) || "ECONOMY";

  const stops = Array.isArray(bus.route?.stops) && bus.route?.stops?.length
    ? bus.route?.stops.map((stop) => ({
        city: stop?.city ?? "",
        lat:
          stop?.location?.lat !== undefined ? String(stop.location.lat) : "",
        lng:
          stop?.location?.lng !== undefined ? String(stop.location.lng) : "",
        upArrival: formatTimeInput(stop?.upTrip?.arrivalTime),
        upDeparture: formatTimeInput(stop?.upTrip?.departureTime),
        downArrival: formatTimeInput(stop?.downTrip?.arrivalTime),
        downDeparture: formatTimeInput(stop?.downTrip?.departureTime),
      }))
    : [createEmptyStop(), createEmptyStop()];

  return {
    busName: bus.busName ?? "",
    busNumber: bus.busNumber ?? "",
    operator: bus.operator ?? "",
    busOwnerEmail: bus.busOwnerEmail ?? "",
    totalSeats: bus.totalSeats ? String(bus.totalSeats) : "",
    farePerKm: bus.farePerKm !== undefined ? String(bus.farePerKm) : "",
    busType: bus.features?.busType ?? "Seater",
    deckCount:
      bus.features?.deckCount !== undefined
        ? String(bus.features.deckCount)
        : layout?.decks?.length
          ? String(layout.decks.length)
          : "1",
    layoutType,
    orientationFront,
    driverSide,
    seatKind,
    seatClass,
    isActive: bus.isActive ?? true,
    operatingDays: Array.isArray(bus.operatingDays) ? bus.operatingDays : [],
    model: bus.model ?? "",
    year: bus.year ? String(bus.year) : "",
    routeCode: bus.route?.routeCode ?? "",
    routeOrigin: bus.route?.origin ?? "",
    routeDestination: bus.route?.destination ?? "",
    cancellationBefore24:
      bus.route?.cancellationPolicy?.before24h !== undefined
        ? String(bus.route.cancellationPolicy.before24h)
        : "",
    cancellationBefore12:
      bus.route?.cancellationPolicy?.before12h !== undefined
        ? String(bus.route.cancellationPolicy.before12h)
        : "",
    cancellationNoShow:
      bus.route?.cancellationPolicy?.noShow !== undefined
        ? String(bus.route.cancellationPolicy.noShow)
        : "",
    routeStops: stops,
    amenities: {
      ac: bus.amenities?.ac ?? false,
      wifi: bus.amenities?.wifi ?? false,
      chargingPoints: bus.amenities?.chargingPoints ?? false,
      toilet: bus.amenities?.toilet ?? false,
      waterBottle: bus.amenities?.waterBottle ?? false,
      blanket: bus.amenities?.blanket ?? false,
      entertainment: bus.amenities?.entertainment ?? false,
    },
    features: {
      gpsTracking: bus.features?.gpsTracking ?? false,
      emergencyExit: bus.features?.emergencyExit ?? false,
      cctv: bus.features?.cctv ?? false,
      wheelchairAccessible: bus.features?.wheelchairAccessible ?? false,
    },
    insuranceProvider: bus.insurance?.provider ?? "",
    insurancePolicyNumber: bus.insurance?.policyNumber ?? "",
    insuranceExpiry: formatDateInput(bus.insurance?.expiry ?? null),
  };
};

const ManageBusesPage = () => {
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">(
    "create"
  );
  const [selectedBus, setSelectedBus] = useState<BusRecord | null>(null);
  const [formState, setFormState] = useState<BusFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BusRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeDeck, setActiveDeck] = useState<string>("");
  const draftRef = useRef<{
    create?: BusFormState;
    edit: Record<string, BusFormState>;
  }>({ edit: {} });
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [activeStopIndex, setActiveStopIndex] = useState<number | null>(null);
  const [geoQuery, setGeoQuery] = useState("");
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_MAP_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_ZOOM);
  const [mapMarker, setMapMarker] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const totalPages = useMemo(() => {
    if (!total) return 1;
    return Math.max(1, Math.ceil(total / limit));
  }, [limit, total]);
  const isOwnerUser = currentUserRole === "owner";

  const seatLayoutPreview = useMemo(
    () => buildSeatLayoutFromForm(formState),
    [formState]
  );

  const seatLayout = seatLayoutPreview.layout;
  const seatMap = useMemo(() => {
    const map = new Map<string, SeatLayoutSeat>();
    if (!seatLayout?.seats) return map;
    for (const seat of seatLayout.seats) {
      const key = normalizeSeatToken(seat?.seatId);
      if (key) map.set(key, seat);
    }
    return map;
  }, [seatLayout]);

  const deckNames = useMemo(() => {
    if (!seatLayout?.decks) return [];
    return seatLayout.decks
      .map((deck) => normalizeSeatToken(deck?.deck))
      .filter(Boolean);
  }, [seatLayout]);

  const updateStopAtIndex = useCallback(
    (index: number, updates: Partial<RouteStopForm>) => {
      setFormState((prev) => {
        const nextStops = [...prev.routeStops];
        const current = nextStops[index] ?? createEmptyStop();
        nextStops[index] = { ...current, ...updates };
        return { ...prev, routeStops: nextStops };
      });
    },
    []
  );

  const openLocationPicker = (index: number) => {
    setActiveStopIndex(index);
    setLocationDialogOpen(true);
  };

  const applyGeoResult = useCallback(
    (result: GeoResult) => {
      if (activeStopIndex === null) return;
      const name =
        result.name || result.displayName?.split(",")[0] || "Selected location";
      updateStopAtIndex(activeStopIndex, {
        city: name,
        lat: String(result.lat),
        lng: String(result.lng),
      });
      setGeoQuery(name);
      setMapCenter({ lat: result.lat, lng: result.lng });
      setMapZoom(14);
      setMapMarker({ lat: result.lat, lng: result.lng });
    },
    [activeStopIndex, updateStopAtIndex]
  );

  const handleMapPick = useCallback(
    async (lat: number, lng: number) => {
      if (activeStopIndex === null) return;
      updateStopAtIndex(activeStopIndex, {
        lat: String(lat),
        lng: String(lng),
      });
      setMapCenter({ lat, lng });
      setMapZoom(14);
      setMapMarker({ lat, lng });
      setGeoError(null);

      try {
        const response = await fetch(
          `/api/geocode?lat=${lat}&lng=${lng}`,
          { method: "GET" }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const result = Array.isArray(data?.results) ? data.results[0] : null;
        if (result?.name) {
          updateStopAtIndex(activeStopIndex, { city: result.name });
          setGeoQuery(result.name);
        }
      } catch {
        setGeoError("Unable to look up the selected location.");
      }
    },
    [activeStopIndex, updateStopAtIndex]
  );

  useEffect(() => {
    if (!deckNames.length) {
      setActiveDeck("");
      return;
    }
    if (!activeDeck || !deckNames.includes(activeDeck)) {
      setActiveDeck(deckNames[0]);
    }
  }, [deckNames, activeDeck]);

  useEffect(() => {
    if (!locationDialogOpen || activeStopIndex === null) return;
    const stop = formState.routeStops[activeStopIndex];
    const lat = parseNumber(stop?.lat || "");
    const lng = parseNumber(stop?.lng || "");

    if (lat !== null && lng !== null) {
      setMapCenter({ lat, lng });
      setMapZoom(12);
      setMapMarker({ lat, lng });
    } else {
      setMapCenter(DEFAULT_MAP_CENTER);
      setMapZoom(DEFAULT_MAP_ZOOM);
      setMapMarker(null);
    }

    setGeoQuery(stop?.city || "");
    setGeoResults([]);
    setGeoError(null);
  }, [activeStopIndex, formState.routeStops, locationDialogOpen]);

  useEffect(() => {
    if (!locationDialogOpen) return;
    const query = geoQuery.trim();
    if (query.length < 3) {
      setGeoResults([]);
      setGeoError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setGeoLoading(true);
      setGeoError(null);
      try {
        const response = await fetch(
          `/api/geocode?q=${encodeURIComponent(query)}`,
          { method: "GET", signal: controller.signal }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || "Unable to find locations.");
        }
        const results = Array.isArray(data?.results) ? data.results : [];
        setGeoResults(results);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setGeoResults([]);
        setGeoError((err as Error).message || "Unable to find locations.");
      } finally {
        setGeoLoading(false);
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [geoQuery, locationDialogOpen]);

  const pageNumbers = useMemo(() => {
    const window = 2;
    const start = Math.max(1, page - window);
    const end = Math.min(totalPages, page + window);
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  }, [page, totalPages]);

  const loadBuses = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (search) params.set("search", search);

        const response = await fetch(
          apiUrl(`/admin/buses?${params.toString()}`),
          {
            method: "GET",
            credentials: "include",
            signal,
          }
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load buses.");
        }

        const data = payload?.data ?? {};
        setBuses(Array.isArray(data.buses) ? data.buses : []);
        const totalCount = Number(data.total) || 0;
        setTotal(totalCount);

        const computedTotalPages = Math.max(
          1,
          Math.ceil(totalCount / limit)
        );
        if (page > computedTotalPages) {
          setPage(computedTotalPages);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || "Something went wrong.");
        }
      } finally {
        setLoading(false);
      }
    },
    [limit, page, search]
  );

  const loadOwners = useCallback(
    async (query: string, signal: AbortSignal) => {
      if (isOwnerUser) {
        setOwnerOptions([]);
        setOwnerError(null);
        setOwnerLoading(false);
        return;
      }
      setOwnerLoading(true);
      setOwnerError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "20");
        params.set("role", "owner");
        if (query.trim()) {
          params.set("search", query.trim());
        }

        const response = await fetch(
          apiUrl(`/admin/users?${params.toString()}`),
          {
            method: "GET",
            credentials: "include",
            signal,
          }
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error("Owner list is available for admins only.");
          }
          throw new Error(payload?.message || "Failed to load owners.");
        }

        const data = payload?.data ?? {};
        const users = Array.isArray(data.users) ? data.users : [];
        const ownerList = users
          .filter((user) => typeof user.email === "string" && user.email.trim())
          .map((user) => ({
            _id: user._id,
            email: user.email,
            fullName: user.fullName ?? "",
          }));
        setOwnerOptions(ownerList);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setOwnerError((err as Error).message || "Unable to load owners.");
        }
      } finally {
        setOwnerLoading(false);
      }
    },
    [isOwnerUser]
  );

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadCurrentUser = async () => {
      try {
        const response = await fetch(apiUrl("/profile/view"), {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = await response.json().catch(() => ({}));
        const user = (payload?.data?.user ?? {}) as CurrentUserProfile;
        if (!mounted) return;

        const nextRole =
          typeof user.role === "string" ? user.role.trim().toLowerCase() : "";
        const nextEmail =
          typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
        setCurrentUserRole(nextRole);
        setCurrentUserEmail(nextEmail);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    };

    void loadCurrentUser();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadBuses(controller.signal);
    return () => controller.abort();
  }, [loadBuses]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!formOpen || formMode === "view" || isOwnerUser) return;
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      void loadOwners(ownerSearch, controller.signal);
    }, 250);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [formOpen, formMode, ownerSearch, loadOwners, isOwnerUser]);

  useEffect(() => {
    if (!formOpen || formMode !== "create" || !isOwnerUser || !currentUserEmail) {
      return;
    }

    setFormState((prev) => {
      if (prev.busOwnerEmail.trim()) return prev;
      return {
        ...prev,
        busOwnerEmail: currentUserEmail,
      };
    });
  }, [currentUserEmail, formMode, formOpen, isOwnerUser]);

  useEffect(() => {
    if (!formOpen || formMode === "view") return;
    if (formMode === "create") {
      draftRef.current.create = formState;
      return;
    }
    if (selectedBus?._id) {
      draftRef.current.edit[selectedBus._id] = formState;
    }
  }, [formOpen, formMode, formState, selectedBus?._id]);

  const loadBusDetails = useCallback(async (bus: BusRecord) => {
    if (!bus?._id) return;
    setDetailsLoading(true);
    setFormError(null);
    try {
      const response = await fetch(apiUrl(`/admin/buses/${bus._id}`), {
        method: "GET",
        credentials: "include",
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to load bus details.");
      }

      const detailedBus = payload?.data?.bus ?? payload?.data ?? bus;
      setSelectedBus(detailedBus);
      setFormState(buildFormStateFromBus(detailedBus));
    } catch (err) {
      setFormError((err as Error).message || "Something went wrong.");
      setFormState(buildFormStateFromBus(bus));
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const openCreate = () => {
    setFormMode("create");
    setSelectedBus(null);
    const createDraft = draftRef.current.create ?? DEFAULT_FORM;
    const ownerEmail = isOwnerUser ? currentUserEmail : createDraft.busOwnerEmail;
    setFormState({
      ...createDraft,
      busOwnerEmail: ownerEmail || createDraft.busOwnerEmail,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (bus: BusRecord) => {
    setFormMode("edit");
    setSelectedBus(bus);
    const draft = draftRef.current.edit[bus._id];
    setFormState(draft ?? buildFormStateFromBus(bus));
    setFormError(null);
    setFormOpen(true);
    if (!draft) {
      void loadBusDetails(bus);
    }
  };

  const openView = (bus: BusRecord) => {
    setFormMode("view");
    setSelectedBus(bus);
    setFormState(buildFormStateFromBus(bus));
    setFormError(null);
    setFormOpen(true);
    void loadBusDetails(bus);
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formMode === "view") return;
    if (formMode === "edit" && !selectedBus?._id) {
      setFormError("Select a bus to edit.");
      return;
    }

    if (!formState.busName.trim()) {
      setFormError("Bus name is required.");
      return;
    }

    if (!formState.busNumber.trim()) {
      setFormError("Bus number is required.");
      return;
    }

    if (!formState.operator.trim()) {
      setFormError("Operator is required.");
      return;
    }

    const resolvedBusOwnerEmail = (
      isOwnerUser ? currentUserEmail || formState.busOwnerEmail : formState.busOwnerEmail
    )
      .trim()
      .toLowerCase();

    if (!resolvedBusOwnerEmail) {
      setFormError("Bus owner email is required.");
      return;
    }

    if (!EMAIL_REGEX.test(resolvedBusOwnerEmail)) {
      setFormError("Bus owner email must be a valid email address.");
      return;
    }

    if (!formState.totalSeats.trim()) {
      setFormError("Total seats is required.");
      return;
    }

    if (!formState.farePerKm.trim()) {
      setFormError("Fare per km is required.");
      return;
    }

    if (formState.operatingDays.length === 0) {
      setFormError("Select at least one operating day.");
      return;
    }

    const seatLayoutResult = buildSeatLayoutFromForm(formState);
    if (seatLayoutResult.error || !seatLayoutResult.layout) {
      setFormError(seatLayoutResult.error || "Seat layout is invalid.");
      return;
    }

    const routeResult = buildRouteFromForm(formState);
    if (routeResult.error || !routeResult.route) {
      setFormError(routeResult.error || "Route details are invalid.");
      return;
    }

    const totalSeats = seatLayoutResult.meta?.totalSeats ?? parseNumber(formState.totalSeats);
    if (!totalSeats || totalSeats < 1) {
      setFormError("Total seats must be a valid number.");
      return;
    }

    const farePerKm = parseNumber(formState.farePerKm);
    if (farePerKm === null || farePerKm < 0) {
      setFormError("Fare per km must be a valid number.");
      return;
    }

    let yearValue: number | undefined;
    if (formState.year.trim()) {
      yearValue = Number(formState.year);
      if (!Number.isFinite(yearValue)) {
        setFormError("Year must be a valid number.");
        return;
      }
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const insurancePayload = {
        provider: formState.insuranceProvider.trim() || undefined,
        policyNumber: formState.insurancePolicyNumber.trim() || undefined,
        expiry: formState.insuranceExpiry || undefined,
      };
      const hasInsurance = Object.values(insurancePayload).some(
        (value) => value !== undefined
      );

      const seatLayout = seatLayoutResult.layout;
      const route = routeResult.route;

      const payload = {
        busName: formState.busName.trim(),
        busNumber: formState.busNumber.trim().toUpperCase(),
        operator: formState.operator.trim(),
        busOwnerEmail: resolvedBusOwnerEmail,
        totalSeats,
        amenities: formState.amenities,
        features: {
          busType: formState.busType,
          deckCount: Number(formState.deckCount) || 1,
          ...formState.features,
        },
        seatLayout,
        route,
        farePerKm,
        model: formState.model.trim() || undefined,
        year: yearValue,
        insurance: hasInsurance ? insurancePayload : undefined,
        operatingDays: formState.operatingDays,
        isActive: formState.isActive,
      };

      const endpoint =
        formMode === "create"
          ? apiUrl("/admin/buses")
          : apiUrl(`/admin/buses/${selectedBus?._id}`);

      const response = await fetch(endpoint, {
        method: formMode === "create" ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(buildApiErrorMessage(data));
      }

      setFormOpen(false);
      setSelectedBus(null);
      setFormState(DEFAULT_FORM);
      if (formMode === "create") {
        draftRef.current.create = undefined;
      } else if (formMode === "edit" && selectedBus?._id) {
        delete draftRef.current.edit[selectedBus._id];
      }
      const controller = new AbortController();
      await loadBuses(controller.signal);
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
        apiUrl(`/admin/buses/${deleteTarget._id}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete bus.");
      }
      setDeleteTarget(null);
      const controller = new AbortController();
      await loadBuses(controller.signal);
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally {
      setDeleting(false);
    }
  };

  const startIndex = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = total === 0 ? 0 : Math.min(page * limit, total);
  const isReadOnly = formMode === "view" || detailsLoading;

  const renderDeckGrid = (deck: SeatLayoutDeck | undefined, deckName: string) => {
    if (!deck?.grid) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
          Deck grid is missing for {deckName}.
        </div>
      );
    }

    const rows = Number(deck.grid.rows || 0);
    const cols = Number(deck.grid.cols || 0);

    if (!rows || !cols) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
          Deck grid has invalid rows or columns.
        </div>
      );
    }

    const elements = Array.isArray(deck.elements) ? deck.elements : [];
    const priority = (element: SeatLayoutElement) => {
      const type = normalizeSeatToken(element?.type);
      if (type === "SEAT") return 4;
      if (type === "DRIVER" || type === "DOOR") return 3;
      if (type === "STAIRS" || type === "WC") return 2;
      if (type === "AISLE") return 1;
      return 0;
    };
    const sortedElements = [...elements].sort(
      (a, b) => priority(a) - priority(b)
    );

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Grid {rows} x {cols}
          </span>
          <span>{elements.length} elements</span>
        </div>
        <div className="overflow-auto rounded-2xl border border-slate-200/70 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/40">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridAutoRows: "32px",
            }}
          >
            {sortedElements.map((element, index) => {
              const x = element?.position?.x;
              const y = element?.position?.y;
              const w = element?.size?.w ?? 1;
              const h = element?.size?.h ?? 1;
              if (
                typeof x !== "number" ||
                typeof y !== "number" ||
                typeof w !== "number" ||
                typeof h !== "number"
              ) {
                return null;
              }

              const type = normalizeSeatToken(element?.type) || "GAP";
              const seatId = normalizeSeatToken(element?.seatId);
              const seat = seatId ? seatMap.get(seatId) : undefined;
              const label =
                type === "SEAT"
                  ? seat?.label || seatId || "SEAT"
                  : getElementLabel(type);
              const titleParts = [
                type === "SEAT" ? `Seat ${label}` : getElementLabel(type),
              ];
              if (seat?.kind) titleParts.push(seat.kind);
              if (seat?.class) titleParts.push(seat.class);
              if (seatId && label !== seatId && type !== "SEAT") {
                titleParts.push(seatId);
              }
              const flagLabel = seat?.flags?.blocked
                ? "Blocked"
                : seat?.flags?.ladiesSeat
                  ? "Ladies seat"
                  : seat?.flags?.accessible
                    ? "Accessible"
                    : seat?.flags?.nearWindow
                      ? "Near window"
                      : "";
              if (flagLabel) titleParts.push(flagLabel);

              return (
                <div
                  key={`${deckName}-${element.elementId || element.seatId || index}`}
                  className={cn(
                    "flex items-center justify-center rounded-md border border-slate-200/70 text-[10px] font-semibold uppercase tracking-[0.08em] shadow-sm",
                    getElementStyles(type),
                    type === "GAP" && "border-transparent",
                    type === "SEAT" && getSeatFlagClass(seat)
                  )}
                  style={{
                    gridColumn: `${x + 1} / span ${w}`,
                    gridRow: `${y + 1} / span ${h}`,
                  }}
                  title={titleParts.join(" • ")}
                >
                  {type === "GAP" ? "" : label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Manage Buses
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Buses
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
            {total.toLocaleString()} total - page {page} of {totalPages}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search bus name, number, route..."
              className="w-52 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            />
          </div>
          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:[color-scheme:dark]"
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-900"
          >
            <Plus className="h-4 w-4" />
            Add Bus
          </button>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.1)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
        <div className="max-h-[560px] overflow-auto no-scrollbar">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100/95 text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Bus</th>
                <th className="px-6 py-4 font-semibold">Operator</th>
                <th className="px-6 py-4 font-semibold">Route</th>
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
                    colSpan={8}
                    className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300"
                  >
                    Loading buses...
                  </td>
                </tr>
              ) : buses.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300"
                  >
                    No buses found.
                  </td>
                </tr>
              ) : (
                buses.map((bus) => {
                  const status =
                    bus.isDeleted === true
                      ? {
                          label: "Deleted",
                          className:
                            "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200",
                        }
                      : bus.isActive === false
                        ? {
                            label: "Inactive",
                            className:
                              "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
                          }
                        : {
                            label: "Active",
                            className:
                              "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
                          };

                  const routeLabel =
                    bus.route?.origin && bus.route?.destination
                      ? `${bus.route.origin} → ${bus.route.destination}`
                      : "—";

                  return (
                    <tr
                      key={bus._id}
                      className="bg-white/60 transition hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">
                            <Bus className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {getBusDisplayName(bus)}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {bus.busNumber ? `No: ${bus.busNumber}` : "No number"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        {bus.operator || "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-700 dark:text-slate-200">
                          {routeLabel}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {bus.route?.routeCode || "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        {bus.availableSeats ?? "—"} / {bus.totalSeats ?? "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-700 dark:text-slate-200">
                          {bus.features?.busType || "—"}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {bus.features?.deckCount
                            ? `${bus.features.deckCount} deck${
                                bus.features.deckCount > 1 ? "s" : ""
                              }`
                            : "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em]",
                            status.className
                          )}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        {formatDate(bus.updatedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openView(bus)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(bus)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(bus)}
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
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bus className="h-5 w-5" />
              {formMode === "create"
                ? "Create bus"
                : formMode === "edit"
                  ? "Edit bus"
                  : "Bus details"}
            </DialogTitle>
            <DialogDescription>
              {formMode === "create"
                ? "Add a new bus profile, route, and seat blueprint."
                : formMode === "edit"
                  ? "Update bus details, seat layout, and operating days."
                  : "Review the full bus profile and seat layout."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-6">
            {detailsLoading ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                Loading bus details...
              </div>
            ) : null}

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Basic info
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Bus name
                  </label>
                  <Input
                    value={formState.busName}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        busName: event.target.value,
                      }))
                    }
                    placeholder="Sunrise Express"
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Bus number
                  </label>
                  <Input
                    value={formState.busNumber}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        busNumber: event.target.value,
                      }))
                    }
                    placeholder="TN01AB1234"
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Operator
                  </label>
                  <Input
                    value={formState.operator}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        operator: event.target.value,
                      }))
                    }
                    placeholder="BookMySeat Travels"
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Model
                  </label>
                  <Input
                    value={formState.model}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        model: event.target.value,
                      }))
                    }
                    placeholder="Volvo 9700"
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Bus owner email
                  </label>
                  <Input
                    value={formState.busOwnerEmail}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        busOwnerEmail: event.target.value,
                      }))
                    }
                    placeholder="owner@example.com"
                    disabled={isReadOnly || submitting || isOwnerUser}
                  />
                </div>
                {isOwnerUser ? (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Owner source
                    </label>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                      Linked to your signed-in owner account.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Find owner
                    </label>
                    <Input
                      value={ownerSearch}
                      onChange={(event) => setOwnerSearch(event.target.value)}
                      placeholder="Search by name or email..."
                      disabled={isReadOnly || submitting}
                    />
                  </div>
                )}
              </div>
              {formMode !== "view" && !isOwnerUser ? (
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Owner list
                    </span>
                    {ownerLoading ? (
                      <span className="text-xs text-slate-400">Loading...</span>
                    ) : null}
                  </div>
                  {ownerError ? (
                    <p className="mt-2 text-xs text-rose-500">{ownerError}</p>
                  ) : null}
                  <div className="mt-2 max-h-32 space-y-1 overflow-auto pr-1">
                    {ownerOptions.length === 0 && !ownerLoading ? (
                      <p className="text-xs text-slate-400">No owners found.</p>
                    ) : (
                      ownerOptions.map((owner) => (
                        <button
                          key={owner._id}
                          type="button"
                          onClick={() =>
                            setFormState((prev) => ({
                              ...prev,
                              busOwnerEmail: owner.email ?? prev.busOwnerEmail,
                            }))
                          }
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200",
                            owner.email?.toLowerCase() ===
                              formState.busOwnerEmail.trim().toLowerCase()
                              ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                              : ""
                          )}
                        >
                          <span>{owner.fullName || owner.email}</span>
                          <span className="text-[10px] font-normal opacity-70">
                            {owner.email}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
                  Owner: {formState.busOwnerEmail || "—"}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Service setup
              </p>
              <div className="grid gap-4 sm:grid-cols-1">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Fare per km
                  </label>
                  <Input
                    type="number"
                    value={formState.farePerKm}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        farePerKm: event.target.value,
                      }))
                    }
                    placeholder="12.5"
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Bus type
                  </label>
                  <select
                    value={formState.busType}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        busType: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className={SELECT_CLASSES}
                  >
                    {BUS_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Deck count
                  </label>
                  <select
                    value={formState.deckCount}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        deckCount: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className={SELECT_CLASSES}
                  >
                    {[1, 2].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Year
                  </label>
                  <Input
                    type="number"
                    value={formState.year}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        year: event.target.value,
                      }))
                    }
                    placeholder="2024"
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={formState.isActive}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        isActive: event.target.checked,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                  Active
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Operating days
              </p>
              <div className="flex flex-wrap gap-3">
                {OPERATING_DAYS.map((day) => (
                  <label
                    key={day}
                    className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={formState.operatingDays.includes(day)}
                      onChange={(event) => {
                        setFormState((prev) => {
                          const set = new Set(prev.operatingDays);
                          if (event.target.checked) {
                            set.add(day);
                          } else {
                            set.delete(day);
                          }
                          return {
                            ...prev,
                            operatingDays: Array.from(set),
                          };
                        });
                      }}
                      disabled={isReadOnly || submitting}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Amenities & features
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Amenities
                  </p>
                  <div className="grid gap-2">
                    {(
                      [
                        ["ac", "AC"],
                        ["wifi", "Wi-Fi"],
                        ["chargingPoints", "Charging points"],
                        ["toilet", "Toilet"],
                        ["waterBottle", "Water bottle"],
                        ["blanket", "Blanket"],
                        ["entertainment", "Entertainment"],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-sm text-slate-600"
                      >
                        <input
                          type="checkbox"
                          checked={formState.amenities[key]}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              amenities: {
                                ...prev.amenities,
                                [key]: event.target.checked,
                              },
                            }))
                          }
                          disabled={isReadOnly || submitting}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Features
                  </p>
                  <div className="grid gap-2">
                    {(
                      [
                        ["gpsTracking", "GPS tracking"],
                        ["emergencyExit", "Emergency exit"],
                        ["cctv", "CCTV"],
                        ["wheelchairAccessible", "Wheelchair access"],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-sm text-slate-600"
                      >
                        <input
                          type="checkbox"
                          checked={formState.features[key]}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              features: {
                                ...prev.features,
                                [key]: event.target.checked,
                              },
                            }))
                          }
                          disabled={isReadOnly || submitting}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Route details
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Route code
                  </label>
                  <Input
                    value={formState.routeCode}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        routeCode: event.target.value,
                      }))
                    }
                    placeholder="BLR-CHN"
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Origin
                  </label>
                  <Input
                    value={formState.routeOrigin}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        routeOrigin: event.target.value,
                      }))
                    }
                    placeholder="Bangalore"
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Destination
                  </label>
                  <Input
                    value={formState.routeDestination}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        routeDestination: event.target.value,
                      }))
                    }
                    placeholder="Chennai"
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Distance and duration are calculated automatically from stop
                coordinates. Use the map picker to set accurate locations.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Cancellation before 24h (%)
                  </label>
                  <Input
                    type="number"
                    value={formState.cancellationBefore24}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        cancellationBefore24: event.target.value,
                      }))
                    }
                    placeholder="10"
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Cancellation before 12h (%)
                  </label>
                  <Input
                    type="number"
                    value={formState.cancellationBefore12}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        cancellationBefore12: event.target.value,
                      }))
                    }
                    placeholder="25"
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    No show (%)
                  </label>
                  <Input
                    type="number"
                    value={formState.cancellationNoShow}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        cancellationNoShow: event.target.value,
                      }))
                    }
                    placeholder="50"
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Route stops
              </p>
              <div className="space-y-4">
                {formState.routeStops.map((stop, index) => (
                  <div
                    key={`stop-${index}`}
                    className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/60"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                        Stop {index + 1}
                      </p>
                      <div className="flex items-center gap-3">
                        {!isReadOnly ? (
                          <button
                            type="button"
                            onClick={() => openLocationPicker(index)}
                            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-600"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            Pick on map
                          </button>
                        ) : null}
                        {!isReadOnly && formState.routeStops.length > 2 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setFormState((prev) => ({
                                ...prev,
                                routeStops: prev.routeStops.filter(
                                  (_, stopIndex) => stopIndex !== index
                                ),
                              }))
                            }
                            className="text-xs font-semibold uppercase tracking-[0.15em] text-rose-500"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          City
                        </label>
                        <Input
                          value={stop.city}
                          onChange={(event) =>
                            setFormState((prev) => {
                              const nextStops = [...prev.routeStops];
                              nextStops[index] = {
                                ...nextStops[index],
                                city: event.target.value,
                              };
                              return { ...prev, routeStops: nextStops };
                            })
                          }
                          placeholder="City name"
                          disabled={isReadOnly || submitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Latitude
                        </label>
                        <Input
                          type="number"
                          value={stop.lat}
                          onChange={(event) =>
                            setFormState((prev) => {
                              const nextStops = [...prev.routeStops];
                              nextStops[index] = {
                                ...nextStops[index],
                                lat: event.target.value,
                              };
                              return { ...prev, routeStops: nextStops };
                            })
                          }
                          placeholder="12.9716"
                          disabled={isReadOnly || submitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Longitude
                        </label>
                        <Input
                          type="number"
                          value={stop.lng}
                          onChange={(event) =>
                            setFormState((prev) => {
                              const nextStops = [...prev.routeStops];
                              nextStops[index] = {
                                ...nextStops[index],
                                lng: event.target.value,
                              };
                              return { ...prev, routeStops: nextStops };
                            })
                          }
                          placeholder="77.5946"
                          disabled={isReadOnly || submitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Up arrival
                        </label>
                        <Input
                          type="time"
                          value={stop.upArrival}
                          onChange={(event) =>
                            setFormState((prev) => {
                              const nextStops = [...prev.routeStops];
                              nextStops[index] = {
                                ...nextStops[index],
                                upArrival: event.target.value,
                              };
                              return { ...prev, routeStops: nextStops };
                            })
                          }
                          disabled={isReadOnly || submitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Up departure
                        </label>
                        <Input
                          type="time"
                          value={stop.upDeparture}
                          onChange={(event) =>
                            setFormState((prev) => {
                              const nextStops = [...prev.routeStops];
                              nextStops[index] = {
                                ...nextStops[index],
                                upDeparture: event.target.value,
                              };
                              return { ...prev, routeStops: nextStops };
                            })
                          }
                          disabled={isReadOnly || submitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Down arrival
                        </label>
                        <Input
                          type="time"
                          value={stop.downArrival}
                          onChange={(event) =>
                            setFormState((prev) => {
                              const nextStops = [...prev.routeStops];
                              nextStops[index] = {
                                ...nextStops[index],
                                downArrival: event.target.value,
                              };
                              return { ...prev, routeStops: nextStops };
                            })
                          }
                          disabled={isReadOnly || submitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Down departure
                        </label>
                        <Input
                          type="time"
                          value={stop.downDeparture}
                          onChange={(event) =>
                            setFormState((prev) => {
                              const nextStops = [...prev.routeStops];
                              nextStops[index] = {
                                ...nextStops[index],
                                downDeparture: event.target.value,
                              };
                              return { ...prev, routeStops: nextStops };
                            })
                          }
                          disabled={isReadOnly || submitting}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {!isReadOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setFormState((prev) => ({
                      ...prev,
                      routeStops: [...prev.routeStops, createEmptyStop()],
                    }))
                  }
                >
                  Add stop
                </Button>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Seat layout builder
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Layout type
                  </label>
                  <select
                    value={formState.layoutType}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        layoutType: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className={SELECT_CLASSES}
                  >
                    {Object.keys(LAYOUT_CONFIGS).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Seat kind
                  </label>
                  <select
                    value={formState.seatKind}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        seatKind: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className={SELECT_CLASSES}
                  >
                    {SEAT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Seat class
                  </label>
                  <select
                    value={formState.seatClass}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        seatClass: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className={SELECT_CLASSES}
                  >
                    {SEAT_CLASSES.map((seatClass) => (
                      <option key={seatClass} value={seatClass}>
                        {seatClass}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Deck count
                  </label>
                  <select
                    value={formState.deckCount}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        deckCount: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className={SELECT_CLASSES}
                  >
                    {[1, 2].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Front orientation
                  </label>
                  <select
                    value={formState.orientationFront}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        orientationFront: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className={SELECT_CLASSES}
                  >
                    {["TOP", "BOTTOM"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Driver side
                  </label>
                  <select
                    value={formState.driverSide}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        driverSide: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                    className={SELECT_CLASSES}
                  >
                    {["LEFT", "RIGHT"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Total seats
                  </label>
                  <Input
                    type="number"
                    value={formState.totalSeats}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        totalSeats: event.target.value,
                      }))
                    }
                    placeholder="40"
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    Seats per row:{" "}
                    {seatLayoutPreview.meta?.seatsPerRow ?? "—"}
                  </span>
                  <span>Grid cols: {seatLayoutPreview.meta?.cols ?? "—"}</span>
                  <span>
                    Deck rows:{" "}
                    {seatLayoutPreview.meta?.rowsByDeck
                      ? Object.entries(seatLayoutPreview.meta.rowsByDeck)
                          .map(([deck, rows]) => `${deck} ${rows}`)
                          .join(" · ")
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Seat layout preview
              </p>
              {seatLayoutPreview.error ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  {seatLayoutPreview.error}
                </div>
              ) : seatLayout ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Layout type
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-100">
                        {seatLayout.layoutType || "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Orientation
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-100">
                        Front {seatLayout.orientation?.front || "—"} · Driver{" "}
                        {seatLayout.orientation?.driverSide || "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Versions
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-100">
                        Schema {seatLayout.schemaVersion ?? "—"} · Layout{" "}
                        {seatLayout.version ?? "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                    {[
                      { label: "Seat", type: "SEAT" },
                      { label: "Aisle", type: "AISLE" },
                      { label: "Door", type: "DOOR" },
                      { label: "Driver", type: "DRIVER" },
                      { label: "Stairs", type: "STAIRS" },
                      { label: "WC", type: "WC" },
                      { label: "Entry", type: "ENTRY" },
                      { label: "Exit", type: "EXIT" },
                    ].map((item) => (
                      <span
                        key={item.type}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border border-slate-200/70 px-3 py-1",
                          getElementStyles(item.type)
                        )}
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>

                  {deckNames.length ? (
                    <Tabs value={activeDeck} onValueChange={setActiveDeck}>
                      <TabsList className="flex flex-wrap gap-2 bg-transparent p-0">
                        {deckNames.map((deckName) => (
                          <TabsTrigger
                            key={deckName}
                            value={deckName}
                            className="rounded-2xl border border-slate-200/70 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-600 data-[state=active]:border-slate-900 data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:data-[state=active]:border-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900"
                          >
                            {deckName}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {deckNames.map((deckName) => {
                        const deck = seatLayout.decks?.find(
                          (item) => normalizeSeatToken(item.deck) === deckName
                        );
                        return (
                          <TabsContent key={deckName} value={deckName}>
                            {renderDeckGrid(deck, deckName)}
                          </TabsContent>
                        );
                      })}
                    </Tabs>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                      No decks found in the seat layout.
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Insurance
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Provider
                  </label>
                  <Input
                    value={formState.insuranceProvider}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        insuranceProvider: event.target.value,
                      }))
                    }
                    placeholder="Provider name"
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Policy number
                  </label>
                  <Input
                    value={formState.insurancePolicyNumber}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        insurancePolicyNumber: event.target.value,
                      }))
                    }
                    placeholder="POL123456"
                    disabled={isReadOnly || submitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Expiry
                  </label>
                  <Input
                    type="date"
                    value={formState.insuranceExpiry}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        insuranceExpiry: event.target.value,
                      }))
                    }
                    disabled={isReadOnly || submitting}
                  />
                </div>
              </div>
            </div>

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
        </DialogContent>
      </Dialog>

      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Pick stop location
            </DialogTitle>
            <DialogDescription>
              Search for a stop or click the map to set coordinates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Search location
              </label>
              <Input
                value={geoQuery}
                onChange={(event) => setGeoQuery(event.target.value)}
                placeholder="Type a city or terminal name"
              />
              {geoLoading ? (
                <p className="text-xs text-slate-400">Searching locations...</p>
              ) : null}
              {geoError ? (
                <p className="text-xs text-rose-500">{geoError}</p>
              ) : null}
              {!geoLoading && geoResults.length > 0 ? (
                <div className="max-h-40 space-y-2 overflow-auto rounded-xl border border-slate-200/70 bg-white/80 p-2 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
                  {geoResults.map((result) => (
                    <button
                      key={`${result.lat}-${result.lng}-${result.name}`}
                      type="button"
                      onClick={() => applyGeoResult(result)}
                      className="w-full rounded-lg border border-transparent px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:text-slate-200 dark:hover:border-white/10 dark:hover:bg-white/5"
                    >
                      <div>{result.name}</div>
                      {result.displayName ? (
                        <p className="text-[11px] text-slate-400">
                          {result.displayName}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Map picker
              </label>
              <div className="h-80 overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40">
                <MapPicker
                  center={mapCenter}
                  zoom={mapZoom}
                  marker={mapMarker}
                  onPick={handleMapPick}
                />
              </div>
              <p className="text-xs text-slate-400">
                Click anywhere on the map to set the stop coordinates.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  City
                </div>
                <div className="mt-1 font-semibold">
                  {activeStopIndex !== null
                    ? formState.routeStops[activeStopIndex]?.city || "—"
                    : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Latitude
                </div>
                <div className="mt-1 font-semibold">
                  {activeStopIndex !== null
                    ? formState.routeStops[activeStopIndex]?.lat || "—"
                    : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Longitude
                </div>
                <div className="mt-1 font-semibold">
                  {activeStopIndex !== null
                    ? formState.routeStops[activeStopIndex]?.lng || "—"
                    : "—"}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocationDialogOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete bus</DialogTitle>
            <DialogDescription>
              This will permanently remove{" "}
              <strong>{deleteTarget ? getBusDisplayName(deleteTarget) : "bus"}</strong>
              . This action cannot be undone.
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
              {deleting ? "Deleting..." : "Delete bus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageBusesPage;
