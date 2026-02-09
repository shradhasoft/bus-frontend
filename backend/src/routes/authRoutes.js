import express from "express";
const authRouter = express.Router();

import { firebaseAuth, logout } from "../controllers/firebaseAuthController.js";

authRouter.post("/firebase-auth", firebaseAuth);
authRouter.post("/logout", logout);

export default authRouter;
