import { TRACKING_CONFIG } from "../../config/trackingConfig.js";
import {
  getBusLatestKey,
  getTripLatestKey,
} from "./keys.js";
import {
  getRedisCommandClient,
  isRedisReady,
} from "../../config/redis.js";
import { BusLiveLocation } from "../../models/busLiveLocation.js";
import { BusLocationHistory } from "../../models/busLocationHistory.js";
import { normalizeBusNumber } from "./validation.js";

const parseRedisPayload = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const toDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const addFreshness = (payload) => {
  if (!payload) return null;
  const recordedAt = toDate(payload.recordedAt);
  if (!recordedAt) return { ...payload, ageSeconds: null, isStale: true };
  const ageSeconds = Math.max(
    0,
    Math.floor((Date.now() - recordedAt.getTime()) / 1000),
  );
  return {
    ...payload,
    ageSeconds,
    isStale: ageSeconds > TRACKING_CONFIG.STALE_AFTER_SEC,
  };
};

export const getLatestBusFromRedis = async (busNumber) => {
  if (!isRedisReady()) return null;
  const client = getRedisCommandClient();
  if (!client) return null;
  const key = getBusLatestKey(busNumber);
  const raw = await client.get(key);
  return parseRedisPayload(raw);
};

export const getLatestTripFromRedis = async (tripKey) => {
  if (!isRedisReady()) return null;
  const client = getRedisCommandClient();
  if (!client) return null;
  const key = getTripLatestKey(tripKey);
  const raw = await client.get(key);
  return parseRedisPayload(raw);
};

export const writeLatestToRedis = async ({ busNumber, tripKey, payload }) => {
  if (!isRedisReady()) return;
  const client = getRedisCommandClient();
  if (!client) return;
  const serialized = JSON.stringify(payload);

  const ops = [
    client.set(getBusLatestKey(busNumber), serialized, {
      EX: TRACKING_CONFIG.LATEST_TTL_SEC,
    }),
  ];

  if (tripKey) {
    ops.push(
      client.set(getTripLatestKey(tripKey), serialized, {
        EX: TRACKING_CONFIG.LATEST_TTL_SEC,
      }),
    );
  }

  await Promise.all(ops);
};

export const getLatestBusFromMongo = async (busNumber) => {
  const normalized = normalizeBusNumber(busNumber);
  const live = await BusLiveLocation.findOne({ busNumber: normalized }).lean();
  if (!live?.location?.coordinates?.length) return null;

  return {
    busNumber: normalized,
    tripKey: null,
    lat: live.location.coordinates[1],
    lng: live.location.coordinates[0],
    accuracy: live.accuracy ?? null,
    speed: live.speed ?? null,
    heading: live.heading ?? null,
    recordedAt: live.recordedAt || live.updatedAt || null,
    ingestedAt: live.updatedAt || null,
    confidence: "unknown",
    source: "mongo-fallback",
  };
};

export const getLatestTripFromMongo = async (tripKey) => {
  if (!tripKey) return null;
  const latest = await BusLocationHistory.findOne({ tripKey })
    .sort({ recordedAt: -1 })
    .lean();
  if (!latest?.location?.coordinates?.length) return null;

  return {
    busNumber: latest.busNumber,
    tripKey: latest.tripKey || null,
    lat: latest.location.coordinates[1],
    lng: latest.location.coordinates[0],
    accuracy: latest.accuracy ?? null,
    speed: latest.speed ?? null,
    heading: latest.heading ?? null,
    recordedAt: latest.recordedAt || null,
    ingestedAt: latest.ingestedAt || latest.createdAt || null,
    confidence: latest.confidence || "unknown",
    source: "mongo-history-fallback",
  };
};

export const getLatestBusLocation = async (busNumber) => {
  const redisHit = await getLatestBusFromRedis(busNumber);
  if (redisHit) return addFreshness({ ...redisHit, source: "redis" });

  const mongoHit = await getLatestBusFromMongo(busNumber);
  return addFreshness(mongoHit);
};

export const getLatestTripLocation = async (tripKey) => {
  const redisHit = await getLatestTripFromRedis(tripKey);
  if (redisHit) return addFreshness({ ...redisHit, source: "redis" });

  const mongoHit = await getLatestTripFromMongo(tripKey);
  return addFreshness(mongoHit);
};

