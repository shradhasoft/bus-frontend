import mongoose from "mongoose";

const helpMessageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    minLength: 3,
    maxLength: 50,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    lowercase: true,
    trim: true,
    match: [/\S+@\S+\.\S+/, "Invalid email format"],
  },
  message: {
    type: String,
    required: [true, "Message is required"],
    trim: true,
    minLength: [10, "Message must be at least 10 characters"],
    maxLength: [500, "Message must be less than 500 characters"],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const HelpMessage = mongoose.models.HelpMessage || mongoose.model("HelpMessage", helpMessageSchema);

