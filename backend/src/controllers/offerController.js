import mongoose from "mongoose";
import { Offer } from "../models/offer.js";
import { OfferRedemption } from "../models/offerRedemption.js";
import { Bus } from "../models/bus.js";
import { User } from "../models/user.js";
import {
  evaluateOfferEligibility,
  formatOfferRecord,
  getOfferStatus,
  normalizeOfferCode,
} from "../services/offerService.js";

const MAX_ADMIN_LIMIT = 100;
const MAX_PUBLIC_LIMIT = 50;
const SEARCH_MAX_LENGTH = 80;
const DEFAULT_CURRENCY = "INR";

const OFFER_DISCOUNT_TYPES = new Set(["percentage", "fixed"]);
const OFFER_APPLICABILITY = new Set(["all", "routes", "buses", "users"]);
const ADMIN_STATUS_SET = new Set([
  "active",
  "upcoming",
  "expired",
  "inactive",
  "deleted",
  "all",
]);

const OFFER_SORT_OPTIONS = {
  createdAt: { createdAt: 1 },
  "-createdAt": { createdAt: -1 },
  validFrom: { validFrom: 1, createdAt: -1 },
  "-validFrom": { validFrom: -1, createdAt: -1 },
  validUntil: { validUntil: 1, createdAt: -1 },
  "-validUntil": { validUntil: -1, createdAt: -1 },
  usedCount: { usedCount: 1, createdAt: -1 },
  "-usedCount": { usedCount: -1, createdAt: -1 },
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const appendAndCondition = (base, condition) => {
  if (!condition || Object.keys(condition).length === 0) return base;
  if (!base || Object.keys(base).length === 0) return condition;
  return { $and: [base, condition] };
};

const normalizeRouteCodes = (routes) => {
  if (!Array.isArray(routes)) return [];
  return [
    ...new Set(
      routes.map((code) => normalizeOfferCode(code)).filter(Boolean)
    ),
  ];
};

const normalizeIdArray = (ids) => {
  if (!Array.isArray(ids)) return [];
  const values = ids
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const unique = [...new Set(values)];
  return unique;
};

const parsePositiveNumber = (value, field, { allowZero = true } = {}) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || (!allowZero && numeric === 0)) {
    const error = new Error(`${field} must be a valid positive number`);
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }
  return Number.parseFloat(numeric.toFixed(2));
};

const parseOptionalNumber = (value, field, options = {}) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return parsePositiveNumber(value, field, options);
};

const parseOptionalInt = (value, field) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    const error = new Error(`${field} must be a non-negative integer`);
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }
  return numeric;
};

const parseOptionalBoolean = (value, field) => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  const error = new Error(`${field} must be boolean`);
  error.code = "VALIDATION_ERROR";
  error.statusCode = 400;
  throw error;
};

const parseDateOrThrow = (value, field, { required = false } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) {
      const error = new Error(`${field} is required`);
      error.code = "VALIDATION_ERROR";
      error.statusCode = 400;
      throw error;
    }
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${field} is invalid`);
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }
  return parsed;
};

const parsePagination = (rawPage, rawLimit, maxLimit) => {
  const page = Number.parseInt(String(rawPage || "1"), 10);
  const limit = Number.parseInt(String(rawLimit || "20"), 10);

  if (!Number.isInteger(page) || page < 1) {
    const error = new Error("Invalid page number");
    error.code = "INVALID_PAGE";
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    const error = new Error("Invalid limit value");
    error.code = "INVALID_LIMIT";
    error.statusCode = 400;
    throw error;
  }

  if (limit > maxLimit) {
    const error = new Error(`Maximum limit is ${maxLimit}`);
    error.code = "MAX_LIMIT_EXCEEDED";
    error.statusCode = 400;
    throw error;
  }

  return { page, limit };
};

const getSortObject = (sort) => {
  const token = typeof sort === "string" ? sort.trim() : "";
  return OFFER_SORT_OPTIONS[token] || OFFER_SORT_OPTIONS["-createdAt"];
};

const validateRouteCodes = async (codes, session = null) => {
  if (!codes.length) return true;
  const query = Bus.distinct("route.routeCode", {
    isDeleted: false,
    "route.routeCode": { $in: codes },
  });
  if (session) query.session(session);
  const existing = await query;
  return existing.length === codes.length;
};

const validateModelReferences = async (ids, model, session = null, query = {}) => {
  if (!ids.length) return true;

  if (!ids.every((id) => mongoose.Types.ObjectId.isValid(id))) {
    return false;
  }

  const countQuery = model.countDocuments({
    _id: { $in: ids },
    ...query,
  });
  if (session) countQuery.session(session);
  const count = await countQuery;
  return count === ids.length;
};

const buildActiveOfferCondition = (now = new Date()) => ({
  isDeleted: false,
  isActive: true,
  validFrom: { $lte: now },
  validUntil: { $gte: now },
  $expr: {
    $or: [
      { $eq: ["$usageLimit", null] },
      { $lt: ["$usedCount", "$usageLimit"] },
    ],
  },
});

const buildStatusCondition = (status, now = new Date()) => {
  switch (status) {
    case "active":
      return buildActiveOfferCondition(now);
    case "upcoming":
      return {
        isDeleted: false,
        isActive: true,
        validFrom: { $gt: now },
      };
    case "expired":
      return {
        isDeleted: false,
        validUntil: { $lt: now },
      };
    case "inactive":
      return {
        isDeleted: false,
        isActive: false,
      };
    case "deleted":
      return {
        isDeleted: true,
      };
    default:
      return {};
  }
};

const ensureApplicability = ({
  applicableFor,
  specificRoutes,
  specificBuses,
  specificUsers,
}) => {
  if (!OFFER_APPLICABILITY.has(applicableFor)) {
    const error = new Error("Invalid applicableFor value");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  if (applicableFor === "routes" && specificRoutes.length === 0) {
    const error = new Error("specificRoutes is required for route-specific offers");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  if (applicableFor === "buses" && specificBuses.length === 0) {
    const error = new Error("specificBuses is required for bus-specific offers");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  if (applicableFor === "users" && specificUsers.length === 0) {
    const error = new Error("specificUsers is required for user-specific offers");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }
};

const formatPublicOffer = (offer) => ({
  id: offer._id || null,
  title: offer.title || null,
  description: offer.description || null,
  code: offer.code || null,
  discountType: offer.discountType || null,
  discountValue: offer.discountValue ?? null,
  minOrderAmount: offer.minOrderAmount ?? null,
  maxDiscountAmount: offer.maxDiscountAmount ?? null,
  validFrom: offer.validFrom || null,
  validUntil: offer.validUntil || null,
  applicableFor: offer.applicableFor || "all",
  status: getOfferStatus(offer),
  targeting: {
    routeCodes:
      offer.applicableFor === "routes"
        ? Array.isArray(offer.specificRoutes)
          ? offer.specificRoutes
          : []
        : [],
    busCount:
      offer.applicableFor === "buses" && Array.isArray(offer.specificBuses)
        ? offer.specificBuses.length
        : 0,
    userCount:
      offer.applicableFor === "users" && Array.isArray(offer.specificUsers)
        ? offer.specificUsers.length
        : 0,
  },
});

const getStopDistance = (stop, direction) => {
  const trip = direction === "return" ? stop?.downTrip : stop?.upTrip;
  return typeof trip?.distanceFromOrigin === "number"
    ? trip.distanceFromOrigin
    : null;
};

const findStopByCity = (stops, city) => {
  const token = String(city || "").trim().toLowerCase();
  if (!token) return null;
  return stops.find(
    (stop) => String(stop?.city || "").trim().toLowerCase() === token
  );
};

const parseOfferPayload = async ({ body, session = null, existingOffer = null }) => {
  const title =
    body.title !== undefined
      ? String(body.title || "").trim()
      : existingOffer?.title;
  const description =
    body.description !== undefined
      ? String(body.description || "").trim()
      : existingOffer?.description;
  const code =
    body.code !== undefined
      ? normalizeOfferCode(body.code)
      : existingOffer?.code;
  const discountType =
    body.discountType !== undefined
      ? String(body.discountType || "").trim().toLowerCase()
      : existingOffer?.discountType;
  const discountValue =
    body.discountValue !== undefined
      ? parsePositiveNumber(body.discountValue, "discountValue", {
          allowZero: false,
        })
      : existingOffer?.discountValue;
  const minOrderAmount =
    body.minOrderAmount !== undefined
      ? parseOptionalNumber(body.minOrderAmount, "minOrderAmount")
      : existingOffer?.minOrderAmount;
  const maxDiscountAmount =
    body.maxDiscountAmount !== undefined
      ? parseOptionalNumber(body.maxDiscountAmount, "maxDiscountAmount")
      : existingOffer?.maxDiscountAmount;
  const validFrom =
    body.validFrom !== undefined
      ? parseDateOrThrow(body.validFrom, "validFrom")
      : existingOffer?.validFrom;
  const validUntil =
    body.validUntil !== undefined
      ? parseDateOrThrow(body.validUntil, "validUntil", { required: true })
      : existingOffer?.validUntil;
  const isActive =
    body.isActive !== undefined
      ? parseOptionalBoolean(body.isActive, "isActive")
      : existingOffer?.isActive ?? true;
  const applicableFor =
    body.applicableFor !== undefined
      ? String(body.applicableFor || "").trim().toLowerCase()
      : existingOffer?.applicableFor || "all";
  const usageLimit =
    body.usageLimit !== undefined
      ? parseOptionalInt(body.usageLimit, "usageLimit")
      : existingOffer?.usageLimit;
  const usageLimitPerUser =
    body.usageLimitPerUser !== undefined
      ? parseOptionalInt(body.usageLimitPerUser, "usageLimitPerUser")
      : existingOffer?.usageLimitPerUser;
  const metadata =
    body.metadata !== undefined ? body.metadata : existingOffer?.metadata || {};

  if (!title) {
    const error = new Error("title is required");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  if (!code) {
    const error = new Error("code is required");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  if (!OFFER_DISCOUNT_TYPES.has(discountType)) {
    const error = new Error("Invalid discountType");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  if (!validUntil) {
    const error = new Error("validUntil is required");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  const resolvedValidFrom = validFrom || new Date();
  if (validUntil <= resolvedValidFrom) {
    const error = new Error("validUntil must be after validFrom");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  if (
    minOrderAmount !== null &&
    maxDiscountAmount !== null &&
    typeof minOrderAmount === "number" &&
    typeof maxDiscountAmount === "number" &&
    maxDiscountAmount > minOrderAmount
  ) {
    const error = new Error("maxDiscountAmount cannot exceed minOrderAmount");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  if (
    typeof usageLimit === "number" &&
    typeof usageLimitPerUser === "number" &&
    usageLimitPerUser > usageLimit
  ) {
    const error = new Error("usageLimitPerUser cannot exceed usageLimit");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  if (
    metadata !== null &&
    (typeof metadata !== "object" || Array.isArray(metadata))
  ) {
    const error = new Error("metadata must be an object");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  const specificRoutes =
    body.specificRoutes !== undefined
      ? normalizeRouteCodes(body.specificRoutes)
      : normalizeRouteCodes(existingOffer?.specificRoutes || []);
  const specificBuses =
    body.specificBuses !== undefined
      ? normalizeIdArray(body.specificBuses)
      : normalizeIdArray(existingOffer?.specificBuses || []);
  const specificUsers =
    body.specificUsers !== undefined
      ? normalizeIdArray(body.specificUsers)
      : normalizeIdArray(existingOffer?.specificUsers || []);

  ensureApplicability({
    applicableFor,
    specificRoutes,
    specificBuses,
    specificUsers,
  });

  const shouldHaveRoutes = applicableFor === "routes";
  const shouldHaveBuses = applicableFor === "buses";
  const shouldHaveUsers = applicableFor === "users";

  const normalizedSpecificRoutes = shouldHaveRoutes ? specificRoutes : [];
  const normalizedSpecificBuses = shouldHaveBuses ? specificBuses : [];
  const normalizedSpecificUsers = shouldHaveUsers ? specificUsers : [];

  if (
    normalizedSpecificRoutes.length &&
    !(await validateRouteCodes(normalizedSpecificRoutes, session))
  ) {
    const error = new Error("Invalid specificRoutes references");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  if (
    normalizedSpecificBuses.length &&
    !(await validateModelReferences(
      normalizedSpecificBuses,
      Bus,
      session,
      { isDeleted: false }
    ))
  ) {
    const error = new Error("Invalid specificBuses references");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  if (
    normalizedSpecificUsers.length &&
    !(await validateModelReferences(normalizedSpecificUsers, User, session))
  ) {
    const error = new Error("Invalid specificUsers references");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 400;
    throw error;
  }

  return {
    title,
    description: description || "",
    code,
    discountType,
    discountValue,
    minOrderAmount,
    maxDiscountAmount,
    validFrom: resolvedValidFrom,
    validUntil,
    isActive,
    applicableFor,
    specificRoutes: normalizedSpecificRoutes,
    specificBuses: normalizedSpecificBuses,
    specificUsers: normalizedSpecificUsers,
    usageLimit,
    usageLimitPerUser,
    metadata: metadata || {},
  };
};

const sendError = (res, error, fallbackMessage) => {
  const statusCode = error?.statusCode || 500;
  const code = error?.code || "SERVER_ERROR";
  return res.status(statusCode).json({
    success: false,
    message: error?.message || fallbackMessage,
    code,
    error: process.env.NODE_ENV === "development" ? error?.message : undefined,
  });
};

export const listPublicOffers = async (req, res) => {
  try {
    const { page, limit } = parsePagination(
      req.query.page,
      req.query.limit || 12,
      MAX_PUBLIC_LIMIT
    );

    const now = new Date();
    const safeSearch =
      typeof req.query.search === "string"
        ? req.query.search.trim().slice(0, SEARCH_MAX_LENGTH)
        : "";
    const discountType =
      typeof req.query.discountType === "string"
        ? req.query.discountType.trim().toLowerCase()
        : "";
    const applicableFor =
      typeof req.query.applicableFor === "string"
        ? req.query.applicableFor.trim().toLowerCase()
        : "";

    const conditions = [buildActiveOfferCondition(now)];

    if (safeSearch) {
      const searchRegex = new RegExp(escapeRegex(safeSearch), "i");
      conditions.push({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { code: searchRegex },
        ],
      });
    }

    if (discountType) {
      if (!OFFER_DISCOUNT_TYPES.has(discountType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid discountType filter",
          code: "INVALID_DISCOUNT_TYPE",
        });
      }
      conditions.push({ discountType });
    }

    if (applicableFor) {
      if (!OFFER_APPLICABILITY.has(applicableFor)) {
        return res.status(400).json({
          success: false,
          message: "Invalid applicableFor filter",
          code: "INVALID_APPLICABLE_FOR",
        });
      }
      conditions.push({ applicableFor });
    }

    const query = conditions.length > 1 ? { $and: conditions } : conditions[0];
    const sort = getSortObject(req.query.sort || "-createdAt");

    const [rows, total] = await Promise.all([
      Offer.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Offer.countDocuments(query),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.json({
      success: true,
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
      data: rows.map((offer) => formatPublicOffer(offer)),
    });
  } catch (error) {
    console.error("List Public Offers Error:", error);
    return sendError(res, error, "Failed to retrieve offers");
  }
};

export const previewOffer = async (req, res) => {
  try {
    const {
      code,
      busId,
      travelDate,
      boardingPoint,
      droppingPoint,
      passengerCount,
      direction = "forward",
    } = req.body || {};

    const normalizedCode = normalizeOfferCode(code);
    if (!normalizedCode) {
      return res.status(400).json({
        success: false,
        message: "Offer code is required",
        code: "OFFER_CODE_REQUIRED",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bus ID format",
        code: "INVALID_BUS_ID",
      });
    }

    const passengerCountValue = Number(passengerCount);
    if (!Number.isInteger(passengerCountValue) || passengerCountValue < 1) {
      return res.status(400).json({
        success: false,
        message: "passengerCount must be a positive integer",
        code: "INVALID_PASSENGER_COUNT",
      });
    }

    const parsedTravelDate = new Date(travelDate);
    if (Number.isNaN(parsedTravelDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid travelDate",
        code: "INVALID_TRAVEL_DATE",
      });
    }

    const bus = await Bus.findById(busId)
      .select("farePerKm route isActive isDeleted")
      .lean();
    if (!bus || bus.isDeleted || !bus.isActive) {
      return res.status(404).json({
        success: false,
        message: "Bus not found or inactive",
        code: "BUS_NOT_FOUND",
      });
    }

    const stops = Array.isArray(bus.route?.stops) ? bus.route.stops : [];
    const boardingStop = findStopByCity(stops, boardingPoint);
    const droppingStop = findStopByCity(stops, droppingPoint);
    if (!boardingStop || !droppingStop) {
      return res.status(400).json({
        success: false,
        message: "Invalid boarding/dropping point",
        code: "INVALID_POINT",
      });
    }

    const boardingDistance = getStopDistance(boardingStop, direction);
    const droppingDistance = getStopDistance(droppingStop, direction);
    if (
      typeof boardingDistance !== "number" ||
      typeof droppingDistance !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message: "Route distance information is incomplete",
        code: "INCOMPLETE_ROUTE",
      });
    }

    const isInvalidOrder =
      direction === "return"
        ? boardingDistance <= droppingDistance
        : boardingDistance >= droppingDistance;
    if (isInvalidOrder) {
      return res.status(400).json({
        success: false,
        message: "Boarding point must be before dropping point",
        code: "INVALID_POINT_ORDER",
      });
    }

    const journeyDistance = Math.abs(droppingDistance - boardingDistance);
    const baseAmount = Number.parseFloat(
      (Number(bus.farePerKm || 0) * journeyDistance * passengerCountValue).toFixed(2)
    );

    const evaluation = await evaluateOfferEligibility({
      code: normalizedCode,
      userId: req.user?._id,
      busId,
      routeCode: bus.route?.routeCode,
      travelDate: parsedTravelDate,
      boardingPoint,
      droppingPoint,
      direction,
      passengerCount: passengerCountValue,
      baseAmount,
      currency: DEFAULT_CURRENCY,
    });

    return res.json({
      success: true,
      eligible: evaluation.eligible,
      reason: evaluation.reason,
      code: evaluation.code,
      pricing: evaluation.pricing,
      offerSnapshot: evaluation.offerSnapshot,
      offer: evaluation.offer ? formatPublicOffer(evaluation.offer) : null,
      context: {
        busId,
        routeCode: bus.route?.routeCode || null,
        travelDate: parsedTravelDate,
        boardingPoint,
        droppingPoint,
        direction,
        passengerCount: passengerCountValue,
      },
    });
  } catch (error) {
    console.error("Preview Offer Error:", error);
    return sendError(res, error, "Failed to preview offer");
  }
};

export const listAdminOffers = async (req, res) => {
  try {
    const { page, limit } = parsePagination(
      req.query.page,
      req.query.limit || 20,
      MAX_ADMIN_LIMIT
    );

    const now = new Date();
    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim().toLowerCase()
        : "all";

    if (!ADMIN_STATUS_SET.has(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status filter",
        code: "INVALID_STATUS",
      });
    }

    const discountType =
      typeof req.query.discountType === "string"
        ? req.query.discountType.trim().toLowerCase()
        : "";
    if (discountType && !OFFER_DISCOUNT_TYPES.has(discountType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid discountType filter",
        code: "INVALID_DISCOUNT_TYPE",
      });
    }

    const applicableFor =
      typeof req.query.applicableFor === "string"
        ? req.query.applicableFor.trim().toLowerCase()
        : "";
    if (applicableFor && !OFFER_APPLICABILITY.has(applicableFor)) {
      return res.status(400).json({
        success: false,
        message: "Invalid applicableFor filter",
        code: "INVALID_APPLICABLE_FOR",
      });
    }

    const safeSearch =
      typeof req.query.search === "string"
        ? req.query.search.trim().slice(0, SEARCH_MAX_LENGTH)
        : "";

    const scopeConditions = [];

    if (discountType) scopeConditions.push({ discountType });
    if (applicableFor) scopeConditions.push({ applicableFor });
    if (safeSearch) {
      const searchRegex = new RegExp(escapeRegex(safeSearch), "i");
      scopeConditions.push({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { code: searchRegex },
        ],
      });
    }

    const scopeQuery =
      scopeConditions.length > 0 ? { $and: scopeConditions } : {};
    const listQuery = appendAndCondition(scopeQuery, buildStatusCondition(status, now));
    const sort = getSortObject(req.query.sort || "-createdAt");

    const [
      rows,
      total,
      summaryTotal,
      activeCount,
      upcomingCount,
      expiredCount,
      inactiveCount,
      deletedCount,
    ] = await Promise.all([
      Offer.find(listQuery)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("createdBy", "fullName email role")
        .populate("updatedBy", "fullName email role")
        .lean(),
      Offer.countDocuments(listQuery),
      Offer.countDocuments(scopeQuery),
      Offer.countDocuments(appendAndCondition(scopeQuery, buildStatusCondition("active", now))),
      Offer.countDocuments(
        appendAndCondition(scopeQuery, buildStatusCondition("upcoming", now))
      ),
      Offer.countDocuments(
        appendAndCondition(scopeQuery, buildStatusCondition("expired", now))
      ),
      Offer.countDocuments(
        appendAndCondition(scopeQuery, buildStatusCondition("inactive", now))
      ),
      Offer.countDocuments(
        appendAndCondition(scopeQuery, buildStatusCondition("deleted", now))
      ),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return res.json({
      success: true,
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
      filters: {
        status,
        search: safeSearch || null,
        discountType: discountType || null,
        applicableFor: applicableFor || null,
      },
      summary: {
        total: summaryTotal,
        active: activeCount,
        upcoming: upcomingCount,
        expired: expiredCount,
        inactive: inactiveCount,
        deleted: deletedCount,
      },
      data: rows.map((offer) => formatOfferRecord(offer)),
    });
  } catch (error) {
    console.error("List Admin Offers Error:", error);
    return sendError(res, error, "Failed to retrieve offers");
  }
};

export const getAdminOfferById = async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer ID format",
        code: "INVALID_ID",
      });
    }

    const offer = await Offer.findById(id)
      .populate("createdBy", "fullName email role")
      .populate("updatedBy", "fullName email role")
      .lean();

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
        code: "OFFER_NOT_FOUND",
      });
    }

    const [totalRedemptions, redeemedCount, reservedCount, releasedCount] =
      await Promise.all([
        OfferRedemption.countDocuments({ offer: id }),
        OfferRedemption.countDocuments({ offer: id, status: "redeemed" }),
        OfferRedemption.countDocuments({ offer: id, status: "reserved" }),
        OfferRedemption.countDocuments({ offer: id, status: "released" }),
      ]);

    return res.json({
      success: true,
      data: {
        ...formatOfferRecord(offer),
        redemptionStats: {
          total: totalRedemptions,
          redeemed: redeemedCount,
          reserved: reservedCount,
          released: releasedCount,
        },
      },
    });
  } catch (error) {
    console.error("Get Offer By ID Error:", error);
    return sendError(res, error, "Failed to retrieve offer");
  }
};

export const createAdminOffer = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const payload = await parseOfferPayload({
      body: req.body || {},
      session,
    });

    const duplicate = await Offer.findOne({ code: payload.code }).session(session);
    if (duplicate) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "Offer code already exists",
        code: "DUPLICATE_CODE",
      });
    }

    const offer = new Offer({
      ...payload,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
      usedCount: 0,
      isDeleted: false,
    });

    await offer.save({ session });
    await session.commitTransaction();

    const created = await Offer.findById(offer._id)
      .populate("createdBy", "fullName email role")
      .populate("updatedBy", "fullName email role")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Offer created successfully",
      data: formatOfferRecord(created),
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Create Admin Offer Error:", error);
    return sendError(res, error, "Failed to create offer");
  } finally {
    session.endSession();
  }
};

export const updateAdminOffer = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const id = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer ID format",
        code: "INVALID_ID",
      });
    }

    session.startTransaction();

    const offer = await Offer.findById(id).session(session);
    if (!offer || offer.isDeleted) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Offer not found",
        code: "OFFER_NOT_FOUND",
      });
    }

    const payload = await parseOfferPayload({
      body: req.body || {},
      session,
      existingOffer: offer,
    });

    if (payload.code !== offer.code) {
      const duplicate = await Offer.findOne({ code: payload.code }).session(session);
      if (duplicate) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "Offer code already exists",
          code: "DUPLICATE_CODE",
        });
      }
    }

    Object.assign(offer, payload, {
      updatedBy: req.user?._id,
    });
    await offer.save({ session });

    await session.commitTransaction();

    const updated = await Offer.findById(id)
      .populate("createdBy", "fullName email role")
      .populate("updatedBy", "fullName email role")
      .lean();

    return res.json({
      success: true,
      message: "Offer updated successfully",
      data: formatOfferRecord(updated),
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Update Admin Offer Error:", error);
    return sendError(res, error, "Failed to update offer");
  } finally {
    session.endSession();
  }
};

export const deleteAdminOffer = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const id = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer ID format",
        code: "INVALID_ID",
      });
    }

    session.startTransaction();

    const offer = await Offer.findById(id).session(session);
    if (!offer || offer.isDeleted) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Offer not found",
        code: "OFFER_NOT_FOUND",
      });
    }

    offer.isDeleted = true;
    offer.isActive = false;
    offer.updatedBy = req.user?._id;
    await offer.save({ session });

    await session.commitTransaction();
    return res.json({
      success: true,
      message: "Offer deleted successfully",
      data: { id: offer._id, code: offer.code },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Delete Admin Offer Error:", error);
    return sendError(res, error, "Failed to delete offer");
  } finally {
    session.endSession();
  }
};

// Legacy compatibility wrappers
export const createOffer = createAdminOffer;
export const updateOffer = updateAdminOffer;
export const deleteOffer = deleteAdminOffer;

export const getAllOffers = async (req, res) => {
  if (!req.query.status) {
    req.query.status = "active";
  }
  return listAdminOffers(req, res);
};

export const getActiveOffers = listPublicOffers;
