import mongoose from "mongoose";

const offerRedemptionSchema = new mongoose.Schema(
  {
    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["reserved", "redeemed", "released", "invalidated"],
      default: "reserved",
      index: true,
    },
    baseAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["INR", "USD", "EUR"],
      default: "INR",
    },
    context: {
      bus: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bus",
      },
      routeCode: {
        type: String,
        trim: true,
        uppercase: true,
      },
      travelDate: Date,
      boardingPoint: String,
      droppingPoint: String,
      direction: {
        type: String,
        enum: ["forward", "return"],
        default: "forward",
      },
      passengerCount: {
        type: Number,
        min: 1,
      },
    },
    reservedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    redeemedAt: Date,
    releasedAt: Date,
    releaseReason: String,
  },
  { timestamps: true }
);

offerRedemptionSchema.index({ offer: 1, user: 1, status: 1 });
offerRedemptionSchema.index({ status: 1, reservedAt: 1 });

export const OfferRedemption =
  mongoose.models.OfferRedemption ||
  mongoose.model("OfferRedemption", offerRedemptionSchema);
