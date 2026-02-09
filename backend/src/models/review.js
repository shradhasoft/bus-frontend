import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
    },
    rating: {
      type: Number,
      required: true,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    comment: {
      type: String,
      maxlength: [500, "Comment cannot exceed 500 characters"],
      trim: true,
    },
    context: {
      type: String,
      enum: ["trip", "booking", "service", "other"],
      default: "trip",
    },
    photos: {
      type: [String],
      validate: [(array) => array.length <= 5, "Max 5 photos allowed"],
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Ensure reviews are either for bus or route
reviewSchema.pre("validate", function (next) {
  if (!this.bus && !this.route) {
    this.invalidate(
      "subject",
      "Review must be associated with either a bus or route"
    );
  }
  next();
});

// Indexes
reviewSchema.index({ user: 1 });
reviewSchema.index({ bus: 1 });
reviewSchema.index({ route: 1 });
reviewSchema.index(
  { user: 1, bus: 1 },
  { unique: true, partialFilterExpression: { bus: { $exists: true } } }
);
reviewSchema.index(
  { user: 1, route: 1 },
  { unique: true, partialFilterExpression: { route: { $exists: true } } }
);

export const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
