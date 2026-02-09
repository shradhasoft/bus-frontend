// src/models/user.js
import mongoose, { Schema } from "mongoose";
import validator from "validator";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: false,
      minLength: 3,
      maxLength: 50,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      validate(value) {
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new Error("Email is not valid");
        }
      },
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      validate: {
        validator: (v) => !v || /^\+[1-9]\d{1,14}$/.test(v),
        message: "Phone must be in E.164 format",
      },
    },
    firebaseUID: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ["user", "admin", "owner", "superadmin", "conductor"],
      default: "user",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    dob: {
      type: Date,
    },
    gender: {
      type: String,
      validate(value) {
        if (!["Male", "Female", "Other"].includes(value)) {
          throw new Error("Gender data is not valid: " + value);
        }
      },
    },
    bookings: [{ type: Schema.Types.ObjectId, ref: "Booking" }],
  },
  { timestamps: true }
);

userSchema.methods.getJWT = function () {
  return jwt.sign({ _id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

export const User = mongoose.models.User || mongoose.model("User", userSchema);
