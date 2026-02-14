import {
  TRACKING_STREAM,
  TRACKING_STREAM_GROUP,
} from "./keys.js";
import {
  getRedisCommandClient,
  isRedisReady,
} from "../../config/redis.js";
import { TRACKING_CONFIG } from "../../config/trackingConfig.js";
import { BusLocationHistory } from "../../models/busLocationHistory.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const state = {
  running: false,
  consumerName: `worker-${process.pid}`,
  startedAt: null,
  lastBatchAt: null,
  lastError: null,
  lastPersistedCount: 0,
  totalPersisted: 0,
  lastLagSeconds: null,
};

const parseStreamEntries = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { docs: [], ids: [] };
  }
  const docs = [];
  const ids = [];

  for (const stream of rows) {
    for (const message of stream.messages || []) {
      const rawPayload = message?.message?.payload;
      if (!rawPayload) continue;
      try {
        const parsed = JSON.parse(rawPayload);
        docs.push(parsed);
        ids.push(message.id);
      } catch (error) {
        console.error("[HistoryWorker] Invalid stream payload:", error);
      }
    }
  }
  return { docs, ids };
};

const ensureGroup = async () => {
  const redis = getRedisCommandClient();
  if (!redis) return;

  try {
    await redis.xGroupCreate(TRACKING_STREAM, TRACKING_STREAM_GROUP, "$", {
      MKSTREAM: true,
    });
    console.log("[HistoryWorker] Stream group created");
  } catch (error) {
    // BUSYGROUP means already exists.
    if (!String(error?.message || "").includes("BUSYGROUP")) {
      throw error;
    }
  }
};

const computeLagSeconds = (docs) => {
  if (!docs?.length) return null;
  const latest = docs.reduce((max, row) => {
    const ts = new Date(row?.recordedAt || 0).getTime();
    return Math.max(max, ts);
  }, 0);
  if (!latest) return null;
  return Math.max(0, Math.floor((Date.now() - latest) / 1000));
};

const runLoop = async () => {
  const redis = getRedisCommandClient();
  if (!redis) return;

  while (state.running) {
    try {
      const response = await redis.xReadGroup(
        TRACKING_STREAM_GROUP,
        state.consumerName,
        [{ key: TRACKING_STREAM, id: ">" }],
        {
          COUNT: TRACKING_CONFIG.STREAM_BATCH_SIZE,
          BLOCK: TRACKING_CONFIG.STREAM_BLOCK_MS,
        },
      );

      if (!response || response.length === 0) {
        continue;
      }

      const { docs, ids } = parseStreamEntries(response);
      if (!docs.length) {
        if (ids.length) {
          await redis.xAck(TRACKING_STREAM, TRACKING_STREAM_GROUP, ids);
        }
        continue;
      }

      await BusLocationHistory.insertMany(docs, { ordered: false });
      await redis.xAck(TRACKING_STREAM, TRACKING_STREAM_GROUP, ids);

      state.lastBatchAt = new Date().toISOString();
      state.lastPersistedCount = docs.length;
      state.totalPersisted += docs.length;
      state.lastLagSeconds = computeLagSeconds(docs);
      state.lastError = null;
    } catch (error) {
      state.lastError = error?.message || String(error);
      console.error("[HistoryWorker] loop error:", error);
      await wait(1000);
    }
  }
};

export const startTrackingHistoryWorker = async () => {
  if (state.running) return;
  if (!isRedisReady()) {
    console.warn("[HistoryWorker] Redis is not ready; worker not started");
    return;
  }

  await ensureGroup();
  state.running = true;
  state.startedAt = new Date().toISOString();
  state.lastError = null;

  runLoop().catch((error) => {
    state.lastError = error?.message || String(error);
    state.running = false;
    console.error("[HistoryWorker] fatal error:", error);
  });
};

export const getTrackingHistoryWorkerHealth = () => ({ ...state });
