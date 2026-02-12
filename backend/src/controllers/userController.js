import { User } from "../models/user.js";
import { auth as firebaseAdminAuth } from "../utils/firebase-admin.js";

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

const normalizeEmail = (email) => {
  if (typeof email !== "string") return undefined;
  const normalized = email.trim().toLowerCase();
  return normalized || undefined;
};

export const listUsersController = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const pageInt = Number.parseInt(page, 10);
    const limitInt = Number.parseInt(limit, 10);

    if (Number.isNaN(pageInt) || pageInt < 1) {
      return sendResponse(
        res,
        false,
        "INVALID_PAGE",
        "Invalid page number",
        null,
        400
      );
    }

    if (Number.isNaN(limitInt) || limitInt < 1) {
      return sendResponse(
        res,
        false,
        "INVALID_LIMIT",
        "Invalid limit value",
        null,
        400
      );
    }

    if (limitInt > 100) {
      return sendResponse(
        res,
        false,
        "MAX_LIMIT_EXCEEDED",
        "Maximum limit is 100",
        null,
        400
      );
    }

    const query = {};
    if (typeof role === "string" && role.trim()) {
      query.role = role.trim().toLowerCase();
    }
    if (typeof search === "string" && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { fullName: regex },
        { email: regex },
        { phone: regex },
        { firebaseUID: regex },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select(
          "fullName email phone role firebaseUID isActive isBlocked createdAt updatedAt"
        )
        .sort({ createdAt: -1 })
        .skip((pageInt - 1) * limitInt)
        .limit(limitInt)
        .lean(),
      User.countDocuments(query),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limitInt));
    const hasNext = pageInt < totalPages;
    const hasPrevious = pageInt > 1;

    return sendResponse(
      res,
      true,
      "USERS_RETRIEVED",
      "Users retrieved successfully",
      {
        users,
        page: pageInt,
        limit: limitInt,
        total,
        totalPages,
        hasNext,
        hasPrevious,
      }
    );
  } catch (error) {
    console.error("User list error:", error);
    return sendResponse(
      res,
      false,
      "SERVER_ERROR",
      "An error occurred while retrieving users",
      process.env.NODE_ENV === "development" ? error.message : undefined,
      500
    );
  }
};

export const getUserController = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select(
        "fullName email phone role firebaseUID isActive isBlocked createdAt updatedAt"
      )
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

    return sendResponse(
      res,
      true,
      "USER_RETRIEVED",
      "User retrieved successfully",
      { user }
    );
  } catch (error) {
    console.error("Get user error:", error);
    return sendResponse(
      res,
      false,
      "SERVER_ERROR",
      "An error occurred while retrieving the user",
      process.env.NODE_ENV === "development" ? error.message : undefined,
      500
    );
  }
};

export const createUserController = async (req, res) => {
  try {
    const { fullName, email, phone, role, isActive, isBlocked } = req.body;

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone =
      typeof phone === "string" && phone.trim() ? phone.trim() : undefined;

    if (!normalizedEmail && !normalizedPhone) {
      return sendResponse(
        res,
        false,
        "EMAIL_OR_PHONE_REQUIRED",
        "Email or phone is required to create a user",
        null,
        400
      );
    }

    if (normalizedEmail) {
      const emailExists = await User.findOne({ email: normalizedEmail });
      if (emailExists) {
        return sendResponse(
          res,
          false,
          "EMAIL_EXISTS",
          "Email is already in use",
          null,
          409
        );
      }
    }

    if (normalizedPhone) {
      const phoneExists = await User.findOne({ phone: normalizedPhone });
      if (phoneExists) {
        return sendResponse(
          res,
          false,
          "PHONE_EXISTS",
          "Phone number is already in use",
          null,
          409
        );
      }
    }

    let firebaseUser;
    try {
      firebaseUser = await firebaseAdminAuth.createUser({
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        displayName:
          typeof fullName === "string" ? fullName.trim() || undefined : undefined,
        disabled: isActive === false || isBlocked === true,
      });
    } catch (error) {
      const code = error?.code;
      if (code === "auth/email-already-exists") {
        return sendResponse(
          res,
          false,
          "EMAIL_EXISTS",
          "Email is already in use",
          null,
          409
        );
      }
      if (code === "auth/phone-number-already-exists") {
        return sendResponse(
          res,
          false,
          "PHONE_EXISTS",
          "Phone number is already in use",
          null,
          409
        );
      }
      if (code === "auth/invalid-phone-number") {
        return sendResponse(
          res,
          false,
          "INVALID_PHONE",
          "Phone number is not valid",
          null,
          400
        );
      }
      if (code === "auth/invalid-email") {
        return sendResponse(
          res,
          false,
          "INVALID_EMAIL",
          "Email is not valid",
          null,
          400
        );
      }

      console.error("Firebase create user error:", error);
      return sendResponse(
        res,
        false,
        "FIREBASE_CREATE_FAILED",
        "Failed to create Firebase user",
        process.env.NODE_ENV === "development" ? error.message : undefined,
        502
      );
    }

    let newUser;
    try {
      newUser = await User.create({
        fullName: typeof fullName === "string" ? fullName.trim() : undefined,
        email: normalizedEmail || undefined,
        phone: normalizedPhone,
        role: role || "user",
        firebaseUID: firebaseUser.uid,
        isActive: typeof isActive === "boolean" ? isActive : true,
        isBlocked: typeof isBlocked === "boolean" ? isBlocked : false,
      });
    } catch (error) {
      if (firebaseUser?.uid) {
        try {
          await firebaseAdminAuth.deleteUser(firebaseUser.uid);
        } catch (cleanupError) {
          console.error("Firebase cleanup error:", cleanupError);
        }
      }
      throw error;
    }

    return sendResponse(
      res,
      true,
      "USER_CREATED",
      "User created successfully",
      {
        user: newUser,
      },
      201
    );
  } catch (error) {
    console.error("Create user error:", error);
    return sendResponse(
      res,
      false,
      "SERVER_ERROR",
      "An error occurred while creating the user",
      process.env.NODE_ENV === "development" ? error.message : undefined,
      500
    );
  }
};

export const updateUserController = async (req, res) => {
  try {
    const allowedUpdates = [
      "fullName",
      "email",
      "phone",
      "role",
      "isActive",
      "isBlocked",
    ];

    const updates = {};
    allowedUpdates.forEach((field) => {
      if (field in req.body) {
        updates[field] = req.body[field];
      }
    });

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

    if ("email" in updates) {
      updates.email = normalizeEmail(updates.email) || undefined;
      if (updates.email) {
        const emailExists = await User.findOne({
          email: updates.email,
          _id: { $ne: req.params.id },
        });
        if (emailExists) {
          return sendResponse(
            res,
            false,
            "EMAIL_EXISTS",
            "Email is already in use",
            null,
            409
          );
        }
      }
    }

    if ("phone" in updates) {
      updates.phone =
        typeof updates.phone === "string" && updates.phone.trim()
          ? updates.phone.trim()
          : undefined;
    }

    if (updates.phone) {
      const phoneExists = await User.findOne({
        phone: updates.phone,
        _id: { $ne: req.params.id },
      });
      if (phoneExists) {
        return sendResponse(
          res,
          false,
          "PHONE_EXISTS",
          "Phone number is already in use",
          null,
          409
        );
      }
    }

    if ("fullName" in updates) {
      updates.fullName =
        typeof updates.fullName === "string"
          ? updates.fullName.trim()
          : undefined;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedUser) {
      return sendResponse(
        res,
        false,
        "USER_NOT_FOUND",
        "User not found",
        null,
        404
      );
    }

    return sendResponse(
      res,
      true,
      "USER_UPDATED",
      "User updated successfully",
      { user: updatedUser }
    );
  } catch (error) {
    console.error("Update user error:", error);
    return sendResponse(
      res,
      false,
      "SERVER_ERROR",
      "An error occurred while updating the user",
      process.env.NODE_ENV === "development" ? error.message : undefined,
      500
    );
  }
};

export const deleteUserController = async (req, res) => {
  try {
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) {
      return sendResponse(
        res,
        false,
        "USER_NOT_FOUND",
        "User not found",
        null,
        404
      );
    }

    if (existingUser.firebaseUID) {
      try {
        await firebaseAdminAuth.deleteUser(existingUser.firebaseUID);
      } catch (error) {
        if (error?.code !== "auth/user-not-found") {
          console.error("Firebase delete error:", error);
          return sendResponse(
            res,
            false,
            "FIREBASE_DELETE_FAILED",
            "Failed to delete Firebase user",
            process.env.NODE_ENV === "development" ? error.message : undefined,
            502
          );
        }
      }
    }

    await existingUser.deleteOne();

    return sendResponse(
      res,
      true,
      "USER_DELETED",
      "User deleted successfully",
      { user: existingUser }
    );
  } catch (error) {
    console.error("Delete user error:", error);
    return sendResponse(
      res,
      false,
      "SERVER_ERROR",
      "An error occurred while deleting the user",
      process.env.NODE_ENV === "development" ? error.message : undefined,
      500
    );
  }
};
