import { Bus } from "../models/bus.js";
import { Route } from "../models/route.js";
import mongoose from "mongoose";

// Helper function to convert time object to minutes for comparison
const timeToMinutes = (timeObj) => {
  if (!timeObj || typeof timeObj !== "object") return 0;
  return (timeObj.hours || 0) * 60 + (timeObj.minutes || 0);
};

// Helper function to format time object to readable string
const formatTime = (timeObj) => {
  if (!timeObj || typeof timeObj !== "object") return "00:00";
  const hours = String(timeObj.hours || 0).padStart(2, "0");
  const minutes = String(timeObj.minutes || 0).padStart(2, "0");
  return `${hours}:${minutes}`;
};

// Helper function to create DateTime from date and time object
const createDateTime = (dateStr, timeObj) => {
  const date = new Date(dateStr);
  date.setHours(timeObj.hours || 0);
  date.setMinutes(timeObj.minutes || 0);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
};

// Helper function to check if two dates are the same day
const isSameDate = (date1, date2) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export const searchBuses = async (req, res) => {
  try {
    const { origin, destination, date, direction = "both" } = req.query;

    // Validate input
    if (!origin || !destination || !date) {
      return res.status(400).json({
        success: false,
        message: "Origin, destination, and date are required parameters",
        code: "MISSING_PARAMETERS",
      });
    }

    // Validate direction parameter
    if (!["forward", "return", "both"].includes(direction)) {
      return res.status(400).json({
        success: false,
        message: "Direction must be 'forward', 'return', or 'both'",
        code: "INVALID_DIRECTION",
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
        code: "INVALID_DATE_FORMAT",
      });
    }

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

    // Find routes that contain both origin and destination as stops
    const matchingRoutes = await Route.find({
      "stops.city": {
        $all: [new RegExp(origin, "i"), new RegExp(destination, "i")],
      },
      isActive: true,
    }).lean();

    if (matchingRoutes.length === 0) {
      return res.json({
        success: true,
        count: 0,
        message: "No routes found for the given origin and destination",
        data: [],
      });
    }

    const results = [];

    // Process each route for both directions
    for (const route of matchingRoutes) {
      const originStopIndex = route.stops.findIndex((stop) =>
        stop.city.toLowerCase().includes(origin.toLowerCase())
      );
      const destinationStopIndex = route.stops.findIndex((stop) =>
        stop.city.toLowerCase().includes(destination.toLowerCase())
      );

      if (originStopIndex === -1 || destinationStopIndex === -1) continue;

      // Determine possible directions based on stop order
      const possibleDirections = [];

      // Forward direction: origin comes before destination in route
      if (
        (direction === "both" || direction === "forward") &&
        originStopIndex < destinationStopIndex
      ) {
        possibleDirections.push("forward");
      }

      // Return direction: origin comes after destination in route (reverse journey)
      if (
        (direction === "both" || direction === "return") &&
        originStopIndex > destinationStopIndex
      ) {
        possibleDirections.push("return");
      }

      // Get buses for this route
      const buses = await Bus.find({
        route: route._id,
        operatingDays: dayOfWeek,
        isActive: true,
        isDeleted: false,
      }).lean();

      // Process each bus for each possible direction
      for (const bus of buses) {
        for (const dir of possibleDirections) {
          const boardingStop = route.stops[originStopIndex];
          const droppingStop = route.stops[destinationStopIndex];

          let journeyDistance;
          if (dir === "forward") {
            journeyDistance =
              droppingStop.distanceFromOrigin - boardingStop.distanceFromOrigin;
          } else {
            // For return trips, calculate distance correctly
            journeyDistance =
              boardingStop.distanceFromOrigin - droppingStop.distanceFromOrigin;
          }

          // Ensure positive distance
          journeyDistance = Math.abs(journeyDistance);
          const farePerPassenger = bus.farePerKm * journeyDistance;

          // Get timing for this direction
          const timing = dir === "forward" ? bus.forwardTrip : bus.returnTrip;
          if (!timing || !timing.departureTime || !timing.arrivalTime) {
            continue;
          }

          // Get booked seats for this direction and date
          const bookedSeats =
            bus.bookedSeats
              ?.filter(
                (bs) =>
                  bs.travelDate &&
                  isSameDate(new Date(bs.travelDate), searchDate) &&
                  bs.direction === dir
              )
              .map((bs) => bs.seatNumber) || [];

          // Calculate departure and arrival times
          const departureDateTime = createDateTime(date, timing.departureTime);
          const arrivalDateTime = createDateTime(date, timing.arrivalTime);

          // Handle overnight journeys
          if (
            timeToMinutes(timing.arrivalTime) <=
            timeToMinutes(timing.departureTime)
          ) {
            arrivalDateTime.setDate(arrivalDateTime.getDate() + 1);
          }

          // Calculate journey duration
          const journeyDurationMs = arrivalDateTime - departureDateTime;
          const journeyHours = Math.floor(journeyDurationMs / (1000 * 60 * 60));
          const journeyMinutes = Math.floor(
            (journeyDurationMs % (1000 * 60 * 60)) / (1000 * 60)
          );

          results.push({
            _id: bus._id,
            busId: bus.busId,
            busName: bus.busName,
            busNumber: bus.busNumber,
            operator: bus.operator,
            totalSeats: bus.totalSeats,
            availableSeats: bus.totalSeats - bookedSeats.length,
            amenities: bus.amenities,
            features: bus.features,
            farePerKm: bus.farePerKm,
            operatingDays: bus.operatingDays,
            bookedSeats,
            direction: dir,
            route: {
              _id: route._id,
              routeCode: route.routeCode,
              origin: dir === "forward" ? route.origin : route.destination,
              destination: dir === "forward" ? route.destination : route.origin,
              distance: route.distance,
              duration: route.duration,
              stops:
                dir === "forward"
                  ? route.stops
                  : [...route.stops].reverse().map((stop) => ({
                      ...stop,
                      distanceFromOrigin:
                        route.distance - stop.distanceFromOrigin,
                    })),
            },
            boardingPoint: boardingStop.city,
            droppingPoint: droppingStop.city,
            boardingDistance:
              dir === "forward"
                ? boardingStop.distanceFromOrigin
                : route.distance - boardingStop.distanceFromOrigin,
            droppingDistance:
              dir === "forward"
                ? droppingStop.distanceFromOrigin
                : route.distance - droppingStop.distanceFromOrigin,
            journeyDistance: Math.round(journeyDistance * 100) / 100,
            farePerPassenger: Number.parseFloat(farePerPassenger.toFixed(2)),
            departureDateTime,
            arrivalDateTime,
            departureTime: formatTime(timing.departureTime),
            arrivalTime: formatTime(timing.arrivalTime),
            journeyDuration: {
              hours: journeyHours,
              minutes: journeyMinutes,
              formatted: `${journeyHours}h ${journeyMinutes}m`,
            },
            timing,
            travelDate: date,
            dayOfWeek,
          });
        }
      }
    }

    // Sort by departure time
    const sortedResults = results.sort(
      (a, b) => a.departureDateTime - b.departureDateTime
    );

    res.json({
      success: true,
      count: sortedResults.length,
      date,
      dayOfWeek,
      searchCriteria: {
        origin,
        destination,
        date,
        direction,
      },
      data: sortedResults,
    });
  } catch (error) {
    console.error("Search Buses Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const searchBusesFlexible = async (req, res) => {
  try {
    const { origin, destination, date, direction = "both" } = req.query;

    // Validate input
    if (!origin || !destination || !date) {
      return res.status(400).json({
        success: false,
        message: "Origin, destination, and date are required parameters",
        code: "MISSING_PARAMETERS",
      });
    }

    if (!["forward", "return", "both"].includes(direction)) {
      return res.status(400).json({
        success: false,
        message: "Direction must be 'forward', 'return', or 'both'",
        code: "INVALID_DIRECTION",
      });
    }

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

    // Find matching routes
    const matchingRoutes = await Route.find({
      "stops.city": {
        $all: [new RegExp(origin, "i"), new RegExp(destination, "i")],
      },
      isActive: true,
    }).lean();

    if (matchingRoutes.length === 0) {
      return res.json({
        success: true,
        count: 0,
        message: "No routes found for the given origin and destination",
        data: [],
      });
    }

    const results = [];

    // Process each route for both directions if needed
    for (const route of matchingRoutes) {
      const originStopIndex = route.stops.findIndex((stop) =>
        stop.city.toLowerCase().includes(origin.toLowerCase())
      );
      const destinationStopIndex = route.stops.findIndex((stop) =>
        stop.city.toLowerCase().includes(destination.toLowerCase())
      );

      if (originStopIndex === -1 || destinationStopIndex === -1) continue;

      // Determine possible directions
      const possibleDirections = [];
      if (direction === "both" || direction === "forward") {
        if (originStopIndex < destinationStopIndex) {
          possibleDirections.push("forward");
        }
      }
      if (direction === "both" || direction === "return") {
        if (originStopIndex > destinationStopIndex) {
          possibleDirections.push("return");
        }
      }

      // Get buses for this route
      const buses = await Bus.find({
        route: route._id,
        operatingDays: dayOfWeek,
        isActive: true,
        isDeleted: false,
      }).lean();

      // Process each bus for each possible direction
      for (const bus of buses) {
        for (const dir of possibleDirections) {
          const boardingStopIndex =
            dir === "forward" ? originStopIndex : destinationStopIndex;
          const droppingStopIndex =
            dir === "forward" ? destinationStopIndex : originStopIndex;
          const boardingStop = route.stops[boardingStopIndex];
          const droppingStop = route.stops[droppingStopIndex];

          // Calculate journey distance
          let journeyDistance;
          if (dir === "forward") {
            journeyDistance =
              droppingStop.distanceFromOrigin - boardingStop.distanceFromOrigin;
          } else {
            const totalDistance = route.distance;
            const reverseBoardingDistance =
              totalDistance - boardingStop.distanceFromOrigin;
            const reverseDroppingDistance =
              totalDistance - droppingStop.distanceFromOrigin;
            journeyDistance = Math.abs(
              reverseBoardingDistance - reverseDroppingDistance
            );
          }

          const farePerPassenger = bus.farePerKm * journeyDistance;

          // Get timing for this direction
          const timing = dir === "forward" ? bus.forwardTrip : bus.returnTrip;
          if (!timing || !timing.departureTime || !timing.arrivalTime) {
            continue;
          }

          // Get booked seats for this direction and date
          const bookedSeats =
            bus.bookedSeats
              ?.filter(
                (bs) =>
                  bs.travelDate &&
                  isSameDate(new Date(bs.travelDate), searchDate) &&
                  bs.direction === dir
              )
              .map((bs) => bs.seatNumber) || [];

          // Calculate departure and arrival times
          const departureDateTime = createDateTime(date, timing.departureTime);
          const arrivalDateTime = createDateTime(date, timing.arrivalTime);

          // Handle overnight journeys
          if (
            timeToMinutes(timing.arrivalTime) <=
            timeToMinutes(timing.departureTime)
          ) {
            arrivalDateTime.setDate(arrivalDateTime.getDate() + 1);
          }

          // Calculate journey duration
          const journeyDurationMs = arrivalDateTime - departureDateTime;
          const journeyHours = Math.floor(journeyDurationMs / (1000 * 60 * 60));
          const journeyMinutes = Math.floor(
            (journeyDurationMs % (1000 * 60 * 60)) / (1000 * 60)
          );

          results.push({
            _id: bus._id,
            busId: bus.busId,
            busName: bus.busName,
            busNumber: bus.busNumber,
            operator: bus.operator,
            totalSeats: bus.totalSeats,
            availableSeats: bus.totalSeats - bookedSeats.length,
            amenities: bus.amenities,
            features: bus.features,
            farePerKm: bus.farePerKm,
            operatingDays: bus.operatingDays,
            bookedSeats,
            direction: dir,
            route: {
              _id: route._id,
              routeCode: route.routeCode,
              origin: dir === "forward" ? route.origin : route.destination,
              destination: dir === "forward" ? route.destination : route.origin,
              distance: route.distance,
              duration: route.duration,
              stops:
                dir === "forward"
                  ? route.stops
                  : [...route.stops].reverse().map((stop) => ({
                      ...stop,
                      distanceFromOrigin:
                        route.distance - stop.distanceFromOrigin,
                    })),
            },
            boardingPoint: boardingStop.city,
            droppingPoint: droppingStop.city,
            boardingDistance:
              dir === "forward"
                ? boardingStop.distanceFromOrigin
                : route.distance - boardingStop.distanceFromOrigin,
            droppingDistance:
              dir === "forward"
                ? droppingStop.distanceFromOrigin
                : route.distance - droppingStop.distanceFromOrigin,
            journeyDistance: Math.round(journeyDistance * 100) / 100,
            farePerPassenger: Number.parseFloat(farePerPassenger.toFixed(2)),
            departureDateTime,
            arrivalDateTime,
            departureTime: formatTime(timing.departureTime),
            arrivalTime: formatTime(timing.arrivalTime),
            journeyDuration: {
              hours: journeyHours,
              minutes: journeyMinutes,
              formatted: `${journeyHours}h ${journeyMinutes}m`,
            },
            timing,
            travelDate: date,
            dayOfWeek,
          });
        }
      }
    }

    // Sort by departure time
    const sortedResults = results.sort(
      (a, b) => a.departureDateTime - b.departureDateTime
    );

    res.json({
      success: true,
      count: sortedResults.length,
      date,
      dayOfWeek,
      searchCriteria: {
        origin,
        destination,
        date,
        direction,
      },
      data: sortedResults,
    });
  } catch (error) {
    console.error("Flexible Search Buses Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getRouteOccupancy = async (req, res) => {
  try {
    const { routeId } = req.params;
    const { date } = req.query;

    if (!mongoose.Types.ObjectId.isValid(routeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid route ID format",
        code: "INVALID_ID",
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
        code: "MISSING_DATE",
      });
    }

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

    // Get route and its buses
    const route = await Route.findById(routeId).lean();
    if (!route) {
      return res.status(404).json({
        success: false,
        message: "Route not found",
        code: "ROUTE_NOT_FOUND",
      });
    }

    const buses = await Bus.find({
      route: routeId,
      operatingDays: dayOfWeek,
      isActive: true,
      isDeleted: false,
    }).lean();

    const occupancyData = {
      route: {
        routeCode: route.routeCode,
        origin: route.origin,
        destination: route.destination,
      },
      date,
      dayOfWeek,
      forward: {
        totalBuses: buses.length,
        totalSeats: buses.reduce((sum, bus) => sum + bus.totalSeats, 0),
        bookedSeats: 0,
        occupancyRate: 0,
        buses: [],
      },
      return: {
        totalBuses: buses.length,
        totalSeats: buses.reduce((sum, bus) => sum + bus.totalSeats, 0),
        bookedSeats: 0,
        occupancyRate: 0,
        buses: [],
      },
    };

    // Calculate occupancy for each bus in both directions
    for (const bus of buses) {
      // Forward direction
      const forwardBookedSeats =
        bus.bookedSeats?.filter(
          (bs) =>
            isSameDate(new Date(bs.travelDate), searchDate) &&
            bs.direction === "forward"
        ).length || 0;

      occupancyData.forward.bookedSeats += forwardBookedSeats;
      occupancyData.forward.buses.push({
        busId: bus.busId,
        busNumber: bus.busNumber,
        totalSeats: bus.totalSeats,
        bookedSeats: forwardBookedSeats,
        availableSeats: bus.totalSeats - forwardBookedSeats,
        occupancyRate: Math.round((forwardBookedSeats / bus.totalSeats) * 100),
      });

      // Return direction
      const returnBookedSeats =
        bus.bookedSeats?.filter(
          (bs) =>
            isSameDate(new Date(bs.travelDate), searchDate) &&
            bs.direction === "return"
        ).length || 0;

      occupancyData.return.bookedSeats += returnBookedSeats;
      occupancyData.return.buses.push({
        busId: bus.busId,
        busNumber: bus.busNumber,
        totalSeats: bus.totalSeats,
        bookedSeats: returnBookedSeats,
        availableSeats: bus.totalSeats - returnBookedSeats,
        occupancyRate: Math.round((returnBookedSeats / bus.totalSeats) * 100),
      });
    }

    // Calculate occupancy rates
    occupancyData.forward.occupancyRate =
      occupancyData.forward.totalSeats === 0
        ? 0
        : Math.round(
            (occupancyData.forward.bookedSeats /
              occupancyData.forward.totalSeats) *
              100
          );

    occupancyData.return.occupancyRate =
      occupancyData.return.totalSeats === 0
        ? 0
        : Math.round(
            (occupancyData.return.bookedSeats /
              occupancyData.return.totalSeats) *
              100
          );

    res.json({
      success: true,
      data: occupancyData,
    });
  } catch (error) {
    console.error("Get Route Occupancy Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getBusSeatLayout = async (req, res) => {
  try {
    const { busId, travelDate, direction = "forward" } = req.query;

    if (!busId || !travelDate) {
      return res.status(400).json({
        success: false,
        message: "Bus ID and travel date are required",
        code: "MISSING_PARAMETERS",
      });
    }

    if (!["forward", "return"].includes(direction)) {
      return res.status(400).json({
        success: false,
        message: "Direction must be either 'forward' or 'return'",
        code: "INVALID_DIRECTION",
      });
    }

    const bus = await Bus.findById(busId).populate({
      path: "route",
      select: "routeCode origin destination stops",
    });

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
        code: "BUS_NOT_FOUND",
      });
    }

    // Parse input date as UTC midnight
    const targetDate = new Date(travelDate);
    const targetUTCDate = Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate()
    );

    // Get booked seats for this date and direction
    const bookedSeats = bus.bookedSeats
      .filter((bs) => {
        const bsDate = new Date(bs.travelDate);
        const bsUTCDate = Date.UTC(
          bsDate.getUTCFullYear(),
          bsDate.getUTCMonth(),
          bsDate.getUTCDate()
        );
        return bsUTCDate === targetUTCDate && bs.direction === direction;
      })
      .map((bs) => bs.seatNumber);

    // Get temporarily locked seats for this date and direction
    const now = new Date();
    const temporarilyLockedSeats = bus.temporaryLocks
      .filter((lock) => {
        const lockDate = new Date(lock.travelDate);
        const lockUTCDate = Date.UTC(
          lockDate.getUTCFullYear(),
          lockDate.getUTCMonth(),
          lockDate.getUTCDate()
        );
        return (
          lockUTCDate === targetUTCDate &&
          lock.direction === direction &&
          lock.expiresAt > now
        );
      })
      .map((lock) => lock.seatNumber);

    // Combine booked and locked seats
    const unavailableSeats = [
      ...new Set([...bookedSeats, ...temporarilyLockedSeats]),
    ];

    // Create seat layout with availability status
    const seatLayoutWithAvailability = bus.seatLayout.map((row) =>
      row.map((seat) => ({
        number: seat,
        available: !unavailableSeats.includes(seat),
        status: bookedSeats.includes(seat)
          ? "booked"
          : temporarilyLockedSeats.includes(seat)
          ? "locked"
          : "available",
      }))
    );

    // Get timing for the requested direction
    const timing = bus.getTimingForDirection(direction);

    res.json({
      success: true,
      data: {
        busId: bus._id,
        busName: bus.busName,
        busNumber: bus.busNumber,
        operator: bus.operator,
        totalSeats: bus.totalSeats,
        availableSeats: bus.totalSeats - unavailableSeats.length,
        bookedSeats: bookedSeats.length,
        temporarilyLocked: temporarilyLockedSeats.length,
        seatLayout: seatLayoutWithAvailability,
        direction,
        timing: {
          departureTime: formatTime(timing.departureTime),
          arrivalTime: formatTime(timing.arrivalTime),
        },
        route: {
          routeCode: bus.route.routeCode,
          origin:
            direction === "forward" ? bus.route.origin : bus.route.destination,
          destination:
            direction === "forward" ? bus.route.destination : bus.route.origin,
        },
        travelDate,
      },
    });
  } catch (error) {
    console.error("Seat Layout Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

export const getBusDetails = async (req, res) => {
  try {
    const { busId } = req.params;
    const { direction = "forward" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bus ID format",
        code: "INVALID_ID",
      });
    }

    if (!["forward", "return"].includes(direction)) {
      return res.status(400).json({
        success: false,
        message: "Direction must be either 'forward' or 'return'",
        code: "INVALID_DIRECTION",
      });
    }

    const bus = await Bus.findById(busId)
      .populate({
        path: "route",
        select: "routeCode origin destination distance duration stops",
      })
      .lean();

    if (!bus || bus.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
        code: "BUS_NOT_FOUND",
      });
    }

    // Get timing for the requested direction
    const timing = direction === "forward" ? bus.forwardTrip : bus.returnTrip;

    // Prepare route information based on direction
    const routeInfo = {
      ...bus.route,
      origin:
        direction === "forward" ? bus.route.origin : bus.route.destination,
      destination:
        direction === "forward" ? bus.route.destination : bus.route.origin,
      stops:
        direction === "forward"
          ? bus.route.stops
          : [...bus.route.stops].reverse().map((stop) => ({
              ...stop,
              distanceFromOrigin: bus.route.distance - stop.distanceFromOrigin,
            })),
    };

    res.json({
      success: true,
      data: {
        ...bus,
        route: routeInfo,
        currentDirection: direction,
        timing: {
          departureTime: formatTime(timing.departureTime),
          arrivalTime: formatTime(timing.arrivalTime),
        },
        timingRaw: timing,
      },
    });
  } catch (error) {
    console.error("Get Bus Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

export const getAvailableSeats = async (req, res) => {
  try {
    const { busId } = req.params;
    const { travelDate, direction = "forward" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bus ID format",
        code: "INVALID_ID",
      });
    }

    if (!travelDate) {
      return res.status(400).json({
        success: false,
        message: "Travel date is required",
        code: "MISSING_TRAVEL_DATE",
      });
    }

    if (!["forward", "return"].includes(direction)) {
      return res.status(400).json({
        success: false,
        message: "Direction must be either 'forward' or 'return'",
        code: "INVALID_DIRECTION",
      });
    }

    const bus = await Bus.findById(busId);
    if (!bus || bus.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
        code: "BUS_NOT_FOUND",
      });
    }

    // Get unavailable seats for the specified date and direction
    const unavailableSeats = bus.getUnavailableSeats(travelDate, direction);
    const allSeats = bus.seatLayout.flat();
    const availableSeats = allSeats.filter(
      (seat) => !unavailableSeats.includes(seat)
    );

    res.json({
      success: true,
      data: {
        busId: bus._id,
        travelDate,
        direction,
        totalSeats: bus.totalSeats,
        availableSeats: availableSeats,
        unavailableSeats: unavailableSeats,
        availableCount: availableSeats.length,
        unavailableCount: unavailableSeats.length,
      },
    });
  } catch (error) {
    console.error("Get Available Seats Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

export const getAllStops = async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;
    const parsedLimit = Number.parseInt(limit);
    const parsedOffset = Number.parseInt(offset);

    // Input validation
    if (
      isNaN(parsedLimit) ||
      isNaN(parsedOffset) ||
      parsedLimit < 1 ||
      parsedOffset < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
        code: "INVALID_PAGINATION",
      });
    }

    // Build aggregation pipeline
    const pipeline = [
      {
        $project: {
          allStops: "$stops.city",
        },
      },
      { $unwind: "$allStops" },
      {
        $group: {
          _id: null,
          uniqueStops: { $addToSet: "$allStops" },
        },
      },
    ];

    // Add search filter if provided
    if (search && search.trim()) {
      pipeline.push({
        $project: {
          _id: 0,
          filteredStops: {
            $filter: {
              input: "$uniqueStops",
              as: "stop",
              cond: {
                $regexMatch: {
                  input: "$$stop",
                  regex: new RegExp(search.trim(), "i"),
                },
              },
            },
          },
          totalCount: { $size: "$uniqueStops" },
        },
      });
      pipeline.push({
        $project: {
          stops: {
            $slice: [
              {
                $sortArray: {
                  input: "$filteredStops",
                  sortBy: 1,
                },
              },
              parsedOffset,
              parsedLimit,
            ],
          },
          totalCount: { $size: "$filteredStops" },
          allStopsCount: "$totalCount",
        },
      });
    } else {
      pipeline.push({
        $project: {
          _id: 0,
          stops: {
            $slice: [
              {
                $sortArray: {
                  input: "$uniqueStops",
                  sortBy: 1,
                },
              },
              parsedOffset,
              parsedLimit,
            ],
          },
          totalCount: { $size: "$uniqueStops" },
        },
      });
    }

    const stops = await Route.aggregate(pipeline);

    if (!stops.length) {
      return res.json({
        success: true,
        data: {
          stops: [],
          totalCount: 0,
          limit: parsedLimit,
          offset: parsedOffset,
          hasMore: false,
        },
      });
    }

    const result = stops[0];
    res.json({
      success: true,
      data: {
        stops: result.stops || [],
        totalCount: result.totalCount || 0,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + parsedLimit < (result.totalCount || 0),
        searchTerm: search || null,
      },
    });
  } catch (error) {
    console.error("Get Stops Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
