import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be at least 1"],
    },
    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD", "EUR"],
    },
    method: {
      type: String,
      enum: [
        "credit_card",
        "debit_card",
        "netbanking",
        "upi",
        "wallet",
        "razorpay", // Add this for generic razorpay payments
        "card", // Add generic card
        "emi",
      ],
      default: "razorpay", // Set default value
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "refunded", "partial_refund"],
      required: true,
      default: "pending",
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    refunds: [
      {
        amount: {
          type: Number,
          min: 0,
        },
        reason: String,
        processedAt: {
          type: Date,
          default: Date.now,
        },
        gatewayRefundId: String,
        status: {
          type: String,
          enum: ["pending", "processed", "failed"],
          default: "pending",
        },
      },
    ],
    attempts: {
      type: Number,
      default: 1,
      min: 1,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: false, // We're handling timestamps manually
  }
);

// Virtual for total refund amount
paymentSchema.virtual("totalRefundAmount").get(function () {
  return this.refunds.reduce((total, refund) => {
    return refund.status === "processed" ? total + refund.amount : total;
  }, 0);
});

// Pre-save middleware to update updatedAt
paymentSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Indexes for better query performance
paymentSchema.index({ paymentId: 1 }, { unique: true });
paymentSchema.index({ user: 1 });
paymentSchema.index({ booking: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ "gatewayResponse.paymentId": 1 }); // For Razorpay payment ID

// Instance methods
paymentSchema.methods.addRefund = function (amount, reason, gatewayRefundId) {
  this.refunds.push({
    amount,
    reason,
    gatewayRefundId,
    processedAt: new Date(),
    status: "processed",
  });

  // Update payment status based on refund
  const totalRefunded = this.totalRefundAmount + amount;
  if (totalRefunded >= this.amount) {
    this.status = "refunded";
  } else {
    this.status = "partial_refund";
  }

  return this.save();
};

paymentSchema.methods.markAsSuccess = function (gatewayResponse) {
  this.status = "success";
  this.gatewayResponse = { ...this.gatewayResponse, ...gatewayResponse };
  this.updatedAt = new Date();
  return this.save();
};

paymentSchema.methods.markAsFailed = function (error) {
  this.status = "failed";
  this.gatewayResponse = {
    ...this.gatewayResponse,
    error: error.message || error,
    failedAt: new Date(),
  };
  this.updatedAt = new Date();
  return this.save();
};

export const Payment =
  mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
