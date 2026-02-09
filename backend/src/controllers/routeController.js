// src/controllers/routeController.js
import { Bus } from "../models/bus.js";
import { Route } from "../models/route.js";
import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY;

// Helper: Geocode a city to get [lng, lat]
const getCoordinates = async (city) => {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    city
  )}.json`;

  const response = await axios.get(url, {
    params: {
      access_token: MAPBOX_API_KEY,
      limit: 1,
    },
  });

  const features = response.data.features;
  if (!features || features.length === 0) {
    throw new Error(`No location found for: ${city}`);
  }

  return features[0].center; // [lng, lat]
};

// Helper: Get driving distance in km between two coordinates
const getDistanceBetweenPoints = async (fromCoord, toCoord) => {
  const coordinates = `${fromCoord.join(",")};${toCoord.join(",")}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}`;

  const response = await axios.get(url, {
    params: {
      access_token: MAPBOX_API_KEY,
      geometries: "geojson",
    },
  });

  const routes = response.data.routes;
  if (!routes || routes.length === 0) {
    throw new Error("No route found between coordinates");
  }

  return Math.round(routes[0].distance / 1000);
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

  if (typeof timeStr === "string") {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return { hours, minutes };
  }

  throw new Error("Invalid time format");
};

// Add new route
export const addRoute = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const {
      routeCode,
      origin,
      destination,
      stops = [],
      duration,
      cancellationPolicy = {},
    } = req.body;

    const createdBy = req.user.id;

    // Validate required fields
    const requiredFields = ["routeCode", "origin", "destination"];
    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
        code: "MISSING_FIELDS",
      });
    }

    // Validate that stops array has at least 2 stops (origin and destination)
    if (!stops || stops.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least 2 stops required (origin and destination)",
        code: "INSUFFICIENT_STOPS",
      });
    }

    // Check for duplicate routeCode
    const existingRoute = await Route.findOne({
      routeCode: routeCode.toUpperCase(),
    }).session(session);
    if (existingRoute) {
      return res.status(409).json({
        success: false,
        message: "Route with this code already exists",
        code: "DUPLICATE_ROUTE_CODE",
      });
    }

    // Parse timing data for stops
    const parsedStops = stops.map((stop, index) => {
      const parsedStop = {
        city: stop.city,
        distanceFromOrigin: stop.distanceFromOrigin || 0,
      };

      // Parse arrival and departure times if provided
      if (stop.arrivalTime) {
        parsedStop.arrivalTime = parseTimeString(stop.arrivalTime);
      }
      if (stop.departureTime) {
        parsedStop.departureTime = parseTimeString(stop.departureTime);
      }

      return parsedStop;
    });

    // --- DYNAMIC DISTANCE CALCULATION LOGIC BASED ON STOPS ---
    // Get coordinates for all stops
    const stopsWithCoords = await Promise.all(
      parsedStops.map(async (stop) => {
        if (!stop.city || typeof stop.city !== "string") {
          throw new Error(
            `Invalid city in stops array: ${JSON.stringify(stop)}`
          );
        }
        const coord = await getCoordinates(stop.city);
        return { ...stop, coord };
      })
    );

    // Calculate cumulative distances between consecutive stops
    let cumulativeDistance = 0;
    const finalStops = [];

    for (let i = 0; i < stopsWithCoords.length; i++) {
      const stop = stopsWithCoords[i];

      if (i === 0) {
        // First stop (origin) - distance from origin is 0
        finalStops.push({
          city: stop.city,
          arrivalTime: stop.arrivalTime,
          departureTime: stop.departureTime,
          distanceFromOrigin: 0,
        });
      } else {
        // Calculate distance from previous stop
        const previousStop = stopsWithCoords[i - 1];
        const segmentDistance = await getDistanceBetweenPoints(
          previousStop.coord,
          stop.coord
        );
        cumulativeDistance += segmentDistance;

        finalStops.push({
          city: stop.city,
          arrivalTime: stop.arrivalTime,
          departureTime: stop.departureTime,
          distanceFromOrigin: cumulativeDistance,
        });
      }
    }

    // Total distance is the distance from origin to the last stop
    const totalDistance = cumulativeDistance;

    // Create and save the new route
    const route = new Route({
      routeCode: routeCode.toUpperCase(),
      origin,
      destination,
      stops: finalStops,
      distance: totalDistance,
      duration,
      cancellationPolicy,
      createdBy,
      buses: [],
    });

    await route.save({ session });
    await session.commitTransaction();

    const populatedRoute = await Route.findById(route._id)
      .populate({
        path: "busDetails",
        select: "busId busName busNumber operator features",
      })
      .lean();

    res.status(201).json({
      success: true,
      message: "Route added successfully",
      data: populatedRoute,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Add Route Error:", error.message);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
        code: "VALIDATION_ERROR",
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `${field} already exists`,
        field,
        code: "DUPLICATE_KEY",
      });
    }

    if (
      error.message.includes("No location found") ||
      error.message.includes("No route found")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: "MAPBOX_ERROR",
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

// Get all routes with reverse route information
export const getRoutes = async (req, res) => {
  try {
    const { includeReverse = false } = req.query;

    const routes = await Route.find({})
      .populate({
        path: "busDetails",
        select:
          "busId busName busNumber operator features forwardTrip returnTrip",
      })
      .lean();

    let responseData = routes;

    // If includeReverse is true, add reverse route information
    if (includeReverse === "true") {
      responseData = routes.map((route) => ({
        ...route,
        reverseRoute: {
          routeCode: route.routeCode + "-R",
          origin: route.destination,
          destination: route.origin,
          stops: [...route.stops].reverse().map((stop) => ({
            ...stop,
            distanceFromOrigin: route.distance - stop.distanceFromOrigin,
            arrivalTime: stop.departureTime,
            departureTime: stop.arrivalTime,
          })),
          distance: route.distance,
          duration: route.duration,
        },
      }));
    }

    res.json({
      success: true,
      count: responseData.length,
      data: responseData,
    });
  } catch (error) {
    console.error("Get Routes Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

// Get route by ID with optional reverse information
export const getRouteById = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeReverse = false } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid route ID format",
        code: "INVALID_ID",
      });
    }

    const route = await Route.findById(id)
      .populate({
        path: "busDetails",
        select:
          "busId busName busNumber operator features forwardTrip returnTrip totalSeats",
      })
      .lean();

    if (!route) {
      return res.status(404).json({
        success: false,
        message: "Route not found",
        code: "ROUTE_NOT_FOUND",
      });
    }

    let responseData = route;

    // Add reverse route information if requested
    if (includeReverse === "true") {
      responseData.reverseRoute = {
        routeCode: route.routeCode + "-R",
        origin: route.destination,
        destination: route.origin,
        stops: [...route.stops].reverse().map((stop) => ({
          ...stop,
          distanceFromOrigin: route.distance - stop.distanceFromOrigin,
          arrivalTime: stop.departureTime,
          departureTime: stop.arrivalTime,
        })),
        distance: route.distance,
        duration: route.duration,
      };
    }

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Get Route Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

// Update Route Controller
export const updateRoute = async (req, res) => {
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
        message: "Invalid route ID format",
        code: "INVALID_ID",
      });
    }

    // Find route and check existence
    const route = await Route.findById(id).session(session);
    if (!route || route.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Route not found",
        code: "ROUTE_NOT_FOUND",
      });
    }

    // Validate route code uniqueness if changed
    if (updates.routeCode && updates.routeCode !== route.routeCode) {
      const existingRoute = await Route.findOne({
        routeCode: updates.routeCode.toUpperCase(),
        _id: { $ne: route._id },
      }).session(session);

      if (existingRoute) {
        return res.status(409).json({
          success: false,
          message: "Route code already exists",
          code: "DUPLICATE_ROUTE_CODE",
        });
      }
    }

    // Parse timing data for stops if provided
    if (updates.stops) {
      updates.stops = updates.stops.map((stop) => {
        const parsedStop = { ...stop };

        if (stop.arrivalTime) {
          parsedStop.arrivalTime = parseTimeString(stop.arrivalTime);
        }
        if (stop.departureTime) {
          parsedStop.departureTime = parseTimeString(stop.departureTime);
        }

        return parsedStop;
      });

      // Validate stop sequence
      let lastDistance = -1;
      for (const stop of updates.stops) {
        if (stop.distanceFromOrigin <= lastDistance) {
          return res.status(400).json({
            success: false,
            message: "Stops must be in increasing distance order",
            code: "INVALID_STOP_ORDER",
          });
        }
        lastDistance = stop.distanceFromOrigin;
      }
    }

    // Apply updates
    const allowedUpdates = [
      "routeCode",
      "origin",
      "destination",
      "stops",
      "distance",
      "duration",
      "cancellationPolicy",
      "isActive",
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        route[field] = updates[field];
      }
    });

    // Update metadata
    route.updatedBy = userId;
    route.updatedAt = new Date();

    // Format route code
    if (updates.routeCode) {
      route.routeCode = route.routeCode.toUpperCase().replace(/\s+/g, "-");
    }

    await route.save({ session });
    await session.commitTransaction();

    // Populate bus details for response
    const populatedRoute = await Route.findById(id)
      .populate({
        path: "busDetails",
        select: "busId busName busNumber operator forwardTrip returnTrip",
      })
      .lean();

    res.json({
      success: true,
      message: "Route updated successfully",
      data: populatedRoute,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Update Route Error:", error);

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

    if (error.message.includes("Invalid time format")) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: "INVALID_TIME_FORMAT",
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

// Delete Route Controller
export const deleteRoute = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid route ID format",
        code: "INVALID_ID",
      });
    }

    // Find route
    const route = await Route.findById(id).session(session);
    if (!route || route.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Route not found",
        code: "ROUTE_NOT_FOUND",
      });
    }

    // Check for active buses
    const activeBuses = await Bus.countDocuments({
      route: id,
      isDeleted: false,
      isActive: true,
    }).session(session);

    if (activeBuses > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete route with active buses assigned",
        code: "ROUTE_HAS_ACTIVE_BUSES",
        activeBusCount: activeBuses,
      });
    }

    // Soft delete route
    route.isDeleted = true;
    route.isActive = false;
    route.updatedBy = userId;
    await route.save({ session });

    // Remove route reference from buses (set to null instead of removing)
    await Bus.updateMany(
      { route: id },
      {
        $unset: { route: 1 },
        $set: {
          isActive: false,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      },
      { session }
    );

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Route deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Delete Route Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  } finally {
    session.endSession();
  }
};

// Get route with buses and their schedules for both directions
export const getRouteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid route ID format",
        code: "INVALID_ID",
      });
    }

    const route = await Route.findById(id)
      .populate({
        path: "buses",
        match: { isActive: true, isDeleted: false },
        select:
          "busId busName busNumber operator forwardTrip returnTrip operatingDays totalSeats bookedSeats",
      })
      .lean();

    if (!route) {
      return res.status(404).json({
        success: false,
        message: "Route not found",
        code: "ROUTE_NOT_FOUND",
      });
    }

    let scheduleData = {
      route: {
        _id: route._id,
        routeCode: route.routeCode,
        origin: route.origin,
        destination: route.destination,
        distance: route.distance,
        duration: route.duration,
        stops: route.stops,
      },
      forwardSchedule: [],
      returnSchedule: [],
    };

    // If date is provided, filter by operating day and calculate availability
    if (date) {
      const searchDate = new Date(date);
      const dayOfWeek = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][searchDate.getDay()];

      const activeBuses = route.buses.filter((bus) =>
        bus.operatingDays.includes(dayOfWeek)
      );

      // Process forward direction
      scheduleData.forwardSchedule = activeBuses
        .map((bus) => {
          const bookedSeatsForward =
            bus.bookedSeats?.filter(
              (bs) =>
                isSameDate(new Date(bs.travelDate), searchDate) &&
                bs.direction === "forward"
            ).length || 0;

          return {
            busId: bus.busId,
            busName: bus.busName,
            busNumber: bus.busNumber,
            operator: bus.operator,
            departureTime: `${String(
              bus.forwardTrip.departureTime.hours
            ).padStart(2, "0")}:${String(
              bus.forwardTrip.departureTime.minutes
            ).padStart(2, "0")}`,
            arrivalTime: `${String(bus.forwardTrip.arrivalTime.hours).padStart(
              2,
              "0"
            )}:${String(bus.forwardTrip.arrivalTime.minutes).padStart(2, "0")}`,
            availableSeats: bus.totalSeats - bookedSeatsForward,
            totalSeats: bus.totalSeats,
          };
        })
        .sort((a, b) => a.departureTime.localeCompare(b.departureTime));

      // Process return direction
      scheduleData.returnSchedule = activeBuses
        .map((bus) => {
          const bookedSeatsReturn =
            bus.bookedSeats?.filter(
              (bs) =>
                isSameDate(new Date(bs.travelDate), searchDate) &&
                bs.direction === "return"
            ).length || 0;

          return {
            busId: bus.busId,
            busName: bus.busName,
            busNumber: bus.busNumber,
            operator: bus.operator,
            departureTime: `${String(
              bus.returnTrip.departureTime.hours
            ).padStart(2, "0")}:${String(
              bus.returnTrip.departureTime.minutes
            ).padStart(2, "0")}`,
            arrivalTime: `${String(bus.returnTrip.arrivalTime.hours).padStart(
              2,
              "0"
            )}:${String(bus.returnTrip.arrivalTime.minutes).padStart(2, "0")}`,
            availableSeats: bus.totalSeats - bookedSeatsReturn,
            totalSeats: bus.totalSeats,
          };
        })
        .sort((a, b) => a.departureTime.localeCompare(b.departureTime));

      scheduleData.date = date;
      scheduleData.dayOfWeek = dayOfWeek;
    } else {
      // If no date provided, just show all buses without availability
      scheduleData.forwardSchedule = route.buses
        .map((bus) => ({
          busId: bus.busId,
          busName: bus.busName,
          busNumber: bus.busNumber,
          operator: bus.operator,
          departureTime: `${String(
            bus.forwardTrip.departureTime.hours
          ).padStart(2, "0")}:${String(
            bus.forwardTrip.departureTime.minutes
          ).padStart(2, "0")}`,
          arrivalTime: `${String(bus.forwardTrip.arrivalTime.hours).padStart(
            2,
            "0"
          )}:${String(bus.forwardTrip.arrivalTime.minutes).padStart(2, "0")}`,
          operatingDays: bus.operatingDays,
          totalSeats: bus.totalSeats,
        }))
        .sort((a, b) => a.departureTime.localeCompare(b.departureTime));

      scheduleData.returnSchedule = route.buses
        .map((bus) => ({
          busId: bus.busId,
          busName: bus.busName,
          busNumber: bus.busNumber,
          operator: bus.operator,
          departureTime: `${String(bus.returnTrip.departureTime.hours).padStart(
            2,
            "0"
          )}:${String(bus.returnTrip.departureTime.minutes).padStart(2, "0")}`,
          arrivalTime: `${String(bus.returnTrip.arrivalTime.hours).padStart(
            2,
            "0"
          )}:${String(bus.returnTrip.arrivalTime.minutes).padStart(2, "0")}`,
          operatingDays: bus.operatingDays,
          totalSeats: bus.totalSeats,
        }))
        .sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    }

    res.json({
      success: true,
      data: scheduleData,
    });
  } catch (error) {
    console.error("Get Route Schedule Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};
