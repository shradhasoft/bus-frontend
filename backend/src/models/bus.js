// src/models/bus.js
import mongoose from "mongoose";

const timeSchema = new mongoose.Schema(
  {
    hours: {
      type: Number,
      required: true,
      min: [0, "Hours cannot be negative"],
      max: [23, "Hours cannot exceed 23"],
    },
    minutes: {
      type: Number,
      required: true,
      min: [0, "Minutes cannot be negative"],
      max: [59, "Minutes cannot exceed 59"],
    },
  },
  { _id: false },
);

const busSchema = new mongoose.Schema(
  {
    busName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Bus name cannot exceed 100 characters"],
    },
    busId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    busNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    conductor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    operator: {
      type: String,
      required: true,
      trim: true,
    },
    totalSeats: {
      type: Number,
      required: true,
      min: [1, "At least 1 seat required"],
      max: [100, "Maximum 100 seats allowed"],
    },
    amenities: {
      ac: { type: Boolean, default: false },
      wifi: { type: Boolean, default: false },
      chargingPoints: { type: Boolean, default: false },
      toilet: { type: Boolean, default: false },
      waterBottle: { type: Boolean, default: false },
      blanket: { type: Boolean, default: false },
      entertainment: { type: Boolean, default: false },
    },
    features: {
      busType: {
        type: String,
        enum: [
          "Sleeper",
          "Seater",
          "Semi-Sleeper",
          "Luxury",
          "AC",
          "Non-AC",
          "Volvo",
        ],
        required: true,
        trim: true,
      },
      deckCount: {
        type: Number,
        enum: [1, 2],
        default: 1,
      },
      gpsTracking: { type: Boolean, default: false },
      emergencyExit: { type: Boolean, default: false },
      cctv: { type: Boolean, default: false },
      wheelchairAccessible: { type: Boolean, default: false },
    },
    seatLayout: {
      type: [[Number]],
      required: true,
      validate: {
        validator: (layout) => true,
        message: "Invalid seat layout",
      },
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      required: true,
      index: true,
    },
    forwardTrip: {
      departureTime: {
        type: timeSchema,
        required: true,
      },
      arrivalTime: {
        type: timeSchema,
        required: true,
      },
    },
    returnTrip: {
      departureTime: {
        type: timeSchema,
        required: true,
      },
      arrivalTime: {
        type: timeSchema,
        required: true,
      },
    },
    farePerKm: {
      type: Number,
      required: true,
      min: [0.01, "Fare per km must be at least 0.01"],
    },
    model: {
      type: String,
      trim: true,
    },
    year: {
      type: Number,
      min: [1990, "Invalid year"],
      max: [new Date().getFullYear() + 1, "Invalid year"],
    },
    insurance: {
      provider: { type: String, trim: true },
      policyNumber: { type: String, trim: true },
      expiry: { type: Date },
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    bookedSeats: [
      {
        seatNumber: {
          type: Number,
          required: true,
          min: [0, "Invalid seat number"],
        },
        bookingId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Booking",
        },
        bookingDate: {
          type: Date,
          default: Date.now,
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
      },
    ],
    temporaryLocks: [
      {
        seatNumber: {
          type: Number,
          required: true,
        },
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
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
        lockedAt: {
          type: Date,
          default: Date.now,
        },
        expiresAt: {
          type: Date,
          required: true,
        },
        sessionId: {
          type: String,
          required: true,
        },
      },
    ],
    availableSeats: {
      type: Number,
      default: function () {
        return this.totalSeats;
      },
      min: [0, "Available seats cannot be negative"],
    },
    ratings: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    reviews: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        rating: {
          type: Number,
          min: 0,
          max: 5,
          required: true,
        },
        comment: {
          type: String,
          trim: true,
          maxlength: [500, "Comment cannot exceed 500 characters"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    operatingDays: {
      type: [String],
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      required: true,
      validate: {
        validator: (days) =>
          days.length > 0 && new Set(days).size === days.length,
        message: "Duplicate or empty operating days",
      },
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    id: false,
  },
);

// Virtual for route details
busSchema.virtual("routeDetails", {
  ref: "Route",
  localField: "route",
  foreignField: "_id",
  justOne: true,
  options: {
    select: "routeCode origin destination distance duration stops",
  },
});

busSchema.methods.getUnavailableSeats = function (
  travelDate,
  direction = "forward",
) {
  const travelDateObj = new Date(travelDate);
  const now = new Date();

  // Get permanently booked seats for this direction
  const bookedSeats = this.bookedSeats
    .filter(
      (bs) =>
        bs.travelDate.getTime() === travelDateObj.getTime() &&
        bs.direction === direction,
    )
    .map((bs) => bs.seatNumber);

  // Get temporarily locked seats (not expired) for this direction
  const lockedSeats = this.temporaryLocks
    .filter(
      (lock) =>
        lock.travelDate.getTime() === travelDateObj.getTime() &&
        lock.direction === direction &&
        lock.expiresAt > now,
    )
    .map((lock) => lock.seatNumber);

  // Combine and return unique seats
  return [...new Set([...bookedSeats, ...lockedSeats])];
};

busSchema.methods.areSeatsAvailable = function (
  seatNumbers,
  travelDate,
  direction = "forward",
  excludeUserId = null,
  excludeSessionId = null,
) {
  const unavailableSeats = this.getUnavailableSeats(travelDate, direction);
  const travelDateObj = new Date(travelDate);
  const now = new Date();

  // If excluding a user/session, remove their locks from unavailable seats
  if (excludeUserId || excludeSessionId) {
    const userLockedSeats = this.temporaryLocks
      .filter(
        (lock) =>
          lock.travelDate.getTime() === travelDateObj.getTime() &&
          lock.direction === direction &&
          lock.expiresAt > now &&
          ((excludeUserId &&
            lock.userId.toString() === excludeUserId.toString()) ||
            (excludeSessionId && lock.sessionId === excludeSessionId)),
      )
      .map((lock) => lock.seatNumber);

    // Remove user's locked seats from unavailable seats
    const filteredUnavailable = unavailableSeats.filter(
      (seat) => !userLockedSeats.includes(seat),
    );

    // Check if any requested seat is in the filtered unavailable list
    const conflictingSeats = seatNumbers.filter(
      (seat) =>
        filteredUnavailable.includes(seat) ||
        !this.seatLayout.flat().includes(seat),
    );

    return {
      available: conflictingSeats.length === 0,
      conflictingSeats,
    };
  }

  // Check if any requested seat is unavailable or doesn't exist
  const conflictingSeats = seatNumbers.filter(
    (seat) =>
      unavailableSeats.includes(seat) || !this.seatLayout.flat().includes(seat),
  );

  return {
    available: conflictingSeats.length === 0,
    conflictingSeats,
  };
};

busSchema.methods.getTimingForDirection = function (direction = "forward") {
  return direction === "forward" ? this.forwardTrip : this.returnTrip;
};

busSchema.methods.calculateFare = function (
  boardingStopIndex,
  droppingStopIndex,
  direction = "forward",
) {
  // This method should be called with route information
  // The actual fare calculation will be done in the controller with route data
  return this.farePerKm;
};

export const Bus = mongoose.models.Bus || mongoose.model("Bus", busSchema);
