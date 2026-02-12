"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Plus, Search, Trash2, UserRound, Pencil } from "lucide-react";
import { apiUrl } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UserRecord = {
  _id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  firebaseUID?: string | null;
  isActive?: boolean;
  isBlocked?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type UserFormState = {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  isBlocked: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  owner: "Owner",
  conductor: "Conductor",
  user: "User",
};

const ROLE_BADGE_STYLES: Record<string, string> = {
  superadmin:
    "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
  admin:
    "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200",
  owner:
    "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-200",
  conductor:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
  user:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200",
};

const DEFAULT_FORM: UserFormState = {
  fullName: "",
  email: "",
  phone: "",
  role: "user",
  isActive: true,
  isBlocked: false,
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getInitials = (name?: string | null, email?: string | null) => {
  const base = (name || email || "User").trim();
  if (!base) return "U";
  return base
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

const getDisplayName = (user: UserRecord) =>
  user.fullName || user.email || "Unnamed user";

const normalizeRoleLabel = (role?: string | null) =>
  ROLE_LABELS[role ?? ""] ?? role ?? "User";

const ManageUsersPage = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [formState, setFormState] = useState<UserFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = useMemo(() => {
    if (!total) return 1;
    return Math.max(1, Math.ceil(total / limit));
  }, [limit, total]);

  const pageNumbers = useMemo(() => {
    const window = 2;
    const start = Math.max(1, page - window);
    const end = Math.min(totalPages, page + window);
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  }, [page, totalPages]);

  const loadUsers = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (search) params.set("search", search);

        const response = await fetch(apiUrl(`/admin/users?${params.toString()}`), {
          method: "GET",
          credentials: "include",
          signal,
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load users.");
        }

        const data = payload?.data ?? {};
        setUsers(Array.isArray(data.users) ? data.users : []);
        const totalCount = Number(data.total) || 0;
        setTotal(totalCount);

        const computedTotalPages = Math.max(1, Math.ceil(totalCount / limit));
        if (page > computedTotalPages) {
          setPage(computedTotalPages);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || "Something went wrong.");
        }
      } finally {
        setLoading(false);
      }
    },
    [limit, page, search]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadUsers(controller.signal);
    return () => controller.abort();
  }, [loadUsers]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const openCreate = () => {
    setFormMode("create");
    setSelectedUser(null);
    setFormState(DEFAULT_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (user: UserRecord) => {
    setFormMode("edit");
    setSelectedUser(user);
    setFormState({
      fullName: user.fullName ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      role: user.role ?? "user",
      isActive: user.isActive ?? true,
      isBlocked: user.isBlocked ?? false,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const openView = (user: UserRecord) => {
    setFormMode("view");
    setSelectedUser(user);
    setFormState({
      fullName: user.fullName ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      role: user.role ?? "user",
      isActive: user.isActive ?? true,
      isBlocked: user.isBlocked ?? false,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formMode === "view") return;
    if (formMode === "edit" && !selectedUser?._id) {
      setFormError("Select a user to edit.");
      return;
    }

    if (
      formMode === "create" &&
      !formState.email.trim() &&
      !formState.phone.trim()
    ) {
      setFormError("Email or phone is required to create a user.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        fullName: formState.fullName.trim() || undefined,
        email: formState.email.trim() || undefined,
        phone: formState.phone.trim() || undefined,
        role: formState.role,
        isActive: formState.isActive,
        isBlocked: formState.isBlocked,
      };

      const endpoint =
        formMode === "create"
          ? apiUrl("/admin/users")
          : apiUrl(`/admin/users/${selectedUser._id}`);

      const response = await fetch(endpoint, {
        method: formMode === "create" ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to save user.");
      }

      setFormOpen(false);
      setSelectedUser(null);
      setFormState(DEFAULT_FORM);
      const controller = new AbortController();
      await loadUsers(controller.signal);
    } catch (err) {
      setFormError((err as Error).message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(
        apiUrl(`/admin/users/${deleteTarget._id}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete user.");
      }
      setDeleteTarget(null);
      const controller = new AbortController();
      await loadUsers(controller.signal);
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally {
      setDeleting(false);
    }
  };

  const startIndex = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = total === 0 ? 0 : Math.min(page * limit, total);
  const isReadOnly = formMode === "view";

  return (
    <div className="relative space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Manage Users
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Users
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
            {total.toLocaleString()} total - page {page} of {totalPages}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name or email..."
              className="w-48 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            />
          </div>
          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-900"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.1)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
        <div className="max-h-[560px] overflow-auto no-scrollbar">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100/95 text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Created</th>
                <th className="px-6 py-4 font-semibold">Updated</th>
                <th className="px-6 py-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300"
                  >
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user._id}
                    className="bg-white/60 transition hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">
                          {getInitials(user.fullName, user.email)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {getDisplayName(user)}
                            </span>
                            {user.isBlocked ? (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                                Blocked
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            ID: {user._id.slice(-10)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                      {user.email || "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em]",
                          ROLE_BADGE_STYLES[user.role ?? "user"] ??
                            ROLE_BADGE_STYLES.user
                        )}
                      >
                        {normalizeRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                      {formatDate(user.updatedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openView(user)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(user)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(user)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:-translate-y-0.5 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
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
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Prev
            </button>
            {pageNumbers.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPage(value)}
                className={cn(
                  "rounded-lg border px-3 py-1 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5",
                  value === page
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                    : "border-slate-200/80 dark:border-white/10"
                )}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200/80 px-3 py-1 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Last
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              {formMode === "create"
                ? "Create user"
                : formMode === "edit"
                  ? "Edit user"
                  : "User details"}
            </DialogTitle>
            <DialogDescription>
              {formMode === "create"
                ? "Add a new user profile, assign a role, and generate a Firebase ID."
                : formMode === "edit"
                  ? "Update profile details and access roles."
                  : "Review the full user profile and access role."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Full name
                </label>
                <Input
                  value={formState.fullName}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      fullName: event.target.value,
                    }))
                  }
                  placeholder="Jane Doe"
                  disabled={isReadOnly || submitting}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Email
                </label>
                <Input
                  type="email"
                  value={formState.email}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  placeholder="jane@example.com"
                  disabled={isReadOnly || submitting}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Phone
                </label>
                <Input
                  value={formState.phone}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="+1 555 0100"
                  disabled={isReadOnly || submitting}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Role
                </label>
                <select
                  value={formState.role}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      role: event.target.value,
                    }))
                  }
                  disabled={isReadOnly || submitting}
                  className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900 shadow-xs focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Firebase ID is generated automatically when the user is created.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      isActive: event.target.checked,
                    }))
                  }
                  disabled={isReadOnly || submitting}
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={formState.isBlocked}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      isBlocked: event.target.checked,
                    }))
                  }
                  disabled={isReadOnly || submitting}
                />
                Blocked
              </label>
            </div>

            {formError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {formError}
              </div>
            ) : null}

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Close
              </Button>
              {!isReadOnly ? (
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Save changes"}
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              This will permanently remove{" "}
              <strong>{deleteTarget ? getDisplayName(deleteTarget) : "user"}</strong>
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageUsersPage;
