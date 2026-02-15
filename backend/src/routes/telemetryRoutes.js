import express from "express";
import { authorize, protect } from "../middlewares/authMiddleware.js";
import {
  assignConductorToBus,
  createOwnerConductor,
  deleteOwnerConductor,
  getConductorBusDetails,
  getConductorOfflineSeatLayout,
  getOwnerTelemetryBusLatest,
  getOwnerConductors,
  getOwnerTelemetryBuses,
  getTelemetryAssignments,
  markConductorOfflineSeatBooked,
  postLocationTelemetry,
  toggleConductorBusInactiveDate,
  unmarkConductorOfflineSeatBooked,
  updateOwnerConductor,
} from "../controllers/telemetryController.js";

const telemetryRouter = express.Router();

telemetryRouter.post(
  "/v1/telemetry/location",
  protect,
  authorize("conductor"),
  postLocationTelemetry,
);

telemetryRouter.get(
  "/v1/telemetry/assignments",
  protect,
  authorize("conductor"),
  getTelemetryAssignments,
);

telemetryRouter.get(
  "/v1/telemetry/conductor/buses/:busId/details",
  protect,
  authorize("conductor"),
  getConductorBusDetails,
);

telemetryRouter.patch(
  "/v1/telemetry/conductor/buses/:busId/inactive-date",
  protect,
  authorize("conductor"),
  toggleConductorBusInactiveDate,
);

telemetryRouter.get(
  "/v1/telemetry/conductor/buses/:busId/offline-seats",
  protect,
  authorize("conductor"),
  getConductorOfflineSeatLayout,
);

telemetryRouter.post(
  "/v1/telemetry/conductor/buses/:busId/offline-seats/book",
  protect,
  authorize("conductor"),
  markConductorOfflineSeatBooked,
);

telemetryRouter.post(
  "/v1/telemetry/conductor/buses/:busId/offline-seats/unbook",
  protect,
  authorize("conductor"),
  unmarkConductorOfflineSeatBooked,
);

telemetryRouter.get(
  "/v1/telemetry/owner/buses",
  protect,
  authorize("owner", "admin", "superadmin"),
  getOwnerTelemetryBuses,
);

telemetryRouter.get(
  "/v1/telemetry/owner/buses/:busNumber/latest",
  protect,
  authorize("owner", "admin", "superadmin"),
  getOwnerTelemetryBusLatest,
);

telemetryRouter.get(
  "/v1/telemetry/owner/conductors",
  protect,
  authorize("owner", "admin", "superadmin"),
  getOwnerConductors,
);

telemetryRouter.post(
  "/v1/telemetry/owner/conductors",
  protect,
  authorize("owner", "admin", "superadmin"),
  createOwnerConductor,
);

telemetryRouter.patch(
  "/v1/telemetry/owner/conductors/:conductorId",
  protect,
  authorize("owner", "admin", "superadmin"),
  updateOwnerConductor,
);

telemetryRouter.delete(
  "/v1/telemetry/owner/conductors/:conductorId",
  protect,
  authorize("owner", "admin", "superadmin"),
  deleteOwnerConductor,
);

telemetryRouter.patch(
  "/v1/telemetry/owner/buses/:busId/conductor",
  protect,
  authorize("owner", "admin", "superadmin"),
  assignConductorToBus,
);

export default telemetryRouter;
