import mongoose from "mongoose";

const SEAT_ID_REGEX = /^[A-Z]{1,10}-[0-9]{1,2}[A-Z]$/;

const formatDateKey = (dateValue) => {
  const date = new Date(dateValue);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatSegmentToken = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric.toFixed(3).replace(/\.?0+$/, "");
};

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
    segmentStartKm: {
      type: Number,
      min: [0, "Segment start cannot be negative"],
    },
    segmentEndKm: {
      type: Number,
      min: [0, "Segment end cannot be negative"],
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
    const baseKey = `${this.bus}_${formatDateKey(this.travelDate)}_${this.direction}`;
    const startToken = formatSegmentToken(this.segmentStartKm);
    const endToken = formatSegmentToken(this.segmentEndKm);
    const hasValidSegment =
      this.status === "HOLD" &&
      startToken &&
      endToken &&
      Number(this.segmentStartKm) < Number(this.segmentEndKm);

    this.tripKey = hasValidSegment
      ? `${baseKey}_${startToken}_${endToken}`
      : baseKey;
  }
  if (this.status === "HOLD" && !this.expiresAt) {
    this.invalidate("expiresAt", "expiresAt is required for HOLD status");
  }
  if (this.status === "BOOKED") {
    this.expiresAt = null;
  }
  if (
    Number.isFinite(this.segmentStartKm) &&
    Number.isFinite(this.segmentEndKm) &&
    Number(this.segmentStartKm) >= Number(this.segmentEndKm)
  ) {
    this.invalidate(
      "segmentEndKm",
      "segmentEndKm must be greater than segmentStartKm",
    );
  }
  next();
});

export const SeatHold =
  mongoose.models.SeatHold || mongoose.model("SeatHold", seatHoldSchema);
