import { Offer } from "../models/offer.js";
import { Route } from "../models/route.js";
import { Bus } from "../models/bus.js";
import { User } from "../models/user.js";
import mongoose from "mongoose";

// Controller for createOffer
export const createOffer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const {
      title,
      description,
      code,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      validFrom,
      validUntil,
      isActive = true,
      applicableFor = "all",
      specificRoutes = [],
      specificBuses = [],
      specificUsers = [],
      usageLimit,
    } = req.body;

    // Validate references
    const validateReferences = async (ids, model, fieldName) => {
      if (!ids || ids.length === 0) return true;

      const exists = await model
        .countDocuments({
          _id: { $in: ids },
        })
        .session(session);

      return exists === ids.length;
    };

    const validations = [
      { ids: specificRoutes, model: Route, field: "specificRoutes" },
      { ids: specificBuses, model: Bus, field: "specificBuses" },
      { ids: specificUsers, model: User, field: "specificUsers" },
    ];

    for (const validation of validations) {
      if (
        !(await validateReferences(
          validation.ids,
          validation.model,
          validation.field
        ))
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${validation.field} references`,
          code: `INVALID_${validation.field.toUpperCase()}`,
        });
      }
    }

    // Check for duplicate code
    const existingOffer = await Offer.findOne({ code }).session(session);
    if (existingOffer) {
      return res.status(409).json({
        success: false,
        message: "Offer code already exists",
        code: "DUPLICATE_CODE",
      });
    }

    // Create offer
    const offer = new Offer({
      title,
      description,
      code,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: new Date(validUntil),
      isActive,
      applicableFor,
      specificRoutes,
      specificBuses,
      specificUsers,
      usageLimit,
      createdBy: userId,
    });

    await offer.save({ session });
    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: "Offer created successfully",
      data: offer,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Create Offer Error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        errors,
        code: "VALIDATION_ERROR",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  } finally {
    session.endSession();
  }
};

// Controller for get all the offers
export const getAllOffers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = "active",
      discountType,
      applicableFor,
      search,
      sort = "-createdAt",
    } = req.query;

    // Validate parameters
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);

    if (isNaN(pageInt) || pageInt < 1)
      return res.status(400).json({
        success: false,
        message: "Invalid page number",
        code: "INVALID_PAGE",
      });

    if (isNaN(limitInt) || limitInt < 1)
      return res.status(400).json({
        success: false,
        message: "Invalid limit value",
        code: "INVALID_LIMIT",
      });

    if (limitInt > 50)
      return res.status(400).json({
        success: false,
        message: "Maximum limit is 50",
        code: "MAX_LIMIT_EXCEEDED",
      });

    // Build query
    const query = {};
    const now = new Date();

    // Status filter
    if (status === "active") {
      query.isActive = true;
      query.validFrom = { $lte: now };
      query.validUntil = { $gte: now };
    } else if (status === "expired") {
      query.$or = [{ validUntil: { $lt: now } }, { isActive: false }];
    } else if (status === "upcoming") {
      query.isActive = true;
      query.validFrom = { $gt: now };
    } else if (status === "all") {
      // No additional filters
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid status value. Use: active, expired, upcoming, or all",
        code: "INVALID_STATUS",
      });
    }

    // Discount type filter
    if (discountType && ["percentage", "fixed"].includes(discountType)) {
      query.discountType = discountType;
    }

    // Applicable for filter
    if (
      applicableFor &&
      ["all", "routes", "buses", "users"].includes(applicableFor)
    ) {
      query.applicableFor = applicableFor;
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { code: searchRegex },
      ];
    }

    // Get offers with pagination
    const [offers, total] = await Promise.all([
      Offer.find(query)
        .sort(sort)
        .skip((pageInt - 1) * limitInt)
        .limit(limitInt)
        .populate("specificRoutes", "routeCode origin destination")
        .populate("specificBuses", "busName busNumber")
        .populate("specificUsers", "fullName email")
        .populate("createdBy", "fullName email")
        .lean(),

      Offer.countDocuments(query),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limitInt);
    const hasNext = pageInt < totalPages;
    const hasPrevious = pageInt > 1;

    res.json({
      success: true,
      page: pageInt,
      limit: limitInt,
      total,
      totalPages,
      hasNext,
      hasPrevious,
      data: offers,
    });
  } catch (error) {
    console.error("Get Offers Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

// Controller for get all active offers
export const getActiveOffers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, sort = "-createdAt" } = req.query;

    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);

    if (isNaN(pageInt) || pageInt < 1)
      return res.status(400).json({
        success: false,
        message: "Invalid page number",
        code: "INVALID_PAGE",
      });

    if (isNaN(limitInt) || limitInt < 1)
      return res.status(400).json({
        success: false,
        message: "Invalid limit value",
        code: "INVALID_LIMIT",
      });

    if (limitInt > 50)
      return res.status(400).json({
        success: false,
        message: "Maximum limit is 50",
        code: "MAX_LIMIT_EXCEEDED",
      });

    const now = new Date();

    // Build query for active offers
    const query = {
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $expr: {
        $or: [
          { $eq: ["$usageLimit", null] },
          { $lt: ["$usedCount", "$usageLimit"] },
        ],
      },
    };

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { code: searchRegex },
      ];
    }

    // Fetch offers with pagination
    const [offers, total] = await Promise.all([
      Offer.find(query)
        .sort(sort)
        .skip((pageInt - 1) * limitInt)
        .limit(limitInt)
        .populate("specificRoutes", "routeCode origin destination")
        .populate("specificBuses", "busName busNumber")
        .populate("specificUsers", "fullName email")
        .populate("createdBy", "fullName email")
        .lean(),
      Offer.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limitInt);
    const hasNext = pageInt < totalPages;
    const hasPrevious = pageInt > 1;

    res.json({
      success: true,
      page: pageInt,
      limit: limitInt,
      total,
      totalPages,
      hasNext,
      hasPrevious,
      data: offers,
    });
  } catch (error) {
    console.error("Get Active Offers Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

// Controller to edit the offer
export const updateOffer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const userId = req.user._id;
    const updates = req.body;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer ID format",
        code: "INVALID_ID",
      });
    }

    // Find offer
    const offer = await Offer.findById(id).session(session);
    if (!offer || offer.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
        code: "OFFER_NOT_FOUND",
      });
    }

    // Check if updating code
    if (updates.code && updates.code !== offer.code) {
      const existingOffer = await Offer.findOne({
        code: updates.code.toUpperCase(),
      }).session(session);

      if (existingOffer) {
        return res.status(409).json({
          success: false,
          message: "Offer code already exists",
          code: "DUPLICATE_CODE",
        });
      }
    }

    // Validate references
    const validateReferences = async (ids, model, fieldName) => {
      if (!ids || ids.length === 0) return true;

      const exists = await model
        .countDocuments({
          _id: { $in: ids },
          isDeleted: false,
        })
        .session(session);

      return exists === ids.length;
    };

    const validations = [];
    if (updates.specificRoutes)
      validations.push({
        ids: updates.specificRoutes,
        model: Route,
        field: "specificRoutes",
      });
    if (updates.specificBuses)
      validations.push({
        ids: updates.specificBuses,
        model: Bus,
        field: "specificBuses",
      });
    if (updates.specificUsers)
      validations.push({
        ids: updates.specificUsers,
        model: User,
        field: "specificUsers",
      });

    for (const validation of validations) {
      if (
        !(await validateReferences(
          validation.ids,
          validation.model,
          validation.field
        ))
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${validation.field} references`,
          code: `INVALID_${validation.field.toUpperCase()}`,
        });
      }
    }

    // Apply updates
    const allowedUpdates = [
      "title",
      "description",
      "code",
      "discountType",
      "discountValue",
      "minOrderAmount",
      "maxDiscountAmount",
      "validFrom",
      "validUntil",
      "isActive",
      "applicableFor",
      "specificRoutes",
      "specificBuses",
      "specificUsers",
      "usageLimit",
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        offer[field] = updates[field];
      }
    });

    // Format code to uppercase
    if (updates.code) {
      offer.code = offer.code.toUpperCase();
    }

    // Update metadata
    offer.updatedBy = userId;
    offer.updatedAt = new Date();

    // Save changes
    await offer.save({ session });
    await session.commitTransaction();

    // Get updated offer
    const updatedOffer = await Offer.findById(id)
      .populate("specificRoutes", "routeCode origin destination")
      .populate("specificBuses", "busName busNumber")
      .populate("specificUsers", "fullName email")
      .populate("createdBy", "fullName email")
      .lean();

    res.json({
      success: true,
      message: "Offer updated successfully",
      data: updatedOffer,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Update Offer Error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        errors,
        code: "VALIDATION_ERROR",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  } finally {
    session.endSession();
  }
};

// Controller to delete the offer
export const deleteOffer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer ID format",
        code: "INVALID_ID",
      });
    }

    // Find offer
    const offer = await Offer.findById(id).session(session);
    if (!offer || offer.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
        code: "OFFER_NOT_FOUND",
      });
    }

    // Soft delete offer
    offer.isDeleted = true;
    offer.isActive = false;
    offer.updatedBy = userId;
    await offer.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Offer deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Delete Offer Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  } finally {
    session.endSession();
  }
};
