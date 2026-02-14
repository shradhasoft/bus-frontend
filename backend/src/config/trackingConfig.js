const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const TRACKING_CONFIG = {
  MAX_BATCH_POINTS: toInt(process.env.TRACKING_MAX_BATCH_POINTS, 20),
  MAX_POINTS_PER_MIN: toInt(process.env.TRACKING_MAX_POINTS_PER_MIN, 120),
  MAX_FUTURE_SKEW_SEC: toInt(process.env.TRACKING_MAX_FUTURE_SKEW_SEC, 120),
  MAX_PAST_SKEW_SEC: toInt(process.env.TRACKING_MAX_PAST_SKEW_SEC, 600),
  MAX_SPEED_KMPH: toInt(process.env.TRACKING_MAX_SPEED_KMPH, 150),
  LOW_CONFIDENCE_ACC_M: toInt(process.env.TRACKING_LOW_CONFIDENCE_ACC_M, 100),
  HISTORY_TTL_DAYS: toInt(process.env.TRACKING_HISTORY_TTL_DAYS, 7),
  STALE_AFTER_SEC: toInt(process.env.TRACKING_STALE_AFTER_SEC, 120),
  LATEST_TTL_SEC: toInt(process.env.TRACKING_LATEST_TTL_SEC, 60 * 30),
  DUPLICATE_TTL_SEC: toInt(process.env.TRACKING_DUPLICATE_TTL_SEC, 60 * 60 * 24),
  STREAM_BLOCK_MS: toInt(process.env.TRACKING_STREAM_BLOCK_MS, 2500),
  STREAM_BATCH_SIZE: toInt(process.env.TRACKING_STREAM_BATCH_SIZE, 100),
};

