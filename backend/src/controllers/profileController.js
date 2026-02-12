import { User } from "../models/user.js";

// Helper function for standardize response
const sendResponse = (
  res,
  success,
  code,
  message,
  data = null,
  statusCode = 200
) => {
  const response = {
    success,
    code,
    message,
  };
  if (data) {
    response.data = data;
  }

  if (!success && statusCode === 200) {
    statusCode = 400;
  }
  res.status(statusCode).json(response);
};

export const viewProfileController = async (req, res) => {
  try {
    // Get user ID from the authenticated request
    const userId = req.user._id;

    // Find user with sensitive fields excluded
    const user = await User.findById(userId)
      .select("-password -__v -isActive -isBlocked")
      .populate({
        path: "bookings",
        select: "bus route travelDate passengers totalAmount bookingStatus",
        options: { limit: 5, sort: { createdAt: -1 } },
        populate: [
          { path: "bus", select: "busName busNumber departureTime" },
        ],
      })
      .lean();

    if (!user) {
      return sendResponse(
        res,
        false,
        "USER_NOT_FOUND",
        "User not found",
        null,
        404
      );
    }

    // Format response data
    const profileData = {
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        // age: user.age,
        dob: user.dob ? new Date(user.dob).toISOString().split("T")[0] : null,
        gender: user.gender,
        role: user.role,
        createdAt: user.createdAt,
      },
      // preferences: {
      //   preferredSeatType: user.preferredSeatType,
      //   notificationPreferences: user.notificationPreferences,
      // },
      // recentBookings: user.bookings,
      // stats: {
      //   totalBookings: user.bookings ? user.bookings.length : 0,
      //   memberSince: user.createdAt,
      // },
    };

    sendResponse(
      res,
      true,
      "PROFILE_RETRIEVED",
      "User profile retrieved successfully",
      {
        user: profileData.user,
      }
    );
  } catch (error) {
    console.error("Profile View Error: ", error);
    sendResponse(
      res,
      false,
      "SERVER_ERROR",
      "An error occurred while retrieving the profile",
      process.env.NODE_ENV === "development" ? error.message : undefined,
      500
    );
  }
};

export const viewProfileRoleController = async (req, res) => {
  try {
    const userId = req.user?._id;
    const user = await User.findById(userId).select("role").lean();

    if (!user) {
      return sendResponse(
        res,
        false,
        "USER_NOT_FOUND",
        "User not found",
        null,
        404
      );
    }

    sendResponse(
      res,
      true,
      "ROLE_RETRIEVED",
      "User role retrieved successfully",
      {
        role: user.role,
      }
    );
  } catch (error) {
    console.error("Profile Role Error: ", error);
    sendResponse(
      res,
      false,
      "SERVER_ERROR",
      "An error occurred while retrieving the user role",
      process.env.NODE_ENV === "development" ? error.message : undefined,
      500
    );
  }
};

export const editProfileController = async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;
    const allowedUpdates = ["fullName", "email", "phone", "dob", "gender"];
    const isValidOperation = Object.keys(updates).every((key) =>
      allowedUpdates.includes(key)
    );

    // Validate allowed fields
    if (!isValidOperation) {
      return sendResponse(
        res,
        false,
        "INVALID_FIELDS",
        "Attempted to update restricted fields",
        null,
        400
      );
    }

    // Handle empty updates
    if (Object.keys(updates).length === 0) {
      return sendResponse(
        res,
        false,
        "NO_UPDATES",
        "No valid fields provided for update",
        null,
        400
      );
    }

    // Convert empty phone to null
    if ("phone" in updates && updates.phone === "") {
      updates.phone = null;
    }

    // Format date if provided
    if (updates.dob) {
      updates.dob = new Date(updates.dob);
      if (isNaN(updates.dob.getTime())) {
        return sendResponse(
          res,
          false,
          "INVALID_DATE",
          "Invalid date format for DOB",
          null,
          400
        );
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendResponse(
        res,
        false,
        "USER_NOT_FOUND",
        "User not found",
        null,
        404
      );
    }

    // Check email uniqueness if changed
    if (updates.email && updates.email !== user.email) {
      const emailExists = await User.findOne({ email: updates.email });
      if (emailExists) {
        return sendResponse(
          res,
          false,
          "EMAIL_EXISTS",
          "Email already in use",
          null,
          409
        );
      }
    }

    // Check email is same as current email
    // if ("email" in updates && updates.email === user.email) {
    //   return sendResponse(
    //     res,
    //     false,
    //     "NO_CHANGE",
    //     "Email is the same as current email",
    //     null,
    //     400
    //   );
    // }

    // Check phone uniqueness if changed
    if ("phone" in updates && updates.phone !== user.phone) {
      if (updates.phone) {
        const phoneExists = await User.findOne({ phone: updates.phone });
        if (phoneExists) {
          return sendResponse(
            res,
            false,
            "PHONE_EXISTS",
            "Phone number already in use",
            null,
            409
          );
        }
      }
    }

    // Check phone is same as current phone
    // if ("phone" in updates && updates.phone === user.phone) {
    //   return sendResponse(
    //     res,
    //     false,
    //     "NO_CHANGE",
    //     "Phone number is the same as current phone number",
    //     null,
    //     400
    //   );
    // }

    // Apply updates
    Object.assign(user, updates);
    await user.save();

    // Format response
    const responseData = {
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        dob: user.dob ? user.dob.toISOString().split("T")[0] : null,
        gender: user.gender,
        role: user.role,
        createdAt: user.createdAt,
      },
    };

    sendResponse(
      res,
      true,
      "PROFILE_UPDATED",
      "Profile updated successfully",
      responseData
    );
  } catch (error) {
    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return sendResponse(
        res,
        false,
        "VALIDATION_ERROR",
        "Validation failed",
        { errors },
        400
      );
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return sendResponse(
        res,
        false,
        "DUPLICATE_KEY",
        `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
        null,
        409
      );
    }

    console.error("Profile Update Error: ", error);
    sendResponse(
      res,
      false,
      "SERVER_ERROR",
      "An error occurred while updating profile",
      process.env.NODE_ENV === "development" ? error.message : undefined,
      500
    );
  }
};
