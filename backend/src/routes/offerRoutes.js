import express from "express";
import {
  createOffer,
  deleteOffer,
  getActiveOffers,
  getAllOffers,
  updateOffer,
} from "../controllers/offerController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import {
  validateOfferCreation,
  validateOfferUpdate,
} from "../middlewares/validationMiddleware.js";

const offerRouter = express.Router();

offerRouter.post(
  "/createoffer",
  protect,
  authorize("admin"),
  validateOfferCreation,
  createOffer
);

offerRouter.get("/getalloffers", protect, authorize("admin"), getAllOffers);
offerRouter.get("/getactiveoffers", protect, getActiveOffers);
offerRouter.patch(
  "/updateoffer/:id",
  protect,
  validateOfferUpdate,
  updateOffer
);
offerRouter.delete("/deleteoffer/:id", protect, deleteOffer);

export default offerRouter;
