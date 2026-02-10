// src/app.js
import "./config/env.js";
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./config/database.js";
import connectCloudinary from "./config/cloudinary.js";
import { scheduleCleanup } from "./scripts/cleanup-expired-locks.js";
import { initSocketServer } from "./socket/socketServer.js";

// Routers
import authRouter from "./routes/authRoutes.js";
import busRouter from "./routes/busRoutes.js";
import routeRouter from "./routes/routeRoutes.js";
import searchBusRouter from "./routes/busSearchRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";
import offerRouter from "./routes/offerRoutes.js";
import profileRouter from "./routes/profileRoutes.js";
import helpRouter from "./routes/helpRoutes.js";
import paymentRouter from "./routes/paymentRoutes.js";
import trackingRouter from "./routes/trackingRoutes.js";
import userRouter from "./routes/userRoutes.js";

const app = express();
connectCloudinary();

const PORT = process.env.PORT || 3000;

// ✅ Better CORS (env-driven, safe defaults for local dev)
const defaultOrigins = [
  "http://localhost:3000",
  "http://localhost:3000/",
  "http://localhost:5173",
  "http://localhost:5173/",
];

const envOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = envOrigins.length ? envOrigins : defaultOrigins;

app.use(
  cors({
    origin: (origin, cb) => {
      // allow requests with no origin (postman)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// REST routes
app.use("/", authRouter);
app.use("/", busRouter);
app.use("/", routeRouter);
app.use("/", searchBusRouter);
app.use("/", bookingRouter);
app.use("/", offerRouter);
app.use("/", profileRouter);
app.use("/", helpRouter);
app.use("/", paymentRouter);
app.use("/", trackingRouter);
app.use("/", userRouter);

// Create HTTP server and attach socket.io
const server = http.createServer(app);
initSocketServer(server, ALLOWED_ORIGINS);

// cleanup script
scheduleCleanup();

connectDB()
  .then(() => {
    console.log("Database connected successfully...");
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}...`);
    });
  })
  .catch((err) => {
    console.error("Error connecting to database: ", err.message);
  });
