export const TRACKING_CHANNEL = "rt:pub:location";
export const TRACKING_STREAM = "rt:stream:history";
export const TRACKING_STREAM_GROUP = "tracking-history-workers";

const normalize = (value) => String(value || "").trim().toUpperCase();

export const getBusLatestKey = (busNumber) =>
  `rt:bus:${normalize(busNumber)}:last`;

export const getTripLatestKey = (tripKey) =>
  `rt:trip:${String(tripKey || "").trim()}:last`;

export const getDuplicateKey = (deviceId, seq) =>
  `rt:dup:${String(deviceId || "").trim()}:${String(seq)}`;

export const getRateKey = (busNumber, deviceId, minuteBucket) =>
  `rt:rate:${normalize(busNumber)}:${String(deviceId || "").trim()}:${String(
    minuteBucket || "",
  ).trim()}`;

export const buildMinuteBucket = (date = new Date()) => {
  const iso = new Date(date).toISOString();
  return iso.slice(0, 16);
};

