import mongoose from "mongoose";
import { TRACKING_CONFIG } from "../config/trackingConfig.js";

const busLocationHistorySchema = new mongoose.Schema(
  {
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
      index: true,
    },
    busNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    tripKey: {
      type: String,
      trim: true,
      index: true,
      default: null,
    },
    conductor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    seq: {
      type: Number,
      required: true,
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },
    accuracy: {
      type: Number,
      default: null,
    },
    speed: {
      type: Number,
      default: null,
    },
    heading: {
      type: Number,
      default: null,
    },
    recordedAt: {
      type: Date,
      required: true,
      index: true,
    },
    ingestedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    confidence: {
      type: String,
      enum: ["high", "low", "unknown"],
      default: "unknown",
    },
  },
  { timestamps: true },
);

busLocationHistorySchema.index({ location: "2dsphere" });
busLocationHistorySchema.index({ busNumber: 1, recordedAt: -1 });
busLocationHistorySchema.index({ tripKey: 1, recordedAt: -1 });
busLocationHistorySchema.index(
  { recordedAt: 1 },
  { expireAfterSeconds: TRACKING_CONFIG.HISTORY_TTL_DAYS * 24 * 60 * 60 },
);

export const BusLocationHistory =
  mongoose.models.BusLocationHistory ||
  mongoose.model("BusLocationHistory", busLocationHistorySchema);

