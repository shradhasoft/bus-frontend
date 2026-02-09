import express from "express";
const helpRouter = express.Router();

import { helpController } from "../controllers/helpController.js";
import { protect } from "../middlewares/authMiddleware.js";

helpRouter.post("/help/send-message",protect, helpController);

export default helpRouter;
