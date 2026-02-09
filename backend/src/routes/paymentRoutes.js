import express from "express";
import {
  createRazorpayOrder,
  verifyPayment,
} from "../controllers/paymentController.js";
import { protect } from "../middlewares/authMiddleware.js";

const paymentRouter = express.Router();

paymentRouter.post("/create-order", protect, createRazorpayOrder);
paymentRouter.post("/verify/:paymentId", protect, verifyPayment);

export default paymentRouter;
