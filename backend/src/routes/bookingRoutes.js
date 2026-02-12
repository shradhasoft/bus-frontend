import express from "express";
import {
  lockSeatsForBooking,
  createBooking,
  releaseSeatLocks,
  cancelBooking,
  changeTravelDate,
  getMyBookings,
  getMyBookingByRef,
  downloadMyBookingInvoice,
  getAdminBookings,
  getAdminBookingByRef,
  createAdminBooking,
  updateAdminBooking,
  deleteAdminBooking,
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
router.get("/mybookings/:bookingRef/invoice", protect, downloadMyBookingInvoice);
router.get("/mybookings/:bookingRef", protect, getMyBookingByRef);

// Admin booking management
router.get(
  "/admin/bookings",
  protect,
  authorize("admin", "superadmin"),
  getAdminBookings
);
router.get(
  "/admin/bookings/:bookingRef",
  protect,
  authorize("admin", "superadmin"),
  getAdminBookingByRef
);
router.post(
  "/admin/bookings",
  protect,
  authorize("admin", "superadmin"),
  createAdminBooking
);
router.patch(
  "/admin/bookings/:bookingRef",
  protect,
  authorize("admin", "superadmin"),
  updateAdminBooking
);
router.delete(
  "/admin/bookings/:bookingRef",
  protect,
  authorize("admin", "superadmin"),
  deleteAdminBooking
);

router.get(
  "/getallbookings",
  protect,
  authorize("admin", "superadmin"),
  getAllBookings
);

export default router;
