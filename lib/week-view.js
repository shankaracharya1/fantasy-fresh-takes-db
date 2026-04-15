const IST_TIME_ZONE = "Asia/Kolkata";
export const MIN_DASHBOARD_DATE = "2026-03-16";

export const WEEK_VIEW_OPTIONS = [
  { id: "current", label: "Current week", delta: 0 },
  { id: "next", label: "Next week", delta: 1 },
  { id: "last", label: "Last week", delta: -1 },
];

const WEEK_VIEW_DELTA = Object.fromEntries(WEEK_VIEW_OPTIONS.map((option) => [option.id, option.delta]));
const WEEK_VIEW_LABELS = Object.fromEntries(WEEK_VIEW_OPTIONS.map((option) => [option.id, option.label]));

function getDateParts(value, timeZone = IST_TIME_ZONE) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function normalizeWeekView(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(WEEK_VIEW_DELTA, normalized) ? normalized : "current";
}

export function getWeekViewLabel(value) {
  return WEEK_VIEW_LABELS[normalizeWeekView(value)];
}

export function todayInIstYmd() {
  const parts = getDateParts(new Date(), IST_TIME_ZONE);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isValidYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return false;
  }

  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseYmdToUtcDate(value) {
  if (!isValidYmd(value)) {
    return new Date(Date.UTC(1970, 0, 1, 12));
  }

  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function formatYmd(value) {
  const date = value instanceof Date ? value : parseYmdToUtcDate(value);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function shiftYmd(value, days) {
  const date = parseYmdToUtcDate(value);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return formatYmd(date);
}

export function getWeekWindowFromReference(referenceDate = todayInIstYmd()) {
  const safeReference = isValidYmd(referenceDate) ? referenceDate : todayInIstYmd();
  const date = parseYmdToUtcDate(safeReference);
  const weekday = date.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const weekStart = shiftYmd(safeReference, mondayOffset);

  return {
    referenceDate: safeReference,
    weekStart,
    weekEnd: shiftYmd(weekStart, 6),
  };
}

export function getWeekSelection(period = "current", baseDate = todayInIstYmd()) {
  const normalizedPeriod = normalizeWeekView(period);
  const currentWindow = getWeekWindowFromReference(baseDate);
  const delta = WEEK_VIEW_DELTA[normalizedPeriod] || 0;
  const weekStart = shiftYmd(currentWindow.weekStart, delta * 7);
  const weekEnd = shiftYmd(weekStart, 6);

  return {
    period: normalizedPeriod,
    periodLabel: getWeekViewLabel(normalizedPeriod),
    referenceDate: currentWindow.referenceDate,
    weekStart,
    weekEnd,
    weekKey: weekStart,
  };
}

export function formatWeekRangeLabel(weekStart, weekEnd) {
  if (!isValidYmd(weekStart) || !isValidYmd(weekEnd)) {
    return "";
  }

  const start = parseYmdToUtcDate(weekStart);
  const end = parseYmdToUtcDate(weekEnd);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });

  return `${startLabel} - ${endLabel}`;
}

export function getMonthWeekDateRange(monthKey, weekInMonth) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) {
    return null;
  }

  const [year, month] = String(monthKey).split("-").map(Number);
  if (!year || !month) {
    return null;
  }

  const safeWeek = Number(weekInMonth);
  if (!Number.isFinite(safeWeek) || safeWeek < 1) {
    return null;
  }

  const startDay = (safeWeek - 1) * 7 + 1;
  const monthEndDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  const endDay = safeWeek >= 4 ? monthEndDay : Math.min(startDay + 6, monthEndDay);

  return {
    start: `${year}-${String(month).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
  };
}

export function formatMonthWeekLabel(monthKey, weekInMonth) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) {
    return "";
  }

  const [year, month] = String(monthKey).split("-").map(Number);
  if (!year || !month || !weekInMonth) {
    return "";
  }

  const monthLabel = new Date(Date.UTC(year, month - 1, 1, 12)).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  return `${monthLabel} week ${weekInMonth}`;
}

export function getMonthWeekOptions(monthKey = todayInIstYmd().slice(0, 7)) {
  const safeMonthKey = /^\d{4}-\d{2}$/.test(String(monthKey || "")) ? String(monthKey) : todayInIstYmd().slice(0, 7);
  return [1, 2, 3, 4]
    .map((weekInMonth) => {
      const range = getMonthWeekDateRange(safeMonthKey, weekInMonth);
      if (!range) {
        return null;
      }

      return {
        id: `${safeMonthKey}::${weekInMonth}`,
        monthKey: safeMonthKey,
        weekInMonth,
        label: formatMonthWeekLabel(safeMonthKey, weekInMonth),
        weekStart: range.start,
        weekEnd: range.end,
        rangeLabel: formatWeekRangeLabel(range.start, range.end),
      };
    })
    .filter(Boolean);
}

export function getMonthWeekSelectionByDate(value = todayInIstYmd()) {
  if (!isValidYmd(value)) {
    const safeMonthKey = todayInIstYmd().slice(0, 7);
    return { monthKey: safeMonthKey, weekInMonth: 1, id: `${safeMonthKey}::1` };
  }

  const monthKey = String(value).slice(0, 7);
  const day = Number(String(value).slice(8, 10));
  const weekInMonth = Math.min(4, Math.max(1, Math.ceil(day / 7)));
  return {
    monthKey,
    weekInMonth,
    id: `${monthKey}::${weekInMonth}`,
  };
}

export function buildMonthWeekFilterOptions(rows = []) {
  const map = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const monthKey = String(row?.monthKey || "").trim();
    const weekInMonth = Number(row?.weekInMonth || 0);
    if (!/^\d{4}-\d{2}$/.test(monthKey) || !Number.isFinite(weekInMonth) || weekInMonth < 1) {
      continue;
    }

    const id = `${monthKey}::${weekInMonth}`;
    if (map.has(id)) {
      continue;
    }

    const range = getMonthWeekDateRange(monthKey, weekInMonth);
    map.set(id, {
      id,
      monthKey,
      weekInMonth,
      label: formatMonthWeekLabel(monthKey, weekInMonth),
      weekStart: range?.start || "",
      weekEnd: range?.end || "",
      rangeLabel: range ? formatWeekRangeLabel(range.start, range.end) : "",
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.monthKey !== b.monthKey) return a.monthKey.localeCompare(b.monthKey);
    return a.weekInMonth - b.weekInMonth;
  });
}

export function clampYmdToMin(value, minDate = MIN_DASHBOARD_DATE) {
  const safeMin = isValidYmd(minDate) ? minDate : MIN_DASHBOARD_DATE;
  if (!isValidYmd(value)) {
    return safeMin;
  }
  return value < safeMin ? safeMin : value;
}

export function buildDateRangeSelection({
  startDate,
  endDate,
  period = "current",
  minDate = MIN_DASHBOARD_DATE,
} = {}) {
  const fallbackWeek = getWeekSelection(period);
  const safeMin = isValidYmd(minDate) ? minDate : MIN_DASHBOARD_DATE;
  const fallbackStart = clampYmdToMin(fallbackWeek.weekStart, safeMin);
  const fallbackEnd = fallbackWeek.weekEnd < fallbackStart ? fallbackStart : fallbackWeek.weekEnd;
  const normalizedStart = clampYmdToMin(startDate || fallbackStart, safeMin);
  const normalizedEndCandidate = isValidYmd(endDate) ? endDate : fallbackEnd;
  const normalizedEnd = normalizedEndCandidate < normalizedStart ? normalizedStart : normalizedEndCandidate;

  return {
    period: normalizeWeekView(period),
    startDate: normalizedStart,
    endDate: normalizedEnd,
    weekStart: normalizedStart,
    weekEnd: normalizedEnd,
    weekKey: normalizedStart,
    selectionMode: "date-range",
    rangeLabel: formatWeekRangeLabel(normalizedStart, normalizedEnd),
  };
}
