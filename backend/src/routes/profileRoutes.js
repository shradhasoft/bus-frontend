import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  editProfileController,
  viewProfileController,
  viewProfileRoleController,
} from "../controllers/profileController.js";

const profileRouter = express.Router();

profileRouter.get("/profile/view", protect, viewProfileController);
profileRouter.get("/profile/role", protect, viewProfileRoleController);
profileRouter.patch("/profile/update", protect, editProfileController);

export default profileRouter;
