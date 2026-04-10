import { firebaseAuth } from "@/lib/firebase/client";

const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const normalizeBase = (value: string) => value.replace(/\/$/, "");
const normalizePath = (path: string) =>
  path.startsWith("/") ? path : `/${path}`;

const dedupeApiBoundary = (base: string, path: string) => {
  const baseEndsWithApi = /\/api$/i.test(base);
  const pathStartsWithApi = /^\/api(\/|$)/i.test(path);
  if (baseEndsWithApi && pathStartsWithApi) {
    return path.replace(/^\/api/i, "") || "/";
  }
  return path;
};

export const API_BASE_URL = normalizeBase(rawBaseUrl);

export const apiUrl = (path: string) => {
  const normalizedPath = normalizePath(path);
  if (!API_BASE_URL) return normalizedPath;
  const pathWithNoDuplicateApi = dedupeApiBoundary(
    API_BASE_URL,
    normalizedPath,
  );
  return `${API_BASE_URL}${pathWithNoDuplicateApi}`;
};

/**
 * Get the Firebase ID token for the currently signed-in user.
 * Returns null if no user is signed in or token fetch fails.
 */
const getIdToken = async (): Promise<string | null> => {
  try {
    const user = firebaseAuth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
};

/**
 * Build auth headers — always sends the Firebase ID token as a Bearer token.
 * This works cross-origin (Vercel → Render) unlike cookies.
 */
export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = await getIdToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Fetch with auto-injected Firebase auth token.
 * Merges caller-provided headers on top of auth headers.
 */
export const apiFetch = async (
  path: string,
  init?: RequestInit,
): Promise<Response> => {
  const authHeaders = await getAuthHeaders();
  return fetch(apiUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      ...authHeaders,
      ...(init?.headers ?? {}),
    },
  });
};

/** Fetch JSON with auto-injected auth token. */
export const apiFetchJson = async <T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string })?.message ||
        `API error: ${response.status}`,
    );
  }
  return (await response.json()) as T;
};
