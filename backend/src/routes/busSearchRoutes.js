import express from "express";
import {
  getAllStops,
  searchBuses,
  getBusSeatLayout,
  getBusDetails,
  getAvailableSeats,
} from "../controllers/busSearchController.js";
import { validateBusSearch } from "../middlewares/validationMiddleware.js";
import { protect } from "../middlewares/authMiddleware.js";

const searchBusRouter = express.Router();

searchBusRouter.get("/search-bus", protect, validateBusSearch, searchBuses);
searchBusRouter.get("/stops", protect, getAllStops);
searchBusRouter.get("/bus-seat-layout", protect, getBusSeatLayout);
searchBusRouter.get("/bus-details/:busId", protect, getBusDetails);
// searchBusRouter.get("/available-seats/:busId", protect, getAvailableSeats);

export default searchBusRouter;
