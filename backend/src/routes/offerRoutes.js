import express from "express";
import {
  createOffer,
  createAdminOffer,
  deleteOffer,
  deleteAdminOffer,
  getActiveOffers,
  getAllOffers,
  getAdminOfferById,
  listAdminOffers,
  listPublicOffers,
  previewOffer,
  updateOffer,
  updateAdminOffer,
} from "../controllers/offerController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import {
  validateOfferCreation,
  validateOfferUpdate,
} from "../middlewares/validationMiddleware.js";

const offerRouter = express.Router();

// New public offer endpoints
offerRouter.get("/offers", listPublicOffers);
offerRouter.post("/offers/preview", protect, previewOffer);

// New admin/super-admin offer CRUD endpoints
offerRouter.get(
  "/admin/offers",
  protect,
  authorize("admin", "superadmin"),
  listAdminOffers
);
offerRouter.post(
  "/admin/offers",
  protect,
  authorize("admin", "superadmin"),
  createAdminOffer
);
offerRouter.get(
  "/admin/offers/:id",
  protect,
  authorize("admin", "superadmin"),
  getAdminOfferById
);
offerRouter.patch(
  "/admin/offers/:id",
  protect,
  authorize("admin", "superadmin"),
  updateAdminOffer
);
offerRouter.delete(
  "/admin/offers/:id",
  protect,
  authorize("admin", "superadmin"),
  deleteAdminOffer
);

// Legacy endpoints (compatibility mode)
offerRouter.post(
  "/createoffer",
  protect,
  authorize("admin", "superadmin"),
  validateOfferCreation,
  createOffer
);

offerRouter.get(
  "/getalloffers",
  protect,
  authorize("admin", "superadmin"),
  getAllOffers
);
offerRouter.get("/getactiveoffers", protect, getActiveOffers);
offerRouter.patch(
  "/updateoffer/:id",
  protect,
  authorize("admin", "superadmin"),
  validateOfferUpdate,
  updateOffer
);
offerRouter.delete(
  "/deleteoffer/:id",
  protect,
  authorize("admin", "superadmin"),
  deleteOffer
);

export default offerRouter;
