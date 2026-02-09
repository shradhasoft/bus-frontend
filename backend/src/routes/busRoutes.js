// src/routes/busRoutes.js
import express from "express";
import { addBus, deleteBus, updateBus } from "../controllers/busController.js";
import {
  validateBusCreation,
  validateBusUpdate,
} from "../middlewares/validationMiddleware.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const busRouter = express.Router();

busRouter.post(
  "/addbus",
  protect,
  authorize("admin", "owner"),
  validateBusCreation,
  addBus
);

busRouter.patch(
  "/updatebus/:id",
  protect,
  authorize("admin", "owner"),
  validateBusUpdate,
  updateBus
);

busRouter.delete(
  "/deletebus/:id",
  protect,
  authorize("admin", "owner"),
  deleteBus
);

export default busRouter;
