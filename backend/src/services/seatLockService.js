// services/seatLockService.js
import { Bus } from "../models/bus.js";
import { Booking } from "../models/booking.js";
import { SeatHold } from "../models/seatHold.js";
import mongoose from "mongoose";
import { customAlphabet } from "nanoid";
import {
  formatDateKey,
  getRouteExtentSegment,
  getSeatEntrySegment,
  normalizeDirection,
  normalizeSegmentBounds,
  normalizeSeatToken,
  resolveJourneySegment,
  segmentsOverlap,
} from "../utils/seatSegment.js";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 12);

const resolveSeatIdsForInputs = (bus, seatInputs) => {
  const seats = Array.isArray(bus?.seatLayout?.seats) ? bus.seatLayout.seats : [];
  const seatIdSet = new Set(seats.map((seat) => seat.seatId));
  const labelMap = new Map(seats.map((seat) => [seat.label, seat.seatId]));

  const resolved = seatInputs.map((input) => {
    const normalized = normalizeSeatToken(input);
    if (!normalized) return null;
    if (seatIdSet.has(normalized)) return normalized;
    return labelMap.get(normalized) || null;
  });

  const unknown = resolved
    .map((value, index) => (value ? null : normalizeSeatToken(seatInputs[index])))
    .filter(Boolean);

  return { resolved, unknown };
};

const formatSegmentKeyPart = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric.toFixed(3).replace(/\.?0+$/, "");
};

const buildTripKey = (
  busId,
  travelDate,
  direction,
  segmentStartKm = null,
  segmentEndKm = null
) => {
  const baseKey = `${busId}_${formatDateKey(travelDate)}_${direction}`;
  const normalizedSegment = normalizeSegmentBounds(segmentStartKm, segmentEndKm);

  if (!normalizedSegment) return baseKey;

  const startToken = formatSegmentKeyPart(normalizedSegment.segmentStartKm);
  const endToken = formatSegmentKeyPart(normalizedSegment.segmentEndKm);
  if (!startToken || !endToken) return baseKey;

  return `${baseKey}_${startToken}_${endToken}`;
};

const getBookedSeatIdsForTrip = (bus, travelDate, direction) => {
  if (!Array.isArray(bus?.bookedSeats)) return [];
  const dateKey = formatDateKey(travelDate);
  const normalizedDirection = normalizeDirection(direction);
  return bus.bookedSeats
    .filter(
      (entry) =>
        formatDateKey(entry?.travelDate) === dateKey &&
        normalizeDirection(entry?.direction) === normalizedDirection,
    )
    .map((entry) => normalizeSeatToken(entry?.seatNumber))
    .filter(Boolean);
};

// Default lock duration in minutes
const DEFAULT_LOCK_DURATION = 10;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 100;

// Helper function to wait for a specified time
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildRequestedSegmentOrThrow = ({
  route,
  direction,
  boardingPoint,
  droppingPoint,
}) => {
  const normalizedDirection = normalizeDirection(direction);
  const hasPoints = Boolean(boardingPoint || droppingPoint);

  if (!hasPoints) {
    return {
      ...getRouteExtentSegment(route, normalizedDirection),
      boardingPoint: null,
      droppingPoint: null,
      direction: normalizedDirection,
      source: "full-route",
    };
  }

  if (!boardingPoint || !droppingPoint) {
    throw new Error("Both boardingPoint and droppingPoint are required");
  }

  const resolved = resolveJourneySegment({
    route,
    direction: normalizedDirection,
    boardingPoint,
    droppingPoint,
  });

  if (!resolved) {
    throw new Error("Invalid boarding/dropping points for route");
  }

  return {
    ...resolved,
    boardingPoint: String(boardingPoint).trim(),
    droppingPoint: String(droppingPoint).trim(),
    direction: normalizedDirection,
    source: "journey-segment",
  };
};

const getEntryBookingId = (entry) => {
  if (!entry?.bookingId) return "";
  if (typeof entry.bookingId === "string") return entry.bookingId;
  if (entry.bookingId?._id) return String(entry.bookingId._id);
  return String(entry.bookingId);
};

const buildBookingSegmentMap = async ({ entries, session }) => {
  const bookingIds = Array.from(
    new Set(
      (entries || [])
        .map((entry) => getEntryBookingId(entry))
        .filter(Boolean),
    ),
  ).filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (bookingIds.length === 0) return new Map();

  const bookings = await Booking.find({ _id: { $in: bookingIds } })
    .select("_id route direction boardingPoint droppingPoint")
    .session(session)
    .lean();

  const bookingMap = new Map();
  for (const booking of bookings) {
    const segment = resolveJourneySegment({
      route: booking?.route,
      direction: normalizeDirection(booking?.direction),
      boardingPoint: booking?.boardingPoint,
      droppingPoint: booking?.droppingPoint,
    });
    if (segment) {
      bookingMap.set(String(booking._id), segment);
    }
  }
  return bookingMap;
};

const findBookedSeatConflicts = ({
  bus,
  travelDate,
  direction,
  seatIds,
  requestedSegment,
  bookingSegmentMap,
}) => {
  if (!Array.isArray(bus?.bookedSeats) || bus.bookedSeats.length === 0) {
    return [];
  }

  const requestedDateKey = formatDateKey(travelDate);
  const normalizedDirection = normalizeDirection(direction);
  const requestedSet = new Set((seatIds || []).map((seat) => normalizeSeatToken(seat)));
  const conflictSet = new Set();

  for (const entry of bus.bookedSeats) {
    const seatNumber = normalizeSeatToken(entry?.seatNumber);
    if (!seatNumber || !requestedSet.has(seatNumber)) continue;
    if (formatDateKey(entry?.travelDate) !== requestedDateKey) continue;
    if (normalizeDirection(entry?.direction) !== normalizedDirection) continue;

    const bookingSegment = bookingSegmentMap.get(getEntryBookingId(entry)) || null;
    const entrySegment = getSeatEntrySegment({
      seatEntry: entry,
      route: bus.route,
      direction: normalizedDirection,
      bookingSegment,
    });

    if (
      segmentsOverlap(
        requestedSegment.segmentStartKm,
        requestedSegment.segmentEndKm,
        entrySegment.segmentStartKm,
        entrySegment.segmentEndKm,
      )
    ) {
      conflictSet.add(seatNumber);
    }
  }

  return Array.from(conflictSet);
};

const findHoldSeatConflicts = ({
  holds,
  requestedSegment,
  seatIds,
  defaultRoute,
  direction,
}) => {
  const requestedSet = new Set((seatIds || []).map((seat) => normalizeSeatToken(seat)));
  const conflictSet = new Set();
  const normalizedDirection = normalizeDirection(direction);

  for (const hold of holds || []) {
    const seatId = normalizeSeatToken(hold?.seatId);
    if (!seatId || !requestedSet.has(seatId)) continue;

    const entrySegment = getSeatEntrySegment({
      seatEntry: hold,
      route: defaultRoute,
      direction: normalizedDirection,
      bookingSegment: null,
    });

    if (
      segmentsOverlap(
        requestedSegment.segmentStartKm,
        requestedSegment.segmentEndKm,
        entrySegment.segmentStartKm,
        entrySegment.segmentEndKm,
      )
    ) {
      conflictSet.add(seatId);
    }
  }

  return Array.from(conflictSet);
};

export class SeatLockService {
  /**
   * Clean expired locks - safe internal helper used before important ops
   */
  static async cleanupExpiredLocks() {
    try {
      const now = new Date();
      const result = await SeatHold.updateMany(
        {
          status: "HOLD",
          expiresAt: { $lte: now },
        },
        {
          $set: { status: "CANCELLED", expiresAt: now },
        }
      );
      return {
        success: true,
        modifiedCount: result.modifiedCount,
      };
    } catch (error) {
      console.error("cleanupExpiredLocks error:", error);
      throw error;
    }
  }

  /**
   * Lock seats temporarily for a user session with retry logic
   */
  static async lockSeats({
    busId,
    seatNumbers,
    userId,
    travelDate,
    direction = "forward",
    boardingPoint = null,
    droppingPoint = null,
    sessionId = null,
    lockDurationMinutes = DEFAULT_LOCK_DURATION,
  }) {
    // proactively cleanup expired locks so availability check is accurate
    await SeatLockService.cleanupExpiredLocks();

    const normalizedDirection = normalizeDirection(direction);
    let attempt = 0;
    let lastError;

    while (attempt < MAX_RETRY_ATTEMPTS) {
      const session = await mongoose.startSession();

      try {
        session.startTransaction();

        // Generate session ID if not provided
        if (!sessionId) {
          sessionId = `session_${Date.now()}_${nanoid()}`;
        }

        const travelDateObj = new Date(travelDate);
        const now = new Date();
        const expiresAt = new Date(
          now.getTime() + lockDurationMinutes * 60 * 1000
        );

        const bus = await Bus.findById(busId).session(session);
        if (!bus) {
          throw new Error("Bus not found");
        }

        const requestedSegment = buildRequestedSegmentOrThrow({
          route: bus.route,
          direction: normalizedDirection,
          boardingPoint,
          droppingPoint,
        });

        const normalizedInputs = Array.isArray(seatNumbers)
          ? seatNumbers.map((seat) => normalizeSeatToken(seat))
          : [];
        const { resolved: seatIds, unknown } = resolveSeatIdsForInputs(
          bus,
          normalizedInputs
        );
        if (unknown.length > 0) {
          throw new Error(`Invalid seat identifiers: ${unknown.join(", ")}`);
        }
        const uniqueSeatIds = new Set(seatIds);
        if (uniqueSeatIds.size !== seatIds.length) {
          throw new Error("Duplicate seats are not allowed");
        }

        const seatIdSet = new Set(seatIds);
        const sameTripEntries = (bus.bookedSeats || []).filter(
          (entry) =>
            formatDateKey(entry?.travelDate) === formatDateKey(travelDateObj) &&
            normalizeDirection(entry?.direction) === normalizedDirection &&
            seatIdSet.has(normalizeSeatToken(entry?.seatNumber)),
        );
        const bookingSegmentMap = await buildBookingSegmentMap({
          entries: sameTripEntries,
          session,
        });

        const bookedConflicts = findBookedSeatConflicts({
          bus,
          travelDate: travelDateObj,
          direction: normalizedDirection,
          seatIds,
          requestedSegment,
          bookingSegmentMap,
        });
        if (bookedConflicts.length > 0) {
          throw new Error(
            `Seats ${bookedConflicts.join(", ")} are already booked`
          );
        }

        const tripKey = buildTripKey(
          bus._id.toString(),
          travelDateObj,
          normalizedDirection,
          requestedSegment.segmentStartKm,
          requestedSegment.segmentEndKm
        );

        // Legacy cleanup: regular bookings should not stay as BOOKED holds.
        await SeatHold.updateMany(
          {
            bus: busId,
            travelDate: travelDateObj,
            direction: normalizedDirection,
            status: "BOOKED",
            seatId: { $in: seatIds },
            $or: [
              { "metadata.source": { $exists: false } },
              { "metadata.source": { $ne: "conductor-offline" } },
            ],
          },
          {
            $set: {
              status: "CANCELLED",
              expiresAt: now,
            },
          },
          { session },
        );

        await SeatHold.deleteMany({
          bus: busId,
          travelDate: travelDateObj,
          direction: normalizedDirection,
          user: userId,
          sessionId,
          status: "HOLD",
          seatId: { $in: seatIds },
        }).session(session);

        const activeHolds = await SeatHold.find({
          bus: busId,
          travelDate: travelDateObj,
          direction: normalizedDirection,
          status: "HOLD",
          expiresAt: { $gt: now },
          seatId: { $in: seatIds },
        })
          .session(session)
          .lean();

        const holdConflicts = findHoldSeatConflicts({
          holds: activeHolds,
          requestedSegment,
          seatIds,
          defaultRoute: bus.route,
          direction: normalizedDirection,
        });

        if (holdConflicts.length > 0) {
          throw new Error(
            `Seats ${holdConflicts.join(", ")} are not available`
          );
        }

        const bookedHolds = await SeatHold.find({
          bus: busId,
          travelDate: travelDateObj,
          direction: normalizedDirection,
          status: "BOOKED",
          "metadata.source": "conductor-offline",
          seatId: { $in: seatIds },
        })
          .session(session)
          .lean();

        const bookedHoldConflicts = findHoldSeatConflicts({
          holds: bookedHolds,
          requestedSegment,
          seatIds,
          defaultRoute: bus.route,
          direction: normalizedDirection,
        });

        if (bookedHoldConflicts.length > 0) {
          throw new Error(
            `Seats ${bookedHoldConflicts.join(", ")} are already booked`
          );
        }

        const holds = seatIds.map((seatId) => ({
          bus: busId,
          tripKey,
          travelDate: travelDateObj,
          direction: normalizedDirection,
          seatId,
          status: "HOLD",
          expiresAt,
          user: userId,
          sessionId,
          segmentStartKm: requestedSegment.segmentStartKm,
          segmentEndKm: requestedSegment.segmentEndKm,
          metadata: {
            source: "checkout-lock",
            boardingPoint: requestedSegment.boardingPoint,
            droppingPoint: requestedSegment.droppingPoint,
          },
        }));

        await SeatHold.insertMany(holds, { session, ordered: true });

        await session.commitTransaction();

        return {
          success: true,
          sessionId,
          lockedSeats: seatIds,
          expiresAt,
          message: `${seatIds.length} seats locked successfully`,
        };
      } catch (error) {
        await session.abortTransaction();
        lastError = error;

        if (error && error.code === 11000) {
          error.message = "Seats are not available";
        }

        const isRetryableError =
          (error &&
            error.message &&
            (error.message.includes("Write conflict") ||
              error.message.includes("was modified by another operation") ||
              error.message.includes("Failed to add seat locks"))) ||
          error.code === 112; // WriteConflict

        if (isRetryableError && attempt < MAX_RETRY_ATTEMPTS - 1) {
          attempt++;
          console.warn(
            `Seat lock attempt ${attempt} failed, retrying in ${
              RETRY_DELAY_MS * attempt
            }ms...`,
            error.message
          );
          await wait(RETRY_DELAY_MS * attempt);
          continue;
        }

        throw error;
      } finally {
        session.endSession();
      }
    }

    throw lastError;
  }

  /**
   * Release seat locks for a specific session with retry logic
   */
  static async releaseLocks({
    busId,
    userId,
    sessionId,
    travelDate,
    direction = "forward",
    seatNumbers = null, // If null, release all locks for the session
  }) {
    let attempt = 0;
    let lastError;

    while (attempt < MAX_RETRY_ATTEMPTS) {
      const session = await mongoose.startSession();

      try {
        session.startTransaction();

        const travelDateObj = new Date(travelDate);
        let resolvedSeatNumbers = seatNumbers;

        if (Array.isArray(seatNumbers) && seatNumbers.length > 0) {
          const bus = await Bus.findById(busId).session(session);
          if (!bus) {
            throw new Error("Bus not found");
          }
          const normalizedInputs = seatNumbers.map((seat) =>
            normalizeSeatToken(seat)
          );
          const { resolved, unknown } = resolveSeatIdsForInputs(
            bus,
            normalizedInputs
          );
          if (unknown.length > 0) {
            throw new Error(`Invalid seat identifiers: ${unknown.join(", ")}`);
          }
          resolvedSeatNumbers = resolved;
        }

        const lockFilter = {
          bus: busId,
          travelDate: travelDateObj,
          direction,
          user: userId,
          sessionId,
          status: "HOLD",
        };

        if (Array.isArray(resolvedSeatNumbers) && resolvedSeatNumbers.length > 0) {
          lockFilter.seatId = { $in: resolvedSeatNumbers };
        }

        const result = await SeatHold.updateMany(
          lockFilter,
          { $set: { status: "CANCELLED", expiresAt: new Date() } },
          { session }
        );

        await session.commitTransaction();

        return {
          success: true,
          releasedCount: result.modifiedCount,
          message: `Seat locks released successfully`,
        };
      } catch (error) {
        await session.abortTransaction();
        lastError = error;

        const isRetryableError =
          (error &&
            error.message &&
            error.message.includes("Write conflict")) ||
          error.code === 112;

        if (isRetryableError && attempt < MAX_RETRY_ATTEMPTS - 1) {
          attempt++;
          await wait(RETRY_DELAY_MS * attempt);
          continue;
        }

        throw error;
      } finally {
        session.endSession();
      }
    }

    throw lastError;
  }

  /**
   * Extend lock duration for existing locks - ENHANCED VERSION
   */
  static async extendLocks({
    busId,
    userId,
    sessionId,
    travelDate,
    direction = "forward",
    additionalMinutes = DEFAULT_LOCK_DURATION,
  }) {
    let attempt = 0;
    let lastError;

    while (attempt < MAX_RETRY_ATTEMPTS) {
      const session = await mongoose.startSession();

      try {
        session.startTransaction();

        const travelDateObj = new Date(travelDate);
        const now = new Date();
        const newExpiryTime = new Date(
          now.getTime() + additionalMinutes * 60 * 1000
        );

        const result = await SeatHold.updateMany(
          {
            bus: busId,
            travelDate: travelDateObj,
            direction,
            user: userId,
            sessionId,
            status: "HOLD",
            expiresAt: { $gt: now },
          },
          { $set: { expiresAt: newExpiryTime } },
          { session }
        );

        await session.commitTransaction();

        return {
          success: true,
          extendedCount: result.modifiedCount,
          newExpiryTime,
          message: `Locks extended by ${additionalMinutes} minutes`,
        };
      } catch (error) {
        await session.abortTransaction();
        lastError = error;

        const isRetryableError =
          (error &&
            error.message &&
            error.message.includes("Write conflict")) ||
          error.code === 112;

        if (isRetryableError && attempt < MAX_RETRY_ATTEMPTS - 1) {
          attempt++;
          await wait(RETRY_DELAY_MS * attempt);
          continue;
        }

        throw error;
      } finally {
        session.endSession();
      }
    }

    throw lastError;
  }

  /**
   * Check lock status and extend if expiring soon
   */
  static async checkAndExtendLocks({
    busId,
    userId,
    sessionId,
    travelDate,
    direction = "forward",
    extendIfExpiringInMinutes = 5,
  }) {
    try {
      await SeatLockService.cleanupExpiredLocks();

      const travelDateObj = new Date(travelDate);
      const now = new Date();
      const thresholdTime = new Date(
        now.getTime() + extendIfExpiringInMinutes * 60 * 1000
      );

      // Find locks that are expiring soon
      const expiringLocks = await SeatHold.find({
        bus: busId,
        travelDate: travelDateObj,
        direction,
        user: userId,
        sessionId,
        status: "HOLD",
        expiresAt: { $gt: now, $lte: thresholdTime },
      }).lean();

      if (expiringLocks.length > 0) {
        // Extend the locks
        const extendResult = await SeatLockService.extendLocks({
          busId,
          userId,
          sessionId,
          travelDate,
          direction,
          additionalMinutes: DEFAULT_LOCK_DURATION,
        });

        return {
          success: true,
          extended: true,
          expiringLocks: expiringLocks.length,
          ...extendResult,
        };
      }

      return {
        success: true,
        extended: false,
        message: "No locks need extension",
      };
    } catch (error) {
      console.error("Error checking and extending locks:", error);
      throw error;
    }
  }

  /**
   * Convert temporary locks to permanent bookings with retry logic
   * Should be called from a payment webhook / verified payment handler only
   */
  static async convertLocksToBooking({
    busId,
    userId,
    sessionId,
    travelDate,
    direction = "forward",
    bookingId,
  }) {
    // Make sure expired locks are removed before conversion
    await SeatLockService.cleanupExpiredLocks();

    const normalizedDirection = normalizeDirection(direction);
    let attempt = 0;
    let lastError;

    while (attempt < MAX_RETRY_ATTEMPTS) {
      const session = await mongoose.startSession();

      try {
        session.startTransaction();

        const travelDateObj = new Date(travelDate);
        const now = new Date();

        const bus = await Bus.findById(busId).session(session);
        if (!bus) {
          throw new Error("Bus not found");
        }

        const booking = bookingId
          ? await Booking.findById(bookingId)
              .select(
                "_id route direction boardingPoint droppingPoint passengers",
              )
              .session(session)
          : null;
        const effectiveDirection = booking
          ? normalizeDirection(booking.direction || normalizedDirection)
          : normalizedDirection;

        const holdsToConvert = await SeatHold.find({
          bus: busId,
          travelDate: travelDateObj,
          direction: effectiveDirection,
          user: userId,
          sessionId,
          status: "HOLD",
          expiresAt: { $gt: now },
        })
          .session(session)
          .lean();

        let seatIds = holdsToConvert
          .map((hold) => normalizeSeatToken(hold?.seatId))
          .filter(Boolean);

        if (seatIds.length === 0 && booking) {
          seatIds = Array.isArray(booking.passengers)
            ? booking.passengers
                .map((passenger) => normalizeSeatToken(passenger?.seatNumber))
                .filter(Boolean)
            : [];
        }

        if (seatIds.length === 0) {
          throw new Error("No valid locks found to convert");
        }

        if (new Set(seatIds).size !== seatIds.length) {
          throw new Error("Duplicate seats found while converting locks");
        }

        let requestedSegment = null;
        if (booking) {
          requestedSegment = resolveJourneySegment({
            route: booking.route || bus.route,
            direction: effectiveDirection,
            boardingPoint: booking.boardingPoint,
            droppingPoint: booking.droppingPoint,
          });
        }

        if (!requestedSegment && holdsToConvert.length > 0) {
          requestedSegment = getSeatEntrySegment({
            seatEntry: holdsToConvert[0],
            route: bus.route,
            direction: effectiveDirection,
            bookingSegment: null,
          });
        }

        if (!requestedSegment) {
          requestedSegment = getRouteExtentSegment(bus.route, effectiveDirection);
        }

        const seatSet = new Set(seatIds);
        const sameTripEntries = (bus.bookedSeats || []).filter(
          (entry) =>
            formatDateKey(entry?.travelDate) === formatDateKey(travelDateObj) &&
            normalizeDirection(entry?.direction) === effectiveDirection &&
            seatSet.has(normalizeSeatToken(entry?.seatNumber)),
        );
        const bookingSegmentMap = await buildBookingSegmentMap({
          entries: sameTripEntries,
          session,
        });

        const bookedConflicts = findBookedSeatConflicts({
          bus,
          travelDate: travelDateObj,
          direction: effectiveDirection,
          seatIds,
          requestedSegment,
          bookingSegmentMap,
        });

        if (bookedConflicts.length > 0) {
          const sameBookingAlreadyReserved = seatIds.every((seatId) => {
            const reservedBySameBooking = sameTripEntries.some((entry) => {
              if (normalizeSeatToken(entry?.seatNumber) !== seatId) return false;
              if (String(entry?.bookingId || "") !== String(bookingId || "")) {
                return false;
              }
              const bookingSegment =
                bookingSegmentMap.get(getEntryBookingId(entry)) || null;
              const entrySegment = getSeatEntrySegment({
                seatEntry: entry,
                route: bus.route,
                direction: effectiveDirection,
                bookingSegment,
              });
              return segmentsOverlap(
                requestedSegment.segmentStartKm,
                requestedSegment.segmentEndKm,
                entrySegment.segmentStartKm,
                entrySegment.segmentEndKm,
              );
            });
            return reservedBySameBooking;
          });

          if (sameBookingAlreadyReserved) {
            await SeatHold.updateMany(
              {
                _id: { $in: holdsToConvert.map((hold) => hold._id) },
              },
              {
                $set: {
                  status: "CANCELLED",
                  booking: bookingId || null,
                  expiresAt: now,
                },
              },
              { session },
            );

            await session.commitTransaction();

            return {
              success: true,
              convertedSeats: seatIds,
              message: "Seats already booked for this payment",
            };
          }

          throw new Error(
            `Seats ${bookedConflicts.join(", ")} are already booked`
          );
        }

        const seatsToInsert = seatIds.filter((seatId) => {
          return !sameTripEntries.some((entry) => {
            if (normalizeSeatToken(entry?.seatNumber) !== seatId) return false;
            if (String(entry?.bookingId || "") !== String(bookingId || "")) {
              return false;
            }
            const bookingSegment =
              bookingSegmentMap.get(getEntryBookingId(entry)) || null;
            const entrySegment = getSeatEntrySegment({
              seatEntry: entry,
              route: bus.route,
              direction: effectiveDirection,
              bookingSegment,
            });
            return segmentsOverlap(
              requestedSegment.segmentStartKm,
              requestedSegment.segmentEndKm,
              entrySegment.segmentStartKm,
              entrySegment.segmentEndKm,
            );
          });
        });

        const newBookedSeats = seatsToInsert.map((seatNumber) => ({
          seatNumber,
          bookingId,
          bookingDate: now,
          travelDate: travelDateObj,
          direction: effectiveDirection,
          boardingPoint: booking?.boardingPoint || null,
          droppingPoint: booking?.droppingPoint || null,
          segmentStartKm: requestedSegment.segmentStartKm,
          segmentEndKm: requestedSegment.segmentEndKm,
        }));

        if (newBookedSeats.length > 0) {
          bus.bookedSeats.push(...newBookedSeats);
        }

        await SeatHold.updateMany(
          { _id: { $in: holdsToConvert.map((hold) => hold._id) } },
          {
            $set: {
              status: "CANCELLED",
              booking: bookingId || null,
              expiresAt: now,
            },
          },
          { session }
        );

        await bus.save({ session });

        await session.commitTransaction();

        return {
          success: true,
          convertedSeats: seatIds,
          message:
            holdsToConvert.length > 0
              ? `${seatIds.length} seats converted to permanent booking`
              : "Seats booked without active locks",
        };
      } catch (error) {
        await session.abortTransaction();
        lastError = error;

        const isRetryableError =
          (error &&
            error.message &&
            error.message.includes("Write conflict")) ||
          error.code === 112;

        if (isRetryableError && attempt < MAX_RETRY_ATTEMPTS - 1) {
          attempt++;
          await wait(RETRY_DELAY_MS * attempt);
          continue;
        }

        throw error;
      } finally {
        session.endSession();
      }
    }

    throw lastError;
  }

  /**
   * Clean up expired locks (used by cron job)
   */
  static async cleanupExpiredLocksJob() {
    try {
      const now = new Date();
      const result = await SeatHold.updateMany(
        {
          status: "HOLD",
          expiresAt: { $lte: now },
        },
        {
          $set: { status: "CANCELLED", expiresAt: now },
        }
      );

      return {
        success: true,
        modifiedCount: result.modifiedCount,
      };
    } catch (error) {
      console.error("Error cleaning up expired locks:", error);
      throw error;
    }
  }

  /**
   * Get lock status for seats
   */
  static async getLockStatus(
    busId,
    travelDate,
    seatNumbers,
    direction = "forward"
  ) {
    // Make sure expired locks are cleaned so status is accurate
    await SeatLockService.cleanupExpiredLocks();

    try {
      const bus = await Bus.findById(busId);
      if (!bus) {
        throw new Error("Bus not found");
      }

      const travelDateObj = new Date(travelDate);
      const now = new Date();

      const seatInputs = Array.isArray(seatNumbers) ? seatNumbers : [];
      const normalizedInputs = seatInputs.map((seat) =>
        normalizeSeatToken(seat)
      );
      const { resolved } = resolveSeatIdsForInputs(
        bus,
        normalizedInputs
      );
      const validSeatIds = resolved.filter(Boolean);
      const bookedSeatSet = new Set(
        getBookedSeatIdsForTrip(bus, travelDateObj, direction)
      );

      const activeHolds = await SeatHold.find({
        bus: busId,
        travelDate: travelDateObj,
        direction,
        status: "HOLD",
        expiresAt: { $gt: now },
        seatId: { $in: validSeatIds },
      }).lean();

      const holdMap = new Map(
        activeHolds.map((hold) => [hold.seatId, hold])
      );

      const lockStatus = resolved.map((seatNumber, index) => {
        if (!seatNumber) {
          return {
            seatNumber: normalizedInputs[index],
            status: "invalid",
            direction,
            lockedBy: null,
            expiresAt: null,
          };
        }
        // Check if permanently booked
        const isBooked = bookedSeatSet.has(seatNumber);

        if (isBooked) {
          return {
            seatNumber,
            status: "booked",
            direction: direction,
            lockedBy: null,
            expiresAt: null,
          };
        }

        // Check if temporarily locked
        const lock = holdMap.get(seatNumber);

        if (lock) {
          return {
            seatNumber,
            status: "locked",
            direction: lock.direction,
            lockedBy: lock.userId,
            sessionId: lock.sessionId,
            expiresAt: lock.expiresAt,
          };
        }

        return {
          seatNumber,
          status: "available",
          lockedBy: null,
          expiresAt: null,
        };
      });

      return {
        success: true,
        lockStatus,
      };
    } catch (error) {
      throw error;
    }
  }
}

export default SeatLockService;
