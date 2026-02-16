import { Booking } from "../models/booking.js";
import { Bus } from "../models/bus.js";
import { Payment } from "../models/payment.js";
import { SeatHold } from "../models/seatHold.js";
import { User } from "../models/user.js";
import { SeatLockService } from "../services/seatLockService.js";
import {
  evaluateOfferEligibility,
  normalizeOfferCode,
  releaseOfferReservation,
  reserveOfferForBooking,
  invalidateOfferRedemptionOnCancel,
} from "../services/offerService.js";
import { generateInvoicePdfBuffer } from "../utils/invoicePdf.js";
import mongoose from "mongoose";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 6);

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DEFAULT_CURRENCY = "INR";

const getStopDistanceValue = (stop, direction) => {
  const trip = direction === "return" ? stop?.downTrip : stop?.upTrip;
  return typeof trip?.distanceFromOrigin === "number"
    ? trip.distanceFromOrigin
    : null;
};

const normalizeSeatToken = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const formatDateKey = (dateValue) => {
  const date = new Date(dateValue);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildTripKey = (busId, travelDate, direction) =>
  `${busId}_${formatDateKey(travelDate)}_${direction}`;

const resolveSeatIdsForInputs = (bus, seatInputs) => {
  const seats = Array.isArray(bus?.seatLayout?.seats)
    ? bus.seatLayout.seats
    : [];
  const seatIdSet = new Set(seats.map((seat) => seat.seatId));
  const labelMap = new Map(seats.map((seat) => [seat.label, seat.seatId]));

  const resolved = seatInputs.map((input) => {
    const normalized = normalizeSeatToken(input);
    if (!normalized) return null;
    if (seatIdSet.has(normalized)) return normalized;
    return labelMap.get(normalized) || null;
  });

  const unknown = resolved
    .map((value, index) =>
      value ? null : normalizeSeatToken(seatInputs[index]),
    )
    .filter(Boolean);

  return { resolved, unknown };
};

const getDayLabel = (value) => DAY_NAMES[new Date(value).getDay()];

const BOOKING_STATUS_SET = new Set([
  "pending",
  "confirmed",
  "cancelled",
  "completed",
]);

const ADMIN_CREATE_BOOKING_STATUS_SET = new Set([
  "pending",
  "confirmed",
  "cancelled",
  "completed",
]);

const ADMIN_PAYMENT_STATUS_SET = new Set([
  "pending",
  "paid",
  "refunded",
  "partial-refund",
]);

const BOOKING_TAB_SET = new Set(["all", "upcoming", "cancelled", "completed"]);

const SORT_OPTIONS = {
  createdAt: { createdAt: 1 },
  "-createdAt": { createdAt: -1 },
  travelDate: { travelDate: 1, createdAt: -1 },
  "-travelDate": { travelDate: -1, createdAt: -1 },
  amount: { totalAmount: 1, createdAt: -1 },
  "-amount": { totalAmount: -1, createdAt: -1 },
};

const SEARCH_MAX_LENGTH = 80;
const MINUTES_IN_DAY = 24 * 60;
const MAX_ADMIN_LIMIT = 100;
const INVOICE_SUPPORT_EMAIL =
  process.env.INVOICE_SUPPORT_EMAIL || "support@bookmyseat.com";
const INVOICE_FILE_PREFIX = "invoice";

const sanitizeFilename = (value, fallback = `${INVOICE_FILE_PREFIX}.pdf`) => {
  const clean = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!clean) return fallback;
  return clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
};

const getInvoiceBookingRef = (booking) =>
  String(booking?.bookingId || booking?._id || "").trim();

const buildInvoiceDownloadPath = (booking) => {
  const ref = getInvoiceBookingRef(booking);
  if (!ref) return null;
  return `/mybookings/${encodeURIComponent(ref)}/invoice`;
};

const isInvoicePaymentSettled = (booking, paymentSnapshot = null) => {
  if (booking?.paymentStatus !== "paid") return false;
  if (!paymentSnapshot?.status) return true;
  return String(paymentSnapshot.status).toLowerCase() === "success";
};

const getStartOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDateQuery = (value, { endOfDay = false } = {}) => {
  if (!value) return null;
  const raw = String(value).trim();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  // Date-only strings are normalized to local day boundaries.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (endOfDay) {
      parsed.setHours(23, 59, 59, 999);
    } else {
      parsed.setHours(0, 0, 0, 0);
    }
  }
  return parsed;
};

const toMinutes = (timeObj) =>
  typeof timeObj?.hours === "number" && typeof timeObj?.minutes === "number"
    ? timeObj.hours * 60 + timeObj.minutes
    : null;

const computeDurationMinutes = (startMinutes, endMinutes) => {
  if (startMinutes === null || endMinutes === null) return null;
  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += MINUTES_IN_DAY;
  return diff;
};

const normalizeCityToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const findRouteStopByCity = (route, city) => {
  if (!route || !Array.isArray(route.stops)) return null;
  const token = normalizeCityToken(city);
  if (!token) return null;
  return route.stops.find((stop) => normalizeCityToken(stop?.city) === token);
};

const getTripByDirection = (stop, direction) =>
  direction === "return" ? stop?.downTrip : stop?.upTrip;

const getJourneySnapshot = (booking) => {
  const route = booking?.route;
  const direction = booking?.direction || "forward";
  const boardingStop = findRouteStopByCity(route, booking?.boardingPoint);
  const droppingStop = findRouteStopByCity(route, booking?.droppingPoint);

  const boardingTrip = getTripByDirection(boardingStop, direction);
  const droppingTrip = getTripByDirection(droppingStop, direction);

  const departureTime =
    boardingTrip?.departureTime || boardingTrip?.arrivalTime || null;
  const arrivalTime =
    droppingTrip?.arrivalTime || droppingTrip?.departureTime || null;

  const departureMinutes = toMinutes(departureTime);
  const arrivalMinutes = toMinutes(arrivalTime);
  const segmentDurationMinutes = computeDurationMinutes(
    departureMinutes,
    arrivalMinutes,
  );

  return {
    direction,
    origin: booking?.boardingPoint || route?.origin || null,
    destination: booking?.droppingPoint || route?.destination || null,
    departureTime,
    arrivalTime,
    segmentDurationMinutes,
  };
};

const calculateDepartureDateTime = (booking) => {
  const travelDate = new Date(booking.travelDate);
  if (Number.isNaN(travelDate.getTime())) return null;

  const journey = getJourneySnapshot(booking);
  const departureMinutes = toMinutes(journey.departureTime);

  // If departure time is missing, fallback to start of travel date
  // This ensures it doesn't prematurely mark as completed if time is unknown
  if (departureMinutes === null) {
    return new Date(travelDate);
  }

  const departureDate = new Date(travelDate);
  departureDate.setHours(
    Math.floor(departureMinutes / 60),
    departureMinutes % 60,
    0,
    0,
  );

  return departureDate;
};

export const calculateArrivalDateTime = (booking) => {
  const travelDate = new Date(booking.travelDate);
  if (Number.isNaN(travelDate.getTime())) return null;

  const journey = getJourneySnapshot(booking);
  const arrivalMinutes = toMinutes(journey.arrivalTime);

  // If arrival time is missing, fallback to end of travel date
  if (arrivalMinutes === null) {
    const fallback = new Date(travelDate);
    fallback.setHours(23, 59, 59, 999);
    return fallback;
  }

  const arrivalDate = new Date(travelDate);
  arrivalDate.setHours(
    Math.floor(arrivalMinutes / 60),
    arrivalMinutes % 60,
    0,
    0,
  );

  // Handle next-day arrival if arrival time is before departure (simplified check)
  // detailed check would need departure time comparison
  const departureMinutes = toMinutes(journey.departureTime);
  if (departureMinutes !== null && arrivalMinutes < departureMinutes) {
    arrivalDate.setDate(arrivalDate.getDate() + 1);
  }

  return arrivalDate;
};

const getBookingLifecycleBucket = (booking, now = new Date()) => {
  const status = booking?.bookingStatus;
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed"; // Explicitly marked completed

  // Revert: Use ARRIVAL time for "Completed" check
  const arrivalTime = calculateArrivalDateTime(booking);

  if (!arrivalTime) return "upcoming";

  return arrivalTime < now ? "completed" : "upcoming";
};

const buildTabCondition = (tab, todayStart) => {
  switch (tab) {
    case "upcoming":
      return {
        bookingStatus: { $in: ["pending", "confirmed"] },
        // We fetch everything from today onwards, then filter in memory for exact time
        travelDate: { $gte: todayStart },
      };
    case "cancelled":
      return { bookingStatus: "cancelled" };
    case "completed":
      return {
        $or: [
          { bookingStatus: "completed" },
          {
            bookingStatus: { $in: ["pending", "confirmed"] },
            // We fetch everything including today, then filter in memory for exact time
            travelDate: {
              $lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        ],
      };
    default:
      return {};
  }
};

const appendAndCondition = (base, condition) => {
  if (!condition || Object.keys(condition).length === 0) return base;
  if (!base || Object.keys(base).length === 0) return condition;
  return { $and: [base, condition] };
};

const buildSortObject = (sortInput, fallback = "-createdAt") => {
  const token = typeof sortInput === "string" ? sortInput.trim() : "";
  if (token && SORT_OPTIONS[token]) {
    return SORT_OPTIONS[token];
  }
  return SORT_OPTIONS[fallback] || SORT_OPTIONS["-createdAt"];
};

const formatBusSnapshot = (bus) => {
  if (!bus || typeof bus !== "object") return null;
  return {
    id: bus._id || null,
    name: bus.busName || null,
    number: bus.busNumber || null,
    operator: bus.operator || null,
    departureTime: bus.departureTime || null,
    arrivalTime: bus.arrivalTime || null,
    farePerKm: bus.farePerKm ?? null,
    amenities: Array.isArray(bus.amenities) ? bus.amenities : [],
    features: bus.features || null,
  };
};

const extractPaymentSnapshot = (payment) => {
  if (!payment || typeof payment !== "object") return null;
  const gateway = payment.gatewayResponse || {};
  return {
    id: payment._id || null,
    paymentId: payment.paymentId || null,
    amount: payment.amount ?? null,
    currency: payment.currency || DEFAULT_CURRENCY,
    method: payment.method || null,
    status: payment.status || null,
    createdAt: payment.createdAt || null,
    updatedAt: payment.updatedAt || null,
    gatewayReference:
      gateway?.razorpay_payment_id ||
      gateway?.paymentId ||
      gateway?.order?.id ||
      null,
  };
};

const formatBookingListItem = (booking, now = new Date()) => {
  const route = booking?.route || {};
  const passengers = Array.isArray(booking?.passengers)
    ? booking.passengers
    : [];
  const seats = passengers
    .map((passenger) => normalizeSeatToken(passenger?.seatNumber))
    .filter(Boolean);

  const journey = getJourneySnapshot(booking);
  const lifecycleBucket = getBookingLifecycleBucket(booking, now);
  const travelDate = new Date(booking?.travelDate);
  const canCancel =
    booking?.bookingStatus !== "cancelled" &&
    lifecycleBucket !== "completed" && // Use bucket instead of status to prevent cancelling completed trips
    !Number.isNaN(travelDate.getTime()) &&
    travelDate.getTime() > now.getTime();

  const payment =
    booking?.payment && booking.payment?.status
      ? extractPaymentSnapshot(booking.payment)
      : null;

  // Calculate isRunning status
  const departureDate = calculateDepartureDateTime(booking);
  const arrivalDate = calculateArrivalDateTime(booking);
  const isRunning =
    departureDate &&
    arrivalDate &&
    now >= departureDate &&
    now < arrivalDate &&
    booking?.bookingStatus !== "cancelled";

  return {
    id: booking?._id,
    dbId: booking?._id,
    bookingId: booking?.bookingId,
    bookingStatus: booking?.bookingStatus,
    paymentStatus: booking?.paymentStatus,
    lifecycleBucket,
    isRunning, // New field
    travelDate: booking?.travelDate,
    createdAt: booking?.createdAt,
    updatedAt: booking?.updatedAt,
    direction: booking?.direction || "forward",
    boardingPoint: booking?.boardingPoint,
    droppingPoint: booking?.droppingPoint,
    passengers,
    passengerCount: passengers.length,
    primaryPassenger: passengers[0]?.name || null,
    seats,
    farePerKm: booking?.farePerKm,
    farePerPassenger: booking?.farePerPassenger,
    baseAmount:
      typeof booking?.baseAmount === "number"
        ? booking.baseAmount
        : booking?.totalAmount,
    discountAmount:
      typeof booking?.discountAmount === "number" ? booking.discountAmount : 0,
    finalAmount:
      typeof booking?.finalAmount === "number"
        ? booking.finalAmount
        : booking?.totalAmount,
    totalAmount: booking?.totalAmount,
    currency: booking?.currency || DEFAULT_CURRENCY,
    journeyDistance: booking?.journeyDistance ?? null,
    offer: booking?.offer || null,
    canCancel,
    trip: journey,
    bus: formatBusSnapshot(booking?.bus),
    route: {
      id: route?.routeCode || null,
      code: route?.routeCode || null,
      origin: route?.origin || null,
      destination: route?.destination || null,
      duration: route?.duration || null,
    },
    cancellation: booking?.cancellation || null,
    payment,
    isReviewed: !!booking?.isReviewed,
  };
};

const formatBookingDetail = (booking, now = new Date()) => {
  const base = formatBookingListItem(booking, now);
  const route = booking?.route || {};
  const payment = extractPaymentSnapshot(booking?.payment);
  const invoiceAvailable = isInvoicePaymentSettled(booking, payment);
  return {
    ...base,
    passengers: Array.isArray(booking?.passengers) ? booking.passengers : [],
    route: {
      ...base.route,
      stops: Array.isArray(route?.stops) ? route.stops : [],
      cancellationPolicy: route?.cancellationPolicy || null,
    },
    payment,
    invoice: {
      available: invoiceAvailable,
      downloadUrl: invoiceAvailable ? buildInvoiceDownloadPath(booking) : null,
    },
  };
};

const formatAdminUserSnapshot = (user) => {
  if (!user || typeof user !== "object") return null;
  return {
    id: user._id || null,
    fullName: user.fullName || null,
    email: user.email || null,
    phone: user.phone || null,
    role: user.role || null,
  };
};

const formatAdminBookingListItem = (booking, now = new Date()) => ({
  ...formatBookingListItem(booking, now),
  user: formatAdminUserSnapshot(booking?.user),
});

const formatAdminBookingDetail = (booking, now = new Date()) => ({
  ...formatBookingDetail(booking, now),
  user: formatAdminUserSnapshot(booking?.user),
});

const parseBookingRefOrThrow = (bookingRefRaw) => {
  const bookingRef = String(bookingRefRaw || "").trim();
  if (!bookingRef) {
    const error = new Error("Booking reference is required");
    error.code = "MISSING_BOOKING_REF";
    error.statusCode = 400;
    throw error;
  }
  const refQuery = [
    { bookingId: new RegExp(`^${escapeRegex(bookingRef)}$`, "i") },
  ];
  if (mongoose.Types.ObjectId.isValid(bookingRef)) {
    refQuery.push({ _id: bookingRef });
  }
  return refQuery;
};

const mapBookingPaymentStatusToPaymentStatus = (value) => {
  if (value === "partial-refund") return "partial_refund";
  if (value === "paid") return "success";
  if (value === "pending") return "pending";
  if (value === "refunded") return "refunded";
  return "pending";
};

const requiresSeatReservation = (bookingStatus, paymentStatus) =>
  paymentStatus === "paid" && bookingStatus !== "cancelled";

const buildOfflinePaymentId = () => `OFFLINE_${Date.now()}_${nanoid()}`;

const buildInvoicePayloadFromBooking = (booking, paymentSnapshot = null) => {
  const passengers = Array.isArray(booking?.passengers)
    ? booking.passengers.map((passenger) => ({
        name: passenger?.name || "Traveller",
        seatNumber: passenger?.seatNumber || "N/A",
        age: passenger?.age ?? null,
        gender: passenger?.gender || null,
      }))
    : [];

  const busLabel = [
    booking?.bus?.busName || booking?.bus?.name || null,
    booking?.bus?.busNumber ? `(${booking.bus.busNumber})` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    companyName: "BookMySeat",
    supportEmail: INVOICE_SUPPORT_EMAIL,
    invoiceNumber: `INV-${getInvoiceBookingRef(booking) || Date.now()}`,
    issuedAt:
      paymentSnapshot?.createdAt ||
      booking?.updatedAt ||
      booking?.createdAt ||
      new Date(),
    bookingId: booking?.bookingId || booking?._id || "N/A",
    route: `${booking?.boardingPoint || "N/A"} to ${
      booking?.droppingPoint || "N/A"
    }`,
    travelDate: booking?.travelDate,
    boardingPoint: booking?.boardingPoint || null,
    droppingPoint: booking?.droppingPoint || null,
    busLabel: busLabel || "N/A",
    passengers,
    paymentId: paymentSnapshot?.paymentId || null,
    transactionRef: paymentSnapshot?.gatewayReference || null,
    paymentMethod: paymentSnapshot?.method || null,
    paymentStatus: paymentSnapshot?.status || booking?.paymentStatus || null,
    totalAmount: paymentSnapshot?.amount ?? booking?.totalAmount ?? 0,
    currency:
      paymentSnapshot?.currency || booking?.currency || DEFAULT_CURRENCY,
    customerName: booking?.user?.fullName || "N/A",
    customerEmail: booking?.user?.email || "N/A",
    customerPhone: booking?.user?.phone || "N/A",
  };
};

const findBookingByRefForAdmin = async (bookingRef, session = null) => {
  const refQuery = parseBookingRefOrThrow(bookingRef);
  const query = Booking.findOne({ $or: refQuery })
    .populate({
      path: "bus",
      select:
        "busName busNumber operator route seatLayout farePerKm totalSeats availableSeats bookedSeats",
    })
    .populate({
      path: "user",
      select: "fullName email phone role",
    })
    .populate({
      path: "payment",
      select:
        "paymentId amount currency method status createdAt updatedAt gatewayResponse",
    });

  if (session) query.session(session);
  return query;
};

const buildSeatEntries = ({
  seatIds,
  bookingId,
  travelDateObj,
  direction,
  bookingDate = new Date(),
  boardingPoint = null,
  droppingPoint = null,
  segmentStartKm = null,
  segmentEndKm = null,
}) =>
  seatIds.map((seatNumber) => ({
    seatNumber,
    bookingId,
    bookingDate,
    travelDate: travelDateObj,
    direction,
    boardingPoint: boardingPoint || undefined,
    droppingPoint: droppingPoint || undefined,
    segmentStartKm: Number.isFinite(Number(segmentStartKm))
      ? Number(segmentStartKm)
      : undefined,
    segmentEndKm: Number.isFinite(Number(segmentEndKm))
      ? Number(segmentEndKm)
      : undefined,
  }));

const validateTravelDateValue = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const normalizeBookingStatusToken = (value, fallback = "pending") => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized || fallback;
};

const resolveRouteAndFareSnapshot = ({
  bus,
  boardingPoint,
  droppingPoint,
  direction = "forward",
  passengerCount,
}) => {
  if (!bus?.route || !Array.isArray(bus.route.stops)) {
    const error = new Error("Route information is incomplete");
    error.statusCode = 400;
    error.code = "INCOMPLETE_ROUTE";
    throw error;
  }

  const boardingStop = bus.route.stops.find(
    (stop) =>
      normalizeCityToken(stop?.city) === normalizeCityToken(boardingPoint),
  );
  const droppingStop = bus.route.stops.find(
    (stop) =>
      normalizeCityToken(stop?.city) === normalizeCityToken(droppingPoint),
  );

  if (!boardingStop || !droppingStop) {
    const error = new Error("Invalid boarding/dropping point");
    error.statusCode = 400;
    error.code = "INVALID_POINT";
    throw error;
  }

  const boardingDistance = getStopDistanceValue(boardingStop, direction);
  const droppingDistance = getStopDistanceValue(droppingStop, direction);

  if (boardingDistance === null || droppingDistance === null) {
    const error = new Error("Route distance data is incomplete");
    error.statusCode = 400;
    error.code = "INCOMPLETE_ROUTE";
    throw error;
  }

  const isInvalidOrder =
    direction === "forward"
      ? boardingDistance >= droppingDistance
      : boardingDistance <= droppingDistance;

  if (isInvalidOrder) {
    const error = new Error("Boarding point must be before dropping point");
    error.statusCode = 400;
    error.code = "INVALID_POINT_ORDER";
    throw error;
  }

  const journeyDistance = Math.abs(droppingDistance - boardingDistance);
  const farePerPassenger = bus.farePerKm * journeyDistance;
  const totalAmount = Number.parseFloat(
    (farePerPassenger * passengerCount).toFixed(2),
  );
  const segmentStartKm = Math.min(boardingDistance, droppingDistance);
  const segmentEndKm = Math.max(boardingDistance, droppingDistance);

  return {
    journeyDistance,
    farePerPassenger: Number.parseFloat(farePerPassenger.toFixed(2)),
    totalAmount,
    segmentStartKm,
    segmentEndKm,
    routeSnapshot: bus.route?.toObject ? bus.route.toObject() : bus.route,
  };
};

// Lock seats before creating booking with enhanced error handling
export const lockSeatsForBooking = async (req, res) => {
  try {
    const {
      busId,
      travelDate,
      seatNumbers,
      sessionId,
      direction = "forward",
      boardingPoint,
      droppingPoint,
    } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!busId || !travelDate || !seatNumbers?.length) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        code: "MISSING_FIELDS",
      });
    }

    // Normalize seat identifiers
    const seats = seatNumbers.map((seat) => normalizeSeatToken(seat));
    if (seats.some((seat) => !seat)) {
      return res.status(400).json({
        success: false,
        message: "Invalid seat identifiers",
        code: "INVALID_SEATS",
      });
    }
    if (new Set(seats).size !== seats.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate seats are not allowed",
        code: "DUPLICATE_SEATS",
      });
    }

    console.log(
      `[lockSeatsForBooking] Attempting to lock seats ${seats.join(
        ", ",
      )} for user ${userId} with sessionId: ${sessionId}`,
    );

    const lockResult = await SeatLockService.lockSeats({
      busId,
      seatNumbers: seats,
      userId,
      travelDate,
      direction,
      sessionId,
      boardingPoint,
      droppingPoint,
      lockDurationMinutes: 10,
    });

    console.log(`[lockSeatsForBooking] Successfully locked seats:`, lockResult);

    res.status(200).json({
      success: true,
      message: "Seats locked successfully",
      data: lockResult,
    });
  } catch (error) {
    console.error("[lockSeatsForBooking] Seat locking error:", error);

    // Handle specific error types
    if (error.message.includes("not available")) {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: "SEATS_UNAVAILABLE",
      });
    }

    if (error.message.includes("Bus not found")) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
        code: "BUS_NOT_FOUND",
      });
    }

    if (
      error.message.includes("Invalid seat identifiers") ||
      error.message.includes("Duplicate seats")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: "INVALID_SEATS",
      });
    }

    if (
      error.message.includes("boardingPoint and droppingPoint") ||
      error.message.includes("Invalid boarding/dropping points")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: "INVALID_POINT",
      });
    }

    // Handle write conflicts and other retryable errors
    if (error.message.includes("Write conflict") || error.code === 112) {
      return res.status(503).json({
        success: false,
        message:
          "Service temporarily unavailable due to high demand. Please try again.",
        code: "SERVICE_BUSY",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to lock seats",
      code: "LOCK_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Create booking (modified to work with seat locks)
export const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const {
      busId,
      travelDate,
      passengers,
      boardingPoint,
      droppingPoint,
      sessionId,
      direction = "forward",
      offerCode,
    } = req.body;
    const userId = req.user._id;
    const requestedOfferCode = normalizeOfferCode(offerCode);

    // Validate input
    if (
      !busId ||
      !travelDate ||
      !passengers?.length ||
      !boardingPoint ||
      !droppingPoint ||
      !sessionId
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        code: "MISSING_FIELDS",
      });
    }

    // Verify seats are locked by this user/session
    const travelDateObj = new Date(travelDate);
    const now = new Date();

    if (Number.isNaN(travelDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid travel date",
        code: "INVALID_DATE",
      });
    }

    session.startTransaction();

    // Get the bus to check locks
    const bus = await Bus.findById(busId).session(session);

    if (!bus) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Bus not found",
        code: "BUS_NOT_FOUND",
      });
    }

    if (bus.isDeleted || !bus.isActive) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Bus is not available for booking",
        code: "BUS_INACTIVE",
      });
    }

    const dayLabel = getDayLabel(travelDateObj);
    if (
      Array.isArray(bus.operatingDays) &&
      bus.operatingDays.length > 0 &&
      dayLabel &&
      !bus.operatingDays.includes(dayLabel)
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Bus does not operate on ${dayLabel}`,
        code: "BUS_NOT_OPERATING",
      });
    }

    // Check if route is populated and has stops
    if (!bus.route || !bus.route.stops) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Route information is incomplete",
        code: "INCOMPLETE_ROUTE",
      });
    }

    // Extract seat identifiers from passengers
    const seatInputs = passengers.map((p) => p.seatNumber);

    try {
      await SeatLockService.checkAndExtendLocks({
        busId,
        userId,
        sessionId,
        travelDate,
        direction,
        extendIfExpiringInMinutes: 10,
      });
    } catch (extendError) {
      console.warn("[createBooking] Failed to extend locks:", extendError);
    }

    const { resolved: seatIds, unknown: unknownSeats } =
      resolveSeatIdsForInputs(bus, seatInputs);
    if (unknownSeats.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Invalid seat identifiers: ${unknownSeats.join(", ")}`,
        code: "INVALID_SEATS",
      });
    }

    const uniqueSeatIds = new Set(seatIds);
    if (uniqueSeatIds.size !== seatIds.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Duplicate seats selected",
        code: "DUPLICATE_SEATS",
      });
    }

    if (seatIds.length !== passengers.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Passenger count and seats do not match",
        code: "SEAT_COUNT_MISMATCH",
      });
    }

    const normalizedPassengers = passengers.map((passenger, index) => ({
      ...passenger,
      seatNumber: seatIds[index],
    }));

    let bookingToUpdate = null;
    const existingBooking = await Booking.findOne({
      user: userId,
      bus: busId,
      travelDate: travelDateObj,
      direction,
      sessionId,
      bookingStatus: { $ne: "cancelled" },
    }).session(session);

    if (existingBooking) {
      const existingDateKey = formatDateKey(existingBooking.travelDate);
      const requestedDateKey = formatDateKey(travelDateObj);
      if (
        existingBooking.bus.toString() !== busId ||
        existingDateKey !== requestedDateKey ||
        existingBooking.direction !== direction
      ) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "Session already used for another booking",
          code: "SESSION_CONFLICT",
        });
      }

      const existingSeats = (existingBooking.passengers || []).map((p) =>
        normalizeSeatToken(p.seatNumber),
      );
      const requestedSeats = seatIds.map((seat) => normalizeSeatToken(seat));
      const existingSeatSet = new Set(existingSeats);
      const sameSeats =
        existingSeats.length === requestedSeats.length &&
        requestedSeats.every((seat) => existingSeatSet.has(seat));

      const existingOfferCode = normalizeOfferCode(existingBooking.offer?.code);
      const sameOfferCode = existingOfferCode === requestedOfferCode;

      if (!sameSeats || !sameOfferCode) {
        if (
          existingBooking.bookingStatus !== "pending" ||
          existingBooking.paymentStatus !== "pending"
        ) {
          await session.abortTransaction();
          return res.status(409).json({
            success: false,
            message: "Booking already processed for this session",
            code: "BOOKING_ALREADY_PROCESSED",
          });
        }

        if (existingBooking.payment) {
          const existingPayment = await Payment.findById(
            existingBooking.payment,
          ).session(session);
          if (existingPayment && existingPayment.status === "pending") {
            await session.abortTransaction();
            return res.status(409).json({
              success: false,
              message:
                "Payment already initiated for this session. Please complete or wait for it to expire.",
              code: "PAYMENT_IN_PROGRESS",
            });
          }
        }
        bookingToUpdate = existingBooking;
      } else {
        await session.commitTransaction();

        const populatedBooking = await Booking.findById(existingBooking._id)
          .populate("bus", "busName busNumber operator")
          .populate("user", "fullName email")
          .lean();

        return res.status(200).json({
          success: true,
          message: "Booking already created",
          data: {
            ...populatedBooking,
            sessionId,
          },
        });
      }
    }

    const userLocks = await SeatHold.find({
      bus: busId,
      travelDate: travelDateObj,
      direction,
      user: userId,
      sessionId,
      status: "HOLD",
      expiresAt: { $gt: now },
      seatId: { $in: seatIds },
    }).session(session);

    const lockedSeatNumbers = userLocks.map((lock) => lock.seatId);
    const requestedSeatNumbers = seatIds;

    // Check if all requested seats are still locked
    const allSeatsLocked = requestedSeatNumbers.every((seat) =>
      lockedSeatNumbers.includes(seat),
    );

    if (!allSeatsLocked || userLocks.length !== seatIds.length) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "Seats are not properly locked or locks have expired",
        code: "INVALID_LOCKS",
        lockedSeats: lockedSeatNumbers,
        requestedSeats: requestedSeatNumbers,
      });
    }

    const activeSessionLocks = await SeatHold.find({
      bus: busId,
      travelDate: travelDateObj,
      direction,
      user: userId,
      sessionId,
      status: "HOLD",
      expiresAt: { $gt: now },
    }).session(session);

    const requestedSeatSet = new Set(seatIds);
    const extraLocks = activeSessionLocks.filter(
      (lock) => !requestedSeatSet.has(lock.seatId),
    );

    if (extraLocks.length > 0) {
      await SeatHold.updateMany(
        { _id: { $in: extraLocks.map((lock) => lock._id) } },
        { $set: { status: "CANCELLED", expiresAt: now } },
        { session },
      );
    }

    // Find stops - case insensitive comparison
    const boardingStop = bus.route.stops.find(
      (s) => s.city.toLowerCase() === boardingPoint.toLowerCase().trim(),
    );
    const droppingStop = bus.route.stops.find(
      (s) => s.city.toLowerCase() === droppingPoint.toLowerCase().trim(),
    );

    // Validate stops
    if (!boardingStop || !droppingStop) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid boarding/dropping point",
        code: "INVALID_POINT",
      });
    }

    const boardingDistance = getStopDistanceValue(boardingStop, direction);
    const droppingDistance = getStopDistanceValue(droppingStop, direction);

    if (boardingDistance === null || droppingDistance === null) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Route distance data is incomplete",
        code: "INCOMPLETE_ROUTE",
      });
    }

    const isInvalidOrder =
      direction === "forward"
        ? boardingDistance >= droppingDistance
        : boardingDistance <= droppingDistance;

    if (isInvalidOrder) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Boarding point must be before dropping point",
        code: "INVALID_POINT_ORDER",
      });
    }

    const requestedSegmentStart = Math.min(boardingDistance, droppingDistance);
    const requestedSegmentEnd = Math.max(boardingDistance, droppingDistance);
    const lockSegmentMismatch = userLocks.some((lock) => {
      const lockStart = Number(lock?.segmentStartKm);
      const lockEnd = Number(lock?.segmentEndKm);
      if (!Number.isFinite(lockStart) || !Number.isFinite(lockEnd)) {
        return true;
      }
      return (
        Math.abs(lockStart - requestedSegmentStart) > 0.0001 ||
        Math.abs(lockEnd - requestedSegmentEnd) > 0.0001
      );
    });

    if (lockSegmentMismatch) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message:
          "Seat locks do not match the selected boarding/dropping segment. Please reselect seats.",
        code: "LOCK_SEGMENT_MISMATCH",
      });
    }

    // Calculate dynamic pricing
    const journeyDistance = Math.abs(droppingDistance - boardingDistance);
    const farePerPassenger = bus.farePerKm * journeyDistance;
    const baseAmount = Number.parseFloat(
      (farePerPassenger * passengers.length).toFixed(2),
    );
    let discountAmount = 0;
    let finalAmount = baseAmount;
    let offerSnapshot = null;
    let offerEvaluation = null;

    if (requestedOfferCode) {
      offerEvaluation = await evaluateOfferEligibility(
        {
          code: requestedOfferCode,
          userId,
          busId,
          routeCode: bus.route?.routeCode,
          travelDate: travelDateObj,
          boardingPoint,
          droppingPoint,
          direction,
          passengerCount: passengers.length,
          baseAmount,
          currency: DEFAULT_CURRENCY,
        },
        { session },
      );

      if (!offerEvaluation.eligible) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: offerEvaluation.reason || "Offer is not applicable",
          code: offerEvaluation.code || "OFFER_NOT_ELIGIBLE",
        });
      }

      discountAmount = Number(offerEvaluation.pricing.discountAmount || 0);
      finalAmount = Number(offerEvaluation.pricing.finalAmount || baseAmount);
      offerSnapshot = offerEvaluation.offerSnapshot || null;
    }

    if (bookingToUpdate) {
      bookingToUpdate.passengers = normalizedPassengers;
      bookingToUpdate.boardingPoint = boardingPoint;
      bookingToUpdate.droppingPoint = droppingPoint;
      bookingToUpdate.route = bus.route?.toObject
        ? bus.route.toObject()
        : bus.route;
      bookingToUpdate.journeyDistance = journeyDistance;
      bookingToUpdate.farePerKm = bus.farePerKm;
      bookingToUpdate.farePerPassenger = Number.parseFloat(
        farePerPassenger.toFixed(2),
      );
      bookingToUpdate.baseAmount = baseAmount;
      bookingToUpdate.discountAmount = discountAmount;
      bookingToUpdate.finalAmount = finalAmount;
      bookingToUpdate.totalAmount = finalAmount;
      bookingToUpdate.currency = DEFAULT_CURRENCY;
      bookingToUpdate.offer = offerSnapshot
        ? {
            ...offerSnapshot,
            status: "applied",
            appliedAt: new Date(),
            redeemedAt: null,
          }
        : null;

      await bookingToUpdate.save({ session });

      if (offerEvaluation?.offer && offerSnapshot) {
        await reserveOfferForBooking(
          {
            offer: offerEvaluation.offer,
            userId,
            bookingId: bookingToUpdate._id,
            code: requestedOfferCode,
            pricing: {
              baseAmount,
              discountAmount,
              finalAmount,
            },
            currency: DEFAULT_CURRENCY,
            context: {
              bus: busId,
              routeCode: bus.route?.routeCode || null,
              travelDate: travelDateObj,
              boardingPoint,
              droppingPoint,
              direction,
              passengerCount: passengers.length,
            },
          },
          { session },
        );
      } else {
        await releaseOfferReservation(
          {
            bookingId: bookingToUpdate._id,
            reason: "offer_removed_before_payment",
          },
          { session },
        );
      }

      await session.commitTransaction();

      const populatedBooking = await Booking.findById(bookingToUpdate._id)
        .populate("bus", "busName busNumber operator")
        .populate("user", "fullName email")
        .lean();

      return res.status(200).json({
        success: true,
        message: "Booking updated successfully",
        data: {
          ...populatedBooking,
          sessionId,
        },
      });
    }

    // Generate unique booking ID
    const dateStr = new Date(travelDate)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const bookingId = `BK-${dateStr}-${nanoid()}`;

    // Create booking
    const routeSnapshot = bus.route?.toObject
      ? bus.route.toObject()
      : bus.route;

    const booking = new Booking({
      bookingId,
      user: userId,
      bus: busId,
      route: routeSnapshot,
      travelDate: travelDateObj,
      boardingPoint,
      droppingPoint,
      passengers: normalizedPassengers,
      direction,
      journeyDistance,
      farePerKm: bus.farePerKm,
      farePerPassenger: Number.parseFloat(farePerPassenger.toFixed(2)),
      baseAmount,
      discountAmount,
      finalAmount,
      totalAmount: finalAmount,
      currency: DEFAULT_CURRENCY,
      bookingStatus: "pending",
      paymentStatus: "pending",
      offer: offerSnapshot
        ? {
            ...offerSnapshot,
            status: "applied",
            appliedAt: new Date(),
            redeemedAt: null,
          }
        : null,
      sessionId,
    });

    await booking.save({ session });

    // Update user bookings
    await User.findByIdAndUpdate(
      userId,
      { $push: { bookings: booking._id } },
      { session },
    );

    if (offerEvaluation?.offer && offerSnapshot) {
      await reserveOfferForBooking(
        {
          offer: offerEvaluation.offer,
          userId,
          bookingId: booking._id,
          code: requestedOfferCode,
          pricing: {
            baseAmount,
            discountAmount,
            finalAmount,
          },
          currency: DEFAULT_CURRENCY,
          context: {
            bus: busId,
            routeCode: bus.route?.routeCode || null,
            travelDate: travelDateObj,
            boardingPoint,
            droppingPoint,
            direction,
            passengerCount: passengers.length,
          },
        },
        { session },
      );
    }

    await session.commitTransaction();

    // Populate booking details for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate("bus", "busName busNumber operator")
      .populate("user", "fullName email")
      .lean();

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: {
        ...populatedBooking,
        sessionId, // Include session ID for payment processing
      },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("[createBooking] Booking Error:", error);

    // Handle specific errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.values(error.errors).map((err) => ({
          field: err.path,
          message: err.message,
        })),
        code: "VALIDATION_ERROR",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};
// Release seat locks with enhanced error handling
export const releaseSeatLocks = async (req, res) => {
  try {
    const {
      busId,
      travelDate,
      sessionId,
      seatNumbers,
      direction = "forward",
    } = req.body;
    const userId = req.user._id;
    const normalizedSeats = Array.isArray(seatNumbers)
      ? seatNumbers.map((seat) => normalizeSeatToken(seat))
      : seatNumbers;

    if (!busId || !travelDate || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        code: "MISSING_FIELDS",
      });
    }

    console.log(
      `[releaseSeatLocks] Releasing locks for session ${sessionId}, user ${userId}`,
    );

    const releaseResult = await SeatLockService.releaseLocks({
      busId,
      userId,
      sessionId,
      travelDate,
      direction,
      seatNumbers: normalizedSeats,
    });

    console.log(
      `[releaseSeatLocks] Successfully released locks:`,
      releaseResult,
    );

    res.status(200).json({
      success: true,
      message: "Seat locks released successfully",
      data: releaseResult,
    });
  } catch (error) {
    console.error("[releaseSeatLocks] Release locks error:", error);

    // Don't fail the request if lock release fails
    // This is a cleanup operation and shouldn't block the user
    res.status(200).json({
      success: true,
      message: "Lock release attempted",
      warning:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Cancel booking (production-ready: seat release, refund, offer invalidation)
export const cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    const cancellationTime = new Date();

    // Find booking: support both MongoDB _id and bookingId string (e.g. BK-20260217-07RPE9)
    let booking = null;
    if (mongoose.Types.ObjectId.isValid(id) && String(id).length === 24) {
      booking = await Booking.findById(id).session(session);
    }
    if (!booking) {
      booking = await Booking.findOne({
        bookingId: String(id || "").trim(),
      }).session(session);
    }

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        code: "BOOKING_NOT_FOUND",
      });
    }

    const bookingIdStr = booking._id.toString();

    // Authorization check
    if (
      booking.user.toString() !== userId.toString() &&
      !["admin", "owner"].includes(req.user.role)
    ) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this booking",
        code: "UNAUTHORIZED",
      });
    }

    // Check booking status
    if (booking.bookingStatus === "cancelled") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled",
        code: "ALREADY_CANCELLED",
      });
    }

    if (booking.bookingStatus === "completed") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Completed bookings cannot be cancelled",
        code: "COMPLETED_BOOKING",
      });
    }

    // Check if trip has departed (use departure time, not just travel date)
    const departureTime = calculateDepartureDateTime(booking);
    if (departureTime && departureTime <= cancellationTime) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Cannot cancel after departure",
        code: "PAST_BOOKING",
      });
    }

    // Calculate refund
    const refundAmount = calculateRefund(booking, cancellationTime);

    // Update booking status
    booking.bookingStatus = "cancelled";
    // paymentStatus will be updated after refund attempt
    booking.cancellation = {
      requestedAt: cancellationTime,
      processedAt: new Date(),
      refundAmount,
      reason: reason || "User request",
    };

    // Free up seats in bus
    const bus = await Bus.findById(booking.bus).session(session);
    if (bus) {
      bus.bookedSeats = (bus.bookedSeats || []).filter(
        (bs) =>
          bs.bookingId && bs.bookingId.toString() !== bookingIdStr,
      );
      bus.availableSeats = Math.max(
        0,
        (bus.availableSeats || 0) + booking.passengers.length,
      );
      await bus.save({ session });
    }

    await SeatHold.updateMany(
      { booking: booking._id, status: "BOOKED" },
      { $set: { status: "CANCELLED", expiresAt: new Date() } },
      { session },
    );

    // Invalidate offer redemption (decrement usedCount if redeemed)
    try {
      await invalidateOfferRedemptionOnCancel(
        { bookingId: booking._id, reason: reason || "User Cancellation" },
        { session },
      );
    } catch (offerError) {
      console.error("[cancelBooking] Offer invalidation error:", offerError);
      // Non-fatal: proceed with cancellation
    }

    // Process Refund if applicable
    let refundResult = null;
    let payment = null;

    if (booking.payment) {
      payment = await Payment.findById(booking.payment).session(session);

      if (payment && payment.status === "success" && refundAmount > 0) {
        try {
          // Razorpay refund API requires razorpay_payment_id, NOT order_id.
          // payment.paymentId stores order_id; gatewayResponse.paymentId has razorpay_payment_id.
          const razorpayPaymentId =
            payment.gatewayResponse?.paymentId ||
            payment.gatewayResponse?.razorpay_payment_id ||
            payment.paymentId;

          if (!razorpayPaymentId) {
            throw new Error("Razorpay payment ID not found for refund");
          }

          const { processRefund } = await import("./paymentController.js");
          const razorpayRefund = await processRefund({
            paymentId: razorpayPaymentId,
            amount: refundAmount,
            notes: {
              bookingId: booking.bookingId,
              reason: reason || "User Cancellation",
            },
          });

          refundResult = razorpayRefund;

          // Update Payment Record (pass session for transaction consistency)
          await payment.addRefund(
            refundAmount,
            reason || "User Cancellation",
            razorpayRefund.id,
            session,
          );

          booking.paymentStatus =
            refundAmount >= payment.amount ? "refunded" : "partial-refund";
        } catch (refundError) {
          console.error("Refund Processing Failed:", refundError);
          // Don't fail the cancellation if refund fails.
          // Mark as refund_failed for manual processing.
          booking.paymentStatus = "refund_failed";
          booking.cancellation.refundStatus = "failed";
          booking.cancellation.refundError =
            refundError.message || "Unknown error";
        }
      } else if (
        payment &&
        payment.status === "success" &&
        refundAmount === 0
      ) {
        booking.paymentStatus = "paid"; // No refund applicable (e.g. no-show policy)
      } else if (payment && payment.status !== "success") {
        booking.paymentStatus = payment.status; // Keep original status if not paid
      }
    }

    // Update booking
    await booking.save({ session });

    await session.commitTransaction();

    // Get updated booking
    const updatedBooking = await Booking.findById(booking._id)
      .populate("bus", "busName busNumber")
      .lean();

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      refundAmount,
      data: updatedBooking,
      refundDetails: refundResult,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("[cancelBooking] Cancel Booking Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
      code: "SERVER_ERROR",
    });
  } finally {
    session.endSession();
  }
};

// Calculate refund amount based on cancellation policy (hours before departure)
const calculateRefund = (booking, cancellationTime) => {
  const departureTime = calculateDepartureDateTime(booking);
  const referenceTime = departureTime || new Date(booking.travelDate);
  const hoursBeforeDeparture =
    (referenceTime.getTime() - cancellationTime.getTime()) / 36e5;

  if (hoursBeforeDeparture <= 0) return 0;

  const policy = booking.route?.cancellationPolicy || {};
  const before24h = Number(policy.before24h) || 0;
  const before12h = Number(policy.before12h) || 0;
  const noShow = Number(policy.noShow) || 100;

  let refundPercentage = 0;
  if (hoursBeforeDeparture > 24) {
    refundPercentage = (100 - before24h) / 100;
  } else if (hoursBeforeDeparture > 12) {
    refundPercentage = (100 - before12h) / 100;
  } else {
    refundPercentage = (100 - noShow) / 100;
  }

  return Math.round(Math.max(0, booking.totalAmount * refundPercentage) * 100) / 100;
};

// Change travel Date

export const changeTravelDate = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { newTravelDate } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!newTravelDate) {
      return res.status(400).json({
        success: false,
        message: "New travel date is required",
        code: "MISSING_DATE",
      });
    }

    // Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID format",
        code: "INVALID_ID",
      });
    }

    // Find booking with populated bus
    const booking = await Booking.findById(id)
      .populate("bus", "seatLayout bookedSeats totalSeats fare")
      .session(session);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        code: "BOOKING_NOT_FOUND",
      });
    }

    // Authorization check
    if (
      booking.user.toString() !== userId.toString() &&
      !["admin", "owner"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to modify this booking",
        code: "UNAUTHORIZED",
      });
    }

    // Check booking status
    if (booking.bookingStatus !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "Only confirmed bookings can be modified",
        code: "INVALID_STATUS",
      });
    }

    // Validate new date
    const parsedNewDate = new Date(newTravelDate);
    if (isNaN(parsedNewDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
        code: "INVALID_DATE_FORMAT",
      });
    }

    // Check if date is valid
    if (parsedNewDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: "New travel date cannot be in the past",
        code: "PAST_DATE",
      });
    }

    if (new Date(booking.travelDate).getTime() === parsedNewDate.getTime()) {
      return res.status(400).json({
        success: false,
        message: "New travel date is same as current date",
        code: "SAME_DATE",
      });
    }

    // Get seat identifiers
    const currentSeats = booking.passengers.map((p) => p.seatNumber);
    const bus = booking.bus;

    // Get booked seats for new date
    const bookedSeatsOnNewDate = bus.bookedSeats
      .filter(
        (bs) =>
          bs.travelDate.getTime() === parsedNewDate.getTime() &&
          bs.bookingId.toString() !== id, // Exclude current booking
      )
      .map((bs) => bs.seatNumber);

    const holdConflicts = await SeatHold.find({
      bus: bus._id,
      travelDate: parsedNewDate,
      direction: booking.direction || "forward",
      status: "HOLD",
      expiresAt: { $gt: new Date() },
      seatId: { $in: currentSeats },
    })
      .select("seatId")
      .session(session)
      .lean();

    if (holdConflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Some seats are temporarily held on the new date",
        unavailableSeats: holdConflicts.map((hold) => hold.seatId),
        code: "SEATS_HELD",
      });
    }

    // Check seat availability
    const seatIdSet = bus.getSeatIdSet ? bus.getSeatIdSet() : new Set();
    const unavailableSeats = currentSeats.filter(
      (seat) => bookedSeatsOnNewDate.includes(seat) || !seatIdSet.has(seat),
    );

    if (unavailableSeats.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Some seats are unavailable on the new date",
        unavailableSeats,
        code: "SEATS_UNAVAILABLE",
      });
    }

    // Remove old booking from bus
    bus.bookedSeats = bus.bookedSeats.filter(
      (bs) =>
        bs.bookingId.toString() !== id ||
        bs.travelDate.getTime() !== new Date(booking.travelDate).getTime(),
    );

    // Add new booking to bus
    currentSeats.forEach((seat) => {
      bus.bookedSeats.push({
        seatNumber: seat,
        bookingId: booking._id,
        travelDate: parsedNewDate,
      });
    });

    // Update booking
    booking.travelDate = parsedNewDate;
    booking.updatedAt = new Date();

    await SeatHold.updateMany(
      { booking: booking._id, status: "BOOKED" },
      {
        $set: {
          travelDate: parsedNewDate,
          tripKey: buildTripKey(
            bus._id.toString(),
            parsedNewDate,
            booking.direction || "forward",
          ),
        },
      },
      { session },
    );

    // Save changes
    await bus.save({ session });
    await booking.save({ session });
    await session.commitTransaction();

    // Get updated booking
    const updatedBooking = await Booking.findById(id)
      .populate("bus", "busName busNumber")
      .lean();

    res.json({
      success: true,
      message: "Travel date changed successfully",
      data: updatedBooking,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Change Travel Date Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  } finally {
    session.endSession();
  }
};

// Controller for Get My Bookings
export const getMyBookings = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 10,
      status,
      tab = "all",
      sort,
      fromDate,
      toDate,
      search,
    } = req.query;

    const pageInt = Number.parseInt(String(page), 10);
    const limitInt = Number.parseInt(String(limit), 10);

    if (!Number.isInteger(pageInt) || pageInt < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid page number",
        code: "INVALID_PAGE",
      });
    }

    if (!Number.isInteger(limitInt) || limitInt < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid limit value",
        code: "INVALID_LIMIT",
      });
    }

    if (limitInt > 50) {
      return res.status(400).json({
        success: false,
        message: "Maximum limit is 50",
        code: "MAX_LIMIT_EXCEEDED",
      });
    }

    const normalizedStatus =
      typeof status === "string" ? status.trim().toLowerCase() : "";
    if (normalizedStatus && !BOOKING_STATUS_SET.has(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status",
        code: "INVALID_STATUS",
      });
    }

    const normalizedTab =
      typeof tab === "string" ? tab.trim().toLowerCase() : "all";
    if (!BOOKING_TAB_SET.has(normalizedTab)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking tab",
        code: "INVALID_TAB",
      });
    }

    const from = fromDate ? parseDateQuery(fromDate) : null;
    const to = toDate ? parseDateQuery(toDate, { endOfDay: true }) : null;
    if (fromDate && !from) {
      return res.status(400).json({
        success: false,
        message: "Invalid fromDate format",
        code: "INVALID_DATE",
      });
    }
    if (toDate && !to) {
      return res.status(400).json({
        success: false,
        message: "Invalid toDate format",
        code: "INVALID_DATE",
      });
    }
    if (from && to && from.getTime() > to.getTime()) {
      return res.status(400).json({
        success: false,
        message: "fromDate must be before toDate",
        code: "INVALID_DATE_RANGE",
      });
    }

    const dateFilter = {};
    if (from) {
      dateFilter.$gte = from;
    }
    if (to) {
      dateFilter.$lte = to;
    }

    const todayStart = getStartOfToday();
    const listConditions = [
      { user: userId },
      { paymentStatus: { $ne: "pending" } },
    ];

    if (Object.keys(dateFilter).length > 0) {
      listConditions.push({ travelDate: dateFilter });
    }

    const safeSearch =
      typeof search === "string"
        ? search.trim().slice(0, SEARCH_MAX_LENGTH)
        : "";
    if (safeSearch) {
      const searchRegex = new RegExp(escapeRegex(safeSearch), "i");
      listConditions.push({
        $or: [
          { bookingId: searchRegex },
          { boardingPoint: searchRegex },
          { droppingPoint: searchRegex },
          { "route.origin": searchRegex },
          { "route.destination": searchRegex },
          { "route.routeCode": searchRegex },
        ],
      });
    }

    if (normalizedStatus) {
      listConditions.push({ bookingStatus: normalizedStatus });
    } else {
      const tabCondition = buildTabCondition(normalizedTab, todayStart);
      if (Object.keys(tabCondition).length > 0) {
        listConditions.push(tabCondition);
      }
    }

    const query =
      listConditions.length === 1
        ? listConditions[0]
        : { $and: listConditions };

    const defaultSort =
      normalizedTab === "upcoming" ? "travelDate" : "-travelDate";
    const sortObject = buildSortObject(sort, defaultSort);
    const now = new Date();

    // We need to fetch more items if we are filtering in memory to ensure pagenation works reasonably well
    // However, purely in-memory pagination after db limit is tricky.
    // For now, we will fetch `limit * 2` to have some buffer, but strictly correct pagination
    // with this hybrid approach requires either aggressive fetching or storing "completed" status in DB.
    // Given the constraints, we will process the fetched items.

    const summaryBase =
      Object.keys(dateFilter).length > 0
        ? {
            $and: [
              { user: userId },
              { paymentStatus: { $ne: "pending" } },
              { travelDate: dateFilter },
            ],
          }
        : { $and: [{ user: userId }, { paymentStatus: { $ne: "pending" } }] };

    const [
      bookings,
      totalCount,
      dbUpcomingCount,
      cancelledCount,
      dbCompletedCount,
      todaysBookings,
    ] = await Promise.all([
      Booking.find(query)
        .sort(sortObject)
        .skip((pageInt - 1) * limitInt)
        .limit(limitInt * 2) // Fetch extra to handle in-memory filter gaps
        .populate({
          path: "bus",
          select:
            "busId busName busNumber operator departureTime arrivalTime fare amenities features",
        })
        .lean(),
      Booking.countDocuments(summaryBase),
      Booking.countDocuments(
        appendAndCondition(
          summaryBase,
          buildTabCondition("upcoming", todayStart),
        ),
      ),
      Booking.countDocuments(
        appendAndCondition(
          summaryBase,
          buildTabCondition("cancelled", todayStart),
        ),
      ),
      Booking.countDocuments(
        appendAndCondition(
          summaryBase,
          buildTabCondition("completed", todayStart),
        ),
      ),
      // Fetch today's bookings to correctly adjust counts
      Booking.find({
        user: userId,
        paymentStatus: { $ne: "pending" },
        bookingStatus: { $in: ["confirmed", "pending"] },
        travelDate: {
          $gte: todayStart,
          $lt: new Date(new Date(todayStart).setDate(todayStart.getDate() + 1)),
        },
      })
        .populate({
          path: "bus",
          select: "route",
        })
        .lean(),
    ]);

    // Calculate accurate counts for today
    let todayUpcoming = 0;
    let todayCompleted = 0;

    todaysBookings.forEach((booking) => {
      const bucket = getBookingLifecycleBucket(booking, now);
      if (bucket === "completed") {
        todayCompleted++;
      } else {
        todayUpcoming++;
      }
    });

    const realUpcomingCount = Math.max(0, dbUpcomingCount - todayCompleted);
    const realCompletedCount = Math.max(0, dbCompletedCount - todayUpcoming);

    // Process items to assign correct buckets
    const processedBookings = bookings.map((b) =>
      formatBookingListItem(b, now),
    );

    // Filter based on tab
    let filteredBookings = processedBookings;
    if (normalizedTab === "upcoming") {
      filteredBookings = processedBookings.filter(
        (b) => b.lifecycleBucket === "upcoming",
      );
    } else if (normalizedTab === "completed") {
      filteredBookings = processedBookings.filter(
        (b) => b.lifecycleBucket === "completed",
      );
    }

    // Apply limit after filtering
    const finalBookings = filteredBookings.slice(0, limitInt);

    let effectiveTotal = totalCount;
    if (normalizedTab === "upcoming") effectiveTotal = realUpcomingCount;
    if (normalizedTab === "completed") effectiveTotal = realCompletedCount;
    if (normalizedTab === "cancelled") effectiveTotal = cancelledCount;

    const totalPages = Math.max(1, Math.ceil(effectiveTotal / limitInt));
    const hasNext = pageInt < totalPages;

    res.json({
      success: true,
      page: pageInt,
      limit: limitInt,
      total: effectiveTotal,
      totalPages,
      hasNext,
      filters: {
        tab: normalizedTab,
        status: normalizedStatus || null,
        search: safeSearch || null,
        fromDate: from || null,
        toDate: to || null,
      },
      summary: {
        total: totalCount,
        upcoming: realUpcomingCount,
        cancelled: cancelledCount,
        completed: realCompletedCount,
      },
      data: finalBookings,
    });
  } catch (error) {
    console.error("Get Bookings Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

export const getMyBookingByRef = async (req, res) => {
  try {
    const userId = req.user._id;
    const bookingRef = String(req.params.bookingRef || "").trim();

    if (!bookingRef) {
      return res.status(400).json({
        success: false,
        message: "Booking reference is required",
        code: "MISSING_BOOKING_REF",
      });
    }

    const refQuery = [
      { bookingId: new RegExp(`^${escapeRegex(bookingRef)}$`, "i") },
    ];
    if (mongoose.Types.ObjectId.isValid(bookingRef)) {
      refQuery.push({ _id: bookingRef });
    }

    const booking = await Booking.findOne({
      user: userId,
      paymentStatus: { $ne: "pending" },
      $or: refQuery,
    })
      .populate({
        path: "bus",
        select:
          "busName busNumber operator departureTime arrivalTime farePerKm amenities features",
      })
      .populate({
        path: "payment",
        select:
          "paymentId amount currency method status createdAt updatedAt gatewayResponse",
      })
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        code: "BOOKING_NOT_FOUND",
      });
    }

    res.status(200).json({
      success: true,
      data: formatBookingDetail(booking, new Date()),
    });
  } catch (error) {
    console.error("Get Booking Detail Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

export const getJourneyTrackingData = async (req, res) => {
  try {
    const userId = req.user._id;
    const bookingRef = String(req.params.bookingRef || "").trim();

    if (!bookingRef) {
      return res.status(400).json({
        success: false,
        message: "Booking reference is required",
        code: "MISSING_BOOKING_REF",
      });
    }

    const refQuery = [
      { bookingId: new RegExp(`^${escapeRegex(bookingRef)}$`, "i") },
    ];
    if (mongoose.Types.ObjectId.isValid(bookingRef)) {
      refQuery.push({ _id: bookingRef });
    }

    const booking = await Booking.findOne({
      user: userId,
      paymentStatus: { $ne: "pending" },
      $or: refQuery,
    })
      .populate({
        path: "bus",
        select: "busName busNumber busId operator route features",
      })
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        code: "BOOKING_NOT_FOUND",
      });
    }

    if (
      booking.bookingStatus === "cancelled" ||
      booking.paymentStatus !== "paid"
    ) {
      return res.status(400).json({
        success: false,
        message: "Journey tracking is not available for this booking",
        code: "TRACKING_UNAVAILABLE",
      });
    }

    const bus = booking.bus;
    if (!bus || !bus.route || !Array.isArray(bus.route.stops)) {
      return res.status(404).json({
        success: false,
        message: "Bus route information not available",
        code: "ROUTE_NOT_FOUND",
      });
    }

    const direction = booking.direction || "forward";
    const journey = getJourneySnapshot(booking);

    const routeStops = bus.route.stops.map((stop) => {
      const trip = direction === "return" ? stop.downTrip : stop.upTrip;
      return {
        city: stop.city || null,
        stopCode: stop.stopCode || null,
        lat: stop.location?.lat ?? null,
        lng: stop.location?.lng ?? null,
        arrivalTime: trip?.arrivalTime || null,
        departureTime: trip?.departureTime || null,
        distanceFromOrigin: trip?.distanceFromOrigin ?? null,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        bookingId: booking.bookingId,
        busNumber: bus.busNumber,
        busName: bus.busName,
        busId: bus.busId,
        operator: bus.operator,
        features: bus.features || null,
        direction,
        boardingPoint: booking.boardingPoint,
        droppingPoint: booking.droppingPoint,
        travelDate: booking.travelDate,
        departureTime: journey.departureTime,
        arrivalTime: journey.arrivalTime,
        segmentDurationMinutes: journey.segmentDurationMinutes,
        routeOrigin: bus.route.origin || null,
        routeDestination: bus.route.destination || null,
        routeDistance: bus.route.distance ?? null,
        routeStops,
      },
    });
  } catch (error) {
    console.error("Get Journey Tracking Data Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

export const downloadMyBookingInvoice = async (req, res) => {
  try {
    const userId = req.user._id;
    const refQuery = parseBookingRefOrThrow(req.params.bookingRef);

    const booking = await Booking.findOne({
      user: userId,
      $or: refQuery,
    })
      .populate({
        path: "bus",
        select: "busName busNumber operator",
      })
      .populate({
        path: "user",
        select: "fullName email phone",
      })
      .populate({
        path: "payment",
        select:
          "paymentId amount currency method status createdAt updatedAt gatewayResponse",
      })
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        code: "BOOKING_NOT_FOUND",
      });
    }

    const paymentSnapshot = extractPaymentSnapshot(booking?.payment);
    if (!isInvoicePaymentSettled(booking, paymentSnapshot)) {
      return res.status(409).json({
        success: false,
        message: "Invoice is available only after successful payment.",
        code: "INVOICE_NOT_AVAILABLE",
      });
    }

    const invoicePayload = buildInvoicePayloadFromBooking(
      booking,
      paymentSnapshot,
    );
    const pdfBuffer = generateInvoicePdfBuffer(invoicePayload);
    const invoiceRef = getInvoiceBookingRef(booking) || Date.now();
    const filename = sanitizeFilename(
      `${INVOICE_FILE_PREFIX}-${invoiceRef}.pdf`,
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    if (error?.code === "MISSING_BOOKING_REF") {
      return res.status(400).json({
        success: false,
        message: "Booking reference is required",
        code: "MISSING_BOOKING_REF",
      });
    }

    console.error("Download Invoice Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to generate invoice",
      code: "INVOICE_ERROR",
    });
  }
};

export const getAdminBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      tab = "all",
      status,
      paymentStatus,
      sort,
      fromDate,
      toDate,
      search,
      userId,
      busId,
      direction,
    } = req.query;

    const pageInt = Number.parseInt(String(page), 10);
    const limitInt = Number.parseInt(String(limit), 10);

    if (!Number.isInteger(pageInt) || pageInt < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid page number",
        code: "INVALID_PAGE",
      });
    }

    if (!Number.isInteger(limitInt) || limitInt < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid limit value",
        code: "INVALID_LIMIT",
      });
    }

    if (limitInt > MAX_ADMIN_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `Maximum limit is ${MAX_ADMIN_LIMIT}`,
        code: "MAX_LIMIT_EXCEEDED",
      });
    }

    const normalizedTab = normalizeBookingStatusToken(tab, "all");
    if (!BOOKING_TAB_SET.has(normalizedTab)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking tab",
        code: "INVALID_TAB",
      });
    }

    const normalizedStatus = normalizeBookingStatusToken(status, "");
    if (normalizedStatus && !BOOKING_STATUS_SET.has(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status",
        code: "INVALID_STATUS",
      });
    }

    const normalizedPaymentStatus = normalizeBookingStatusToken(
      paymentStatus,
      "",
    );
    if (
      normalizedPaymentStatus &&
      !ADMIN_PAYMENT_STATUS_SET.has(normalizedPaymentStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
        code: "INVALID_PAYMENT_STATUS",
      });
    }

    const normalizedDirection = normalizeBookingStatusToken(direction, "");
    if (
      normalizedDirection &&
      !["forward", "return"].includes(normalizedDirection)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid direction",
        code: "INVALID_DIRECTION",
      });
    }

    const from = fromDate ? parseDateQuery(fromDate) : null;
    const to = toDate ? parseDateQuery(toDate, { endOfDay: true }) : null;
    if (fromDate && !from) {
      return res.status(400).json({
        success: false,
        message: "Invalid fromDate format",
        code: "INVALID_DATE",
      });
    }
    if (toDate && !to) {
      return res.status(400).json({
        success: false,
        message: "Invalid toDate format",
        code: "INVALID_DATE",
      });
    }
    if (from && to && from.getTime() > to.getTime()) {
      return res.status(400).json({
        success: false,
        message: "fromDate must be before toDate",
        code: "INVALID_DATE_RANGE",
      });
    }

    const scopeConditions = [];
    const dateFilter = {};
    if (from) dateFilter.$gte = from;
    if (to) dateFilter.$lte = to;
    if (Object.keys(dateFilter).length > 0) {
      scopeConditions.push({ travelDate: dateFilter });
    }

    if (normalizedPaymentStatus) {
      scopeConditions.push({ paymentStatus: normalizedPaymentStatus });
    }

    if (normalizedDirection) {
      scopeConditions.push({ direction: normalizedDirection });
    }

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(String(userId))) {
        return res.status(400).json({
          success: false,
          message: "Invalid userId",
          code: "INVALID_USER_ID",
        });
      }
      scopeConditions.push({ user: userId });
    }

    if (busId) {
      if (!mongoose.Types.ObjectId.isValid(String(busId))) {
        return res.status(400).json({
          success: false,
          message: "Invalid busId",
          code: "INVALID_BUS_ID",
        });
      }
      scopeConditions.push({ bus: busId });
    }

    const safeSearch =
      typeof search === "string"
        ? search.trim().slice(0, SEARCH_MAX_LENGTH)
        : "";
    if (safeSearch) {
      const searchRegex = new RegExp(escapeRegex(safeSearch), "i");
      scopeConditions.push({
        $or: [
          { bookingId: searchRegex },
          { boardingPoint: searchRegex },
          { droppingPoint: searchRegex },
          { "route.origin": searchRegex },
          { "route.destination": searchRegex },
          { "route.routeCode": searchRegex },
          { "passengers.name": searchRegex },
          { "passengers.mobileNumber": searchRegex },
          { sessionId: searchRegex },
        ],
      });
    }

    const todayStart = getStartOfToday();
    const listConditions = [...scopeConditions];
    if (normalizedStatus) {
      listConditions.push({ bookingStatus: normalizedStatus });
    } else {
      const tabCondition = buildTabCondition(normalizedTab, todayStart);
      if (Object.keys(tabCondition).length > 0) {
        listConditions.push(tabCondition);
      }
    }

    const scopedQuery =
      scopeConditions.length === 0 ? {} : { $and: scopeConditions };
    const listQuery =
      listConditions.length === 0 ? {} : { $and: listConditions };

    const defaultSort =
      normalizedTab === "upcoming" ? "travelDate" : "-travelDate";
    const sortObject = buildSortObject(sort, defaultSort);
    const now = new Date();

    const [
      bookings,
      total,
      totalCount,
      upcomingCount,
      cancelledCount,
      completedCount,
    ] = await Promise.all([
      Booking.find(listQuery)
        .sort(sortObject)
        .skip((pageInt - 1) * limitInt)
        .limit(limitInt)
        .populate({
          path: "bus",
          select:
            "busId busName busNumber operator departureTime arrivalTime farePerKm amenities features",
        })
        .populate({
          path: "user",
          select: "fullName email phone role",
        })
        .lean(),
      Booking.countDocuments(listQuery),
      Booking.countDocuments(scopedQuery),
      Booking.countDocuments(
        appendAndCondition(
          scopedQuery,
          buildTabCondition("upcoming", todayStart),
        ),
      ),
      Booking.countDocuments(
        appendAndCondition(
          scopedQuery,
          buildTabCondition("cancelled", todayStart),
        ),
      ),
      Booking.countDocuments(
        appendAndCondition(
          scopedQuery,
          buildTabCondition("completed", todayStart),
        ),
      ),
    ]);

    const totalPages = Math.ceil(total / limitInt);
    const hasNext = pageInt < totalPages;
    const hasPrevious = pageInt > 1;

    res.status(200).json({
      success: true,
      page: pageInt,
      limit: limitInt,
      total,
      totalPages,
      hasNext,
      hasPrevious,
      filters: {
        tab: normalizedTab,
        status: normalizedStatus || null,
        paymentStatus: normalizedPaymentStatus || null,
        search: safeSearch || null,
        fromDate: from || null,
        toDate: to || null,
        userId: userId || null,
        busId: busId || null,
        direction: normalizedDirection || null,
      },
      summary: {
        total: totalCount,
        upcoming: upcomingCount,
        cancelled: cancelledCount,
        completed: completedCount,
      },
      data: bookings.map((booking) => formatAdminBookingListItem(booking, now)),
    });
  } catch (error) {
    console.error("Admin Get Bookings Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

export const getAdminBookingByRef = async (req, res) => {
  try {
    const booking = await findBookingByRefForAdmin(req.params.bookingRef);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        code: "BOOKING_NOT_FOUND",
      });
    }

    return res.status(200).json({
      success: true,
      data: formatAdminBookingDetail(booking, new Date()),
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    const code = error?.code || "SERVER_ERROR";
    console.error("Admin Get Booking Detail Error:", error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Internal server error" : error.message,
      code,
    });
  }
};

export const createAdminBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const {
      userId,
      busId,
      travelDate,
      passengers,
      boardingPoint,
      droppingPoint,
      direction = "forward",
      bookingStatus = "pending",
      paymentStatus = "pending",
      currency = DEFAULT_CURRENCY,
      paymentMethod = "wallet",
      cancellationReason,
    } = req.body;

    if (
      !userId ||
      !busId ||
      !travelDate ||
      !Array.isArray(passengers) ||
      passengers.length === 0 ||
      !boardingPoint ||
      !droppingPoint
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        code: "MISSING_FIELDS",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
        code: "INVALID_USER_ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(String(busId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid busId",
        code: "INVALID_BUS_ID",
      });
    }

    const normalizedDirection = normalizeBookingStatusToken(
      direction,
      "forward",
    );
    if (!["forward", "return"].includes(normalizedDirection)) {
      return res.status(400).json({
        success: false,
        message: "Invalid direction",
        code: "INVALID_DIRECTION",
      });
    }

    const parsedTravelDate = validateTravelDateValue(travelDate);
    if (!parsedTravelDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid travel date",
        code: "INVALID_DATE",
      });
    }

    let normalizedBookingStatus = normalizeBookingStatusToken(
      bookingStatus,
      "pending",
    );
    let normalizedPaymentStatus = normalizeBookingStatusToken(
      paymentStatus,
      "pending",
    );

    if (!ADMIN_CREATE_BOOKING_STATUS_SET.has(normalizedBookingStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status",
        code: "INVALID_STATUS",
      });
    }

    if (!ADMIN_PAYMENT_STATUS_SET.has(normalizedPaymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
        code: "INVALID_PAYMENT_STATUS",
      });
    }

    if (
      ["refunded", "partial-refund"].includes(normalizedPaymentStatus) &&
      normalizedBookingStatus !== "cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Refunded payment status is allowed only for cancelled bookings",
        code: "INVALID_PAYMENT_STATUS",
      });
    }

    if (
      ["confirmed", "completed"].includes(normalizedBookingStatus) &&
      normalizedPaymentStatus !== "paid"
    ) {
      return res.status(400).json({
        success: false,
        message: "Confirmed/completed bookings must be paid",
        code: "INVALID_STATUS_TRANSITION",
      });
    }

    if (
      normalizedPaymentStatus === "paid" &&
      normalizedBookingStatus === "pending"
    ) {
      normalizedBookingStatus = "confirmed";
    }

    if (
      normalizedBookingStatus === "cancelled" &&
      normalizedPaymentStatus === "paid"
    ) {
      normalizedPaymentStatus = "refunded";
    }

    const sanitizedPassengers = passengers.map((passenger) => ({
      name: String(passenger?.name || "").trim(),
      age: Number(passenger?.age),
      gender: normalizeBookingStatusToken(passenger?.gender, "male"),
      seatNumber: normalizeSeatToken(passenger?.seatNumber),
      mobileNumber: String(passenger?.mobileNumber || "").trim(),
      identification: passenger?.identification
        ? {
            type: normalizeBookingStatusToken(
              passenger.identification.type,
              "aadhar",
            ),
            number: String(passenger.identification.number || "").trim(),
          }
        : undefined,
    }));

    const hasInvalidPassenger = sanitizedPassengers.some(
      (passenger) =>
        passenger.name.length < 2 ||
        !Number.isInteger(passenger.age) ||
        passenger.age < 1 ||
        passenger.age > 120 ||
        !["male", "female", "other"].includes(passenger.gender) ||
        !/^[6-9]\d{9}$/.test(passenger.mobileNumber) ||
        !passenger.seatNumber,
    );

    if (hasInvalidPassenger) {
      return res.status(400).json({
        success: false,
        message: "Invalid passenger details",
        code: "INVALID_PASSENGERS",
      });
    }

    session.startTransaction();

    const [user, bus] = await Promise.all([
      User.findById(userId).session(session),
      Bus.findById(busId).session(session),
    ]);

    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    if (!bus) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Bus not found",
        code: "BUS_NOT_FOUND",
      });
    }

    const seatInputs = sanitizedPassengers.map(
      (passenger) => passenger.seatNumber,
    );
    const { resolved: seatIds, unknown } = resolveSeatIdsForInputs(
      bus,
      seatInputs,
    );
    if (unknown.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Invalid seat identifiers: ${unknown.join(", ")}`,
        code: "INVALID_SEATS",
      });
    }

    if (new Set(seatIds).size !== seatIds.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Duplicate seats are not allowed",
        code: "DUPLICATE_SEATS",
      });
    }

    const normalizedPassengers = sanitizedPassengers.map(
      (passenger, index) => ({
        ...passenger,
        seatNumber: seatIds[index],
      }),
    );

    const fareSnapshot = resolveRouteAndFareSnapshot({
      bus,
      boardingPoint,
      droppingPoint,
      direction: normalizedDirection,
      passengerCount: normalizedPassengers.length,
    });

    const shouldReserveSeats = requiresSeatReservation(
      normalizedBookingStatus,
      normalizedPaymentStatus,
    );

    if (shouldReserveSeats) {
      const requestedDateKey = formatDateKey(parsedTravelDate);
      const conflictingSeats = (bus.bookedSeats || [])
        .filter(
          (seat) =>
            formatDateKey(seat.travelDate) === requestedDateKey &&
            seat.direction === normalizedDirection &&
            seatIds.includes(seat.seatNumber),
        )
        .map((seat) => seat.seatNumber);

      if (conflictingSeats.length > 0) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: `Seats ${conflictingSeats.join(", ")} are already booked`,
          code: "SEATS_UNAVAILABLE",
        });
      }

      if ((bus.availableSeats || 0) < seatIds.length) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "Not enough available seats on this bus",
          code: "SEATS_UNAVAILABLE",
        });
      }
    }

    const bookingDateToken = parsedTravelDate
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const bookingId = `BK-${bookingDateToken}-${nanoid()}`;
    const adminSessionId = `admin_${Date.now()}_${nanoid()}`;

    const booking = new Booking({
      bookingId,
      user: user._id,
      bus: bus._id,
      route: fareSnapshot.routeSnapshot,
      travelDate: parsedTravelDate,
      direction: normalizedDirection,
      boardingPoint,
      droppingPoint,
      passengers: normalizedPassengers,
      journeyDistance: fareSnapshot.journeyDistance,
      farePerKm: bus.farePerKm,
      farePerPassenger: fareSnapshot.farePerPassenger,
      baseAmount: fareSnapshot.totalAmount,
      discountAmount: 0,
      finalAmount: fareSnapshot.totalAmount,
      totalAmount: fareSnapshot.totalAmount,
      currency,
      bookingStatus: normalizedBookingStatus,
      paymentStatus: normalizedPaymentStatus,
      offer: null,
      sessionId: adminSessionId,
      cancellation:
        normalizedBookingStatus === "cancelled"
          ? {
              requestedAt: new Date(),
              processedAt: new Date(),
              refundAmount:
                normalizedPaymentStatus === "refunded"
                  ? fareSnapshot.totalAmount
                  : 0,
              reason:
                cancellationReason || "Cancelled by admin during creation",
            }
          : undefined,
    });

    await booking.save({ session });
    await User.findByIdAndUpdate(
      user._id,
      { $addToSet: { bookings: booking._id } },
      { session },
    );

    if (shouldReserveSeats) {
      bus.bookedSeats.push(
        ...buildSeatEntries({
          seatIds,
          bookingId: booking._id,
          travelDateObj: parsedTravelDate,
          direction: normalizedDirection,
          boardingPoint,
          droppingPoint,
          segmentStartKm: fareSnapshot.segmentStartKm,
          segmentEndKm: fareSnapshot.segmentEndKm,
        }),
      );
      bus.availableSeats -= seatIds.length;
      await bus.save({ session });
    }

    if (normalizedPaymentStatus === "paid") {
      const payment = new Payment({
        paymentId: buildOfflinePaymentId(),
        booking: booking._id,
        user: user._id,
        amount: booking.totalAmount,
        currency: booking.currency || DEFAULT_CURRENCY,
        method: paymentMethod,
        status: "success",
        gatewayResponse: {
          mode: "admin-manual",
          createdBy: req.user?._id?.toString() || null,
          createdAt: new Date().toISOString(),
        },
      });
      await payment.save({ session });
      booking.payment = payment._id;
      await booking.save({ session });
    }

    await session.commitTransaction();

    const createdBooking = await findBookingByRefForAdmin(booking.bookingId);
    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: createdBooking
        ? formatAdminBookingDetail(createdBooking, new Date())
        : null,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Admin Create Booking Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create booking",
      code: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

export const updateAdminBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const updates = req.body || {};
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No update fields provided",
        code: "NO_UPDATES",
      });
    }

    session.startTransaction();

    const booking = await findBookingByRefForAdmin(
      req.params.bookingRef,
      session,
    );
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        code: "BOOKING_NOT_FOUND",
      });
    }

    const bus = await Bus.findById(booking.bus?._id || booking.bus).session(
      session,
    );
    if (!bus) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Bus not found",
        code: "BUS_NOT_FOUND",
      });
    }

    let nextBookingStatus = normalizeBookingStatusToken(
      updates.bookingStatus,
      booking.bookingStatus,
    );
    let nextPaymentStatus = normalizeBookingStatusToken(
      updates.paymentStatus,
      booking.paymentStatus,
    );

    if (!BOOKING_STATUS_SET.has(nextBookingStatus)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid booking status",
        code: "INVALID_STATUS",
      });
    }

    if (!ADMIN_PAYMENT_STATUS_SET.has(nextPaymentStatus)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
        code: "INVALID_PAYMENT_STATUS",
      });
    }

    if (
      booking.bookingStatus === "cancelled" &&
      nextBookingStatus !== "cancelled"
    ) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "Cancelled bookings cannot be reactivated",
        code: "INVALID_STATUS_TRANSITION",
      });
    }

    const nextTravelDate = updates.travelDate
      ? validateTravelDateValue(updates.travelDate)
      : new Date(booking.travelDate);
    if (!nextTravelDate) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid travel date",
        code: "INVALID_DATE",
      });
    }

    const nextBoardingPoint = updates.boardingPoint || booking.boardingPoint;
    const nextDroppingPoint = updates.droppingPoint || booking.droppingPoint;

    let nextPassengers = Array.isArray(booking.passengers)
      ? booking.passengers.map((passenger) => ({
          ...passenger,
          seatNumber: normalizeSeatToken(passenger?.seatNumber),
        }))
      : [];

    if (Array.isArray(updates.passengers) && updates.passengers.length > 0) {
      nextPassengers = updates.passengers.map((passenger) => ({
        name: String(passenger?.name || "").trim(),
        age: Number(passenger?.age),
        gender: normalizeBookingStatusToken(passenger?.gender, "male"),
        seatNumber: normalizeSeatToken(passenger?.seatNumber),
        mobileNumber: String(passenger?.mobileNumber || "").trim(),
        identification: passenger?.identification
          ? {
              type: normalizeBookingStatusToken(
                passenger.identification.type,
                "aadhar",
              ),
              number: String(passenger.identification.number || "").trim(),
            }
          : undefined,
      }));
    }

    if (!Array.isArray(nextPassengers) || nextPassengers.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "At least one passenger is required",
        code: "INVALID_PASSENGERS",
      });
    }

    const hasInvalidPassenger = nextPassengers.some(
      (passenger) =>
        !passenger.name ||
        passenger.name.length < 2 ||
        !Number.isInteger(Number(passenger.age)) ||
        Number(passenger.age) < 1 ||
        Number(passenger.age) > 120 ||
        !["male", "female", "other"].includes(
          normalizeBookingStatusToken(passenger.gender, "male"),
        ) ||
        !/^[6-9]\d{9}$/.test(String(passenger.mobileNumber || "").trim()) ||
        !passenger.seatNumber,
    );

    if (hasInvalidPassenger) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid passenger details",
        code: "INVALID_PASSENGERS",
      });
    }

    const seatInputs = nextPassengers.map((passenger) => passenger.seatNumber);
    const { resolved: nextSeatIds, unknown } = resolveSeatIdsForInputs(
      bus,
      seatInputs,
    );
    if (unknown.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Invalid seat identifiers: ${unknown.join(", ")}`,
        code: "INVALID_SEATS",
      });
    }

    if (new Set(nextSeatIds).size !== nextSeatIds.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Duplicate seats are not allowed",
        code: "DUPLICATE_SEATS",
      });
    }

    nextPassengers = nextPassengers.map((passenger, index) => ({
      ...passenger,
      seatNumber: nextSeatIds[index],
    }));

    if (
      ["refunded", "partial-refund"].includes(nextPaymentStatus) &&
      nextBookingStatus !== "cancelled"
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message:
          "Refunded payment status is allowed only for cancelled bookings",
        code: "INVALID_PAYMENT_STATUS",
      });
    }

    if (
      ["confirmed", "completed"].includes(nextBookingStatus) &&
      nextPaymentStatus !== "paid"
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Confirmed/completed bookings must be paid",
        code: "INVALID_STATUS_TRANSITION",
      });
    }

    if (nextPaymentStatus === "paid" && nextBookingStatus === "pending") {
      nextBookingStatus = "confirmed";
    }

    if (nextBookingStatus === "cancelled" && nextPaymentStatus === "paid") {
      nextPaymentStatus = "refunded";
    }

    const fareSnapshot = resolveRouteAndFareSnapshot({
      bus,
      boardingPoint: nextBoardingPoint,
      droppingPoint: nextDroppingPoint,
      direction: booking.direction || "forward",
      passengerCount: nextPassengers.length,
    });

    const previousSeatIds = Array.isArray(booking.passengers)
      ? booking.passengers
          .map((passenger) => normalizeSeatToken(passenger?.seatNumber))
          .filter(Boolean)
      : [];

    const currentlyReserved = requiresSeatReservation(
      booking.bookingStatus,
      booking.paymentStatus,
    );
    const shouldReserve = requiresSeatReservation(
      nextBookingStatus,
      nextPaymentStatus,
    );

    if (currentlyReserved) {
      bus.bookedSeats = (bus.bookedSeats || []).filter(
        (seat) => seat.bookingId?.toString() !== booking._id.toString(),
      );
      bus.availableSeats += previousSeatIds.length;
    }

    if (shouldReserve) {
      const requestedDateKey = formatDateKey(nextTravelDate);
      const conflictingSeats = (bus.bookedSeats || [])
        .filter(
          (seat) =>
            formatDateKey(seat.travelDate) === requestedDateKey &&
            seat.direction === (booking.direction || "forward") &&
            nextSeatIds.includes(seat.seatNumber),
        )
        .map((seat) => seat.seatNumber);

      if (conflictingSeats.length > 0) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: `Seats ${conflictingSeats.join(", ")} are already booked`,
          code: "SEATS_UNAVAILABLE",
        });
      }

      if ((bus.availableSeats || 0) < nextSeatIds.length) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "Not enough available seats on this bus",
          code: "SEATS_UNAVAILABLE",
        });
      }

      bus.bookedSeats.push(
        ...buildSeatEntries({
          seatIds: nextSeatIds,
          bookingId: booking._id,
          travelDateObj: nextTravelDate,
          direction: booking.direction || "forward",
          bookingDate: new Date(),
          boardingPoint: nextBoardingPoint,
          droppingPoint: nextDroppingPoint,
          segmentStartKm: fareSnapshot.segmentStartKm,
          segmentEndKm: fareSnapshot.segmentEndKm,
        }),
      );
      bus.availableSeats -= nextSeatIds.length;
    }

    await SeatHold.deleteMany({ booking: booking._id }).session(session);

    booking.travelDate = nextTravelDate;
    booking.boardingPoint = nextBoardingPoint;
    booking.droppingPoint = nextDroppingPoint;
    booking.passengers = nextPassengers;
    booking.route = fareSnapshot.routeSnapshot;
    booking.journeyDistance = fareSnapshot.journeyDistance;
    booking.farePerKm = bus.farePerKm;
    booking.farePerPassenger = fareSnapshot.farePerPassenger;
    booking.baseAmount = fareSnapshot.totalAmount;
    booking.discountAmount = 0;
    booking.finalAmount = fareSnapshot.totalAmount;
    booking.totalAmount = fareSnapshot.totalAmount;
    booking.offer = null;
    booking.bookingStatus = nextBookingStatus;
    booking.paymentStatus = nextPaymentStatus;
    if (nextBookingStatus === "cancelled") {
      booking.cancellation = {
        requestedAt: booking.cancellation?.requestedAt || new Date(),
        processedAt: new Date(),
        refundAmount:
          nextPaymentStatus === "refunded"
            ? booking.totalAmount
            : booking.cancellation?.refundAmount || 0,
        reason:
          updates.cancellationReason ||
          booking.cancellation?.reason ||
          "Cancelled by admin",
      };
    }

    let payment = booking.payment
      ? await Payment.findById(booking.payment).session(session)
      : null;

    if (nextPaymentStatus === "paid") {
      if (!payment) {
        payment = new Payment({
          paymentId: buildOfflinePaymentId(),
          booking: booking._id,
          user: booking.user?._id || booking.user,
          amount: booking.totalAmount,
          currency: booking.currency || DEFAULT_CURRENCY,
          method: updates.paymentMethod || "wallet",
          status: "success",
          gatewayResponse: {
            mode: "admin-manual",
            updatedBy: req.user?._id?.toString() || null,
            updatedAt: new Date().toISOString(),
          },
        });
      } else {
        payment.amount = booking.totalAmount;
        payment.currency = booking.currency || DEFAULT_CURRENCY;
        payment.status = "success";
        if (updates.paymentMethod) {
          payment.method = updates.paymentMethod;
        }
        payment.gatewayResponse = {
          ...payment.gatewayResponse,
          updatedBy: req.user?._id?.toString() || null,
          updatedAt: new Date().toISOString(),
        };
      }
      await payment.save({ session });
      booking.payment = payment._id;
    } else if (payment) {
      payment.amount = booking.totalAmount;
      payment.currency = booking.currency || DEFAULT_CURRENCY;
      payment.status =
        mapBookingPaymentStatusToPaymentStatus(nextPaymentStatus);
      payment.gatewayResponse = {
        ...payment.gatewayResponse,
        updatedBy: req.user?._id?.toString() || null,
        updatedAt: new Date().toISOString(),
      };
      await payment.save({ session });
    }

    await booking.save({ session });
    await bus.save({ session });
    await session.commitTransaction();

    const updatedBooking = await findBookingByRefForAdmin(
      booking.bookingId || booking._id.toString(),
    );

    return res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: updatedBooking
        ? formatAdminBookingDetail(updatedBooking, new Date())
        : null,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    const statusCode = error?.statusCode || 500;
    const code = error?.code || "SERVER_ERROR";
    console.error("Admin Update Booking Error:", error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Failed to update booking" : error.message,
      code,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

// Admin: Retry refund for cancelled bookings with refund_failed
export const retryRefund = async (req, res) => {
  try {
    const booking = await findBookingByRefForAdmin(req.params.bookingRef);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        code: "BOOKING_NOT_FOUND",
      });
    }

    if (booking.bookingStatus !== "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Only cancelled bookings can have refund retried",
        code: "NOT_CANCELLED",
      });
    }

    if (booking.paymentStatus !== "refund_failed") {
      return res.status(400).json({
        success: false,
        message: "Refund can only be retried when status is refund_failed",
        code: "INVALID_STATUS",
      });
    }

    const refundAmount = Number(booking.cancellation?.refundAmount) || 0;
    if (refundAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "No refund amount to process",
        code: "NO_REFUND_AMOUNT",
      });
    }

    const payment = await Payment.findById(
      booking.payment?._id || booking.payment,
    );
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
        code: "PAYMENT_NOT_FOUND",
      });
    }

    if (payment.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Original payment was not successful",
        code: "PAYMENT_NOT_SUCCESS",
      });
    }

    const razorpayPaymentId =
      payment.gatewayResponse?.paymentId ||
      payment.gatewayResponse?.razorpay_payment_id ||
      payment.paymentId;

    if (!razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        message: "Razorpay payment ID not found",
        code: "RAZORPAY_ID_MISSING",
      });
    }

    const { processRefund } = await import("./paymentController.js");
    const razorpayRefund = await processRefund({
      paymentId: razorpayPaymentId,
      amount: refundAmount,
      notes: {
        bookingId: booking.bookingId,
        reason: "Admin retry - " + (booking.cancellation?.reason || "Refund retry"),
      },
    });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await payment.addRefund(
        refundAmount,
        "Admin retry - " + (booking.cancellation?.reason || "Refund retry"),
        razorpayRefund.id,
        session,
      );

      booking.paymentStatus =
        refundAmount >= payment.amount ? "refunded" : "partial-refund";
      if (booking.cancellation) {
        booking.cancellation.refundStatus = "success";
        booking.cancellation.refundError = undefined;
      }
      await booking.save({ session });

      await session.commitTransaction();

      const updated = await Booking.findById(booking._id)
        .populate("bus", "busName busNumber")
        .lean();

      return res.json({
        success: true,
        message: "Refund processed successfully",
        data: updated,
        refundDetails: razorpayRefund,
      });
    } catch (txError) {
      await session.abortTransaction();
      throw txError;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("[retryRefund] Error:", error);
    const message =
      error.response?.data?.error?.description ||
      error.error?.description ||
      error.message ||
      "Refund retry failed";
    return res.status(500).json({
      success: false,
      message,
      code: "REFUND_RETRY_FAILED",
    });
  }
};

export const deleteAdminBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const booking = await findBookingByRefForAdmin(
      req.params.bookingRef,
      session,
    );
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        code: "BOOKING_NOT_FOUND",
      });
    }

    const bus = await Bus.findById(booking.bus?._id || booking.bus).session(
      session,
    );
    const reserved = requiresSeatReservation(
      booking.bookingStatus,
      booking.paymentStatus,
    );
    const reservedSeatIds = Array.isArray(booking.passengers)
      ? booking.passengers
          .map((passenger) => normalizeSeatToken(passenger?.seatNumber))
          .filter(Boolean)
      : [];

    if (bus && reserved) {
      bus.bookedSeats = (bus.bookedSeats || []).filter(
        (seat) => seat.bookingId?.toString() !== booking._id.toString(),
      );
      bus.availableSeats += reservedSeatIds.length;
      await bus.save({ session });
    }

    await SeatHold.deleteMany({ booking: booking._id }).session(session);
    await Payment.deleteMany({ booking: booking._id }).session(session);
    await User.findByIdAndUpdate(
      booking.user?._id || booking.user,
      { $pull: { bookings: booking._id } },
      { session },
    );
    await Booking.deleteOne({ _id: booking._id }).session(session);

    await session.commitTransaction();
    return res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
      data: {
        bookingId: booking.bookingId,
        id: booking._id,
      },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Admin Delete Booking Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete booking",
      code: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

export const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({}).lean();

    if (!bookings) {
      return res.status(404).json({
        success: false,
        message: "No bookings found",
        code: "NO_BOOKINGS",
      });
    }

    res.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error("Get Bookings Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

export const extendSeatLocks = async (req, res) => {
  try {
    const {
      busId,
      travelDate,
      sessionId,
      direction = "forward",
      additionalMinutes = 5,
    } = req.body;
    const userId = req.user._id;

    if (!busId || !travelDate || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        code: "MISSING_FIELDS",
      });
    }

    console.log(
      `[extendSeatLocks] Extending locks for session ${sessionId}, user ${userId}`,
    );

    const extendResult = await SeatLockService.extendLocks({
      busId,
      userId,
      sessionId,
      travelDate,
      direction,
      additionalMinutes,
    });

    console.log(`[extendSeatLocks] Successfully extended locks:`, extendResult);

    res.status(200).json({
      success: true,
      message: "Seat locks extended successfully",
      data: extendResult,
    });
  } catch (error) {
    console.error("[extendSeatLocks] Extend locks error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to extend seat locks",
      code: "EXTEND_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const validateSeatLocks = async (req, res) => {
  try {
    const { sessionId, busId, travelDate, seatNumbers, direction } = req.body;
    const userId = req.user._id;
    const normalizedSeats = Array.isArray(seatNumbers)
      ? seatNumbers.map((seat) => normalizeSeatToken(seat))
      : [];

    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: "Bus not found",
      });
    }

    const { resolved, unknown } = resolveSeatIdsForInputs(bus, normalizedSeats);
    if (unknown.length > 0) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: `Invalid seat identifiers: ${unknown.join(", ")}`,
      });
    }

    const seatIds = resolved.filter(Boolean);
    const travelDateObj = new Date(travelDate);
    const now = new Date();

    const validLocks = await SeatHold.find({
      bus: busId,
      travelDate: travelDateObj,
      direction,
      user: userId,
      sessionId,
      status: "HOLD",
      expiresAt: { $gt: now },
      seatId: { $in: seatIds },
    }).lean();

    const allSeatsValid = seatIds.every((seat) =>
      validLocks.some((lock) => lock.seatId === seat),
    );

    res.status(200).json({
      success: true,
      valid: allSeatsValid && validLocks.length === seatIds.length,
      expiresAt: validLocks[0]?.expiresAt,
    });
  } catch (error) {
    console.error("Lock validation error:", error);
    res.status(500).json({
      success: false,
      valid: false,
      message: "Failed to validate seat locks",
    });
  }
};
