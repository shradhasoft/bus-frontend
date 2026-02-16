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

  return {
    departureTime,
    arrivalTime,
  };
};

const calculateDepartureDateTime = (booking) => {
  const travelDate = new Date(booking.travelDate);
  if (Number.isNaN(travelDate.getTime())) return null;

  const journey = getJourneySnapshot(booking);
  const departureMinutes = toMinutes(journey.departureTime);

  if (departureMinutes === null) {
    return new Date(travelDate);
  }

  const departureDate = new Date(travelDate);
  departureDate.setHours(
    Math.floor(departureMinutes / 60),
    departureMinutes % 60,
    0,
    0,
  );
  return departureDate;
};

const calculateArrivalDateTime = (booking) => {
  const travelDate = new Date(booking.travelDate);
  if (Number.isNaN(travelDate.getTime())) return null;

  const journey = getJourneySnapshot(booking);
  const arrivalMinutes = toMinutes(journey.arrivalTime);

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

  const departureMinutes = toMinutes(journey.departureTime);
  if (departureMinutes !== null && arrivalMinutes < departureMinutes) {
    arrivalDate.setDate(arrivalDate.getDate() + 1);
  }

  return arrivalDate;
};

const getBookingLifecycleBucket = (booking, now = new Date()) => {
  const status = booking?.bookingStatus;
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";

  // Revert: Use ARRIVAL time for "Completed" check
  const arrivalTime = calculateArrivalDateTime(booking);

  if (!arrivalTime) return "upcoming";

  return arrivalTime < now ? "completed" : "upcoming";
};

const isBookingRunning = (booking, now = new Date()) => {
  const departureTime = calculateDepartureDateTime(booking);
  const arrivalTime = calculateArrivalDateTime(booking);

  if (!departureTime || !arrivalTime) return false;

  // Running if: Departed AND Not Arrived
  return now >= departureTime && now < arrivalTime;
};

// --- TEST CASES ---

const nowSim = new Date("2026-02-16T10:00:00Z");

const mockRoute = {
  stops: [
    { city: "A", upTrip: { departureTime: { hours: 9, minutes: 0 } } }, // 9 AM
    { city: "B", upTrip: { arrivalTime: { hours: 11, minutes: 0 } } }, // 11 AM
  ],
};

const testBookings = [
  {
    id: "Today Upcoming (Future Time)",
    bookingStatus: "confirmed",
    travelDate: "2026-02-16T00:00:00Z", // Today
    boardingPoint: "A",
    droppingPoint: "B",
    route: {
      stops: [
        {
          city: "A",
          upTrip: {
            departureTime: { hours: 11, minutes: 0 },
            arrivalTime: { hours: 13, minutes: 0 },
          },
        },
      ],
    }, // 11 AM - 1 PM
  },
  {
    id: "Today Running (Departed, Not Arrived)",
    bookingStatus: "confirmed",
    travelDate: "2026-02-16T00:00:00Z",
    boardingPoint: "A", // 9 AM
    droppingPoint: "B", // 11 AM. Now 10 AM.
    route: mockRoute, // 9-11
  },
  {
    id: "Today Completed (Passed Arrival)",
    bookingStatus: "confirmed",
    travelDate: "2026-02-16T00:00:00Z",
    boardingPoint: "A",
    droppingPoint: "B",
    route: {
      stops: [
        { city: "A", upTrip: { departureTime: { hours: 7, minutes: 0 } } },
        { city: "B", upTrip: { arrivalTime: { hours: 9, minutes: 0 } } }, // 9 AM
      ],
    },
  },
];

testBookings.forEach((booking) => {
  console.log(`Booking: ${booking.id}`);
  const departure = calculateDepartureDateTime(booking);
  const arrival = calculateArrivalDateTime(booking);
  console.log(
    `  Dep: ${departure?.toISOString()} Arr: ${arrival?.toISOString()} Now: ${nowSim.toISOString()}`,
  );

  const bucket = getBookingLifecycleBucket(booking, nowSim);
  const running = isBookingRunning(booking, nowSim);
  console.log(`  Bucket: ${bucket}, Running: ${running}`);
});
