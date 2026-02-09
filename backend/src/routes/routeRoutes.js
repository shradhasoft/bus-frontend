// src/routes/routeRoutes.js
import express from "express";
import {
  addRoute,
  deleteRoute,
  getRoutes,
  updateRoute,
} from "../controllers/routeController.js";
import {
  validateRouteCreation,
  validateRouteUpdate,
} from "../middlewares/validationMiddleware.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";

const routeRouter = express.Router();

routeRouter.post(
  "/addroute",
  protect,
  authorize("admin", "owner"),
  validateRouteCreation,
  addRoute
);

routeRouter.get("/getroutes", protect, authorize("admin", "owner"), getRoutes);

routeRouter.patch(
  "/updateroute/:id",
  protect,
  authorize("admin", "owner"),
  validateRouteUpdate,
  updateRoute
);

routeRouter.delete(
  "/deleteroute/:id",
  protect,
  authorize("admin", "owner"),
  deleteRoute
);
export default routeRouter;
