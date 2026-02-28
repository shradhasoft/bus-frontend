"use client";

// Using absolute alias instead of relative path to fix module not found error
import ManageTicketsPage from "@/app/(protected)/super-admin/dashboard/manage-tickets/page";

export default function AdminManageTicketsPage() {
  return <ManageTicketsPage />;
}
