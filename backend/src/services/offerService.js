import mongoose from "mongoose";
import { Offer } from "../models/offer.js";
import { OfferRedemption } from "../models/offerRedemption.js";
import { Booking } from "../models/booking.js";

const DEFAULT_CURRENCY = "INR";
const DEFAULT_MIN_FINAL_AMOUNT = 1;
const DEFAULT_RESERVED_EXPIRY_MINUTES = 30;

const toObjectIdString = (value) =>
  value instanceof mongoose.Types.ObjectId ? value.toString() : String(value || "");

const roundAmount = (value) => Number.parseFloat(Number(value || 0).toFixed(2));

export const normalizeOfferCode = (value) =>
  String(value || "").trim().toUpperCase();

export const getOfferStatus = (offer, now = new Date()) => {
  if (!offer || typeof offer !== "object") return "invalid";
  if (offer.isDeleted) return "deleted";
  if (!offer.isActive) return "inactive";

  const validFrom = new Date(offer.validFrom);
  const validUntil = new Date(offer.validUntil);
  if (!Number.isNaN(validFrom.getTime()) && now < validFrom) return "upcoming";
  if (!Number.isNaN(validUntil.getTime()) && now > validUntil) return "expired";
  return "active";
};

const usageLimitReached = (offer) =>
  typeof offer?.usageLimit === "number" &&
  offer.usageLimit >= 0 &&
  Number(offer.usedCount || 0) >= offer.usageLimit;

const toOfferSnapshot = (offer, discountAmount = 0, status = "applied") => ({
  offerId: offer?._id || null,
  code: offer?.code || null,
  title: offer?.title || null,
  discountType: offer?.discountType || null,
  discountValue: offer?.discountValue ?? null,
  maxDiscountAmount: offer?.maxDiscountAmount ?? null,
  discountAmount: roundAmount(discountAmount),
  status,
  appliedAt: new Date(),
  redeemedAt: status === "redeemed" ? new Date() : null,
});

export const formatOfferRecord = (offer) => {
  if (!offer) return null;

  return {
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
    isActive: Boolean(offer.isActive),
    isDeleted: Boolean(offer.isDeleted),
    status: getOfferStatus(offer),
    applicableFor: offer.applicableFor || "all",
    specificRoutes: Array.isArray(offer.specificRoutes) ? offer.specificRoutes : [],
    specificBuses: Array.isArray(offer.specificBuses) ? offer.specificBuses : [],
    specificUsers: Array.isArray(offer.specificUsers) ? offer.specificUsers : [],
    usageLimit: offer.usageLimit ?? null,
    usageLimitPerUser: offer.usageLimitPerUser ?? null,
    usedCount: Number(offer.usedCount || 0),
    metadata: offer.metadata || {},
    createdBy: offer.createdBy || null,
    updatedBy: offer.updatedBy || null,
    createdAt: offer.createdAt || null,
    updatedAt: offer.updatedAt || null,
  };
};

export const getOfferByCode = async (
  code,
  { session = null, includeDeleted = false } = {}
) => {
  const normalized = normalizeOfferCode(code);
  if (!normalized) return null;

  const query = Offer.findOne({
    code: normalized,
    ...(includeDeleted ? {} : { isDeleted: false }),
  });
  if (session) query.session(session);
  return query;
};

export const computeDiscount = (
  baseAmount,
  offer,
  { minFinalAmount = DEFAULT_MIN_FINAL_AMOUNT } = {}
) => {
  const base = roundAmount(baseAmount);
  if (!Number.isFinite(base) || base <= 0 || !offer) {
    return {
      baseAmount: Number.isFinite(base) ? base : 0,
      discountAmount: 0,
      finalAmount: Number.isFinite(base) ? base : 0,
      currency: DEFAULT_CURRENCY,
    };
  }

  let discount = 0;
  if (offer.discountType === "percentage") {
    discount = (base * Number(offer.discountValue || 0)) / 100;
  } else {
    discount = Number(offer.discountValue || 0);
  }

  if (
    typeof offer.maxDiscountAmount === "number" &&
    Number.isFinite(offer.maxDiscountAmount) &&
    offer.maxDiscountAmount >= 0
  ) {
    discount = Math.min(discount, offer.maxDiscountAmount);
  }

  discount = Math.max(0, Math.min(discount, base));

  let finalAmount = base - discount;
  if (Number.isFinite(minFinalAmount)) {
    finalAmount = Math.max(minFinalAmount, finalAmount);
  }

  finalAmount = roundAmount(finalAmount);
  const normalizedDiscount = roundAmount(Math.max(0, base - finalAmount));

  return {
    baseAmount: base,
    discountAmount: normalizedDiscount,
    finalAmount,
    currency: DEFAULT_CURRENCY,
  };
};

export const evaluateOfferEligibility = async (
  {
    code,
    userId,
    busId,
    routeCode,
    travelDate,
    boardingPoint,
    droppingPoint,
    direction = "forward",
    passengerCount,
    baseAmount,
    currency = DEFAULT_CURRENCY,
  },
  { offer: offerOverride = null, session = null } = {}
) => {
  const normalizedCode = normalizeOfferCode(code);
  if (!normalizedCode) {
    return {
      eligible: false,
      reason: "Offer code is required",
      code: "OFFER_CODE_REQUIRED",
      pricing: {
        baseAmount: roundAmount(baseAmount),
        discountAmount: 0,
        finalAmount: roundAmount(baseAmount),
        currency,
      },
      offer: null,
      offerSnapshot: null,
    };
  }

  const base = roundAmount(baseAmount);
  if (!Number.isFinite(base) || base <= 0) {
    return {
      eligible: false,
      reason: "Invalid base fare amount",
      code: "INVALID_BASE_AMOUNT",
      pricing: {
        baseAmount: 0,
        discountAmount: 0,
        finalAmount: 0,
        currency,
      },
      offer: null,
      offerSnapshot: null,
    };
  }

  const offer =
    offerOverride && normalizeOfferCode(offerOverride.code) === normalizedCode
      ? offerOverride
      : await getOfferByCode(normalizedCode, { session });

  if (!offer) {
    return {
      eligible: false,
      reason: "Offer code is invalid",
      code: "OFFER_NOT_FOUND",
      pricing: {
        baseAmount: base,
        discountAmount: 0,
        finalAmount: base,
        currency,
      },
      offer: null,
      offerSnapshot: null,
    };
  }

  const status = getOfferStatus(offer);
  if (status !== "active") {
    const messageByStatus = {
      deleted: "Offer is no longer available",
      inactive: "Offer is currently inactive",
      upcoming: "Offer is not active yet",
      expired: "Offer has expired",
    };
    return {
      eligible: false,
      reason: messageByStatus[status] || "Offer is not available",
      code: "OFFER_UNAVAILABLE",
      pricing: {
        baseAmount: base,
        discountAmount: 0,
        finalAmount: base,
        currency,
      },
      offer,
      offerSnapshot: null,
    };
  }

  if (usageLimitReached(offer)) {
    return {
      eligible: false,
      reason: "Offer usage limit has been reached",
      code: "OFFER_USAGE_LIMIT_REACHED",
      pricing: {
        baseAmount: base,
        discountAmount: 0,
        finalAmount: base,
        currency,
      },
      offer,
      offerSnapshot: null,
    };
  }

  const normalizedRouteCode = normalizeOfferCode(routeCode);
  const normalizedBusId = toObjectIdString(busId);
  const normalizedUserId = toObjectIdString(userId);

  if (offer.applicableFor === "routes") {
    const routes = Array.isArray(offer.specificRoutes)
      ? offer.specificRoutes.map((item) => normalizeOfferCode(item))
      : [];
    if (!normalizedRouteCode || !routes.includes(normalizedRouteCode)) {
      return {
        eligible: false,
        reason: "Offer is not applicable for this route",
        code: "OFFER_ROUTE_MISMATCH",
        pricing: {
          baseAmount: base,
          discountAmount: 0,
          finalAmount: base,
          currency,
        },
        offer,
        offerSnapshot: null,
      };
    }
  }

  if (offer.applicableFor === "buses") {
    const buses = Array.isArray(offer.specificBuses)
      ? offer.specificBuses.map((item) => toObjectIdString(item))
      : [];
    if (!normalizedBusId || !buses.includes(normalizedBusId)) {
      return {
        eligible: false,
        reason: "Offer is not applicable for this bus",
        code: "OFFER_BUS_MISMATCH",
        pricing: {
          baseAmount: base,
          discountAmount: 0,
          finalAmount: base,
          currency,
        },
        offer,
        offerSnapshot: null,
      };
    }
  }

  if (offer.applicableFor === "users") {
    const users = Array.isArray(offer.specificUsers)
      ? offer.specificUsers.map((item) => toObjectIdString(item))
      : [];
    if (!normalizedUserId || !users.includes(normalizedUserId)) {
      return {
        eligible: false,
        reason: "Offer is not applicable for this user",
        code: "OFFER_USER_MISMATCH",
        pricing: {
          baseAmount: base,
          discountAmount: 0,
          finalAmount: base,
          currency,
        },
        offer,
        offerSnapshot: null,
      };
    }
  }

  if (
    typeof offer.usageLimitPerUser === "number" &&
    Number.isFinite(offer.usageLimitPerUser) &&
    offer.usageLimitPerUser > 0 &&
    normalizedUserId
  ) {
    const countQuery = OfferRedemption.countDocuments({
      offer: offer._id,
      user: normalizedUserId,
      status: "redeemed",
    });
    if (session) countQuery.session(session);

    const redeemedCount = await countQuery;
    if (redeemedCount >= offer.usageLimitPerUser) {
      return {
        eligible: false,
        reason: "You have exhausted this offer limit",
        code: "OFFER_USER_LIMIT_REACHED",
        pricing: {
          baseAmount: base,
          discountAmount: 0,
          finalAmount: base,
          currency,
        },
        offer,
        offerSnapshot: null,
      };
    }
  }

  if (
    typeof offer.minOrderAmount === "number" &&
    Number.isFinite(offer.minOrderAmount) &&
    base < offer.minOrderAmount
  ) {
    return {
      eligible: false,
      reason: `Minimum order amount is ${offer.minOrderAmount}`,
      code: "OFFER_MIN_ORDER_NOT_MET",
      pricing: {
        baseAmount: base,
        discountAmount: 0,
        finalAmount: base,
        currency,
      },
      offer,
      offerSnapshot: null,
    };
  }

  const pricing = computeDiscount(base, offer, {
    minFinalAmount: DEFAULT_MIN_FINAL_AMOUNT,
  });

  if (pricing.discountAmount <= 0) {
    return {
      eligible: false,
      reason: "Offer does not provide a valid discount for this booking",
      code: "OFFER_NO_DISCOUNT",
      pricing: {
        baseAmount: base,
        discountAmount: 0,
        finalAmount: base,
        currency,
      },
      offer,
      offerSnapshot: null,
    };
  }

  return {
    eligible: true,
    reason: "Offer applied successfully",
    code: "OFFER_ELIGIBLE",
    pricing: {
      ...pricing,
      currency,
    },
    offer,
    offerSnapshot: toOfferSnapshot(offer, pricing.discountAmount, "applied"),
    context: {
      bus: busId || null,
      routeCode: normalizedRouteCode || null,
      travelDate: travelDate || null,
      boardingPoint: boardingPoint || null,
      droppingPoint: droppingPoint || null,
      direction,
      passengerCount: Number(passengerCount) || null,
    },
  };
};

export const reserveOfferForBooking = async (
  {
    offer,
    userId,
    bookingId,
    code,
    pricing,
    currency = DEFAULT_CURRENCY,
    context = {},
  },
  { session = null } = {}
) => {
  if (!offer || !userId || !bookingId || !pricing) return null;

  const query = OfferRedemption.findOne({ booking: bookingId });
  if (session) query.session(session);
  let redemption = await query;

  if (!redemption) {
    redemption = new OfferRedemption({
      offer: offer._id,
      user: userId,
      booking: bookingId,
      code: normalizeOfferCode(code || offer.code),
      status: "reserved",
      baseAmount: roundAmount(pricing.baseAmount),
      discountAmount: roundAmount(pricing.discountAmount),
      finalAmount: roundAmount(pricing.finalAmount),
      currency,
      context,
      reservedAt: new Date(),
      releasedAt: null,
      redeemedAt: null,
      releaseReason: null,
    });
  } else if (redemption.status !== "redeemed") {
    redemption.offer = offer._id;
    redemption.user = userId;
    redemption.code = normalizeOfferCode(code || offer.code);
    redemption.status = "reserved";
    redemption.baseAmount = roundAmount(pricing.baseAmount);
    redemption.discountAmount = roundAmount(pricing.discountAmount);
    redemption.finalAmount = roundAmount(pricing.finalAmount);
    redemption.currency = currency;
    redemption.context = context;
    redemption.reservedAt = new Date();
    redemption.releasedAt = null;
    redemption.releaseReason = null;
    redemption.redeemedAt = null;
  }

  if (session) {
    await redemption.save({ session });
  } else {
    await redemption.save();
  }

  return redemption;
};

export const releaseOfferReservation = async (
  { bookingId, reason = "reservation_released" },
  { session = null } = {}
) => {
  if (!bookingId) return null;

  const query = OfferRedemption.findOne({
    booking: bookingId,
    status: "reserved",
  });
  if (session) query.session(session);

  const redemption = await query;
  if (!redemption) return null;

  redemption.status = "released";
  redemption.releasedAt = new Date();
  redemption.releaseReason = reason;

  if (session) {
    await redemption.save({ session });
  } else {
    await redemption.save();
  }

  return redemption;
};

export const finalizeOfferRedemptionOnPaymentSuccess = async (
  { bookingId },
  { session = null } = {}
) => {
  if (!bookingId) {
    return { success: false, code: "BOOKING_ID_REQUIRED" };
  }

  const query = OfferRedemption.findOne({ booking: bookingId });
  if (session) query.session(session);

  const redemption = await query;
  if (!redemption) {
    return { success: false, code: "REDEMPTION_NOT_FOUND" };
  }

  if (redemption.status === "redeemed") {
    return { success: true, alreadyRedeemed: true, redemption };
  }

  if (redemption.status === "invalidated") {
    return { success: false, code: "REDEMPTION_INVALIDATED", redemption };
  }

  redemption.status = "redeemed";
  redemption.redeemedAt = new Date();
  redemption.releasedAt = null;
  redemption.releaseReason = null;

  if (session) {
    await redemption.save({ session });
  } else {
    await redemption.save();
  }

  const offerUpdate = Offer.updateOne(
    { _id: redemption.offer },
    { $inc: { usedCount: 1 } }
  );
  if (session) offerUpdate.session(session);
  await offerUpdate;

  const bookingUpdate = Booking.updateOne(
    { _id: bookingId, "offer.code": redemption.code },
    {
      $set: {
        "offer.status": "redeemed",
        "offer.redeemedAt": redemption.redeemedAt,
      },
    }
  );
  if (session) bookingUpdate.session(session);
  await bookingUpdate;

  return {
    success: true,
    alreadyRedeemed: false,
    redemption,
  };
};

/**
 * Invalidate offer redemption when booking is cancelled.
 * Decrements offer usedCount if redemption was redeemed.
 */
export const invalidateOfferRedemptionOnCancel = async (
  { bookingId, reason = "booking_cancelled" },
  { session = null } = {}
) => {
  if (!bookingId) return null;

  const query = OfferRedemption.findOne({ booking: bookingId });
  if (session) query.session(session);

  const redemption = await query;
  if (!redemption) return null;

  // Reserved redemptions get released; redeemed get invalidated
  if (redemption.status === "reserved") {
    return releaseOfferReservation(
      { bookingId, reason },
      { session }
    );
  }

  if (redemption.status !== "redeemed") return redemption;

  redemption.status = "invalidated";
  redemption.releasedAt = new Date();
  redemption.releaseReason = reason;

  if (session) {
    await redemption.save({ session });
  } else {
    await redemption.save();
  }

  const offerUpdate = Offer.updateOne(
    { _id: redemption.offer },
    { $inc: { usedCount: -1 } }
  );
  if (session) offerUpdate.session(session);
  await offerUpdate;

  return redemption;
};

export const cleanupStaleOfferReservations = async ({
  olderThanMinutes = DEFAULT_RESERVED_EXPIRY_MINUTES,
} = {}) => {
  const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const result = await OfferRedemption.updateMany(
    {
      status: "reserved",
      reservedAt: { $lte: threshold },
    },
    {
      $set: {
        status: "released",
        releasedAt: new Date(),
        releaseReason: "reservation_expired",
      },
    }
  );

  return {
    matchedCount: Number(result.matchedCount || 0),
    modifiedCount: Number(result.modifiedCount || 0),
    threshold,
  };
};
