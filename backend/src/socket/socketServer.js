// src/socket/socketServer.js
import { Server } from "socket.io";
import { Bus } from "../models/bus.js";
import { User } from "../models/user.js";

// Firebase Admin Auth (same import style you used in authMiddleware)
import { auth as firebaseAdminAuth } from "../utils/firebase-admin.js";

// cookie parser (tiny)
import cookie from "cookie";
import { ingestLocationBatch } from "../services/tracking/ingestionService.js";
import {
  getLatestBusLocation,
  getLatestTripLocation,
} from "../services/tracking/readService.js";
import {
  getRedisSubscriberClient,
  isRedisReady,
} from "../config/redis.js";
import { TRACKING_CHANNEL } from "../services/tracking/keys.js";

const normalizeBusNumber = (busNumber) =>
  String(busNumber || "")
    .trim()
    .toUpperCase();

const normalizeBusName = (busName) =>
  String(busName || "")
    .trim()
    .toLowerCase();

const getTokenFromSocket = (socket) => {
  // 1) From socket auth: io(..., { auth: { token } })
  const authToken = socket.handshake?.auth?.token;
  if (authToken) return { token: authToken, source: "header" };

  // 2) From cookies (if browser sends cookies)
  const rawCookie = socket.handshake?.headers?.cookie;
  if (!rawCookie) return { token: null, source: "cookie" };

  const parsed = cookie.parse(rawCookie);
  return { token: parsed?.token || null, source: "cookie" }; // change cookie name if yours differs
};

const emitTrackingPayload = (privateNamespace, trackingNamespace, payload) => {
  if (!payload?.busNumber) return;

  privateNamespace.to(`bus:${payload.busNumber}`).emit("tracking.location", payload);
  privateNamespace.to(`bus:${payload.busNumber}`).emit("bus:location", {
    busNumber: payload.busNumber,
    lat: payload.lat,
    lng: payload.lng,
    accuracy: payload.accuracy ?? null,
    speed: payload.speed ?? null,
    heading: payload.heading ?? null,
    recordedAt: payload.recordedAt,
    tripKey: payload.tripKey ?? null,
    confidence: payload.confidence ?? "unknown",
    source: payload.source ?? null,
  });

  trackingNamespace.to(`bus:${payload.busNumber}`).emit("tracking.location", payload);

  if (payload.tripKey) {
    privateNamespace.to(`trip:${payload.tripKey}`).emit("tracking.location", payload);
    trackingNamespace.to(`trip:${payload.tripKey}`).emit("tracking.location", payload);
  }
};

const subscribeToTrackingPubSub = async (privateNamespace, trackingNamespace) => {
  if (!isRedisReady()) {
    console.warn("[Socket] Redis is not ready; pub/sub fanout disabled");
    return;
  }

  const subscriber = getRedisSubscriberClient();
  if (!subscriber) {
    console.warn("[Socket] Missing Redis subscriber; pub/sub fanout disabled");
    return;
  }

  try {
    await subscriber.subscribe(TRACKING_CHANNEL, (message) => {
      try {
        const payload = JSON.parse(message);
        emitTrackingPayload(privateNamespace, trackingNamespace, payload);
      } catch (error) {
        console.error("[Socket] Invalid pub/sub payload", error);
      }
    });
    console.log(`[Socket] Subscribed to ${TRACKING_CHANNEL}`);
  } catch (error) {
    console.error("[Socket] Failed to subscribe tracking channel:", error);
  }
};

export const initSocketServer = (httpServer, socketOptions = {}) => {
  const allowedOrigins = Array.isArray(socketOptions.allowedOrigins)
    ? socketOptions.allowedOrigins
    : [];
  const isAllowedOrigin =
    typeof socketOptions.isAllowedOrigin === "function"
      ? socketOptions.isAllowedOrigin
      : (origin) => allowedOrigins.includes(origin);
  const socketPath =
    typeof socketOptions.socketPath === "string" &&
    String(socketOptions.socketPath).trim()
      ? String(socketOptions.socketPath).trim()
      : "/socket.io";
  const pingInterval = Number.isFinite(socketOptions.pingInterval)
    ? socketOptions.pingInterval
    : undefined;
  const pingTimeout = Number.isFinite(socketOptions.pingTimeout)
    ? socketOptions.pingTimeout
    : undefined;

  const io = new Server(httpServer, {
    path: socketPath,
    pingInterval,
    pingTimeout,
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (isAllowedOrigin(origin)) return cb(null, true);
        return cb(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  const privateNamespace = io.of("/");
  const trackingNamespace = io.of("/tracking");

  // Firebase Auth middleware for private namespace only.
  privateNamespace.use(async (socket, next) => {
    try {
      const { token, source } = getTokenFromSocket(socket);
      if (!token) return next(new Error("UNAUTHENTICATED"));

      const checkRevoked = process.env.FIREBASE_CHECK_REVOKED === "true";
      const decodedToken =
        source === "cookie"
          ? await firebaseAdminAuth.verifySessionCookie(token, checkRevoked)
          : await firebaseAdminAuth.verifyIdToken(token, checkRevoked);
      const firebaseUID = decodedToken.uid;

      const dbUser = await User.findOne({ firebaseUID }).select(
        "-__v -createdAt -updatedAt",
      );

      if (!dbUser) return next(new Error("USER_NOT_FOUND"));
      if (dbUser.isActive === false) return next(new Error("ACCOUNT_DEACTIVATED"));
      if (dbUser.isBlocked === true) return next(new Error("ACCOUNT_BLOCKED"));

      socket.user = {
        id: dbUser._id,
        role: dbUser.role,
        firebaseUID,
      };

      return next();
    } catch {
      return next(new Error("UNAUTHENTICATED"));
    }
  });

  privateNamespace.on("connection", (socket) => {
    // USER subscribes to bus room. Supports busNumber OR busName.
    socket.on("user:subscribe", async ({ busNumber, busName }, ack) => {
      try {
        let bn = normalizeBusNumber(busNumber);

        if (!bn && busName) {
          const name = normalizeBusName(busName);

          const bus = await Bus.findOne({
            busName: { $regex: new RegExp(`^${name}$`, "i") },
            isDeleted: false,
            isActive: true,
          }).select("busNumber");

          if (!bus) throw new Error("BUS_NOT_FOUND");
          bn = normalizeBusNumber(bus.busNumber);
        }

        if (!bn) throw new Error("BUS_NUMBER_REQUIRED");

        socket.join(`bus:${bn}`);

        const latest = await getLatestBusLocation(bn);
        if (latest) {
          socket.emit("tracking.location", latest);
          socket.emit("bus:location", {
            busNumber: latest.busNumber,
            lat: latest.lat,
            lng: latest.lng,
            accuracy: latest.accuracy ?? null,
            speed: latest.speed ?? null,
            heading: latest.heading ?? null,
            recordedAt: latest.recordedAt,
            tripKey: latest.tripKey ?? null,
            confidence: latest.confidence ?? "unknown",
            source: latest.source ?? null,
          });
        }

        ack?.({ success: true, busNumber: bn });
      } catch (error) {
        ack?.({ success: false, message: error?.message || "SUBSCRIBE_FAILED" });
      }
    });

    socket.on("user:unsubscribe", ({ busNumber }, ack) => {
      const bn = normalizeBusNumber(busNumber);
      if (bn) socket.leave(`bus:${bn}`);
      ack?.({ success: true });
    });

    // CONDUCTOR starts tracking a bus (optional)
    socket.on("conductor:start", async ({ busNumber }, ack) => {
      try {
        if (socket.user.role !== "conductor") {
          return ack?.({ success: false, message: "FORBIDDEN" });
        }

        const bn = normalizeBusNumber(busNumber);
        if (!bn) throw new Error("BUS_NUMBER_REQUIRED");

        const bus = await Bus.findOne({
          busNumber: bn,
          isDeleted: false,
          isActive: true,
        }).select("_id busNumber conductor");

        if (!bus) return ack?.({ success: false, message: "BUS_NOT_FOUND" });

        if (!bus.conductor || String(bus.conductor) !== String(socket.user.id)) {
          return ack?.({ success: false, message: "BUS_NOT_ASSIGNED_TO_YOU" });
        }

        socket.data.busNumber = bn;
        socket.data.busId = bus._id;

        ack?.({ success: true });
      } catch (error) {
        ack?.({ success: false, message: error?.message || "FAILED" });
      }
    });

    // Legacy conductor uplink kept for compatibility.
    socket.on("conductor:location", async (payload, ack) => {
      try {
        if (socket.user.role !== "conductor") {
          return ack?.({ success: false, message: "FORBIDDEN" });
        }

        console.warn(
          "[Socket] Deprecated 'conductor:location' event received; prefer POST /v1/telemetry/location",
        );

        const bn = normalizeBusNumber(payload?.busNumber || socket.data.busNumber);
        const point = {
          lat: payload?.lat,
          lng: payload?.lng,
          accuracy: payload?.accuracy,
          speed: payload?.speed,
          heading: payload?.heading,
          recordedAt: payload?.recordedAt || new Date().toISOString(),
          seq: payload?.seq,
        };

        const result = await ingestLocationBatch({
          conductorUser: socket.user,
          busNumber: bn,
          tripKey: payload?.tripKey,
          travelDate: payload?.travelDate,
          direction: payload?.direction,
          deviceId: payload?.deviceId || `legacy-socket-${socket.user.id}`,
          seq: payload?.seq ?? Date.now(),
          points: [point],
          source: "socket-legacy",
        });

        ack?.({
          success: result.success && result.acceptedCount > 0,
          message: result.message || null,
          acceptedCount: result.acceptedCount,
          rejectedCount: result.rejectedCount,
          rejected: result.rejected,
          duplicate: result.duplicate,
        });
      } catch (error) {
        ack?.({ success: false, message: error?.message || "FAILED" });
      }
    });
  });

  // Public viewer namespace
  trackingNamespace.on("connection", (socket) => {
    socket.on("tracking:subscribe", async ({ busNumber, tripKey }, ack) => {
      try {
        const normalizedBus = normalizeBusNumber(busNumber);
        const normalizedTrip = String(tripKey || "").trim();
        if (!normalizedBus && !normalizedTrip) {
          throw new Error("BUS_OR_TRIP_REQUIRED");
        }

        if (normalizedBus) {
          socket.join(`bus:${normalizedBus}`);
          const latest = await getLatestBusLocation(normalizedBus);
          if (latest) {
            socket.emit("tracking.location", latest);
          }
        }

        if (normalizedTrip) {
          socket.join(`trip:${normalizedTrip}`);
          const latest = await getLatestTripLocation(normalizedTrip);
          if (latest) {
            socket.emit("tracking.location", latest);
          }
        }

        ack?.({
          success: true,
          busNumber: normalizedBus || null,
          tripKey: normalizedTrip || null,
        });
      } catch (error) {
        ack?.({ success: false, message: error?.message || "SUBSCRIBE_FAILED" });
      }
    });

    socket.on("tracking:unsubscribe", ({ busNumber, tripKey }, ack) => {
      const normalizedBus = normalizeBusNumber(busNumber);
      const normalizedTrip = String(tripKey || "").trim();
      if (normalizedBus) socket.leave(`bus:${normalizedBus}`);
      if (normalizedTrip) socket.leave(`trip:${normalizedTrip}`);
      ack?.({ success: true });
    });
  });

  subscribeToTrackingPubSub(privateNamespace, trackingNamespace).catch((error) => {
    console.error("[Socket] tracking pubsub subscription failed:", error);
  });

  return io;
};
