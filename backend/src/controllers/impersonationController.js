import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import { User } from "../models/user.js";

const IMPERSONATION_COOKIE_NAME = "impersonation_token";
const DEFAULT_IMPERSONATION_TTL_SECONDS = 30 * 60;
const TARGET_ROLES = new Set(["owner", "conductor"]);
const ADMIN_ROLES = new Set(["admin", "superadmin"]);

const ROLE_DASHBOARD_PATHS = {
  admin: "/admin/dashboard",
  superadmin: "/super-admin/dashboard",
  owner: "/bus-owner/dashboard",
  conductor: "/conductor/dashboard",
  user: "/dashboard",
};

const normalizeRole = (role) => String(role || "").toLowerCase();

const toPublicUser = (user) => ({
  _id: user?._id || null,
  fullName: user?.fullName || null,
  email: user?.email || null,
  role: user?.role || null,
});

const resolveCookieOptions = (maxAgeMs) => {
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    (process.env.COOKIE_SECURE !== "false" &&
      process.env.NODE_ENV === "production");
  const sameSite =
    process.env.COOKIE_SAMESITE ||
    (process.env.NODE_ENV === "production" ? "lax" : "lax");

  return {
    maxAge: maxAgeMs,
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
  };
};

const clearImpersonationCookie = (res) => {
  res.clearCookie(IMPERSONATION_COOKIE_NAME, {
    ...resolveCookieOptions(0),
    expires: new Date(0),
  });
};

const getImpersonationSecret = () =>
  process.env.IMPERSONATION_SECRET || process.env.JWT_SECRET;

const getTargetDashboardPath = (role) =>
  ROLE_DASHBOARD_PATHS[normalizeRole(role)] || "/dashboard";

const getRequesterContext = (req) => {
  const actor = req.authActor || null;
  const activeUser = req.user || null;

  if (req.isImpersonating && actor) {
    return {
      requester: actor,
      impersonatedTarget: activeUser,
      isImpersonating: true,
    };
  }

  return {
    requester: activeUser,
    impersonatedTarget: null,
    isImpersonating: false,
  };
};

export const startImpersonation = async (req, res) => {
  try {
    const { requester, isImpersonating } = getRequesterContext(req);
    if (!requester) {
      return res.status(401).json({
        success: false,
        message: "UNAUTHORIZED",
      });
    }

    if (isImpersonating) {
      return res.status(409).json({
        success: false,
        message: "ALREADY_IMPERSONATING",
      });
    }

    const requesterRole = normalizeRole(requester.role);
    if (!ADMIN_ROLES.has(requesterRole)) {
      return res.status(403).json({
        success: false,
        message: "IMPERSONATION_NOT_ALLOWED",
      });
    }

    const targetUserId = String(req.body?.userId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: "INVALID_USER_ID",
      });
    }

    if (String(requester._id) === targetUserId) {
      return res.status(400).json({
        success: false,
        message: "CANNOT_IMPERSONATE_SELF",
      });
    }

    const targetUser = await User.findById(targetUserId).select(
      "_id fullName email role isActive isBlocked",
    );
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "USER_NOT_FOUND",
      });
    }

    const targetRole = normalizeRole(targetUser.role);
    if (!TARGET_ROLES.has(targetRole)) {
      return res.status(403).json({
        success: false,
        message: "TARGET_ROLE_NOT_IMPERSONATABLE",
      });
    }

    if (targetUser.isActive === false || targetUser.isBlocked === true) {
      return res.status(409).json({
        success: false,
        message: "TARGET_ACCOUNT_UNAVAILABLE",
      });
    }

    const secret = getImpersonationSecret();
    if (!secret) {
      return res.status(500).json({
        success: false,
        message: "IMPERSONATION_SECRET_MISSING",
      });
    }

    const ttlFromEnv = Number.parseInt(
      String(process.env.IMPERSONATION_TTL_SECONDS || ""),
      10,
    );
    const ttlSeconds =
      Number.isFinite(ttlFromEnv) && ttlFromEnv > 60
        ? ttlFromEnv
        : DEFAULT_IMPERSONATION_TTL_SECONDS;

    const token = jwt.sign(
      {
        typ: "impersonation",
        actorUserId: String(requester._id),
        actorRole: requesterRole,
        targetUserId: String(targetUser._id),
      },
      secret,
      { expiresIn: ttlSeconds },
    );

    res.cookie(
      IMPERSONATION_COOKIE_NAME,
      token,
      resolveCookieOptions(ttlSeconds * 1000),
    );

    return res.status(200).json({
      success: true,
      message: "IMPERSONATION_STARTED",
      data: {
        actor: toPublicUser(requester),
        target: toPublicUser(targetUser),
        expiresInSeconds: ttlSeconds,
        redirectPath: getTargetDashboardPath(targetRole),
      },
    });
  } catch (error) {
    console.error("startImpersonation error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const stopImpersonation = async (req, res) => {
  try {
    const { requester, isImpersonating } = getRequesterContext(req);
    if (!requester) {
      return res.status(401).json({
        success: false,
        message: "UNAUTHORIZED",
      });
    }

    if (!isImpersonating) {
      clearImpersonationCookie(res);
      return res.status(200).json({
        success: true,
        message: "NOT_IMPERSONATING",
        data: {
          active: false,
          actor: toPublicUser(requester),
          redirectPath: getTargetDashboardPath(requester.role),
        },
      });
    }

    const requesterRole = normalizeRole(requester.role);
    if (!ADMIN_ROLES.has(requesterRole)) {
      clearImpersonationCookie(res);
      return res.status(403).json({
        success: false,
        message: "IMPERSONATION_NOT_ALLOWED",
      });
    }

    clearImpersonationCookie(res);

    return res.status(200).json({
      success: true,
      message: "IMPERSONATION_STOPPED",
      data: {
        active: false,
        actor: toPublicUser(requester),
        redirectPath: getTargetDashboardPath(requesterRole),
      },
    });
  } catch (error) {
    console.error("stopImpersonation error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const getImpersonationStatus = async (req, res) => {
  try {
    const { requester, impersonatedTarget, isImpersonating } = getRequesterContext(req);
    if (!requester) {
      return res.status(401).json({
        success: false,
        message: "UNAUTHORIZED",
      });
    }

    if (!isImpersonating) {
      return res.status(200).json({
        success: true,
        message: "IMPERSONATION_STATUS",
        data: {
          active: false,
          actor: toPublicUser(requester),
          target: null,
        },
      });
    }

    const requesterRole = normalizeRole(requester.role);
    if (!ADMIN_ROLES.has(requesterRole)) {
      clearImpersonationCookie(res);
      return res.status(403).json({
        success: false,
        message: "IMPERSONATION_NOT_ALLOWED",
      });
    }

    return res.status(200).json({
      success: true,
      message: "IMPERSONATION_STATUS",
      data: {
        active: true,
        actor: toPublicUser(requester),
        target: toPublicUser(impersonatedTarget),
        redirectPath: getTargetDashboardPath(impersonatedTarget?.role),
      },
    });
  } catch (error) {
    console.error("getImpersonationStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};
