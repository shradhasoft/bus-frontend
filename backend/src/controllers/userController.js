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

const normalizePhone = (phone) => {
  if (typeof phone !== "string") return undefined;
  const normalized = phone.trim();
  return normalized || undefined;
};

const ALLOWED_ROLES = new Set([
  "user",
  "admin",
  "owner",
  "superadmin",
  "conductor",
]);

const getRequesterRole = (req) => String(req.user?.role || "").toLowerCase();

const canAssignRole = (requesterRole, targetRole) => {
  if (requesterRole === "superadmin") return true;
  if (requesterRole === "admin") return targetRole !== "superadmin";
  return false;
};

const canManageRole = (requesterRole, existingRole) => {
  if (requesterRole === "superadmin") return true;
  if (requesterRole === "admin") return existingRole !== "superadmin";
  return false;
};

const respondFirebaseIdentityError = (res, error, { createPhase }) => {
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

  console.error(
    createPhase ? "Firebase create user error:" : "Firebase update user error:",
    error
  );
  return sendResponse(
    res,
    false,
    createPhase ? "FIREBASE_CREATE_FAILED" : "FIREBASE_UPDATE_FAILED",
    createPhase ? "Failed to create Firebase user" : "Failed to update Firebase user",
    process.env.NODE_ENV === "development" ? error.message : undefined,
    502
  );
};

const respondMongoUniqueError = (res, error) => {
  if (error?.code !== 11000) return false;

  if (error?.keyPattern?.email) {
    sendResponse(res, false, "EMAIL_EXISTS", "Email is already in use", null, 409);
    return true;
  }

  if (error?.keyPattern?.phone) {
    sendResponse(
      res,
      false,
      "PHONE_EXISTS",
      "Phone number is already in use",
      null,
      409
    );
    return true;
  }

  if (error?.keyPattern?.firebaseUID) {
    sendResponse(
      res,
      false,
      "FIREBASE_UID_EXISTS",
      "Firebase account is already linked",
      null,
      409
    );
    return true;
  }

  sendResponse(res, false, "CONFLICT", "Resource conflict", null, 409);
  return true;
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
    const requesterRole = getRequesterRole(req);

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const normalizedRole =
      typeof role === "string" && role.trim()
        ? role.trim().toLowerCase()
        : "user";
    const trimmedFullName =
      typeof fullName === "string" ? fullName.trim() || undefined : undefined;
    const targetIsActive = typeof isActive === "boolean" ? isActive : true;
    const targetIsBlocked = typeof isBlocked === "boolean" ? isBlocked : false;

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

    if (!ALLOWED_ROLES.has(normalizedRole)) {
      return sendResponse(
        res,
        false,
        "INVALID_ROLE",
        "Role is not valid",
        null,
        400
      );
    }

    if (!canAssignRole(requesterRole, normalizedRole)) {
      return sendResponse(
        res,
        false,
        "ROLE_ASSIGNMENT_FORBIDDEN",
        "You are not allowed to assign this role",
        null,
        403
      );
    }

    const [existingByEmail, existingByPhone] = await Promise.all([
      normalizedEmail ? User.findOne({ email: normalizedEmail }) : Promise.resolve(null),
      normalizedPhone ? User.findOne({ phone: normalizedPhone }) : Promise.resolve(null),
    ]);

    if (
      existingByEmail &&
      existingByPhone &&
      String(existingByEmail._id) !== String(existingByPhone._id)
    ) {
      return sendResponse(
        res,
        false,
        "EMAIL_PHONE_DIFFERENT_ACCOUNTS",
        "Email and phone belong to different accounts",
        null,
        409
      );
    }

    const existingUser = existingByEmail || existingByPhone;

    if (existingUser) {
      const currentRole = String(existingUser.role || "user").toLowerCase();
      const isRoleChange = currentRole !== normalizedRole;
      const resolvedEmail = normalizedEmail ?? existingUser.email ?? undefined;
      const resolvedPhone = normalizedPhone ?? existingUser.phone ?? undefined;
      const resolvedDisplayName =
        trimmedFullName ?? existingUser.fullName ?? undefined;

      if (!canManageRole(requesterRole, currentRole)) {
        return sendResponse(
          res,
          false,
          "INSUFFICIENT_PRIVILEGE",
          "You are not allowed to manage this account",
          null,
          403
        );
      }

      if (isRoleChange && currentRole !== "user") {
        return sendResponse(
          res,
          false,
          "ROLE_CONVERSION_NOT_ALLOWED",
          "Cannot convert one privileged role to another through create API",
          null,
          409
        );
      }

      try {
        const firebaseUpdatePayload = {
          disabled: targetIsActive === false || targetIsBlocked === true,
          ...(resolvedDisplayName !== undefined
            ? { displayName: resolvedDisplayName || null }
            : {}),
          ...(resolvedEmail !== undefined ? { email: resolvedEmail || null } : {}),
          ...(resolvedPhone !== undefined
            ? { phoneNumber: resolvedPhone || null }
            : {}),
        };
        await firebaseAdminAuth.updateUser(
          existingUser.firebaseUID,
          firebaseUpdatePayload
        );
      } catch (error) {
        if (error?.code === "auth/user-not-found") {
          try {
            const recreated = await firebaseAdminAuth.createUser({
              email: resolvedEmail,
              phoneNumber: resolvedPhone,
              displayName: resolvedDisplayName,
              disabled: targetIsActive === false || targetIsBlocked === true,
            });
            existingUser.firebaseUID = recreated.uid;
          } catch (createError) {
            return respondFirebaseIdentityError(res, createError, {
              createPhase: true,
            });
          }
        } else {
          return respondFirebaseIdentityError(res, error, {
            createPhase: false,
          });
        }
      }

      if (trimmedFullName !== undefined) {
        existingUser.fullName = trimmedFullName;
      }
      if (normalizedEmail !== undefined) {
        existingUser.email = normalizedEmail || undefined;
      }
      if (normalizedPhone !== undefined) {
        existingUser.phone = normalizedPhone;
      }
      existingUser.role = normalizedRole;
      existingUser.isActive = targetIsActive;
      existingUser.isBlocked = targetIsBlocked;
      if (!existingUser.createdBy) {
        existingUser.createdBy = req.user?._id || null;
      }

      try {
        await existingUser.save();
      } catch (error) {
        if (respondMongoUniqueError(res, error)) return;
        throw error;
      }

      return sendResponse(
        res,
        true,
        isRoleChange ? "USER_ROLE_UPGRADED" : "USER_UPDATED",
        isRoleChange
          ? "User role upgraded successfully"
          : "User updated successfully",
        {
          user: existingUser,
        },
        200
      );
    }

    let firebaseUser;
    try {
      firebaseUser = await firebaseAdminAuth.createUser({
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        displayName: trimmedFullName,
        disabled: targetIsActive === false || targetIsBlocked === true,
      });
    } catch (error) {
      return respondFirebaseIdentityError(res, error, { createPhase: true });
    }

    let newUser;
    try {
      newUser = await User.create({
        fullName: trimmedFullName,
        email: normalizedEmail || undefined,
        phone: normalizedPhone,
        role: normalizedRole,
        firebaseUID: firebaseUser.uid,
        isActive: targetIsActive,
        isBlocked: targetIsBlocked,
        createdBy: req.user?._id || null,
      });
    } catch (error) {
      if (firebaseUser?.uid) {
        try {
          await firebaseAdminAuth.deleteUser(firebaseUser.uid);
        } catch (cleanupError) {
          console.error("Firebase cleanup error:", cleanupError);
        }
      }
      if (respondMongoUniqueError(res, error)) return;
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
    const requesterRole = getRequesterRole(req);
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

    const existingRole = String(existingUser.role || "user").toLowerCase();
    if (!canManageRole(requesterRole, existingRole)) {
      return sendResponse(
        res,
        false,
        "INSUFFICIENT_PRIVILEGE",
        "You are not allowed to manage this account",
        null,
        403
      );
    }

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

    if ("role" in updates) {
      updates.role =
        typeof updates.role === "string" && updates.role.trim()
          ? updates.role.trim().toLowerCase()
          : undefined;

      if (!updates.role || !ALLOWED_ROLES.has(updates.role)) {
        return sendResponse(
          res,
          false,
          "INVALID_ROLE",
          "Role is not valid",
          null,
          400
        );
      }

      if (!canAssignRole(requesterRole, updates.role)) {
        return sendResponse(
          res,
          false,
          "ROLE_ASSIGNMENT_FORBIDDEN",
          "You are not allowed to assign this role",
          null,
          403
        );
      }

      if (
        requesterRole !== "superadmin" &&
        updates.role !== existingRole &&
        existingRole !== "user"
      ) {
        return sendResponse(
          res,
          false,
          "ROLE_CONVERSION_NOT_ALLOWED",
          "Cannot convert one privileged role to another",
          null,
          409
        );
      }
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
      updates.phone = normalizePhone(updates.phone);
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

    const nextIsActive =
      "isActive" in updates ? updates.isActive === true : existingUser.isActive;
    const nextIsBlocked =
      "isBlocked" in updates ? updates.isBlocked === true : existingUser.isBlocked;

    const shouldSyncFirebase =
      existingUser.firebaseUID &&
      ("fullName" in updates ||
        "email" in updates ||
        "phone" in updates ||
        "isActive" in updates ||
        "isBlocked" in updates);

    if (shouldSyncFirebase) {
      const firebasePayload = {
        ...("fullName" in updates
          ? { displayName: updates.fullName || null }
          : {}),
        ...("email" in updates ? { email: updates.email || null } : {}),
        ...("phone" in updates ? { phoneNumber: updates.phone || null } : {}),
        disabled: nextIsActive === false || nextIsBlocked === true,
      };

      try {
        await firebaseAdminAuth.updateUser(existingUser.firebaseUID, firebasePayload);
      } catch (error) {
        if (error?.code === "auth/user-not-found") {
          try {
            const recreated = await firebaseAdminAuth.createUser({
              email:
                ("email" in updates ? updates.email : existingUser.email) || undefined,
              phoneNumber:
                ("phone" in updates ? updates.phone : existingUser.phone) || undefined,
              displayName:
                ("fullName" in updates ? updates.fullName : existingUser.fullName) ||
                undefined,
              disabled: nextIsActive === false || nextIsBlocked === true,
            });
            existingUser.firebaseUID = recreated.uid;
          } catch (createError) {
            return respondFirebaseIdentityError(res, createError, {
              createPhase: true,
            });
          }
        } else {
          return respondFirebaseIdentityError(res, error, { createPhase: false });
        }
      }
    }

    Object.assign(existingUser, updates);

    let updatedUser;
    try {
      updatedUser = await existingUser.save();
    } catch (error) {
      if (respondMongoUniqueError(res, error)) return;
      throw error;
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
    const requesterRole = getRequesterRole(req);
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

    const existingRole = String(existingUser.role || "user").toLowerCase();
    if (!canManageRole(requesterRole, existingRole)) {
      return sendResponse(
        res,
        false,
        "INSUFFICIENT_PRIVILEGE",
        "You are not allowed to delete this account",
        null,
        403
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
