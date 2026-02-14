// src/app.js
import "./config/env.js";
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./config/database.js";
import connectCloudinary from "./config/cloudinary.js";
import { initRedis } from "./config/redis.js";
import { scheduleCleanup } from "./scripts/cleanup-expired-locks.js";
import { initSocketServer } from "./socket/socketServer.js";
import { startTrackingHistoryWorker } from "./services/tracking/historyWorker.js";

// Routers
import authRouter from "./routes/authRoutes.js";
import busRouter from "./routes/busRoutes.js";
import searchBusRouter from "./routes/busSearchRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";
import offerRouter from "./routes/offerRoutes.js";
import profileRouter from "./routes/profileRoutes.js";
import helpRouter from "./routes/helpRoutes.js";
import paymentRouter from "./routes/paymentRoutes.js";
import trackingRouter from "./routes/trackingRoutes.js";
import userRouter from "./routes/userRoutes.js";
import telemetryRouter from "./routes/telemetryRoutes.js";
import publicTrackingRouter from "./routes/publicTrackingRoutes.js";

const app = express();
connectCloudinary();

const PORT = process.env.PORT || 3000;

const normalizeOrigin = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const toSafeInt = (value) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const compileOriginPatterns = (origins) => {
  const normalized = Array.from(
    new Set(origins.map((origin) => normalizeOrigin(origin)).filter(Boolean)),
  );

  if (normalized.includes("*")) {
    return {
      allowAll: true,
      exact: new Set(),
      wildcardRegexes: [],
    };
  }

  const exact = new Set();
  const wildcardRegexes = [];

  for (const origin of normalized) {
    if (!origin.includes("*")) {
      exact.add(origin);
      continue;
    }

    const escaped = origin
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    wildcardRegexes.push(new RegExp(`^${escaped}$`));
  }

  return {
    allowAll: false,
    exact,
    wildcardRegexes,
  };
};

const defaultOrigins = ["http://localhost:3000", "http://localhost:5173"];

const envOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const ALLOWED_ORIGINS = Array.from(
  new Set((envOrigins.length ? envOrigins : defaultOrigins).map(normalizeOrigin)),
);

const originPatterns = compileOriginPatterns(ALLOWED_ORIGINS);

const isAllowedOrigin = (origin) => {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (originPatterns.allowAll) return true;
  if (originPatterns.exact.has(normalized)) return true;
  return originPatterns.wildcardRegexes.some((regex) => regex.test(normalized));
};

const SOCKET_IO_PATH = (() => {
  const raw = String(process.env.SOCKET_IO_PATH || "/socket.io").trim();
  if (!raw) return "/socket.io";
  return raw.startsWith("/") ? raw : `/${raw}`;
})();

const SOCKET_PING_INTERVAL_MS = toSafeInt(process.env.SOCKET_PING_INTERVAL_MS);
const SOCKET_PING_TIMEOUT_MS = toSafeInt(process.env.SOCKET_PING_TIMEOUT_MS);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow requests with no origin (postman)
      if (!origin) return cb(null, true);
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      if (req.originalUrl?.startsWith("/payment/razorpay/webhook")) {
        req.rawBody = buf;
      }
    },
  }),
);
app.use(cookieParser());

// REST routes
app.use("/", authRouter);
app.use("/", busRouter);
app.use("/", searchBusRouter);
app.use("/", bookingRouter);
app.use("/", offerRouter);
app.use("/", profileRouter);
app.use("/", helpRouter);
app.use("/", paymentRouter);
app.use("/", trackingRouter);
app.use("/", userRouter);
app.use("/", telemetryRouter);
app.use("/", publicTrackingRouter);

// Create HTTP server (socket attached after external dependencies init)
const server = http.createServer(app);

// cleanup script
scheduleCleanup();

connectDB()
  .then(async () => {
    console.log("Database connected successfully...");

    const redisReady = await initRedis();
    if (!redisReady && process.env.NODE_ENV === "production") {
      throw new Error(
        "Redis initialization failed in production. Aborting startup.",
      );
    }

    initSocketServer(server, {
      allowedOrigins: ALLOWED_ORIGINS,
      isAllowedOrigin,
      socketPath: SOCKET_IO_PATH,
      pingInterval: SOCKET_PING_INTERVAL_MS,
      pingTimeout: SOCKET_PING_TIMEOUT_MS,
    });
    await startTrackingHistoryWorker();

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}...`);
    });
  })
  .catch((err) => {
    console.error("Error connecting to database: ", err.message);
  });
