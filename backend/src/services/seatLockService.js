// services/seatLockService.js
import { Bus } from "../models/bus.js";
import mongoose from "mongoose";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 12);

// Default lock duration in minutes
const DEFAULT_LOCK_DURATION = 15; // increased from 7 to 15 minutes
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
      const result = await Bus.updateMany(
        { "temporaryLocks.expiresAt": { $lte: now } },
        {
          $pull: {
            temporaryLocks: {
              expiresAt: { $lte: now },
            },
          },
        }
      );
      // optional: update availableSeats counts if you maintain them elsewhere
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

        // First, get the current bus state (fresh document)
        const bus = await Bus.findById(busId).session(session);
        if (!bus) {
          throw new Error("Bus not found");
        }

        // Check availability while excluding user's existing locks (so user can re-lock same seats)
        const availability = bus.areSeatsAvailable(
          seatNumbers,
          travelDateObj,
          userId,
          sessionId
        );

        if (!availability.available) {
          throw new Error(
            `Seats ${availability.conflictingSeats.join(
              ", "
            )} are not available`
          );
        }

        // Remove any existing locks for this user/session on these seats (idempotency)
        const updatedBus = await Bus.findOneAndUpdate(
          {
            _id: busId,
            __v: bus.__v,
          },
          {
            $pull: {
              temporaryLocks: {
                userId: userId,
                sessionId: sessionId,
                travelDate: travelDateObj,
                seatNumber: { $in: seatNumbers },
              },
            },
          },
          {
            session,
            new: true,
            runValidators: true,
          }
        );

        if (!updatedBus) {
          throw new Error(
            "Bus document was modified by another operation, retrying..."
          );
        }

        // Add new locks
        const newLocks = seatNumbers.map((seatNumber) => ({
          seatNumber,
          userId,
          travelDate: travelDateObj,
          direction,
          lockedAt: now,
          expiresAt,
          sessionId,
        }));

        // Push the new locks and bump version
        const finalBus = await Bus.findOneAndUpdate(
          {
            _id: busId,
            __v: updatedBus.__v,
          },
          {
            $push: {
              temporaryLocks: { $each: newLocks },
            },
            $inc: { __v: 1 },
          },
          {
            session,
            new: true,
            runValidators: true,
          }
        );

        if (!finalBus) {
          throw new Error("Failed to add seat locks, retrying...");
        }

        await session.commitTransaction();

        return {
          success: true,
          sessionId,
          lockedSeats: seatNumbers,
          expiresAt,
          message: `${seatNumbers.length} seats locked successfully`,
        };
      } catch (error) {
        await session.abortTransaction();
        lastError = error;

        const isRetryableError =
          (error &&
            error.message &&
            (error.message.includes("Write conflict") ||
              error.message.includes("was modified by another operation") ||
              error.message.includes("Failed to add seat locks"))) ||
          error.code === 112 || // WriteConflict
          error.code === 11000; // duplicate key

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

        // Build the filter for locks to remove
        const lockFilter = {
          userId: userId,
          sessionId: sessionId,
          travelDate: travelDateObj,
          direction,
        };

        if (seatNumbers && seatNumbers.length > 0) {
          lockFilter.seatNumber = { $in: seatNumbers };
        }

        // Use atomic operation to remove locks
        const result = await Bus.updateOne(
          { _id: busId },
          {
            $pull: {
              temporaryLocks: lockFilter,
            },
            $inc: { __v: 1 },
          },
          { session }
        );

        await session.commitTransaction();

        return {
          success: true,
          releasedCount:
            result.modifiedCount > 0 ? seatNumbers?.length || 1 : 0,
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

        const result = await Bus.updateMany(
          {
            _id: busId,
            "temporaryLocks.userId": userId,
            "temporaryLocks.sessionId": sessionId,
            "temporaryLocks.travelDate": travelDateObj,
            "temporaryLocks.direction": direction,
            "temporaryLocks.expiresAt": { $gt: now }, // Only extend non-expired locks
          },
          {
            $set: {
              "temporaryLocks.$[elem].expiresAt": newExpiryTime,
            },
          },
          {
            session,
            arrayFilters: [
              {
                "elem.userId": userId,
                "elem.sessionId": sessionId,
                "elem.travelDate": travelDateObj,
                "elem.direction": direction,
                "elem.expiresAt": { $gt: now },
              },
            ],
          }
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

      const bus = await Bus.findById(busId);
      if (!bus) {
        throw new Error("Bus not found");
      }

      const travelDateObj = new Date(travelDate);
      const now = new Date();
      const thresholdTime = new Date(
        now.getTime() + extendIfExpiringInMinutes * 60 * 1000
      );

      // Find locks that are expiring soon
      const expiringLocks = bus.temporaryLocks.filter(
        (lock) =>
          lock.userId.toString() === userId.toString() &&
          lock.sessionId === sessionId &&
          lock.travelDate.getTime() === travelDateObj.getTime() &&
          lock.direction === direction &&
          lock.expiresAt > now &&
          lock.expiresAt <= thresholdTime
      );

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

        // Get the bus and find locks to convert
        const bus = await Bus.findById(busId).session(session);
        if (!bus) {
          throw new Error("Bus not found");
        }

        // Find matching non-expired locks owned by user/session for that travel date
        const locksToConvert = bus.temporaryLocks.filter((lock) => {
          const isUserMatch = lock.userId.toString() === userId.toString();
          const isSessionMatch = lock.sessionId === sessionId;
          const isTravelDateMatch =
            lock.travelDate.getTime() === travelDateObj.getTime();
          const isDirectionMatch = lock.direction === direction;
          const isNotExpired = lock.expiresAt > now;
          return (
            isUserMatch && isSessionMatch && isTravelDateMatch && isNotExpired
          );
        });

        if (locksToConvert.length === 0) {
          throw new Error("No valid locks found to convert");
        }

        // Prepare new booked seats
        const newBookedSeats = locksToConvert.map((lock) => ({
          seatNumber: lock.seatNumber,
          bookingId,
          bookingDate: now,
          travelDate: travelDateObj,
          direction,
        }));

        // Atomic operation to convert locks to bookings
        const result = await Bus.findOneAndUpdate(
          {
            _id: busId,
            __v: bus.__v, // optimistic concurrency
          },
          {
            $push: {
              bookedSeats: { $each: newBookedSeats },
            },
            $pull: {
              temporaryLocks: {
                userId: userId,
                sessionId: sessionId,
                travelDate: travelDateObj,
                direction: direction,
              },
            },
            $inc: {
              availableSeats: -locksToConvert.length,
              __v: 1,
            },
          },
          {
            session,
            new: true,
            runValidators: true,
          }
        );

        if (!result) {
          throw new Error("Failed to convert locks to booking, retrying...");
        }

        await session.commitTransaction();

        return {
          success: true,
          convertedSeats: locksToConvert.map((lock) => lock.seatNumber),
          message: `${locksToConvert.length} seats converted to permanent booking`,
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
      const result = await Bus.updateMany(
        { "temporaryLocks.expiresAt": { $lte: now } },
        {
          $pull: {
            temporaryLocks: {
              expiresAt: { $lte: now },
            },
          },
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

      const lockStatus = seatNumbers.map((seatNumber) => {
        // Check if permanently booked
        const isBooked = bus.bookedSeats.some(
          (bs) =>
            bs.seatNumber === seatNumber &&
            bs.travelDate.getTime() === travelDateObj.getTime() &&
            bs.direction === direction
        );

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
        const lock = bus.temporaryLocks.find(
          (lock) =>
            lock.seatNumber === seatNumber &&
            lock.travelDate.getTime() === travelDateObj.getTime() &&
            lock.direction === direction &&
            lock.expiresAt > now
        );

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
