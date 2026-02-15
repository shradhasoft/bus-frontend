import { Bus } from "../models/bus.js";
import { Booking } from "../models/booking.js";
import { SeatHold } from "../models/seatHold.js";
import mongoose from "mongoose";
import {
  formatDateKey,
  getRouteExtentSegment,
  getSeatEntrySegment,
  normalizeDirection,
  normalizeSeatToken,
  resolveJourneySegment,
  segmentsOverlap,
} from "../utils/seatSegment.js";

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

const getStopDistanceValue = (stop, direction) => {
  const trip = direction === "return" ? stop?.downTrip : stop?.upTrip;
  return typeof trip?.distanceFromOrigin === "number"
    ? trip.distanceFromOrigin
    : null;
};

const buildStopsForDirection = (stops, direction) => {
  if (!Array.isArray(stops)) return [];
  if (direction === "forward") {
    return stops.map((stop) => ({
      city: stop.city,
      arrivalTime: stop.upTrip?.arrivalTime,
      departureTime: stop.upTrip?.departureTime,
    }));
  }

  return [...stops].reverse().map((stop) => ({
    city: stop.city,
    arrivalTime: stop.downTrip?.arrivalTime,
    departureTime: stop.downTrip?.departureTime,
  }));
};

const buildRouteInfo = (route, direction) => {
  if (!route) return null;
  return {
    routeCode: route.routeCode,
    origin: direction === "forward" ? route.origin : route.destination,
    destination: direction === "forward" ? route.destination : route.origin,
    duration: route.duration,
    stops: buildStopsForDirection(route.stops, direction),
    cancellationPolicy: route.cancellationPolicy,
  };
};

const buildBookingSegmentMapForEntries = async (entries = []) => {
  const bookingIds = Array.from(
    new Set(
      entries
        .map((entry) => {
          if (!entry?.bookingId) return "";
          if (typeof entry.bookingId === "string") return entry.bookingId;
          if (entry.bookingId?._id) return String(entry.bookingId._id);
          return String(entry.bookingId);
        })
        .filter(Boolean),
    ),
  ).filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (bookingIds.length === 0) return new Map();

  const bookings = await Booking.find({ _id: { $in: bookingIds } })
    .select("_id route direction boardingPoint droppingPoint")
    .lean();

  const segmentMap = new Map();
  for (const booking of bookings) {
    const segment = resolveJourneySegment({
      route: booking?.route,
      direction: normalizeDirection(booking?.direction),
      boardingPoint: booking?.boardingPoint,
      droppingPoint: booking?.droppingPoint,
    });
    if (segment) {
      segmentMap.set(String(booking._id), segment);
    }
  }
  return segmentMap;
};

const hasSegmentBounds = (entry) =>
  Number.isFinite(Number(entry?.segmentStartKm)) &&
  Number.isFinite(Number(entry?.segmentEndKm));

const resolveBookingSegmentMapIfNeeded = async (entries = []) => {
  const requiresLookup = entries.some(
    (entry) => entry?.bookingId && !hasSegmentBounds(entry),
  );
  if (!requiresLookup) return new Map();
  return buildBookingSegmentMapForEntries(entries);
};

const collectBookedSeatsForSegment = ({
  entries,
  travelDate,
  direction,
  requestedSegment,
  defaultRoute,
  bookingSegmentMap = new Map(),
}) => {
  const result = new Set();
  const dateKey = formatDateKey(travelDate);
  const normalizedDirection = normalizeDirection(direction);

  for (const entry of entries || []) {
    const seatId = normalizeSeatToken(entry?.seatNumber);
    if (!seatId) continue;
    if (formatDateKey(entry?.travelDate) !== dateKey) continue;
    if (normalizeDirection(entry?.direction) !== normalizedDirection) continue;

    const bookingId =
      typeof entry?.bookingId === "string"
        ? entry.bookingId
        : entry?.bookingId?._id
          ? String(entry.bookingId._id)
          : entry?.bookingId
            ? String(entry.bookingId)
            : "";
    const bookingSegment = bookingSegmentMap.get(bookingId) || null;
    const entrySegment = getSeatEntrySegment({
      seatEntry: entry,
      route: defaultRoute,
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
      result.add(seatId);
    }
  }

  return Array.from(result);
};

const collectHeldSeatsForSegment = ({
  holds,
  requestedSegment,
  defaultRoute,
  direction,
}) => {
  const result = new Set();
  const normalizedDirection = normalizeDirection(direction);

  for (const hold of holds || []) {
    const seatId = normalizeSeatToken(hold?.seatId);
    if (!seatId) continue;

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
      result.add(seatId);
    }
  }

  return Array.from(result);
};

const buildSeatStatusMap = (seatIds, bookedSeats, lockedSeats) => {
  const statusMap = new Map();
  for (const seatId of seatIds) {
    statusMap.set(seatId, "available");
  }
  for (const seatId of bookedSeats) {
    statusMap.set(seatId, "booked");
  }
  for (const seatId of lockedSeats) {
    if (!statusMap.has(seatId)) continue;
    if (statusMap.get(seatId) === "available") {
      statusMap.set(seatId, "locked");
    }
  }
  return statusMap;
};

const buildSeatLayoutResponse = (seatLayout, bookedSeats, lockedSeats) => {
  if (!seatLayout) return null;
  const layout = seatLayout.toObject ? seatLayout.toObject() : seatLayout;
  const seats = Array.isArray(layout.seats) ? layout.seats : [];
  const seatIds = seats.map((seat) => seat.seatId);
  const statusMap = buildSeatStatusMap(seatIds, bookedSeats, lockedSeats);
  const seatMap = new Map(seats.map((seat) => [seat.seatId, seat]));

  return {
    ...layout,
    seats: seats.map((seat) => ({
      ...seat,
      status: statusMap.get(seat.seatId) || "available",
      available: statusMap.get(seat.seatId) === "available",
    })),
    decks: Array.isArray(layout.decks)
      ? layout.decks.map((deck) => ({
          ...deck,
          elements: Array.isArray(deck.elements)
            ? deck.elements.map((element) => {
                if (element.type !== "SEAT") return element;
                const seatId = element.seatId;
                const status = statusMap.get(seatId) || "available";
                return {
                  ...element,
                  seat: seatMap.get(seatId) || null,
                  status,
                  available: status === "available",
                };
              })
            : [],
        }))
      : [],
  };
};

const buildUtcDayRange = (dateValue) => {
  const date = new Date(dateValue);
  const dayStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
};

const buildActiveHoldMap = async (busIds, travelDate) => {
  if (!busIds.length) return new Map();
  const now = new Date();
  const { dayStart, dayEnd } = buildUtcDayRange(travelDate);
  const results = await SeatHold.find({
    bus: { $in: busIds },
    travelDate: { $gte: dayStart, $lt: dayEnd },
    status: "HOLD",
    expiresAt: { $gt: now },
  })
    .select("bus direction seatId segmentStartKm segmentEndKm metadata")
    .lean();

  const map = new Map();
  for (const row of results) {
    const key = `${row.bus.toString()}_${normalizeDirection(row.direction)}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(row);
  }
  return map;
};

const getHoldsForBusDirection = (map, busId, direction) =>
  map.get(`${busId}_${normalizeDirection(direction)}`) || [];

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
    if (Number.isNaN(searchDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date value",
        code: "INVALID_DATE",
      });
    }
    const dayOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][searchDate.getDay()];

    const matchingBuses = await Bus.find({
      "route.stops.city": {
        $all: [new RegExp(origin, "i"), new RegExp(destination, "i")],
      },
      operatingDays: dayOfWeek,
      isActive: true,
      isDeleted: false,
      inactiveDates: { $ne: date },
    }).lean();

    if (matchingBuses.length === 0) {
      return res.json({
        success: true,
        count: 0,
        message: "No routes found for the given origin and destination",
        data: [],
      });
    }

    const activeHoldMap = await buildActiveHoldMap(
      matchingBuses.map((bus) => bus._id),
      searchDate,
    );

    const now = new Date();
    const results = [];

    for (const bus of matchingBuses) {
      const route = bus.route;
      if (!route || !Array.isArray(route.stops)) continue;

      const originStopIndex = route.stops.findIndex((stop) =>
        stop.city.toLowerCase().includes(origin.toLowerCase()),
      );
      const destinationStopIndex = route.stops.findIndex((stop) =>
        stop.city.toLowerCase().includes(destination.toLowerCase()),
      );

      if (originStopIndex === -1 || destinationStopIndex === -1) continue;

      const possibleDirections = [];

      if (
        (direction === "both" || direction === "forward") &&
        originStopIndex < destinationStopIndex
      ) {
        possibleDirections.push("forward");
      }

      if (
        (direction === "both" || direction === "return") &&
        originStopIndex > destinationStopIndex
      ) {
        possibleDirections.push("return");
      }

      for (const dir of possibleDirections) {
        const boardingStop = route.stops[originStopIndex];
        const droppingStop = route.stops[destinationStopIndex];

        const originDistance = getStopDistanceValue(boardingStop, dir);
        const destinationDistance = getStopDistanceValue(droppingStop, dir);

        if (originDistance === null || destinationDistance === null) {
          continue;
        }

        let journeyDistance = Math.abs(destinationDistance - originDistance);
        const farePerPassenger = bus.farePerKm * journeyDistance;

        const boardingTrip =
          dir === "forward" ? boardingStop.upTrip : boardingStop.downTrip;
        const droppingTrip =
          dir === "forward" ? droppingStop.upTrip : droppingStop.downTrip;

        if (!boardingTrip?.departureTime || !droppingTrip?.arrivalTime) {
          continue;
        }

        const requestedSegment = {
          segmentStartKm: Math.min(originDistance, destinationDistance),
          segmentEndKm: Math.max(originDistance, destinationDistance),
        };
        const sameTripEntries = (bus.bookedSeats || []).filter(
          (entry) =>
            formatDateKey(entry?.travelDate) === formatDateKey(searchDate) &&
            normalizeDirection(entry?.direction) === dir,
        );
        const bookingSegmentMap =
          await resolveBookingSegmentMapIfNeeded(sameTripEntries);
        const bookedSeats = collectBookedSeatsForSegment({
          entries: sameTripEntries,
          travelDate: searchDate,
          direction: dir,
          requestedSegment,
          defaultRoute: bus.route,
          bookingSegmentMap,
        });
        const heldSeats = collectHeldSeatsForSegment({
          holds: getHoldsForBusDirection(activeHoldMap, bus._id, dir),
          requestedSegment,
          defaultRoute: bus.route,
          direction: dir,
        });
        const unavailableSeatCount = new Set([...bookedSeats, ...heldSeats])
          .size;

        const departureDateTime = createDateTime(
          date,
          boardingTrip.departureTime,
        );
        const arrivalDateTime = createDateTime(date, droppingTrip.arrivalTime);

        if (departureDateTime <= now) {
          continue;
        }

        if (
          timeToMinutes(droppingTrip.arrivalTime) <=
          timeToMinutes(boardingTrip.departureTime)
        ) {
          arrivalDateTime.setDate(arrivalDateTime.getDate() + 1);
        }

        const journeyDurationMs = arrivalDateTime - departureDateTime;
        const journeyHours = Math.floor(journeyDurationMs / (1000 * 60 * 60));
        const journeyMinutes = Math.floor(
          (journeyDurationMs % (1000 * 60 * 60)) / (1000 * 60),
        );

        results.push({
          _id: bus._id,
          busId: bus.busId,
          busName: bus.busName,
          busNumber: bus.busNumber,
          operator: bus.operator,
          totalSeats: bus.totalSeats,
          availableSeats: Math.max(0, bus.totalSeats - unavailableSeatCount),
          amenities: bus.amenities,
          features: bus.features,
          farePerKm: bus.farePerKm,
          operatingDays: bus.operatingDays,
          bookedSeats,
          heldSeats: heldSeats.length,
          direction: dir,
          route: buildRouteInfo(route, dir),
          boardingPoint: boardingStop.city,
          droppingPoint: droppingStop.city,
          farePerPassenger: Number.parseFloat(farePerPassenger.toFixed(2)),
          departureDateTime,
          arrivalDateTime,
          departureTime: formatTime(boardingTrip.departureTime),
          arrivalTime: formatTime(droppingTrip.arrivalTime),
          journeyDuration: {
            hours: journeyHours,
            minutes: journeyMinutes,
            formatted: `${journeyHours}h ${journeyMinutes}m`,
          },
          timing: {
            departureTime: boardingTrip.departureTime,
            arrivalTime: droppingTrip.arrivalTime,
          },
          travelDate: date,
          dayOfWeek,
        });
      }
    }

    // Sort by departure time
    const sortedResults = results.sort(
      (a, b) => a.departureDateTime - b.departureDateTime,
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
    if (Number.isNaN(searchDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date value",
        code: "INVALID_DATE",
      });
    }
    const dayOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][searchDate.getDay()];

    const matchingBuses = await Bus.find({
      "route.stops.city": {
        $all: [new RegExp(origin, "i"), new RegExp(destination, "i")],
      },
      operatingDays: dayOfWeek,
      isActive: true,
      isDeleted: false,
      inactiveDates: { $ne: date },
    }).lean();

    if (matchingBuses.length === 0) {
      return res.json({
        success: true,
        count: 0,
        message: "No routes found for the given origin and destination",
        data: [],
      });
    }

    const activeHoldMap = await buildActiveHoldMap(
      matchingBuses.map((bus) => bus._id),
      searchDate,
    );

    const now = new Date();
    const results = [];

    for (const bus of matchingBuses) {
      const route = bus.route;
      if (!route || !Array.isArray(route.stops)) continue;

      const originStopIndex = route.stops.findIndex((stop) =>
        stop.city.toLowerCase().includes(origin.toLowerCase()),
      );
      const destinationStopIndex = route.stops.findIndex((stop) =>
        stop.city.toLowerCase().includes(destination.toLowerCase()),
      );

      if (originStopIndex === -1 || destinationStopIndex === -1) continue;

      const possibleDirections = [];
      if (
        (direction === "both" || direction === "forward") &&
        originStopIndex < destinationStopIndex
      ) {
        possibleDirections.push("forward");
      }
      if (
        (direction === "both" || direction === "return") &&
        originStopIndex > destinationStopIndex
      ) {
        possibleDirections.push("return");
      }

      for (const dir of possibleDirections) {
        const boardingStop = route.stops[originStopIndex];
        const droppingStop = route.stops[destinationStopIndex];

        const originDistance = getStopDistanceValue(boardingStop, dir);
        const destinationDistance = getStopDistanceValue(droppingStop, dir);

        if (originDistance === null || destinationDistance === null) {
          continue;
        }

        let journeyDistance = Math.abs(destinationDistance - originDistance);
        const farePerPassenger = bus.farePerKm * journeyDistance;

        const boardingTrip =
          dir === "forward" ? boardingStop.upTrip : boardingStop.downTrip;
        const droppingTrip =
          dir === "forward" ? droppingStop.upTrip : droppingStop.downTrip;

        if (!boardingTrip?.departureTime || !droppingTrip?.arrivalTime) {
          continue;
        }

        const requestedSegment = {
          segmentStartKm: Math.min(originDistance, destinationDistance),
          segmentEndKm: Math.max(originDistance, destinationDistance),
        };
        const sameTripEntries = (bus.bookedSeats || []).filter(
          (entry) =>
            formatDateKey(entry?.travelDate) === formatDateKey(searchDate) &&
            normalizeDirection(entry?.direction) === dir,
        );
        const bookingSegmentMap =
          await resolveBookingSegmentMapIfNeeded(sameTripEntries);
        const bookedSeats = collectBookedSeatsForSegment({
          entries: sameTripEntries,
          travelDate: searchDate,
          direction: dir,
          requestedSegment,
          defaultRoute: bus.route,
          bookingSegmentMap,
        });
        const heldSeats = collectHeldSeatsForSegment({
          holds: getHoldsForBusDirection(activeHoldMap, bus._id, dir),
          requestedSegment,
          defaultRoute: bus.route,
          direction: dir,
        });
        const unavailableSeatCount = new Set([...bookedSeats, ...heldSeats])
          .size;

        const departureDateTime = createDateTime(
          date,
          boardingTrip.departureTime,
        );
        const arrivalDateTime = createDateTime(date, droppingTrip.arrivalTime);

        if (departureDateTime <= now) {
          continue;
        }

        if (
          timeToMinutes(droppingTrip.arrivalTime) <=
          timeToMinutes(boardingTrip.departureTime)
        ) {
          arrivalDateTime.setDate(arrivalDateTime.getDate() + 1);
        }

        const journeyDurationMs = arrivalDateTime - departureDateTime;
        const journeyHours = Math.floor(journeyDurationMs / (1000 * 60 * 60));
        const journeyMinutes = Math.floor(
          (journeyDurationMs % (1000 * 60 * 60)) / (1000 * 60),
        );

        results.push({
          _id: bus._id,
          busId: bus.busId,
          busName: bus.busName,
          busNumber: bus.busNumber,
          operator: bus.operator,
          totalSeats: bus.totalSeats,
          availableSeats: Math.max(0, bus.totalSeats - unavailableSeatCount),
          amenities: bus.amenities,
          features: bus.features,
          farePerKm: bus.farePerKm,
          operatingDays: bus.operatingDays,
          bookedSeats,
          heldSeats: heldSeats.length,
          direction: dir,
          route: buildRouteInfo(route, dir),
          boardingPoint: boardingStop.city,
          droppingPoint: droppingStop.city,
          farePerPassenger: Number.parseFloat(farePerPassenger.toFixed(2)),
          departureDateTime,
          arrivalDateTime,
          departureTime: formatTime(boardingTrip.departureTime),
          arrivalTime: formatTime(droppingTrip.arrivalTime),
          journeyDuration: {
            hours: journeyHours,
            minutes: journeyMinutes,
            formatted: `${journeyHours}h ${journeyMinutes}m`,
          },
          timing: {
            departureTime: boardingTrip.departureTime,
            arrivalTime: droppingTrip.arrivalTime,
          },
          travelDate: date,
          dayOfWeek,
        });
      }
    }

    // Sort by departure time
    const sortedResults = results.sort(
      (a, b) => a.departureDateTime - b.departureDateTime,
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

    const routeCode = String(routeId || "").trim();

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
        code: "MISSING_DATE",
      });
    }

    if (!routeCode) {
      return res.status(400).json({
        success: false,
        message: "Route code is required",
        code: "MISSING_ROUTE_CODE",
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

    const buses = await Bus.find({
      "route.routeCode": routeCode.toUpperCase(),
      operatingDays: dayOfWeek,
      isActive: true,
      isDeleted: false,
      inactiveDates: { $ne: date },
    }).lean();

    if (!buses.length) {
      return res.status(404).json({
        success: false,
        message: "Route not found",
        code: "ROUTE_NOT_FOUND",
      });
    }

    const route = buses[0]?.route;

    const occupancyData = {
      route: {
        routeCode: route?.routeCode || routeCode.toUpperCase(),
        origin: route?.origin,
        destination: route?.destination,
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
            bs.direction === "forward",
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
            bs.direction === "return",
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
              100,
          );

    occupancyData.return.occupancyRate =
      occupancyData.return.totalSeats === 0
        ? 0
        : Math.round(
            (occupancyData.return.bookedSeats /
              occupancyData.return.totalSeats) *
              100,
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
    const {
      busId,
      travelDate,
      direction = "forward",
      boardingPoint,
      droppingPoint,
    } = req.query;

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

    if (
      (boardingPoint && !droppingPoint) ||
      (!boardingPoint && droppingPoint)
    ) {
      return res.status(400).json({
        success: false,
        message: "Both boardingPoint and droppingPoint are required",
        code: "INVALID_POINT",
      });
    }

    const bus = await Bus.findById(busId);

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
        code: "BUS_NOT_FOUND",
      });
    }

    const normalizedDirection = normalizeDirection(direction);
    const requestedSegment =
      boardingPoint && droppingPoint
        ? resolveJourneySegment({
            route: bus.route,
            direction: normalizedDirection,
            boardingPoint,
            droppingPoint,
          })
        : getRouteExtentSegment(bus.route, normalizedDirection);

    if (!requestedSegment) {
      return res.status(400).json({
        success: false,
        message: "Invalid boarding/dropping point",
        code: "INVALID_POINT",
      });
    }

    // Parse input date as UTC midnight
    const targetDate = new Date(travelDate);
    const targetUTCDate = Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
    );

    const sameTripEntries = (bus.bookedSeats || []).filter((entry) => {
      const entryDate = new Date(entry?.travelDate);
      const entryUTCDate = Date.UTC(
        entryDate.getUTCFullYear(),
        entryDate.getUTCMonth(),
        entryDate.getUTCDate(),
      );
      return (
        entryUTCDate === targetUTCDate &&
        normalizeDirection(entry?.direction) === normalizedDirection
      );
    });
    const bookingSegmentMap =
      await resolveBookingSegmentMapIfNeeded(sameTripEntries);
    const bookedSeats = collectBookedSeatsForSegment({
      entries: sameTripEntries,
      travelDate: targetDate,
      direction: normalizedDirection,
      requestedSegment,
      defaultRoute: bus.route,
      bookingSegmentMap,
    });

    // Get temporarily locked seats for this date, direction and requested segment
    const now = new Date();
    const { dayStart, dayEnd } = buildUtcDayRange(travelDate);

    const temporarilyLockedSeats = await SeatHold.find({
      bus: bus._id,
      direction: normalizedDirection,
      status: "HOLD",
      expiresAt: { $gt: now },
      travelDate: { $gte: dayStart, $lt: dayEnd },
    })
      .select("seatId segmentStartKm segmentEndKm metadata")
      .lean();

    const lockedSeatIds = collectHeldSeatsForSegment({
      holds: temporarilyLockedSeats,
      requestedSegment,
      defaultRoute: bus.route,
      direction: normalizedDirection,
    });

    // Combine booked and locked seats
    const unavailableSeats = [...new Set([...bookedSeats, ...lockedSeatIds])];

    const seatLayoutWithAvailability = buildSeatLayoutResponse(
      bus.seatLayout,
      bookedSeats,
      lockedSeatIds,
    );

    // Get timing for the requested direction
    const timing = bus.getTimingForDirection(normalizedDirection);

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
        temporarilyLocked: lockedSeatIds.length,
        seatLayout: seatLayoutWithAvailability,
        direction: normalizedDirection,
        timing: {
          departureTime: formatTime(timing.departureTime),
          arrivalTime: formatTime(timing.arrivalTime),
        },
        route: bus.route
          ? {
              routeCode: bus.route.routeCode,
              origin:
                normalizedDirection === "forward"
                  ? bus.route.origin
                  : bus.route.destination,
              destination:
                normalizedDirection === "forward"
                  ? bus.route.destination
                  : bus.route.origin,
            }
          : null,
        travelDate,
        boardingPoint: boardingPoint || null,
        droppingPoint: droppingPoint || null,
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

    const bus = await Bus.findById(busId).lean();

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
    const routeInfo = buildRouteInfo(bus.route, direction);

    res.json({
      success: true,
      data: {
        ...bus,
        route: routeInfo,
        currentDirection: direction,
        timing: timing
          ? {
              departureTime: formatTime(timing.departureTime),
              arrivalTime: formatTime(timing.arrivalTime),
            }
          : null,
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

    const targetDate = new Date(travelDate);
    const bookedSeats =
      bus.bookedSeats
        ?.filter(
          (bs) =>
            bs.travelDate &&
            isSameDate(new Date(bs.travelDate), targetDate) &&
            bs.direction === direction,
        )
        .map((bs) => bs.seatNumber) || [];

    const now = new Date();
    const dayStart = new Date(travelDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const holdSeats = await SeatHold.find({
      bus: bus._id,
      direction,
      status: "HOLD",
      expiresAt: { $gt: now },
      travelDate: { $gte: dayStart, $lt: dayEnd },
    })
      .select("seatId")
      .lean();

    const lockedSeatIds = holdSeats.map((lock) => lock.seatId);
    const unavailableSeats = [...new Set([...bookedSeats, ...lockedSeatIds])];
    const allSeats = bus.getSeatIds();
    const availableSeats = allSeats.filter(
      (seat) => !unavailableSeats.includes(seat),
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
        $match: {
          isActive: true,
          isDeleted: false,
        },
      },
      {
        $project: {
          allStops: "$route.stops.city",
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

    const stops = await Bus.aggregate(pipeline);

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
