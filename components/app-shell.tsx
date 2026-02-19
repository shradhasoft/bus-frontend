"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import Footer from "@/components/footer";
import Navbar from "@/components/navbar";
import { subscribeAuthSessionChanged } from "@/lib/auth-events";
import ChatWidget from "@/components/chat/chat-widget";

const HIDE_SHELL_ROUTES = [
  "/admin/dashboard",
  "/bus-owner/dashboard",
  "/super-admin/dashboard",
  "/conductor/dashboard",
];

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const [authSessionVersion, setAuthSessionVersion] = useState(0);
  const hideShell = HIDE_SHELL_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  useEffect(() => {
    return subscribeAuthSessionChanged(() => {
      setAuthSessionVersion((value) => value + 1);
    });
  }, []);

  return (
    <>
      {!hideShell && <Navbar />}
      <React.Fragment key={authSessionVersion}>{children}</React.Fragment>
      {!hideShell && <Footer />}
      {!hideShell && <ChatWidget />}
    </>
  );
};

export default AppShell;
