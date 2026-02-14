import express from "express";
import {
  getBusHistoryPublic,
  getBusLatestPublic,
  getTrackingHealth,
  getTripLatestPublic,
  searchTrackingBusesPublic,
} from "../controllers/publicTrackingController.js";

const publicTrackingRouter = express.Router();

publicTrackingRouter.get("/v1/tracking/health", getTrackingHealth);
publicTrackingRouter.get("/v1/tracking/search", searchTrackingBusesPublic);
publicTrackingRouter.get("/v1/tracking/bus/:busNumber/latest", getBusLatestPublic);
publicTrackingRouter.get("/v1/tracking/trip/:tripKey/latest", getTripLatestPublic);
publicTrackingRouter.get("/v1/tracking/bus/:busNumber/history", getBusHistoryPublic);

export default publicTrackingRouter;

