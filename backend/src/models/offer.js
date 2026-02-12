import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [20, "Code cannot exceed 20 characters"],
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
      default: "percentage",
    },
    discountValue: {
      type: Number,
      required: true,
      min: [0, "Discount value cannot be negative"],
    },
    minOrderAmount: {
      type: Number,
      min: [0, "Minimum order amount cannot be negative"],
    },
    maxDiscountAmount: {
      type: Number,
      min: [0, "Max discount amount cannot be negative"],
    },
    validFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    applicableFor: {
      type: String,
      enum: ["all", "routes", "buses", "users"],
      default: "all",
    },
    specificRoutes: [
      {
        type: String,
        trim: true,
        uppercase: true,
      },
    ],
    specificBuses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bus",
      },
    ],
    specificUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    usageLimit: {
      type: Number,
      min: [0, "Usage limit cannot be negative"],
    },
    usageLimitPerUser: {
      type: Number,
      min: [0, "Usage limit per user cannot be negative"],
      default: null,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, "Used count cannot be negative"],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
offerSchema.index({ code: 1 }, { unique: true });
offerSchema.index({ validFrom: 1, validUntil: 1 });
offerSchema.index({ isActive: 1, validUntil: 1 });
offerSchema.index({ isDeleted: 1 });
offerSchema.index({ isDeleted: 1, isActive: 1, validFrom: 1, validUntil: 1 });

// Virtual for validity status
offerSchema.virtual("isValid").get(function () {
  const now = new Date();
  return (
    this.isActive &&
    now >= this.validFrom &&
    now <= this.validUntil &&
    (!this.usageLimit || this.usedCount < this.usageLimit)
  );
});

offerSchema.virtual("status").get(function () {
  const now = new Date();

  if (this.isDeleted) return "deleted";
  if (!this.isActive) return "inactive";
  if (now < this.validFrom) return "upcoming";
  if (now > this.validUntil) return "expired";
  return "active";
});

// Pre-save validation
offerSchema.pre("save", function (next) {
  if (this.discountType === "percentage" && this.discountValue > 100) {
    return next(new Error("Percentage discount cannot exceed 100%"));
  }

  if (this.validUntil <= this.validFrom) {
    return next(new Error("Valid until must be after valid from date"));
  }

  if (
    this.minOrderAmount &&
    this.maxDiscountAmount &&
    this.maxDiscountAmount > this.minOrderAmount
  ) {
    return next(new Error("Max discount cannot exceed min order amount"));
  }

  if (
    this.usageLimit !== undefined &&
    this.usageLimitPerUser !== null &&
    this.usageLimitPerUser !== undefined &&
    this.usageLimitPerUser > this.usageLimit
  ) {
    return next(
      new Error("Usage limit per user cannot exceed overall usage limit")
    );
  }

  next();
});

export const Offer =
  mongoose.models.Offer || mongoose.model("Offer", offerSchema);
