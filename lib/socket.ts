import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./api";

let socket: Socket | null = null;

export const initSocket = (token?: string) => {
  if (!socket) {
    // URL fallback to window.location.origin if API_BASE_URL is relative/empty
    const url =
      API_BASE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    socket = io(url, {
      path: "/socket.io",
      auth: { token },
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
