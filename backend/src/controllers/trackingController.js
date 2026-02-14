import { Bus } from "../models/bus.js";
import { BusLiveLocation } from "../models/busLiveLocation.js";
import { getLatestBusLocation as getLatestBusLocationFromStore } from "../services/tracking/readService.js";

// Search bus by busName or busNumber (normal user)
export const searchBusForTracking = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Query parameter 'q' is required",
        code: "MISSING_QUERY",
      });
    }

    const regex = new RegExp(q, "i");

    const buses = await Bus.find({
      isDeleted: false,
      isActive: true,
      $or: [{ busName: regex }, { busNumber: regex }],
    })
      .select("busName busNumber busId operator features route conductor")
      .lean();

    return res.json({
      success: true,
      count: buses.length,
      data: buses,
    });
  } catch (error) {
    console.error("searchBusForTracking error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

// Get latest live location by busNumber
export const getLatestBusLocation = async (req, res) => {
  try {
    const busNumber = String(req.params.busNumber || "")
      .trim()
      .toUpperCase();
    if (!busNumber) {
      return res.status(400).json({
        success: false,
        message: "busNumber is required",
        code: "MISSING_BUS_NUMBER",
      });
    }

    const bus = await Bus.findOne({
      busNumber,
      isDeleted: false,
      isActive: true,
    })
      .select(
        "busName busNumber busId operator features route conductor totalSeats",
      )
      .lean();

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
        code: "BUS_NOT_FOUND",
      });
    }

    const liveFromRedis = await getLatestBusLocationFromStore(busNumber);
    if (liveFromRedis) {
      return res.json({
        success: true,
        data: {
          bus,
          liveLocation: {
            lat: liveFromRedis.lat,
            lng: liveFromRedis.lng,
            accuracy: liveFromRedis.accuracy,
            speed: liveFromRedis.speed,
            heading: liveFromRedis.heading,
            recordedAt: liveFromRedis.recordedAt,
            updatedAt: liveFromRedis.ingestedAt || liveFromRedis.recordedAt,
            confidence: liveFromRedis.confidence,
            ageSeconds: liveFromRedis.ageSeconds,
            isStale: liveFromRedis.isStale,
            tripKey: liveFromRedis.tripKey || null,
            source: liveFromRedis.source || null,
          },
        },
      });
    }

    const live = await BusLiveLocation.findOne({ busNumber })
      .select("location accuracy speed heading recordedAt updatedAt")
      .lean();

    return res.json({
      success: true,
      data: {
        bus,
        liveLocation: live
          ? {
              lat: live.location.coordinates[1],
              lng: live.location.coordinates[0],
              accuracy: live.accuracy,
              speed: live.speed,
              heading: live.heading,
              recordedAt: live.recordedAt,
              updatedAt: live.updatedAt,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("getLatestBusLocation error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};
