import mongoose from "mongoose";

const timeSchema = new mongoose.Schema(
  {
    hours: {
      type: Number,
      min: [0, "Hours cannot be negative"],
      max: [23, "Hours cannot exceed 23"],
    },
    minutes: {
      type: Number,
      min: [0, "Minutes cannot be negative"],
      max: [59, "Minutes cannot exceed 59"],
    },
  },
  { _id: false }
);

const tripStopSchema = new mongoose.Schema(
  {
    arrivalTime: timeSchema,
    departureTime: timeSchema,
    distanceFromOrigin: {
      type: Number,
      min: [0, "Distance cannot be negative"],
    },
  },
  { _id: false }
);

const routeStopSchema = new mongoose.Schema(
  {
    city: { type: String, trim: true },
    upTrip: tripStopSchema,
    downTrip: tripStopSchema,
  },
  { _id: false }
);

const routeSnapshotSchema = new mongoose.Schema(
  {
    routeCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    origin: { type: String, trim: true },
    destination: { type: String, trim: true },
    stops: [routeStopSchema],
    distance: {
      type: Number,
      min: [1, "Distance must be at least 1 km"],
    },
    duration: {
      hours: {
        type: Number,
        min: [0, "Hours cannot be negative"],
        max: [100, "Hours cannot exceed 100"],
      },
      minutes: {
        type: Number,
        min: [0, "Minutes cannot be negative"],
        max: [59, "Minutes cannot exceed 59"],
      },
    },
    cancellationPolicy: {
      before24h: {
        type: Number,
        min: [0, "Fee cannot be negative"],
        max: [100, "Fee cannot exceed 100%"],
      },
      before12h: {
        type: Number,
        min: [0, "Fee cannot be negative"],
        max: [100, "Fee cannot exceed 100%"],
      },
      noShow: {
        type: Number,
        min: [0, "Fee cannot be negative"],
        max: [100, "Fee cannot exceed 100%"],
      },
    },
  },
  { _id: false }
);

const passengerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, min: 1, max: 120 },
  gender: { type: String, enum: ["male", "female", "other"] },
  seatNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z]{1,10}-[0-9]{1,2}[A-Z]$/, "Invalid seat identifier"],
  },
  mobileNumber: { type: String, required: true },
  identification: {
    type: { type: String, enum: ["aadhar", "passport", "dl"] },
    number: String,
  },
});

const offerSnapshotSchema = new mongoose.Schema(
  {
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
    },
    discountValue: {
      type: Number,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },
    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ["applied", "redeemed", "released", "invalidated"],
      default: "applied",
    },
    appliedAt: Date,
    redeemedAt: Date,
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    route: {
      type: routeSnapshotSchema,
      required: true,
    },
    travelDate: {
      type: Date,
      required: true,
    },
    direction: {
      type: String,
      enum: ["forward", "return"],
      required: true,
      default: "forward",
    },
    boardingPoint: { type: String, required: true },
    droppingPoint: { type: String, required: true },
    passengers: [passengerSchema],
    journeyDistance: {
      type: Number,
      required: true,
      min: [0.1, "Distance must be at least 0.1 km"],
    },
    farePerKm: {
      type: Number,
      required: true,
      min: [0.01, "Fare per km must be at least 0.01"],
    },
    farePerPassenger: {
      type: Number,
      required: true,
      min: [0.01, "Fare per passenger must be at least 0.01"],
    },
    baseAmount: {
      type: Number,
      min: [0, "Base amount cannot be negative"],
      default: 0,
    },
    discountAmount: {
      type: Number,
      min: [0, "Discount amount cannot be negative"],
      default: 0,
    },
    finalAmount: {
      type: Number,
      min: [0, "Final amount cannot be negative"],
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [1, "Amount must be at least 1"],
    },
    currency: {
      type: String,
      enum: ["INR", "USD", "EUR"],
      default: "INR",
    },
    bookingStatus: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded", "partial-refund"],
      default: "pending",
    },
    cancellation: {
      requestedAt: Date,
      processedAt: Date,
      refundAmount: Number,
      reason: String,
    },
    boardingPass: {
      code: String,
      issuedAt: Date,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    offer: {
      type: offerSnapshotSchema,
      default: null,
    },
    // NEW: Add sessionId to the booking schema
    sessionId: {
      type: String,
      required: false, // Not strictly required for all bookings, but essential for those with temporary locks
      index: true, // Index for faster lookup
    },
  },
  { timestamps: true }
);

// Query patterns optimized for profile listing and tab filters.
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ user: 1, travelDate: 1 });
bookingSchema.index({ user: 1, bookingStatus: 1, travelDate: -1 });
bookingSchema.index({ user: 1, paymentStatus: 1, createdAt: -1 });

export const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
