import mongoose from "mongoose";

const passengerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, min: 1, max: 120 },
  gender: { type: String, enum: ["male", "female", "other"] },
  seatNumber: { type: Number, required: true },
  mobileNumber: { type: String, required: true },
  identification: {
    type: { type: String, enum: ["aadhar", "passport", "dl"] },
    number: String,
  },
});

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
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
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
    totalAmount: {
      type: Number,
      required: true,
      min: [1, "Amount must be at least 1"],
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
    // NEW: Add sessionId to the booking schema
    sessionId: {
      type: String,
      required: false, // Not strictly required for all bookings, but essential for those with temporary locks
      index: true, // Index for faster lookup
    },
  },
  { timestamps: true }
);

export const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
