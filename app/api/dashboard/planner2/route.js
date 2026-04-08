import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import { buildDateRangeSelection, formatWeekRangeLabel, getWeekSelection, todayInIstYmd } from "../../../../lib/week-view.js";
import { parseLiveDate } from "../../../../lib/live-tab.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const require = createRequire(import.meta.url);
const { parseCsv, parseGoogleSheetId, makeError } = require("../../../../lib/ops/cjs/_lib.cjs");

const PLANNER2_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1ISN0HkRtNj2STszz_P_iD8wHyImEFk-e6ciF9ZVhB28/edit?gid=484477053#gid=484477053";
const PLANNER2_GID = "484477053";

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function parseCellTasks(value) {
  const raw = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s\-•]+/, "").trim())
    .filter(Boolean);
  return raw.filter((line) => normalizeKey(line) !== "ooo");
}

function countCompletedTasks(lines) {
  return lines.filter((line) => {
    const key = normalizeKey(line);
    return (
      key.includes("submitted") ||
      key.includes("done") ||
      key.includes("complete") ||
      key.includes("completed") ||
      key.includes("approved") ||
      key.includes("live") ||
      key.includes("final pass") ||
      key.includes("pass")
    );
  }).length;
}

function inferOwnerLabel(header) {
  const cleaned = normalizeText(header);
  if (!cleaned) return "";
  const chunks = cleaned.split(" ").filter(Boolean);
  if (chunks.length <= 2) return cleaned;
  return chunks.slice(-2).join(" ");
}

function inferPodLeadLabel(header) {
  const key = normalizeKey(header);
  if (key.includes("woodward")) return "Woodward";
  if (key.includes("roth")) return "Roth";
  if (key.includes("gilatar")) return "Gilatar";
  if (key.includes("berman")) return "Berman";
  if (key.includes("lee")) return "Lee";
  return "Unmapped";
}

async function fetchPlanner2Rows() {
  const spreadsheetId = parseGoogleSheetId(PLANNER2_SHEET_URL);
  if (!spreadsheetId) {
    throw makeError("Planner2 sheet URL is invalid.", 500);
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${PLANNER2_GID}`;
  const response = await fetch(csvUrl, { cache: "no-store" });
  if (!response.ok) {
    throw makeError(`Planner2 tab fetch failed (HTTP ${response.status}).`, 502);
  }
  const csvText = await response.text();
  if (!csvText || !csvText.trim()) {
    throw makeError("Planner2 tab returned no data.", 502);
  }
  return parseCsv(csvText);
}

export async function GET(request) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const fallbackWeek = getWeekSelection("current");
  const rangeSelection = buildDateRangeSelection({
    startDate: startDate || fallbackWeek.weekStart,
    endDate: endDate || fallbackWeek.weekEnd,
  });
  const today = todayInIstYmd();

  try {
    const matrix = await fetchPlanner2Rows();
    if (!Array.isArray(matrix) || matrix.length < 2) {
      throw makeError("Planner2 tab format is not readable.", 500);
    }

    const headers = matrix[0] || [];
    const ownerColumns = headers
      .map((header, idx) => ({
        columnIndex: idx,
        rawHeader: normalizeText(header),
        ownerName: inferOwnerLabel(header),
        podLeadName: inferPodLeadLabel(header),
      }))
      .filter((item) => item.columnIndex > 0 && item.ownerName);

    const dayRows = [];
    for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex] || [];
      const rowDate = parseLiveDate(row[0]);
      if (!rowDate) continue;
      if (rowDate < rangeSelection.startDate || rowDate > rangeSelection.endDate) continue;

      const items = ownerColumns
        .map((owner) => {
          const lines = parseCellTasks(row[owner.columnIndex]);
          if (lines.length === 0) return null;
          const completedTaskCount = countCompletedTasks(lines);
          return {
            ownerName: owner.ownerName,
            podLeadName: owner.podLeadName,
            committedTaskCount: lines.length,
            completedTaskCount,
            laggingTaskCount:
              rowDate < today ? Math.max(0, lines.length - completedTaskCount) : 0,
            notes: lines.slice(0, 4),
          };
        })
        .filter(Boolean);

      dayRows.push({
        date: rowDate,
        dateLabel: formatWeekRangeLabel(rowDate, rowDate).split(" - ")[0] || rowDate,
        items,
      });
    }

    const ownerMap = new Map();
    for (const day of dayRows) {
      for (const item of day.items) {
        const key = normalizeKey(item.ownerName);
        if (!ownerMap.has(key)) {
          ownerMap.set(key, {
            ownerName: item.ownerName,
            podLeadName: item.podLeadName,
            committedTaskCount: 0,
            completedTaskCount: 0,
            laggingTaskCount: 0,
            activeDays: 0,
          });
        }
        const entry = ownerMap.get(key);
        entry.committedTaskCount += Number(item.committedTaskCount || 0);
        entry.completedTaskCount += Number(item.completedTaskCount || 0);
        entry.laggingTaskCount += Number(item.laggingTaskCount || 0);
        entry.activeDays += 1;
      }
    }

    const ownerRows = Array.from(ownerMap.values()).sort(
      (a, b) =>
        b.laggingTaskCount - a.laggingTaskCount ||
        b.committedTaskCount - a.committedTaskCount ||
        a.ownerName.localeCompare(b.ownerName)
    );
    const totalCommitted = ownerRows.reduce((sum, row) => sum + Number(row.committedTaskCount || 0), 0);
    const totalCompleted = ownerRows.reduce((sum, row) => sum + Number(row.completedTaskCount || 0), 0);
    const totalLagging = ownerRows.reduce((sum, row) => sum + Number(row.laggingTaskCount || 0), 0);

    return NextResponse.json({
      ok: true,
      source: "planner2-sheet",
      sourceUrl: PLANNER2_SHEET_URL,
      weekStart: rangeSelection.startDate,
      weekEnd: rangeSelection.endDate,
      weekLabel: formatWeekRangeLabel(rangeSelection.startDate, rangeSelection.endDate),
      lastUpdatedAt: new Date().toISOString(),
      totals: {
        committedTaskCount: totalCommitted,
        completedTaskCount: totalCompleted,
        laggingTaskCount: totalLagging,
      },
      ownerRows,
      dayRows,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Unable to load Planner2." },
      { status: error?.statusCode || 500 }
    );
  }
}
