"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  PencilLine,
  RefreshCw,
  Save,
  Trash2,
  UserPlus2,
  UserRound,
  X,
} from "lucide-react";

import { apiUrl } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";

type ConductorRecord = {
  _id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean;
  isBlocked?: boolean;
  assignedBusCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

type BusRecord = {
  _id: string;
  busName?: string;
  busNumber?: string;
  operator?: string;
  route?: {
    routeCode?: string;
    origin?: string;
    destination?: string;
  };
  conductor?: ConductorRecord | null;
};

type ConductorListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

type ConductorFormState = {
  fullName: string;
  email: string;
  phone: string;
  isActive: boolean;
  isBlocked: boolean;
};

const defaultConductorForm = (): ConductorFormState => ({
  fullName: "",
  email: "",
  phone: "",
  isActive: true,
  isBlocked: false,
});

const getConductorLabel = (conductor?: ConductorRecord | null) => {
  if (!conductor) return "Unassigned";
  return (
    conductor.fullName?.trim() ||
    conductor.email?.trim() ||
    conductor.phone?.trim() ||
    "Assigned"
  );
};

const getConductorContact = (conductor?: ConductorRecord | null) =>
  conductor?.email?.trim() || conductor?.phone?.trim() || "No contact";

const ConductorAssignmentManager = () => {
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [busesLoading, setBusesLoading] = useState(false);
  const [busesError, setBusesError] = useState<string | null>(null);

  const [conductors, setConductors] = useState<ConductorRecord[]>([]);
  const [conductorsLoading, setConductorsLoading] = useState(false);
  const [conductorsError, setConductorsError] = useState<string | null>(null);
  const [assignmentConductors, setAssignmentConductors] = useState<
    ConductorRecord[]
  >([]);
  const [assignmentConductorsLoading, setAssignmentConductorsLoading] =
    useState(false);
  const [conductorSearch, setConductorSearch] = useState("");
  const [conductorPage, setConductorPage] = useState(1);
  const [conductorMeta, setConductorMeta] = useState<ConductorListMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  });

  const [createForm, setCreateForm] = useState<ConductorFormState>(defaultConductorForm);
  const [creatingConductor, setCreatingConductor] = useState(false);

  const [editingConductorId, setEditingConductorId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ConductorFormState>(defaultConductorForm);
  const [updatingConductorId, setUpdatingConductorId] = useState<string | null>(null);
  const [deletingConductorId, setDeletingConductorId] = useState<string | null>(null);

  const [selectionByBus, setSelectionByBus] = useState<Record<string, string>>({});
  const [savingBusId, setSavingBusId] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async () => {
    const token = await firebaseAuth.currentUser?.getIdToken().catch(() => null);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const loadOwnerBuses = useCallback(async () => {
    setBusesLoading(true);
    setBusesError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(apiUrl("/v1/telemetry/owner/buses"), {
        method: "GET",
        credentials: "include",
        headers,
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to load buses.");
      }

      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setBuses(rows);
      setSelectionByBus(() => {
        const mapping: Record<string, string> = {};
        rows.forEach((row: BusRecord) => {
          mapping[row._id] = row?.conductor?._id ? String(row.conductor._id) : "";
        });
        return mapping;
      });
    } catch (error) {
      setBusesError((error as Error).message || "Unable to load buses.");
    } finally {
      setBusesLoading(false);
    }
  }, [getAuthHeaders]);

  const loadConductors = useCallback(
    async (searchText: string, page: number) => {
      setConductorsLoading(true);
      setConductorsError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", "20");
        params.set("page", String(page));
        if (searchText.trim()) {
          params.set("search", searchText.trim());
        }

        const headers = await getAuthHeaders();
        const response = await fetch(
          apiUrl(`/v1/telemetry/owner/conductors?${params.toString()}`),
          {
            method: "GET",
            credentials: "include",
            headers,
            cache: "no-store",
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to load conductors.");
        }

        const data = payload?.data || {};
        const rows = Array.isArray(data?.conductors)
          ? data.conductors
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        setConductors(rows);
        setConductorMeta({
          page: Number(data?.page || page),
          limit: Number(data?.limit || 20),
          total: Number(data?.total || rows.length || 0),
          totalPages: Number(data?.totalPages || 1),
          hasNext: Boolean(data?.hasNext),
          hasPrevious: Boolean(data?.hasPrevious),
        });
      } catch (error) {
        setConductors([]);
        setConductorMeta({
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        });
        setConductorsError(
          (error as Error).message || "Unable to load conductors.",
        );
      } finally {
        setConductorsLoading(false);
      }
    },
    [getAuthHeaders],
  );

  const loadAssignableConductors = useCallback(async () => {
    setAssignmentConductorsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      params.set("page", "1");
      params.set("onlyAssignable", "1");

      const headers = await getAuthHeaders();
      const response = await fetch(
        apiUrl(`/v1/telemetry/owner/conductors?${params.toString()}`),
        {
          method: "GET",
          credentials: "include",
          headers,
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to load assignable conductors.");
      }

      const data = payload?.data || {};
      const rows = Array.isArray(data?.conductors)
        ? data.conductors
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      setAssignmentConductors(rows);
    } catch {
      setAssignmentConductors([]);
    } finally {
      setAssignmentConductorsLoading(false);
    }
  }, [getAuthHeaders]);

  const reloadAll = useCallback(() => {
    void loadOwnerBuses();
    void loadConductors(conductorSearch, conductorPage);
    void loadAssignableConductors();
  }, [
    conductorPage,
    conductorSearch,
    loadAssignableConductors,
    loadConductors,
    loadOwnerBuses,
  ]);

  useEffect(() => {
    void loadOwnerBuses();
  }, [loadOwnerBuses]);

  useEffect(() => {
    void loadAssignableConductors();
  }, [loadAssignableConductors]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadConductors(conductorSearch, conductorPage);
    }, 250);
    return () => clearTimeout(timer);
  }, [conductorPage, conductorSearch, loadConductors]);

  const assignableConductors = useMemo(() => assignmentConductors, [assignmentConductors]);

  const handleCreateConductor = useCallback(async () => {
    setNotice(null);
    setCreatingConductor(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(apiUrl("/v1/telemetry/owner/conductors"), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          fullName: createForm.fullName,
          email: createForm.email || undefined,
          phone: createForm.phone || undefined,
          isActive: createForm.isActive,
          isBlocked: createForm.isBlocked,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to create conductor.");
      }

      setCreateForm(defaultConductorForm());
      setConductorPage(1);
      setNotice("Conductor created successfully.");
      await Promise.all([loadConductors("", 1), loadAssignableConductors()]);
    } catch (error) {
      setNotice((error as Error).message || "Failed to create conductor.");
    } finally {
      setCreatingConductor(false);
    }
  }, [createForm, getAuthHeaders, loadAssignableConductors, loadConductors]);

  const startEditConductor = useCallback((conductor: ConductorRecord) => {
    setEditingConductorId(conductor._id);
    setEditForm({
      fullName: conductor.fullName || "",
      email: conductor.email || "",
      phone: conductor.phone || "",
      isActive: conductor.isActive !== false,
      isBlocked: conductor.isBlocked === true,
    });
  }, []);

  const cancelEditConductor = useCallback(() => {
    setEditingConductorId(null);
    setEditForm(defaultConductorForm());
  }, []);

  const handleUpdateConductor = useCallback(
    async (conductorId: string) => {
      setNotice(null);
      setUpdatingConductorId(conductorId);

      try {
        const headers = await getAuthHeaders();
        const response = await fetch(
          apiUrl(`/v1/telemetry/owner/conductors/${conductorId}`),
          {
            method: "PATCH",
            credentials: "include",
            headers,
            body: JSON.stringify({
              fullName: editForm.fullName,
              email: editForm.email,
              phone: editForm.phone,
              isActive: editForm.isActive,
              isBlocked: editForm.isBlocked,
            }),
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to update conductor.");
        }

        setNotice("Conductor updated successfully.");
        cancelEditConductor();
        await Promise.all([
          loadConductors(conductorSearch, conductorPage),
          loadAssignableConductors(),
        ]);
      } catch (error) {
        setNotice((error as Error).message || "Failed to update conductor.");
      } finally {
        setUpdatingConductorId(null);
      }
    },
    [
      cancelEditConductor,
      conductorPage,
      conductorSearch,
      editForm,
      getAuthHeaders,
      loadConductors,
      loadAssignableConductors,
    ],
  );

  const handleDeleteConductor = useCallback(
    async (conductor: ConductorRecord) => {
      if (
        !window.confirm(
          `Delete conductor "${getConductorLabel(conductor)}"? Assigned owner buses will be unassigned.`,
        )
      ) {
        return;
      }

      setNotice(null);
      setDeletingConductorId(conductor._id);
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(
          apiUrl(`/v1/telemetry/owner/conductors/${conductor._id}`),
          {
            method: "DELETE",
            credentials: "include",
            headers,
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to delete conductor.");
        }

        setNotice("Conductor deleted successfully.");
        if (editingConductorId === conductor._id) {
          cancelEditConductor();
        }

        await Promise.all([
          loadConductors(conductorSearch, conductorPage),
          loadAssignableConductors(),
          loadOwnerBuses(),
        ]);
      } catch (error) {
        setNotice((error as Error).message || "Failed to delete conductor.");
      } finally {
        setDeletingConductorId(null);
      }
    },
    [
      cancelEditConductor,
      conductorPage,
      conductorSearch,
      editingConductorId,
      getAuthHeaders,
      loadConductors,
      loadAssignableConductors,
      loadOwnerBuses,
    ],
  );

  const updateAssignment = useCallback(
    async (busId: string) => {
      setNotice(null);
      setSavingBusId(busId);

      try {
        const conductorId = selectionByBus[busId] || null;
        const headers = await getAuthHeaders();
        const response = await fetch(
          apiUrl(`/v1/telemetry/owner/buses/${busId}/conductor`),
          {
            method: "PATCH",
            credentials: "include",
            headers,
            body: JSON.stringify({ conductorId }),
          },
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.message || "Failed to update assignment.");
        }

        const updatedBus = payload?.data as BusRecord | undefined;
        if (updatedBus?._id) {
          setBuses((prev) =>
            prev.map((bus) => (bus._id === updatedBus._id ? updatedBus : bus)),
          );
          setSelectionByBus((prev) => ({
            ...prev,
            [updatedBus._id]: updatedBus.conductor?._id
              ? String(updatedBus.conductor._id)
              : "",
          }));
        }

        setNotice(payload?.message || "Assignment updated.");
        await Promise.all([
          loadConductors(conductorSearch, conductorPage),
          loadAssignableConductors(),
        ]);
      } catch (error) {
        setNotice((error as Error).message || "Failed to update assignment.");
      } finally {
        setSavingBusId(null);
      }
    },
    [
      conductorPage,
      conductorSearch,
      getAuthHeaders,
      loadConductors,
      loadAssignableConductors,
      selectionByBus,
    ],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172a]/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Owner Conductor Operations
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Manage Conductors And Bus Assignments
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Full CRUD and assignment controls. Only your created conductors are visible.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
            onClick={reloadAll}
            disabled={busesLoading || conductorsLoading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/30">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Owner Buses
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-800 dark:text-slate-100">
              {busesLoading ? "-" : buses.length}
            </p>
            <p className="text-xs text-slate-500">Eligible for conductor assignment</p>
            {busesError ? <p className="mt-2 text-xs text-rose-600">{busesError}</p> : null}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/30">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Conductors
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-800 dark:text-slate-100">
              {conductorsLoading ? "-" : conductorMeta.total}
            </p>
            <p className="text-xs text-slate-500">Created by this owner</p>
            {conductorsError ? (
              <p className="mt-2 text-xs text-rose-600">{conductorsError}</p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/30">
            <label
              htmlFor="conductor-search"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
            >
              Search Conductors
            </label>
            <input
              id="conductor-search"
              value={conductorSearch}
              onChange={(event) => {
                setConductorPage(1);
                setConductorSearch(event.target.value);
              }}
              placeholder="Name, email, phone"
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-rose-400 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {notice ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            {notice}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f172a]/70">
          <div className="flex items-center gap-2">
            <UserPlus2 className="h-5 w-5 text-slate-600 dark:text-slate-200" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Create Conductor
            </h2>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Full Name
              </label>
              <input
                value={createForm.fullName}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, fullName: event.target.value }))
                }
                placeholder="Conductor name"
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-rose-400 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Email
                </label>
                <input
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="name@example.com"
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-rose-400 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Phone (E.164)
                </label>
                <input
                  value={createForm.phone}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  placeholder="+919876543210"
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-rose-400 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={createForm.isActive}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      isActive: event.target.checked,
                    }))
                  }
                />
                Active
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={createForm.isBlocked}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      isBlocked: event.target.checked,
                    }))
                  }
                />
                Blocked
              </label>
            </div>

            <button
              type="button"
              onClick={() => void handleCreateConductor()}
              disabled={creatingConductor}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {creatingConductor ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus2 className="h-4 w-4" />
              )}
              {creatingConductor ? "Creating..." : "Create Conductor"}
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f172a]/70">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Conductors (Owner Scoped)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900/60 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Conductor</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Assigned Buses</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!conductorsLoading && conductors.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={5}>
                      No conductors found for this owner.
                    </td>
                  </tr>
                ) : null}
                {conductors.map((conductor) => {
                  const isEditing = editingConductorId === conductor._id;
                  const isUpdating = updatingConductorId === conductor._id;
                  const isDeleting = deletingConductorId === conductor._id;

                  return (
                    <tr
                      key={conductor._id}
                      className="border-t border-slate-100 align-top dark:border-white/10"
                    >
                      <td className="px-4 py-4">
                        {isEditing ? (
                          <input
                            value={editForm.fullName}
                            onChange={(event) =>
                              setEditForm((prev) => ({
                                ...prev,
                                fullName: event.target.value,
                              }))
                            }
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-rose-400 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                          />
                        ) : (
                          <>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {getConductorLabel(conductor)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(conductor.createdAt || "").toString() !== "Invalid Date"
                                ? new Date(conductor.createdAt || "").toLocaleDateString()
                                : "-"}
                            </p>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              value={editForm.email}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  email: event.target.value,
                                }))
                              }
                              placeholder="Email"
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-rose-400 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                            />
                            <input
                              value={editForm.phone}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  phone: event.target.value,
                                }))
                              }
                              placeholder="Phone"
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-rose-400 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </div>
                        ) : (
                          <div className="text-xs text-slate-600 dark:text-slate-300">
                            <p>{conductor.email || "-"}</p>
                            <p>{conductor.phone || "-"}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {isEditing ? (
                          <div className="space-y-2 text-xs">
                            <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={editForm.isActive}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    isActive: event.target.checked,
                                  }))
                                }
                              />
                              Active
                            </label>
                            <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={editForm.isBlocked}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    isBlocked: event.target.checked,
                                  }))
                                }
                              />
                              Blocked
                            </label>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                              {conductor.isActive === false ? "Inactive" : "Active"}
                            </span>
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                              {conductor.isBlocked === true ? "Blocked" : "Allowed"}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {conductor.assignedBusCount || 0}
                      </td>
                      <td className="px-4 py-4">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleUpdateConductor(conductor._id)}
                              disabled={isUpdating}
                              className="inline-flex h-9 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                            >
                              {isUpdating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditConductor}
                              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditConductor(conductor)}
                              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteConductor(conductor)}
                              disabled={isDeleting}
                              className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-rose-600 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-300">
            <span>
              Page {conductorMeta.page} of {conductorMeta.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConductorPage((prev) => Math.max(prev - 1, 1))}
                disabled={!conductorMeta.hasPrevious || conductorsLoading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setConductorPage((prev) => prev + 1)}
                disabled={!conductorMeta.hasNext || conductorsLoading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f172a]/70">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Bus Assignment
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900/60 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 font-semibold">Bus</th>
                <th className="px-4 py-3 font-semibold">Route</th>
                <th className="px-4 py-3 font-semibold">Current</th>
                <th className="px-4 py-3 font-semibold">Assign</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {!busesLoading && buses.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    No buses found for this owner.
                  </td>
                </tr>
              ) : null}
              {buses.map((bus) => {
                const selectedConductorId = selectionByBus[bus._id] ?? "";
                const currentConductorId = bus?.conductor?._id
                  ? String(bus.conductor._id)
                  : "";
                const hasChanges = selectedConductorId !== currentConductorId;
                const isSaving = savingBusId === bus._id;

                return (
                  <tr
                    key={bus._id}
                    className="border-t border-slate-100 align-top dark:border-white/10"
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {bus.busName || "Unnamed bus"}
                      </p>
                      <p className="text-xs text-slate-500">{bus.busNumber || "-"}</p>
                      <p className="text-xs text-slate-500">{bus.operator || "-"}</p>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-300">
                      <p>
                        {(bus.route?.origin || "-") +
                          " -> " +
                          (bus.route?.destination || "-")}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {bus.route?.routeCode || "-"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                        <UserRound className="h-3.5 w-3.5" />
                        {getConductorLabel(bus.conductor)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={selectedConductorId}
                        onChange={(event) =>
                          setSelectionByBus((prev) => ({
                            ...prev,
                            [bus._id]: event.target.value,
                          }))
                        }
                        className="h-10 min-w-[240px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-rose-400 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="">Unassigned</option>
                        {assignmentConductorsLoading ? (
                          <option value="__loading" disabled>
                            Loading conductors...
                          </option>
                        ) : null}
                        {assignableConductors.map((conductor) => (
                          <option key={conductor._id} value={conductor._id}>
                            {getConductorLabel(conductor)} ({getConductorContact(conductor)})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => void updateAssignment(bus._id)}
                        disabled={isSaving || !hasChanges}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {isSaving ? "Saving" : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ConductorAssignmentManager;
