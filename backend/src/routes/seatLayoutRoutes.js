import express from "express";
import { getBusSeatLayout } from "../controllers/busController.js";
import {protect} from "../middlewares/authMiddleware.js"

const seatLayoutRouter = express.Router();

seatLayoutRouter.get("/seatlayout",protect, getBusSeatLayout);

export default seatLayoutRouter;
