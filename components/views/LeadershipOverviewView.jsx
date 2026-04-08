"use client";

import { useState } from "react";
import {
  MetricCard,
  EmptyState,
  formatMetricValue,
  formatPercent,
  normalizePodFilterKey,
  CHART_TONE_POSITIVE,
} from "./shared.jsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

export default function LeadershipOverviewContent({ leadershipOverviewData, leadershipOverviewLoading, leadershipOverviewError, onNavigate }) {
  const overviewData = leadershipOverviewData || null;
  const overviewLoading = Boolean(leadershipOverviewLoading);
  const overviewError = leadershipOverviewError || "";
  const [expandedPods, setExpandedPods] = useState({});
  const beatRows = Array.isArray(overviewData?.beatRows) ? overviewData.beatRows : [];
  const workflowRows = Array.isArray(overviewData?.workflowRows) ? overviewData.workflowRows : [];
  const approvedMatchedRows = Array.isArray(overviewData?.approvedMatchedRows) ? overviewData.approvedMatchedRows : [];
  const fullGenAiRows = Array.isArray(overviewData?.fullGenAiRows) ? overviewData.fullGenAiRows : [];
  const currentWeekUpdateRows = Array.isArray(overviewData?.currentWeekUpdateRows) ? overviewData.currentWeekUpdateRows : [];
  const scopedBeatRows = beatRows;
  const scopedWorkflowRows = workflowRows;
  const scopedApprovedMatchedRows = approvedMatchedRows;
  const scopedFullGenAiRows = fullGenAiRows;
  const selectedRangeLabel = overviewData?.selectedWeekRangeLabel || "";

  const countByStatus = (rows, statusCategory) => rows.filter((row) => row.statusCategory === statusCategory).length;
  const approvedBeats = countByStatus(scopedBeatRows, "approved");
  const reviewPendingBeats = countByStatus(scopedBeatRows, "review_pending");
  const iterateBeats = countByStatus(scopedBeatRows, "iterate");
  const abandonedBeats = countByStatus(scopedBeatRows, "abandoned");

  const buildMetricsRow = (podLeadName, writerName = "") => ({
    podLeadName,
    writerName,
    ideationCount: 0,
    deliveredCount: 0,
    editorialCount: 0,
    readyForProductionCount: 0,
    productionCount: 0,
    liveCount: 0,
  });

  const outputData = (() => {
    const podMap = new Map(FOCUS_POD_LEADS.map((pod) => [pod.label, buildMetricsRow(pod.label)]));
    const writerMap = new Map();

    const getPodRow = (podLeadName) => {
      const canonicalPod = resolveFocusPodLabel(podLeadName);
      if (!canonicalPod) return null;
      if (!podMap.has(canonicalPod)) {
        podMap.set(canonicalPod, buildMetricsRow(canonicalPod));
      }
      return podMap.get(canonicalPod);
    };

    const getWriterRow = (podLeadName, writerName) => {
      const canonicalPod = resolveFocusPodLabel(podLeadName);
      const safeWriter = String(writerName || "").trim() || "Unassigned";
      if (!canonicalPod) return null;
      const key = `${canonicalPod}::${normalizePodFilterKey(safeWriter)}`;
      if (!writerMap.has(key)) {
        writerMap.set(key, buildMetricsRow(canonicalPod, safeWriter));
      }
      return writerMap.get(key);
    };

    for (const row of scopedBeatRows) {
      const podEntry = getPodRow(row.podLeadName);
      if (podEntry) podEntry.ideationCount += 1;
    }

    for (const row of scopedApprovedMatchedRows) {
      const podEntry = getPodRow(row.podLeadName);
      const writerEntry = getWriterRow(row.podLeadName, row.writerName);
      if (podEntry) podEntry.deliveredCount += 1;
      if (writerEntry) {
        writerEntry.deliveredCount += 1;
        writerEntry.ideationCount += 1;
      }
    }

    for (const row of scopedWorkflowRows) {
      const podEntry = getPodRow(row.podLeadName);
      const writerEntry = getWriterRow(row.podLeadName, row.writerName);

      const applySourceCount = (entry) => {
        if (!entry) return;
        if (row.source === "editorial") entry.editorialCount += 1;
        if (row.source === "ready_for_production") entry.readyForProductionCount += 1;
        if (row.source === "production") entry.productionCount += 1;
        if (row.source === "live") entry.liveCount += 1;
      };

      applySourceCount(podEntry);
      applySourceCount(writerEntry);
    }

    const sortByReadiness = (a, b) => {
      const readinessA = Number(a.readyForProductionCount || 0) + Number(a.productionCount || 0);
      const readinessB = Number(b.readyForProductionCount || 0) + Number(b.productionCount || 0);
      if (readinessA !== readinessB) return readinessB - readinessA;
      const totalA =
        a.ideationCount + a.editorialCount + a.readyForProductionCount + a.productionCount + a.liveCount + a.deliveredCount;
      const totalB =
        b.ideationCount + b.editorialCount + b.readyForProductionCount + b.productionCount + b.liveCount + b.deliveredCount;
      if (totalA !== totalB) return totalB - totalA;
      return String(a.writerName || a.podLeadName).localeCompare(String(b.writerName || b.podLeadName));
    };

    const podRows = Array.from(podMap.values()).sort(sortByReadiness);
    const writerRowsByPod = Object.fromEntries(
      podRows.map((podRow) => {
        const rows = Array.from(writerMap.values())
          .filter((writerRow) => writerRow.podLeadName === podRow.podLeadName)
          .sort(sortByReadiness);
        return [podRow.podLeadName, rows];
      })
    );

    return { podRows, writerRowsByPod };
  })();
  const allPodsExpanded =
    outputData.podRows.length > 0 &&
    outputData.podRows.every((row) => Boolean(expandedPods[row.podLeadName]));

  const throughputByAcd = Array.from(
    scopedWorkflowRows
      .filter((row) => row.source === "production" || row.source === "live")
      .reduce((map, row) => {
        const acdNames = Array.isArray(row?.acdNames) && row.acdNames.length > 0 ? row.acdNames : ["Unassigned"];
        for (const acdName of acdNames) {
          const key = normalizePodFilterKey(acdName || "Unassigned");
          if (!map.has(key)) {
            map.set(key, {
              acdName: acdName || "Unassigned",
              productionAssets: new Set(),
              liveAssets: new Set(),
            });
          }
          const entry = map.get(key);
          const assetCode = String(row?.assetCode || row?.scriptCode || `${row?.showName}-${row?.beatName}`).trim();
          if (row.source === "production") entry.productionAssets.add(assetCode);
          else entry.liveAssets.add(assetCode);
        }
        return map;
      }, new Map())
      .values()
  )
    .map((entry) => {
      const productionCount = entry.productionAssets.size;
      const liveCount = entry.liveAssets.size;
      const totalCount = productionCount + liveCount;
      return {
        acdName: entry.acdName,
        productionCount,
        liveCount,
        totalCount,
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount || a.acdName.localeCompare(b.acdName))
    .slice(0, 8);

  const fullGenAiByBeat = Array.from(
    scopedFullGenAiRows.reduce((map, row) => {
      const key = `${row.showName}|${row.beatName}`;
      if (!map.has(key)) {
        map.set(key, {
          showName: row.showName,
          beatName: row.beatName,
          attempts: 0,
          successCount: 0,
        });
      }
      const entry = map.get(key);
      entry.attempts += 1;
      if (row.success) entry.successCount += 1;
      return map;
    }, new Map()).values()
  )
    .map((entry) => ({
      ...entry,
      hitRate: entry.attempts > 0 ? Number(((entry.successCount / entry.attempts) * 100).toFixed(1)) : null,
    }))
    .sort((a, b) => b.attempts - a.attempts || a.showName.localeCompare(b.showName) || a.beatName.localeCompare(b.beatName));

  const beatsMetricCards = [
    { label: "Approved Beats", value: overviewLoading ? "..." : formatMetricValue(approvedBeats) },
    { label: "Review Pending", value: overviewLoading ? "..." : formatMetricValue(reviewPendingBeats) },
    { label: "Iterate", value: overviewLoading ? "..." : formatMetricValue(iterateBeats) },
    { label: "Abandoned", value: overviewLoading ? "..." : formatMetricValue(abandonedBeats) },
  ];

  return (
    <div className="section-stack overview-flow-shell">
      {overviewError ? <div className="warning-note">{overviewError}</div> : null}

      {(selectedRangeLabel || overviewData?.confidenceNote) ? (
        <>
          <div className="overview-hero-actions" style={{ marginTop: 2 }}>
            {selectedRangeLabel ? <div className="overview-range-pill">{selectedRangeLabel}</div> : null}
            {overviewData?.confidenceNote ? <div className="overview-confidence-note">{overviewData.confidenceNote}</div> : null}
          </div>
          <hr className="section-divider" />
        </>
      ) : null}

      <section className="overview-flow-section">
        <div className="overview-section-head">
          <div>
            <div className="overview-section-kicker">Section 1</div>
            <div className="overview-section-title">Beats</div>
          </div>
          <div className="overview-section-actions">
            <button type="button" className="ghost-button overview-section-link" onClick={() => onNavigate?.("beats-performance")}>
              Open expanded beat view
            </button>
          </div>
        </div>
        <div className="pod-summary-grid">
          {beatsMetricCards.map((card) => (
            <div key={card.label} className="metric-card">
              <div className="metric-label">{card.label}</div>
              <div className="metric-value">{card.value}</div>
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      <section className="overview-flow-section">
        <div className="overview-section-head">
          <div>
            <div className="overview-section-kicker">Section 2</div>
            <div className="overview-section-title">Writer and POD output</div>
          </div>
          <div className="overview-section-actions">
            <div className="overview-section-note">Click a POD row to expand writer-level details inline.</div>
            <button
              type="button"
              className="ghost-button overview-section-link"
              onClick={() =>
                setExpandedPods(
                  allPodsExpanded
                    ? {}
                    : Object.fromEntries(outputData.podRows.map((row) => [row.podLeadName, true]))
                )
              }
            >
              {allPodsExpanded ? "Collapse all pods" : "Open POD Wise"}
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="ops-table overview-table overview-output-table">
            <colgroup>
              <col style={{ width: "28%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>POD / Writer</th>
                <th>Ideation</th>
                <th>Editorial</th>
                <th>Ready for Production</th>
                <th>Production</th>
                <th>Live</th>
              </tr>
            </thead>
            <tbody>
              {outputData.podRows.length > 0 ? (
                outputData.podRows.flatMap((podRow) => {
                  const isExpanded = Boolean(expandedPods[podRow.podLeadName]);
                  const writerRows = outputData.writerRowsByPod[podRow.podLeadName] || [];
                  const podTr = (
                    <tr key={`pod-${podRow.podLeadName}`} style={{ fontWeight: 700 }}>
                      <td>
                        <button
                          type="button"
                          className="as-link"
                          onClick={() =>
                            setExpandedPods((current) => ({
                              ...current,
                              [podRow.podLeadName]: !current[podRow.podLeadName],
                            }))
                          }
                          style={{
                            padding: 0,
                            border: "none",
                            background: "transparent",
                            fontWeight: 700,
                          }}
                        >
                          {isExpanded ? "▾" : "▸"} {podRow.podLeadName || "-"}
                        </button>
                      </td>
                      <td>{formatMetricValue(podRow.ideationCount)}</td>
                      <td>{formatMetricValue(podRow.editorialCount)}</td>
                      <td>{formatMetricValue(podRow.readyForProductionCount)}</td>
                      <td>{formatMetricValue(podRow.productionCount)}</td>
                      <td>{formatMetricValue(podRow.liveCount)}</td>
                    </tr>
                  );

                  const writerTrs = isExpanded
                    ? writerRows.map((writerRow) => (
                        <tr key={`writer-${podRow.podLeadName}-${writerRow.writerName}`}>
                          <td style={{ paddingLeft: 34, color: "var(--subtle)" }}>• {writerRow.writerName || "-"}</td>
                          <td>{formatMetricValue(writerRow.ideationCount)}</td>
                          <td>{formatMetricValue(writerRow.editorialCount)}</td>
                          <td>{formatMetricValue(writerRow.readyForProductionCount)}</td>
                          <td>{formatMetricValue(writerRow.productionCount)}</td>
                          <td>{formatMetricValue(writerRow.liveCount)}</td>
                        </tr>
                      ))
                    : [];

                  return [podTr, ...writerTrs];
                })
              ) : (
                <tr>
                  <td colSpan="6">No output rows available for this filter yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <hr className="section-divider" />

      <section className="overview-flow-section">
        <div className="overview-section-head">
          <div>
            <div className="overview-section-kicker">Section 3</div>
            <div className="overview-section-title">Production throughput</div>
          </div>
          <button type="button" className="ghost-button overview-section-link" onClick={() => onNavigate?.("production")}>
            Open Production
          </button>
        </div>
        <div className="panel-card overview-panel-card">
          <div className="panel-head" style={{ marginBottom: 8 }}>
            <div>
              <div className="panel-title">ACD productivity</div>
              <div className="panel-statline">A compact date-range view of production and live movement, shaped for the PRD's POD x ACD lens.</div>
            </div>
          </div>
          <div style={{ width: "100%", height: 280 }}>
            {throughputByAcd.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={throughputByAcd} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="acdName" width={140} />
                  <Tooltip />
                  <Bar dataKey="totalCount" fill={CHART_TONE_POSITIVE} radius={[0, 8, 8, 0]}>
                    <LabelList dataKey="totalCount" position="right" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No throughput rows available for this filter yet." />
            )}
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      <section className="overview-flow-section">
        <div className="overview-section-head">
          <div>
            <div className="overview-section-kicker">Section 4</div>
            <div className="overview-section-title">Full Gen AI</div>
          </div>
          <div className="overview-section-note">Which beats moved forward, how many attempts happened, and what actually worked.</div>
        </div>
        <div className="metric-grid three-col">
          <MetricCard label="Assets passed to Full Gen AI" value={overviewLoading ? "..." : formatMetricValue(scopedFullGenAiRows.length)} />
          <MetricCard label="Success" value={overviewLoading ? "..." : formatMetricValue(scopedFullGenAiRows.filter((row) => row.success).length)} />
          <MetricCard
            label="Overall hit rate"
            value={
              overviewLoading
                ? "..."
                : scopedFullGenAiRows.length > 0
                  ? formatPercent((scopedFullGenAiRows.filter((row) => row.success).length / scopedFullGenAiRows.length) * 100)
                  : "-"
            }
          />
        </div>
        <div className="table-wrap">
          <table className="ops-table overview-table">
            <thead>
              <tr>
                <th>Show</th>
                <th>Beat</th>
                <th>Attempts</th>
                <th>Success</th>
                <th>Hit rate</th>
              </tr>
            </thead>
            <tbody>
              {fullGenAiByBeat.length > 0 ? (
                fullGenAiByBeat.map((row) => (
                  <tr key={`${row.showName}-${row.beatName}`}>
                    <td>{row.showName || "-"}</td>
                    <td>{row.beatName || "-"}</td>
                    <td>{formatMetricValue(row.attempts)}</td>
                    <td>{formatMetricValue(row.successCount)}</td>
                    <td>{row.hitRate != null ? formatPercent(row.hitRate) : "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">No Full Gen AI rows for this filter yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <hr className="section-divider" />

      <section className="overview-flow-section">
        <div className="overview-section-head">
          <div>
            <div className="overview-section-kicker">Section 5</div>
            <div className="overview-section-title">Current week update</div>
          </div>
          <div className="overview-section-note">A shareable mid-week progress snapshot for POD leads and leadership.</div>
        </div>
        <div className="table-wrap">
          <table className="ops-table overview-table">
            <thead>
              <tr>
                <th>POD</th>
                <th>Writer</th>
                <th>Beats</th>
                <th>Editorial</th>
                <th>Ready for Production</th>
                <th>Production</th>
                <th>Live</th>
              </tr>
            </thead>
            <tbody>
              {currentWeekUpdateRows.length > 0 ? (
                currentWeekUpdateRows.map((row) => (
                  <tr key={`${row.podLeadName}-${row.writerName}`}>
                    <td>{row.podLeadName || "-"}</td>
                    <td>{row.writerName || "-"}</td>
                    <td>{formatMetricValue(row.beats)}</td>
                    <td>{formatMetricValue(row.editorial)}</td>
                    <td>{formatMetricValue(row.readyForProduction)}</td>
                    <td>{formatMetricValue(row.production)}</td>
                    <td>{formatMetricValue(row.live)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7">No current week update rows available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
