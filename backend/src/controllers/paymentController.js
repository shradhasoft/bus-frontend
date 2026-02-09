import crypto from "crypto";
import razorpay from "../config/razorpay.js";
import { Booking } from "../models/booking.js";
import { Payment } from "../models/payment.js";
import { SeatLockService } from "../services/seatLockService.js";
import mongoose from "mongoose";

// Create Razorpay order (updated to handle seat locks)
export const createRazorpayOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, currency = "INR", bookingId } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!amount || !bookingId) {
      return res.status(400).json({
        success: false,
        message: "Amount and booking ID are required",
        code: "MISSING_FIELDS",
      });
    }

    // Validate amount is a positive number
    const numAmount = Number.parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
        code: "INVALID_AMOUNT",
      });
    }

    // Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID format",
        code: "INVALID_ID",
      });
    }

    // Check booking ownership and status
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking || booking.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Booking not found or unauthorized",
        code: "UNAUTHORIZED",
      });
    }

    // Check if booking is in valid state for payment
    if (booking.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Booking already paid",
        code: "ALREADY_PAID",
      });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(numAmount * 100), // convert to paise and round
      currency,
      receipt: `receipt_${bookingId}`,
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

    // Validate input
    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !paymentId
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification data",
        code: "MISSING_FIELDS",
      });
    }

    // Validate payment ID
    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
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
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
        code: "PAYMENT_NOT_FOUND",
      });
    }

    // Check if payment is already processed
    if (payment.status === "success") {
      return res.status(400).json({
        success: false,
        message: "Payment already verified",
        code: "ALREADY_VERIFIED",
      });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      // Update payment status to failed
      payment.status = "failed";
      payment.gatewayResponse = {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        signature: razorpay_signature,
        error: "Invalid signature",
      };
      await payment.save({ session });

      // Release seat locks on payment failure
      const booking = payment.booking;
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

      await session.commitTransaction();

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
        code: "INVALID_SIGNATURE",
      });
    }

    try {
      // Optional: Fetch payment details from Razorpay to double-check
      const razorpayPayment = await razorpay.payments.fetch(
        razorpay_payment_id
      );

      // Update payment status
      payment.status = "success";
      payment.method = razorpayPayment.method || "razorpay";
      payment.gatewayResponse = {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        signature: razorpay_signature,
        method: razorpayPayment.method,
        amount: razorpayPayment.amount,
        status: razorpayPayment.status,
      };
      payment.updatedAt = new Date();
      await payment.save({ session });

      // Update booking status
      const booking = await Booking.findById(payment.booking).session(session);
      if (booking) {
        booking.paymentStatus = "paid";
        booking.bookingStatus = "confirmed";
        await booking.save({ session });

        // Convert temporary locks to permanent bookings
        if (booking.sessionId) {
          try {
            await SeatLockService.convertLocksToBooking({
              busId: booking.bus,
              userId: booking.user,
              sessionId: booking.sessionId,
              travelDate: booking.travelDate,
              bookingId: booking._id,
            });
          } catch (lockError) {
            console.error("Error converting locks to booking:", lockError);
            // Don't fail the payment if lock conversion fails
            // The booking is still valid, just log the error
          }
        }
      }

      await session.commitTransaction();

      res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        data: {
          paymentId: payment._id,
          bookingId: booking._id,
          amount: payment.amount,
          status: payment.status,
        },
      });
    } catch (razorpayError) {
      console.error("Razorpay fetch error:", razorpayError);

      // Still proceed with verification if signature is valid
      payment.status = "success";
      payment.gatewayResponse = {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        signature: razorpay_signature,
      };
      await payment.save({ session });

      const booking = await Booking.findById(payment.booking).session(session);
      if (booking) {
        booking.paymentStatus = "paid";
        booking.bookingStatus = "confirmed";
        await booking.save({ session });

        // Convert locks to booking
        if (booking.sessionId) {
          try {
            await SeatLockService.convertLocksToBooking({
              busId: booking.bus,
              userId: booking.user,
              sessionId: booking.sessionId,
              travelDate: booking.travelDate,
              bookingId: booking._id,
            });
          } catch (lockError) {
            console.error("Error converting locks to booking:", lockError);
          }
        }
      }

      await session.commitTransaction();

      res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        data: {
          paymentId: payment._id,
          bookingId: booking._id,
          amount: payment.amount,
          status: payment.status,
        },
      });
    }
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
