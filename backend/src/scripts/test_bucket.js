const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MINUTES_IN_DAY = 24 * 60;

const toMinutes = (timeObj) =>
  typeof timeObj?.hours === "number" && typeof timeObj?.minutes === "number"
    ? timeObj.hours * 60 + timeObj.minutes
    : null;

const computeDurationMinutes = (startMinutes, endMinutes) => {
  if (startMinutes === null || endMinutes === null) return null;
  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += MINUTES_IN_DAY;
  return diff;
};

const normalizeCityToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const findRouteStopByCity = (route, city) => {
  if (!route || !Array.isArray(route.stops)) return null;
  const token = normalizeCityToken(city);
  if (!token) return null;
  return route.stops.find((stop) => normalizeCityToken(stop?.city) === token);
};

const getTripByDirection = (stop, direction) =>
  direction === "return" ? stop?.downTrip : stop?.upTrip;

const getJourneySnapshot = (booking) => {
  const route = booking?.route;
  const direction = booking?.direction || "forward";
  const boardingStop = findRouteStopByCity(route, booking?.boardingPoint);
  const droppingStop = findRouteStopByCity(route, booking?.droppingPoint);

  const boardingTrip = getTripByDirection(boardingStop, direction);
  const droppingTrip = getTripByDirection(droppingStop, direction);

  const departureTime =
    boardingTrip?.departureTime || boardingTrip?.arrivalTime || null;
  const arrivalTime =
    droppingTrip?.arrivalTime || droppingTrip?.departureTime || null;

  const departureMinutes = toMinutes(departureTime);
  const arrivalMinutes = toMinutes(arrivalTime);
  const segmentDurationMinutes = computeDurationMinutes(
    departureMinutes,
    arrivalMinutes,
  );

  return {
    direction,
    origin: booking?.boardingPoint || route?.origin || null,
    destination: booking?.droppingPoint || route?.destination || null,
    departureTime,
    arrivalTime,
    segmentDurationMinutes,
  };
};

const calculateArrivalDateTime = (booking) => {
  const travelDate = new Date(booking.travelDate);
  if (Number.isNaN(travelDate.getTime())) return null;

  const journey = getJourneySnapshot(booking);
  const arrivalMinutes = toMinutes(journey.arrivalTime);

  // If arrival time is missing, fallback to end of travel date
  if (arrivalMinutes === null) {
    const fallback = new Date(travelDate);
    fallback.setHours(23, 59, 59, 999);
    return fallback;
  }

  const arrivalDate = new Date(travelDate);
  arrivalDate.setHours(
    Math.floor(arrivalMinutes / 60),
    arrivalMinutes % 60,
    0,
    0,
  );

  // Handle next-day arrival if arrival time is before departure (simplified check)
  // detailed check would need departure time comparison
  const departureMinutes = toMinutes(journey.departureTime);
  if (departureMinutes !== null && arrivalMinutes < departureMinutes) {
    arrivalDate.setDate(arrivalDate.getDate() + 1);
  }

  return arrivalDate;
};

const getBookingLifecycleBucket = (booking, now = new Date()) => {
  const status = booking?.bookingStatus;
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed"; // Explicitly marked completed

  const arrivalTime = calculateArrivalDateTime(booking);
  if (!arrivalTime) return "upcoming";

  return arrivalTime < now ? "completed" : "upcoming";
};

// --- TEST CASES ---

const now = new Date("2026-02-16T10:00:00Z"); // Mock Current Time: 10 AM UTC

const mockRoute = {
  stops: [
    {
      city: "A",
      upTrip: { departureTime: { hours: 9, minutes: 0 } }, // 9 AM
    },
    {
      city: "B",
      upTrip: { arrivalTime: { hours: 11, minutes: 0 } }, // 11 AM
    },
    {
      city: "C",
      upTrip: { arrivalTime: { hours: 8, minutes: 0 } }, // 8 AM (Next Day?)
    },
  ],
};

const testBookings = [
  {
    id: "Future Booking",
    bookingStatus: "confirmed",
    travelDate: "2026-02-17T00:00:00Z", // Tomorrow
    boardingPoint: "A",
    droppingPoint: "B",
    route: mockRoute,
  },
  {
    id: "Today Upcoming",
    bookingStatus: "confirmed",
    travelDate: "2026-02-16T00:00:00Z", // Today
    boardingPoint: "A", // Depart 9 AM
    droppingPoint: "B", // Arrive 11 AM. Now is 10 AM. Still arriving.
    route: mockRoute,
  },
  {
    id: "Today Completed (Arrived)",
    bookingStatus: "confirmed",
    travelDate: "2026-02-16T00:00:00Z", // Today
    boardingPoint: "A", // Depart 9 AM
    droppingPoint: "A", // Using same point just to test time. Depart 9 AM.
    // Wait, getJourneySnapshot uses droppingTrip arrivalTime.
    // Let's make a stop D that arrived at 9:30 AM.
    route: {
      stops: [
        { city: "D", upTrip: { departureTime: { hours: 8, minutes: 0 } } },
        { city: "E", upTrip: { arrivalTime: { hours: 9, minutes: 30 } } },
      ],
    },
    boardingPoint: "D",
    droppingPoint: "E",
  },
  {
    id: "Today Departed but Not Arrived",
    bookingStatus: "confirmed",
    travelDate: "2026-02-16T00:00:00Z",
    boardingPoint: "A", // 9 AM
    droppingPoint: "B", // 11 AM. Now 10 AM.
    route: mockRoute,
  },
];

testBookings.forEach((booking) => {
  console.log(`Booking: ${booking.id}`);
  const bucket = getBookingLifecycleBucket(booking, now);
  console.log(`  Expected: ?, Actual: ${bucket}`);
  const arrival = calculateArrivalDateTime(booking);
  console.log(
    `  Arrival: ${arrival?.toISOString()} vs Now: ${now.toISOString()}`,
  );
});
