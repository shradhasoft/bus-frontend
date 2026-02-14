const MAX_SEGMENT_DISTANCE = Number.MAX_SAFE_INTEGER;

export const normalizeSeatToken = (value) =>
  String(value || "").trim().toUpperCase();

export const normalizeDirection = (value) =>
  String(value || "forward").trim().toLowerCase() === "return"
    ? "return"
    : "forward";

export const normalizeCityToken = (value) =>
  String(value || "").trim().toLowerCase();

export const formatDateKey = (dateValue) => {
  const date = new Date(dateValue);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isSameDateByKey = (first, second) =>
  formatDateKey(first) === formatDateKey(second);

export const getStopDistanceValue = (stop, direction) => {
  const normalizedDirection = normalizeDirection(direction);
  const trip = normalizedDirection === "return" ? stop?.downTrip : stop?.upTrip;
  return typeof trip?.distanceFromOrigin === "number"
    ? trip.distanceFromOrigin
    : null;
};

export const normalizeSegmentBounds = (startValue, endValue) => {
  const first = Number(startValue);
  const second = Number(endValue);
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return null;
  }
  if (first === second) {
    return null;
  }
  return {
    segmentStartKm: Math.min(first, second),
    segmentEndKm: Math.max(first, second),
  };
};

export const segmentsOverlap = (firstStart, firstEnd, secondStart, secondEnd) => {
  const first = normalizeSegmentBounds(firstStart, firstEnd);
  const second = normalizeSegmentBounds(secondStart, secondEnd);
  if (!first || !second) return true;
  return first.segmentStartKm < second.segmentEndKm &&
    second.segmentStartKm < first.segmentEndKm;
};

export const resolveJourneySegment = ({
  route,
  direction = "forward",
  boardingPoint,
  droppingPoint,
}) => {
  if (!route || !Array.isArray(route.stops)) return null;
  const normalizedDirection = normalizeDirection(direction);
  const boardingToken = normalizeCityToken(boardingPoint);
  const droppingToken = normalizeCityToken(droppingPoint);
  if (!boardingToken || !droppingToken) return null;

  const boardingStop = route.stops.find(
    (stop) => normalizeCityToken(stop?.city) === boardingToken,
  );
  const droppingStop = route.stops.find(
    (stop) => normalizeCityToken(stop?.city) === droppingToken,
  );

  if (!boardingStop || !droppingStop) return null;

  const boardingDistance = getStopDistanceValue(boardingStop, normalizedDirection);
  const droppingDistance = getStopDistanceValue(droppingStop, normalizedDirection);

  const bounds = normalizeSegmentBounds(boardingDistance, droppingDistance);
  if (!bounds) return null;

  return {
    ...bounds,
    boardingDistance,
    droppingDistance,
  };
};

export const getRouteExtentSegment = (route, direction = "forward") => {
  if (!route || !Array.isArray(route.stops) || route.stops.length < 2) {
    return {
      segmentStartKm: 0,
      segmentEndKm: MAX_SEGMENT_DISTANCE,
    };
  }

  const normalizedDirection = normalizeDirection(direction);
  const distances = route.stops
    .map((stop) => getStopDistanceValue(stop, normalizedDirection))
    .filter((distance) => Number.isFinite(distance));

  if (distances.length < 2) {
    return {
      segmentStartKm: 0,
      segmentEndKm: MAX_SEGMENT_DISTANCE,
    };
  }

  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);
  return {
    segmentStartKm: minDistance,
    segmentEndKm: maxDistance,
  };
};

export const getSeatEntrySegment = ({
  seatEntry,
  route,
  direction = "forward",
  bookingSegment = null,
}) => {
  const directBounds = normalizeSegmentBounds(
    seatEntry?.segmentStartKm,
    seatEntry?.segmentEndKm,
  );
  if (directBounds) return directBounds;

  if (bookingSegment) {
    const bookingBounds = normalizeSegmentBounds(
      bookingSegment.segmentStartKm,
      bookingSegment.segmentEndKm,
    );
    if (bookingBounds) return bookingBounds;
  }

  return getRouteExtentSegment(route, direction);
};

