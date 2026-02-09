// src/middlewares/authMiddleware.js
import asyncHandler from "express-async-handler";
import { User } from "../models/user.js";
import { auth as firebaseAdminAuth } from "../utils/firebase-admin.js";

const protect = asyncHandler(async (req, res, next) => {
  let token;
  let source = "header";

  // ✅ 1) Prefer Authorization header
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // ✅ 2) Optional: accept token from cookies too
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
    source = "cookie";
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized: No authentication token provided.",
      code: "TOKEN_MISSING",
    });
  }

  try {
    const checkRevoked = process.env.FIREBASE_CHECK_REVOKED === "true";
    const decodedToken =
      source === "cookie"
        ? await firebaseAdminAuth.verifySessionCookie(token, checkRevoked)
        : await firebaseAdminAuth.verifyIdToken(token, checkRevoked);

    const user = await User.findOne({ firebaseUID: decodedToken.uid }).select(
      "-__v -createdAt -updatedAt",
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed: User record not found in database.",
        code: "USER_NOT_FOUND",
      });
    }

    // ✅ Recommended checks
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account is deactivated. Please contact support.",
        code: "ACCOUNT_DEACTIVATED",
      });
    }

    if (user.isBlocked === true) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Please contact support.",
        code: "ACCOUNT_BLOCKED",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    let message = "Not authorized: Token verification failed.";
    let code = "TOKEN_INVALID";

    if (
      error.code === "auth/id-token-expired" ||
      error.code === "auth/session-cookie-expired"
    ) {
      message = "Not authorized: Token has expired.";
      code = "TOKEN_EXPIRED";
    } else if (
      error.code === "auth/argument-error" ||
      error.code === "auth/invalid-session-cookie"
    ) {
      message = "Not authorized: Invalid token format.";
      code = "TOKEN_MALFORMED";
    } else if (
      error.code === "auth/id-token-revoked" ||
      error.code === "auth/session-cookie-revoked"
    ) {
      message = "Not authorized: Token has been revoked.";
      code = "TOKEN_REVOKED";
    } else if (error.code === "auth/invalid-credential") {
      message = "Not authorized: Invalid credential or token.";
      code = "INVALID_CREDENTIAL";
    }

    console.error(`Firebase JWT Error: ${error.message}`);
    return res.status(401).json({
      success: false,
      message,
      code,
    });
  }
});

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: User role '${req.user.role}' is not authorized to access this resource.`,
        code: "UNAUTHORIZED_ROLE",
      });
    }
    return next();
  };
};

export { protect, authorize };
