import { Review } from "../models/review.js";
import { Booking } from "../models/booking.js";
import { Bus } from "../models/bus.js";

// Create a new review
export const createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment, photos } = req.body;
    const userId = req.user._id; // Assuming auth middleware populates this

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

    // 3. Check if booking is completed
    if (booking.bookingStatus !== "completed") {
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

    // Check 72 hour window
    const createdAt = new Date(review.createdAt);
    const now = new Date();
    const diffHours = Math.abs(now - createdAt) / 36e5;

    if (diffHours > 72) {
      return res.status(403).json({
        success: false,
        message: "Reviews can only be edited within 72 hours of creation",
      });
    }

    if (rating) review.rating = rating;
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
