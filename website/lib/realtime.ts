import { API_BASE_URL } from "@/lib/api";

const DEFAULT_SOCKET_PATH = "/socket.io";

const normalizePath = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return DEFAULT_SOCKET_PATH;
  const token = trimmed.replace(/^\/+|\/+$/g, "");
  return token ? `/${token}` : DEFAULT_SOCKET_PATH;
};

const toOrigin = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  try {
    if (typeof window !== "undefined") {
      return new URL(trimmed, window.location.origin).origin;
    }

    return new URL(trimmed).origin;
  } catch {
    return "";
  }
};

export const SOCKET_PATH = normalizePath(process.env.NEXT_PUBLIC_SOCKET_PATH || "");

export const getSocketBaseOrigin = () => {
  const explicitSocketOrigin = toOrigin(process.env.NEXT_PUBLIC_SOCKET_URL || "");
  if (explicitSocketOrigin) return explicitSocketOrigin;

  const apiOrigin = toOrigin(API_BASE_URL);
  if (apiOrigin) return apiOrigin;

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
};

export const getSocketNamespaceUrl = (namespace: string) => {
  const safeNamespace = namespace.startsWith("/") ? namespace : `/${namespace}`;
  const baseOrigin = getSocketBaseOrigin();
  return baseOrigin ? `${baseOrigin}${safeNamespace}` : safeNamespace;
};

export const getSocketClientScriptUrl = () => {
  const baseOrigin = getSocketBaseOrigin();
  return baseOrigin
    ? `${baseOrigin}${SOCKET_PATH}/socket.io.js`
    : `${SOCKET_PATH}/socket.io.js`;
};
