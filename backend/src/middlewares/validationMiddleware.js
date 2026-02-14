import { body, validationResult, query, param } from "express-validator";
import mongoose from "mongoose";
import { validateSeatLayoutBlueprint } from "../models/bus.js";

const SEAT_ID_REGEX = /^[A-Z]{1,10}-[0-9]{1,2}[A-Z]$/;
const SEAT_LABEL_REGEX = /^[0-9]{1,2}[A-Z]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeSeatToken = (value) =>
  String(value || "").trim().toUpperCase();

const isSeatTokenValid = (value) => {
  const token = normalizeSeatToken(value);
  return SEAT_ID_REGEX.test(token) || SEAT_LABEL_REGEX.test(token);
};

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
  body("busOwnerEmail")
    .custom((value, { req }) => {
      const role = req.user?.role;
      if (role === "owner") {
        return true;
      }
      if (!value || !EMAIL_REGEX.test(String(value).trim().toLowerCase())) {
        throw new Error("Valid bus owner email is required");
      }
      return true;
    }),
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
  body("seatLayout")
    .notEmpty()
    .withMessage("Seat layout is required")
    .custom((value, { req }) => {
      const { valid, errors } = validateSeatLayoutBlueprint(
        value,
        req.body.totalSeats
      );
      if (!valid) {
        throw new Error(errors[0] || "Invalid seat layout");
      }
      return true;
    }),
  body("route").isObject().withMessage("Route is required"),
  body("route.routeCode")
    .trim()
    .notEmpty()
    .withMessage("Route code is required")
    .isLength({ min: 3, max: 10 })
    .withMessage("Route code must be 3-10 characters"),
  body("route.origin")
    .trim()
    .notEmpty()
    .withMessage("Origin is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("Origin must be 3-50 characters"),
  body("route.destination")
    .trim()
    .notEmpty()
    .withMessage("Destination is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("Destination must be 3-50 characters"),
  body("route.distance")
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage("Distance must be between 0 and 10,000 km"),
  body("route.duration.hours")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Duration hours must be 0-100"),
  body("route.duration.minutes")
    .optional()
    .isInt({ min: 0, max: 59 })
    .withMessage("Duration minutes must be 0-59"),
  body("route.cancellationPolicy.before24h")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Cancellation fee must be between 0-100%"),
  body("route.cancellationPolicy.before12h")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Cancellation fee must be between 0-100%"),
  body("route.cancellationPolicy.noShow")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Cancellation fee must be between 0-100%"),
  body("route.stops")
    .isArray({ min: 2 })
    .withMessage("Route stops must be an array with at least 2 stops"),
  body("route.stops.*.city")
    .notEmpty()
    .withMessage("Stop city is required"),
  body("route.stops.*.location")
    .isObject()
    .withMessage("Stop location is required"),
  body("route.stops.*.location.lat")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Stop latitude must be between -90 and 90"),
  body("route.stops.*.location.lng")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Stop longitude must be between -180 and 180"),
  body("route.stops.*.upTrip")
    .isObject()
    .withMessage("Up trip details are required"),
  body("route.stops.*.upTrip.arrivalTime")
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid up trip arrival time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("route.stops.*.upTrip.departureTime")
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid up trip departure time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("route.stops.*.downTrip")
    .isObject()
    .withMessage("Down trip details are required"),
  body("route.stops.*.downTrip.arrivalTime")
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid down trip arrival time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("route.stops.*.downTrip.departureTime")
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid down trip departure time format. Use HH:MM or {hours: X, minutes: Y}"
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
  body("busOwnerEmail")
    .optional()
    .custom((value, { req }) => {
      if (!value) return true;
      if (!EMAIL_REGEX.test(String(value).trim().toLowerCase())) {
        throw new Error("Invalid bus owner email");
      }
      if (req.user?.role === "owner" && value !== req.user.email) {
        throw new Error("Owners cannot change bus owner email");
      }
      return true;
    }),
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
    .custom((value, { req }) => {
      const { valid, errors } = validateSeatLayoutBlueprint(
        value,
        req.body.totalSeats
      );
      if (!valid) {
        throw new Error(errors[0] || "Invalid seat layout");
      }
      return true;
    }),
  body("route")
    .optional()
    .isObject()
    .withMessage("Route must be an object"),
  body("route.routeCode")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Route code cannot be empty")
    .isLength({ min: 3, max: 10 })
    .withMessage("Route code must be 3-10 characters"),
  body("route.origin")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Origin cannot be empty")
    .isLength({ min: 3, max: 50 })
    .withMessage("Origin must be 3-50 characters"),
  body("route.destination")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Destination cannot be empty")
    .isLength({ min: 3, max: 50 })
    .withMessage("Destination must be 3-50 characters"),
  body("route.distance")
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage("Distance must be between 0 and 10,000 km"),
  body("route.duration.hours")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Duration hours must be 0-100"),
  body("route.duration.minutes")
    .optional()
    .isInt({ min: 0, max: 59 })
    .withMessage("Duration minutes must be 0-59"),
  body("route.cancellationPolicy.before24h")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Cancellation fee must be between 0-100%"),
  body("route.cancellationPolicy.before12h")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Cancellation fee must be between 0-100%"),
  body("route.cancellationPolicy.noShow")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Cancellation fee must be between 0-100%"),
  body("route.stops")
    .optional()
    .isArray({ min: 2 })
    .withMessage("Route stops must be an array with at least 2 stops"),
  body("route.stops.*.city")
    .if(body("route.stops").exists())
    .notEmpty()
    .withMessage("Stop city is required"),
  body("route.stops.*.location")
    .if(body("route.stops").exists())
    .isObject()
    .withMessage("Stop location is required"),
  body("route.stops.*.location.lat")
    .if(body("route.stops").exists())
    .isFloat({ min: -90, max: 90 })
    .withMessage("Stop latitude must be between -90 and 90"),
  body("route.stops.*.location.lng")
    .if(body("route.stops").exists())
    .isFloat({ min: -180, max: 180 })
    .withMessage("Stop longitude must be between -180 and 180"),
  body("route.stops.*.upTrip")
    .if(body("route.stops").exists())
    .isObject()
    .withMessage("Up trip details are required"),
  body("route.stops.*.upTrip.arrivalTime")
    .if(body("route.stops").exists())
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid up trip arrival time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("route.stops.*.upTrip.departureTime")
    .if(body("route.stops").exists())
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid up trip departure time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("route.stops.*.downTrip")
    .if(body("route.stops").exists())
    .isObject()
    .withMessage("Down trip details are required"),
  body("route.stops.*.downTrip.arrivalTime")
    .if(body("route.stops").exists())
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid down trip arrival time format. Use HH:MM or {hours: X, minutes: Y}"
    ),
  body("route.stops.*.downTrip.departureTime")
    .if(body("route.stops").exists())
    .custom((value) => validateTimeFormat(value))
    .withMessage(
      "Invalid down trip departure time format. Use HH:MM or {hours: X, minutes: Y}"
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
    .custom((value) => {
      if (!isSeatTokenValid(value)) {
        throw new Error("Invalid seat identifier");
      }
      return true;
    }),
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
    .trim()
    .notEmpty()
    .withMessage("Session ID is required"),
  body("offerCode")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage("Offer code must be between 2 and 20 characters")
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Offer code may only contain letters, numbers, _ and -"),
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
      const normalized = seatNumbers.map((seat) => normalizeSeatToken(seat));
      const areValidTokens = normalized.every((seat) => isSeatTokenValid(seat));
      if (!areValidTokens) {
        throw new Error("All seat identifiers must be valid");
      }

      // Check for duplicates
      const uniqueSeats = new Set(normalized);
      if (uniqueSeats.size !== normalized.length) {
        throw new Error("Duplicate seat identifiers are not allowed");
      }

      return true;
    }),
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
        const normalized = seatNumbers.map((seat) => normalizeSeatToken(seat));
        const areValidTokens = normalized.every((seat) =>
          isSeatTokenValid(seat)
        );
        if (!areValidTokens) {
          throw new Error("All seat identifiers must be valid");
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

  body("specificRoutes.*")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Route code is required")
    .isLength({ min: 3, max: 10 })
    .withMessage("Route code must be 3-10 characters")
    .matches(/^[A-Za-z0-9-]+$/)
    .withMessage("Route code may only contain letters, numbers, and dashes"),

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
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Route code is required")
    .isLength({ min: 3, max: 10 })
    .withMessage("Route code must be 3-10 characters")
    .matches(/^[A-Za-z0-9-]+$/)
    .withMessage("Route code may only contain letters, numbers, and dashes"),

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
