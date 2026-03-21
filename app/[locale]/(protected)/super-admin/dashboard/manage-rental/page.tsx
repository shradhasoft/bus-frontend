"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  CalendarDays,
  ClipboardList,
  Eye,
  Pencil,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";

type RentalRequest = {
  _id: string;
  rentalRequestId: string;
  status: "New" | "In Progress" | "Quoted" | "Closed";
  tripType: string;
  pickupLocation: string;
  dropLocation: string;
  viaPoints?: string[];
  journeyDate: string;
  reportingTime: string;
  tripEndDateTime: string;
  rentalDuration?: { unit: "hours" | "days" | "kilometers"; value: number };
  returnRequired: boolean;
  passengerCount: number;
  luggageQuantity: number;
  luggageType: string;
  busTypesNeeded: string[];
  seatingCapacityRequired: number;
  specialNeeds?: {
    wheelchairAccess?: boolean;
    elderlyFriendly?: boolean;
    childSeats?: boolean;
  };
  purposeOfTrip: string;
  groupCategory: string;
  requiredAmenities?: string[];
  customerName: string;
  mobileNumber: string;
  email: string;
  companyName?: string;
  gstNumber?: string;
  createdAt: string;
};

type RentalListResponse = {
  success?: boolean;
  count?: number;
  total?: number;
  totalPages?: number;
  currentPage?: number;
  data?: RentalRequest[];
};

const STATUS_BADGES: Record<RentalRequest["status"], { label: string; className: string }> = {
  New: {
    label: "New",
    className:
      "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
  },
  "In Progress": {
    label: "In Progress",
    className:
      "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200",
  },
  Quoted: {
    label: "Quoted",
    className:
      "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  Closed: {
    label: "Closed",
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200",
  },
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
};

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function SuperAdminManageRentalPage() {
  const [rentals, setRentals] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [selected, setSelected] = useState<RentalRequest | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<RentalRequest | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RentalRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    tripType: "one-way",
    pickupLocation: "",
    dropLocation: "",
    journeyDate: "",
    reportingTime: "10:00",
    tripEndDateTime: "",
    passengerCount: 1,
    seatingCapacityRequired: 1,
    customerName: "",
    mobileNumber: "",
    email: "",
    status: "New" as RentalRequest["status"],
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const fetchRentals = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (statusFilter !== "all") params.set("status", statusFilter);

        const res = await fetch(apiUrl(`/api/rentals/admin/all?${params.toString()}`), {
          credentials: "include",
          signal,
        });

        if (!res.ok) throw new Error("Failed to fetch rental requests.");
        const payload = (await res.json().catch(() => ({}))) as RentalListResponse;

        setRentals(Array.isArray(payload.data) ? payload.data : []);
        setTotal(Number(payload.total) || 0);
        setTotalPages(Number(payload.totalPages) || 1);
      } catch (err) {
        // Request cancellations are expected during filter/page changes and unmount.
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        if (err instanceof Error) setError(err.message);
        else setError("Error loading rental requests.");
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, limit, page, statusFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchRentals(controller.signal);
    return () => controller.abort();
  }, [fetchRentals]);

  const updateStatus = async (id: string, status: RentalRequest["status"]) => {
    try {
      setUpdatingId(id);
      const res = await fetch(apiUrl(`/api/rentals/admin/${id}/status`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update rental status.");
      toast.success("Status updated");
      setRentals((prev) => prev.map((r) => (r._id === id ? { ...r, status } : r)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const openEdit = (rental: RentalRequest) => {
    setEditTarget(rental);
    const journeyDate = rental.journeyDate
      ? new Date(rental.journeyDate).toISOString().slice(0, 10)
      : "";
    const tripEndDateTime = rental.tripEndDateTime
      ? new Date(rental.tripEndDateTime).toISOString().slice(0, 16)
      : "";

    setEditForm({
      tripType: rental.tripType || "one-way",
      pickupLocation: rental.pickupLocation || "",
      dropLocation: rental.dropLocation || "",
      journeyDate,
      reportingTime: rental.reportingTime || "10:00",
      tripEndDateTime,
      passengerCount: rental.passengerCount || 1,
      seatingCapacityRequired: rental.seatingCapacityRequired || 1,
      customerName: rental.customerName || "",
      mobileNumber: rental.mobileNumber || "",
      email: rental.email || "",
      status: rental.status || "New",
    });
  };

  const handleSaveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      const payload = {
        tripType: editForm.tripType,
        pickupLocation: editForm.pickupLocation.trim(),
        dropLocation: editForm.dropLocation.trim(),
        journeyDate: new Date(`${editForm.journeyDate}T00:00:00.000Z`).toISOString(),
        reportingTime: editForm.reportingTime,
        tripEndDateTime: new Date(editForm.tripEndDateTime).toISOString(),
        passengerCount: Number(editForm.passengerCount),
        seatingCapacityRequired: Number(editForm.seatingCapacityRequired),
        customerName: editForm.customerName.trim(),
        mobileNumber: editForm.mobileNumber.trim(),
        email: editForm.email.trim().toLowerCase(),
        status: editForm.status,
      };

      const res = await fetch(apiUrl(`/api/rentals/admin/${editTarget._id}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to update rental request.");
      }
      const updated = data?.data as RentalRequest | undefined;
      if (updated) {
        setRentals((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
      } else {
        const controller = new AbortController();
        await fetchRentals(controller.signal);
      }
      toast.success("Rental request updated.");
      setEditTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save changes.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/rentals/admin/${deleteTarget._id}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to delete rental request.");
      }
      setRentals((prev) => prev.filter((row) => row._id !== deleteTarget._id));
      setDeleteTarget(null);
      toast.success("Rental request deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete request.");
    } finally {
      setDeleting(false);
    }
  };

  const pageNumbers = useMemo(() => {
    const window = 2;
    const start = Math.max(1, page - window);
    const end = Math.min(totalPages, page + window);
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  }, [page, totalPages]);

  const startIndex = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = total === 0 ? 0 : Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Admin Dashboard
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Manage Rental Requests
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
            View and manage all rental requests submitted from the public form.
          </p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.1)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, email, mobile, pickup..."
              className="pl-9"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="all">All statuses</option>
            <option value="New">New</option>
            <option value="In Progress">In Progress</option>
            <option value="Quoted">Quoted</option>
            <option value="Closed">Closed</option>
          </select>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="h-10 rounded-2xl border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50 px-3 py-1 dark:border-white/10 dark:bg-white/5">
            Total: <strong>{total.toLocaleString()}</strong>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50 px-3 py-1 dark:border-white/10 dark:bg-white/5">
            Showing: <strong>{startIndex} - {endIndex}</strong>
          </span>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.1)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
        <div className="max-h-[600px] overflow-auto no-scrollbar">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100/95 text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Request</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Trip</th>
                <th className="px-6 py-4 font-semibold">Contact</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300">
                    Loading rental requests...
                  </td>
                </tr>
              ) : rentals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300">
                    No rental requests found.
                  </td>
                </tr>
              ) : (
                rentals.map((rental) => (
                  <tr
                    key={rental._id}
                    className="bg-white/60 transition hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                  >
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {rental.rentalRequestId}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          <CalendarDays className="mr-2 inline h-3.5 w-3.5" />
                          {formatDate(rental.journeyDate)}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {rental.customerName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {rental.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                      <p className="font-medium">
                        {rental.pickupLocation} to {rental.dropLocation}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {rental.tripType} • Passengers: {rental.passengerCount}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium">{rental.mobileNumber}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(rental.tripEndDateTime)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={STATUS_BADGES[rental.status]?.className}>
                        {STATUS_BADGES[rental.status]?.label || rental.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelected(rental)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(rental)}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(rental)}
                          className="gap-2 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              disabled={updatingId === rental._id}
                            >
                              <Settings2 className="h-4 w-4" />
                              {updatingId === rental._id ? "Updating..." : "Update"}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel>Update status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {(["New", "In Progress", "Quoted", "Closed"] as RentalRequest["status"][]).map((status) => (
                              <DropdownMenuItem
                                key={status}
                                disabled={rental.status === status || updatingId === rental._id}
                                onClick={() => updateStatus(rental._id, status)}
                              >
                                {status}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 px-6 py-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          <span>
            Showing {startIndex} - {endIndex} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2 text-xs">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage(1)}
              disabled={page === 1}
            >
              First
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              Prev
            </Button>
            {pageNumbers.map((p) => (
              <Button
                key={p}
                type="button"
                variant={p === page ? "default" : "outline"}
                size="sm"
                onClick={() => setPage(p)}
              >
                {p}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
            >
              Last
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Rental Request Details
            </DialogTitle>
            <DialogDescription>
              {selected ? `${selected.rentalRequestId} • ${selected.customerName}` : null}
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-5 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-white/5">
                  <div className="font-semibold">Trip</div>
                  <div className="mt-2 text-slate-700 dark:text-slate-200">
                    <div>{selected.tripType}</div>
                    <div>
                      {selected.pickupLocation} to {selected.dropLocation}
                    </div>
                    <div>Journey date: {formatDate(selected.journeyDate)}</div>
                    <div>Reporting time: {selected.reportingTime}</div>
                    <div>Trip end: {formatDateTime(selected.tripEndDateTime)}</div>
                    <div>Return required: {selected.returnRequired ? "Yes" : "No"}</div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-white/5">
                  <div className="font-semibold">Duration & Seating</div>
                  <div className="mt-2 text-slate-700 dark:text-slate-200">
                    <div>
                      Duration:{" "}
                      {selected.rentalDuration
                        ? `${selected.rentalDuration.value} ${selected.rentalDuration.unit}`
                        : "-"}
                    </div>
                    <div>Passengers: {selected.passengerCount}</div>
                    <div>Seating capacity: {selected.seatingCapacityRequired}</div>
                    <div>
                      Luggage: {selected.luggageQuantity} {selected.luggageType ? `(${selected.luggageType})` : ""}
                    </div>
                    <div>
                      Bus types needed: {selected.busTypesNeeded?.length ? selected.busTypesNeeded.join(", ") : "-"}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-white/5">
                  <div className="font-semibold">Special needs</div>
                  <div className="mt-2 text-slate-700 dark:text-slate-200">
                    <div>Wheelchair access: {selected.specialNeeds?.wheelchairAccess ? "Yes" : "No"}</div>
                    <div>Elderly-friendly: {selected.specialNeeds?.elderlyFriendly ? "Yes" : "No"}</div>
                    <div>Child seats: {selected.specialNeeds?.childSeats ? "Yes" : "No"}</div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-white/5">
                  <div className="font-semibold">Use-case</div>
                  <div className="mt-2 text-slate-700 dark:text-slate-200">
                    <div>Purpose: {selected.purposeOfTrip}</div>
                    <div>Group category: {selected.groupCategory}</div>
                    <div>
                      Amenities:{" "}
                      {selected.requiredAmenities?.length ? selected.requiredAmenities.join(", ") : "-"}
                    </div>
                    <div>
                      Via points: {selected.viaPoints?.length ? selected.viaPoints.join(", ") : "-"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-white/5">
                <div className="font-semibold">Customer contact</div>
                <div className="mt-2 text-slate-700 dark:text-slate-200">
                  <div>Name: {selected.customerName}</div>
                  <div>Email: {selected.email}</div>
                  <div>Mobile: {selected.mobileNumber}</div>
                  <div>Company: {selected.companyName || "-"}</div>
                  <div>GST: {selected.gstNumber || "-"}</div>
                </div>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-white/5">
                <div className="font-semibold">Admin workflow</div>
                <div className="mt-2 text-slate-700 dark:text-slate-200">
                  <div>Status: {selected.status}</div>
                  <div>Submitted at: {formatDateTime(selected.createdAt)}</div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Rental Request</DialogTitle>
            <DialogDescription>
              Update request details for {editTarget?.rentalRequestId || "selected request"}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Trip type
                </label>
                <select
                  value={editForm.tripType}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, tripType: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                >
                  {[
                    "one-way",
                    "round trip",
                    "local hourly",
                    "outstation",
                    "airport transfer",
                    "employee transport",
                    "school transport",
                    "event shuttle",
                  ].map((tripType) => (
                    <option key={tripType} value={tripType}>
                      {tripType}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, status: e.target.value as RentalRequest["status"] }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                >
                  {(["New", "In Progress", "Quoted", "Closed"] as RentalRequest["status"][]).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                value={editForm.pickupLocation}
                onChange={(e) => setEditForm((prev) => ({ ...prev, pickupLocation: e.target.value }))}
                placeholder="Pickup location"
              />
              <Input
                value={editForm.dropLocation}
                onChange={(e) => setEditForm((prev) => ({ ...prev, dropLocation: e.target.value }))}
                placeholder="Drop location"
              />

              <Input
                type="date"
                value={editForm.journeyDate}
                onChange={(e) => setEditForm((prev) => ({ ...prev, journeyDate: e.target.value }))}
              />
              <Input
                type="time"
                value={editForm.reportingTime}
                onChange={(e) => setEditForm((prev) => ({ ...prev, reportingTime: e.target.value }))}
              />
              <Input
                type="datetime-local"
                value={editForm.tripEndDateTime}
                onChange={(e) => setEditForm((prev) => ({ ...prev, tripEndDateTime: e.target.value }))}
              />
              <Input
                type="number"
                value={editForm.passengerCount}
                onChange={(e) => setEditForm((prev) => ({ ...prev, passengerCount: Number(e.target.value) }))}
                placeholder="Passenger count"
              />
              <Input
                type="number"
                value={editForm.seatingCapacityRequired}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, seatingCapacityRequired: Number(e.target.value) }))
                }
                placeholder="Seating capacity required"
              />
              <Input
                value={editForm.customerName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, customerName: e.target.value }))}
                placeholder="Customer name"
              />
              <Input
                value={editForm.mobileNumber}
                onChange={(e) => setEditForm((prev) => ({ ...prev, mobileNumber: e.target.value }))}
                placeholder="Mobile number"
              />
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)} disabled={savingEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Rental Request</DialogTitle>
            <DialogDescription>
              This will permanently delete request {deleteTarget?.rentalRequestId || "N/A"}. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

