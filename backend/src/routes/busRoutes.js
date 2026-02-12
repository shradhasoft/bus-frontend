// src/routes/busRoutes.js
import express from "express";
import {
  addBus,
  deleteBus,
  updateBus,
  listBuses,
  getBusById,
} from "../controllers/busController.js";
import {
  validateBusCreation,
  validateBusUpdate,
} from "../middlewares/validationMiddleware.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const busRouter = express.Router();

busRouter.post(
  "/addbus",
  protect,
  authorize("admin", "owner", "superadmin"),
  validateBusCreation,
  addBus
);

busRouter.patch(
  "/updatebus/:id",
  protect,
  authorize("admin", "owner", "superadmin"),
  validateBusUpdate,
  updateBus
);

busRouter.delete(
  "/deletebus/:id",
  protect,
  authorize("admin", "owner", "superadmin"),
  deleteBus
);

busRouter.get(
  "/admin/buses",
  protect,
  authorize("admin", "owner", "superadmin"),
  listBuses
);

busRouter.get(
  "/admin/buses/:id",
  protect,
  authorize("admin", "owner", "superadmin"),
  getBusById
);

busRouter.post(
  "/admin/buses",
  protect,
  authorize("admin", "owner", "superadmin"),
  validateBusCreation,
  addBus
);

busRouter.patch(
  "/admin/buses/:id",
  protect,
  authorize("admin", "owner", "superadmin"),
  validateBusUpdate,
  updateBus
);

busRouter.delete(
  "/admin/buses/:id",
  protect,
  authorize("admin", "owner", "superadmin"),
  deleteBus
);

export default busRouter;
