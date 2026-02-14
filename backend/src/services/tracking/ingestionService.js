import { Bus } from "../../models/bus.js";
import { BusLiveLocation } from "../../models/busLiveLocation.js";
import { BusLocationHistory } from "../../models/busLocationHistory.js";
import { TRACKING_CONFIG } from "../../config/trackingConfig.js";
import {
  getRedisCommandClient,
  getRedisPublisherClient,
  isRedisReady,
} from "../../config/redis.js";
import {
  TRACKING_CHANNEL,
  TRACKING_STREAM,
  buildMinuteBucket,
  getDuplicateKey,
  getRateKey,
} from "./keys.js";
import {
  normalizeBusNumber,
  normalizeDirection,
  normalizePointPayload,
  validatePointPayload,
} from "./validation.js";
import { writeLatestToRedis } from "./readService.js";

const toSafeInt = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const buildDateKey = (value) => {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveTripKey = ({ providedTripKey, travelDate, direction, bus }) => {
  const token = String(providedTripKey || "").trim();
  if (token) return token;

  const normalizedDirection = normalizeDirection(direction);
  if (!travelDate || !normalizedDirection || !bus?._id) return null;

  const dateKey = buildDateKey(travelDate);
  return `${bus._id}_${dateKey}_${normalizedDirection}`;
};

const ensureConductorOwnership = (bus, userId) =>
  Boolean(bus?.conductor && String(bus.conductor) === String(userId));

const logIngest = (payload) => {
  try {
    console.info("[TelemetryIngest]", JSON.stringify(payload));
  } catch (error) {
    console.info("[TelemetryIngest]", payload);
  }
};

const writeHistoryToStream = async (payload) => {
  if (!isRedisReady()) {
    await BusLocationHistory.create(payload);
    return;
  }

  const redis = getRedisCommandClient();
  if (!redis) {
    await BusLocationHistory.create(payload);
    return;
  }

  await redis.xAdd(TRACKING_STREAM, "*", {
    payload: JSON.stringify(payload),
  });
};

const publishLocation = async (payload) => {
  if (!isRedisReady()) return;
  const publisher = getRedisPublisherClient();
  if (!publisher) return;
  await publisher.publish(TRACKING_CHANNEL, JSON.stringify(payload));
};

const updateMongoLatest = async ({ bus, busNumber, conductorId, point }) => {
  const update = {
    bus: bus._id,
    busNumber,
    conductor: conductorId,
    location: { type: "Point", coordinates: [point.lng, point.lat] },
    accuracy: point.accuracy,
    speed: point.speed,
    heading: point.heading,
    recordedAt: point.recordedAt,
    lastSeenAt: new Date(),
  };

  await BusLiveLocation.findOneAndUpdate(
    { busNumber },
    { $set: update },
    { upsert: true, new: true },
  );
};

const checkRateLimit = async ({ busNumber, deviceId }) => {
  if (!isRedisReady()) return { allowed: true };
  const redis = getRedisCommandClient();
  if (!redis) return { allowed: true };

  const minuteBucket = buildMinuteBucket();
  const key = getRateKey(busNumber, deviceId, minuteBucket);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 120);
  }

  if (count > TRACKING_CONFIG.MAX_POINTS_PER_MIN) {
    return { allowed: false, reason: "RATE_LIMITED" };
  }
  return { allowed: true };
};

const markIdempotency = async ({ deviceId, seq }) => {
  if (!isRedisReady()) return { duplicate: false };
  const redis = getRedisCommandClient();
  if (!redis) return { duplicate: false };

  const key = getDuplicateKey(deviceId, seq);
  const response = await redis.set(key, "1", {
    NX: true,
    EX: TRACKING_CONFIG.DUPLICATE_TTL_SEC,
  });
  return { duplicate: response !== "OK" };
};

const validateRequestEnvelope = ({ deviceId, seq, points }) => {
  if (!deviceId || !String(deviceId).trim()) {
    return { valid: false, statusCode: 400, reason: "DEVICE_ID_REQUIRED" };
  }

  const parsedSeq = toSafeInt(seq);
  if (parsedSeq === null) {
    return { valid: false, statusCode: 400, reason: "SEQ_REQUIRED" };
  }

  if (!Array.isArray(points) || points.length === 0) {
    return { valid: false, statusCode: 400, reason: "POINTS_REQUIRED" };
  }

  if (points.length > TRACKING_CONFIG.MAX_BATCH_POINTS) {
    return {
      valid: false,
      statusCode: 400,
      reason: "BATCH_LIMIT_EXCEEDED",
    };
  }

  return { valid: true, parsedSeq };
};

export const ingestLocationBatch = async ({
  conductorUser,
  busNumber,
  deviceId,
  seq,
  points,
  tripKey,
  travelDate,
  direction,
  source = "https",
}) => {
  const normalizedBusNumber = normalizeBusNumber(busNumber);
  if (!normalizedBusNumber) {
    return {
      success: false,
      statusCode: 400,
      message: "BUS_NUMBER_REQUIRED",
      acceptedCount: 0,
      rejectedCount: 0,
      rejected: [],
    };
  }

  const envelopeCheck = validateRequestEnvelope({ deviceId, seq, points });
  if (!envelopeCheck.valid) {
    return {
      success: false,
      statusCode: envelopeCheck.statusCode,
      message: envelopeCheck.reason,
      acceptedCount: 0,
      rejectedCount: 0,
      rejected: [],
    };
  }

  const bus = await Bus.findOne({
    busNumber: normalizedBusNumber,
    isActive: true,
    isDeleted: false,
  }).select("_id busNumber conductor");

  if (!bus) {
    return {
      success: false,
      statusCode: 404,
      message: "BUS_NOT_FOUND",
      acceptedCount: 0,
      rejectedCount: 0,
      rejected: [],
    };
  }

  if (!ensureConductorOwnership(bus, conductorUser?.id || conductorUser?._id)) {
    return {
      success: false,
      statusCode: 403,
      message: "BUS_NOT_ASSIGNED_TO_YOU",
      acceptedCount: 0,
      rejectedCount: 0,
      rejected: [],
    };
  }

  const resolvedTripKey = resolveTripKey({
    providedTripKey: tripKey,
    travelDate,
    direction,
    bus,
  });

  const accepted = [];
  const rejected = [];
  let previousAcceptedPoint = null;
  let lastAcceptedSeq = null;
  let anyRateLimited = false;

  for (let index = 0; index < points.length; index += 1) {
    const rawPoint = points[index];
    const point = normalizePointPayload(rawPoint);
    const pointSeq = Number.isInteger(point.seq)
      ? point.seq
      : envelopeCheck.parsedSeq + index;

    const rate = await checkRateLimit({
      busNumber: normalizedBusNumber,
      deviceId,
    });
    if (!rate.allowed) {
      anyRateLimited = true;
      rejected.push({ seq: pointSeq, reason: rate.reason });
      continue;
    }

    const pointCheck = validatePointPayload({
      point,
      previousPoint: previousAcceptedPoint,
      now: new Date(),
    });
    if (!pointCheck.accepted) {
      rejected.push({ seq: pointSeq, reason: pointCheck.reason });
      continue;
    }

    const idempotency = await markIdempotency({ deviceId, seq: pointSeq });
    if (idempotency.duplicate) {
      rejected.push({ seq: pointSeq, reason: "DUPLICATE_SEQ" });
      continue;
    }

    const eventPayload = {
      busNumber: normalizedBusNumber,
      tripKey: resolvedTripKey,
      lat: point.lat,
      lng: point.lng,
      accuracy: point.accuracy ?? null,
      speed: point.speed ?? null,
      heading: point.heading ?? null,
      recordedAt: point.recordedAt.toISOString(),
      ingestedAt: new Date().toISOString(),
      confidence: pointCheck.confidence || "unknown",
      source,
      seq: pointSeq,
      deviceId,
    };

    const historyPayload = {
      bus: bus._id,
      busNumber: normalizedBusNumber,
      tripKey: resolvedTripKey,
      conductor: conductorUser.id || conductorUser._id,
      deviceId,
      seq: pointSeq,
      location: {
        type: "Point",
        coordinates: [point.lng, point.lat],
      },
      accuracy: point.accuracy ?? null,
      speed: point.speed ?? null,
      heading: point.heading ?? null,
      recordedAt: point.recordedAt,
      ingestedAt: new Date(),
      confidence: pointCheck.confidence || "unknown",
    };

    await updateMongoLatest({
      bus,
      busNumber: normalizedBusNumber,
      conductorId: conductorUser.id || conductorUser._id,
      point,
    });

    await writeLatestToRedis({
      busNumber: normalizedBusNumber,
      tripKey: resolvedTripKey,
      payload: eventPayload,
    });

    await publishLocation(eventPayload);
    await writeHistoryToStream(historyPayload);

    accepted.push(eventPayload);
    previousAcceptedPoint = {
      lat: point.lat,
      lng: point.lng,
      recordedAt: point.recordedAt,
    };
    lastAcceptedSeq = pointSeq;
  }

  logIngest({
    busNumber: normalizedBusNumber,
    source,
    deviceId,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    duplicateCount: rejected.filter((row) => row.reason === "DUPLICATE_SEQ").length,
    rateLimitedCount: rejected.filter((row) => row.reason === "RATE_LIMITED").length,
  });

  const duplicateOnly =
    accepted.length === 0 &&
    rejected.length > 0 &&
    rejected.every((row) => row.reason === "DUPLICATE_SEQ");

  return {
    success: true,
    statusCode: anyRateLimited && accepted.length === 0 ? 429 : 200,
    busNumber: normalizedBusNumber,
    tripKey: resolvedTripKey,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    rejected,
    duplicate: duplicateOnly,
    serverTs: new Date().toISOString(),
    lastAcceptedSeq,
  };
};
