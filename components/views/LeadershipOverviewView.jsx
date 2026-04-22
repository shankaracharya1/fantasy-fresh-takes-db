"use client";

import { useMemo, useState } from "react";
import {
  AcdLeaderboardChart,
  HoverInfo,
  MetricCard,
  ProgressBar,
  ToggleGroup,
  formatNumber,
  formatMetricValue,
  formatPercent,
  normalizePodFilterKey,
} from "./shared.jsx";

const FOCUS_POD_LEADS = [
  { key: "berman", label: "Berman" },
  { key: "roth", label: "Roth" },
  { key: "lee", label: "Lee" },
  { key: "gilatar", label: "Gilatar" },
  { key: "woodward", label: "Woodward" },
];

function resolveFocusPodLabel(podLeadName) {
  const normalized = normalizePodFilterKey(podLeadName || "");
  for (const pod of FOCUS_POD_LEADS) {
    if (normalized.includes(pod.key)) {
      return pod.label;
    }
  }
  return "";
}

function normalizeDateOnly(value) {
  return String(value || "").trim().slice(0, 10);
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isDateInSelectedRange(value, startDate, endDate) {
  const date = normalizeDateOnly(value);
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function isFreshTakeType(value) {
  const rt = String(value || "").trim().toLowerCase();
  return rt === "fresh take" || rt === "fresh takes";
}

function getWorkflowStageLabel(source) {
  const key = String(source || "").trim().toLowerCase();
  if (key === "editorial") return "Editorial";
  if (key === "ready_for_production") return "Ready for Production";
  if (key === "production") return "Production";
  if (key === "live") return "Live";
  return "Unknown";
}

function getFreshTakeScriptStatusLabel(row) {
  const status = normalizeText(row?.scriptStatus);
  if (status) return status;
  return getWorkflowStageLabel(row?.source);
}

function ScriptTypeBadges({ ftCount = 0, rwCount = 0, compact = false }) {
  const parts = [];
  if (ftCount > 0) {
    parts.push(
      <span
        key="ft"
        style={{
          display: "inline-block",
          fontSize: compact ? 10 : 11,
          fontWeight: 600,
          background: "#e8f4ea",
          color: "#2d5a3d",
          borderRadius: 4,
          padding: compact ? "1px 5px" : "2px 6px",
          marginRight: 4,
        }}
      >
        FT:{ftCount}
      </span>
    );
  }
  if (rwCount > 0) {
    parts.push(
      <span
        key="rw"
        style={{
          display: "inline-block",
          fontSize: compact ? 10 : 11,
          fontWeight: 600,
          background: "#efe9ff",
          color: "#6741d9",
          borderRadius: 4,
          padding: compact ? "1px 5px" : "2px 6px",
          marginRight: 4,
        }}
      >
        RW:{rwCount}
      </span>
    );
  }
  if (parts.length === 0) {
    return <span style={{ color: "var(--subtle)" }}>—</span>;
  }
  return <span>{parts}</span>;
}

function MiniBarRow({ label, value, max, color = "var(--forest)" }) {
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
      <span className="overview-mini-bar-label">{label}</span>
    </div>
  );
}

function PodStageBreakdownTable({ rows = [], loading = false, infoText = "" }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const [expandedPods, setExpandedPods] = useState(new Set());

  const togglePod = (podName) => {
    setExpandedPods((prev) => {
      const next = new Set(prev);
      if (next.has(podName)) next.delete(podName);
      else next.add(podName);
      return next;
    });
  };

  const allExpanded = safeRows.length > 0 && safeRows.every((row) => expandedPods.has(row.podLeadName));
  const stageColumns = [
    { key: "beats", label: "Beats" },
    { key: "editorial", label: "Editorial" },
    { key: "readyForProduction", label: "Ready for Production" },
    { key: "production", label: "Production" },
    { key: "live", label: "Live" },
  ];

  return (
    <div style={{ marginTop: 20 }}>
      <div className="overview-table-toolbar" style={{ marginBottom: 10 }}>
        <div className="overview-table-toolbar-left">
          <div className="overview-table-toolbar-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Writer and POD output
            <HoverInfo
              text={infoText || "Beats = Beats completed from Ideation. Editorial / Ready / Production / Live = Date submitted by Lead."}
              label="Writer and POD output info"
            />
          </div>
          <div className="overview-table-toolbar-note">
            Expand each POD to view the writers underneath. The table uses the same weekly date filter as the header.
          </div>
        </div>
        <button
          type="button"
          className="ghost-button overview-section-link"
          onClick={() => setExpandedPods(allExpanded ? new Set() : new Set(safeRows.map((row) => row.podLeadName)))}
        >
          {allExpanded ? "Collapse all pods" : "Open POD Wise"}
        </button>
      </div>
      <div className="table-wrap">
        <table className="ops-table overview-table overview-output-table">
          <colgroup>
            <col style={{ width: "26%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>POD / Writer</th>
              {stageColumns.map((column) => (
                <th key={column.key} style={{ textAlign: "center" }}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ color: "var(--subtle)" }}>Loading…</td>
              </tr>
            ) : safeRows.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ color: "var(--subtle)" }}>No output rows available for this filter yet.</td>
              </tr>
            ) : safeRows.flatMap((podRow) => {
              const writerRows = Array.isArray(podRow.writerRows) ? podRow.writerRows : [];
              const isExpanded = expandedPods.has(podRow.podLeadName);
              const podTr = (
                <tr key={`pod-${podRow.podLeadName}`} style={{ fontWeight: 700 }}>
                  <td>
                    <button
                      type="button"
                      className="as-link"
                      aria-expanded={isExpanded}
                      onClick={() => togglePod(podRow.podLeadName)}
                      style={{ padding: 0, border: "none", background: "transparent", fontWeight: 700 }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          fontSize: 10,
                          width: 16,
                          height: 16,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "var(--subtle-bg, #f0ece4)",
                          borderRadius: 3,
                          color: "var(--subtle)",
                          flexShrink: 0,
                        }}>
                          {isExpanded ? "▾" : "▸"}
                        </span>
                        {podRow.podLeadName}
                        {writerRows.length > 0 && (
                          <span style={{ fontWeight: 400, fontSize: 11, color: "var(--subtle)" }}>
                            {writerRows.length} writer{writerRows.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </span>
                    </button>
                  </td>
                  {stageColumns.map((column) => (
                    <td key={`pod-${podRow.podLeadName}-${column.key}`} style={{ textAlign: "center" }}>
                      {formatMetricValue(podRow[column.key])}
                    </td>
                  ))}
                </tr>
              );

              const writerTrs = isExpanded
                ? writerRows.map((writerRow) => (
                    <tr key={`writer-${podRow.podLeadName}-${writerRow.writerName}`} style={{ background: "var(--bg-deep, #f7f4ef)" }}>
                      <td style={{ paddingLeft: 28, color: "var(--subtle)", fontSize: 12 }}>• {writerRow.writerName || "-"}</td>
                      {stageColumns.map((column) => (
                        <td key={`writer-${podRow.podLeadName}-${writerRow.writerName}-${column.key}`} style={{ textAlign: "center", fontSize: 12 }}>
                          {formatMetricValue(writerRow[column.key])}
                        </td>
                      ))}
                    </tr>
                  ))
                : [];

              return [podTr, ...writerTrs];
            })}
          </tbody>
          <tfoot>
            <tr className="overview-table-total-row">
              <td style={{ fontWeight: 700 }}>Total</td>
              {stageColumns.map((column) => {
                const total = safeRows.reduce((sum, row) => sum + Number(row?.[column.key] || 0), 0);
                return <td key={`total-${column.key}`} style={{ textAlign: "center" }}>{formatMetricValue(total)}</td>;
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function PodThroughputRankingTable({ rows = [], loading = false }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const [expandedPods, setExpandedPods] = useState(new Set());
  const totalScripts = safeRows.reduce((sum, row) => sum + Number(row?.totalScripts || 0), 0);
  const totalFt = safeRows.reduce((sum, row) => sum + Number(row?.ftCount || 0), 0);
  const totalRw = safeRows.reduce((sum, row) => sum + Number(row?.rwCount || 0), 0);

  const togglePod = (podName) => {
    setExpandedPods((prev) => {
      const next = new Set(prev);
      if (next.has(podName)) next.delete(podName);
      else next.add(podName);
      return next;
    });
  };

  const tableRows = [];
  for (const pod of safeRows) {
    const writerRows = Array.isArray(pod.writerRows) ? pod.writerRows : [];
    const isExpanded = expandedPods.has(pod.podLeadName);

    tableRows.push(
      <tr
        key={`pod-${pod.podLeadName}`}
        className="throughput-pod-summary-row"
        style={{ cursor: writerRows.length > 0 ? "pointer" : undefined, userSelect: "none" }}
        onClick={writerRows.length > 0 ? () => togglePod(pod.podLeadName) : undefined}
      >
        <td style={{ fontWeight: 700 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {writerRows.length > 0 && (
              <span
                style={{
                  fontSize: 10,
                  width: 16,
                  height: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--subtle-bg, #f0ece4)",
                  borderRadius: 3,
                  color: "var(--subtle)",
                  flexShrink: 0,
                }}
              >
                {isExpanded ? "▾" : "▸"}
              </span>
            )}
            {pod.podLeadName}
            {writerRows.length > 0 && (
              <span style={{ fontWeight: 400, fontSize: 11, color: "var(--subtle)" }}>
                {writerRows.length} writer{writerRows.length !== 1 ? "s" : ""}
              </span>
            )}
          </span>
        </td>
        <td style={{ fontWeight: 700, textAlign: "center" }}>{formatMetricValue(pod.totalScripts)}</td>
        <td>
          <ScriptTypeBadges
            compact
            ftCount={pod.ftCount || 0}
            rwCount={pod.rwCount || 0}
          />
        </td>
      </tr>
    );

    if (isExpanded) {
      for (const writer of writerRows) {
        tableRows.push(
          <tr key={`writer-${pod.podLeadName}-${writer.writerName}`} style={{ background: "var(--bg-deep, #f7f4ef)" }}>
            <td style={{ paddingLeft: 28, color: "var(--subtle)", fontSize: 12 }}>• {writer.writerName}</td>
            <td style={{ textAlign: "center", fontSize: 12 }}>{formatMetricValue(writer.totalScripts)}</td>
            <td>
              <ScriptTypeBadges
                compact
                ftCount={writer.ftCount || 0}
                rwCount={writer.rwCount || 0}
              />
            </td>
          </tr>
        );
      }
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>POD throughput</div>
      <div style={{ fontSize: 11, color: "var(--subtle)", marginBottom: 10 }}>
        Editorial, Ready for Production, Production, Live · date-filtered by Date submitted by Lead · FT = Fresh Take · RW = Rework
      </div>
      <div className="table-wrap">
        <table className="ops-table overview-table">
          <thead>
            <tr>
              <th>POD / Writer</th>
              <th style={{ textAlign: "center" }}># Scripts</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="3" style={{ color: "var(--subtle)" }}>Loading…</td></tr>
            ) : tableRows.length > 0 ? (
              <>
                {tableRows}
                <tr className="overview-table-total-row">
                  <td><strong>Total</strong></td>
                  <td style={{ textAlign: "center" }}><strong>{formatMetricValue(totalScripts)}</strong></td>
                  <td><ScriptTypeBadges compact ftCount={totalFt} rwCount={totalRw} /></td>
                </tr>
              </>
            ) : (
              <tr><td colSpan="3">No scripts found for the selected date range.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default function LeadershipOverviewContent({ leadershipOverviewData, leadershipOverviewLoading, leadershipOverviewError, onNavigate, acdMetricsData, acdMetricsLoading }) {
  const overviewData = leadershipOverviewData || null;
  const overviewLoading = Boolean(leadershipOverviewLoading);
  const overviewError = leadershipOverviewError || "";
  const [section3ViewType, setSection3ViewType] = useState("acd");
  const [expandedAngles, setExpandedAngles] = useState({});
  const beatRows = Array.isArray(overviewData?.beatRows) ? overviewData.beatRows : [];
  const allBeatRows = Array.isArray(overviewData?.allBeatRows) ? overviewData.allBeatRows : beatRows;
  const workflowRows = Array.isArray(overviewData?.workflowRows) ? overviewData.workflowRows : [];
  const allWorkflowRows = Array.isArray(overviewData?.allWorkflowRows) ? overviewData.allWorkflowRows : workflowRows;
  const fullGenAiRows = Array.isArray(overviewData?.fullGenAiRows) ? overviewData.fullGenAiRows : [];
  const podThroughputRows = Array.isArray(overviewData?.podThroughputRows) ? overviewData.podThroughputRows : [];
  const scopedFullGenAiRows = fullGenAiRows;

  const totalBeats = beatRows.length;
  const approvedBeats = beatRows.filter((row) => row?.statusCategory === "approved").length;
  const reviewPendingBeats = beatRows.filter((row) => row?.statusCategory === "review_pending").length;
  const abandonedBeats = beatRows.filter((row) => row?.statusCategory === "abandoned").length;
  const iterateBeats = beatRows.filter((row) => row?.statusCategory === "iterate").length;
  const toBeIdeatedBeats = beatRows.filter((row) => row?.statusCategory === "to_be_ideated").length;

  const freshTakeSourceRows = useMemo(() => {
    const weekStart = normalizeDateOnly(overviewData?.weekStart);
    const weekEnd = normalizeDateOnly(overviewData?.weekEnd);
    const allowedSources = new Set(["editorial", "ready_for_production", "production", "live"]);
    const rows = [];
    for (const row of Array.isArray(allWorkflowRows) ? allWorkflowRows : []) {
      if (!allowedSources.has(String(row?.source || ""))) continue;
      const date = normalizeDateOnly(row?.leadSubmittedDate);
      if (!isDateInSelectedRange(date, weekStart, weekEnd)) continue;
      if (!isFreshTakeType(row?.reworkType)) continue;
      rows.push(row);
    }
    return rows;
  }, [allWorkflowRows, overviewData?.weekStart, overviewData?.weekEnd]);
  const freshTakeCount = freshTakeSourceRows.length;
  const freshTakeRemainingCount = useMemo(
    () => freshTakeSourceRows.filter((row) => String(row?.source || "") === "editorial").length,
    [freshTakeSourceRows]
  );

  const productionStageCounts = useMemo(() => {
    const weekStart = normalizeDateOnly(overviewData?.weekStart);
    const weekEnd = normalizeDateOnly(overviewData?.weekEnd);
    const stagePriority = {
      editorial: 1,
      ready_for_production: 2,
      production: 3,
      live: 4,
    };
    const allowedStages = new Set(Object.keys(stagePriority));
    const byAsset = new Map();
    const cohortKeys = new Set();

    for (const row of Array.isArray(allWorkflowRows) ? allWorkflowRows : []) {
      const source = String(row?.source || "");
      if (!allowedStages.has(source)) continue;
      const key =
        String(row?.assetCode || "").trim().toLowerCase() ||
        `${String(row?.showName || "").trim().toLowerCase()}|${String(row?.beatName || "").trim().toLowerCase()}`;
      if (!key) continue;
      if (!byAsset.has(key)) byAsset.set(key, []);
      byAsset.get(key).push(row);

      const leadDate = normalizeDateOnly(row?.leadSubmittedDate);
      if (!isDateInSelectedRange(leadDate, weekStart, weekEnd)) continue;
      if (!isFreshTakeType(row?.reworkType)) continue;
      cohortKeys.add(key);
    }

    const counts = {
      editorial: 0,
      ready: 0,
      production: 0,
      live: 0,
    };

    for (const key of cohortKeys) {
      const rows = byAsset.get(key) || [];
      let bestStage = "editorial";
      for (const row of rows) {
        const source = String(row?.source || "");
        if (!allowedStages.has(source)) continue;
        if (stagePriority[source] > stagePriority[bestStage]) {
          bestStage = source;
        }
      }
      if (bestStage === "ready_for_production") counts.ready += 1;
      else if (bestStage === "production") counts.production += 1;
      else if (bestStage === "live") counts.live += 1;
      else counts.editorial += 1;
    }

    return {
      ...counts,
      totalCohort: cohortKeys.size,
    };
  }, [allWorkflowRows, overviewData?.weekStart, overviewData?.weekEnd]);
  const productionStageTotal = (productionStageCounts.ready || 0) + (productionStageCounts.production || 0) + (productionStageCounts.live || 0);
  const productionStageMax = Math.max(
    productionStageCounts.ready,
    productionStageCounts.production,
    productionStageCounts.live,
    1
  );
  const successfulAdsCount = scopedFullGenAiRows.filter((r) => r.success).length;
  const hitRatePercent = scopedFullGenAiRows.length > 0 ? (successfulAdsCount / scopedFullGenAiRows.length) * 100 : 0;
  const beatsStageMax = Math.max(approvedBeats, reviewPendingBeats, abandonedBeats, iterateBeats, toBeIdeatedBeats, 1);

  const overviewThroughputRows = useMemo(() => {
    const weekStart = overviewData?.weekStart;
    const weekEnd = overviewData?.weekEnd;
    const dailyRows = Array.isArray(acdMetricsData?.dailyRows) ? acdMetricsData.dailyRows : [];
    if (!weekStart || !weekEnd || dailyRows.length === 0) return [];

    const filtered = dailyRows.filter((row) => {
      const d = String(row.workDate || "");
      return d >= weekStart && d <= weekEnd;
    });

    const aggMap = new Map();
    for (const row of filtered) {
      const name = section3ViewType === "cd" ? String(row.cdName || "") : String(row.acdName || "");
      if (!name) continue;
      if (!aggMap.has(name)) aggMap.set(name, { name, totalMinutes: 0, totalImages: 0 });
      const entry = aggMap.get(name);
      entry.totalMinutes = Number((entry.totalMinutes + Number(row.totalMinutes || 0)).toFixed(1));
      entry.totalImages += Number(row.totalImages || 0);
    }

    return Array.from(aggMap.values())
      .sort((a, b) => b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name));
  }, [acdMetricsData, overviewData?.weekStart, overviewData?.weekEnd, section3ViewType]);

  const fullGenAiByBeat = useMemo(() =>
    Array.from(
      scopedFullGenAiRows.reduce((map, row) => {
      const key = `${row.showName}|${row.beatName}`;
      if (!map.has(key)) {
        map.set(key, {
          showName: row.showName,
          beatName: row.beatName,
          attempts: 0,
          successCount: 0,
          ads: [],
        });
      }
      const entry = map.get(key);
      entry.attempts += 1;
      if (row.success) entry.successCount += 1;
      entry.ads.push({
        assetCode: row.assetCode,
        success: row.success,
        cpiUsd: row.cpiUsd,
        absoluteCompletionPct: row.absoluteCompletionPct,
        ctrPct: row.ctrPct,
        clickToInstall: row.clickToInstall,
      });
      return map;
      }, new Map()).values()
    )
      .map((entry) => ({
        ...entry,
        hitRate: entry.attempts > 0 ? Number(((entry.successCount / entry.attempts) * 100).toFixed(1)) : null,
      }))
      .sort((a, b) => b.attempts - a.attempts || a.showName.localeCompare(b.showName) || a.beatName.localeCompare(b.beatName))
  , [scopedFullGenAiRows]);
  return (
    <div className="section-stack overview-flow-shell">
      {overviewError ? <div className="warning-note">{overviewError}</div> : null}

      {overviewData?.confidenceNote ? (
        <>
          <div className="overview-hero-actions" style={{ marginTop: 2 }}>
            <div className="overview-confidence-note">{overviewData.confidenceNote}</div>
          </div>
          <hr className="section-divider" />
        </>
      ) : null}

      <section className="overview-flow-section">
        <div className="overview-section-head">
          <div>
            <div className="overview-section-title">Beats</div>
          </div>
        </div>
        {overviewData?.ideationSourceError && (
          <div style={{ fontSize: 12, color: "var(--warning, #b45309)", marginBottom: 8 }}>
            Ideation data issue: {overviewData.ideationSourceError}
          </div>
        )}
        <div className="metric-grid four-col">
          <MetricCard
            label="Total Beats"
            value={overviewLoading ? "..." : `${formatMetricValue(totalBeats)}`}
            info="Counts unique ideation rows by Beats completed date (Beats assigned date as fallback) inside the selected date range."
            body={
              <>
                <div className="metric-value">{overviewLoading ? "..." : formatMetricValue(totalBeats)}</div>
                {!overviewLoading ? (
                  <div className="overview-mini-bar-stack">
                    <MiniBarRow label="Approved" value={approvedBeats} max={beatsStageMax} color="#2d5a3d" />
                    <MiniBarRow label="Review pending" value={reviewPendingBeats} max={beatsStageMax} color="var(--terracotta)" />
                    <MiniBarRow label="Abandoned" value={abandonedBeats} max={beatsStageMax} color="#7d5a3a" />
                    <MiniBarRow label="Iterate" value={iterateBeats} max={beatsStageMax} color="var(--red)" />
                    <MiniBarRow label="To be ideated" value={toBeIdeatedBeats} max={beatsStageMax} color="#7a7a7a" />
                  </div>
                ) : null}
              </>
            }
          />
          <MetricCard
            label="Fresh take"
            value={overviewLoading ? "..." : `${formatMetricValue(freshTakeCount)} / ${formatMetricValue(freshTakeRemainingCount)}`}
            info='Overall count / Remaining count. Counts Fresh Take rows filtered by "Date submitted by Lead"; remaining count includes only rows currently in Editorial.'
            body={
              <>
                <div className="metric-value">
                  {overviewLoading ? "..." : `${formatMetricValue(freshTakeCount)} / ${formatMetricValue(freshTakeRemainingCount)}`}
                </div>
                {!overviewLoading ? (
                  <div className="overview-mini-bar-stack">
                    <MiniBarRow
                      label="Overall count"
                      value={freshTakeCount}
                      max={Math.max(freshTakeCount, 1)}
                      color="var(--forest)"
                    />
                    <MiniBarRow
                      label="Remaining count"
                      value={freshTakeRemainingCount}
                      max={Math.max(freshTakeCount, 1)}
                      color="var(--terracotta)"
                    />
                  </div>
                ) : null}
              </>
            }
          />
          <MetricCard
            label="Production"
            value={overviewLoading ? "..." : formatMetricValue(productionStageTotal)}
            hint='Fresh Take cohort status by stage'
            info='Takes Fresh Take assets whose "Date submitted by Lead" is in selected range, then shows their current highest stage: Editorial, Ready for Production, Production, or Live.'
            body={
              <>
                <div className="metric-value">{overviewLoading ? "..." : formatMetricValue(productionStageTotal)}</div>
                {!overviewLoading ? (
                  <div className="overview-mini-bar-stack">
                    <MiniBarRow label="Ready for Production" value={productionStageCounts.ready} max={productionStageMax} color="var(--forest)" />
                    <MiniBarRow label="Production" value={productionStageCounts.production} max={productionStageMax} color="#3f8f83" />
                    <MiniBarRow label="Live" value={productionStageCounts.live} max={productionStageMax} color="#2d5a3d" />
                  </div>
                ) : null}
              </>
            }
          />
          <MetricCard
            label="Hit Rate"
            value={overviewLoading ? "..." : scopedFullGenAiRows.length > 0 ? formatPercent(hitRatePercent) : "-"}
            hint={overviewLoading ? "" : `${formatMetricValue(successfulAdsCount)} of ${formatMetricValue(scopedFullGenAiRows.length)} assets`}
            info="Hit rate = successful ads / total GI/GA assets in selected range."
            body={
              <>
                <div className="metric-value">{overviewLoading ? "..." : scopedFullGenAiRows.length > 0 ? formatPercent(hitRatePercent) : "-"}</div>
                {!overviewLoading ? (
                  <ProgressBar value={Number(hitRatePercent || 0)} target={100} color="var(--forest)" />
                ) : null}
              </>
            }
          />
        </div>
      </section>

      <hr className="section-divider" />

      <section className="overview-flow-section">
        <PodThroughputRankingTable rows={podThroughputRows} loading={overviewLoading} />
      </section>

      <hr className="section-divider" />

      <section className="overview-flow-section">
        <div className="overview-section-head">
          <div>
            <div className="overview-section-title">Production throughput</div>
          </div>
          <div className="overview-section-actions" style={{ marginLeft: "auto", justifyContent: "flex-end" }}>
            <ToggleGroup
              label="View"
              options={[{ id: "acd", label: "ACD" }, { id: "cd", label: "CD" }]}
              value={section3ViewType}
              onChange={setSection3ViewType}
            />
          </div>
        </div>
        <div className="panel-card overview-panel-card">
          {acdMetricsLoading ? (
            <div style={{ fontSize: 12, color: "var(--subtle)", padding: "12px 0" }}>Loading production data…</div>
          ) : (
            <AcdLeaderboardChart
              rows={overviewThroughputRows}
              viewLabel={section3ViewType === "cd" ? "CD" : "ACD"}
              emptyText="No production data for this date range."
            />
          )}
        </div>
      </section>

      <hr className="section-divider" />

      <section className="overview-flow-section">
        <div className="overview-section-head">
          <div>
            <div className="overview-section-title">Full Gen AI</div>
            <div className="overview-section-subtitle" style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Live sheet rows where Ad Code starts with GA or GI
            </div>
          </div>
          <div className="overview-section-actions" style={{ marginLeft: "auto", justifyContent: "flex-end" }}>
            <div className="overview-section-note">
              {overviewLoading ? "Rows: ..." : `Rows: ${formatMetricValue(fullGenAiByBeat.length)}`}
            </div>
          </div>
        </div>
        <div className="metric-grid three-col">
          <MetricCard label="Assets live (GI/GA)" value={overviewLoading ? "..." : formatMetricValue(scopedFullGenAiRows.length)} />
          <MetricCard
            label="Successful Hit Benchmark"
            value={overviewLoading ? "..." : formatMetricValue(successfulAdsCount)}
            hint="A successful ad passes all formula thresholds: Amount Spent ≥ 100, Q1 Completion > 10%, CTI ≥ 12%, True Completion ≥ 1.8%, CPI ≤ 12 — OR CPI < $6 regardless of other metrics."
          />
          <MetricCard
            label="Overall hit rate"
            value={
              overviewLoading
                ? "..."
                : scopedFullGenAiRows.length > 0
                  ? formatPercent((successfulAdsCount / scopedFullGenAiRows.length) * 100)
                  : "-"
            }
          />
        </div>
        {overviewData?.fullGenAiSourceError ? (
          <div className="warning-note" style={{ marginTop: 10 }}>
            Full Gen AI source warning: {overviewData.fullGenAiSourceError}
          </div>
        ) : null}
        <div className="table-wrap genai-table-wrap">
          <table className="ops-table overview-table">
            <thead>
              <tr>
                <th>Show</th>
                <th>Beat</th>
                <th style={{ textAlign: "right" }}>Ads</th>
                <th style={{ textAlign: "right" }}>Successful</th>
                <th style={{ textAlign: "right" }}>Hit Rate</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {fullGenAiByBeat.length > 0 ? (
                fullGenAiByBeat.flatMap((row, idx) => {
                  const prevRow = fullGenAiByBeat[idx - 1];
                  const isNewShow = idx > 0 && prevRow.showName !== row.showName;
                  const angleKey = `${row.showName}|${row.beatName}`;
                  const isExpanded = Boolean(expandedAngles[angleKey]);
                  return [
                    <tr
                      key={angleKey}
                      className={`overview-genai-parent-row${row.successCount > 0 ? " overview-genai-success-row" : ""}${isNewShow ? " genai-show-group-start" : ""}`}
                      data-expanded={isExpanded}
                      style={{ cursor: "pointer" }}
                      onClick={() => setExpandedAngles((prev) => ({ ...prev, [angleKey]: !prev[angleKey] }))}
                    >
                      <td className="genai-show-name">{row.showName || "-"}</td>
                      <td className="genai-beat-name">{row.beatName || "-"}</td>
                      <td className="genai-num-cell" style={{ textAlign: "right" }}>{formatMetricValue(row.attempts)}</td>
                      <td className="genai-num-cell" style={{ textAlign: "right" }}>
                        {row.successCount > 0
                          ? <span className="genai-success-badge">{formatMetricValue(row.successCount)}</span>
                          : <span className="genai-zero">{formatMetricValue(row.successCount)}</span>}
                      </td>
                      <td className="genai-num-cell" style={{ textAlign: "right" }}>
                        <span className={`genai-hitrate${row.hitRate != null ? (row.hitRate >= 50 ? " is-high" : row.hitRate >= 20 ? " is-mid" : " is-low") : ""}`}>
                          {row.hitRate != null ? formatPercent(row.hitRate) : "-"}
                        </span>
                      </td>
                      <td className="genai-chevron-cell">
                        <span className={`genai-chevron${isExpanded ? " is-open" : ""}`} />
                      </td>
                    </tr>,
                    ...(isExpanded ? [
                      <tr key={`${angleKey}-hdr`} className="overview-genai-expanded-hdr">
                        <td colSpan={2} className="genai-col-asset">Asset Code</td>
                        <td className="genai-col-metric">CPI</td>
                        <td className="genai-col-metric">True Completion</td>
                        <td className="genai-col-metric">CTR</td>
                        <td className="genai-col-metric">CTI</td>
                      </tr>,
                      ...row.ads.map((ad) => (
                        <tr
                          key={`${angleKey}-${ad.assetCode}`}
                          className={ad.success ? "overview-genai-expanded-row overview-genai-ad-success" : "overview-genai-expanded-row"}
                        >
                          <td colSpan={2} className="genai-asset-code-cell">
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <span className="genai-asset-code">{ad.assetCode || "-"}</span>
                              {ad.success && <span className="genai-hit-tag">HIT</span>}
                            </div>
                          </td>
                          <td className="genai-metric-val">{ad.cpiUsd != null ? `$${ad.cpiUsd.toFixed(2)}` : "-"}</td>
                          <td className="genai-metric-val">{ad.absoluteCompletionPct != null ? formatPercent(ad.absoluteCompletionPct) : "-"}</td>
                          <td className="genai-metric-val">{ad.ctrPct != null ? formatPercent(ad.ctrPct) : "-"}</td>
                          <td className="genai-metric-val">{ad.clickToInstall != null ? formatPercent(ad.clickToInstall) : "-"}</td>
                        </tr>
                      )),
                    ] : []),
                  ];
                })
              ) : (
                <tr>
                  <td colSpan="6">No Full Gen AI rows for this filter yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="overview-guidelines-card">
          <div className="overview-guidelines-title">Success definition and guidelines</div>
          <div className="overview-guidelines-line">
            Assets live (GI/GA) = Live sheet rows where Ad Code starts with GA or GI and the Final Upload Date falls in the selected global range.
          </div>
          <div className="overview-guidelines-line">
            A successful ad passes all formula thresholds: Amount Spent ≥ 100, Q1 Completion &gt; 10%, CTI ≥ 12%, True Completion ≥ 1.8%, CPI ≤ 12.
          </div>
          <div className="overview-guidelines-line">Hit rate = (successful ads / total ads) × 100. Click any row to see per-ad metrics.</div>
          <div className="overview-guidelines-line">Rows shaded light green have one or more successful ads.</div>
        </div>
      </section>

    </div>
  );
}
