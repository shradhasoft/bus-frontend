"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  LifeBuoy,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreVertical,
  ChevronDown,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Ticket {
  _id: string;
  ticketId: string;
  subject: string;
  description: string;
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  priority: "Low" | "Medium" | "High";
  createdAt: string;
  user: {
    _id: string;
    fullName: string;
    email: string;
  };
}

export default function ManageTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const url = new URL(apiUrl("/api/tickets/admin/all"));
      if (statusFilter !== "All")
        url.searchParams.append("status", statusFilter);

      const response = await fetch(url.toString(), {
        credentials: "include",
      });
      const data = await response.json();
      if (data.success) {
        setTickets(data.data);
      }
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(apiUrl(`/api/tickets/admin/${id}/status`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
        credentials: "include",
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Ticket marked as ${newStatus}`);
        setTickets((prev) =>
          prev.map((t) =>
            t._id === id ? { ...t, status: newStatus as Ticket["status"] } : t,
          ),
        );
      } else {
        toast.error(data.message || "Failed to update ticket status");
      }
    } catch {
      toast.error("An error occurred while updating status");
    }
  };

  const filteredTickets = tickets.filter(
    (ticket) =>
      ticket.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Resolved":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30";
      case "Open":
        return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-rose-200 dark:border-rose-500/30";
      case "In Progress":
        return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200 dark:border-amber-500/30";
      case "Closed":
        return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400 border-slate-200 dark:border-slate-500/30";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "text-rose-500 bg-rose-50 dark:bg-rose-500/10";
      case "Medium":
        return "text-amber-500 bg-amber-50 dark:bg-amber-500/10";
      case "Low":
        return "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10";
      default:
        return "text-slate-500 bg-slate-50 dark:bg-slate-500/10";
    }
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-800 dark:text-slate-100">
            <LifeBuoy className="h-7 w-7 text-indigo-500" />
            Manage Support Tickets
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            View, track, and resolve user submitted support tickets.
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ticket ID, email, or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="relative shrink-0 sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-200"
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f172a]">
        <div className="h-full overflow-auto">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-500"></div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-500">
              <LifeBuoy className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p>No tickets found matching your criteria</p>
            </div>
          ) : (
            <table className="w-full whitespace-nowrap text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4">Ticket</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Status & Priority</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket._id}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {ticket.ticketId}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="truncate text-xs text-slate-500 font-medium">
                            By {ticket.user.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-sm">
                      <div className="truncate font-semibold text-slate-800 dark:text-slate-200">
                        {ticket.subject}
                      </div>
                      <div className="truncate text-xs leading-relaxed text-slate-500 mt-1">
                        {ticket.description}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2 items-start">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusColor(ticket.status)}`}
                        >
                          {ticket.status}
                        </span>
                        <span
                          className={`inline-flex rounded border border-transparent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${getPriorityColor(ticket.priority)}`}
                        >
                          {ticket.priority} Priority
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors focus:outline-none dark:hover:bg-white/5">
                          <MoreVertical className="h-5 w-5 text-slate-500" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-900"
                        >
                          <DropdownMenuItem
                            onClick={() =>
                              updateStatus(ticket._id, "In Progress")
                            }
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                          >
                            <Clock className="h-4 w-4 text-amber-500" /> Mark In
                            Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateStatus(ticket._id, "Resolved")}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />{" "}
                            Mark Resolved
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateStatus(ticket._id, "Closed")}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                          >
                            <AlertCircle className="h-4 w-4 text-slate-500" />{" "}
                            Mark Closed
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
