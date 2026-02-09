import mongoose from "mongoose";

const busLiveLocationSchema = new mongoose.Schema(
  {
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
      unique: true, // one latest location per bus
      index: true,
    },

    busNumber: {
      type: String,
      required: true,
      unique: true, // ✅ ensures one record per busNumber
      uppercase: true,
      trim: true,
      index: true,
    },

    conductor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // GeoJSON location
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

    accuracy: { type: Number, default: null },
    speed: { type: Number, default: null }, // meters/sec
    heading: { type: Number, default: null }, // degrees
    recordedAt: { type: Date, default: Date.now, index: true },

    // ✅ TTL field: auto delete if no updates for 30 mins
    lastSeenAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 30, // 30 minutes
      index: true,
    },
  },
  { timestamps: true }
);

busLiveLocationSchema.index({ location: "2dsphere" });

export const BusLiveLocation =
  mongoose.models.BusLiveLocation ||
  mongoose.model("BusLiveLocation", busLiveLocationSchema);