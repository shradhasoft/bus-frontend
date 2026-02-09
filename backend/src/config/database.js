// src/config/database.js
import mongoose from "mongoose";

const connectDB = async () => {
  await mongoose.connect(process.env.DB_CONNECTION_SECRET);
};

export default connectDB;
