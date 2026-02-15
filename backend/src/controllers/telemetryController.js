import mongoose from "mongoose";

import { Bus } from "../models/bus.js";
import { SeatHold } from "../models/seatHold.js";
import { User } from "../models/user.js";
import { auth as firebaseAdminAuth } from "../utils/firebase-admin.js";
import { ingestLocationBatch } from "../services/tracking/ingestionService.js";
import { getLatestBusLocation as getLatestBusLocationFromStore } from "../services/tracking/readService.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_REGEX = /^\+[1-9]\d{1,14}$/;
const OFFLINE_BOOKING_SOURCE = "offline";
const OFFLINE_BOOKING_NOTE_MAX_LENGTH = 160;

const normalizeDirection = (direction) => {
  const token = String(direction || "")
    .trim()
    .toLowerCase();
  return token === "forward" || token === "return" ? token : undefined;
};

const normalizeSeatToken = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const formatDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseTravelDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
};

const getTravelDateRange = (travelDateObj) => {
  const dayStart = new Date(travelDateObj);
  const dayEnd = new Date(travelDateObj);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
};

const isPastTravelDate = (travelDateObj) => {
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return travelDateObj.getTime() < todayStart.getTime();
};

const buildTripKey = (busId, travelDateObj, direction) =>
  `${busId}_${formatDateKey(travelDateObj)}_${direction}`;

const getConductorBusFilter = (req) => ({
  conductor: req.user?._id,
  isDeleted: false,
  isActive: true,
});

const normalizeEmail = (value) => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
};

const normalizePhone = (value) => {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  if (raw.startsWith("+")) {
    const normalized = raw.replace(/[^\d+]/g, "");
    return normalized || undefined;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return undefined;
};

const sanitizeName = (value) => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const respondFirebaseIdentityError = (res, error, { createPhase }) => {
  if (error?.code === "auth/email-already-exists") {
    return res.status(409).json({
      success: false,
      message: "EMAIL_EXISTS",
    });
  }
  if (error?.code === "auth/phone-number-already-exists") {
    return res.status(409).json({
      success: false,
      message: "PHONE_EXISTS",
    });
  }
  if (error?.code === "auth/invalid-phone-number") {
    return res.status(400).json({
      success: false,
      message: "INVALID_PHONE",
    });
  }
  if (error?.code === "auth/invalid-email") {
    return res.status(400).json({
      success: false,
      message: "INVALID_EMAIL",
    });
  }

  console.error(
    createPhase
      ? "createOwnerConductor firebase create error:"
      : "createOwnerConductor firebase update error:",
    error,
  );
  return res.status(502).json({
    success: false,
    message: createPhase ? "FIREBASE_CREATE_FAILED" : "FIREBASE_UPDATE_FAILED",
  });
};

const respondMongoUniqueError = (res, error) => {
  if (error?.code !== 11000) return false;

  if (error?.keyPattern?.email) {
    res.status(409).json({
      success: false,
      message: "EMAIL_EXISTS",
    });
    return true;
  }

  if (error?.keyPattern?.phone) {
    res.status(409).json({
      success: false,
      message: "PHONE_EXISTS",
    });
    return true;
  }

  if (error?.keyPattern?.firebaseUID) {
    res.status(409).json({
      success: false,
      message: "FIREBASE_UID_EXISTS",
    });
    return true;
  }

  res.status(409).json({
    success: false,
    message: "CONFLICT",
  });
  return true;
};

const getRole = (req) => String(req.user?.role || "").toLowerCase();

const getOwnerBusScopeFilter = (req) => {
  const role = getRole(req);
  const base = { isDeleted: false };

  if (role === "owner") {
    const ownerEmail =
      typeof req.user?.email === "string"
        ? req.user.email.trim().toLowerCase()
        : "";

    return ownerEmail
      ? { ...base, busOwnerEmail: ownerEmail }
      : { ...base, createdBy: req.user?._id };
  }

  return base;
};

const getOwnerBusFilter = (req) => ({
  ...getOwnerBusScopeFilter(req),
  isActive: true,
});

const getOwnerConductorFilter = (req) => {
  const filter = { role: "conductor" };
  if (getRole(req) === "owner") {
    filter.createdBy = req.user?._id;
  }
  return filter;
};

const findConductorBusById = (req, busId) =>
  Bus.findOne({
    _id: busId,
    ...getConductorBusFilter(req),
  });

const resolveSeatIdFromInput = (bus, seatInput) => {
  if (typeof bus?.resolveSeatIds !== "function") {
    return { seatId: null, unknown: [normalizeSeatToken(seatInput)] };
  }
  const { seatIds, unknown } = bus.resolveSeatIds([seatInput]);
  return { seatId: seatIds?.[0] || null, unknown };
};

const buildConductorSeatStatusRows = ({
  bus,
  travelDateObj,
  direction,
  lockedSeatSet,
  requesterId,
}) => {
  const targetDateKey = formatDateKey(travelDateObj);
  const bookedMap = new Map();
  const bookedEntries = Array.isArray(bus?.bookedSeats) ? bus.bookedSeats : [];

  for (const entry of bookedEntries) {
    if (formatDateKey(entry?.travelDate) !== targetDateKey) continue;
    if (normalizeDirection(entry?.direction) !== direction) continue;
    const seatId = normalizeSeatToken(entry?.seatNumber);
    if (!seatId || bookedMap.has(seatId)) continue;
    bookedMap.set(seatId, entry);
  }

  const seats = Array.isArray(bus?.seatLayout?.seats)
    ? bus.seatLayout.seats
    : [];
  const rows = [];
  const requester = String(requesterId || "");

  for (const seat of seats) {
    const seatId = normalizeSeatToken(seat?.seatId);
    if (!seatId) continue;

    const bookedEntry = bookedMap.get(seatId) || null;
    const status = bookedEntry
      ? "booked"
      : lockedSeatSet.has(seatId)
        ? "locked"
        : "available";

    const source = String(bookedEntry?.source || "booking").toLowerCase();
    const markedBy = bookedEntry?.markedBy
      ? String(bookedEntry.markedBy)
      : null;
    const isOfflineBooked =
      status === "booked" && source === OFFLINE_BOOKING_SOURCE;
    const canUndo = isOfflineBooked && (!markedBy || markedBy === requester);

    rows.push({
      seatId,
      label: seat?.label || seatId,
      deck: seat?.deck || "LOWER",
      row: Number(seat?.position?.y ?? -1),
      column: Number(seat?.position?.x ?? -1),
      kind: seat?.kind || null,
      class: seat?.class || null,
      flags: {
        nearWindow: Boolean(seat?.flags?.nearWindow),
        ladiesSeat: Boolean(seat?.flags?.ladiesSeat),
        blocked: Boolean(seat?.flags?.blocked),
        accessible: Boolean(seat?.flags?.accessible),
      },
      status,
      source: bookedEntry?.source || null,
      note: bookedEntry?.note || null,
      markedBy,
      markedAt: bookedEntry?.markedAt || null,
      bookingId: bookedEntry?.bookingId || null,
      isOfflineBooked,
      canUndo,
    });
  }

  rows.sort((first, second) => {
    const deckCompare = String(first.deck).localeCompare(String(second.deck));
    if (deckCompare !== 0) return deckCompare;
    if (first.row !== second.row) return first.row - second.row;
    if (first.column !== second.column) return first.column - second.column;
    return String(first.label).localeCompare(String(second.label));
  });

  return rows;
};

const parsePagination = (req) => {
  const pageValue = Number.parseInt(String(req.query.page || "1"), 10);
  const limitValue = Number.parseInt(String(req.query.limit || "20"), 10);
  const page = Number.isFinite(pageValue) ? Math.max(pageValue, 1) : 1;
  const limit = Number.isFinite(limitValue)
    ? Math.min(Math.max(limitValue, 1), 100)
    : 20;
  return { page, limit };
};

const buildConductorListQuery = (req) => {
  const query = getOwnerConductorFilter(req);
  const search = String(req.query.search || "").trim();
  const status = String(req.query.status || "all")
    .trim()
    .toLowerCase();
  const onlyAssignable = String(req.query.onlyAssignable || "")
    .trim()
    .toLowerCase();

  if (status === "active") {
    query.isActive = true;
  } else if (status === "inactive") {
    query.isActive = false;
  } else if (status === "blocked") {
    query.isBlocked = true;
  }

  if (onlyAssignable === "1" || onlyAssignable === "true") {
    query.isActive = true;
    query.isBlocked = false;
  }

  if (search) {
    const regex = new RegExp(search, "i");
    query.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
  }

  return query;
};

const enrichConductorsWithAssignmentCount = async (conductors, req) => {
  const conductorIds = conductors.map((conductor) => conductor._id);
  if (conductorIds.length === 0) return [];

  const countRows = await Bus.aggregate([
    {
      $match: {
        ...getOwnerBusScopeFilter(req),
        conductor: { $in: conductorIds },
      },
    },
    {
      $group: {
        _id: "$conductor",
        assignedBusCount: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map(
    countRows.map((row) => [
      String(row._id),
      Number(row.assignedBusCount) || 0,
    ]),
  );

  return conductors.map((conductor) => ({
    ...conductor,
    assignedBusCount: countMap.get(String(conductor._id)) || 0,
  }));
};

export const postLocationTelemetry = async (req, res) => {
  try {
    const { busNumber, tripKey, travelDate, direction, deviceId, seq, points } =
      req.body || {};

    const result = await ingestLocationBatch({
      conductorUser: req.user,
      busNumber,
      tripKey,
      travelDate,
      direction: normalizeDirection(direction),
      deviceId,
      seq,
      points,
      source: "https",
    });

    return res.status(result.statusCode || 200).json({
      success: result.success,
      message: result.message || "TELEMETRY_PROCESSED",
      data: {
        busNumber: result.busNumber || null,
        tripKey: result.tripKey || null,
        acceptedCount: result.acceptedCount || 0,
        rejectedCount: result.rejectedCount || 0,
        rejected: result.rejected || [],
        duplicate: result.duplicate || false,
        serverTs: result.serverTs || new Date().toISOString(),
        lastAcceptedSeq:
          result.lastAcceptedSeq !== undefined ? result.lastAcceptedSeq : null,
      },
    });
  } catch (error) {
    console.error("postLocationTelemetry error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const getTelemetryAssignments = async (req, res) => {
  try {
    const buses = await Bus.find({
      conductor: req.user?._id,
      isDeleted: false,
      isActive: true,
    })
      .select(
        "_id busId busName busNumber operator features route forwardTrip returnTrip operatingDays inactiveDates amenities totalSeats farePerKm model year ratings",
      )
      .sort({ busNumber: 1 })
      .lean();

    return res.json({
      success: true,
      message: "ASSIGNMENTS_RETRIEVED",
      data: buses,
    });
  } catch (error) {
    console.error("getTelemetryAssignments error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const getConductorBusDetails = async (req, res) => {
  try {
    const { busId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_BUS_ID",
      });
    }

    const bus = await Bus.findOne({
      _id: busId,
      conductor: req.user?._id,
      isDeleted: false,
    })
      .select(
        "_id busId busName busNumber operator features amenities route forwardTrip returnTrip operatingDays inactiveDates totalSeats farePerKm model year insurance ratings isActive",
      )
      .lean();

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "BUS_NOT_FOUND_OR_NOT_ASSIGNED",
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const isInactiveToday =
      Array.isArray(bus.inactiveDates) && bus.inactiveDates.includes(todayStr);

    return res.json({
      success: true,
      message: "CONDUCTOR_BUS_DETAILS_RETRIEVED",
      data: {
        ...bus,
        isInactiveToday,
      },
    });
  } catch (error) {
    console.error("getConductorBusDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const toggleConductorBusInactiveDate = async (req, res) => {
  try {
    const { busId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_BUS_ID",
      });
    }

    const { date, active } = req.body || {};
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_DATE_FORMAT",
      });
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "INVALID_DATE",
      });
    }

    if (typeof active !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "ACTIVE_MUST_BE_BOOLEAN",
      });
    }

    const bus = await Bus.findOne({
      _id: busId,
      conductor: req.user?._id,
      isDeleted: false,
    });

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "BUS_NOT_FOUND_OR_NOT_ASSIGNED",
      });
    }

    const currentDates = new Set(
      Array.isArray(bus.inactiveDates) ? bus.inactiveDates : [],
    );

    if (active) {
      // Reactivate: remove date from inactiveDates
      currentDates.delete(date);
    } else {
      // Deactivate: add date to inactiveDates
      currentDates.add(date);
    }

    bus.inactiveDates = Array.from(currentDates).sort();
    await bus.save();

    return res.json({
      success: true,
      message: active ? "BUS_REACTIVATED_FOR_DATE" : "BUS_DEACTIVATED_FOR_DATE",
      data: {
        busId: bus._id,
        date,
        active,
        inactiveDates: bus.inactiveDates,
      },
    });
  } catch (error) {
    console.error("toggleConductorBusInactiveDate error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const getConductorOfflineSeatLayout = async (req, res) => {
  try {
    const { busId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_BUS_ID",
      });
    }

    const direction = normalizeDirection(req.query?.direction) || "forward";
    const travelDateObj = parseTravelDate(req.query?.travelDate);
    if (!travelDateObj) {
      return res.status(400).json({
        success: false,
        message: "INVALID_TRAVEL_DATE",
      });
    }

    const bus = await findConductorBusById(req, busId).lean();
    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "BUS_NOT_FOUND_OR_NOT_ASSIGNED",
      });
    }

    const { dayStart, dayEnd } = getTravelDateRange(travelDateObj);
    const now = new Date();

    const activeHoldRows = await SeatHold.find({
      bus: bus._id,
      travelDate: { $gte: dayStart, $lt: dayEnd },
      direction,
      status: "HOLD",
      expiresAt: { $gt: now },
    })
      .select("seatId")
      .lean();

    const lockedSeatSet = new Set(
      activeHoldRows.map((row) => normalizeSeatToken(row?.seatId)),
    );

    const seats = buildConductorSeatStatusRows({
      bus,
      travelDateObj,
      direction,
      lockedSeatSet,
      requesterId: req.user?._id,
    });

    const bookedCount = seats.filter((seat) => seat.status === "booked").length;
    const lockedCount = seats.filter((seat) => seat.status === "locked").length;
    const availableCount = seats.filter(
      (seat) => seat.status === "available",
    ).length;
    const offlineBookedCount = seats.filter(
      (seat) => seat.isOfflineBooked,
    ).length;

    return res.json({
      success: true,
      message: "CONDUCTOR_OFFLINE_SEAT_LAYOUT_RETRIEVED",
      data: {
        bus: {
          _id: bus._id,
          busId: bus.busId,
          busName: bus.busName,
          busNumber: bus.busNumber,
          operator: bus.operator,
          route: bus.route || null,
          timing:
            direction === "forward"
              ? bus.forwardTrip || null
              : bus.returnTrip || null,
        },
        travelDate: formatDateKey(travelDateObj),
        direction,
        summary: {
          totalSeats: Number(bus.totalSeats) || seats.length,
          availableCount,
          bookedCount,
          lockedCount,
          offlineBookedCount,
        },
        seats,
      },
    });
  } catch (error) {
    console.error("getConductorOfflineSeatLayout error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const markConductorOfflineSeatBooked = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { busId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_BUS_ID",
      });
    }

    const travelDateObj = parseTravelDate(req.body?.travelDate);
    if (!travelDateObj) {
      return res.status(400).json({
        success: false,
        message: "INVALID_TRAVEL_DATE",
      });
    }
    if (isPastTravelDate(travelDateObj)) {
      return res.status(400).json({
        success: false,
        message: "TRAVEL_DATE_IN_PAST",
      });
    }

    const direction = normalizeDirection(req.body?.direction) || "forward";
    const rawSeat = normalizeSeatToken(req.body?.seatNumber);
    if (!rawSeat) {
      return res.status(400).json({
        success: false,
        message: "SEAT_NUMBER_REQUIRED",
      });
    }

    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    if (note.length > OFFLINE_BOOKING_NOTE_MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        message: "NOTE_TOO_LONG",
      });
    }

    session.startTransaction();
    const bus = await findConductorBusById(req, busId).session(session);
    if (!bus) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "BUS_NOT_FOUND_OR_NOT_ASSIGNED",
      });
    }

    const { seatId, unknown } = resolveSeatIdFromInput(bus, rawSeat);
    if (!seatId || unknown.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "INVALID_SEAT_NUMBER",
      });
    }

    const seatDefinition = Array.isArray(bus?.seatLayout?.seats)
      ? bus.seatLayout.seats.find(
          (seat) => normalizeSeatToken(seat?.seatId) === seatId,
        )
      : null;
    if (seatDefinition?.flags?.blocked) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "SEAT_BLOCKED_IN_LAYOUT",
      });
    }

    const targetDateKey = formatDateKey(travelDateObj);
    const alreadyBooked = (bus.bookedSeats || []).some(
      (entry) =>
        normalizeSeatToken(entry?.seatNumber) === seatId &&
        normalizeDirection(entry?.direction) === direction &&
        formatDateKey(entry?.travelDate) === targetDateKey,
    );
    if (alreadyBooked) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "SEAT_ALREADY_BOOKED",
      });
    }

    const { dayStart, dayEnd } = getTravelDateRange(travelDateObj);
    const now = new Date();
    await SeatHold.updateMany(
      {
        bus: bus._id,
        travelDate: { $gte: dayStart, $lt: dayEnd },
        direction,
        seatId,
        status: "HOLD",
        expiresAt: { $lte: now },
      },
      {
        $set: {
          status: "CANCELLED",
          expiresAt: now,
        },
      },
      { session },
    );

    const activeHold = await SeatHold.findOne({
      bus: bus._id,
      travelDate: { $gte: dayStart, $lt: dayEnd },
      direction,
      seatId,
      status: "HOLD",
      expiresAt: { $gt: now },
    }).session(session);
    if (activeHold) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "SEAT_TEMPORARILY_LOCKED",
      });
    }

    const bookedHold = await SeatHold.findOne({
      bus: bus._id,
      travelDate: { $gte: dayStart, $lt: dayEnd },
      direction,
      seatId,
      status: "BOOKED",
    }).session(session);
    if (bookedHold) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "SEAT_ALREADY_BOOKED",
      });
    }

    bus.bookedSeats.push({
      seatNumber: seatId,
      travelDate: travelDateObj,
      direction,
      bookingDate: now,
      source: OFFLINE_BOOKING_SOURCE,
      markedBy: req.user?._id,
      markedAt: now,
      note: note || undefined,
    });
    await bus.save({ session });

    const tripKey = buildTripKey(bus._id.toString(), travelDateObj, direction);
    await SeatHold.create(
      [
        {
          bus: bus._id,
          tripKey,
          travelDate: travelDateObj,
          direction,
          seatId,
          status: "BOOKED",
          expiresAt: null,
          user: req.user?._id,
          sessionId: `offline_${Date.now()}`,
          metadata: {
            source: "conductor-offline",
            markedBy: req.user?._id?.toString() || null,
            note: note || null,
          },
        },
      ],
      { session },
    );

    await session.commitTransaction();
    return res.status(201).json({
      success: true,
      message: "OFFLINE_SEAT_BOOKED",
      data: {
        busId: bus._id,
        seatNumber: seatId,
        travelDate: targetDateKey,
        direction,
        source: OFFLINE_BOOKING_SOURCE,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "SEAT_ALREADY_BOOKED",
      });
    }
    console.error("markConductorOfflineSeatBooked error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  } finally {
    session.endSession();
  }
};

export const unmarkConductorOfflineSeatBooked = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { busId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_BUS_ID",
      });
    }

    const travelDateObj = parseTravelDate(req.body?.travelDate);
    if (!travelDateObj) {
      return res.status(400).json({
        success: false,
        message: "INVALID_TRAVEL_DATE",
      });
    }

    const direction = normalizeDirection(req.body?.direction) || "forward";
    const rawSeat = normalizeSeatToken(req.body?.seatNumber);
    if (!rawSeat) {
      return res.status(400).json({
        success: false,
        message: "SEAT_NUMBER_REQUIRED",
      });
    }

    session.startTransaction();
    const bus = await findConductorBusById(req, busId).session(session);
    if (!bus) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "BUS_NOT_FOUND_OR_NOT_ASSIGNED",
      });
    }

    const { seatId, unknown } = resolveSeatIdFromInput(bus, rawSeat);
    if (!seatId || unknown.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "INVALID_SEAT_NUMBER",
      });
    }

    const targetDateKey = formatDateKey(travelDateObj);
    const seatEntryIndex = (bus.bookedSeats || []).findIndex(
      (entry) =>
        normalizeSeatToken(entry?.seatNumber) === seatId &&
        normalizeDirection(entry?.direction) === direction &&
        formatDateKey(entry?.travelDate) === targetDateKey,
    );

    if (seatEntryIndex < 0) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "SEAT_NOT_BOOKED",
      });
    }

    const seatEntry = bus.bookedSeats[seatEntryIndex];
    if (
      String(seatEntry?.source || "").toLowerCase() !== OFFLINE_BOOKING_SOURCE
    ) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "SEAT_BOOKED_VIA_REGULAR_FLOW",
      });
    }

    const markedBy = seatEntry?.markedBy ? String(seatEntry.markedBy) : "";
    const requester = String(req.user?._id || "");
    if (markedBy && markedBy !== requester) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "OFFLINE_BOOKING_OWNERSHIP_MISMATCH",
      });
    }

    bus.bookedSeats.splice(seatEntryIndex, 1);
    await bus.save({ session });

    const { dayStart, dayEnd } = getTravelDateRange(travelDateObj);
    await SeatHold.updateMany(
      {
        bus: bus._id,
        travelDate: { $gte: dayStart, $lt: dayEnd },
        direction,
        seatId,
        status: "BOOKED",
        booking: null,
        "metadata.source": "conductor-offline",
      },
      {
        $set: {
          status: "CANCELLED",
          expiresAt: new Date(),
        },
      },
      { session },
    );

    await session.commitTransaction();
    return res.json({
      success: true,
      message: "OFFLINE_SEAT_UNBOOKED",
      data: {
        busId: bus._id,
        seatNumber: seatId,
        travelDate: targetDateKey,
        direction,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("unmarkConductorOfflineSeatBooked error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  } finally {
    session.endSession();
  }
};

export const getOwnerTelemetryBuses = async (req, res) => {
  try {
    const buses = await Bus.find(getOwnerBusFilter(req))
      .select("_id busId busName busNumber operator route conductor")
      .populate({
        path: "conductor",
        select: "_id fullName email phone role isActive isBlocked createdBy",
      })
      .sort({ busNumber: 1 })
      .lean();

    return res.json({
      success: true,
      message: "OWNER_BUSES_RETRIEVED",
      data: buses,
    });
  } catch (error) {
    console.error("getOwnerTelemetryBuses error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const getOwnerTelemetryBusLatest = async (req, res) => {
  try {
    const busNumber = String(req.params.busNumber || "")
      .trim()
      .toUpperCase();

    if (!busNumber) {
      return res.status(400).json({
        success: false,
        message: "BUS_NUMBER_REQUIRED",
      });
    }

    const role = getRole(req);
    const bus = await Bus.findOne({
      ...getOwnerBusFilter(req),
      busNumber,
    })
      .select("_id busId busName busNumber operator route conductor")
      .populate({
        path: "conductor",
        select: "_id fullName email phone role isActive isBlocked createdBy",
      })
      .lean();

    if (!bus) {
      return res.status(404).json({
        success: false,
        message:
          role === "owner" ? "BUS_NOT_FOUND_OR_NOT_OWNED" : "BUS_NOT_FOUND",
      });
    }

    const liveLocation = await getLatestBusLocationFromStore(busNumber);

    return res.json({
      success: true,
      message: "OWNER_BUS_LIVE_LOCATION_RETRIEVED",
      data: {
        bus,
        liveLocation: liveLocation
          ? {
              busNumber: liveLocation.busNumber,
              tripKey: liveLocation.tripKey ?? null,
              lat: liveLocation.lat,
              lng: liveLocation.lng,
              accuracy: liveLocation.accuracy ?? null,
              speed: liveLocation.speed ?? null,
              heading: liveLocation.heading ?? null,
              recordedAt: liveLocation.recordedAt ?? null,
              ingestedAt: liveLocation.ingestedAt ?? null,
              confidence: liveLocation.confidence ?? "unknown",
              ageSeconds:
                liveLocation.ageSeconds !== undefined
                  ? liveLocation.ageSeconds
                  : null,
              isStale: Boolean(liveLocation.isStale),
              source: liveLocation.source ?? null,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("getOwnerTelemetryBusLatest error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const getOwnerConductors = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req);
    const query = buildConductorListQuery(req);

    const [rows, total] = await Promise.all([
      User.find(query)
        .select(
          "_id fullName email phone role isActive isBlocked createdBy createdAt updatedAt",
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const conductors = await enrichConductorsWithAssignmentCount(rows, req);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.json({
      success: true,
      message: "OWNER_CONDUCTORS_RETRIEVED",
      data: {
        conductors,
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    console.error("getOwnerConductors error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const createOwnerConductor = async (req, res) => {
  try {
    const fullName = sanitizeName(req.body?.fullName);
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);
    const isActive = req.body?.isActive !== false;
    const isBlocked = req.body?.isBlocked === true;
    const requesterRole = getRole(req);
    const disabled = !isActive || isBlocked;
    const firebaseCreatePayload = {
      displayName: fullName,
      email: email || undefined,
      phoneNumber: phone || undefined,
      disabled,
    };
    const firebaseUpdatePayload = {
      displayName: fullName,
      email: email || null,
      phoneNumber: phone || null,
      disabled,
    };

    if (!fullName || fullName.length < 3) {
      return res.status(400).json({
        success: false,
        message: "FULL_NAME_REQUIRED",
      });
    }

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "EMAIL_OR_PHONE_REQUIRED",
      });
    }

    if (email && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_EMAIL",
      });
    }

    if (phone && !E164_REGEX.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_PHONE",
      });
    }

    const resolveFirebaseByContact = async () => {
      let byEmail = null;
      let byPhone = null;

      if (email) {
        try {
          byEmail = await firebaseAdminAuth.getUserByEmail(email);
        } catch (error) {
          if (error?.code !== "auth/user-not-found") throw error;
        }
      }

      if (phone) {
        try {
          byPhone = await firebaseAdminAuth.getUserByPhoneNumber(phone);
        } catch (error) {
          if (error?.code !== "auth/user-not-found") throw error;
        }
      }

      if (byEmail && byPhone && byEmail.uid !== byPhone.uid) {
        return { conflict: true, user: null };
      }

      return { conflict: false, user: byEmail || byPhone || null };
    };

    const ensureConductorAccess = (existing) => {
      if (["admin", "owner", "superadmin"].includes(existing.role)) {
        return res.status(409).json({
          success: false,
          message: "ROLE_CONVERSION_NOT_ALLOWED",
        });
      }

      if (requesterRole === "owner" && existing.role === "conductor") {
        const existingOwner = existing.createdBy
          ? String(existing.createdBy)
          : null;
        const requesterId = req.user?._id ? String(req.user._id) : null;
        if (existingOwner && requesterId && existingOwner !== requesterId) {
          return res.status(409).json({
            success: false,
            message: "CONDUCTOR_NOT_OWNED",
          });
        }
      }

      return null;
    };

    const syncFirebaseForExisting = async (existing) => {
      try {
        await firebaseAdminAuth.updateUser(
          existing.firebaseUID,
          firebaseUpdatePayload,
        );
        return true;
      } catch (error) {
        if (
          error?.code !== "auth/user-not-found" &&
          error?.code !== "auth/phone-number-already-exists" &&
          error?.code !== "auth/email-already-exists"
        ) {
          respondFirebaseIdentityError(res, error, { createPhase: false });
          return false;
        }

        let resolvedIdentity;
        try {
          resolvedIdentity = await resolveFirebaseByContact();
        } catch (resolveError) {
          respondFirebaseIdentityError(res, resolveError, {
            createPhase: false,
          });
          return false;
        }

        if (resolvedIdentity.conflict) {
          res.status(409).json({
            success: false,
            message: "EMAIL_PHONE_DIFFERENT_ACCOUNTS",
          });
          return false;
        }

        if (!resolvedIdentity.user && error?.code === "auth/user-not-found") {
          try {
            const recreated = await firebaseAdminAuth.createUser(
              firebaseCreatePayload,
            );
            existing.firebaseUID = recreated.uid;
            return true;
          } catch (createError) {
            respondFirebaseIdentityError(res, createError, {
              createPhase: true,
            });
            return false;
          }
        }

        if (!resolvedIdentity.user) {
          respondFirebaseIdentityError(res, error, { createPhase: false });
          return false;
        }

        existing.firebaseUID = resolvedIdentity.user.uid;
        try {
          await firebaseAdminAuth.updateUser(
            existing.firebaseUID,
            firebaseUpdatePayload,
          );
          return true;
        } catch (updateError) {
          respondFirebaseIdentityError(res, updateError, {
            createPhase: false,
          });
          return false;
        }
      }
    };

    const saveAsConductor = async (existing) => {
      const wasConductor = existing.role === "conductor";

      existing.fullName = fullName;
      existing.email = email || undefined;
      existing.phone = phone || undefined;
      existing.role = "conductor";
      existing.isActive = isActive;
      existing.isBlocked = isBlocked;

      if (requesterRole === "owner") {
        existing.createdBy = req.user?._id || null;
      } else if (!existing.createdBy) {
        existing.createdBy = req.user?._id || null;
      }

      try {
        await existing.save();
      } catch (error) {
        if (respondMongoUniqueError(res, error)) return;
        throw error;
      }

      return res.status(200).json({
        success: true,
        message: wasConductor ? "CONDUCTOR_UPDATED" : "CONDUCTOR_CREATED",
        data: {
          conductor: existing,
        },
      });
    };

    const [existingByEmail, existingByPhone] = await Promise.all([
      email ? User.findOne({ email }) : Promise.resolve(null),
      phone ? User.findOne({ phone }) : Promise.resolve(null),
    ]);

    if (
      existingByEmail &&
      existingByPhone &&
      String(existingByEmail._id) !== String(existingByPhone._id)
    ) {
      return res.status(409).json({
        success: false,
        message: "EMAIL_PHONE_DIFFERENT_ACCOUNTS",
      });
    }

    let existing = existingByEmail || existingByPhone;

    if (existing) {
      const accessError = ensureConductorAccess(existing);
      if (accessError) return accessError;
      const synced = await syncFirebaseForExisting(existing);
      if (!synced) return;
      return saveAsConductor(existing);
    }

    let firebaseUID = null;
    try {
      const firebaseUser = await firebaseAdminAuth.createUser(
        firebaseCreatePayload,
      );
      firebaseUID = firebaseUser.uid;
    } catch (error) {
      if (
        error?.code !== "auth/email-already-exists" &&
        error?.code !== "auth/phone-number-already-exists"
      ) {
        return respondFirebaseIdentityError(res, error, { createPhase: true });
      }

      let resolvedIdentity;
      try {
        resolvedIdentity = await resolveFirebaseByContact();
      } catch (resolveError) {
        return respondFirebaseIdentityError(res, resolveError, {
          createPhase: false,
        });
      }

      if (resolvedIdentity.conflict) {
        return res.status(409).json({
          success: false,
          message: "EMAIL_PHONE_DIFFERENT_ACCOUNTS",
        });
      }

      if (!resolvedIdentity.user) {
        return respondFirebaseIdentityError(res, error, { createPhase: true });
      }

      firebaseUID = resolvedIdentity.user.uid;
      existing =
        (await User.findOne({ firebaseUID: firebaseUID })) ||
        (email ? await User.findOne({ email }) : null) ||
        (phone ? await User.findOne({ phone }) : null);

      if (existing) {
        const accessError = ensureConductorAccess(existing);
        if (accessError) return accessError;
        const synced = await syncFirebaseForExisting(existing);
        if (!synced) return;
        return saveAsConductor(existing);
      }
    }

    let conductor;
    try {
      conductor = await User.create({
        fullName,
        email: email || undefined,
        phone: phone || undefined,
        role: "conductor",
        firebaseUID,
        isActive,
        isBlocked,
        createdBy: req.user?._id || null,
      });
    } catch (error) {
      if (firebaseUID) {
        try {
          const linked = await User.findOne({ firebaseUID }).select("_id");
          if (!linked) {
            await firebaseAdminAuth.deleteUser(firebaseUID);
          }
        } catch (cleanupError) {
          console.error(
            "createOwnerConductor firebase rollback error:",
            cleanupError,
          );
        }
      }
      if (respondMongoUniqueError(res, error)) return;
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "CONDUCTOR_CREATED",
      data: {
        conductor,
      },
    });
  } catch (error) {
    console.error("createOwnerConductor error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const updateOwnerConductor = async (req, res) => {
  try {
    const { conductorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conductorId)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_CONDUCTOR_ID",
      });
    }

    const query = { _id: conductorId, ...getOwnerConductorFilter(req) };
    const conductor = await User.findOne(query);
    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: "CONDUCTOR_NOT_FOUND",
      });
    }

    const hasFullName = Object.prototype.hasOwnProperty.call(
      req.body,
      "fullName",
    );
    const hasEmail = Object.prototype.hasOwnProperty.call(req.body, "email");
    const hasPhone = Object.prototype.hasOwnProperty.call(req.body, "phone");
    const hasIsActive = Object.prototype.hasOwnProperty.call(
      req.body,
      "isActive",
    );
    const hasIsBlocked = Object.prototype.hasOwnProperty.call(
      req.body,
      "isBlocked",
    );

    if (
      !hasFullName &&
      !hasEmail &&
      !hasPhone &&
      !hasIsActive &&
      !hasIsBlocked
    ) {
      return res.status(400).json({
        success: false,
        message: "NO_UPDATES",
      });
    }

    const fullName = hasFullName
      ? sanitizeName(req.body?.fullName)
      : conductor.fullName;
    const email = hasEmail ? normalizeEmail(req.body?.email) : conductor.email;
    const phone = hasPhone ? normalizePhone(req.body?.phone) : conductor.phone;
    const isActive = hasIsActive
      ? req.body?.isActive === true
      : conductor.isActive;
    const isBlocked = hasIsBlocked
      ? req.body?.isBlocked === true
      : conductor.isBlocked;

    if (!fullName || fullName.length < 3) {
      return res.status(400).json({
        success: false,
        message: "FULL_NAME_REQUIRED",
      });
    }

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "EMAIL_OR_PHONE_REQUIRED",
      });
    }

    if (email && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_EMAIL",
      });
    }

    if (phone && !E164_REGEX.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_PHONE",
      });
    }

    if (email) {
      const existing = await User.findOne({
        email,
        _id: { $ne: conductor._id },
      }).select("_id");
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "EMAIL_EXISTS",
        });
      }
    }

    if (phone) {
      const existing = await User.findOne({
        phone,
        _id: { $ne: conductor._id },
      }).select("_id");
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "PHONE_EXISTS",
        });
      }
    }

    if (conductor.firebaseUID) {
      try {
        await firebaseAdminAuth.updateUser(conductor.firebaseUID, {
          displayName: fullName,
          email: email || null,
          phoneNumber: phone || null,
          disabled: !isActive || isBlocked,
        });
      } catch (error) {
        if (error?.code === "auth/email-already-exists") {
          return res.status(409).json({
            success: false,
            message: "EMAIL_EXISTS",
          });
        }
        if (error?.code === "auth/phone-number-already-exists") {
          return res.status(409).json({
            success: false,
            message: "PHONE_EXISTS",
          });
        }
        if (error?.code === "auth/invalid-phone-number") {
          return res.status(400).json({
            success: false,
            message: "INVALID_PHONE",
          });
        }
        if (error?.code === "auth/invalid-email") {
          return res.status(400).json({
            success: false,
            message: "INVALID_EMAIL",
          });
        }

        console.error("updateOwnerConductor firebase update error:", error);
        return res.status(502).json({
          success: false,
          message: "FIREBASE_UPDATE_FAILED",
        });
      }
    }

    conductor.fullName = fullName;
    conductor.email = email || undefined;
    conductor.phone = phone || undefined;
    conductor.isActive = isActive;
    conductor.isBlocked = isBlocked;
    await conductor.save();

    return res.json({
      success: true,
      message: "CONDUCTOR_UPDATED",
      data: {
        conductor,
      },
    });
  } catch (error) {
    console.error("updateOwnerConductor error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const deleteOwnerConductor = async (req, res) => {
  try {
    const { conductorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conductorId)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_CONDUCTOR_ID",
      });
    }

    const query = { _id: conductorId, ...getOwnerConductorFilter(req) };
    const conductor = await User.findOne(query);
    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: "CONDUCTOR_NOT_FOUND",
      });
    }

    const role = getRole(req);
    const ownerBusScope = getOwnerBusScopeFilter(req);
    const [totalAssignmentCount, ownedAssignmentCount] = await Promise.all([
      Bus.countDocuments({ conductor: conductor._id, isDeleted: false }),
      Bus.countDocuments({ ...ownerBusScope, conductor: conductor._id }),
    ]);

    if (role === "owner" && totalAssignmentCount > ownedAssignmentCount) {
      return res.status(409).json({
        success: false,
        message: "CONDUCTOR_ASSIGNED_OUTSIDE_OWNER_SCOPE",
      });
    }

    const unassignResult = await Bus.updateMany(
      { ...ownerBusScope, conductor: conductor._id },
      { $set: { conductor: null } },
    );

    if (conductor.firebaseUID) {
      try {
        await firebaseAdminAuth.deleteUser(conductor.firebaseUID);
      } catch (error) {
        if (error?.code !== "auth/user-not-found") {
          console.error("deleteOwnerConductor firebase delete error:", error);
          return res.status(502).json({
            success: false,
            message: "FIREBASE_DELETE_FAILED",
          });
        }
      }
    }

    await conductor.deleteOne();

    return res.json({
      success: true,
      message: "CONDUCTOR_DELETED",
      data: {
        conductorId,
        unassignedBusCount: unassignResult?.modifiedCount || 0,
      },
    });
  } catch (error) {
    console.error("deleteOwnerConductor error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const assignConductorToBus = async (req, res) => {
  try {
    const { busId } = req.params;
    const role = getRole(req);

    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_BUS_ID",
      });
    }

    const { conductorId } = req.body || {};
    const query = { _id: busId, ...getOwnerBusFilter(req) };
    const bus = await Bus.findOne(query).select(
      "_id busId busName busNumber operator route conductor busOwnerEmail createdBy",
    );

    if (!bus) {
      return res.status(404).json({
        success: false,
        message:
          role === "owner" ? "BUS_NOT_FOUND_OR_NOT_OWNED" : "BUS_NOT_FOUND",
      });
    }

    if (
      conductorId === null ||
      conductorId === undefined ||
      conductorId === ""
    ) {
      bus.conductor = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(conductorId)) {
        return res.status(400).json({
          success: false,
          message: "INVALID_CONDUCTOR_ID",
        });
      }

      const conductorQuery = {
        _id: conductorId,
        ...getOwnerConductorFilter(req),
        role: "conductor",
        isActive: true,
        isBlocked: false,
      };

      const conductor = await User.findOne(conductorQuery).select("_id");
      if (!conductor) {
        return res.status(404).json({
          success: false,
          message: "CONDUCTOR_NOT_FOUND_OR_NOT_OWNED",
        });
      }

      bus.conductor = conductor._id;
    }

    await bus.save();

    const updatedBus = await Bus.findById(bus._id)
      .select("_id busId busName busNumber operator route conductor")
      .populate({
        path: "conductor",
        select: "_id fullName email phone role isActive isBlocked createdBy",
      })
      .lean();

    return res.json({
      success: true,
      message: bus.conductor ? "CONDUCTOR_ASSIGNED" : "CONDUCTOR_UNASSIGNED",
      data: updatedBus,
    });
  } catch (error) {
    console.error("assignConductorToBus error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};
