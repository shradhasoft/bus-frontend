import express from "express";
import {
  createRazorpayOrder,
  handleRazorpayWebhook,
  verifyPayment,
  listAdminTransactions,
  getAdminTransactionById,
  createAdminTransaction,
  updateAdminTransaction,
  deleteAdminTransaction,
} from "../controllers/paymentController.js";
import { authorize, protect } from "../middlewares/authMiddleware.js";

const paymentRouter = express.Router();

paymentRouter.post("/payment/razorpay/webhook", handleRazorpayWebhook);
paymentRouter.post("/create-order", protect, createRazorpayOrder);
paymentRouter.post("/verify/:paymentId", protect, verifyPayment);
paymentRouter.get(
  "/admin/transactions",
  protect,
  authorize("admin", "superadmin"),
  listAdminTransactions
);
paymentRouter.post(
  "/admin/transactions",
  protect,
  authorize("admin", "superadmin"),
  createAdminTransaction
);
paymentRouter.get(
  "/admin/transactions/:id",
  protect,
  authorize("admin", "superadmin"),
  getAdminTransactionById
);
paymentRouter.patch(
  "/admin/transactions/:id",
  protect,
  authorize("admin", "superadmin"),
  updateAdminTransaction
);
paymentRouter.delete(
  "/admin/transactions/:id",
  protect,
  authorize("admin", "superadmin"),
  deleteAdminTransaction
);

export default paymentRouter;
