import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  editProfileController,
  viewProfileController,
} from "../controllers/profileController.js";

const profileRouter = express.Router();

profileRouter.get("/profile/view", protect, viewProfileController);
profileRouter.patch("/profile/update", protect, editProfileController);

export default profileRouter;
