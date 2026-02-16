import { Review } from "../models/review.js";
import { User } from "../models/user.js";
import { Booking } from "../models/booking.js";
import { Bus } from "../models/bus.js";
import { calculateArrivalDateTime } from "./bookingController.js";

// Create a new review
export const createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment, photos } = req.body;
    const userId = req.user._id;

    // 1. Validate input
    if (!bookingId || !rating) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and rating are required",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // 2. Fetch booking
    const booking = await Booking.findOne({
      bookingId: bookingId,
      user: userId,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or does not belong to user",
      });
    }

    // 3. Check if booking is completed (by status or by arrival time)
    const arrivalTime = calculateArrivalDateTime(booking);
    const now = new Date();
    const isCompleted =
      booking.bookingStatus === "completed" ||
      (booking.bookingStatus === "confirmed" &&
        arrivalTime &&
        arrivalTime < now);

    if (!isCompleted) {
      return res.status(400).json({
        success: false,
        message: "Only completed bookings can be reviewed",
      });
    }

    // 4. Check if already reviewed
    const existingReview = await Review.findOne({
      user: userId,
      booking: booking._id,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this trip",
      });
    }

    // 5. Create Review
    const review = new Review({
      user: userId,
      bus: booking.bus,
      booking: booking._id,
      route: {
        routeCode: booking.route?.routeCode,
        origin: booking.route?.origin,
        destination: booking.route?.destination,
      },
      rating,
      comment,
      photos,
      context: "trip",
    });

    await review.save();

    // 6. Update Booking status
    booking.isReviewed = true;
    await booking.save();

    // 7. Update Bus Rating (Background task ideally, but doing inline for now)
    // Recalculate average rating for the bus
    const stats = await Review.aggregate([
      { $match: { bus: booking.bus } },
      {
        $group: {
          _id: "$bus",
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      const avgRating = Math.round(stats[0].avgRating * 10) / 10; // Round to 1 decimal
      await Bus.findByIdAndUpdate(booking.bus, {
        ratings: avgRating,
        $push: {
          reviews: {
            $each: [
              {
                userId: userId,
                rating: rating,
                comment: comment,
                createdAt: new Date(),
              },
            ],
            $slice: -20, // Keep last 20 reviews in the embedded array for quick access
          },
        },
      });
    }

    res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      data: review,
    });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get review by booking ID
export const getReviewByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user._id;

    // Find the booking first using the string ID
    const booking = await Booking.findOne({ bookingId, user: userId });

    if (!booking) {
      // If booking not found by that ID for this user, return 404
      // Use 200 with null data or 404 depending on preference.
      // Frontend expects 404 if no review, but here we can't even find booking.
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const review = await Review.findOne({
      booking: booking._id,
      user: userId,
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error("Error fetching review:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update review
export const updateReview = async (req, res) => {
  try {
    const { id } = req.params; // Review ID
    const { rating, comment, photos } = req.body;
    const userId = req.user._id;

    const review = await Review.findOne({ _id: id, user: userId });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Check 72-hour edit window (hours since creation)
    const createdAt = new Date(review.createdAt);
    const now = new Date();
    const diffHours = (now.getTime() - createdAt.getTime()) / 36e5;

    if (diffHours > 72) {
      return res.status(403).json({
        success: false,
        message: "Reviews can only be edited within 72 hours of creation",
      });
    }

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating must be between 1 and 5",
        });
      }
      review.rating = rating;
    }
    if (comment !== undefined) review.comment = comment;
    if (photos) review.photos = photos;

    await review.save();

    // Recalculate Bus Rating
    await recalculateBusRating(review.bus);

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: review,
    });
  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Delete review
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const review = await Review.findOneAndDelete({ _id: id, user: userId });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Update Booking isReviewed to false
    await Booking.findByIdAndUpdate(review.booking, { isReviewed: false });

    // Recalculate Bus Rating
    await recalculateBusRating(review.bus);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Helper: Recalculate Bus Rating
const recalculateBusRating = async (busId) => {
  try {
    const stats = await Review.aggregate([
      { $match: { bus: busId } },
      {
        $group: {
          _id: "$bus",
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      const avgRating = Math.round(stats[0].avgRating * 10) / 10;
      await Bus.findByIdAndUpdate(busId, {
        ratings: avgRating,
        // We might want to refresh the reviews list too, but for now just updating rating
      });
    } else {
      // No reviews left
      await Bus.findByIdAndUpdate(busId, {
        ratings: 0,
      });
    }
  } catch (error) {
    console.error("Error recalculating bus rating:", error);
  }
};

// Get All Reviews (Admin/Superadmin)
export const getAllReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search ? req.query.search.toString() : "";
    const rating = req.query.rating ? parseInt(req.query.rating) : null;
    const skip = (page - 1) * limit;

    const query = {};

    // Filter by Rating
    if (rating) {
      query.rating = rating;
    }

    // Search Logic
    if (search) {
      const searchRegex = new RegExp(search, "i");

      // Find matching users
      const users = await User.find({
        $or: [{ fullName: searchRegex }, { email: searchRegex }],
      }).select("_id");
      const userIds = users.map((u) => u._id);

      // Find matching buses
      const buses = await Bus.find({
        $or: [{ busName: searchRegex }, { busNumber: searchRegex }],
      }).select("_id");
      const busIds = buses.map((b) => b._id);

      query.$or = [
        { comment: searchRegex },
        { user: { $in: userIds } },
        { bus: { $in: busIds } },
      ];
    }

    const reviews = await Review.find(query)
      .populate("user", "fullName email")
      .populate("bus", "busName busNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments(query);

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: reviews,
    });
  } catch (error) {
    console.error("Error fetching all reviews:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteReviewByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await Review.findByIdAndDelete(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Update Booking isReviewed to false if booking exists
    if (review.booking) {
      await Booking.findByIdAndUpdate(review.booking, { isReviewed: false });
    }

    // Recalculate Bus Rating
    if (review.bus) {
      await recalculateBusRating(review.bus);
    }

    res.status(200).json({
      success: true,
      message: "Review deleted successfully by admin",
    });
  } catch (error) {
    console.error("Error deleting review by admin:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
