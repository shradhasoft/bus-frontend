const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const normalizeBase = (value: string) => value.replace(/\/$/, "");
const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

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

  if (!API_BASE_URL) {
    return normalizedPath;
  }

  const pathWithNoDuplicateApi = dedupeApiBoundary(API_BASE_URL, normalizedPath);
  return `${API_BASE_URL}${pathWithNoDuplicateApi}`;
};
