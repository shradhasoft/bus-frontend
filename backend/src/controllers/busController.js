// src/controllers/busController.js
import { Bus } from "../models/bus.js";
import { Route } from "../models/route.js";
import mongoose from "mongoose";

// Generate unique bus ID
const generateBusId = async () => {
  const lastBus = await Bus.findOne().sort({ busId: -1 }).limit(1);
  return lastBus ? lastBus.busId + 1 : 1000;
};

// Validate seat layout
const validateSeatLayout = (totalSeats, seatLayout) => {
  if (!Array.isArray(seatLayout)) return false;
  let seatCount = 0;
  const seenSeats = new Set();
  for (const row of seatLayout) {
    if (!Array.isArray(row)) return false;
    for (const seat of row) {
      if (typeof seat !== "number" || seat < 0 || seenSeats.has(seat))
        return false;
      seenSeats.add(seat);
      seatCount++;
    }
  }
  return seatCount === totalSeats;
};

// Helper function to parse time string to time object
const parseTimeString = (timeStr) => {
  if (
    typeof timeStr === "object" &&
    timeStr.hours !== undefined &&
    timeStr.minutes !== undefined
  ) {
    return timeStr;
  }

  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours, minutes };
};

// Add new bus
export const addBus = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const {
      busName,
      busNumber,
      operator,
      totalSeats,
      amenities,
      features,
      seatLayout,
      route: routeId,
      forwardTrip,
      returnTrip,
      farePerKm,
      model,
      year,
      insurance,
      operatingDays,
    } = req.body;

    // Validate required fields
    const requiredFields = [
      "busName",
      "busNumber",
      "operator",
      "totalSeats",
      "features",
      "route",
      "forwardTrip",
      "returnTrip",
      "farePerKm",
    ];
    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Validate route exists
    const route = await Route.findById(routeId).session(session);
    if (!route) {
      return res.status(404).json({
        success: false,
        message: `Route with ID ${routeId} not found`,
        code: "ROUTE_NOT_FOUND",
      });
    }

    // Validate seat layout
    if (!validateSeatLayout(totalSeats, seatLayout)) {
      return res.status(400).json({
        success: false,
        message: "Invalid seat layout structure or seat numbers",
      });
    }

    // Validate operating days
    if (!Array.isArray(operatingDays)) {
      return res.status(400).json({
        success: false,
        message: "Operating days must be an array",
      });
    }

    // Check for duplicate bus number
    const existingBus = await Bus.findOne({ busNumber }).session(session);
    if (existingBus) {
      return res.status(409).json({
        success: false,
        message: "Bus with this number already exists",
      });
    }

    // Parse timing data
    const parsedForwardTrip = {
      departureTime: parseTimeString(forwardTrip.departureTime),
      arrivalTime: parseTimeString(forwardTrip.arrivalTime),
    };

    const parsedReturnTrip = {
      departureTime: parseTimeString(returnTrip.departureTime),
      arrivalTime: parseTimeString(returnTrip.arrivalTime),
    };

    // Create and save new bus
    const busId = await generateBusId();
    const bus = new Bus({
      busId,
      busName,
      busNumber,
      operator,
      totalSeats,
      amenities: amenities || {},
      features,
      seatLayout,
      route: routeId,
      forwardTrip: parsedForwardTrip,
      returnTrip: parsedReturnTrip,
      farePerKm,
      model,
      year,
      insurance: insurance || {},
      operatingDays,
      availableSeats: totalSeats,
      createdBy: req.user.id,
    });

    await bus.save({ session });

    // Update route with new bus reference
    route.buses.push(bus._id);
    await route.save({ session });

    await session.commitTransaction();

    // Populate relationships for response
    const populatedBus = await Bus.findById(bus._id)
      .populate("routeDetails")
      .lean();

    res.status(201).json({
      success: true,
      message: "Bus added successfully",
      data: populatedBus,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Add Bus Error:", error.message);

    if (error instanceof mongoose.Error.ValidationError) {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
        details: error.message,
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `${field} already exists`,
        field,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  } finally {
    session.endSession();
  }
};

// Update Bus Controller
export const updateBus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bus ID format",
        code: "INVALID_ID",
      });
    }

    // Find bus and check existence
    const bus = await Bus.findById(id).session(session);
    if (!bus || bus.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
        code: "BUS_NOT_FOUND",
      });
    }

    // Validate bus number uniqueness if changed
    if (updates.busNumber && updates.busNumber !== bus.busNumber) {
      const existingBus = await Bus.findOne({
        busNumber: updates.busNumber,
        _id: { $ne: id },
      }).session(session);

      if (existingBus) {
        return res.status(409).json({
          success: false,
          message: "Bus number already exists",
          code: "DUPLICATE_BUS_NUMBER",
        });
      }
    }

    // Handle seat layout changes
    if (updates.seatLayout || updates.totalSeats) {
      const newLayout = updates.seatLayout || bus.seatLayout;
      const newTotalSeats = updates.totalSeats || bus.totalSeats;

      if (!validateSeatLayout(newTotalSeats, newLayout)) {
        return res.status(400).json({
          success: false,
          message: "Invalid seat layout",
          code: "INVALID_SEAT_LAYOUT",
        });
      }

      // Check for existing bookings if reducing seats
      if (newTotalSeats < bus.totalSeats) {
        const bookedSeatsCount = bus.bookedSeats.filter(
          (bs) => new Date(bs.travelDate) >= new Date()
        ).length;

        if (bookedSeatsCount > newTotalSeats) {
          return res.status(400).json({
            success: false,
            message: `Cannot reduce seats below ${bookedSeatsCount} future booked seats`,
            code: "SEAT_REDUCTION_NOT_ALLOWED",
          });
        }
      }
    }

    // Handle route changes
    if (updates.route) {
      const newRoute = await Route.findById(updates.route).session(session);
      if (!newRoute) {
        return res.status(404).json({
          success: false,
          message: "Route not found",
          code: "ROUTE_NOT_FOUND",
        });
      }

      if (!bus.route.equals(newRoute._id)) {
        const oldRoute = await Route.findById(bus.route).session(session);
        if (oldRoute) {
          oldRoute.buses.pull(bus._id);
          await oldRoute.save({ session });
        }

        newRoute.buses.push(bus._id);
        await newRoute.save({ session });
      }
    }

    // Parse timing updates if provided
    if (updates.forwardTrip) {
      if (updates.forwardTrip.departureTime) {
        updates.forwardTrip.departureTime = parseTimeString(
          updates.forwardTrip.departureTime
        );
      }
      if (updates.forwardTrip.arrivalTime) {
        updates.forwardTrip.arrivalTime = parseTimeString(
          updates.forwardTrip.arrivalTime
        );
      }
    }

    if (updates.returnTrip) {
      if (updates.returnTrip.departureTime) {
        updates.returnTrip.departureTime = parseTimeString(
          updates.returnTrip.departureTime
        );
      }
      if (updates.returnTrip.arrivalTime) {
        updates.returnTrip.arrivalTime = parseTimeString(
          updates.returnTrip.arrivalTime
        );
      }
    }

    // Apply updates
    const allowedUpdates = [
      "busName",
      "busNumber",
      "operator",
      "conductor",
      "totalSeats",
      "amenities",
      "features",
      "seatLayout",
      "forwardTrip",
      "returnTrip",
      "farePerKm",
      "model",
      "year",
      "insurance",
      "operatingDays",
      "isActive",
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        bus[field] = updates[field];
      }
    });

    // Update metadata
    bus.updatedBy = userId;
    bus.updatedAt = new Date();

    // Recalculate available seats if total seats changed
    if (updates.totalSeats !== undefined) {
      bus.availableSeats = updates.totalSeats - bus.bookedSeats.length;
    }

    await bus.save({ session });
    await session.commitTransaction();

    const updatedBus = await Bus.findById(id).populate("routeDetails").lean();

    res.json({
      success: true,
      message: "Bus updated successfully",
      data: updatedBus,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Update Bus Error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        errors,
        code: "VALIDATION_ERROR",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  } finally {
    session.endSession();
  }
};

// Delete Bus Controller
export const deleteBus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bus ID format",
        code: "INVALID_ID",
      });
    }

    // Find bus
    const bus = await Bus.findById(id).session(session);
    if (!bus || bus.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
        code: "BUS_NOT_FOUND",
      });
    }

    // Check for future bookings in both directions
    const hasFutureBookings = bus.bookedSeats.some(
      (booking) => new Date(booking.travelDate) > new Date()
    );

    if (hasFutureBookings) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete bus with future bookings",
        code: "BUS_HAS_FUTURE_BOOKINGS",
      });
    }

    // Soft delete bus
    bus.isDeleted = true;
    bus.isActive = false;
    bus.updatedBy = userId;
    await bus.save({ session });

    // Remove from route
    const route = await Route.findById(bus.route).session(session);
    if (route) {
      route.buses.pull(bus._id);
      await route.save({ session });
    }

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Bus deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Delete Bus Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  } finally {
    session.endSession();
  }
};
