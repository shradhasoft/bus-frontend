import { auth } from "../utils/firebase-admin.js";
import { User } from "../models/user.js";

export const firebaseAuth = async (req, res) => {
  try {
    const { token, fullName } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Authentication token is required",
        code: "TOKEN_REQUIRED",
      });
    }

    // Verify the Firebase token
    const checkRevoked = process.env.FIREBASE_CHECK_REVOKED === "true";
    const decodedToken = await auth.verifyIdToken(token, checkRevoked);
    const firebaseUID = decodedToken.uid;
    const emailFromToken = decodedToken.email || null;
    const phoneFromToken = decodedToken.phone_number || null;
    const nameFromToken = decodedToken.name || decodedToken.displayName || null;

    if (req.body?.email && emailFromToken && req.body.email !== emailFromToken) {
      return res.status(400).json({
        success: false,
        message: "Email does not match authenticated account",
        code: "EMAIL_MISMATCH",
      });
    }

    if (req.body?.phone && phoneFromToken && req.body.phone !== phoneFromToken) {
      return res.status(400).json({
        success: false,
        message: "Phone number does not match authenticated account",
        code: "PHONE_MISMATCH",
      });
    }

    // Find or create user
    let user = await User.findOne({ firebaseUID });

    if (!user) {
      try {
        user = new User({
          firebaseUID,
          ...(nameFromToken || fullName ? { fullName: nameFromToken || fullName } : {}),
          ...(phoneFromToken && { phone: phoneFromToken }),
          ...(emailFromToken && { email: emailFromToken }),
        });
        await user.save();
      } catch (createError) {
        // Handle concurrent create requests for the same Firebase account gracefully.
        if (createError?.code === 11000) {
          const existingByUID = await User.findOne({ firebaseUID });
          if (existingByUID) {
            user = existingByUID;
          } else if (createError?.keyPattern?.phone) {
            return res.status(409).json({
              success: false,
              message: "Phone number already linked to another account",
              code: "PHONE_EXISTS",
            });
          } else if (createError?.keyPattern?.email) {
            return res.status(409).json({
              success: false,
              message: "Email already linked to another account",
              code: "EMAIL_EXISTS",
            });
          } else if (createError?.keyPattern?.firebaseUID) {
            user = await User.findOne({ firebaseUID });
            if (!user) {
              return res.status(409).json({
                success: false,
                message: "Account already exists",
                code: "ACCOUNT_EXISTS",
              });
            }
          } else {
            return res.status(409).json({
              success: false,
              message: "Account already exists",
              code: "ACCOUNT_EXISTS",
            });
          }
        } else {
          throw createError;
        }
      }
    }

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

    const updates = {};
    if (!user.fullName && (nameFromToken || fullName)) {
      updates.fullName = nameFromToken || fullName;
    }
    if (!user.email && emailFromToken) updates.email = emailFromToken;
    if (!user.phone && phoneFromToken) updates.phone = phoneFromToken;

    if (Object.keys(updates).length) {
      try {
        Object.assign(user, updates);
        await user.save();
      } catch (updateError) {
        if (updateError?.code === 11000 && updateError?.keyPattern?.phone) {
          return res.status(409).json({
            success: false,
            message: "Phone number already linked to another account",
            code: "PHONE_EXISTS",
          });
        }
        if (updateError?.code === 11000 && updateError?.keyPattern?.email) {
          return res.status(409).json({
            success: false,
            message: "Email already linked to another account",
            code: "EMAIL_EXISTS",
          });
        }
        throw updateError;
      }
    }

    // Create Firebase session cookie (for httpOnly auth)
    const expiresIn = 7 * 24 * 60 * 60 * 1000;
    const sessionCookie = await auth.createSessionCookie(token, { expiresIn });

    // Set secure cookies
    const secure =
      process.env.COOKIE_SECURE === "true" ||
      (process.env.COOKIE_SECURE !== "false" &&
        process.env.NODE_ENV === "production");
    const sameSite =
      process.env.COOKIE_SAMESITE ||
      (process.env.NODE_ENV === "production" ? "lax" : "lax");

    const cookieOptions = {
      maxAge: expiresIn,
      httpOnly: true,
      secure,
      sameSite,
      path: "/",
    };

    res.cookie("token", sessionCookie, cookieOptions);
    res.clearCookie("impersonation_token", {
      ...cookieOptions,
      expires: new Date(0),
    });

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        fullName: user.fullName,
        phone: user.phone || null,
        role: user.role,
        email: user.email || null,
      },
    });
  } catch (error) {
    console.error("Firebase Auth Error:", error);
    res.status(401).json({
      success: false,
      message: "Authentication failed",
      code: "AUTH_FAILED",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const logout = async (req, res) => {
  try {
    // Set cookie options to ensure the cookie is cleared correctly.
    // These options should match the options used when setting the cookie,
    // especially 'secure' and 'sameSite', to ensure the browser correctly identifies
    // and deletes the cookie.
    const secure =
      process.env.COOKIE_SECURE === "true" ||
      (process.env.COOKIE_SECURE !== "false" &&
        process.env.NODE_ENV === "production");
    const sameSite =
      process.env.COOKIE_SAMESITE ||
      (process.env.NODE_ENV === "production" ? "lax" : "lax");

    const cookieOptions = {
      expires: new Date(0), // Set expiry to a past date to immediately invalidate the cookie
      httpOnly: true,
      secure, // Only send over HTTPS in production
      sameSite, // Adjust sameSite policy for cross-site requests in production
      path: "/",
    };

    const sessionCookie = req.cookies?.token || null;
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    let uid = null;

    if (sessionCookie) {
      try {
        const decoded = await auth.verifySessionCookie(sessionCookie, false);
        uid = decoded.uid;
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Logout: failed to verify session cookie", error.message);
        }
      }
    } else if (bearerToken) {
      try {
        const decoded = await auth.verifyIdToken(bearerToken, false);
        uid = decoded.uid;
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Logout: failed to verify bearer token", error.message);
        }
      }
    }

    if (uid) {
      await auth.revokeRefreshTokens(uid);
    }

    // Clear the 'token' cookie.
    // The name of the cookie ('token') must match the name used during login.
    res.clearCookie("token", cookieOptions);
    res.clearCookie("impersonation_token", cookieOptions);

    // Send a success response to the client.
    // A 200 OK status indicates that the request was successful.
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    // Log the error for debugging purposes in the server console.
    console.error("Logout Error:", error);

    // Send an error response to the client.
    // Use a 500 Internal Server Error status for unexpected server-side issues.
    // In production, avoid sending detailed error messages to the client for security reasons.
    res.status(500).json({
      success: false,
      message: "Logout failed",
      code: "LOGOUT_FAILED",
      // Only expose error details in development mode
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
