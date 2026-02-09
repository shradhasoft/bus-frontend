import { Booking } from "../models/booking.js";
import { Bus } from "../models/bus.js";
import { User } from "../models/user.js";
import { SeatLockService } from "../services/seatLockService.js";
import mongoose from "mongoose";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 6);

// Lock seats before creating booking with enhanced error handling
export const lockSeatsForBooking = async (req, res) => {
  try {
    const {
      busId,
      travelDate,
      seatNumbers,
      sessionId,
      direction = "forward",
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

    // Validate seat numbers
    const seats = seatNumbers.map((seat) => Number(seat));
    if (seats.some((seat) => isNaN(seat) || seat <= 0)) {
      return res.status(400).json({
        success: false,
        message: "Invalid seat numbers",
        code: "INVALID_SEATS",
      });
    }

    console.log(
      `[lockSeatsForBooking] Attempting to lock seats ${seats.join(
        ", "
      )} for user ${userId} with sessionId: ${sessionId}`
    );

    const lockResult = await SeatLockService.lockSeats({
      busId,
      seatNumbers: seats,
      userId,
      travelDate,
      direction,
      sessionId,
      lockDurationMinutes: 15, // Increased from 10 to 15 minutes
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
    session.startTransaction();

    const {
      busId,
      travelDate,
      passengers,
      boardingPoint,
      droppingPoint,
      sessionId,
      direction = "forward",
    } = req.body;
    const userId = req.user._id;

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

    // Extract seat numbers from passengers
    const seatNumbers = passengers.map((p) => Number(p.seatNumber));

    try {
      await SeatLockService.checkAndExtendLocks({
        busId,
        userId,
        sessionId,
        travelDate,
        direction,
        extendIfExpiringInMinutes: 10, // Extend if expiring in next 10 minutes
      });
    } catch (extendError) {
      console.warn("[createBooking] Failed to extend locks:", extendError);
      // Continue with booking creation, but locks might be at risk
    }

    // Verify seats are locked by this user/session
    const travelDateObj = new Date(travelDate);
    const now = new Date();

    // Get the bus to check locks - POPULATE THE ROUTE
    const bus = await Bus.findById(busId)
      .populate('route')  // Add this to populate the route
      .session(session);
      
    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
        code: "BUS_NOT_FOUND",
      });
    }

    // Check if route is populated and has stops
    if (!bus.route || !bus.route.stops) {
      return res.status(400).json({
        success: false,
        message: "Route information is incomplete",
        code: "INCOMPLETE_ROUTE",
      });
    }

    const userLocks = bus.temporaryLocks.filter(
      (lock) =>
        lock.userId.toString() === userId.toString() &&
        lock.sessionId === sessionId &&
        lock.travelDate.getTime() === travelDateObj.getTime() &&
        lock.direction === direction &&
        lock.expiresAt > now &&
        seatNumbers.includes(lock.seatNumber)
    );

    const lockedSeatNumbers = userLocks.map((lock) => lock.seatNumber);
    const requestedSeatNumbers = passengers.map((p) => Number(p.seatNumber));

    // Check if all requested seats are still locked
    const allSeatsLocked = requestedSeatNumbers.every((seat) =>
      lockedSeatNumbers.includes(seat)
    );

    if (!allSeatsLocked || userLocks.length !== passengers.length) {
      return res.status(409).json({
        success: false,
        message: "Seats are not properly locked or locks have expired",
        code: "INVALID_LOCKS",
        lockedSeats: lockedSeatNumbers,
        requestedSeats: requestedSeatNumbers,
      });
    }

    if (userLocks.length !== seatNumbers.length) {
      console.warn(
        `[createBooking] Mismatch in locked seats. Expected ${seatNumbers.length}, found ${userLocks.length}. SessionId: ${sessionId}`
      );
      return res.status(409).json({
        success: false,
        message: "Seats are not properly locked or locks have expired",
        code: "INVALID_LOCKS",
      });
    }

    // Find stops - case insensitive comparison
    // Use bus.route.stops instead of bus.routeDetails.stops
    const boardingStop = bus.route.stops.find(
      (s) => s.city.toLowerCase() === boardingPoint.toLowerCase().trim()
    );
    const droppingStop = bus.route.stops.find(
      (s) => s.city.toLowerCase() === droppingPoint.toLowerCase().trim()
    );

    // Validate stops
    if (!boardingStop || !droppingStop) {
      return res.status(400).json({
        success: false,
        message: "Invalid boarding/dropping point",
        code: "INVALID_POINT",
      });
    }

    if (boardingStop.distanceFromOrigin >= droppingStop.distanceFromOrigin) {
      return res.status(400).json({
        success: false,
        message: "Boarding point must be before dropping point",
        code: "INVALID_POINT_ORDER",
      });
    }

    // Calculate dynamic pricing
    const journeyDistance =
      droppingStop.distanceFromOrigin - boardingStop.distanceFromOrigin;
    const farePerPassenger = bus.farePerKm * journeyDistance;
    const totalAmount = Number.parseFloat(
      (farePerPassenger * passengers.length).toFixed(2)
    );

    // Generate unique booking ID
    const dateStr = new Date(travelDate)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const bookingId = `BK-${dateStr}-${nanoid()}`;

    // Create booking
    const booking = new Booking({
      bookingId,
      user: userId,
      bus: busId,
      route: bus.route._id,
      travelDate: travelDateObj,
      boardingPoint,
      droppingPoint,
      passengers,
      direction,
      journeyDistance,
      farePerKm: bus.farePerKm,
      farePerPassenger: Number.parseFloat(farePerPassenger.toFixed(2)),
      totalAmount,
      bookingStatus: "pending",
      paymentStatus: "pending",
      sessionId,
    });

    await booking.save({ session });

    // Update user bookings
    await User.findByIdAndUpdate(
      userId,
      { $push: { bookings: booking._id } },
      { session }
    );

    await session.commitTransaction();

    // Populate booking details for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate("bus", "busName busNumber operator")
      .populate("route", "routeCode origin destination")
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
    await session.abortTransaction();
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

    if (!busId || !travelDate || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        code: "MISSING_FIELDS",
      });
    }

    console.log(
      `[releaseSeatLocks] Releasing locks for session ${sessionId}, user ${userId}`
    );

    const releaseResult = await SeatLockService.releaseLocks({
      busId,
      userId,
      sessionId,
      travelDate,
      direction,
      seatNumbers,
    });

    console.log(
      `[releaseSeatLocks] Successfully released locks:`,
      releaseResult
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

// Cancel booking (updated to handle seat locks)
export const cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    const cancellationTime = new Date();

    // Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID format",
        code: "INVALID_ID",
      });
    }

    // Find booking with populated route
    const booking = await Booking.findById(id)
      .populate("route", "cancellationPolicy")
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
        message: "Not authorized to cancel this booking",
        code: "UNAUTHORIZED",
      });
    }

    // Check booking status
    if (booking.bookingStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled",
        code: "ALREADY_CANCELLED",
      });
    }

    if (booking.bookingStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "Completed bookings cannot be cancelled",
        code: "COMPLETED_BOOKING",
      });
    }

    // Check travel date
    const travelDate = new Date(booking.travelDate);
    if (travelDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel past bookings",
        code: "PAST_BOOKING",
      });
    }

    // Calculate refund
    const refundAmount = calculateRefund(booking, cancellationTime);

    // Update booking status
    booking.bookingStatus = "cancelled";
    booking.paymentStatus = refundAmount > 0 ? "refunded" : "partial-refund";
    booking.cancellation = {
      requestedAt: cancellationTime,
      processedAt: new Date(),
      refundAmount,
      reason: reason || "User request",
    };

    // Free up seats in bus
    const bus = await Bus.findById(booking.bus).session(session);
    if (bus) {
      // Remove booked seats for this booking
      bus.bookedSeats = bus.bookedSeats.filter(
        (bs) => bs.bookingId.toString() !== id
      );

      // Increase available seats
      bus.availableSeats += booking.passengers.length;
      await bus.save({ session });
    }

    // Update booking
    await booking.save({ session });

    // Refund processing (simulated - integrate with payment gateway in production)
    if (refundAmount > 0) {
      console.log(`Processing refund of ₹${refundAmount} for booking ${id}`);
    }

    await session.commitTransaction();

    // Get updated booking
    const updatedBooking = await Booking.findById(id)
      .populate("bus", "busName busNumber")
      .populate("route", "routeCode origin destination")
      .lean();

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      refundAmount,
      data: updatedBooking,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("[cancelBooking] Cancel Booking Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  } finally {
    session.endSession();
  }
};

// Calculate refund amount based on cancellation policy
const calculateRefund = (booking, cancellationTime) => {
  const travelDate = new Date(booking.travelDate);
  const hoursDifference = Math.abs(travelDate - cancellationTime) / 36e5;

  let refundPercentage = 0;
  if (hoursDifference > 24) {
    refundPercentage =
      (100 - (booking.route?.cancellationPolicy?.before24h || 0)) / 100;
  } else if (hoursDifference > 12) {
    refundPercentage =
      (100 - (booking.route?.cancellationPolicy?.before12h || 0)) / 100;
  } else {
    refundPercentage =
      (100 - (booking.route?.cancellationPolicy?.noShow || 0)) / 100;
  }

  return Math.max(0, booking.totalAmount * refundPercentage);
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

    // Get seat numbers as NUMBERS
    const currentSeats = booking.passengers.map((p) => p.seatNumber);
    const bus = booking.bus;

    // Get booked seats for new date
    const bookedSeatsOnNewDate = bus.bookedSeats
      .filter(
        (bs) =>
          bs.travelDate.getTime() === parsedNewDate.getTime() &&
          bs.bookingId.toString() !== id // Exclude current booking
      )
      .map((bs) => bs.seatNumber);

    // Check seat availability
    const unavailableSeats = currentSeats.filter(
      (seat) =>
        bookedSeatsOnNewDate.includes(seat) ||
        !bus.seatLayout.flat().includes(seat)
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
        bs.travelDate.getTime() !== new Date(booking.travelDate).getTime()
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

    // Save changes
    await bus.save({ session });
    await booking.save({ session });
    await session.commitTransaction();

    // Get updated booking
    const updatedBooking = await Booking.findById(id)
      .populate("bus", "busName busNumber")
      .populate("route", "routeCode origin destination")
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
      sort = "-createdAt",
      fromDate,
      toDate,
    } = req.query;

    // Validate query parameters
    const pageInt = Number.parseInt(page);
    const limitInt = Number.parseInt(limit);

    if (isNaN(pageInt))
      return res.status(400).json({
        success: false,
        message: "Invalid page number",
        code: "INVALID_PAGE",
      });

    if (isNaN(limitInt))
      return res.status(400).json({
        success: false,
        message: "Invalid limit value",
        code: "INVALID_LIMIT",
      });

    if (limitInt > 50)
      return res.status(400).json({
        success: false,
        message: "Maximum limit is 50",
        code: "MAX_LIMIT_EXCEEDED",
      });

    // Build query
    const query = { user: userId };

    // Status filter
    if (
      status &&
      ["pending", "confirmed", "cancelled", "completed"].includes(status)
    ) {
      query.bookingStatus = status;
    }

    // Date range filter
    const dateFilter = {};
    if (fromDate) {
      const from = new Date(fromDate);
      if (isNaN(from.getTime()))
        return res.status(400).json({
          success: false,
          message: "Invalid fromDate format",
          code: "INVALID_DATE",
        });
      dateFilter.$gte = from;
    }

    if (toDate) {
      const to = new Date(toDate);
      if (isNaN(to.getTime()))
        return res.status(400).json({
          success: false,
          message: "Invalid toDate format",
          code: "INVALID_DATE",
        });
      dateFilter.$lte = to;
    }

    if (Object.keys(dateFilter).length > 0) {
      query.travelDate = dateFilter;
    }

    // Get bookings with pagination and sorting
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .sort(sort)
        .skip((pageInt - 1) * limitInt)
        .limit(limitInt)
        .populate({
          path: "bus",
          select:
            "busId busName busNumber operator departureTime arrivalTime fare amenities features",
        })
        .populate({
          path: "route",
          select: "routeCode origin destination distance duration stops",
        })
        .lean(),

      Booking.countDocuments(query),
    ]);

    // Calculate next page information
    const totalPages = Math.ceil(total / limitInt);
    const hasNext = pageInt < totalPages;

    // Format booking data
    const formattedBookings = bookings.map((booking) => {
      const bus = booking.bus || {};
      const route = booking.route || {};

      return {
        bookingId: booking.bookingId,
        dbId: booking._id,
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        travelDate: booking.travelDate,
        boardingPoint: booking.boardingPoint,
        droppingPoint: booking.droppingPoint,
        createdAt: booking.createdAt,
        passengers: booking.passengers,
        journeyDistance: booking.journeyDistance,
        farePerKm: booking.farePerKm,
        farePerPassenger: booking.farePerPassenger,
        totalAmount: booking.totalAmount,
        bus: {
          id: bus._id,
          name: bus.busName,
          number: bus.busNumber,
          operator: bus.operator,
          departureTime: bus.departureTime,
          arrivalTime: bus.arrivalTime,
          farePerKm: bus.farePerKm,
          amenities: bus.amenities,
          features: bus.features,
        },
        route: {
          id: route._id,
          code: route.routeCode,
          origin: route.origin,
          destination: route.destination,
          distance: route.distance,
          duration: route.duration,
          // stops: route.stops,
        },
        cancellation: booking.cancellation,
      };
    });

    res.json({
      success: true,
      page: pageInt,
      limit: limitInt,
      total,
      totalPages,
      hasNext,
      data: formattedBookings,
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
      additionalMinutes = 15,
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
      `[extendSeatLocks] Extending locks for session ${sessionId}, user ${userId}`
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

    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: "Bus not found",
      });
    }

    const travelDateObj = new Date(travelDate);
    const now = new Date();

    // Check if all seats are still locked by this user/session
    const validLocks = bus.temporaryLocks.filter(
      (lock) =>
        lock.userId.toString() === userId.toString() &&
        lock.sessionId === sessionId &&
        lock.travelDate.getTime() === travelDateObj.getTime() &&
        lock.direction === direction &&
        lock.expiresAt > now &&
        seatNumbers.includes(lock.seatNumber)
    );

    const allSeatsValid = seatNumbers.every((seat) =>
      validLocks.some((lock) => lock.seatNumber === seat)
    );

    res.status(200).json({
      success: true,
      valid: allSeatsValid && validLocks.length === seatNumbers.length,
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
