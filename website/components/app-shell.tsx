"use client";

import React from "react";
import { usePathname } from "next/navigation";

import Footer from "@/components/footer";
import Navbar from "@/components/navbar";

const HIDE_SHELL_ROUTES = [
  "/admin/dashboard",
  "/bus-owner/dashboard",
  "/super-admin/dashboard",
  "/conductor/dashboard",
];

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const hideShell = HIDE_SHELL_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  return (
    <>
      {!hideShell && <Navbar />}
      {children}
      {!hideShell && <Footer />}
    </>
  );
};

export default AppShell;
