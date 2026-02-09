import express from "express";
import {
  lockSeatsForBooking,
  createBooking,
  releaseSeatLocks,
  cancelBooking,
  changeTravelDate,
  getMyBookings,
  getAllBookings,
  extendSeatLocks,
  validateSeatLocks
} from "../controllers/bookingController.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";
import {
  validateBookingCancellation,
  validateBookingCreation,
  validateTravelDateChange,
  validateSeatLocking,
  validateSeatRelease,
} from "../middlewares/validationMiddleware.js";

const router = express.Router();

// Seat locking routes
router.post("/lock-seats", protect, validateSeatLocking, lockSeatsForBooking);
router.post("/extend-locks", protect, validateSeatRelease, extendSeatLocks);
router.post("/release-locks", protect, validateSeatRelease, releaseSeatLocks);
router.post("/validate-locks", protect, validateSeatRelease, validateSeatLocks);


// Booking routes
router.post("/create-booking", protect, validateBookingCreation, createBooking);
router.patch(
  "/cancelbooking/:id",
  protect,
  validateBookingCancellation,
  cancelBooking
);
router.patch(
  "/changedate/:id",
  protect,
  validateTravelDateChange,
  changeTravelDate
);
router.get("/mybookings", protect, getMyBookings);

router.get("/getallbookings", protect, authorize("admin"), getAllBookings);

export default router;
