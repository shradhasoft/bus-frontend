import crypto from "crypto";
import razorpay from "../config/razorpay.js";
import { Booking } from "../models/booking.js";
import { Payment } from "../models/payment.js";
import { SeatHold } from "../models/seatHold.js";
import { User } from "../models/user.js";
import {
  finalizeOfferRedemptionOnPaymentSuccess,
  releaseOfferReservation,
} from "../services/offerService.js";
import { SeatLockService } from "../services/seatLockService.js";
import mongoose from "mongoose";

const DEFAULT_CURRENCY = "INR";
const MAX_ADMIN_LIMIT = 100;
const SEARCH_MAX_LENGTH = 80;

const TRANSACTION_STATUS_SET = new Set([
  "pending",
  "success",
  "failed",
  "refunded",
  "partial_refund",
]);

const TRANSACTION_METHOD_SET = new Set([
  "credit_card",
  "debit_card",
  "netbanking",
  "upi",
  "wallet",
  "razorpay",
  "card",
  "emi",
]);

const TRANSACTION_CURRENCY_SET = new Set(["INR", "USD", "EUR"]);

const TRANSACTION_SORT_OPTIONS = {
  createdAt: { createdAt: 1 },
  "-createdAt": { createdAt: -1 },
  updatedAt: { updatedAt: 1 },
  "-updatedAt": { updatedAt: -1 },
  amount: { amount: 1, createdAt: -1 },
  "-amount": { amount: -1, createdAt: -1 },
};

const SETTLED_TRANSACTION_STATUSES = new Set([
  "success",
  "refunded",
  "partial_refund",
]);

const toPaise = (amount) => Math.round(Number(amount) * 100);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDateQuery = (value, { endOfDay = false } = {}) => {
  if (!value) return null;
  const raw = String(value).trim();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (endOfDay) {
      parsed.setHours(23, 59, 59, 999);
    } else {
      parsed.setHours(0, 0, 0, 0);
    }
  }

  return parsed;
};

const appendAndCondition = (base, condition) => {
  if (!condition || Object.keys(condition).length === 0) return base;
  if (!base || Object.keys(base).length === 0) return condition;
  return { $and: [base, condition] };
};

const buildSortObject = (sortInput, fallback = "-createdAt") => {
  const token = typeof sortInput === "string" ? sortInput.trim() : "";
  if (token && TRANSACTION_SORT_OPTIONS[token]) {
    return TRANSACTION_SORT_OPTIONS[token];
  }
  return (
    TRANSACTION_SORT_OPTIONS[fallback] || TRANSACTION_SORT_OPTIONS["-createdAt"]
  );
};

const normalizeStatus = (value, fallback = "pending") => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized || fallback;
};

const mapPaymentStatusToBookingStatus = (status) => {
  switch (status) {
    case "success":
      return "paid";
    case "refunded":
      return "refunded";
    case "partial_refund":
      return "partial-refund";
    default:
      return "pending";
  }
};

const extractGatewayReference = (gatewayResponse) => {
  if (!gatewayResponse || typeof gatewayResponse !== "object") return null;
  return (
    gatewayResponse?.razorpay_payment_id ||
    gatewayResponse?.paymentId ||
    gatewayResponse?.order?.id ||
    null
  );
};

const formatTransactionRecord = (payment) => {
  const booking = payment?.booking;
  const user = payment?.user;
  const gatewayResponse = payment?.gatewayResponse || {};

  return {
    id: payment?._id || null,
    paymentId: payment?.paymentId || null,
    amount: payment?.amount ?? null,
    currency: payment?.currency || DEFAULT_CURRENCY,
    method: payment?.method || null,
    status: payment?.status || null,
    attempts: payment?.attempts ?? 1,
    createdAt: payment?.createdAt || null,
    updatedAt: payment?.updatedAt || null,
    gatewayReference: extractGatewayReference(gatewayResponse),
    refunds: Array.isArray(payment?.refunds) ? payment.refunds : [],
    gatewayResponse,
    booking: booking
      ? {
          id: booking._id || null,
          bookingId: booking.bookingId || null,
          travelDate: booking.travelDate || null,
          boardingPoint: booking.boardingPoint || null,
          droppingPoint: booking.droppingPoint || null,
          bookingStatus: booking.bookingStatus || null,
          paymentStatus: booking.paymentStatus || null,
          totalAmount: booking.totalAmount ?? null,
          currency: booking.currency || DEFAULT_CURRENCY,
        }
      : null,
    user: user
      ? {
          id: user._id || null,
          fullName: user.fullName || null,
          email: user.email || null,
          phone: user.phone || null,
          role: user.role || null,
        }
      : null,
  };
};

const buildManualPaymentId = (bookingRef = "BOOKING") =>
  `MANUAL_${String(bookingRef).replace(/[^a-zA-Z0-9_-]+/g, "_")}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;

const resolveBookingByRef = async (bookingRef, session = null) => {
  const raw = String(bookingRef || "").trim();
  if (!raw) return null;

  const refQuery = [{ bookingId: new RegExp(`^${escapeRegex(raw)}$`, "i") }];
  if (isValidObjectId(raw)) {
    refQuery.push({ _id: raw });
  }

  const query = Booking.findOne({ $or: refQuery });
  if (session) query.session(session);
  return query;
};

const syncBookingWithPayment = async ({
  booking,
  payment,
  session,
  allowSeatConversion = false,
}) => {
  if (!booking || !payment) return null;

  booking.payment = payment._id;
  const mappedStatus = mapPaymentStatusToBookingStatus(payment.status);
  booking.paymentStatus = mappedStatus;

  if (mappedStatus === "paid") {
    if (booking.bookingStatus === "pending") {
      booking.bookingStatus = "confirmed";
    }
  } else if (mappedStatus === "refunded") {
    booking.bookingStatus = "cancelled";
    booking.cancellation = {
      requestedAt: booking.cancellation?.requestedAt || new Date(),
      processedAt: new Date(),
      refundAmount:
        typeof payment.amount === "number" ? payment.amount : booking.totalAmount,
      reason:
        booking.cancellation?.reason || "Refund processed from transactions panel",
    };
  } else if (mappedStatus === "partial-refund") {
    if (booking.bookingStatus === "pending") {
      booking.bookingStatus = "confirmed";
    }
    booking.cancellation = {
      ...booking.cancellation,
      requestedAt: booking.cancellation?.requestedAt || new Date(),
      processedAt: booking.cancellation?.processedAt || new Date(),
      refundAmount:
        booking.cancellation?.refundAmount ??
        (typeof payment.amount === "number" ? payment.amount : booking.totalAmount),
      reason:
        booking.cancellation?.reason ||
        "Partial refund processed from transactions panel",
    };
  } else if (booking.bookingStatus === "confirmed") {
    booking.bookingStatus = "pending";
  }

  await booking.save({ session });

  if (allowSeatConversion && mappedStatus === "paid" && booking.sessionId) {
    return {
      busId: booking.bus,
      userId: booking.user,
      sessionId: booking.sessionId,
      travelDate: booking.travelDate,
      direction: booking.direction || "forward",
      bookingId: booking._id,
    };
  }

  return null;
};

const getPopulatedPaymentQuery = (baseQuery) =>
  Payment.find(baseQuery)
    .populate({
      path: "booking",
      select:
        "bookingId travelDate boardingPoint droppingPoint bookingStatus paymentStatus totalAmount currency",
    })
    .populate({
      path: "user",
      select: "fullName email phone role",
    });

const buildReceipt = (booking) =>
  `BK_${booking.bookingId || booking._id}_${Date.now()}`;

const verifySignature = (payload, signature, secret) => {
  if (!payload || !signature || !secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest();
  const received = Buffer.from(signature, "hex");
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(received, expected);
};

const normalizeSeatToken = (value) =>
  String(value || "").trim().toUpperCase();

const markPaymentFailed = async ({
  payment,
  booking,
  gatewayResponse,
  session,
}) => {
  payment.status = "failed";
  payment.gatewayResponse = {
    ...payment.gatewayResponse,
    ...gatewayResponse,
  };
  payment.updatedAt = new Date();
  await payment.save({ session });

  if (booking?._id) {
    try {
      await releaseOfferReservation(
        {
          bookingId: booking._id,
          reason: "payment_failed",
        },
        { session }
      );
    } catch (offerError) {
      console.error("Error releasing offer reservation:", offerError);
    }
  }

  if (booking && booking.sessionId) {
    try {
      await SeatLockService.releaseLocks({
        busId: booking.bus,
        userId: booking.user,
        sessionId: booking.sessionId,
        travelDate: booking.travelDate,
      });
    } catch (lockError) {
      console.error("Error releasing locks on payment failure:", lockError);
    }
  }
};

const markPaymentSuccess = async ({
  payment,
  booking,
  gatewayResponse,
  session,
  deferSeatConversion = false,
}) => {
  payment.status = "success";
  if (gatewayResponse?.method) {
    payment.method = gatewayResponse.method;
  }
  payment.gatewayResponse = {
    ...payment.gatewayResponse,
    ...gatewayResponse,
  };
  payment.updatedAt = new Date();
  await payment.save({ session });

  let seatConversionPayload = null;

  if (booking) {
    booking.paymentStatus = "paid";
    booking.bookingStatus = "confirmed";
    await booking.save({ session });

    try {
      await finalizeOfferRedemptionOnPaymentSuccess(
        { bookingId: booking._id },
        { session }
      );
    } catch (offerError) {
      console.error("Error finalizing offer redemption:", offerError);
    }

    if (booking.sessionId) {
      seatConversionPayload = {
        busId: booking.bus,
        userId: booking.user,
        sessionId: booking.sessionId,
        travelDate: booking.travelDate,
        direction: booking.direction || "forward",
        bookingId: booking._id,
      };
    }
  }

  if (!deferSeatConversion && seatConversionPayload) {
    try {
      await SeatLockService.convertLocksToBooking(seatConversionPayload);
    } catch (lockError) {
      console.error("Error converting locks to booking:", lockError);
    }
  }

  return seatConversionPayload;
};

// Create Razorpay order (production-ready: booking-driven + idempotent)
export const createRazorpayOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!bookingId) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
        code: "MISSING_FIELDS",
      });
    }

    // Validate booking ID
    if (!isValidObjectId(bookingId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID format",
        code: "INVALID_ID",
      });
    }

    // Check booking ownership and status
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking || booking.user.toString() !== userId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Booking not found or unauthorized",
        code: "UNAUTHORIZED",
      });
    }

    // Check if booking is in valid state for payment
    if (booking.paymentStatus === "paid") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Booking already paid",
        code: "ALREADY_PAID",
      });
    }

    if (booking.paymentStatus !== "pending") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Booking payment status is ${booking.paymentStatus}`,
        code: "INVALID_PAYMENT_STATUS",
      });
    }

    if (booking.bookingStatus === "cancelled") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Booking is cancelled",
        code: "BOOKING_CANCELLED",
      });
    }

    if (booking.bookingStatus !== "pending") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Booking status is ${booking.bookingStatus}`,
        code: "INVALID_BOOKING_STATUS",
      });
    }

    const numAmount = Number(booking.totalAmount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid booking amount",
        code: "INVALID_AMOUNT",
      });
    }

    const currency = booking.currency || DEFAULT_CURRENCY;

    if (!booking.sessionId) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Booking session is missing",
        code: "SESSION_MISSING",
      });
    }

    const seatIds = Array.isArray(booking.passengers)
      ? booking.passengers
          .map((passenger) => normalizeSeatToken(passenger?.seatNumber))
          .filter(Boolean)
      : [];

    if (seatIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "No seats found for booking",
        code: "NO_SEATS",
      });
    }

    const uniqueSeatIds = new Set(seatIds);
    if (uniqueSeatIds.size !== seatIds.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Duplicate seats detected in booking",
        code: "DUPLICATE_SEATS",
      });
    }

    const travelDateObj = new Date(booking.travelDate);
    const now = new Date();
    const activeLocks = await SeatHold.find({
      bus: booking.bus,
      travelDate: travelDateObj,
      direction: booking.direction || "forward",
      user: userId,
      sessionId: booking.sessionId,
      status: "HOLD",
      expiresAt: { $gt: now },
      seatId: { $in: seatIds },
    }).session(session);

    if (activeLocks.length !== seatIds.length) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "Seat locks have expired or are invalid",
        code: "INVALID_LOCKS",
        lockedSeats: activeLocks.map((lock) => lock.seatId),
        requestedSeats: seatIds,
      });
    }

    try {
      await SeatLockService.checkAndExtendLocks({
        busId: booking.bus,
        userId,
        sessionId: booking.sessionId,
        travelDate: booking.travelDate,
        direction: booking.direction || "forward",
        extendIfExpiringInMinutes: 10,
      });
    } catch (extendError) {
      console.warn("[createRazorpayOrder] Failed to extend locks:", extendError);
    }

    // Idempotency: reuse existing pending payment for this booking
    const existingPayment = booking.payment
      ? await Payment.findById(booking.payment).session(session)
      : await Payment.findOne({
          booking: booking._id,
          status: "pending",
          method: "razorpay",
        })
          .sort({ createdAt: -1 })
          .session(session);

    if (existingPayment && existingPayment.status === "pending") {
      const amountMatches =
        Number(existingPayment.amount) === Number(numAmount) &&
        (existingPayment.currency || currency) === currency;

      if (!amountMatches) {
        existingPayment.status = "failed";
        existingPayment.gatewayResponse = {
          ...existingPayment.gatewayResponse,
          error: "Booking amount changed",
        };
        await existingPayment.save({ session });
      } else {
      let orderPayload = existingPayment.gatewayResponse?.order;

      if (!orderPayload && existingPayment.paymentId) {
        try {
          orderPayload = await razorpay.orders.fetch(
            existingPayment.paymentId,
          );
          existingPayment.gatewayResponse = {
            ...existingPayment.gatewayResponse,
            order: orderPayload,
          };
          await existingPayment.save({ session });
        } catch (fetchError) {
          orderPayload = {
            id: existingPayment.paymentId,
            amount: toPaise(existingPayment.amount),
            currency: existingPayment.currency || currency,
          };
        }
      }

      await session.commitTransaction();
      return res.status(200).json({
        success: true,
        order: orderPayload,
        paymentId: existingPayment._id,
        keyId: process.env.RAZORPAY_KEY_ID,
        reused: true,
      });
      }
    }

    // Create Razorpay order
    const options = {
      amount: toPaise(numAmount), // convert to paise
      currency,
      receipt: buildReceipt(booking),
      payment_capture: 1,
      notes: {
        bookingId: bookingId.toString(),
        userId: userId.toString(),
      },
    };

    const order = await razorpay.orders.create(options);

    // Create payment record
    const payment = new Payment({
      paymentId: order.id,
      booking: bookingId,
      user: userId,
      amount: numAmount,
      currency,
      method: "razorpay",
      status: "pending",
      gatewayResponse: {
        order,
      },
    });

    await payment.save({ session });

    // Associate payment with booking
    booking.payment = payment._id;
    await booking.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      order,
      paymentId: payment._id,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Razorpay Order Error:", error);

    // Handle specific Razorpay errors
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.error?.description || "Razorpay order creation failed",
        code: "RAZORPAY_ERROR",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      code: "PAYMENT_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

// Verify payment (updated to convert locks to bookings)
export const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
      req.body;
    const { paymentId } = req.params;
    const userId = req.user?._id;

    // Validate input
    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !paymentId
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Missing payment verification data",
        code: "MISSING_FIELDS",
      });
    }

    // Validate payment ID
    if (!isValidObjectId(paymentId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID format",
        code: "INVALID_ID",
      });
    }

    // Get payment record with booking
    const payment = await Payment.findById(paymentId)
      .populate("booking")
      .session(session);

    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
        code: "PAYMENT_NOT_FOUND",
      });
    }

    if (userId && payment.user?.toString() !== userId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Unauthorized payment access",
        code: "UNAUTHORIZED",
      });
    }

    // Check if payment is already processed
    if (payment.status === "success") {
      await session.commitTransaction();
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        data: {
          paymentId: payment._id,
          bookingId: payment.booking?._id || payment.booking,
          amount: payment.amount,
          status: payment.status,
        },
      });
    }

    if (payment.paymentId && payment.paymentId !== razorpay_order_id) {
      await markPaymentFailed({
        payment,
        booking: payment.booking,
        gatewayResponse: {
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          signature: razorpay_signature,
          error: "Order ID mismatch",
        },
        session,
      });
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: "Order mismatch for this payment",
        code: "ORDER_MISMATCH",
      });
    }

    const signatureValid = verifySignature(
      `${razorpay_order_id}|${razorpay_payment_id}`,
      razorpay_signature,
      process.env.RAZORPAY_KEY_SECRET,
    );

    if (!signatureValid) {
      await markPaymentFailed({
        payment,
        booking: payment.booking,
        gatewayResponse: {
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          signature: razorpay_signature,
          error: "Invalid signature",
        },
        session,
      });
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
        code: "INVALID_SIGNATURE",
      });
    }

    let razorpayPayment = null;
    let fetchError = null;

    try {
      razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (error) {
      fetchError = error;
      console.error("Razorpay fetch error:", error);
    }

    if (razorpayPayment) {
      const amountMatches =
        Number(razorpayPayment.amount) === toPaise(payment.amount);
      const orderMatches = razorpayPayment.order_id === razorpay_order_id;

      if (!amountMatches || !orderMatches) {
        await markPaymentFailed({
          payment,
          booking: payment.booking,
          gatewayResponse: {
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            signature: razorpay_signature,
            status: razorpayPayment.status,
            amount: razorpayPayment.amount,
            error: "Payment data mismatch",
          },
          session,
        });
        await session.commitTransaction();
        return res.status(400).json({
          success: false,
          message: "Payment amount or order mismatch",
          code: "PAYMENT_MISMATCH",
        });
      }
    }

    const seatConversionPayload = await markPaymentSuccess({
      payment,
      booking: payment.booking,
      gatewayResponse: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        signature: razorpay_signature,
        method: razorpayPayment?.method,
        amount: razorpayPayment?.amount,
        status: razorpayPayment?.status,
        verifiedBy: razorpayPayment ? "gateway" : "signature",
        fetchError: fetchError ? fetchError.message : undefined,
      },
      session,
      deferSeatConversion: true,
    });

    await session.commitTransaction();

    if (seatConversionPayload) {
      try {
        await SeatLockService.convertLocksToBooking(seatConversionPayload);
      } catch (lockError) {
        console.error("Error converting locks to booking:", lockError);
      }
    }

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: {
        paymentId: payment._id,
        bookingId: payment.booking?._id || payment.booking,
        amount: payment.amount,
        status: payment.status,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Payment Verification Error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      code: "VERIFICATION_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

// Razorpay webhook handler (production-ready signature verification)
export const handleRazorpayWebhook = async (req, res) => {
  const signatureHeader = req.headers["x-razorpay-signature"];
  const signature = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : signatureHeader;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const rawBody = req.rawBody;

  if (!webhookSecret) {
    return res.status(500).json({
      success: false,
      message: "Webhook secret not configured",
      code: "WEBHOOK_SECRET_MISSING",
    });
  }

  if (!rawBody) {
    return res.status(400).json({
      success: false,
      message: "Webhook raw body missing",
      code: "WEBHOOK_RAW_BODY_MISSING",
    });
  }

  const signatureValid = verifySignature(rawBody, signature, webhookSecret);

  if (!signatureValid) {
    return res.status(400).json({
      success: false,
      message: "Invalid webhook signature",
      code: "WEBHOOK_SIGNATURE_INVALID",
    });
  }

  const event = req.body?.event;
  const paymentEntity = req.body?.payload?.payment?.entity;
  const orderEntity = req.body?.payload?.order?.entity;
  const orderId = paymentEntity?.order_id || orderEntity?.id;

  if (!orderId) {
    return res.status(200).json({ success: true });
  }

  try {
    const payment = await Payment.findOne({ paymentId: orderId }).populate(
      "booking",
    );

    if (!payment) {
      return res.status(200).json({ success: true });
    }

    if (payment.status === "success" && event !== "payment.failed") {
      return res.status(200).json({ success: true });
    }

    const booking = payment.booking;

    let seatConversionPayload = null;

    if (event === "payment.captured" || event === "order.paid") {
      if (payment.status !== "success") {
        const amountMatches = paymentEntity
          ? Number(paymentEntity.amount) === toPaise(payment.amount)
          : true;

        if (!amountMatches) {
          await markPaymentFailed({
            payment,
            booking,
            gatewayResponse: {
              event,
              orderId,
              paymentId: paymentEntity?.id,
              status: paymentEntity?.status,
              amount: paymentEntity?.amount,
              error: "Webhook amount mismatch",
              receivedAt: new Date(),
            },
          });
        } else {
          seatConversionPayload = await markPaymentSuccess({
            payment,
            booking,
            gatewayResponse: {
              event,
              orderId,
              paymentId: paymentEntity?.id,
              status: paymentEntity?.status,
              method: paymentEntity?.method,
              amount: paymentEntity?.amount,
              receivedAt: new Date(),
            },
            deferSeatConversion: true,
          });
        }
      }
    } else if (event === "payment.failed") {
      if (payment.status !== "success") {
        await markPaymentFailed({
          payment,
          booking,
          gatewayResponse: {
            event,
            orderId,
            paymentId: paymentEntity?.id,
            status: paymentEntity?.status,
            error:
              paymentEntity?.error_description ||
              paymentEntity?.error_reason ||
              "Payment failed",
            receivedAt: new Date(),
          },
        });
      }
    }

    if (seatConversionPayload) {
      try {
        await SeatLockService.convertLocksToBooking(seatConversionPayload);
      } catch (lockError) {
        console.error("Error converting locks to booking:", lockError);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Razorpay Webhook Error:", error);
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
      code: "WEBHOOK_ERROR",
    });
  }
};

export const listAdminTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      method,
      currency,
      sort = "-createdAt",
      fromDate,
      toDate,
      bookingId,
      userId,
    } = req.query;

    const pageInt = Number.parseInt(String(page), 10);
    const limitInt = Number.parseInt(String(limit), 10);

    if (!Number.isInteger(pageInt) || pageInt < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid page number",
        code: "INVALID_PAGE",
      });
    }

    if (!Number.isInteger(limitInt) || limitInt < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid limit value",
        code: "INVALID_LIMIT",
      });
    }

    if (limitInt > MAX_ADMIN_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `Maximum limit is ${MAX_ADMIN_LIMIT}`,
        code: "MAX_LIMIT_EXCEEDED",
      });
    }

    const normalizedStatus = normalizeStatus(status, "");
    if (normalizedStatus && !TRANSACTION_STATUS_SET.has(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction status",
        code: "INVALID_STATUS",
      });
    }

    const normalizedMethod =
      typeof method === "string" ? method.trim().toLowerCase() : "";
    if (normalizedMethod && !TRANSACTION_METHOD_SET.has(normalizedMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
        code: "INVALID_METHOD",
      });
    }

    const normalizedCurrency =
      typeof currency === "string" ? currency.trim().toUpperCase() : "";
    if (
      normalizedCurrency &&
      !TRANSACTION_CURRENCY_SET.has(normalizedCurrency)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid currency",
        code: "INVALID_CURRENCY",
      });
    }

    const normalizedBookingRef =
      typeof bookingId === "string" ? bookingId.trim() : "";
    const normalizedUserId = typeof userId === "string" ? userId.trim() : "";

    const from = parseDateQuery(fromDate);
    const to = parseDateQuery(toDate, { endOfDay: true });
    if (fromDate && !from) {
      return res.status(400).json({
        success: false,
        message: "Invalid fromDate format",
        code: "INVALID_DATE",
      });
    }
    if (toDate && !to) {
      return res.status(400).json({
        success: false,
        message: "Invalid toDate format",
        code: "INVALID_DATE",
      });
    }
    if (from && to && from.getTime() > to.getTime()) {
      return res.status(400).json({
        success: false,
        message: "fromDate must be before toDate",
        code: "INVALID_DATE_RANGE",
      });
    }

    const baseConditions = [];

    if (normalizedMethod) {
      baseConditions.push({ method: normalizedMethod });
    }

    if (normalizedCurrency) {
      baseConditions.push({ currency: normalizedCurrency });
    }

    if (normalizedUserId) {
      if (!isValidObjectId(normalizedUserId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format",
          code: "INVALID_USER_ID",
        });
      }
      baseConditions.push({ user: normalizedUserId });
    }

    if (normalizedBookingRef) {
      const booking = await resolveBookingByRef(normalizedBookingRef);
      if (!booking) {
        return res.json({
          success: true,
          page: pageInt,
          limit: limitInt,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrevious: pageInt > 1,
          summary: {
            total: 0,
            pending: 0,
            success: 0,
            failed: 0,
            refunded: 0,
            partial_refund: 0,
          },
          data: [],
        });
      }
      baseConditions.push({ booking: booking._id });
    }

    const createdAtFilter = {};
    if (from) createdAtFilter.$gte = from;
    if (to) createdAtFilter.$lte = to;
    if (Object.keys(createdAtFilter).length > 0) {
      baseConditions.push({ createdAt: createdAtFilter });
    }

    const safeSearch =
      typeof search === "string"
        ? search.trim().slice(0, SEARCH_MAX_LENGTH)
        : "";

    if (safeSearch) {
      const searchRegex = new RegExp(escapeRegex(safeSearch), "i");
      const [bookingMatches, userMatches] = await Promise.all([
        Booking.find({
          $or: [
            { bookingId: searchRegex },
            { boardingPoint: searchRegex },
            { droppingPoint: searchRegex },
          ],
        })
          .select("_id")
          .limit(200)
          .lean(),
        User.find({
          $or: [{ fullName: searchRegex }, { email: searchRegex }, { phone: searchRegex }],
        })
          .select("_id")
          .limit(200)
          .lean(),
      ]);

      const bookingIds = bookingMatches.map((item) => item._id);
      const userIds = userMatches.map((item) => item._id);

      baseConditions.push({
        $or: [
          { paymentId: searchRegex },
          { "gatewayResponse.paymentId": searchRegex },
          { "gatewayResponse.razorpay_payment_id": searchRegex },
          { "gatewayResponse.order.id": searchRegex },
          ...(bookingIds.length ? [{ booking: { $in: bookingIds } }] : []),
          ...(userIds.length ? [{ user: { $in: userIds } }] : []),
        ],
      });
    }

    const summaryQuery =
      baseConditions.length > 0 ? { $and: baseConditions } : {};

    const listConditions = [...baseConditions];
    if (normalizedStatus) {
      listConditions.push({ status: normalizedStatus });
    }
    const query = listConditions.length > 0 ? { $and: listConditions } : {};

    const sortObject = buildSortObject(sort, "-createdAt");

    const [
      rows,
      total,
      summaryTotal,
      pendingCount,
      successCount,
      failedCount,
      refundedCount,
      partialRefundCount,
    ] = await Promise.all([
      getPopulatedPaymentQuery(query)
        .sort(sortObject)
        .skip((pageInt - 1) * limitInt)
        .limit(limitInt)
        .lean(),
      Payment.countDocuments(query),
      Payment.countDocuments(summaryQuery),
      Payment.countDocuments(
        appendAndCondition(summaryQuery, { status: "pending" })
      ),
      Payment.countDocuments(
        appendAndCondition(summaryQuery, { status: "success" })
      ),
      Payment.countDocuments(
        appendAndCondition(summaryQuery, { status: "failed" })
      ),
      Payment.countDocuments(
        appendAndCondition(summaryQuery, { status: "refunded" })
      ),
      Payment.countDocuments(
        appendAndCondition(summaryQuery, { status: "partial_refund" })
      ),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limitInt));
    const hasNext = pageInt < totalPages;
    const hasPrevious = pageInt > 1;

    return res.json({
      success: true,
      page: pageInt,
      limit: limitInt,
      total,
      totalPages,
      hasNext,
      hasPrevious,
      filters: {
        search: safeSearch || null,
        status: normalizedStatus || null,
        method: normalizedMethod || null,
        currency: normalizedCurrency || null,
        sort: typeof sort === "string" ? sort : "-createdAt",
        fromDate: from || null,
        toDate: to || null,
        bookingId: normalizedBookingRef || null,
        userId: normalizedUserId || null,
      },
      summary: {
        total: summaryTotal,
        pending: pendingCount,
        success: successCount,
        failed: failedCount,
        refunded: refundedCount,
        partial_refund: partialRefundCount,
      },
      data: rows.map((item) => formatTransactionRecord(item)),
    });
  } catch (error) {
    console.error("List Transactions Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve transactions",
      code: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getAdminTransactionById = async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID",
        code: "INVALID_ID",
      });
    }

    const transaction = await getPopulatedPaymentQuery({ _id: id }).lean();
    const record = Array.isArray(transaction) ? transaction[0] : null;

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
        code: "TRANSACTION_NOT_FOUND",
      });
    }

    return res.json({
      success: true,
      data: formatTransactionRecord(record),
    });
  } catch (error) {
    console.error("Get Transaction Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve transaction",
      code: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const createAdminTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const {
      bookingId,
      userId,
      paymentId,
      amount,
      currency,
      method,
      status,
      attempts,
      gatewayResponse,
      gatewayReference,
    } = req.body || {};

    const bookingRef = String(bookingId || "").trim();
    if (!bookingRef) {
      return res.status(400).json({
        success: false,
        message: "bookingId is required",
        code: "MISSING_BOOKING_ID",
      });
    }

    session.startTransaction();

    const booking = await resolveBookingByRef(bookingRef, session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        code: "BOOKING_NOT_FOUND",
      });
    }

    if (userId) {
      if (!isValidObjectId(userId)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format",
          code: "INVALID_USER_ID",
        });
      }

      if (booking.user.toString() !== String(userId)) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "bookingId and userId do not match",
          code: "BOOKING_USER_MISMATCH",
        });
      }
    }

    const normalizedStatus = normalizeStatus(status, "pending");
    if (!TRANSACTION_STATUS_SET.has(normalizedStatus)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid transaction status",
        code: "INVALID_STATUS",
      });
    }

    const normalizedMethod =
      typeof method === "string" ? method.trim().toLowerCase() : "razorpay";
    if (!TRANSACTION_METHOD_SET.has(normalizedMethod)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
        code: "INVALID_METHOD",
      });
    }

    const normalizedCurrency =
      typeof currency === "string"
        ? currency.trim().toUpperCase()
        : booking.currency || DEFAULT_CURRENCY;
    if (!TRANSACTION_CURRENCY_SET.has(normalizedCurrency)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid currency",
        code: "INVALID_CURRENCY",
      });
    }

    const amountValue =
      amount === undefined || amount === null ? booking.totalAmount : Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
        code: "INVALID_AMOUNT",
      });
    }

    const attemptsValue =
      attempts === undefined || attempts === null ? 1 : Number(attempts);
    if (!Number.isInteger(attemptsValue) || attemptsValue < 1) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Attempts must be an integer greater than 0",
        code: "INVALID_ATTEMPTS",
      });
    }

    const transactionIdRaw = String(paymentId || "").trim();
    let resolvedPaymentId = transactionIdRaw;
    if (resolvedPaymentId) {
      const duplicate = await Payment.findOne({ paymentId: resolvedPaymentId }).session(
        session
      );
      if (duplicate) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "paymentId already exists",
          code: "PAYMENT_ID_EXISTS",
        });
      }
    } else {
      const bookingRefToken = booking.bookingId || booking._id.toString();
      for (let attemptIndex = 0; attemptIndex < 5; attemptIndex += 1) {
        const candidate = buildManualPaymentId(bookingRefToken);
        const exists = await Payment.findOne({ paymentId: candidate }).session(
          session
        );
        if (!exists) {
          resolvedPaymentId = candidate;
          break;
        }
      }

      if (!resolvedPaymentId) {
        await session.abortTransaction();
        return res.status(500).json({
          success: false,
          message: "Unable to generate unique payment ID",
          code: "PAYMENT_ID_GENERATION_FAILED",
        });
      }
    }

    if (
      gatewayResponse !== undefined &&
      (typeof gatewayResponse !== "object" ||
        gatewayResponse === null ||
        Array.isArray(gatewayResponse))
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "gatewayResponse must be an object",
        code: "INVALID_GATEWAY_RESPONSE",
      });
    }

    const gatewayPayload = {
      ...(gatewayResponse || {}),
      source: "admin-panel",
      createdBy: req.user?._id?.toString() || null,
      createdAt: new Date().toISOString(),
    };
    const gatewayReferenceValue = String(gatewayReference || "").trim();
    if (gatewayReferenceValue) {
      gatewayPayload.paymentId = gatewayReferenceValue;
    }

    const payment = new Payment({
      paymentId: resolvedPaymentId,
      booking: booking._id,
      user: booking.user,
      amount: amountValue,
      currency: normalizedCurrency,
      method: normalizedMethod,
      status: normalizedStatus,
      attempts: attemptsValue,
      gatewayResponse: gatewayPayload,
    });

    await payment.save({ session });

    const seatConversionPayload = await syncBookingWithPayment({
      booking,
      payment,
      session,
      allowSeatConversion: normalizedStatus === "success",
    });

    await session.commitTransaction();

    if (seatConversionPayload) {
      try {
        await SeatLockService.convertLocksToBooking(seatConversionPayload);
      } catch (lockError) {
        console.error("Error converting locks to booking:", lockError);
      }
    }

    const created = await getPopulatedPaymentQuery({ _id: payment._id }).lean();
    const record = Array.isArray(created) ? created[0] : null;

    return res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      data: record ? formatTransactionRecord(record) : null,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Create Transaction Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create transaction",
      code: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

export const updateAdminTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID",
        code: "INVALID_ID",
      });
    }

    const allowedFields = new Set([
      "amount",
      "currency",
      "method",
      "status",
      "attempts",
      "gatewayResponse",
      "gatewayReference",
    ]);

    const updates = {};
    for (const [key, value] of Object.entries(req.body || {})) {
      if (allowedFields.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
        code: "NO_UPDATES",
      });
    }

    session.startTransaction();

    const payment = await Payment.findById(id).populate("booking").session(session);
    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
        code: "TRANSACTION_NOT_FOUND",
      });
    }

    const previousStatus = payment.status;

    if ("amount" in updates) {
      const amountValue = Number(updates.amount);
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Amount must be greater than 0",
          code: "INVALID_AMOUNT",
        });
      }
      payment.amount = amountValue;
    }

    if ("currency" in updates) {
      const normalizedCurrency = String(updates.currency || "")
        .trim()
        .toUpperCase();
      if (!TRANSACTION_CURRENCY_SET.has(normalizedCurrency)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid currency",
          code: "INVALID_CURRENCY",
        });
      }
      payment.currency = normalizedCurrency;
    }

    if ("method" in updates) {
      const normalizedMethod = String(updates.method || "")
        .trim()
        .toLowerCase();
      if (!TRANSACTION_METHOD_SET.has(normalizedMethod)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid payment method",
          code: "INVALID_METHOD",
        });
      }
      payment.method = normalizedMethod;
    }

    if ("status" in updates) {
      const normalizedStatus = normalizeStatus(updates.status, "");
      if (!TRANSACTION_STATUS_SET.has(normalizedStatus)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid transaction status",
          code: "INVALID_STATUS",
        });
      }
      payment.status = normalizedStatus;
    }

    if ("attempts" in updates) {
      const attemptsValue = Number(updates.attempts);
      if (!Number.isInteger(attemptsValue) || attemptsValue < 1) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Attempts must be an integer greater than 0",
          code: "INVALID_ATTEMPTS",
        });
      }
      payment.attempts = attemptsValue;
    }

    if ("gatewayResponse" in updates) {
      if (
        typeof updates.gatewayResponse !== "object" ||
        updates.gatewayResponse === null ||
        Array.isArray(updates.gatewayResponse)
      ) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "gatewayResponse must be an object",
          code: "INVALID_GATEWAY_RESPONSE",
        });
      }
      payment.gatewayResponse = {
        ...(payment.gatewayResponse || {}),
        ...updates.gatewayResponse,
      };
    }

    if ("gatewayReference" in updates) {
      const gatewayReferenceValue = String(updates.gatewayReference || "").trim();
      payment.gatewayResponse = {
        ...(payment.gatewayResponse || {}),
        ...(gatewayReferenceValue
          ? { paymentId: gatewayReferenceValue }
          : {}),
      };
    }

    payment.gatewayResponse = {
      ...(payment.gatewayResponse || {}),
      updatedBy: req.user?._id?.toString() || null,
      updatedAt: new Date().toISOString(),
    };
    payment.updatedAt = new Date();
    await payment.save({ session });

    let seatConversionPayload = null;
    if (payment.booking) {
      seatConversionPayload = await syncBookingWithPayment({
        booking: payment.booking,
        payment,
        session,
        allowSeatConversion:
          previousStatus !== "success" && payment.status === "success",
      });
    }

    await session.commitTransaction();

    if (seatConversionPayload) {
      try {
        await SeatLockService.convertLocksToBooking(seatConversionPayload);
      } catch (lockError) {
        console.error("Error converting locks to booking:", lockError);
      }
    }

    const updated = await getPopulatedPaymentQuery({ _id: payment._id }).lean();
    const record = Array.isArray(updated) ? updated[0] : null;

    return res.status(200).json({
      success: true,
      message: "Transaction updated successfully",
      data: record ? formatTransactionRecord(record) : null,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Update Transaction Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update transaction",
      code: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

export const deleteAdminTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID",
        code: "INVALID_ID",
      });
    }

    session.startTransaction();

    const payment = await Payment.findById(id).populate("booking").session(session);
    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
        code: "TRANSACTION_NOT_FOUND",
      });
    }

    if (SETTLED_TRANSACTION_STATUSES.has(String(payment.status || ""))) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "Settled transactions cannot be deleted",
        code: "DELETE_NOT_ALLOWED",
      });
    }

    const booking = payment.booking;
    if (
      booking &&
      booking.payment &&
      booking.payment.toString() === payment._id.toString()
    ) {
      booking.payment = undefined;
      booking.paymentStatus = "pending";
      if (booking.bookingStatus === "confirmed") {
        booking.bookingStatus = "pending";
      }
      await booking.save({ session });
    }

    await Payment.deleteOne({ _id: payment._id }).session(session);
    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Transaction deleted successfully",
      data: {
        id: payment._id,
        paymentId: payment.paymentId,
      },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Delete Transaction Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete transaction",
      code: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};
