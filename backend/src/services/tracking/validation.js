import { TRACKING_CONFIG } from "../../config/trackingConfig.js";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeBusNumber = (busNumber) =>
  String(busNumber || "")
    .trim()
    .toUpperCase();

export const normalizeDirection = (direction) => {
  const token = String(direction || "")
    .trim()
    .toLowerCase();
  if (token === "forward" || token === "return") return token;
  return null;
};

export const isValidLatLng = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

export const parsePointTimestamp = (input) => {
  if (input === null || input === undefined || input === "") return new Date();

  if (typeof input === "number") {
    // Heuristic: <= 10 digits => seconds.
    const millis = input < 1e12 ? input * 1000 : input;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const numeric = Number(input);
  if (Number.isFinite(numeric)) {
    const millis = numeric < 1e12 ? numeric * 1000 : numeric;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const date = new Date(input);
  if (!Number.isNaN(date.getTime())) return date;
  return null;
};

export const validateTimestampWindow = (date, now = new Date()) => {
  const deltaMs = date.getTime() - now.getTime();
  const maxFutureMs = TRACKING_CONFIG.MAX_FUTURE_SKEW_SEC * 1000;
  const maxPastMs = TRACKING_CONFIG.MAX_PAST_SKEW_SEC * 1000;

  if (deltaMs > maxFutureMs) {
    return { valid: false, reason: "TIMESTAMP_TOO_FAR_IN_FUTURE" };
  }

  if (deltaMs < -maxPastMs) {
    return { valid: false, reason: "TIMESTAMP_TOO_OLD" };
  }

  return { valid: true };
};

const toRadians = (value) => (value * Math.PI) / 180;

export const haversineMeters = (a, b) => {
  if (!a || !b) return null;
  if (!isValidLatLng(a.lat, a.lng) || !isValidLatLng(b.lat, b.lng)) return null;

  const earthRadius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return earthRadius * c;
};

export const inferSpeedKmph = (previousPoint, currentPoint) => {
  if (!previousPoint || !currentPoint) return null;
  const distanceMeters = haversineMeters(previousPoint, currentPoint);
  if (!Number.isFinite(distanceMeters)) return null;

  const deltaMs =
    new Date(currentPoint.recordedAt).getTime() -
    new Date(previousPoint.recordedAt).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return null;

  const mps = distanceMeters / (deltaMs / 1000);
  return mps * 3.6;
};

export const speedMpsToKmph = (speedMps) => {
  if (!Number.isFinite(speedMps)) return null;
  return speedMps * 3.6;
};

export const confidenceFromAccuracy = (accuracyMeters) => {
  if (!Number.isFinite(accuracyMeters)) return "unknown";
  if (accuracyMeters > TRACKING_CONFIG.LOW_CONFIDENCE_ACC_M) return "low";
  return "high";
};

export const normalizePointPayload = (rawPoint) => {
  const lat = toNumber(rawPoint?.lat);
  const lng = toNumber(rawPoint?.lng);
  const accuracy = toNumber(
    rawPoint?.accuracy !== undefined ? rawPoint.accuracy : rawPoint?.acc,
  );
  const speed = toNumber(rawPoint?.speed !== undefined ? rawPoint.speed : rawPoint?.spd);
  const heading = toNumber(
    rawPoint?.heading !== undefined ? rawPoint.heading : rawPoint?.hdg,
  );
  const recordedAt = parsePointTimestamp(
    rawPoint?.recordedAt !== undefined ? rawPoint.recordedAt : rawPoint?.ts,
  );
  const seq = toNumber(rawPoint?.seq);

  return {
    lat,
    lng,
    accuracy,
    speed,
    heading,
    recordedAt,
    seq: Number.isInteger(seq) ? seq : null,
  };
};

export const validatePointPayload = ({ point, previousPoint, now = new Date() }) => {
  if (!isValidLatLng(point.lat, point.lng)) {
    return { accepted: false, reason: "INVALID_LAT_LNG" };
  }

  if (!(point.recordedAt instanceof Date) || Number.isNaN(point.recordedAt.getTime())) {
    return { accepted: false, reason: "INVALID_TIMESTAMP" };
  }

  const timestampCheck = validateTimestampWindow(point.recordedAt, now);
  if (!timestampCheck.valid) {
    return { accepted: false, reason: timestampCheck.reason };
  }

  const speedFromDeviceKmph = speedMpsToKmph(point.speed);
  if (
    Number.isFinite(speedFromDeviceKmph) &&
    speedFromDeviceKmph > TRACKING_CONFIG.MAX_SPEED_KMPH
  ) {
    return { accepted: false, reason: "IMPOSSIBLE_SPEED_DEVICE" };
  }

  const inferredSpeedKmph = inferSpeedKmph(previousPoint, point);
  if (
    Number.isFinite(inferredSpeedKmph) &&
    inferredSpeedKmph > TRACKING_CONFIG.MAX_SPEED_KMPH
  ) {
    return { accepted: false, reason: "IMPOSSIBLE_SPEED_JUMP" };
  }

  return {
    accepted: true,
    confidence: confidenceFromAccuracy(point.accuracy),
    inferredSpeedKmph: Number.isFinite(inferredSpeedKmph)
      ? Number(inferredSpeedKmph.toFixed(2))
      : null,
  };
};

