// src/models/bus.js
import mongoose from "mongoose";

const timeSchema = new mongoose.Schema(
  {
    hours: {
      type: Number,
      required: true,
      min: [0, "Hours cannot be negative"],
      max: [23, "Hours cannot exceed 23"],
    },
    minutes: {
      type: Number,
      required: true,
      min: [0, "Minutes cannot be negative"],
      max: [59, "Minutes cannot exceed 59"],
    },
  },
  { _id: false },
);

const locationSchema = new mongoose.Schema(
  {
    lat: {
      type: Number,
      required: true,
      min: [-90, "Latitude cannot be below -90"],
      max: [90, "Latitude cannot exceed 90"],
    },
    lng: {
      type: Number,
      required: true,
      min: [-180, "Longitude cannot be below -180"],
      max: [180, "Longitude cannot exceed 180"],
    },
  },
  { _id: false, strict: "throw" },
);

const timeToMinutes = (timeObj) =>
  typeof timeObj?.hours === "number" && typeof timeObj?.minutes === "number"
    ? timeObj.hours * 60 + timeObj.minutes
    : null;

const normalizeStopCode = (value) => {
  if (!value) return "";
  return String(value).trim().toUpperCase().replace(/\s+/g, "_");
};

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const toRadians = (value) => (value * Math.PI) / 180;

const roundDistanceKm = (value) =>
  Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;

const haversineDistanceKm = (a, b) => {
  if (!a || !b) return null;
  if (!isFiniteNumber(a.lat) || !isFiniteNumber(a.lng)) return null;
  if (!isFiniteNumber(b.lat) || !isFiniteNumber(b.lng)) return null;
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  if (!Number.isFinite(h)) return null;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return earthRadiusKm * c;
};

const computeRouteDistances = (stops) => {
  if (!Array.isArray(stops) || stops.length < 2) return null;
  const distances = [0];
  let total = 0;
  for (let index = 1; index < stops.length; index += 1) {
    const prev = stops[index - 1]?.location;
    const current = stops[index]?.location;
    const segment = haversineDistanceKm(prev, current);
    if (!Number.isFinite(segment)) return null;
    total += segment;
    distances.push(total);
  }
  return {
    distances: distances.map((value) => roundDistanceKm(value)),
    total: roundDistanceKm(total),
  };
};

const timesMatch = (first, second) => {
  const firstMinutes = timeToMinutes(first);
  const secondMinutes = timeToMinutes(second);
  if (firstMinutes === null || secondMinutes === null) return false;
  return firstMinutes === secondMinutes;
};

const hasValidTripTimes = (trip) =>
  timeToMinutes(trip?.departureTime) !== null &&
  timeToMinutes(trip?.arrivalTime) !== null;

const buildTripTimeline = (stops, direction) => {
  if (!Array.isArray(stops) || stops.length < 2) {
    return { valid: false, message: "Route must include at least two stops" };
  }

  const orderedStops = direction === "return" ? [...stops].reverse() : stops;

  let offset = 0;
  let lastBase = null;
  let lastAbsolute = null;
  const events = [];

  for (const stop of orderedStops) {
    const trip = direction === "return" ? stop?.downTrip : stop?.upTrip;
    const arrival = timeToMinutes(trip?.arrivalTime);
    const departure = timeToMinutes(trip?.departureTime);

    if (arrival === null || departure === null) {
      return {
        valid: false,
        message: `Missing ${direction} trip times for stop ${stop?.city || ""}`,
      };
    }

    if (lastBase !== null && arrival < lastBase) {
      offset += 1440;
    }
    const arrivalAbsolute = arrival + offset;
    lastBase = arrival;

    if (departure < lastBase) {
      offset += 1440;
    }
    const departureAbsolute = departure + offset;
    lastBase = departure;

    if (arrivalAbsolute > departureAbsolute) {
      return {
        valid: false,
        message: `Arrival time must be before departure time for ${stop?.city || "stop"}`,
      };
    }

    if (lastAbsolute !== null && arrivalAbsolute < lastAbsolute) {
      return {
        valid: false,
        message: `${direction} trip times must be in increasing order`,
      };
    }

    events.push({ arrival: arrivalAbsolute, departure: departureAbsolute });
    lastAbsolute = departureAbsolute;
  }

  return { valid: true, events, orderedStops };
};

const computeDurationFromTimeline = (timeline) => {
  if (!timeline?.events?.length) return null;
  const firstDeparture = timeline.events[0].departure;
  const lastArrival = timeline.events[timeline.events.length - 1].arrival;
  const totalMinutes = Math.max(0, lastArrival - firstDeparture);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
};

const tripStopSchema = new mongoose.Schema(
  {
    arrivalTime: {
      type: timeSchema,
      required: true,
      validate: {
        validator: function (value) {
          if (!value || !this.departureTime) return true;
          const arrivalMinutes = timeToMinutes(value);
          const departureMinutes = timeToMinutes(this.departureTime);
          if (arrivalMinutes === null || departureMinutes === null)
            return false;
          return arrivalMinutes <= departureMinutes;
        },
        message: "Arrival time must be before departure time",
      },
    },
    departureTime: {
      type: timeSchema,
      required: true,
    },
    distanceFromOrigin: {
      type: Number,
      required: true,
      min: [0, "Distance cannot be negative"],
    },
  },
  { _id: false },
);

const routeStopSchema = new mongoose.Schema(
  {
    stopCode: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: [2, "Stop code must be at least 2 characters"],
      maxlength: [12, "Stop code cannot exceed 12 characters"],
    },
    city: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, "City name must be at least 2 characters"],
      maxlength: [50, "City name cannot exceed 50 characters"],
    },
    location: {
      type: locationSchema,
      required: true,
    },
    // Distances are measured from the route origin for both trips to keep ordering consistent.
    upTrip: {
      type: tripStopSchema,
      required: true,
    },
    downTrip: {
      type: tripStopSchema,
      required: true,
    },
  },
  { _id: false },
);

const routeSchema = new mongoose.Schema(
  {
    routeCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    origin: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, "Origin must be at least 3 characters"],
      maxlength: [50, "Origin cannot exceed 50 characters"],
    },
    destination: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, "Destination must be at least 3 characters"],
      maxlength: [50, "Destination cannot exceed 50 characters"],
    },
    stops: {
      type: [routeStopSchema],
      required: true,
      validate: {
        validator: function (stops) {
          if (!Array.isArray(stops) || stops.length < 2) return false;
          let lastUp = -1;
          let lastDown = -1;
          for (const stop of stops) {
            const upDistance = stop?.upTrip?.distanceFromOrigin;
            const downDistance = stop?.downTrip?.distanceFromOrigin;
            if (
              typeof upDistance !== "number" ||
              typeof downDistance !== "number"
            ) {
              return false;
            }
            if (upDistance <= lastUp || downDistance <= lastDown) {
              return false;
            }
            lastUp = upDistance;
            lastDown = downDistance;
          }
          return true;
        },
        message: "Stops must be in increasing distance order for both trips",
      },
    },
    distance: {
      type: Number,
      required: true,
      min: [0, "Distance cannot be negative"],
      max: [10000, "Distance cannot exceed 10,000 km"],
    },
    duration: {
      hours: {
        type: Number,
        min: [0, "Hours cannot be negative"],
        max: [100, "Hours cannot exceed 100"],
      },
      minutes: {
        type: Number,
        min: [0, "Minutes cannot be negative"],
        max: [59, "Minutes cannot exceed 59"],
      },
    },
    cancellationPolicy: {
      before24h: {
        type: Number,
        min: [0, "Fee cannot be negative"],
        max: [100, "Fee cannot exceed 100%"],
      },
      before12h: {
        type: Number,
        min: [0, "Fee cannot be negative"],
        max: [100, "Fee cannot exceed 100%"],
      },
      noShow: {
        type: Number,
        min: [0, "Fee cannot be negative"],
        max: [100, "Fee cannot exceed 100%"],
      },
    },
  },
  { _id: false },
);

const SEAT_ID_REGEX = /^[A-Z]{1,10}-[0-9]{1,2}[A-Z]$/;
const SEAT_LABEL_REGEX = /^[0-9]{1,2}[A-Z]$/;
const DECK_NAME_REGEX = /^[A-Z0-9_]{3,10}$/;
const ELEMENT_TYPES = [
  "SEAT",
  "AISLE",
  "DOOR",
  "DRIVER",
  "STAIRS",
  "WC",
  "ENTRY",
  "EXIT",
  "GAP",
];
const SEAT_KINDS = ["SEATER", "SLEEPER"];
const SEAT_CLASSES = ["ECONOMY", "PREMIUM"];

const orientationSchema = new mongoose.Schema(
  {
    front: {
      type: String,
      required: true,
      uppercase: true,
      enum: ["TOP", "BOTTOM"],
    },
    driverSide: {
      type: String,
      uppercase: true,
      enum: ["LEFT", "RIGHT"],
      default: "LEFT",
    },
  },
  { _id: false, strict: "throw" },
);

const gridSchema = new mongoose.Schema(
  {
    rows: {
      type: Number,
      required: true,
      min: [1, "Grid rows must be at least 1"],
      max: [100, "Grid rows cannot exceed 100"],
    },
    cols: {
      type: Number,
      required: true,
      min: [1, "Grid cols must be at least 1"],
      max: [100, "Grid cols cannot exceed 100"],
    },
  },
  { _id: false, strict: "throw" },
);

const positionSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true, min: 0 },
    y: { type: Number, required: true, min: 0 },
  },
  { _id: false, strict: "throw" },
);

const sizeSchema = new mongoose.Schema(
  {
    w: { type: Number, min: 1, default: 1 },
    h: { type: Number, min: 1, default: 1 },
  },
  { _id: false, strict: "throw" },
);

const layoutElementSchema = new mongoose.Schema(
  {
    elementId: { type: String, trim: true },
    type: {
      type: String,
      required: true,
      uppercase: true,
      enum: ELEMENT_TYPES,
    },
    position: { type: positionSchema, required: true },
    size: { type: sizeSchema, default: () => ({ w: 1, h: 1 }) },
    seatId: {
      type: String,
      trim: true,
      uppercase: true,
    },
  },
  { _id: false, strict: "throw" },
);

const seatDefinitionSchema = new mongoose.Schema(
  {
    seatId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [SEAT_ID_REGEX, "Invalid seatId format"],
    },
    label: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [SEAT_LABEL_REGEX, "Invalid seat label format"],
    },
    kind: {
      type: String,
      required: true,
      uppercase: true,
      enum: SEAT_KINDS,
    },
    class: {
      type: String,
      required: true,
      uppercase: true,
      enum: SEAT_CLASSES,
    },
    deck: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [DECK_NAME_REGEX, "Invalid deck name"],
    },
    position: { type: positionSchema, required: true },
    size: { type: sizeSchema },
    rotation: {
      type: Number,
      enum: [0, 90, 180, 270],
      default: 0,
    },
    flags: {
      nearWindow: { type: Boolean, default: false },
      ladiesSeat: { type: Boolean, default: false },
      blocked: { type: Boolean, default: false },
      accessible: { type: Boolean, default: false },
    },
    fareGroup: { type: String, trim: true },
    tags: { type: [String], default: undefined },
  },
  { _id: false, strict: "throw" },
);

const deckSchema = new mongoose.Schema(
  {
    deck: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [DECK_NAME_REGEX, "Invalid deck name"],
    },
    grid: { type: gridSchema, required: true },
    elements: { type: [layoutElementSchema], default: [] },
  },
  { _id: false, strict: "throw" },
);

const seatLayoutSchema = new mongoose.Schema(
  {
    schemaVersion: {
      type: Number,
      required: true,
      min: [1, "Schema version must be at least 1"],
    },
    version: {
      type: Number,
      required: true,
      min: [1, "Layout version must be at least 1"],
    },
    layoutType: {
      type: String,
      required: true,
      trim: true,
      maxlength: [50, "Layout type cannot exceed 50 characters"],
    },
    orientation: { type: orientationSchema, required: true },
    decks: { type: [deckSchema], required: true },
    seats: { type: [seatDefinitionSchema], required: true },
  },
  { _id: false, strict: "throw" },
);

const normalizeSeatToken = (value) =>
  typeof value === "string"
    ? value.trim().toUpperCase()
    : String(value || "")
        .trim()
        .toUpperCase();

const isNonNegativeInt = (value) => Number.isInteger(value) && value >= 0;

export const validateSeatLayoutBlueprint = (layout, totalSeats) => {
  const errors = [];

  if (!layout || typeof layout !== "object") {
    return { valid: false, errors: ["Seat layout must be an object"] };
  }

  if (!Number.isInteger(layout.schemaVersion) || layout.schemaVersion < 1) {
    errors.push("schemaVersion must be a positive integer");
  }

  if (!Number.isInteger(layout.version) || layout.version < 1) {
    errors.push("version must be a positive integer");
  }

  if (!layout.layoutType || typeof layout.layoutType !== "string") {
    errors.push("layoutType is required");
  }

  const orientation = layout.orientation || {};
  if (!["TOP", "BOTTOM"].includes(normalizeSeatToken(orientation.front))) {
    errors.push("orientation.front must be TOP or BOTTOM");
  }
  const driverSide = normalizeSeatToken(orientation.driverSide);
  if (driverSide && !["LEFT", "RIGHT"].includes(driverSide)) {
    errors.push("orientation.driverSide must be LEFT or RIGHT");
  }

  const decks = Array.isArray(layout.decks) ? layout.decks : [];
  if (decks.length < 1) {
    errors.push("At least one deck is required");
  }

  const deckMap = new Map();

  for (const deck of decks) {
    const deckName = normalizeSeatToken(deck?.deck);
    if (!deckName) {
      errors.push("Deck name is required");
      continue;
    }
    if (!DECK_NAME_REGEX.test(deckName)) {
      errors.push(`Invalid deck name: ${deckName}`);
      continue;
    }
    if (deckMap.has(deckName)) {
      errors.push(`Duplicate deck name: ${deckName}`);
      continue;
    }

    const rows = deck?.grid?.rows;
    const cols = deck?.grid?.cols;
    if (!Number.isInteger(rows) || rows < 1 || rows > 100) {
      errors.push(`Invalid grid rows for deck ${deckName}`);
      continue;
    }
    if (!Number.isInteger(cols) || cols < 1 || cols > 100) {
      errors.push(`Invalid grid cols for deck ${deckName}`);
      continue;
    }

    deckMap.set(deckName, { rows, cols, elements: deck.elements || [] });

    const occupied = new Set();
    for (const element of deck.elements || []) {
      const type = normalizeSeatToken(element?.type);
      if (!ELEMENT_TYPES.includes(type)) {
        errors.push(`Invalid element type ${type} in deck ${deckName}`);
        continue;
      }

      const x = element?.position?.x;
      const y = element?.position?.y;
      const w = element?.size?.w ?? 1;
      const h = element?.size?.h ?? 1;

      if (!isNonNegativeInt(x) || !isNonNegativeInt(y)) {
        errors.push(`Invalid element position in deck ${deckName}`);
        continue;
      }
      if (!Number.isInteger(w) || w < 1 || !Number.isInteger(h) || h < 1) {
        errors.push(`Invalid element size in deck ${deckName}`);
        continue;
      }
      if (x + w > cols || y + h > rows) {
        errors.push(`Element out of bounds in deck ${deckName}`);
        continue;
      }

      for (let dx = 0; dx < w; dx += 1) {
        for (let dy = 0; dy < h; dy += 1) {
          const key = `${x + dx}:${y + dy}`;
          if (occupied.has(key)) {
            errors.push(`Overlapping elements in deck ${deckName}`);
            dx = w;
            dy = h;
            break;
          }
          occupied.add(key);
        }
      }
    }
  }

  const seats = Array.isArray(layout.seats) ? layout.seats : [];
  if (seats.length < 1) {
    errors.push("At least one seat definition is required");
  }

  if (
    typeof totalSeats === "number" &&
    totalSeats > 0 &&
    seats.length !== totalSeats
  ) {
    errors.push("Seat count must match totalSeats");
  }

  const seatIds = new Set();
  const seatLabels = new Set();
  const seatMap = new Map();

  for (const seat of seats) {
    const seatId = normalizeSeatToken(seat?.seatId);
    const label = normalizeSeatToken(seat?.label);
    const deckName = normalizeSeatToken(seat?.deck);
    const kind = normalizeSeatToken(seat?.kind);
    const seatClass = normalizeSeatToken(seat?.class);

    if (!seatId || !SEAT_ID_REGEX.test(seatId)) {
      errors.push(`Invalid seatId: ${seatId || "missing"}`);
    }
    if (!label || !SEAT_LABEL_REGEX.test(label)) {
      errors.push(`Invalid seat label: ${label || "missing"}`);
    }
    if (!SEAT_KINDS.includes(kind)) {
      errors.push(`Invalid seat kind for ${seatId}`);
    }
    if (!SEAT_CLASSES.includes(seatClass)) {
      errors.push(`Invalid seat class for ${seatId}`);
    }
    if (!deckMap.has(deckName)) {
      errors.push(`Seat ${seatId} references unknown deck ${deckName}`);
    }

    const x = seat?.position?.x;
    const y = seat?.position?.y;
    if (!isNonNegativeInt(x) || !isNonNegativeInt(y)) {
      errors.push(`Invalid seat position for ${seatId}`);
    } else if (deckMap.has(deckName)) {
      const { rows, cols } = deckMap.get(deckName);
      if (x >= cols || y >= rows) {
        errors.push(`Seat ${seatId} position out of bounds`);
      }
    }

    if (seatIds.has(seatId)) {
      errors.push(`Duplicate seatId ${seatId}`);
    }
    if (seatLabels.has(label)) {
      errors.push(`Duplicate seat label ${label}`);
    }

    seatIds.add(seatId);
    seatLabels.add(label);
    seatMap.set(seatId, { deckName, x, y });
  }

  const seatElements = new Set();
  for (const [deckName, deckInfo] of deckMap.entries()) {
    for (const element of deckInfo.elements || []) {
      if (normalizeSeatToken(element?.type) !== "SEAT") continue;
      const seatId = normalizeSeatToken(element?.seatId);
      if (!seatId) {
        errors.push(`Seat element missing seatId in deck ${deckName}`);
        continue;
      }
      if (!seatMap.has(seatId)) {
        errors.push(`Seat element references unknown seatId ${seatId}`);
        continue;
      }
      if (seatElements.has(seatId)) {
        errors.push(`Duplicate seat element for ${seatId}`);
        continue;
      }
      seatElements.add(seatId);

      const seatInfo = seatMap.get(seatId);
      if (seatInfo.deckName !== deckName) {
        errors.push(`Seat ${seatId} deck mismatch in elements`);
      }

      const ex = element?.position?.x;
      const ey = element?.position?.y;
      if (Number.isInteger(ex) && Number.isInteger(ey)) {
        if (seatInfo.x !== ex || seatInfo.y !== ey) {
          errors.push(
            `Seat ${seatId} position mismatch between seats and elements`,
          );
        }
      }
    }
  }

  for (const seatId of seatMap.keys()) {
    if (!seatElements.has(seatId)) {
      errors.push(`Missing seat element for ${seatId}`);
    }
  }

  return { valid: errors.length === 0, errors };
};

const busSchema = new mongoose.Schema(
  {
    busName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Bus name cannot exceed 100 characters"],
    },
    busId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    busNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    conductor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    operator: {
      type: String,
      required: true,
      trim: true,
    },
    busOwnerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new Error("Bus owner email is not valid");
        }
      },
      index: true,
    },
    totalSeats: {
      type: Number,
      required: true,
      min: [1, "At least 1 seat required"],
      max: [100, "Maximum 100 seats allowed"],
    },
    amenities: {
      ac: { type: Boolean, default: false },
      wifi: { type: Boolean, default: false },
      chargingPoints: { type: Boolean, default: false },
      toilet: { type: Boolean, default: false },
      waterBottle: { type: Boolean, default: false },
      blanket: { type: Boolean, default: false },
      entertainment: { type: Boolean, default: false },
    },
    features: {
      busType: {
        type: String,
        enum: [
          "Sleeper",
          "Seater",
          "Semi-Sleeper",
          "Luxury",
          "AC",
          "Non-AC",
          "Volvo",
        ],
        required: true,
        trim: true,
      },
      deckCount: {
        type: Number,
        enum: [1, 2],
        default: 1,
      },
      gpsTracking: { type: Boolean, default: false },
      emergencyExit: { type: Boolean, default: false },
      cctv: { type: Boolean, default: false },
      wheelchairAccessible: { type: Boolean, default: false },
    },
    seatLayout: {
      type: seatLayoutSchema,
      required: true,
    },
    route: {
      type: routeSchema,
      required: true,
    },
    forwardTrip: {
      departureTime: {
        type: timeSchema,
        required: true,
      },
      arrivalTime: {
        type: timeSchema,
        required: true,
      },
    },
    returnTrip: {
      departureTime: {
        type: timeSchema,
        required: true,
      },
      arrivalTime: {
        type: timeSchema,
        required: true,
      },
    },
    farePerKm: {
      type: Number,
      required: true,
      min: [0.01, "Fare per km must be at least 0.01"],
    },
    model: {
      type: String,
      trim: true,
    },
    year: {
      type: Number,
      min: [1990, "Invalid year"],
      max: [new Date().getFullYear() + 1, "Invalid year"],
    },
    insurance: {
      provider: { type: String, trim: true },
      policyNumber: { type: String, trim: true },
      expiry: { type: Date },
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    inactiveDates: {
      type: [String],
      default: [],
      validate: {
        validator: (dates) => dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
        message: "Each inactive date must be in YYYY-MM-DD format",
      },
    },
    bookedSeats: [
      {
        seatNumber: {
          type: String,
          required: true,
          trim: true,
          uppercase: true,
          match: [SEAT_ID_REGEX, "Invalid seat identifier"],
        },
        bookingId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Booking",
        },
        bookingDate: {
          type: Date,
          default: Date.now,
        },
        travelDate: {
          type: Date,
          required: true,
        },
        direction: {
          type: String,
          enum: ["forward", "return"],
          required: true,
          default: "forward",
        },
        boardingPoint: {
          type: String,
          trim: true,
        },
        droppingPoint: {
          type: String,
          trim: true,
        },
        segmentStartKm: {
          type: Number,
          min: [0, "Segment start cannot be negative"],
        },
        segmentEndKm: {
          type: Number,
          min: [0, "Segment end cannot be negative"],
        },
        source: {
          type: String,
          enum: ["booking", "offline"],
          default: "booking",
        },
        markedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        markedAt: {
          type: Date,
        },
        note: {
          type: String,
          trim: true,
          maxlength: [160, "Offline booking note cannot exceed 160 characters"],
        },
      },
    ],
    availableSeats: {
      type: Number,
      default: function () {
        return this.totalSeats;
      },
      min: [0, "Available seats cannot be negative"],
    },
    ratings: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    reviews: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        rating: {
          type: Number,
          min: 0,
          max: 5,
          required: true,
        },
        comment: {
          type: String,
          trim: true,
          maxlength: [500, "Comment cannot exceed 500 characters"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    operatingDays: {
      type: [String],
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      required: true,
      validate: {
        validator: (days) =>
          days.length > 0 && new Set(days).size === days.length,
        message: "Duplicate or empty operating days",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    id: false,
  },
);

busSchema.index({ "route.routeCode": 1 });
busSchema.index({ "route.origin": 1, "route.destination": 1 });
busSchema.index({ "route.stops.city": 1 });
busSchema.index({ inactiveDates: 1 });

busSchema.path("seatLayout").validate(function (value) {
  const { valid, errors } = validateSeatLayoutBlueprint(value, this.totalSeats);
  if (!valid) {
    this.invalidate("seatLayout", errors.join("; "));
  }
  return valid;
});

busSchema.pre("validate", function (next) {
  const route = this.route;
  if (!route || !Array.isArray(route.stops)) {
    return next();
  }

  const stops = route.stops;
  if (stops.length < 2) {
    this.invalidate("route.stops", "Route must include at least two stops");
    return next();
  }

  const seenCodes = new Set();
  stops.forEach((stop) => {
    const baseCode = normalizeStopCode(stop?.stopCode || stop?.city);
    if (!baseCode) return;
    let code = baseCode;
    let counter = 1;
    while (seenCodes.has(code)) {
      code = `${baseCode}_${counter}`;
      counter += 1;
    }
    stop.stopCode = code;
    seenCodes.add(code);
  });

  const firstCity = stops[0]?.city;
  const lastCity = stops[stops.length - 1]?.city;
  if (!route.origin && firstCity) {
    route.origin = firstCity;
  } else if (
    route.origin &&
    firstCity &&
    route.origin.trim().toLowerCase() !== firstCity.trim().toLowerCase()
  ) {
    this.invalidate("route.origin", "Origin must match the first stop");
  }
  if (!route.destination && lastCity) {
    route.destination = lastCity;
  } else if (
    route.destination &&
    lastCity &&
    route.destination.trim().toLowerCase() !== lastCity.trim().toLowerCase()
  ) {
    this.invalidate(
      "route.destination",
      "Destination must match the last stop",
    );
  }

  const computed = computeRouteDistances(stops);
  if (!computed) {
    this.invalidate(
      "route.stops",
      "Each stop must include location (lat/lng) to compute distances",
    );
    return next();
  }

  route.distance = computed.total;
  stops.forEach((stop, index) => {
    const distance = computed.distances[index];
    if (stop?.upTrip) {
      stop.upTrip.distanceFromOrigin = distance;
    }
    if (stop?.downTrip) {
      stop.downTrip.distanceFromOrigin = distance;
    }
  });

  const forwardTimeline = buildTripTimeline(stops, "forward");
  if (!forwardTimeline.valid) {
    this.invalidate("route.stops", forwardTimeline.message);
  } else {
    const duration = computeDurationFromTimeline(forwardTimeline);
    if (duration) {
      route.duration = duration;
    }
  }

  const returnTimeline = buildTripTimeline(stops, "return");
  if (!returnTimeline.valid) {
    this.invalidate("route.stops", returnTimeline.message);
  }

  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];
  const routeModified = this.isModified("route");

  const computedForwardTrip = {
    departureTime: firstStop?.upTrip?.departureTime,
    arrivalTime: lastStop?.upTrip?.arrivalTime,
  };
  if (hasValidTripTimes(computedForwardTrip)) {
    if (
      routeModified ||
      !this.forwardTrip?.departureTime ||
      !this.forwardTrip?.arrivalTime
    ) {
      this.forwardTrip = computedForwardTrip;
    } else if (
      !timesMatch(
        this.forwardTrip.departureTime,
        computedForwardTrip.departureTime,
      ) ||
      !timesMatch(this.forwardTrip.arrivalTime, computedForwardTrip.arrivalTime)
    ) {
      this.invalidate(
        "forwardTrip",
        "Forward trip times must match route stop timings",
      );
    }
  }

  const computedReturnTrip = {
    departureTime: lastStop?.downTrip?.departureTime,
    arrivalTime: firstStop?.downTrip?.arrivalTime,
  };
  if (hasValidTripTimes(computedReturnTrip)) {
    if (
      routeModified ||
      !this.returnTrip?.departureTime ||
      !this.returnTrip?.arrivalTime
    ) {
      this.returnTrip = computedReturnTrip;
    } else if (
      !timesMatch(
        this.returnTrip.departureTime,
        computedReturnTrip.departureTime,
      ) ||
      !timesMatch(this.returnTrip.arrivalTime, computedReturnTrip.arrivalTime)
    ) {
      this.invalidate(
        "returnTrip",
        "Return trip times must match route stop timings",
      );
    }
  }

  return next();
});

busSchema.pre("save", function (next) {
  if (this.route?.routeCode) {
    this.route.routeCode = this.route.routeCode
      .toUpperCase()
      .replace(/\s+/g, "-");
  }
  next();
});

busSchema.methods.getSeatIds = function () {
  if (!Array.isArray(this.seatLayout?.seats)) return [];
  return this.seatLayout.seats.map((seat) => seat.seatId);
};

busSchema.methods.getSeatIdSet = function () {
  return new Set(this.getSeatIds());
};

busSchema.methods.resolveSeatIds = function (seatInputs = []) {
  const seats = Array.isArray(this.seatLayout?.seats)
    ? this.seatLayout.seats
    : [];
  const seatIdSet = new Set(seats.map((seat) => seat.seatId));
  const labelMap = new Map(seats.map((seat) => [seat.label, seat.seatId]));

  const seatIds = [];
  const unknown = [];

  for (const input of seatInputs) {
    const normalized = normalizeSeatToken(input);
    if (!normalized) continue;
    if (seatIdSet.has(normalized)) {
      seatIds.push(normalized);
      continue;
    }
    const mapped = labelMap.get(normalized);
    if (mapped) {
      seatIds.push(mapped);
    } else {
      unknown.push(normalized);
    }
  }

  return { seatIds, unknown };
};

busSchema.methods.getTimingForDirection = function (direction = "forward") {
  return direction === "forward" ? this.forwardTrip : this.returnTrip;
};

busSchema.methods.calculateFare = function (
  boardingStopIndex,
  droppingStopIndex,
  direction = "forward",
) {
  // This method should be called with route information
  // The actual fare calculation will be done in the controller with route data
  return this.farePerKm;
};

export const Bus = mongoose.models.Bus || mongoose.model("Bus", busSchema);
