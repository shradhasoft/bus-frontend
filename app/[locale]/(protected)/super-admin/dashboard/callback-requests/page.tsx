"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Search, History, PhoneCall, FilterX } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiUrl } from "@/lib/api";

type UserSnapshot = {
  _id: string;
  fullName: string;
  email: string;
};

type CallbackRequest = {
  _id: string;
  name: string;
  phone: string;
  message: string;
  status: "Pending" | "In Progress" | "Called" | "Closed";
  user?: UserSnapshot;
  createdAt: string;
};

export default function CallbackRequestsPage() {
  const [requests, setRequests] = useState<CallbackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = new URL(apiUrl("/api/callback-requests/admin/all"));
      if (statusFilter !== "all") {
        url.searchParams.append("status", statusFilter);
      }

      const res = await fetch(url.toString(), {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch callback requests.");
      }

      const payload = await res.json();
      setRequests(payload.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error loading callback requests.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const updateStatus = async (
    id: string,
    newStatus: CallbackRequest["status"],
  ) => {
    try {
      const res = await fetch(apiUrl(`/api/callback-requests/admin/${id}/status`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      toast.success("Callback request status updated");
      setRequests((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status: newStatus } : r)),
      );
    } catch {
      toast.error("Failed to update status");
    }
  };

  const filteredRequests = useMemo(() => {
    if (!searchQuery) return requests;
    const lowerQ = searchQuery.toLowerCase();
    return requests.filter(
      (r) =>
        r.name.toLowerCase().includes(lowerQ) ||
        r.phone.toLowerCase().includes(lowerQ) ||
        (r.message && r.message.toLowerCase().includes(lowerQ)),
    );
  }, [requests, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
            Pending
          </Badge>
        );
      case "In Progress":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
            In Progress
          </Badge>
        );
      case "Called":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
            Called
          </Badge>
        );
      case "Closed":
        return (
          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400">
            Closed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div data-testid="callback-requests-page" className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              <PhoneCall className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Callback Requests
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            View and manage user requests for a callback.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            data-testid="callback-search-input"
            placeholder="Search by name, phone, or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 w-full rounded-xl bg-white dark:bg-slate-900 shadow-sm transition-all focus-visible:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-[140px] rounded-xl bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800 focus:ring-indigo-500">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Called">Called</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-600 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400">
          <p>{error}</p>
          <Button
            variant="outline"
            onClick={fetchRequests}
            className="mt-4 border-rose-200 hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40"
          >
            Try Again
          </Button>
        </div>
      ) : loading ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
            <span className="text-sm font-medium">Loading requests...</span>
          </div>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-20 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800/50 mb-4">
            <FilterX className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            No Requests Found
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            There are no callback requests to display.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-wider">
                    Contact Details
                  </th>
                  <th className="px-6 py-4 font-semibold tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-4 font-semibold tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 font-semibold tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRequests.map((req) => (
                  <tr
                    key={req._id}
                    className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {req.name}
                        </span>
                        <span className="mt-1 font-mono text-xs text-slate-500">
                          {req.phone}
                        </span>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                          <History className="h-3 w-3" />
                          {new Date(req.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      <p
                        className="max-w-[300px] truncate"
                        title={req.message || "No message"}
                      >
                        {req.message || (
                          <span className="text-slate-400 italic">
                            No message provided
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <span className="sr-only">Open menu</span>
                            <div className="flex flex-col gap-1 items-center justify-center h-full w-full">
                              <span className="h-1 w-1 rounded-full bg-slate-400"></span>
                              <span className="h-1 w-1 rounded-full bg-slate-400"></span>
                              <span className="h-1 w-1 rounded-full bg-slate-400"></span>
                            </div>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {(
                            ["Pending", "In Progress", "Called", "Closed"] as const
                          ).map((status) => (
                              <DropdownMenuItem
                                key={status}
                                disabled={req.status === status}
                                onClick={() => updateStatus(req._id, status)}
                                className={
                                  req.status === status
                                    ? "bg-slate-50 dark:bg-slate-800/50 text-indigo-600 dark:text-indigo-400"
                                    : ""
                                }
                              >
                                {status}
                              </DropdownMenuItem>
                            ),
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
