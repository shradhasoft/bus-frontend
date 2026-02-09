// src/models/route.js
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
  { _id: false }
);

const stopSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, "City name must be at least 2 characters"],
      maxlength: [50, "City name cannot exceed 50 characters"],
    },
    arrivalTime: {
      type: timeSchema,
      validate: {
        validator: function (value) {
          if (!this.departureTime || !value) return true;
          const arrivalMinutes = value.hours * 60 + value.minutes;
          const departureMinutes =
            this.departureTime.hours * 60 + this.departureTime.minutes;
          return arrivalMinutes <= departureMinutes;
        },
        message: "Arrival time must be before departure time",
      },
    },
    departureTime: timeSchema,
    distanceFromOrigin: {
      type: Number,
      min: [0, "Distance cannot be negative"],
    },
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    routeCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    origin: {
      type: String,
      required: true,
      index: true,
      trim: true,
      minlength: [3, "Origin must be at least 3 characters"],
      maxlength: [50, "Origin cannot exceed 50 characters"],
    },
    destination: {
      type: String,
      required: true,
      index: true,
      trim: true,
      minlength: [3, "Destination must be at least 3 characters"],
      maxlength: [50, "Destination cannot exceed 50 characters"],
    },
    buses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bus",
      },
    ],
    stops: {
      type: [stopSchema],
      validate: {
        validator: function (stops) {
          // Validate stop sequence
          let lastDistance = -1;
          for (const stop of stops) {
            if (stop.distanceFromOrigin <= lastDistance) {
              return false;
            }
            lastDistance = stop.distanceFromOrigin;
          }
          return true;
        },
        message: "Stops must be in increasing distance order",
      },
    },
    distance: {
      type: Number,
      required: true,
      min: [1, "Distance must be at least 1 km"],
      max: [10000, "Distance cannot exceed 10,000 km"],
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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
  }
);

// Virtuals
routeSchema.virtual("busList", {
  ref: "Bus",
  localField: "buses",
  foreignField: "_id",
  options: {
    select: "busId busName busNumber operator totalSeats features",
  },
});

routeSchema.virtual("totalDurationMinutes").get(function () {
  return (this.duration?.hours || 0) * 60 + (this.duration?.minutes || 0);
});

routeSchema.virtual("formattedDuration").get(function () {
  if (!this.duration) return "";
  return `${this.duration.hours}h ${this.duration.minutes}m`;
});

routeSchema.virtual("busDetails", {
  ref: "Bus",
  localField: "buses",
  foreignField: "_id",
  justOne: false,
  options: {
    select: "busId busName busNumber operator totalSeats features",
  },
});

// Method to get reverse route information
routeSchema.methods.getReverseRoute = function () {
  const reverseStops = [...this.stops].reverse().map((stop, index) => ({
    city: stop.city,
    arrivalTime: stop.departureTime,
    departureTime: stop.arrivalTime,
    distanceFromOrigin: this.distance - stop.distanceFromOrigin,
  }));

  return {
    routeCode: this.routeCode + "-R",
    origin: this.destination,
    destination: this.origin,
    stops: reverseStops,
    distance: this.distance,
    duration: this.duration,
    cancellationPolicy: this.cancellationPolicy,
  };
};

// Indexes
routeSchema.index({ routeCode: 1 }, { unique: true });
routeSchema.index({ origin: 1, destination: 1 });
routeSchema.index({ distance: 1 });

// Pre-save hook for route code formatting
routeSchema.pre("save", function (next) {
  if (this.isModified("routeCode")) {
    this.routeCode = this.routeCode.toUpperCase().replace(/\s+/g, "-");
  }
  next();
});

export const Route =
  mongoose.models.Route || mongoose.model("Route", routeSchema);
