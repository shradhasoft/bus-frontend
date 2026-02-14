// src/controllers/busController.js
import { Bus, validateSeatLayoutBlueprint } from "../models/bus.js";
import mongoose from "mongoose";

// Generate unique bus ID
const generateBusId = async () => {
  const lastBus = await Bus.findOne().sort({ busId: -1 }).limit(1);
  return lastBus ? lastBus.busId + 1 : 1000;
};

// Validate seat layout blueprint
const validateSeatLayout = (totalSeats, seatLayout) =>
  validateSeatLayoutBlueprint(seatLayout, totalSeats);

// Helper function to parse time string to time object
const parseTimeString = (timeStr) => {
  if (
    typeof timeStr === "object" &&
    timeStr.hours !== undefined &&
    timeStr.minutes !== undefined
  ) {
    return timeStr;
  }

  if (typeof timeStr !== "string") {
    return timeStr;
  }

  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours, minutes };
};

const normalizeTripStop = (tripStop) => {
  if (!tripStop || typeof tripStop !== "object") return tripStop;
  const { distanceFromOrigin, ...rest } = tripStop;
  return {
    ...rest,
    arrivalTime: parseTimeString(tripStop.arrivalTime),
    departureTime: parseTimeString(tripStop.departureTime),
  };
};

const normalizeRouteData = (route) => {
  if (!route || typeof route !== "object") return route;
  const { distance, duration, ...restRoute } = route;
  const normalizedStops = Array.isArray(route.stops)
    ? route.stops.map((stop) => ({
        ...stop,
        upTrip: normalizeTripStop(stop.upTrip),
        downTrip: normalizeTripStop(stop.downTrip),
      }))
    : route.stops;

  return {
    ...restRoute,
    stops: normalizedStops,
  };
};

const normalizeRole = (role) => String(role || "").toLowerCase();

const resolveUserId = (user) => {
  const rawUserId = user?._id ?? user?.id;
  if (!rawUserId) return null;
  const userId = String(rawUserId);
  return mongoose.Types.ObjectId.isValid(userId) ? userId : null;
};

const buildOwnerAccessQuery = (user) => {
  if (normalizeRole(user?.role) !== "owner") return null;

  const clauses = [];
  const email =
    typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  const userId = resolveUserId(user);

  if (email) {
    clauses.push({ busOwnerEmail: email });
  }
  if (userId) {
    clauses.push({ createdBy: userId });
  }

  if (clauses.length === 0) {
    // Fail closed for malformed owner sessions.
    return { _id: null };
  }

  return clauses.length === 1 ? clauses[0] : { $or: clauses };
};

const buildBusQuery = ({ search, status }, user) => {
  const filters = [];
  const ownerAccessQuery = buildOwnerAccessQuery(user);
  if (ownerAccessQuery) {
    filters.push(ownerAccessQuery);
  }

  if (status === "active") {
    filters.push({ isActive: true });
  } else if (status === "inactive") {
    filters.push({ isActive: false });
  }

  if (typeof search === "string" && search.trim()) {
    const regex = new RegExp(search.trim(), "i");
    filters.push({
      $or: [
        { busName: regex },
        { busNumber: regex },
        { operator: regex },
        { busOwnerEmail: regex },
        { "route.routeCode": regex },
        { "route.origin": regex },
        { "route.destination": regex },
      ],
    });
  }

  if (filters.length === 0) return {};
  if (filters.length === 1) return filters[0];
  return { $and: filters };
};

// List buses for management views
export const listBuses = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const pageInt = Number.parseInt(page, 10);
    const limitInt = Number.parseInt(limit, 10);

    if (Number.isNaN(pageInt) || pageInt < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid page number",
        code: "INVALID_PAGE",
      });
    }

    if (Number.isNaN(limitInt) || limitInt < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid limit value",
        code: "INVALID_LIMIT",
      });
    }

    if (limitInt > 100) {
      return res.status(400).json({
        success: false,
        message: "Maximum limit is 100",
        code: "MAX_LIMIT_EXCEEDED",
      });
    }

    const scopedQuery = buildBusQuery({ search, status }, req.user);
    const query = {
      ...scopedQuery,
      isDeleted: false,
    };

    const projection =
      "busId busName busNumber operator busOwnerEmail totalSeats availableSeats isActive isDeleted createdAt updatedAt features farePerKm operatingDays model year route.routeCode route.origin route.destination";

    const [buses, total] = await Promise.all([
      Bus.find(query)
        .select(projection)
        .sort({ createdAt: -1 })
        .skip((pageInt - 1) * limitInt)
        .limit(limitInt)
        .lean(),
      Bus.countDocuments(query),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limitInt));
    const hasNext = pageInt < totalPages;
    const hasPrevious = pageInt > 1;

    return res.json({
      success: true,
      message: "Buses retrieved successfully",
      data: {
        buses,
        page: pageInt,
        limit: limitInt,
        total,
        totalPages,
        hasNext,
        hasPrevious,
      },
    });
  } catch (error) {
    console.error("List buses error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load buses",
      code: "SERVER_ERROR",
    });
  }
};

// Get full bus details for management views
export const getBusById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bus ID format",
        code: "INVALID_ID",
      });
    }

    const query = { _id: id, isDeleted: false };
    const ownerAccessQuery = buildOwnerAccessQuery(req.user);
    if (ownerAccessQuery) {
      Object.assign(query, ownerAccessQuery);
    }

    const bus = await Bus.findOne(query).lean();
    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
        code: "BUS_NOT_FOUND",
      });
    }

    return res.json({
      success: true,
      message: "Bus retrieved successfully",
      data: { bus },
    });
  } catch (error) {
    console.error("Get bus error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load bus details",
      code: "SERVER_ERROR",
    });
  }
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
      busOwnerEmail,
      totalSeats,
      amenities,
      features,
      seatLayout,
      route,
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
      "seatLayout",
      "features",
      "route",
      "farePerKm",
    ];
    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Validate seat layout
    const seatLayoutValidation = validateSeatLayout(totalSeats, seatLayout);
    if (!seatLayoutValidation.valid) {
      return res.status(400).json({
        success: false,
        message:
          seatLayoutValidation.errors?.[0] ||
          "Invalid seat layout blueprint",
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

    const normalizedRole = normalizeRole(req.user?.role);
    const resolvedOwnerEmail =
      normalizedRole === "owner"
        ? typeof req.user?.email === "string"
          ? req.user.email.trim().toLowerCase()
          : ""
        : typeof busOwnerEmail === "string"
          ? busOwnerEmail.trim().toLowerCase()
          : "";

    if (!resolvedOwnerEmail) {
      return res.status(400).json({
        success: false,
        message: "Bus owner email is required",
      });
    }

    // Parse timing data
    const parsedForwardTrip = forwardTrip
      ? {
          departureTime: parseTimeString(forwardTrip.departureTime),
          arrivalTime: parseTimeString(forwardTrip.arrivalTime),
        }
      : undefined;

    const parsedReturnTrip = returnTrip
      ? {
          departureTime: parseTimeString(returnTrip.departureTime),
          arrivalTime: parseTimeString(returnTrip.arrivalTime),
        }
      : undefined;

    // Create and save new bus
    const busId = await generateBusId();
    const normalizedRoute = normalizeRouteData(route);

    const bus = new Bus({
      busId,
      busName,
      busNumber,
      operator,
      busOwnerEmail: resolvedOwnerEmail.trim().toLowerCase(),
      totalSeats,
      amenities: amenities || {},
      features,
      seatLayout,
      route: normalizedRoute,
      forwardTrip: parsedForwardTrip,
      returnTrip: parsedReturnTrip,
      farePerKm,
      model,
      year,
      insurance: insurance || {},
      operatingDays,
      availableSeats: totalSeats,
      createdBy: resolveUserId(req.user) ?? req.user.id,
    });

    await bus.save({ session });

    await session.commitTransaction();

    const populatedBus = await Bus.findById(bus._id).lean();

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
    const userId = resolveUserId(req.user) ?? req.user.id;
    const normalizedRole = normalizeRole(req.user?.role);

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bus ID format",
        code: "INVALID_ID",
      });
    }

    // Find bus and check existence within caller ownership scope.
    const busQuery = { _id: id, isDeleted: false };
    const ownerAccessQuery = buildOwnerAccessQuery(req.user);
    if (ownerAccessQuery) {
      Object.assign(busQuery, ownerAccessQuery);
    }

    const bus = await Bus.findOne(busQuery).session(session);
    if (!bus) {
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

      const seatLayoutCheck = validateSeatLayout(newTotalSeats, newLayout);
      if (!seatLayoutCheck.valid) {
        return res.status(400).json({
          success: false,
          message: seatLayoutCheck.errors?.[0] || "Invalid seat layout",
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

    if (normalizedRole === "owner") {
      const ownerEmail =
        typeof req.user?.email === "string"
          ? req.user.email.trim().toLowerCase()
          : "";
      if (ownerEmail) {
        updates.busOwnerEmail = ownerEmail;
      }
    } else if (typeof updates.busOwnerEmail === "string") {
      updates.busOwnerEmail = updates.busOwnerEmail.trim().toLowerCase();
    }

    // Handle route changes
    if (updates.route) {
      const baseRoute = bus.route?.toObject
        ? bus.route.toObject()
        : bus.route;
      const mergedRoute = {
        ...baseRoute,
        ...updates.route,
        duration: {
          ...(baseRoute?.duration || {}),
          ...(updates.route?.duration || {}),
        },
        cancellationPolicy: {
          ...(baseRoute?.cancellationPolicy || {}),
          ...(updates.route?.cancellationPolicy || {}),
        },
        stops: updates.route?.stops ?? baseRoute?.stops,
      };
      updates.route = normalizeRouteData(mergedRoute);
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
      "busOwnerEmail",
      "conductor",
      "totalSeats",
      "amenities",
      "features",
      "seatLayout",
      "route",
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

    const updatedBus = await Bus.findById(id).lean();

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
    const userId = resolveUserId(req.user) ?? req.user.id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bus ID format",
        code: "INVALID_ID",
      });
    }

    // Find bus within caller ownership scope.
    const busQuery = { _id: id, isDeleted: false };
    const ownerAccessQuery = buildOwnerAccessQuery(req.user);
    if (ownerAccessQuery) {
      Object.assign(busQuery, ownerAccessQuery);
    }

    const bus = await Bus.findOne(busQuery).session(session);
    if (!bus) {
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
