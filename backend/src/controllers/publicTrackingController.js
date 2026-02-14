import { Bus } from "../models/bus.js";
import { BusLocationHistory } from "../models/busLocationHistory.js";
import {
  getLatestBusLocation,
  getLatestTripLocation,
} from "../services/tracking/readService.js";
import { normalizeBusNumber } from "../services/tracking/validation.js";
import { getRedisStatus } from "../config/redis.js";
import { getTrackingHistoryWorkerHealth } from "../services/tracking/historyWorker.js";

const parseDateQuery = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const escapeRegex = (input) =>
  String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const searchTrackingBusesPublic = async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Query parameter 'q' is required",
      });
    }

    const regex = new RegExp(escapeRegex(query), "i");
    const buses = await Bus.find({
      isDeleted: false,
      isActive: true,
      $or: [{ busNumber: regex }, { busName: regex }, { operator: regex }],
    })
      .select(
        "busId busName busNumber operator features route.routeCode route.origin route.destination route.stops",
      )
      .sort({ busNumber: 1 })
      .limit(25)
      .lean();

    return res.json({
      success: true,
      count: buses.length,
      data: buses,
    });
  } catch (error) {
    console.error("searchTrackingBusesPublic error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const getBusLatestPublic = async (req, res) => {
  try {
    const busNumber = normalizeBusNumber(req.params.busNumber);
    if (!busNumber) {
      return res.status(400).json({
        success: false,
        message: "busNumber is required",
      });
    }

    const bus = await Bus.findOne({
      busNumber,
      isDeleted: false,
      isActive: true,
    })
      .select("busId busName busNumber operator route features")
      .lean();

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "BUS_NOT_FOUND",
      });
    }

    const latest = await getLatestBusLocation(busNumber);

    return res.json({
      success: true,
      data: {
        bus,
        liveLocation: latest,
      },
    });
  } catch (error) {
    console.error("getBusLatestPublic error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const getTripLatestPublic = async (req, res) => {
  try {
    const tripKey = String(req.params.tripKey || "").trim();
    if (!tripKey) {
      return res.status(400).json({
        success: false,
        message: "tripKey is required",
      });
    }

    const latest = await getLatestTripLocation(tripKey);
    return res.json({
      success: true,
      data: latest,
    });
  } catch (error) {
    console.error("getTripLatestPublic error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const getBusHistoryPublic = async (req, res) => {
  try {
    const busNumber = normalizeBusNumber(req.params.busNumber);
    const from = parseDateQuery(req.query.from);
    const to = parseDateQuery(req.query.to);
    const limitRaw = Number.parseInt(String(req.query.limit || "100"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;

    if (!busNumber) {
      return res.status(400).json({
        success: false,
        message: "busNumber is required",
      });
    }

    const query = { busNumber };
    if (from || to) {
      query.recordedAt = {};
      if (from) query.recordedAt.$gte = from;
      if (to) query.recordedAt.$lte = to;
    }

    const rows = await BusLocationHistory.find(query)
      .select(
        "busNumber tripKey location accuracy speed heading recordedAt ingestedAt confidence",
      )
      .sort({ recordedAt: -1 })
      .limit(limit)
      .lean();

    const points = rows.map((row) => ({
      busNumber: row.busNumber,
      tripKey: row.tripKey || null,
      lat: row.location?.coordinates?.[1] ?? null,
      lng: row.location?.coordinates?.[0] ?? null,
      accuracy: row.accuracy ?? null,
      speed: row.speed ?? null,
      heading: row.heading ?? null,
      recordedAt: row.recordedAt || null,
      ingestedAt: row.ingestedAt || null,
      confidence: row.confidence || "unknown",
    }));

    return res.json({
      success: true,
      count: points.length,
      data: points,
    });
  } catch (error) {
    console.error("getBusHistoryPublic error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const getTrackingHealth = async (_req, res) => {
  return res.json({
    success: true,
    data: {
      redis: getRedisStatus(),
      historyWorker: getTrackingHistoryWorkerHealth(),
      serverTime: new Date().toISOString(),
    },
  });
};

