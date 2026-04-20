"use client";

import { Fragment, useState, useEffect } from "react";
import {
  EmptyState,
  ShareablePanel,
  formatMetricValue,
  formatDateLabel,
  formatNumber,
  getDeltaMeta,
  normalizePodFilterKey,
  normalizeStageMatchKey,
} from "./shared.jsx";
import { matchAngleName } from "../../lib/fuzzy-match.js";

const LIVE_MIN_FINAL_UPLOAD_DATE = "2026-03-01";

// ─── Private helpers ──────────────────────────────────────────────────────────

function getBeatsStatusMeta(statusCategory) {
  if (statusCategory === "approved") {
    return { label: "Approved", color: "#2d5a3d", bg: "rgba(45, 90, 61, 0.14)" };
  }
  if (statusCategory === "abandoned") {
    return { label: "Abandoned", color: "#7d5a3a", bg: "rgba(125, 90, 58, 0.14)" };
  }
  if (statusCategory === "review_pending") {
    return { label: "Review pending", color: "#c2703e", bg: "rgba(194, 112, 62, 0.14)" };
  }
  if (statusCategory === "iterate") {
    return { label: "Iterate", color: "#9f2e2e", bg: "rgba(159, 46, 46, 0.14)" };
  }
  return { label: "To be ideated", color: "#6e6457", bg: "rgba(110, 100, 87, 0.14)" };
}

function formatMonthWeekLabel(monthKey, weekInMonth) {
  if (!monthKey || !weekInMonth) {
    return "";
  }

  const [year, month] = String(monthKey).split("-").map(Number);
  if (!year || !month) {
    return "";
  }

  const monthLabel = new Date(Date.UTC(year, month - 1, 1, 12)).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  return `${monthLabel} Wk${weekInMonth}`;
}

function getMonthWeekDateRange(monthKey, weekInMonth) {
  if (!monthKey || !weekInMonth) {
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

function getSelectedPeriodRangeLabel(selectedPeriodOption, beatRows) {
  if (!selectedPeriodOption || selectedPeriodOption.id === "overall") {
    const datedRows = (Array.isArray(beatRows) ? beatRows : [])
      .map((row) => String(row?.primaryDate || row?.completedDate || row?.assignedDate || ""))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));

    if (datedRows.length === 0) {
      return "All available Ideation tracker data";
    }

    return `${formatDateLabel(datedRows[0])} - ${formatDateLabel(datedRows[datedRows.length - 1])}`;
  }

  const range = getMonthWeekDateRange(selectedPeriodOption.monthKey, selectedPeriodOption.weekInMonth);
  if (!range) {
    return selectedPeriodOption.label || "";
  }

  return `${formatDateLabel(range.start)} - ${formatDateLabel(range.end)}`;
}

function getSelectedPeriodRange(selectedPeriodOption, beatRows) {
  if (!selectedPeriodOption || selectedPeriodOption.id === "overall") {
    const datedRows = (Array.isArray(beatRows) ? beatRows : [])
      .map((row) => String(row?.primaryDate || row?.completedDate || row?.assignedDate || ""))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));

    if (datedRows.length === 0) {
      return null;
    }

    return { start: datedRows[0], end: datedRows[datedRows.length - 1] };
  }

  return getMonthWeekDateRange(selectedPeriodOption.monthKey, selectedPeriodOption.weekInMonth);
}

function isDateWithinRange(value, range) {
  if (!range?.startDate || !range?.endDate) return true;
  const safeDate = String(value || "").slice(0, 10);
  if (!safeDate) return false;
  return safeDate >= range.startDate && safeDate <= range.endDate;
}

function rowHasDateInRange(rowDates, range) {
  if (!range?.startDate || !range?.endDate) return true;
  const dates = Array.isArray(rowDates) ? rowDates : [rowDates];
  return dates.some((date) => isDateWithinRange(date, range));
}

function compareDetailedTableValues(leftValue, rightValue) {
  const leftNumber = Number(leftValue);
  const rightNumber = Number(rightValue);
  const leftIsNumber = leftValue !== "" && leftValue !== null && leftValue !== undefined && Number.isFinite(leftNumber);
  const rightIsNumber = rightValue !== "" && rightValue !== null && rightValue !== undefined && Number.isFinite(rightNumber);

  if (leftIsNumber && rightIsNumber) {
    return leftNumber - rightNumber;
  }

  return String(leftValue || "").localeCompare(String(rightValue || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function filterWorkflowRows(rows, selectedPod, selectedPodKey) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (selectedPod !== "all") {
      const rowCanonicalKey = normalizePodFilterKey(row?.podMatchKey || row?.podLeadName);
      const rowRawKey = normalizePodFilterKey(row?.podLeadName);
      const selectedRawKey = normalizePodFilterKey(selectedPod);

      if (rowCanonicalKey !== selectedPodKey && rowRawKey !== selectedRawKey) {
        return false;
      }
    }
    return true;
  });
}

function sortWorkflowRows(rows, sortState) {
  const safeRows = Array.isArray(rows) ? [...rows] : [];
  return safeRows.sort((left, right) => {
    const comparison = compareDetailedTableValues(left?.[sortState.key] ?? "", right?.[sortState.key] ?? "");
    if (comparison !== 0) {
      return sortState.direction === "asc" ? comparison : -comparison;
    }
    return String(left?.id || "").localeCompare(String(right?.id || ""));
  });
}

function paginateRows(rows, page, pageSize) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const count = Math.max(1, Math.ceil(safeRows.length / pageSize));
  const safePage = Math.min(page, count - 1);
  const paginatedRows = safeRows.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const options = Array.from({ length: count }, (_, index) => {
    const start = index * pageSize + 1;
    const end = Math.min((index + 1) * pageSize, safeRows.length);
    return { index, label: `${start}-${end}` };
  });

  return { safePage, count, paginatedRows, options };
}

// ─── View ─────────────────────────────────────────────────────────────────────

export default function BeatsPerformanceContent({
  beatsPerformanceData,
  beatsPerformanceLoading,
  beatsPerformanceError,
  onShare,
  copyingSection,
  onNavigate,
  selectedDateRange,
  isV2 = false,
  competitionPodRows = [],
}) {
  const [expandedPods, setExpandedPods] = useState([]);

  const safeBeatsPerformanceData =
    beatsPerformanceData ||
    {
      filters: { pods: [] },
      rows: [],
      freshTakeRows: [],
      workflowTables: {
        editorial: [],
        readyForProduction: [],
        production: [],
        live: [],
      },
    };
  const activeDateRange = selectedDateRange || null;
  const activeDateRangeLabel =
    activeDateRange?.startDate && activeDateRange?.endDate
      ? `${formatDateLabel(activeDateRange.startDate)} - ${formatDateLabel(activeDateRange.endDate)}`
      : "All available data";
  const beatRows = Array.isArray(safeBeatsPerformanceData?.rows) ? safeBeatsPerformanceData.rows : [];
  const freshTakeRows = Array.isArray(safeBeatsPerformanceData?.freshTakeRows) ? safeBeatsPerformanceData.freshTakeRows : [];
  useEffect(() => {
    setExpandedPods([]);
  }, [activeDateRange?.startDate, activeDateRange?.endDate]);

  const scopedRows = beatRows.filter((row) =>
    rowHasDateInRange(row?.assignedDate || row?.primaryDate || row?.completedDate || row?.rawBucketLabel, activeDateRange)
  );
  const previousScopedRows = [];
  const isOverallPeriod = true;

  const activePods = Array.from(
    new Set(scopedRows.map((row) => String(row?.podLeadName || "").trim()).filter(Boolean))
  );
  const totalBeats = scopedRows.length;
  const approvedCount = scopedRows.filter((row) => row.statusCategory === "approved").length;
  const abandonedCount = scopedRows.filter((row) => row.statusCategory === "abandoned").length;
  const reviewPendingCount = scopedRows.filter((row) => row.statusCategory === "review_pending").length;
  const iterateCount = scopedRows.filter((row) => row.statusCategory === "iterate").length;
  const previousApprovedCount = previousScopedRows.filter((row) => row.statusCategory === "approved").length;
  const previousAbandonedCount = previousScopedRows.filter((row) => row.statusCategory === "abandoned").length;
  const previousReviewPendingCount = previousScopedRows.filter((row) => row.statusCategory === "review_pending").length;
  const previousIterateCount = previousScopedRows.filter((row) => row.statusCategory === "iterate").length;
  const compRows = Array.isArray(competitionPodRows) ? competitionPodRows : [];
  const compTotalScripts = compRows.reduce((s, r) => s + (Number(r.lifetimeScripts) || 0), 0);

  const metricCards = isV2
    ? [
        { label: "Total scripts", value: formatMetricValue(compTotalScripts), delta: null },
      ]
    : [
        { label: "Total Beats", value: formatMetricValue(totalBeats), delta: null },
        { label: "Approved beats", value: formatMetricValue(approvedCount), delta: null },
        { label: "Review pending", value: formatMetricValue(reviewPendingCount), delta: null },
        { label: "Iterate", value: formatMetricValue(iterateCount), delta: null },
        { label: "Abandoned", value: formatMetricValue(abandonedCount), delta: null },
      ];
  const podStatusSummaryRows = activePods
    .map((podLeadName) => {
      const podRows = scopedRows.filter((row) => row.podLeadName === podLeadName);
      const groups = {
        approved: podRows.filter((row) => row.statusCategory === "approved"),
        abandoned: podRows.filter((row) => row.statusCategory === "abandoned"),
        reviewPending: podRows.filter((row) => row.statusCategory === "review_pending"),
        iterate: podRows.filter((row) => row.statusCategory === "iterate"),
        toBeIdeated: podRows.filter((row) => row.statusCategory === "to_be_ideated"),
      };

      return {
        podLeadName,
        approved: groups.approved.length,
        abandoned: groups.abandoned.length,
        reviewPending: groups.reviewPending.length,
        iterate: groups.iterate.length,
        toBeIdeated: groups.toBeIdeated.length,
        total: podRows.length,
        groups,
      };
    })
    .sort((left, right) => right.total - left.total || left.podLeadName.localeCompare(right.podLeadName));

  return (
    <div className="beats-performance-shell">
      <div style={{ marginBottom: 14, fontSize: 13, fontWeight: 700, color: "var(--subtle)" }}>
        Showing {activeDateRangeLabel}
      </div>
      <ShareablePanel shareLabel="Beats Performance" onShare={onShare} isSharing={copyingSection === "Beats Performance"}>
      <div className="section-stack">
        {beatsPerformanceLoading ? <div className="warning-note">Refreshing data from Sheets…</div> : null}
        {beatsPerformanceError ? <div className="warning-note">{beatsPerformanceError}</div> : null}
        {!beatsPerformanceLoading && !beatsPerformanceError && Array.isArray(safeBeatsPerformanceData?.warnings) && safeBeatsPerformanceData.warnings.length > 0
          ? safeBeatsPerformanceData.warnings.map((w) => <div key={w} className="warning-note">{w}</div>)
          : null}

        {metricCards.length > 0 && (
          <div className="pod-summary-grid beats-summary-grid">
            {metricCards.map((card) => (
              <div key={card.label} className="metric-card beats-metric-card">
                <div className="metric-label">{card.label}</div>
                <div className="metric-value">{card.value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }} />

        <div className="pod-section-header">
          <span className="pod-section-title">POD Status</span>
          <span className="pod-section-subtitle">Expand a POD to see Writer name - Beat name by status</span>
        </div>

        <div className="table-wrap">
          <table className="ops-table beats-pod-table">
            <thead>
              <tr>
                <th>POD</th>
                <th>Approved</th>
                <th>Abandoned</th>
                <th>Review pending</th>
                <th>Iterate</th>
                <th>To be ideated</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {podStatusSummaryRows.length > 0 ? (
                podStatusSummaryRows.map((row) => {
                  const isExpanded = expandedPods.includes(row.podLeadName);
                  const detailGroups = [
                    ["approved", "Approved", row.groups.approved],
                    ["abandoned", "Abandoned", row.groups.abandoned],
                    ["reviewPending", "Review pending", row.groups.reviewPending],
                    ["iterate", "Iterate", row.groups.iterate],
                    ["toBeIdeated", "To be ideated", row.groups.toBeIdeated],
                  ];

                  return (
                    <Fragment key={row.podLeadName}>
                      <tr className={isExpanded ? "is-open" : undefined}>
                        <td>
                          <button
                            type="button"
                            className="pod-expand-button"
                            onClick={() =>
                              setExpandedPods((current) =>
                                current.includes(row.podLeadName)
                                  ? current.filter((pod) => pod !== row.podLeadName)
                                  : [...current, row.podLeadName]
                              )
                            }
                          >
                            <span>{row.podLeadName || "-"}</span>
                            <span className="pod-expand-chevron" aria-hidden="true">
                              {isExpanded ? "▾" : "▸"}
                            </span>
                          </button>
                        </td>
                        <td>{formatMetricValue(row.approved)}</td>
                        <td>{formatMetricValue(row.abandoned)}</td>
                        <td>{formatMetricValue(row.reviewPending)}</td>
                        <td>{formatMetricValue(row.iterate)}</td>
                        <td>{formatMetricValue(row.toBeIdeated)}</td>
                        <td>{formatMetricValue(row.total)}</td>
                      </tr>
                      {isExpanded ? (
                        <tr className="beats-pod-detail-row">
                          <td colSpan="7">
                            <div className="beats-pod-detail-panel">
                              <div className="beats-pod-detail-grid">
                                {detailGroups.map(([statusKey, statusLabel, statusRows]) => (
                                  <div key={`${row.podLeadName}-${statusKey}`} className="beats-pod-detail-column">
                                    <div className="beats-pod-detail-label">{statusLabel}</div>
                                    <div className="beats-pod-detail-list">
                                      {statusRows.length > 0 ? (
                                        statusRows.map((detailRow) => (
                                          <div key={detailRow.id} className="beats-pod-detail-item">
                                            <span className="beats-pod-detail-writer">{detailRow.writerName || "Beats owner"}</span>
                                            <span className="beats-pod-detail-separator">-</span>
                                            <span className="beats-pod-detail-beat">{detailRow.beatName || detailRow.beatCode || "Beat"}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="beats-pod-detail-empty">No rows</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="empty-cell">
                    No beats match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </ShareablePanel>
    </div>
  );
}
