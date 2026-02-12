import mongoose from "mongoose";

const SEAT_ID_REGEX = /^[A-Z]{1,10}-[0-9]{1,2}[A-Z]$/;

const seatHoldSchema = new mongoose.Schema(
  {
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
      index: true,
    },
    tripKey: {
      type: String,
      required: true,
      index: true,
    },
    travelDate: {
      type: Date,
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ["forward", "return"],
      required: true,
      index: true,
    },
    seatId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [SEAT_ID_REGEX, "Invalid seat identifier"],
    },
    status: {
      type: String,
      enum: ["HOLD", "BOOKED", "CANCELLED"],
      required: true,
      default: "HOLD",
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    sessionId: {
      type: String,
      index: true,
      trim: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    metadata: {
      type: Object,
      default: undefined,
    },
  },
  { timestamps: true }
);

seatHoldSchema.index(
  { tripKey: 1, seatId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["HOLD", "BOOKED"] } },
  }
);

seatHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

seatHoldSchema.pre("validate", function (next) {
  if (!this.tripKey && this.bus && this.travelDate && this.direction) {
    const date = new Date(this.travelDate);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    this.tripKey = `${this.bus}_${year}-${month}-${day}_${this.direction}`;
  }
  if (this.status === "HOLD" && !this.expiresAt) {
    this.invalidate("expiresAt", "expiresAt is required for HOLD status");
  }
  if (this.status === "BOOKED") {
    this.expiresAt = null;
  }
  next();
});

export const SeatHold =
  mongoose.models.SeatHold || mongoose.model("SeatHold", seatHoldSchema);
