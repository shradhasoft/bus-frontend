import { body, validationResult, query, param } from "express-validator";
import mongoose from "mongoose";

// Helper to validate time format
const validateTimeFormat = (value) => {
  if (typeof value === "object" && value !== null) {
    const { hours, minutes } = value;
    return (
      typeof hours === "number" &&
      typeof minutes === "number" &&
      hours >= 0 &&
      hours <= 23 &&
      minutes >= 0 &&
      minutes <= 59
    );
  }
  if (typeof value === "string") {
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    return timeRegex.test(value);
  }
  return false;
};

// Bus creation validation
export const validateBusCreation = [
  body("busName").trim().notEmpty().withMessage("Bus name is required"),
  body("busNumber").trim().notEmpty().withMessage("Bus number is required"),
  body("operator").trim().notEmpty().withMessage("Operator is required"),
  body("totalSeats")
    .isInt({ min: 1 })
    .withMessage("Total seats must be a positive integer"),
  body("features.busType")
    .isIn([
      "Sleeper",
      "Seater",
      "Semi-Sleeper",
      "Luxury",
      "AC",
      "Non-AC",
      "Volvo",
    ])
    .withMessage("Invalid bus type"),
  body("seatLayout").isArray().withMessage("Seat layout must be an array"),
  body("seatLayout.*").isArray().withMessage("Each row must be an array"),
  body("seatLayout.*.*")
    .isInt({ min: 0 })
    .withMessage("Seat numbers must be positive integers"),
  body("route")
    .custom(async (value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid route ID format");
      }
      const route = await mongoose.model("Route").findById(value);
      if (!route) {
        throw new Error(`Route with ID ${value} not found`);
      }
      return true;
    })
    .withMessage("Invalid route ID"),
  // Forward trip timing validation
  body("forwardTrip").isObject().withMessage("Forward trip timing is required"),
  body("forwardTrip.departureTime")
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid forward departure time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("forwardTrip.arrivalTime")
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid forward arrival time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  // Return trip timing validation
  body("returnTrip").isObject().withMessage("Return trip timing is required"),
  body("returnTrip.departureTime")
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid return departure time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("returnTrip.arrivalTime")
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid return arrival time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("farePerKm")
    .isFloat({ min: 0 })
    .withMessage("farePerKm must be a positive number"),
  body("operatingDays")
    .isArray({ min: 1 })
    .withMessage("At least one operating day is required"),
  body("operatingDays.*")
    .isIn([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ])
    .withMessage("Invalid operating day"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          field: err.param,
          message: err.msg,
        })),
      });
    }
    next();
  },
];

export const validateBusUpdate = [
  body("busName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Bus name cannot be empty"),
  body("busNumber")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Bus number cannot be empty"),
  body("operator")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Operator cannot be empty"),
  body("totalSeats")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Total seats must be a positive integer"),
  body("features.busType")
    .optional()
    .isIn([
      "Sleeper",
      "Seater",
      "Semi-Sleeper",
      "Luxury",
      "AC",
      "Non-AC",
      "Volvo",
    ])
    .withMessage("Invalid bus type"),
  body("seatLayout")
    .optional()
    .isArray()
    .withMessage("Seat layout must be an array"),
  body("seatLayout.*")
    .optional()
    .isArray()
    .withMessage("Each row must be an array"),
  body("seatLayout.*.*")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Seat numbers must be positive integers"),
  body("route")
    .optional()
    .custom(async (value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid route ID format");
      }
      const route = await mongoose.model("Route").findById(value);
      if (!route) {
        throw new Error(`Route with ID ${value} not found`);
      }
      return true;
    })
    .withMessage("Invalid route ID"),
  // Forward trip timing validation
  body("forwardTrip.departureTime")
    .optional()
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid forward departure time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("forwardTrip.arrivalTime")
    .optional()
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid forward arrival time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  // Return trip timing validation
  body("returnTrip.departureTime")
    .optional()
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid return departure time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("returnTrip.arrivalTime")
    .optional()
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid return arrival time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("farePerKm")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("farePerKm must be a positive number"),
  body("operatingDays")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one operating day is required"),
  body("operatingDays.*")
    .optional()
    .isIn([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ])
    .withMessage("Invalid operating day"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          field: err.param,
          message: err.msg,
        })),
      });
    }
    next();
  },
];

// Route creation validation
export const validateRouteCreation = [
  body("routeCode")
    .trim()
    .notEmpty()
    .withMessage("Route code is required")
    .isLength({ min: 3, max: 10 })
    .withMessage("Route code must be 3-10 characters"),
  body("origin")
    .trim()
    .notEmpty()
    .withMessage("Origin is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("Origin must be 3-50 characters"),
  body("destination")
    .trim()
    .notEmpty()
    .withMessage("Destination is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("Destination must be 3-50 characters"),
  body("stops").optional().isArray().withMessage("Stops must be an array"),
  body("stops.*.city")
    .if(body("stops").exists())
    .notEmpty()
    .withMessage("Stop city is required"),
  body("stops.*.arrivalTime")
    .if(body("stops").exists())
    .optional()
    .custom((value) => !value || validateTimeFormat(value))
    .withMessage(
      "Invalid arrival time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("stops.*.departureTime")
    .if(body("stops").exists())
    .optional()
    .custom((value) => !value || validateTimeFormat(value))
    .withMessage(
      "Invalid departure time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("stops.*.distanceFromOrigin")
    .if(body("stops").exists())
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Distance must be a positive number"),
  body("cancellationPolicy.before24h")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Cancellation fee must be between 0-100%"),
  body("cancellationPolicy.before12h")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Cancellation fee must be between 0-100%"),
  body("cancellationPolicy.noShow")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Cancellation fee must be between 0-100%"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          field: err.param,
          message: err.msg,
        })),
        code: "VALIDATION_ERROR",
      });
    }
    next();
  },
];

export const validateRouteUpdate = [
  body("routeCode")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Route code cannot be empty")
    .isLength({ min: 3, max: 10 })
    .withMessage("Route code must be 3-10 characters"),
  body("origin")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Origin cannot be empty")
    .isLength({ min: 3, max: 50 })
    .withMessage("Origin must be 3-50 characters"),
  body("destination")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Destination cannot be empty")
    .isLength({ min: 3, max: 50 })
    .withMessage("Destination must be 3-50 characters"),
  body("stops").optional().isArray().withMessage("Stops must be an array"),
  body("stops.*.city")
    .if(body("stops").exists())
    .notEmpty()
    .withMessage("Stop city is required"),
  body("stops.*.arrivalTime")
    .if(body("stops").exists())
    .optional()
    .custom((value) => !value || validateTimeFormat(value))
    .withMessage(
      "Invalid arrival time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("stops.*.departureTime")
    .if(body("stops").exists())
    .optional()
    .custom((value) => !value || validateTimeFormat(value))
    .withMessage(
      "Invalid departure time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("stops.*.distanceFromOrigin")
    .if(body("stops").exists())
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Distance must be a positive number"),
  body("cancellationPolicy.before24h")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Cancellation fee must be between 0-100%"),
  body("cancellationPolicy.before12h")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Cancellation fee must be between 0-100%"),
  body("cancellationPolicy.noShow")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Cancellation fee must be between 0-100%"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          field: err.param,
          message: err.msg,
        })),
        code: "VALIDATION_ERROR",
      });
    }
    next();
  },
];

export const validateBusSearch = [
  query("origin").trim().notEmpty().withMessage("Origin is required"),
  query("destination").trim().notEmpty().withMessage("Destination is required"),
  query("date")
    .trim()
    .notEmpty()
    .withMessage("Date is required")
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Invalid date format. Use YYYY-MM-DD")
    .custom((value) => {
      const date = new Date(value);
      return date >= new Date(new Date().setDate(new Date().getDate() - 1));
    })
    .withMessage("Date cannot be in the past"),
  query("direction")
    .optional()
    .isIn(["forward", "return", "both"])
    .withMessage("Direction must be 'forward', 'return', or 'both'"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          param: err.param,
          message: err.msg,
        })),
        code: "VALIDATION_ERROR",
      });
    }
    next();
  },
];

// Booking creation validation
// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
      code: "VALIDATION_ERROR",
    });
  }
  next();
};

// Existing validation middleware...
export const validateBookingCreation = [
  body("busId")
    .notEmpty()
    .withMessage("Bus ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid bus ID format");
      }
      return true;
    }),
  body("travelDate")
    .notEmpty()
    .withMessage("Travel date is required")
    .isISO8601()
    .withMessage("Invalid date format")
    .custom((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        throw new Error("Travel date cannot be in the past");
      }
      return true;
    }),
  body("passengers")
    .isArray({ min: 1 })
    .withMessage("At least one passenger is required")
    .custom((passengers) => {
      if (passengers.length > 10) {
        throw new Error("Maximum 10 passengers allowed");
      }
      return true;
    }),
  body("passengers.*.name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Passenger name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Passenger name must contain only letters and spaces"),
  body("passengers.*.age")
    .isInt({ min: 1, max: 120 })
    .withMessage("Passenger age must be between 1 and 120"),
  body("passengers.*.gender")
    .isIn(["male", "female", "other"])
    .withMessage("Invalid gender"),
  body("passengers.*.seatNumber")
    .isInt({ min: 1 })
    .withMessage("Invalid seat number"),
  body("passengers.*.mobileNumber")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Invalid mobile number format"),
  body("passengers.*.identification.type")
    .isIn(["aadhar", "passport", "dl"])
    .withMessage("Invalid identification type"),
  body("passengers.*.identification.number")
    .trim()
    .isLength({ min: 8, max: 20 })
    .withMessage("Identification number must be between 8 and 20 characters"),
  body("boardingPoint")
    .trim()
    .notEmpty()
    .withMessage("Boarding point is required"),
  body("droppingPoint")
    .trim()
    .notEmpty()
    .withMessage("Dropping point is required"),
  body("sessionId")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Session ID cannot be empty if provided"),
  handleValidationErrors,
];

// New validation middleware for seat locking
export const validateSeatLocking = [
  body("busId")
    .notEmpty()
    .withMessage("Bus ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid bus ID format");
      }
      return true;
    }),
  body("travelDate")
    .notEmpty()
    .withMessage("Travel date is required")
    .isISO8601()
    .withMessage("Invalid date format")
    .custom((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        throw new Error("Travel date cannot be in the past");
      }
      return true;
    }),
  body("seatNumbers")
    .isArray({ min: 1, max: 10 })
    .withMessage("Seat numbers must be an array with 1-10 seats")
    .custom((seatNumbers) => {
      // Check if all elements are positive integers
      const areValidNumbers = seatNumbers.every(
        (seat) => Number.isInteger(seat) && seat > 0
      );
      if (!areValidNumbers) {
        throw new Error("All seat numbers must be positive integers");
      }

      // Check for duplicates
      const uniqueSeats = new Set(seatNumbers);
      if (uniqueSeats.size !== seatNumbers.length) {
        throw new Error("Duplicate seat numbers are not allowed");
      }

      return true;
    }),
  body("sessionId")
    .optional()
    .trim()
    .isLength({ min: 10, max: 100 })
    .withMessage("Session ID must be between 10 and 100 characters"),
  handleValidationErrors,
];

export const validateSeatRelease = [
  body("busId")
    .notEmpty()
    .withMessage("Bus ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid bus ID format");
      }
      return true;
    }),
  body("travelDate")
    .notEmpty()
    .withMessage("Travel date is required")
    .isISO8601()
    .withMessage("Invalid date format"),
  body("sessionId")
    .notEmpty()
    .withMessage("Session ID is required")
    .trim()
    .isLength({ min: 10, max: 100 })
    .withMessage("Session ID must be between 10 and 100 characters"),
  body("seatNumbers")
    .optional()
    .isArray()
    .withMessage("Seat numbers must be an array")
    .custom((seatNumbers) => {
      if (seatNumbers && seatNumbers.length > 0) {
        const areValidNumbers = seatNumbers.every(
          (seat) => Number.isInteger(seat) && seat > 0
        );
        if (!areValidNumbers) {
          throw new Error("All seat numbers must be positive integers");
        }
      }
      return true;
    }),
  handleValidationErrors,
];

// Cancel Booking Validation
export const validateBookingCancellation = [
  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          param: err.param,
          message: err.msg,
        })),
        code: "VALIDATION_ERROR",
      });
    }
    next();
  },
];

// Validation for Travel Date Change
export const validateTravelDateChange = [
  body("newTravelDate")
    .notEmpty()
    .withMessage("New travel date is required")
    .isISO8601()
    .withMessage("Invalid date format. Use YYYY-MM-DD")
    .custom((value) => {
      const date = new Date(value);
      return date >= new Date(new Date().setDate(new Date().getDate() - 1));
    })
    .withMessage("Date cannot be in the past"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          param: err.param,
          message: err.msg,
        })),
        code: "VALIDATION_ERROR",
      });
    }
    next();
  },
];

// Validation for Offer Creation
export const validateOfferCreation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 100 })
    .withMessage("Title cannot exceed 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("code")
    .trim()
    .notEmpty()
    .withMessage("Code is required")
    .isLength({ max: 20 })
    .withMessage("Code cannot exceed 20 characters")
    .toUpperCase(),

  body("discountType")
    .isIn(["percentage", "fixed"])
    .withMessage("Invalid discount type"),

  body("discountValue")
    .isFloat({ min: 0 })
    .withMessage("Discount value must be a positive number"),

  body("minOrderAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Min order amount must be a positive number"),

  body("maxDiscountAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Max discount amount must be a positive number"),

  body("validFrom")
    .optional()
    .isISO8601()
    .withMessage("Invalid valid from date format"),

  body("validUntil")
    .isISO8601()
    .withMessage("Invalid valid until date format")
    .custom((value, { req }) => {
      const validUntil = new Date(value);
      const validFrom = req.body.validFrom
        ? new Date(req.body.validFrom)
        : new Date();
      return validUntil > validFrom;
    })
    .withMessage("Valid until must be after valid from"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("Active status must be boolean"),

  body("applicableFor")
    .optional()
    .isIn(["all", "routes", "buses", "users"])
    .withMessage("Invalid applicable for value"),

  body("specificRoutes")
    .optional()
    .isArray()
    .withMessage("Specific routes must be an array"),

  body("specificRoutes.*").isMongoId().withMessage("Invalid route ID format"),

  body("specificBuses")
    .optional()
    .isArray()
    .withMessage("Specific buses must be an array"),

  body("specificBuses.*").isMongoId().withMessage("Invalid bus ID format"),

  body("specificUsers")
    .optional()
    .isArray()
    .withMessage("Specific users must be an array"),

  body("specificUsers.*").isMongoId().withMessage("Invalid user ID format"),

  body("usageLimit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Usage limit must be at least 1"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          param: err.param,
          message: err.msg,
        })),
        code: "VALIDATION_ERROR",
      });
    }
    next();
  },
];

// Validation for Update Offer
export const validateOfferUpdate = [
  param("id").isMongoId().withMessage("Invalid offer ID format"),

  body("title")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Title cannot exceed 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("code")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Code cannot exceed 20 characters")
    .toUpperCase(),

  body("discountType")
    .optional()
    .isIn(["percentage", "fixed"])
    .withMessage("Invalid discount type"),

  body("discountValue")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discount value must be a positive number"),

  body("minOrderAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Min order amount must be a positive number"),

  body("maxDiscountAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Max discount amount must be a positive number"),

  body("validFrom")
    .optional()
    .isISO8601()
    .withMessage("Invalid valid from date format"),

  body("validUntil")
    .optional()
    .isISO8601()
    .withMessage("Invalid valid until date format")
    .custom((value, { req }) => {
      if (req.body.validFrom) {
        return new Date(value) > new Date(req.body.validFrom);
      }
      return true;
    })
    .withMessage("Valid until must be after valid from"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("Active status must be boolean"),

  body("applicableFor")
    .optional()
    .isIn(["all", "routes", "buses", "users"])
    .withMessage("Invalid applicable for value"),

  body("specificRoutes")
    .optional()
    .isArray()
    .withMessage("Specific routes must be an array"),

  body("specificRoutes.*")
    .optional()
    .isMongoId()
    .withMessage("Invalid route ID format"),

  body("specificBuses")
    .optional()
    .isArray()
    .withMessage("Specific buses must be an array"),

  body("specificBuses.*")
    .optional()
    .isMongoId()
    .withMessage("Invalid bus ID format"),

  body("specificUsers")
    .optional()
    .isArray()
    .withMessage("Specific users must be an array"),

  body("specificUsers.*")
    .optional()
    .isMongoId()
    .withMessage("Invalid user ID format"),

  body("usageLimit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Usage limit must be at least 1"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((err) => ({
          param: err.param,
          message: err.msg,
        })),
        code: "VALIDATION_ERROR",
      });
    }
    next();
  },
];
