const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const normalizeBase = (value: string) => value.replace(/\/$/, "");

export const API_BASE_URL = normalizeBase(rawBaseUrl);

export const apiUrl = (path: string) => {
  if (!path.startsWith("/")) {
    return API_BASE_URL ? `${API_BASE_URL}/${path}` : `/${path}`;
  }
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
};
