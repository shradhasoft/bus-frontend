const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const BUS_SERVICE_STATUS_VALUES = ["active", "inactive"];
export const BUS_STATUS_OVERRIDE_NOTE_MAX_LENGTH = 160;

const pad2 = (value) => String(value).padStart(2, "0");

export const formatDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (value) => {
  const token = String(value || "").trim();
  if (!DATE_KEY_REGEX.test(token)) return null;

  const [yearRaw, monthRaw, dayRaw] = token.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) return null;

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
};

export const normalizeDateKey = (value) => {
  const asString = String(value || "").trim();
  if (DATE_KEY_REGEX.test(asString)) {
    return parseDateKey(asString) ? asString : "";
  }
  return formatDateKey(value);
};

export const getTodayDateKey = () => formatDateKey(new Date());

export const normalizeServiceStatus = (value) => {
  const token = String(value || "")
    .trim()
    .toLowerCase();

  return BUS_SERVICE_STATUS_VALUES.includes(token) ? token : "";
};

export const sanitizeStatusOverrideNote = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, BUS_STATUS_OVERRIDE_NOTE_MAX_LENGTH);
};

export const getDayLabelForDateKey = (dateKey) => {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return "";
  return DAY_LABELS[parsed.getUTCDay()] || "";
};

const toSafeTimestamp = (value) => {
  const parsed = new Date(value);
  const millis = parsed.getTime();
  return Number.isNaN(millis) ? 0 : millis;
};

export const normalizeBusStatusOverrides = (overrides = []) => {
  if (!Array.isArray(overrides)) return [];

  const byDate = new Map();

  for (const row of overrides) {
    const dateKey = normalizeDateKey(row?.dateKey || row?.date);
    const status = normalizeServiceStatus(row?.status);
    if (!dateKey || !status) continue;

    const current = byDate.get(dateKey);
    const currentUpdatedAt = toSafeTimestamp(current?.updatedAt);
    const nextUpdatedAt = toSafeTimestamp(row?.updatedAt);

    if (!current || nextUpdatedAt >= currentUpdatedAt) {
      byDate.set(dateKey, {
        dateKey,
        status,
        note: sanitizeStatusOverrideNote(row?.note),
        updatedBy: row?.updatedBy || null,
        updatedAt: row?.updatedAt ? new Date(row.updatedAt) : new Date(),
      });
    }
  }

  return Array.from(byDate.values()).sort((first, second) =>
    String(first.dateKey).localeCompare(String(second.dateKey)),
  );
};

const getOverrideForDate = (bus, dateKey) => {
  if (!dateKey) return null;
  const overrides = Array.isArray(bus?.serviceStatusOverrides)
    ? bus.serviceStatusOverrides
    : [];

  for (let index = overrides.length - 1; index >= 0; index -= 1) {
    const row = overrides[index];
    const rowDateKey = normalizeDateKey(row?.dateKey || row?.date);
    if (rowDateKey !== dateKey) continue;

    const status = normalizeServiceStatus(row?.status);
    if (!status) continue;

    return {
      dateKey,
      status,
      note: sanitizeStatusOverrideNote(row?.note),
      updatedBy: row?.updatedBy || null,
      updatedAt: row?.updatedAt || null,
    };
  }

  return null;
};

export const getBusServiceStatusForDate = (bus, dateValue) => {
  const dateKey = normalizeDateKey(dateValue) || getTodayDateKey();
  const baseStatus = bus?.isActive === false ? "inactive" : "active";
  const override = getOverrideForDate(bus, dateKey);
  const effectiveStatus = override?.status || baseStatus;

  return {
    dateKey,
    baseStatus,
    effectiveStatus,
    hasOverride: Boolean(override),
    override,
  };
};

export const isBusActiveForDate = (bus, dateValue) => {
  if (!bus || bus.isDeleted) return false;
  return getBusServiceStatusForDate(bus, dateValue).effectiveStatus === "active";
};

export const buildBusActiveOnDateQuery = (dateValue) => {
  const dateKey = normalizeDateKey(dateValue);

  if (!dateKey) {
    return { isActive: true };
  }

  return {
    $or: [
      {
        serviceStatusOverrides: {
          $elemMatch: {
            dateKey,
            status: "active",
          },
        },
      },
      {
        isActive: true,
        serviceStatusOverrides: {
          $not: {
            $elemMatch: { dateKey },
          },
        },
      },
    ],
  };
};

export const isPastDateKey = (dateKey) => {
  const normalizedDateKey = normalizeDateKey(dateKey);
  if (!normalizedDateKey) return false;
  const todayDateKey = getTodayDateKey();
  return normalizedDateKey < todayDateKey;
};
