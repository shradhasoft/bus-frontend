import express from "express";
const authRouter = express.Router();

import { firebaseAuth, logout } from "../controllers/firebaseAuthController.js";
import {
  getImpersonationStatus,
  startImpersonation,
  stopImpersonation,
} from "../controllers/impersonationController.js";
import { protect } from "../middlewares/authMiddleware.js";

authRouter.post("/firebase-auth", firebaseAuth);
authRouter.post("/logout", logout);
authRouter.post("/admin/impersonation/start", protect, startImpersonation);
authRouter.post("/admin/impersonation/stop", protect, stopImpersonation);
authRouter.get("/admin/impersonation/status", protect, getImpersonationStatus);

export default authRouter;
