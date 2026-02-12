// services/seatLockService.js
import { Bus } from "../models/bus.js";
import { Booking } from "../models/booking.js";
import { SeatHold } from "../models/seatHold.js";
import mongoose from "mongoose";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 12);

const normalizeSeatToken = (value) =>
  String(value || "").trim().toUpperCase();

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

const formatDateKey = (dateValue) => {
  const date = new Date(dateValue);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildTripKey = (busId, travelDate, direction) =>
  `${busId}_${formatDateKey(travelDate)}_${direction}`;

const getBookedSeatIds = (bus, travelDate, direction) => {
  if (!bus?.bookedSeats) return [];
  const travelTime = new Date(travelDate).getTime();
  return bus.bookedSeats
    .filter(
      (bs) =>
        bs.travelDate?.getTime() === travelTime && bs.direction === direction
    )
    .map((bs) => bs.seatNumber);
};

// Default lock duration in minutes
const DEFAULT_LOCK_DURATION = 10;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 100;

// Helper function to wait for a specified time
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    sessionId = null,
    lockDurationMinutes = DEFAULT_LOCK_DURATION,
  }) {
    // proactively cleanup expired locks so availability check is accurate
    await SeatLockService.cleanupExpiredLocks();

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

        const bookedSeatIds = getBookedSeatIds(
          bus,
          travelDateObj,
          direction
        );
        const bookedConflicts = seatIds.filter((seatId) =>
          bookedSeatIds.includes(seatId)
        );
        if (bookedConflicts.length > 0) {
          throw new Error(
            `Seats ${bookedConflicts.join(", ")} are already booked`
          );
        }

        const tripKey = buildTripKey(bus._id.toString(), travelDateObj, direction);

        await SeatHold.deleteMany({
          bus: busId,
          travelDate: travelDateObj,
          direction,
          user: userId,
          sessionId,
          status: "HOLD",
          seatId: { $in: seatIds },
        }).session(session);

        const activeHolds = await SeatHold.find({
          bus: busId,
          travelDate: travelDateObj,
          direction,
          status: "HOLD",
          expiresAt: { $gt: now },
          seatId: { $in: seatIds },
        }).session(session);

        if (activeHolds.length > 0) {
          const lockedSeats = activeHolds.map((hold) => hold.seatId);
          throw new Error(
            `Seats ${lockedSeats.join(", ")} are not available`
          );
        }

        const bookedHolds = await SeatHold.find({
          bus: busId,
          travelDate: travelDateObj,
          direction,
          status: "BOOKED",
          seatId: { $in: seatIds },
        }).session(session);

        if (bookedHolds.length > 0) {
          const lockedSeats = bookedHolds.map((hold) => hold.seatId);
          throw new Error(
            `Seats ${lockedSeats.join(", ")} are already booked`
          );
        }

        const holds = seatIds.map((seatId) => ({
          bus: busId,
          tripKey,
          travelDate: travelDateObj,
          direction,
          seatId,
          status: "HOLD",
          expiresAt,
          user: userId,
          sessionId,
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

        const holdsToConvert = await SeatHold.find({
          bus: busId,
          travelDate: travelDateObj,
          direction,
          user: userId,
          sessionId,
          status: "HOLD",
          expiresAt: { $gt: now },
        }).session(session);

        let seatIds = holdsToConvert.map((hold) => hold.seatId);

        if (seatIds.length === 0) {
          const booking = bookingId
            ? await Booking.findById(bookingId).session(session)
            : null;

          if (!booking) {
            throw new Error("No valid locks found to convert");
          }

          seatIds = Array.isArray(booking.passengers)
            ? booking.passengers
                .map((passenger) => normalizeSeatToken(passenger?.seatNumber))
                .filter(Boolean)
            : [];

          if (seatIds.length === 0) {
            throw new Error("No seats found for booking");
          }

          const bookedSeatSet = new Set(
            getBookedSeatIds(bus, travelDateObj, direction),
          );
          const allBooked = seatIds.every((seatId) =>
            bookedSeatSet.has(seatId),
          );

          if (allBooked) {
            await SeatHold.updateMany(
              {
                bus: busId,
                travelDate: travelDateObj,
                direction,
                seatId: { $in: seatIds },
              },
              { $set: { status: "BOOKED", booking: bookingId, expiresAt: null } },
              { session },
            );

            await session.commitTransaction();

            return {
              success: true,
              convertedSeats: seatIds,
              message: "Seats already booked for this payment",
            };
          }

          const newBookedSeats = seatIds.map((seatNumber) => ({
            seatNumber,
            bookingId,
            bookingDate: now,
            travelDate: travelDateObj,
            direction,
          }));

          const result = await Bus.findOneAndUpdate(
            {
              _id: busId,
              availableSeats: { $gte: seatIds.length },
              bookedSeats: {
                $not: {
                  $elemMatch: {
                    seatNumber: { $in: seatIds },
                    travelDate: travelDateObj,
                    direction,
                  },
                },
              },
            },
            {
              $push: {
                bookedSeats: { $each: newBookedSeats },
              },
              $inc: {
                availableSeats: -seatIds.length,
              },
            },
            {
              session,
              new: true,
              runValidators: true,
            },
          );

          if (!result) {
            throw new Error("Seats are already booked or unavailable");
          }

          await SeatHold.updateMany(
            {
              bus: busId,
              travelDate: travelDateObj,
              direction,
              seatId: { $in: seatIds },
              status: "HOLD",
            },
            { $set: { status: "BOOKED", booking: bookingId, expiresAt: null } },
            { session },
          );

          const tripKey = buildTripKey(
            busId.toString ? busId.toString() : busId,
            travelDateObj,
            direction,
          );

          try {
            await SeatHold.insertMany(
              seatIds.map((seatId) => ({
                bus: busId,
                tripKey,
                travelDate: travelDateObj,
                direction,
                seatId,
                status: "BOOKED",
                expiresAt: null,
                user: userId,
                sessionId,
                booking: bookingId,
              })),
              { session, ordered: false },
            );
          } catch (insertError) {
            if (insertError?.code !== 11000) {
              throw insertError;
            }
          }

          await session.commitTransaction();

          return {
            success: true,
            convertedSeats: seatIds,
            message: "Seats booked without active locks",
          };
        }
        const bookedSeatIds = getBookedSeatIds(
          bus,
          travelDateObj,
          direction
        );
        const bookedConflicts = seatIds.filter((seatId) =>
          bookedSeatIds.includes(seatId)
        );

        if (bookedConflicts.length > 0) {
          throw new Error(
            `Seats ${bookedConflicts.join(", ")} are already booked`
          );
        }

        const newBookedSeats = seatIds.map((seatNumber) => ({
          seatNumber,
          bookingId,
          bookingDate: now,
          travelDate: travelDateObj,
          direction,
        }));

        const result = await Bus.findOneAndUpdate(
          {
            _id: busId,
            availableSeats: { $gte: seatIds.length },
            bookedSeats: {
              $not: {
                $elemMatch: {
                  seatNumber: { $in: seatIds },
                  travelDate: travelDateObj,
                  direction,
                },
              },
            },
          },
          {
            $push: {
              bookedSeats: { $each: newBookedSeats },
            },
            $inc: {
              availableSeats: -seatIds.length,
            },
          },
          {
            session,
            new: true,
            runValidators: true,
          }
        );

        if (!result) {
          throw new Error("Seats are already booked or unavailable");
        }

        await SeatHold.updateMany(
          { _id: { $in: holdsToConvert.map((hold) => hold._id) } },
          { $set: { status: "BOOKED", booking: bookingId, expiresAt: null } },
          { session }
        );

        await session.commitTransaction();

        return {
          success: true,
          convertedSeats: seatIds,
          message: `${seatIds.length} seats converted to permanent booking`,
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
        getBookedSeatIds(bus, travelDateObj, direction)
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
