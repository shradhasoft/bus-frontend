import express from "express";
import {
  createReview,
  getReviewByBooking,
  updateReview,
  deleteReview,
  getAllReviews,
  deleteReviewByAdmin,
} from "../controllers/reviewController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createReview);
router.get("/booking/:bookingId", protect, getReviewByBooking);
router.put("/:id", protect, updateReview);
router.delete("/:id", protect, deleteReview);

// Admin Routes
router.get(
  "/admin/all",
  protect,
  authorize("admin", "superadmin"),
  getAllReviews,
);
router.delete(
  "/admin/:id",
  protect,
  authorize("admin", "superadmin"),
  deleteReviewByAdmin,
);

export default router;
