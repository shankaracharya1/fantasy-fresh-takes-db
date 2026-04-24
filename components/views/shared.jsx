"use client";

import { Component, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MIN_DASHBOARD_DATE, WEEK_VIEW_OPTIONS } from "../../lib/week-view.js";

// ─── Constants ────────────────────────────────────────────────────────────────

export const OVERVIEW_PERIODS = ["current", "last", "next"];

export const ACD_TIME_OPTIONS = [
  { id: "rolling7", label: "Rolling 7D" },
  { id: "rolling14", label: "Rolling 14D" },
  { id: "rolling30", label: "Rolling 30D" },
];

export const ACD_VIEW_OPTIONS = [
  { id: "acd", label: "ACD" },
  { id: "cd", label: "CD" },
];

export const CHART_TONE_POSITIVE = "#2d5a3d";
export const CHART_TONE_WARNING = "#c2703e";
export const CHART_TONE_DANGER = "#9f2e2e";

export const WRITER_TARGET_PER_WEEK = 1.5;

export const ANALYTICS_LEGEND_FALLBACK = [
  { label: "Gen AI", tone: "gen-ai" },
  { label: "P1 Rework", tone: "rework-p1" },
  { label: "P2 Rework", tone: "rework-p2" },
  { label: "Testing / Drop", tone: "testing-drop" },
  { label: "Metric not meeting", tone: "metric-miss" },
];

export const BEATS_PERFORMANCE_CLIENT_CACHE_KEY = "beats-performance-dashboard-v2";
export const BEATS_PERFORMANCE_CLIENT_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

const DEFAULT_START = "2025-01-01";
const DEFAULT_END = "2025-12-31";

// ─── Format Functions ─────────────────────────────────────────────────────────

export function formatDateLabel(value) {
  if (!value) return "-";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTimeLabel(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(Number(value || 0));
}

export function formatTat(value) {
  return value === null || value === undefined ? "-" : `${formatNumber(value)} d`;
}

export function formatMetricValue(value) {
  return value === null || value === undefined ? "-" : formatNumber(value);
}

export function formatCurrency(value) {
  return value === null || value === undefined ? "-" : `$${Number(value).toFixed(2)}`;
}

export function formatPercent(value) {
  return value === null || value === undefined ? "-" : `${formatNumber(value)}%`;
}

export function formatRatioValue(value) {
  return value === null || value === undefined ? "-" : formatNumber(value);
}

export function formatAnalyticsMetricValue(metric, format) {
  const value = metric?.value;
  if (format === "text") {
    return value === null || value === undefined || value === "" ? "-" : String(value);
  }

  if (format === "currency") {
    return formatCurrency(value);
  }

  if (format === "percent") {
    return formatPercent(value);
  }

  return formatMetricValue(value);
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function getDeltaMeta(currentValue, previousValue, noun = "vs last week") {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);
  const delta = current - previous;

  if (delta === 0) {
    return {
      text: `No change ${noun}`,
      color: "var(--subtle)",
    };
  }

  const direction = delta > 0 ? "+" : "-";
  return {
    text: `${direction}${formatMetricValue(Math.abs(delta))} ${noun}`,
    color: delta > 0 ? "#2d8a57" : "#c74a3a",
  };
}

export function normalizePodFilterKey(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeStageMatchKey(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function getAnalyticsLegendToneClass(tone) {
  if (tone === "gen-ai") return "legend-gen-ai";
  if (tone === "rework-p1") return "legend-rework-p1";
  if (tone === "rework-p2") return "legend-rework-p2";
  if (tone === "testing-drop") return "legend-testing-drop";
  if (tone === "metric-miss") return "legend-metric-miss";
  return "legend-neutral";
}

export function getAnalyticsNextStepToneClass(rowTone) {
  if (rowTone === "gen-ai") return "tone-gen-ai";
  if (rowTone === "rework-p1") return "tone-rework-p1";
  if (rowTone === "rework-p2") return "tone-rework-p2";
  if (rowTone === "testing-drop") return "tone-testing-drop";
  return "tone-neutral";
}

export function getPodOrderIndex(podLeadName, podOrder) {
  const index = Array.isArray(podOrder) ? podOrder.indexOf(podLeadName) : -1;
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function getTargetCardTone(actualValue, targetValue) {
  const actual = Number(actualValue);
  const target = Number(targetValue);

  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) {
    return "default";
  }

  const ratio = actual / target;

  if (ratio < 0.6) {
    return "danger-strong";
  }

  if (ratio < 0.85) {
    return "danger";
  }

  if (ratio < 1) {
    return "warning";
  }

  return ratio >= 1.15 ? "positive-strong" : "positive";
}

export function getTatCardTone(value, target) {
  const actual = Number(value);
  const safeTarget = Number(target || 1);

  if (!Number.isFinite(actual) || !Number.isFinite(safeTarget) || safeTarget <= 0) {
    return "default";
  }

  if (actual <= safeTarget) {
    return "positive";
  }

  if (actual <= safeTarget * 1.5) {
    return "warning";
  }

  if (actual <= safeTarget * 2.5) {
    return "danger";
  }

  return "danger-strong";
}

export function getWritingDaysTone(value) {
  const actual = Number(value);
  if (!Number.isFinite(actual)) {
    return "default";
  }

  return actual > 3 ? "warning" : "default";
}

export function getClReviewDaysTone(value) {
  const actual = Number(value);
  if (!Number.isFinite(actual)) {
    return "default";
  }

  return actual > 1 ? "warning" : "default";
}

export function getChartBarColor(index, totalCount) {
  const safeTotalCount = Number(totalCount || 0);
  if (!Number.isFinite(safeTotalCount) || safeTotalCount <= 0) {
    return CHART_TONE_POSITIVE;
  }

  const topCutoff = Math.ceil(safeTotalCount / 3);
  const middleCutoff = Math.ceil((safeTotalCount * 2) / 3);
  if (index < topCutoff) return CHART_TONE_POSITIVE;
  if (index < middleCutoff) return CHART_TONE_WARNING;
  return CHART_TONE_DANGER;
}

export function getAcdViewLabel(viewType) {
  return viewType === "cd" ? "CD" : "ACD";
}

export function getAcdTimeViewLabel(mode) {
  if (mode === "rolling7") return "Rolling 7D";
  if (mode === "rolling14") return "Rolling 14D";
  if (mode === "rolling30") return "Rolling 30D";
  return "Rolling 7D";
}

const EMPTY_ACD_MESSAGE = "No valid ACD output data available yet from Live tab sync.";

export function normalizeAcdMetrics(input) {
  const data = input && typeof input === "object" ? input : {};

  return {
    latestWorkDate: String(data.latestWorkDate || ""),
    dailyRows: Array.isArray(data.dailyRows) ? data.dailyRows : [],
    rolling7Rows: Array.isArray(data.rolling7Rows) ? data.rolling7Rows : [],
    rolling14Rows: Array.isArray(data.rolling14Rows) ? data.rolling14Rows : [],
    rolling30Rows: Array.isArray(data.rolling30Rows) ? data.rolling30Rows : [],
    rolling7CdRows: Array.isArray(data.rolling7CdRows) ? data.rolling7CdRows : [],
    rolling14CdRows: Array.isArray(data.rolling14CdRows) ? data.rolling14CdRows : [],
    rolling30CdRows: Array.isArray(data.rolling30CdRows) ? data.rolling30CdRows : [],
    trackedTeams: Array.isArray(data.trackedTeams) ? data.trackedTeams : [],
    syncStatus: data.syncStatus && typeof data.syncStatus === "object" ? data.syncStatus : {},
    failureReasonRows: Array.isArray(data.failureReasonRows) ? data.failureReasonRows : [],
    emptyStateMessage: String(data.emptyStateMessage || EMPTY_ACD_MESSAGE),
  };
}

export function getAcdLeaderboardDataset(metricsInput, mode, viewType) {
  const metrics = normalizeAcdMetrics(metricsInput);
  const safeMode = mode === "rolling14" || mode === "rolling30" ? mode : "rolling7";
  const safeViewType = viewType === "cd" ? "cd" : "acd";

  let rows = [];
  let meta = "Rolling 7D chart by total minutes.";

  if (safeMode === "rolling7") {
    const source = safeViewType === "cd" ? metrics.rolling7CdRows : metrics.rolling7Rows;
    rows = (source || []).map((row) => ({
      name: safeViewType === "cd" ? String(row.cdName || "") : String(row.acdName || ""),
      totalMinutes: Number(row.totalMinutes || 0),
      totalImages: Number(row.totalImages || 0),
    }));
    meta = "Rolling 7D chart by total minutes.";
  } else if (safeMode === "rolling14") {
    const source = safeViewType === "cd" ? metrics.rolling14CdRows : metrics.rolling14Rows;
    rows = (source || []).map((row) => ({
      name: safeViewType === "cd" ? String(row.cdName || "") : String(row.acdName || ""),
      totalMinutes: Number(row.totalMinutes || 0),
      totalImages: Number(row.totalImages || 0),
    }));
    meta = "Rolling 14D chart by total minutes.";
  } else {
    const source = safeViewType === "cd" ? metrics.rolling30CdRows : metrics.rolling30Rows;
    rows = (source || []).map((row) => ({
      name: safeViewType === "cd" ? String(row.cdName || "") : String(row.acdName || ""),
      totalMinutes: Number(row.totalMinutes || 0),
      totalImages: Number(row.totalImages || 0),
    }));
    meta = "Rolling 30D chart by total minutes.";
  }

  rows = rows
    .filter((row) => row.name)
    .sort((a, b) => Number(b.totalMinutes || 0) - Number(a.totalMinutes || 0) || a.name.localeCompare(b.name));

  return {
    viewType: safeViewType,
    mode: safeMode,
    latestWorkDate: metrics.latestWorkDate,
    meta,
    rows,
  };
}

// ─── Small Shared Components ──────────────────────────────────────────────────

export function MiniBarRow({ label, value, max, color = "var(--forest)", badge = null }) {
  const safeValue = Number(value || 0);
  const safeMax = Math.max(1, Number(max || 0));
  return (
    <div className="overview-mini-bar-row">
      <span className="overview-mini-bar-value">{formatMetricValue(safeValue)}</span>
      <div className="overview-mini-bar-track">
        <div
          className="overview-mini-bar-fill"
          style={{ width: `${Math.max(4, Math.min(100, (safeValue / safeMax) * 100))}%`, background: color }}
        />
      </div>
      <span className="overview-mini-bar-label">{label}{badge ? <>{" "}{badge}</> : null}</span>
    </div>
  );
}

// ─── BeatsSummaryCards ────────────────────────────────────────────────────────
// 4-card summary (Total Beats, Fresh take, Production, Hit Rate)
// Shared between Leadership Overview and Editorial Funnel.

export function BeatsSummaryCards({ leadershipOverviewData, loading }) {
  const overviewData = leadershipOverviewData || null;
  const beatRows = Array.isArray(overviewData?.beatRows) ? overviewData.beatRows : [];
  const allWorkflowRows = Array.isArray(overviewData?.allWorkflowRows) ? overviewData.allWorkflowRows : [];
  const fullGenAiRows = Array.isArray(overviewData?.fullGenAiRows) ? overviewData.fullGenAiRows : [];

  const totalBeats = beatRows.length;
  const approvedBeats = beatRows.filter((r) => r?.statusCategory === "approved").length;
  const reviewPendingBeats = beatRows.filter((r) => r?.statusCategory === "review_pending").length;
  const abandonedBeats = beatRows.filter((r) => r?.statusCategory === "abandoned").length;
  const iterateBeats = beatRows.filter((r) => r?.statusCategory === "iterate").length;
  const toBeIdeatedBeats = beatRows.filter((r) => r?.statusCategory === "to_be_ideated").length;
  const beatsStageMax = Math.max(approvedBeats, reviewPendingBeats, abandonedBeats, iterateBeats, toBeIdeatedBeats, 1);

  const weekStart = String(overviewData?.weekStart || "").slice(0, 10);
  const weekEnd = String(overviewData?.weekEnd || "").slice(0, 10);

  const freshTakeSourceRows = useMemo(() => {
    const allowedSources = new Set(["editorial", "ready_for_production", "production", "live"]);
    return allWorkflowRows.filter((row) => {
      if (!allowedSources.has(String(row?.source || ""))) return false;
      const date = String(row?.leadSubmittedDate || "").slice(0, 10);
      if (weekStart && date < weekStart) return false;
      if (weekEnd && date > weekEnd) return false;
      const rt = String(row?.reworkType || "").trim().toLowerCase();
      return rt === "fresh take" || rt === "fresh takes";
    });
  }, [allWorkflowRows, weekStart, weekEnd]);

  const reworkSourceRows = useMemo(() => {
    const allowedSources = new Set(["editorial", "ready_for_production", "production", "live"]);
    return allWorkflowRows.filter((row) => {
      if (!allowedSources.has(String(row?.source || ""))) return false;
      const date = String(row?.leadSubmittedDate || "").slice(0, 10);
      if (weekStart && date < weekStart) return false;
      if (weekEnd && date > weekEnd) return false;
      const rt = String(row?.reworkType || "").trim().toLowerCase();
      return rt !== "" && rt !== "fresh take" && rt !== "fresh takes";
    });
  }, [allWorkflowRows, weekStart, weekEnd]);

  const freshTakeCount = freshTakeSourceRows.length;
  const reworkCount = reworkSourceRows.length;
  const totalAttemptCount = freshTakeCount + reworkCount;
  const totalAttemptMax = Math.max(freshTakeCount, reworkCount, 1);
  const freshTakeRemainingCount = freshTakeSourceRows.filter((r) => r?.source === "editorial").length;

  const productionStageCounts = useMemo(() => {
    const counts = { ready: 0, readyFT: 0, readyRW: 0, production: 0, productionFT: 0, productionRW: 0, live: 0, liveFT: 0, liveRW: 0 };
    for (const row of allWorkflowRows) {
      const source = String(row?.source || "");
      if (source !== "ready_for_production" && source !== "production" && source !== "live") continue;
      const leadDate = String(row?.leadSubmittedDate || "").slice(0, 10);
      if (!leadDate) continue;
      if (weekStart && leadDate < weekStart) continue;
      if (weekEnd && leadDate > weekEnd) continue;
      const rt = String(row?.reworkType || "").trim().toLowerCase();
      const isFT = rt === "fresh take" || rt === "fresh takes";
      if (source === "ready_for_production") { counts.ready++; isFT ? counts.readyFT++ : counts.readyRW++; }
      else if (source === "production")      { counts.production++; isFT ? counts.productionFT++ : counts.productionRW++; }
      else if (source === "live")            { counts.live++; isFT ? counts.liveFT++ : counts.liveRW++; }
    }
    return counts;
  }, [allWorkflowRows, weekStart, weekEnd]);

  const productionStageTotal = productionStageCounts.ready + productionStageCounts.production + productionStageCounts.live;
  const productionStageMax = Math.max(productionStageCounts.ready, productionStageCounts.production, productionStageCounts.live, 1);
  const successfulAdsCount = fullGenAiRows.filter((r) => r.success).length;
  const hitRatePercent = fullGenAiRows.length > 0 ? (successfulAdsCount / fullGenAiRows.length) * 100 : 0;

  return (
    <div className="metric-grid four-col">
      <MetricCard
        label="Total Beats"
        info="Counts unique ideation rows by Beats completed date (Beats assigned date as fallback) inside the selected date range."
        body={
          <>
            <div className="metric-value">{loading ? "..." : formatMetricValue(approvedBeats)}</div>
            {!loading && (
              <div className="overview-mini-bar-stack">
                <MiniBarRow label="Approved"       value={approvedBeats}      max={beatsStageMax} color="#2d5a3d" />
                <MiniBarRow label="Review pending" value={reviewPendingBeats} max={beatsStageMax} color="var(--terracotta)" />
                <MiniBarRow label="Abandoned"      value={abandonedBeats}     max={beatsStageMax} color="#7d5a3a" />
                <MiniBarRow label="Iterate"        value={iterateBeats}       max={beatsStageMax} color="var(--red)" />
                <MiniBarRow label="To be ideated"  value={toBeIdeatedBeats}   max={beatsStageMax} color="#7a7a7a" />
              </div>
            )}
          </>
        }
      />
      <MetricCard
        label="Total Attempt"
        info='"Date submitted by Lead" in range. Fresh Take = FT rows; Rework = all other typed rows.'
        body={
          <>
            <div className="metric-value">
              {loading ? "..." : formatMetricValue(totalAttemptCount)}
            </div>
            {!loading && (
              <div className="overview-mini-bar-stack">
                <MiniBarRow label="Fresh Take" value={freshTakeCount} max={totalAttemptMax} color="var(--forest)" />
                <MiniBarRow label="Rework"     value={reworkCount}    max={totalAttemptMax} color="var(--terracotta)" />
              </div>
            )}
          </>
        }
      />
      <MetricCard
        label="Production"
        info='"Date submitted by Lead" in range. Row count per stage with FT/RW split.'
        body={
          <>
            <div className="metric-value" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {loading ? "..." : (
                <>
                  {formatMetricValue(productionStageTotal)}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(45,90,61,0.12)", color: "#2d5a3d" }}>FT {formatMetricValue(productionStageCounts.readyFT + productionStageCounts.productionFT + productionStageCounts.liveFT)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(194,112,62,0.12)", color: "#c2703e" }}>RW {formatMetricValue(productionStageCounts.readyRW + productionStageCounts.productionRW + productionStageCounts.liveRW)}</span>
                </>
              )}
            </div>
            {!loading && (
              <div className="overview-mini-bar-stack">
                <MiniBarRow label="Ready for Prod" value={productionStageCounts.ready}      max={productionStageMax} color="var(--forest)"
                  badge={<><span style={{ fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "rgba(45,90,61,0.12)", color: "#2d5a3d" }}>FT {productionStageCounts.readyFT}</span>{" "}<span style={{ fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "rgba(194,112,62,0.12)", color: "#c2703e" }}>RW {productionStageCounts.readyRW}</span></>}
                />
                <MiniBarRow label="Production"     value={productionStageCounts.production} max={productionStageMax} color="#3f8f83"
                  badge={<><span style={{ fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "rgba(45,90,61,0.12)", color: "#2d5a3d" }}>FT {productionStageCounts.productionFT}</span>{" "}<span style={{ fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "rgba(194,112,62,0.12)", color: "#c2703e" }}>RW {productionStageCounts.productionRW}</span></>}
                />
                <MiniBarRow label="Live"           value={productionStageCounts.live}       max={productionStageMax} color="#2d5a3d"
                  badge={<><span style={{ fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "rgba(45,90,61,0.12)", color: "#2d5a3d" }}>FT {productionStageCounts.liveFT}</span>{" "}<span style={{ fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "rgba(194,112,62,0.12)", color: "#c2703e" }}>RW {productionStageCounts.liveRW}</span></>}
                />
              </div>
            )}
          </>
        }
      />
      <MetricCard
        label="Hit Rate"
        hint={loading ? "" : `${formatMetricValue(successfulAdsCount)} of ${formatMetricValue(fullGenAiRows.length)} assets`}
        info="Hit rate = successful ads / total GI/GA assets in selected range."
        body={
          <>
            <div className="metric-value">{loading ? "..." : fullGenAiRows.length > 0 ? formatPercent(hitRatePercent) : "-"}</div>
            {!loading && <ProgressBar value={Number(hitRatePercent || 0)} target={100} color="var(--forest)" />}
          </>
        }
      />
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  info,
  tone = "default",
  body = null,
  className = "",
  unit = "",
}) {
  return (
    <article className={`metric-card tone-${tone} ${className}`.trim()} style={{ position: "relative" }}>
      <div className="metric-card-topline">
        <div className="metric-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {info ? (
            <HoverInfo text={info} label={`${label} info`} />
          ) : null}
          <span>{label}</span>
        </div>
      </div>
      {body ? (
        <div className="metric-body">{body}</div>
      ) : (
        <div className="metric-value">
          {value}
          {unit ? <span className="metric-unit">{unit}</span> : null}
        </div>
      )}
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </article>
  );
}

export function HoverInfo({ text, label }) {
  const safeText = String(text || "").trim();
  if (!safeText) return null;

  return (
    <span className="metric-info-wrap" aria-label={label || safeText}>
      <span className="metric-info-button" aria-hidden="true">
        i
      </span>
      <span className="metric-info-popover" role="tooltip">
        {safeText}
      </span>
    </span>
  );
}

export function ProgressBar({ value, target, color = "var(--terracotta)" }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div className="metric-progress-bar">
      <div className="metric-progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function ReadinessRow({ color, label, value }) {
  return (
    <div className="readiness-row">
      <span className="readiness-dot" style={{ background: color }} />
      <span className="readiness-label">{label}</span>
      <span className="readiness-value" style={{ color }}>{value}</span>
    </div>
  );
}

export function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

export function WeekToggleGroup({ value, onChange, disabled = false }) {
  return (
    <div className="week-toggle-group" role="tablist" aria-label="Week filter">
      {WEEK_VIEW_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={value === option.id ? "is-active" : ""}
          onClick={() => onChange(option.id)}
          disabled={disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function DateRangeControls({ value, onChange, minDate = MIN_DASHBOARD_DATE, disabled = false }) {
  const startDate = String(value?.startDate || DEFAULT_START);
  const endDate = String(value?.endDate || DEFAULT_END);

  return (
    <div className="section-toolbar" style={{ padding: 0, border: 0, background: "transparent" }}>
      <div className="section-actions" style={{ marginLeft: "auto", gap: 10 }}>
        <label className="toolbar-select">
          <span>Start date</span>
          <input
            type="date"
            value={startDate}
            min={minDate}
            max={endDate}
            disabled={disabled}
            onChange={(event) => onChange({ startDate: event.target.value, endDate })}
          />
        </label>
        <label className="toolbar-select">
          <span>End date</span>
          <input
            type="date"
            value={endDate}
            min={startDate || minDate}
            disabled={disabled}
            onChange={(event) => onChange({ startDate, endDate: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

export function Toolbar({ title, subtitle, actions, children }) {
  return (
    <div className="section-shell">
      <div className="section-toolbar">
        <div>
          <div className="section-kicker">{title}</div>
          {subtitle ? <div className="section-subtitle">{subtitle}</div> : null}
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function ShareButton({ onClick, busy = false }) {
  return (
    <button
      type="button"
      className="share-button"
      onClick={onClick}
      disabled={busy}
      data-share-ignore="true"
    >
      {busy ? "Copying..." : "Copy to clipboard"}
    </button>
  );
}

export function ShareablePanel({ shareLabel, onShare, isSharing = false, className = "", topControls = null, children }) {
  const panelRef = useRef(null);

  return (
    <section ref={panelRef} className={`panel-card shareable-panel ${className}`.trim()}>
      <div className="share-panel-top" data-share-ignore="true">
        {topControls}
        <ShareButton onClick={() => void onShare(panelRef.current, shareLabel)} busy={isSharing} />
      </div>
      {children}
    </section>
  );
}

export function ToggleGroup({ label, options, value, onChange, disabled = false }) {
  return (
    <div className="toggle-stack" role="group" aria-label={label}>
      <div className="toggle-label">{label}</div>
      <div className="toggle-row">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`ghost-button toggle-chip ${value === option.id ? "is-active" : ""}`}
            onClick={() => onChange(option.id)}
            disabled={disabled}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── PlannerErrorBoundary ─────────────────────────────────────────────────────

export class PlannerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Planner render failed", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="section-shell">
          <div className="panel-card">
            <div className="section-kicker">Planner</div>
            <div className="section-subtitle" style={{ marginTop: 6 }}>
              Planner hit a client-side error while loading this week. Refresh the page or switch weeks; if the data is
              incomplete, the Planner will fall back safely once reloaded.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ─── Shared ACD Collapsible Table ─────────────────────────────────────────────

function buildCdAcdRows(acdMetricsData, timeView) {
  const safeTimeView = timeView === "rolling14" || timeView === "rolling30" ? timeView : "rolling7";
  const trackedTeams = Array.isArray(acdMetricsData?.trackedTeams) ? acdMetricsData.trackedTeams : [];
  const cdRowsRaw = Array.isArray(acdMetricsData?.[`${safeTimeView}CdRows`]) ? acdMetricsData[`${safeTimeView}CdRows`] : [];
  const acdRowsRaw = Array.isArray(acdMetricsData?.[`${safeTimeView}Rows`]) ? acdMetricsData[`${safeTimeView}Rows`] : [];
  const cdMap = Object.fromEntries(cdRowsRaw.map((r) => [r.cdName, { totalMinutes: Number(r.totalMinutes || 0), totalImages: Number(r.totalImages || 0) }]));
  const acdMap = Object.fromEntries(acdRowsRaw.map((r) => [r.acdName, { totalMinutes: Number(r.totalMinutes || 0), totalImages: Number(r.totalImages || 0) }]));
  return trackedTeams
    .map((team) => {
      const cdMetrics = cdMap[team.cdName] || { totalMinutes: 0, totalImages: 0 };
      const acds = (Array.isArray(team.acdNames) ? team.acdNames : [])
        .map((acdName) => ({ acdName, ...(acdMap[acdName] || { totalMinutes: 0, totalImages: 0 }) }))
        .filter((r) => r.totalMinutes > 0 || r.totalImages > 0);
      return { cdName: team.cdName, ...cdMetrics, acds };
    })
    .filter((r) => r.totalMinutes > 0 || r.acds.length > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export function AcdCollapsibleTable({ acdMetricsData, acdMetricsLoading }) {
  const [expandedCds, setExpandedCds] = useState({});
  const [timeView, setTimeView] = useState("rolling7");
  const latestWorkDateLabel = acdMetricsData?.latestWorkDate ? formatDateLabel(acdMetricsData.latestWorkDate) : "";
  const rows = buildCdAcdRows(acdMetricsData, timeView);
  const allExpanded = rows.length > 0 && rows.every((r) => Boolean(expandedCds[r.cdName]));
  const timeViewLabel = getAcdTimeViewLabel(timeView);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>CD productivity</div>
          <div style={{ fontSize: 11, color: "var(--subtle)", marginTop: 2 }}>
            {timeViewLabel} by total minutes{latestWorkDateLabel ? ` · Latest synced: ${latestWorkDateLabel}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <ToggleGroup
            label="Time View"
            options={ACD_TIME_OPTIONS}
            value={timeView}
            onChange={(v) => { setTimeView(v); setExpandedCds({}); }}
          />
          {rows.length > 0 && (
            <button
              type="button"
              className="ghost-button overview-section-link"
              onClick={() => setExpandedCds(allExpanded ? {} : Object.fromEntries(rows.map((r) => [r.cdName, true])))}
            >
              {allExpanded ? "Collapse all" : "Expand all ACDs"}
            </button>
          )}
        </div>
      </div>
      {acdMetricsLoading ? (
        <div style={{ fontSize: 12, color: "var(--subtle)" }}>Loading production data…</div>
      ) : (
        <div className="table-wrap">
          <table className="ops-table overview-table">
            <thead>
              <tr>
                <th>CD / ACD</th>
                <th style={{ textAlign: "right" }}>Total (min)</th>
                <th style={{ textAlign: "right" }}>Images</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.flatMap((cd) => {
                const isExpanded = Boolean(expandedCds[cd.cdName]);
                const cdTr = (
                  <tr key={`cd-${cd.cdName}`} style={{ fontWeight: 700 }}>
                    <td>
                      <button
                        type="button"
                        className="as-link"
                        onClick={() => setExpandedCds((cur) => ({ ...cur, [cd.cdName]: !cur[cd.cdName] }))}
                        style={{ padding: 0, border: "none", background: "transparent", fontWeight: 700 }}
                      >
                        {isExpanded ? "▾" : "▸"} {cd.cdName}
                      </button>
                    </td>
                    <td style={{ textAlign: "right" }}>{formatNumber(cd.totalMinutes)}</td>
                    <td style={{ textAlign: "right" }}>{formatNumber(cd.totalImages)}</td>
                  </tr>
                );
                const acdTrs = isExpanded
                  ? cd.acds.map((acd) => (
                      <tr key={`acd-${cd.cdName}-${acd.acdName}`}>
                        <td style={{ paddingLeft: 28, color: "var(--subtle)" }}>• {acd.acdName}</td>
                        <td style={{ textAlign: "right" }}>{formatNumber(acd.totalMinutes)}</td>
                        <td style={{ textAlign: "right" }}>{formatNumber(acd.totalImages)}</td>
                      </tr>
                    ))
                  : [];
                return [cdTr, ...acdTrs];
              }) : (
                <tr><td colSpan="3" style={{ color: "var(--subtle)" }}>No production data available yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Shared ACD Chart ─────────────────────────────────────────────────────────

function AcdChartTooltip({ active, payload, label }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="acd-chart-tooltip">
      <div className="acd-chart-tooltip-title">{label || row.name || "-"}</div>
      <div className="acd-chart-tooltip-row">
        <span>Minutes</span>
        <strong>{formatNumber(row.totalMinutes)}</strong>
      </div>
      <div className="acd-chart-tooltip-row">
        <span>Total images</span>
        <strong>{formatNumber(row.totalImages)}</strong>
      </div>
    </div>
  );
}

export function AcdLeaderboardChart({ rows, viewLabel, emptyText = "No ACD data available." }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const chartRows = safeRows.map((row) => ({
    ...row,
    name: String(row.name || ""),
    totalMinutes: Number(row.totalMinutes || 0),
    totalImages: Number(row.totalImages || 0),
  }));
  const chartHeight = Math.max(280, chartRows.length * 44 + 28);
  const yAxisWidth = Math.min(
    220,
    Math.max(120, chartRows.reduce((max, row) => Math.max(max, String(row.name || "").length * 7), 0))
  );

  if (chartRows.length === 0) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="acd-chart-canvas" role="img" aria-label={`${viewLabel} productivity bar chart`}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartRows} layout="vertical" margin={{ top: 8, right: 28, left: 8, bottom: 8 }} barCategoryGap={12}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={{ fill: "var(--subtle)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            label={{ value: "Minutes", position: "insideBottomRight", offset: -2, fill: "var(--subtle)", fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={yAxisWidth}
            tick={{ fill: "var(--ink)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip cursor={{ fill: "rgba(20, 107, 101, 0.08)" }} content={<AcdChartTooltip />} />
          <Bar dataKey="totalMinutes" radius={[0, 10, 10, 0]}>
            <LabelList
              dataKey="totalMinutes"
              position="right"
              formatter={(value) => `${formatNumber(value)} min`}
              fill="var(--ink)"
              fontSize={12}
            />
            {chartRows.map((row, index) => (
              <Cell key={`${row.name}-${index}`} fill={getChartBarColor(index, chartRows.length)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
