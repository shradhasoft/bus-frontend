"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api";
import { initSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { firebaseAuth } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  isRead: boolean;
  link?: string;
  createdAt: string;
}

const NotificationIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "SUCCESS":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "WARNING":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "ERROR":
      return <XCircle className="h-4 w-4 text-rose-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
};

const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (token: string) => {
    try {
      const res = await fetch(apiUrl("/api/notifications"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload.success) {
          setNotifications(payload.data || []);
        }
      }
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        setIdToken(token);
        fetchNotifications(token);

        // Initialize socket and listen
        const socket = initSocket(token);
        socket.on("notification:new", (newNotif: NotificationItem) => {
          setNotifications((prev) => [newNotif, ...prev]);
        });
      } else {
        setIdToken(null);
        setNotifications([]);
        disconnectSocket();
      }
    });

    return () => {
      unsubscribe();
      const socket = getSocket();
      if (socket) {
        socket.off("notification:new");
      }
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllAsRead = async () => {
    if (!idToken) return;
    try {
      await fetch(apiUrl("/api/notifications/read-all"), {
        method: "PUT",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const markAsRead = async (id: string) => {
    if (!idToken) return;
    try {
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
      );
      await fetch(apiUrl(`/api/notifications/${id}/read`), {
        method: "PUT",
        headers: { Authorization: `Bearer ${idToken}` },
      });
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative rounded-full p-2 text-slate-700 transition-all duration-300 hover:bg-white/10 hover:text-slate-900 dark:text-white/80 dark:hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0f172a]" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        className="z-[1200] w-80 rounded-2xl border border-slate-200 bg-white/95 p-0 shadow-xl backdrop-blur-xl sm:w-96 dark:border-white/10 dark:bg-slate-950/95"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              Notifications
            </h4>
            {unreadCount > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="group flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <Check className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
              Mark all read
            </button>
          )}
        </div>

        <div className="h-[400px] overflow-y-auto w-full custom-scrollbar">
          {notifications.length > 0 ? (
            <div className="flex flex-col">
              {notifications.map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => {
                    if (!notif.isRead) markAsRead(notif._id);
                  }}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 border-b border-slate-50 p-4 transition-colors last:border-0 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[0.02]",
                    !notif.isRead ? "bg-slate-50/50 dark:bg-white/[0.01]" : "",
                  )}
                >
                  <div className="mt-0.5 shrink-0 rounded-full bg-slate-100 p-2 dark:bg-white/5">
                    <NotificationIcon type={notif.type} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "text-sm font-medium leading-tight text-slate-900 dark:text-white",
                          !notif.isRead && "font-bold",
                        )}
                      >
                        {notif.title}
                      </p>
                      <span className="flex shrink-0 items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {notif.message}
                    </p>
                    {notif.link && (
                      <Link
                        href={notif.link}
                        className="mt-2 inline-flex text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        View details
                      </Link>
                    )}
                  </div>
                  {!notif.isRead && (
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center space-y-3 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5">
                <Bell className="h-6 w-6 text-slate-300 dark:text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  All caught up!
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  You have no new notifications right now.
                </p>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
