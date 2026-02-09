import express from "express";
import {
  searchBusForTracking,
  getLatestBusLocation,
} from "../controllers/trackingController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const trackingRouter = express.Router();

// Normal user can search buses for tracking
trackingRouter.get(
  "/track/search",
  protect,
  authorize("user", "admin", "owner", "superadmin", "conductor"),
  searchBusForTracking,
);

// Normal user can fetch latest location snapshot
trackingRouter.get(
  "/track/bus/:busNumber/latest",
  protect,
  authorize("user", "admin", "owner", "superadmin", "conductor"),
  getLatestBusLocation,
);

export default trackingRouter;
