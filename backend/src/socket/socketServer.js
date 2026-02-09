// src/socket/socketServer.js
import { Server } from "socket.io";
import { Bus } from "../models/bus.js";
import { BusLiveLocation } from "../models/busLiveLocation.js";
import { User } from "../models/user.js";

// Firebase Admin Auth (same import style you used in authMiddleware)
import { auth as firebaseAdminAuth } from "../utils/firebase-admin.js";

// cookie parser (tiny)
import cookie from "cookie";

const isValidLatLng = (lat, lng) => {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

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

export const initSocketServer = (httpServer, corsOrigin) => {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  // ✅ Firebase Auth middleware for sockets (matches your REST protect middleware)
  io.use(async (socket, next) => {
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

      // ✅ Match REST rules (recommended)
      if (dbUser.isActive === false)
        return next(new Error("ACCOUNT_DEACTIVATED"));
      if (dbUser.isBlocked === true) return next(new Error("ACCOUNT_BLOCKED"));

      socket.user = {
        id: dbUser._id,
        role: dbUser.role,
        firebaseUID,
      };

      return next();
    } catch (err) {
      return next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket) => {
    // =========================
    // USER subscribes to bus room
    // Supports busNumber OR busName
    // =========================
    socket.on("user:subscribe", async ({ busNumber, busName }, ack) => {
      try {
        let bn = normalizeBusNumber(busNumber);

        // If user passed busName, resolve to busNumber
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

        const room = `bus:${bn}`;
        socket.join(room);

        // Send current location immediately (if any)
        const live = await BusLiveLocation.findOne({ busNumber: bn }).lean();
        if (live?.location?.coordinates?.length === 2) {
          socket.emit("bus:location", {
            busNumber: bn,
            lat: live.location.coordinates[1],
            lng: live.location.coordinates[0],
            accuracy: live.accuracy ?? null,
            speed: live.speed ?? null,
            heading: live.heading ?? null,
            recordedAt: live.recordedAt,
          });
        }

        ack?.({ success: true, busNumber: bn });
      } catch (e) {
        ack?.({ success: false, message: e.message });
      }
    });

    socket.on("user:unsubscribe", ({ busNumber }, ack) => {
      const bn = normalizeBusNumber(busNumber);
      if (bn) socket.leave(`bus:${bn}`);
      ack?.({ success: true });
    });

    // =========================================
    // CONDUCTOR starts tracking a bus (optional)
    // =========================================
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

        // Ensure bus is assigned to this conductor
        if (
          !bus.conductor ||
          String(bus.conductor) !== String(socket.user.id)
        ) {
          return ack?.({ success: false, message: "BUS_NOT_ASSIGNED_TO_YOU" });
        }

        socket.data.busNumber = bn;
        socket.data.busId = bus._id;

        ack?.({ success: true });
      } catch (e) {
        ack?.({ success: false, message: e.message });
      }
    });

    // ============================
    // CONDUCTOR sends live location
    // ============================
    socket.on("conductor:location", async (payload, ack) => {
      try {
        if (socket.user.role !== "conductor") {
          return ack?.({ success: false, message: "FORBIDDEN" });
        }

        const bn = normalizeBusNumber(
          payload?.busNumber || socket.data.busNumber,
        );
        const lat = Number(payload?.lat);
        const lng = Number(payload?.lng);

        if (!bn) throw new Error("BUS_NUMBER_REQUIRED");
        if (!isValidLatLng(lat, lng)) throw new Error("INVALID_LAT_LNG");

        // Verify bus + assignment (server-side trust)
        const bus = await Bus.findOne({
          busNumber: bn,
          isDeleted: false,
          isActive: true,
        }).select("_id busNumber conductor");

        if (!bus) return ack?.({ success: false, message: "BUS_NOT_FOUND" });

        if (
          !bus.conductor ||
          String(bus.conductor) !== String(socket.user.id)
        ) {
          return ack?.({ success: false, message: "BUS_NOT_ASSIGNED_TO_YOU" });
        }

        const update = {
          bus: bus._id,
          busNumber: bn,
          conductor: socket.user.id,
          location: { type: "Point", coordinates: [lng, lat] },
          accuracy:
            payload?.accuracy !== undefined && payload?.accuracy !== null
              ? Number(payload.accuracy)
              : null,
          speed:
            payload?.speed !== undefined && payload?.speed !== null
              ? Number(payload.speed)
              : null,
          heading:
            payload?.heading !== undefined && payload?.heading !== null
              ? Number(payload.heading)
              : null,
          recordedAt: payload?.recordedAt
            ? new Date(payload.recordedAt)
            : new Date(),
        };

        await BusLiveLocation.findOneAndUpdate(
          { busNumber: bn },
          { $set: update },
          { upsert: true, new: true },
        );

        io.to(`bus:${bn}`).emit("bus:location", {
          busNumber: bn,
          lat,
          lng,
          accuracy: update.accuracy,
          speed: update.speed,
          heading: update.heading,
          recordedAt: update.recordedAt,
        });

        ack?.({ success: true });
      } catch (e) {
        ack?.({ success: false, message: e.message });
      }
    });

    socket.on("disconnect", () => {});
  });

  return io;
};
