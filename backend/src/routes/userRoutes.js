import express from "express";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import {
  listUsersController,
  getUserController,
  createUserController,
  updateUserController,
  deleteUserController,
} from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.get(
  "/admin/users",
  protect,
  authorize("admin", "superadmin"),
  listUsersController
);

userRouter.post(
  "/admin/users",
  protect,
  authorize("admin", "superadmin"),
  createUserController
);

userRouter.get(
  "/admin/users/:id",
  protect,
  authorize("admin", "superadmin"),
  getUserController
);

userRouter.patch(
  "/admin/users/:id",
  protect,
  authorize("admin", "superadmin"),
  updateUserController
);

userRouter.delete(
  "/admin/users/:id",
  protect,
  authorize("admin", "superadmin"),
  deleteUserController
);

export default userRouter;
