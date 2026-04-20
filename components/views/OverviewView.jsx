"use client";
import { useState, Fragment } from "react";

import {
  AcdCollapsibleTable,
  MetricCard,
  ProgressBar,
  ReadinessRow,
  ShareablePanel,
  formatMetricValue,
  formatNumber,
  formatPercent,
  formatDateLabel,
  getTargetCardTone,
  getTatCardTone,
  getWritingDaysTone,
  getClReviewDaysTone,
} from "./shared.jsx";

// ─── Private helpers ──────────────────────────────────────────────────────────

function buildOverviewNotes({ overviewError, overviewData }) {
  const notes = [];

  if (overviewError) {
    notes.push(overviewError);
  } else if (overviewData && overviewData.hasWeekData === false && overviewData.emptyStateMessage) {
    notes.push(overviewData.emptyStateMessage);
  }

  if (overviewData?.goodToGoError) {
    notes.push(overviewData.goodToGoError);
  }
  if (overviewData?.analyticsSourceError) {
    notes.push(`Analytics source warning: ${overviewData.analyticsSourceError}`);
  }
  if (overviewData?.ideationSourceError) {
    notes.push(`Ideation source warning: ${overviewData.ideationSourceError}`);
  }

  return notes.filter(Boolean);
}

function getPipelineCardTone(actualValue, targetValue) {
  const actual = Number(actualValue);
  const target = Number(targetValue);
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return "default";
  const ratio = actual / target;
  if (ratio < 0.7) return "danger-strong";
  if (ratio < 0.85) return "danger";
  if (ratio < 1) return "warning";
  return ratio >= 1.15 ? "positive-strong" : "positive";
}

function getReadinessColor(ratio) {
  if (ratio >= 1) return "#2d5a3d";
  if (ratio >= 0.5) return "#9f6b15";
  return "#9f2e2e";
}


function DeltaBadge({ current, previous, loading, label = "vs prev week" }) {
  if (loading || previous == null || current == null) return null;
  const delta = Number(current) - Number(previous);
  if (delta === 0) {
    return <div style={{ fontSize: 11, color: "var(--subtle)", marginTop: 4 }}>= same as {label}</div>;
  }
  const color = delta > 0 ? "#2d5a3d" : "#9f2e2e";
  const sign = delta > 0 ? "+" : "";
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color, marginTop: 4 }}>
      {sign}{delta} vs {label}
    </div>
  );
}

function StagePill({ count, label, color, bg }) {
  if (!count) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, borderRadius: 5,
      padding: "2px 7px", background: bg, color, marginRight: 5,
    }}>
      {count} <span style={{ fontWeight: 400, opacity: 0.8 }}>{label}</span>
    </span>
  );
}

function PodEditorialStatusTable({ rows = [], loading = false }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const [expandedPods, setExpandedPods] = useState({});

  const togglePod = (podName) =>
    setExpandedPods((prev) => ({ ...prev, [podName]: !prev[podName] }));

  const tableRows = [];
  for (const pod of safeRows) {
    const writerRows = Array.isArray(pod.writerRows) ? pod.writerRows : [];
    const isExpanded = Boolean(expandedPods[pod.podLeadName]);
    tableRows.push(
      <tr
        key={`pod-${pod.podLeadName}`}
        style={{ cursor: writerRows.length > 0 ? "pointer" : undefined }}
        onClick={writerRows.length > 0 ? () => togglePod(pod.podLeadName) : undefined}
      >
        <td style={{ fontWeight: 700 }}>
          {writerRows.length > 0 && (
            <span style={{ marginRight: 6, fontSize: 10, color: "var(--subtle)" }}>
              {isExpanded ? "▼" : "▶"}
            </span>
          )}
          {pod.podLeadName}
          {writerRows.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: 10, color: "var(--subtle)", fontWeight: 400 }}>
              {writerRows.length} writer{writerRows.length !== 1 ? "s" : ""}
            </span>
          )}
        </td>
        <td style={{ textAlign: "center", fontWeight: 700, color: "#2d5a3d", fontSize: 15 }}>
          {pod.lwProductionCount || 0}
        </td>
        <td>
          <StagePill count={pod.onTrackCount} label="On Track" color="#2d5a3d" bg="#e8f4ea" />
          <StagePill count={pod.reviewWithClCount} label="Review w/ CL" color="#7c6bbf" bg="#f0edfb" />
          <StagePill count={pod.wipCount} label="WIP" color="#9f6b15" bg="#fdf5e4" />
          {!pod.onTrackCount && !pod.reviewWithClCount && !pod.wipCount && (
            <span style={{ color: "var(--subtle)", fontSize: 11 }}>No beats assigned</span>
          )}
        </td>
      </tr>
    );
    if (isExpanded) {
      for (const writer of writerRows) {
        tableRows.push(
          <tr key={`writer-${pod.podLeadName}-${writer.writerName}`} style={{ background: "var(--bg-deep, #f7f4ef)" }}>
            <td style={{ paddingLeft: 28, color: "var(--subtle)", fontSize: 12 }}>• {writer.writerName}</td>
            <td style={{ textAlign: "center", fontWeight: 600, fontSize: 12 }}>{writer.lwProductionCount || 0}</td>
            <td>
              <StagePill count={writer.onTrackCount} label="On Track" color="#2d5a3d" bg="#e8f4ea" />
              <StagePill count={writer.reviewWithClCount} label="Review w/ CL" color="#7c6bbf" bg="#f0edfb" />
              <StagePill count={writer.wipCount} label="WIP" color="#9f6b15" bg="#fdf5e4" />
            </td>
          </tr>
        );
      }
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>POD production status</div>
      <div style={{ fontSize: 11, color: "var(--subtle)", marginBottom: 10 }}>
        LW production · GA (Q1 manual + thumbnail) · approved beats only &nbsp;·&nbsp; This week stage from planner
      </div>
      <div className="table-wrap">
        <table className="ops-table overview-table">
          <thead>
            <tr>
              <th>POD / Writer</th>
              <th style={{ textAlign: "center" }}>LW Prod</th>
              <th>This week stage breakdown</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="3" style={{ color: "var(--subtle)" }}>Loading…</td></tr>
            ) : tableRows.length === 0 ? (
              <tr><td colSpan="3" style={{ color: "var(--subtle)" }}>No data yet for this period.</td></tr>
            ) : tableRows}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScriptTypeBadges({ ftCount = 0, rwCount = 0, compact = false }) {
  const parts = [];
  if (ftCount > 0) {
    parts.push(
      <span key="ft" style={{
        display: "inline-block", fontSize: compact ? 10 : 11, fontWeight: 600,
        background: "#e8f4ea", color: "#2d5a3d", borderRadius: 4,
        padding: compact ? "1px 5px" : "2px 6px", marginRight: 4,
      }}>FT:{ftCount}</span>
    );
  }
  if (rwCount > 0) {
    parts.push(
      <span key="rw" style={{
        display: "inline-block", fontSize: compact ? 10 : 11, fontWeight: 600,
        background: "#f3f0fb", color: "#6741d9", borderRadius: 4,
        padding: compact ? "1px 5px" : "2px 6px", marginRight: 4,
      }}>RW:{rwCount}</span>
    );
  }
  if (parts.length === 0 && rwCount === 0 && ftCount === 0) return null;
  return <span>{parts}</span>;
}

function FtRwCell({ ft, rw }) {
  const total = ft + rw;
  if (total === 0) return <td style={{ textAlign: "center", color: "var(--subtle)", fontSize: 13 }}>—</td>;
  return (
    <td style={{ textAlign: "center" }}>
      <span style={{ fontWeight: 700 }}>{total}</span>
      {" "}
      <ScriptTypeBadges compact ftCount={ft} rwCount={rw} />
    </td>
  );
}

function PodBreakdownTable({ rows = [], loading = false }) {
  const safeRows = Array.isArray(rows) ? rows : [];

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Breakdown by POD</div>
      <div style={{ fontSize: 11, color: "var(--subtle)", marginBottom: 10 }}>
        Scripts per workflow stage · date-filtered · FT = Fresh Take · RW = Rework
      </div>
      <div className="table-wrap">
        <table className="ops-table overview-table">
          <thead>
            <tr>
              <th>POD</th>
              <th style={{ textAlign: "center" }}>Editorial</th>
              <th style={{ textAlign: "center" }}>Ready for Prod</th>
              <th style={{ textAlign: "center" }}>Production</th>
              <th style={{ textAlign: "center" }}>Live</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ color: "var(--subtle)" }}>Loading…</td></tr>
            ) : safeRows.length === 0 ? (
              <tr><td colSpan="5" style={{ color: "var(--subtle)" }}>No data for the selected period.</td></tr>
            ) : safeRows.map((pod) => (
              <tr key={pod.podLeadName}>
                <td style={{ fontWeight: 700 }}>{pod.podLeadName}</td>
                <FtRwCell ft={pod.editorial?.ft ?? 0} rw={pod.editorial?.rw ?? 0} />
                <FtRwCell ft={pod.readyForProd?.ft ?? 0} rw={pod.readyForProd?.rw ?? 0} />
                <FtRwCell ft={pod.production?.ft ?? 0} rw={pod.production?.rw ?? 0} />
                <FtRwCell ft={pod.live?.ft ?? 0} rw={pod.live?.rw ?? 0} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Normalize writer names: "Jacob" / "Berman" / "Jacob Berman" → "Jacob Berman"
function buildWriterCanonicalMap(rawNames) {
  const unique = [...new Set(rawNames.filter(Boolean))];
  // Sort longest (most words) first so full names are canonicalized before partials
  unique.sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length || a.localeCompare(b));
  const canonicals = [];
  const map = new Map();
  for (const name of unique) {
    const parts = name.toLowerCase().split(/\s+/);
    // Check if this name is a strict word-subset of an already-canonical longer name
    const parent = canonicals.find((c) => {
      const cp = c.toLowerCase().split(/\s+/);
      return cp.length > parts.length && parts.every((p) => cp.includes(p));
    });
    if (parent) {
      map.set(name, parent);
    } else {
      map.set(name, name);
      canonicals.push(name);
    }
  }
  return map;
}

// Flow chart segments ordered: success stages left → stuck stages right
const FLOW_SEGMENTS = [
  { key: "live",       label: "Live",        color: "#2d6a4f" },
  { key: "production", label: "Production",  color: "#2563eb" },
  { key: "readyProd",  label: "Ready",       color: "#7c3aed" },
  { key: "editorial",  label: "Editorial",   color: "#9333ea" },
  { key: "inReview",   label: "In Review",   color: "#d97706" },
  { key: "tbi",        label: "TBI",         color: "#9ca3af" },
  { key: "abandoned",  label: "Abandoned",   color: "#dc2626" },
];

function FlowBar({ data, height = 32, showLabels = true }) {
  const total = FLOW_SEGMENTS.reduce((s, seg) => s + (data[seg.key] || 0), 0);
  if (total === 0) return <div style={{ height, flex: 1, background: "var(--subtle-bg, #f0ece4)", borderRadius: 6, opacity: 0.5 }} />;
  return (
    <div style={{ flex: 1, height, display: "flex", borderRadius: 6, overflow: "hidden", gap: 1 }}>
      {FLOW_SEGMENTS.map((seg) => {
        const count = data[seg.key] || 0;
        if (count === 0) return null;
        const pct = count / total;
        return (
          <div
            key={seg.key}
            title={`${seg.label}: ${count}`}
            style={{
              flex: count,
              background: seg.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: height > 24 ? 12 : 10,
              fontWeight: 600,
              minWidth: 0,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {showLabels && pct >= 0.1 ? count : ""}
          </div>
        );
      })}
    </div>
  );
}

function BeatStatusPodTable({ beatRows = [], workflowRows = [], loading = false }) {
  const [expandedPods, setExpandedPods] = useState(new Set());
  const togglePod = (name) => setExpandedPods((prev) => {
    const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next;
  });

  // Build canonical map from all writer names across both sheets
  const allRawNames = [
    ...beatRows.map((r) => String(r.writerName || "").trim()),
    ...workflowRows.map((r) => String(r.writerName || "").trim()),
  ].filter((n) => n && n.toLowerCase() !== "unknown");
  const canonMap = buildWriterCanonicalMap(allRawNames);
  const canon = (name) => {
    const clean = String(name || "").trim();
    if (!clean || clean.toLowerCase() === "unknown") return "Unknown";
    return canonMap.get(clean) || clean;
  };

  // Aggregate per POD → Writer
  const podMap = new Map();
  const zero = () => ({ beats: 0, live: 0, production: 0, readyProd: 0, editorial: 0, inReview: 0, tbi: 0, abandoned: 0, beatItems: [], angleItems: [] });

  for (const row of beatRows) {
    const pod = String(row.podLeadName || "").trim() || "Unknown";
    const writer = canon(row.writerName);
    if (!podMap.has(pod)) podMap.set(pod, { ...zero(), writers: new Map() });
    const pe = podMap.get(pod);
    pe.beats++;
    if (!pe.writers.has(writer)) pe.writers.set(writer, zero());
    const we = pe.writers.get(writer);
    we.beats++;
    const cat = row.statusCategory;
    const bname = row.beatName || row.scriptCode || "—";
    if (cat === "abandoned")                                { pe.abandoned++; we.abandoned++; we.beatItems.push({ name: bname, label: "Abandoned", color: "#dc2626" }); }
    else if (cat === "review_pending" || cat === "iterate") { pe.inReview++;  we.inReview++;  we.beatItems.push({ name: bname, label: "In Review", color: "#d97706" }); }
    else if (cat === "to_be_ideated")                       { pe.tbi++;       we.tbi++;       we.beatItems.push({ name: bname, label: "TBI",        color: "#9ca3af" }); }
    else if (cat === "approved")                            {                                  we.beatItems.push({ name: bname, label: "Approved",   color: "#2d6a4f" }); }
  }

  for (const row of workflowRows) {
    const pod = String(row.podLeadName || "").trim() || "Unknown";
    const writer = canon(row.writerName);
    if (!podMap.has(pod)) podMap.set(pod, { ...zero(), writers: new Map() });
    const pe = podMap.get(pod);
    if (!pe.writers.has(writer)) pe.writers.set(writer, zero());
    const we = pe.writers.get(writer);
    const aname = row.beatName || row.scriptCode || row.assetCode || "—";
    const src = row.source;
    if (src === "live")                 { pe.live++;       we.live++;       we.angleItems.push({ name: aname, label: "Live",       color: "#2d6a4f" }); }
    else if (src === "production")      { pe.production++; we.production++; we.angleItems.push({ name: aname, label: "Production", color: "#2563eb" }); }
    else if (src === "ready_for_production") { pe.readyProd++; we.readyProd++; we.angleItems.push({ name: aname, label: "Ready",  color: "#7c3aed" }); }
    else if (src === "editorial")       { pe.editorial++;  we.editorial++;  we.angleItems.push({ name: aname, label: "Editorial", color: "#9333ea" }); }
  }

  const podRows = Array.from(podMap.entries()).map(([podName, data]) => {
    const writerRows = Array.from(data.writers.entries())
      .map(([writerName, w]) => ({ writerName, ...w }))
      .filter((w) => w.beats > 0 || w.live + w.production + w.readyProd + w.editorial > 0)
      .sort((a, b) => (b.beats + b.live) - (a.beats + a.live) || a.writerName.localeCompare(b.writerName));
    return { podLeadName: podName, ...data, writerRows };
  })
  .filter((r) => r.beats > 0 || r.live + r.production + r.readyProd + r.editorial > 0)
  .sort((a, b) => (b.beats + b.live) - (a.beats + a.live) || a.podLeadName.localeCompare(b.podLeadName));

  if (loading) return <div style={{ marginTop: 20, color: "var(--subtle)", fontSize: 13 }}>Loading…</div>;
  if (podRows.length === 0) return <div style={{ marginTop: 20, color: "var(--subtle)", fontSize: 13 }}>No data for the selected period.</div>;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Beat Flow by POD</div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        {FLOW_SEGMENTS.map((seg) => (
          <span key={seg.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--fg, #2c2825)" }}>
            <span style={{ width: 10, height: 10, background: seg.color, borderRadius: 2, flexShrink: 0 }} />
            {seg.label}
          </span>
        ))}
      </div>

      {/* POD rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {podRows.map((pod) => {
          const isExp = expandedPods.has(pod.podLeadName);
          return (
            <div key={pod.podLeadName} style={{ background: "var(--subtle-bg, #f0ece4)", borderRadius: 8, padding: "10px 14px" }}>
              {/* POD header + bar */}
              <div
                style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none" }}
                onClick={() => togglePod(pod.podLeadName)}
              >
                <div style={{ width: 110, flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{pod.podLeadName}</div>
                  <div style={{ fontSize: 11, color: "var(--subtle)" }}>
                    {pod.beats > 0 ? `${pod.beats} beats` : ""}{pod.beats > 0 && pod.live > 0 ? " · " : ""}{pod.live > 0 ? `${pod.live} live` : ""}
                  </div>
                </div>
                <FlowBar data={pod} height={34} />
                <div style={{ width: 20, flexShrink: 0, textAlign: "center", fontSize: 12, color: "var(--subtle)" }}>
                  {isExp ? "▾" : "▸"}
                </div>
              </div>

              {/* Writer breakdown */}
              {isExp && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10, paddingTop: 10, borderTop: "1px solid var(--border, #e5ddd4)" }}>
                  {pod.writerRows.map((w) => (
                    <div key={w.writerName}>
                      {/* Writer bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <div style={{ width: 130, fontSize: 12, fontWeight: 600, flexShrink: 0, color: "var(--fg, #2c2825)" }}>
                          {w.writerName}
                          <span style={{ fontWeight: 400, color: "var(--subtle)", marginLeft: 5, fontSize: 11 }}>
                            {[w.beats > 0 && `${w.beats}b`, w.live > 0 && `${w.live}L`].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                        <FlowBar data={w} height={22} showLabels={false} />
                      </div>
                      {/* Beat + angle name list */}
                      <div style={{ paddingLeft: 140, display: "flex", flexDirection: "column", gap: 3 }}>
                        {w.beatItems.length > 0 && (
                          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Beats</div>
                        )}
                        {w.beatItems.map((item, i) => (
                          <div key={`b${i}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                            <span style={{ color: "var(--fg, #2c2825)", flex: 1 }}>{item.name}</span>
                            <span style={{ fontSize: 10, color: item.color, background: `${item.color}18`, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" }}>{item.label}</span>
                          </div>
                        ))}
                        {w.angleItems.length > 0 && (
                          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: w.beatItems.length > 0 ? 6 : 0, marginBottom: 2 }}>Angles</div>
                        )}
                        {w.angleItems.map((item, i) => (
                          <div key={`a${i}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                            <span style={{ color: "var(--fg, #2c2825)", flex: 1 }}>{item.name}</span>
                            <span style={{ fontSize: 10, color: item.color, background: `${item.color}18`, borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap" }}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PodThroughputRankingTable({ rows = [], loading = false }) {
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

  const totalScripts = safeRows.reduce((sum, pod) => sum + (pod.totalScripts || 0), 0);
  const totalFt = safeRows.reduce((sum, pod) => sum + (pod.ftCount || 0), 0);
  const totalRw = safeRows.reduce((sum, pod) => sum + (pod.rwCount || 0), 0);

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
              <span style={{
                fontSize: 10, width: 16, height: 16, display: "inline-flex",
                alignItems: "center", justifyContent: "center",
                background: "var(--subtle-bg, #f0ece4)", borderRadius: 3,
                color: "var(--subtle)", flexShrink: 0,
              }}>
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
                <tr style={{ borderTop: "2px solid var(--border)", background: "var(--subtle-bg, #f0ece4)" }}>
                  <td style={{ fontWeight: 700 }}>Total</td>
                  <td style={{ fontWeight: 700, textAlign: "center" }}>{formatMetricValue(totalScripts)}</td>
                  <td>
                    <ScriptTypeBadges compact ftCount={totalFt} rwCount={totalRw} />
                  </td>
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

// ─── Sub-views ────────────────────────────────────────────────────────────────

export function OverviewCurrentWeek({ overviewData, overviewLoading, overviewError, middleSlot }) {
  const unavailableMetricValue = overviewError ? "-" : null;
  const tatSummary = overviewData?.tatSummary || {};
  const tatDays = tatSummary?.averageTatDays;
  const beatsCount = overviewData?.plannerBeatCount ?? 0;
  const beatsTarget = 25;
  const productionCount = overviewData?.inProductionBeatCount ?? 0;
  const productionTarget = 22;

  return (
    <div className="section-stack">
      <hr className="section-divider" />
      <div className="metric-grid three-col">
        <MetricCard
          label="Unique beats this week"
          className="hero-card"
          tone={getPipelineCardTone(beatsCount, beatsTarget)}
          body={
            <>
              <div className="metric-value">
                {overviewLoading ? "..." : unavailableMetricValue || formatMetricValue(beatsCount)}
              </div>
              <div className="metric-hint">{`Target: ${beatsTarget}+`}</div>
              <DeltaBadge
                current={beatsCount}
                previous={overviewData?.prevFreshTakeCount}
                loading={overviewLoading}
                label="LW releases"
              />
            </>
          }
        />
        <MetricCard
          label="Fresh Take in Production"
          className="hero-card"
          value={overviewLoading ? "..." : unavailableMetricValue || formatMetricValue(overviewData?.freshTakeInProductionCount ?? 0)}
        />
        <MetricCard
          label="Moving to production"
          className="hero-card"
          tone={getPipelineCardTone(productionCount, productionTarget)}
          value={overviewLoading ? "..." : unavailableMetricValue || formatMetricValue(productionCount)}
          hint={`Target: ${productionTarget}`}
        />
      </div>
      <div className="metric-grid three-col">
        <MetricCard
          label="Expected production TAT"
          value={overviewLoading ? "..." : unavailableMetricValue || (tatDays !== null && tatDays !== undefined ? formatNumber(tatDays) : "-")}
          unit="days"
          hint="Production cells / unique beats"
          tone={getTatCardTone(tatDays, tatSummary?.targetTatDays)}
        />
        <MetricCard
          label="Scripts per writer"
          value={overviewLoading ? "..." : unavailableMetricValue || (overviewData?.scriptsPerWriter != null ? String(overviewData.scriptsPerWriter) : "-")}
          hint="Beats entering production / writers"
        />
        <MetricCard
          label="Avg CL review days"
          value={overviewLoading ? "..." : unavailableMetricValue || (overviewData?.averageClReviewDays != null ? formatNumber(overviewData.averageClReviewDays) : "-")}
          unit="days"
          hint="CL review cells / unique beats"
          tone={getClReviewDaysTone(overviewData?.averageClReviewDays)}
        />
      </div>
      {middleSlot}
    </div>
  );
}

export function OverviewLastWeek({ overviewData, overviewLoading, overviewError, middleSlot }) {
  return (
    <div className="section-stack">
      {middleSlot}

      {Array.isArray(overviewData?.beatsFunnel) && overviewData.beatsFunnel.length > 0 && (
        <>
          <hr className="section-divider" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Beats funnel</div>
            <div style={{ fontSize: 11, color: "var(--subtle)", marginBottom: 12 }}>Show and beat level breakdown for last week</div>
            <table className="beats-funnel-table">
              <colgroup>
                <col className="col-show" />
                <col className="col-beat" />
                <col className="col-attempts" />
                <col className="col-success" />
              </colgroup>
              <thead>
                <tr>
                  <th>SHOW</th>
                  <th>BEAT</th>
                  <th className="col-right">ATTEMPTS</th>
                  <th className="col-right">SUCCESSFUL</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows = overviewData.beatsFunnel;
                  const rendered = [];
                  let i = 0;
                  while (i < rows.length) {
                    const showName = rows[i].showName;
                    let j = i;
                    while (j < rows.length && rows[j].showName === showName) j++;
                    const span = j - i;
                    for (let k = i; k < j; k++) {
                      const row = rows[k];
                      const isSuccess = row.successfulAttempts > 0;
                      rendered.push(
                        <tr key={`${row.showName}-${row.beatName}`} className={isSuccess ? "beats-funnel-success" : ""}>
                          {k === i && (
                            <td rowSpan={span} style={{ fontSize: 12, fontWeight: 500, color: "var(--subtle)" }}>
                              {row.showName}
                            </td>
                          )}
                          <td>{row.beatName}</td>
                          <td className="col-right" style={{ fontWeight: 500 }}>{row.attempts}</td>
                          <td
                            className="col-right"
                            style={{
                              fontWeight: 500,
                              color: row.successfulAttempts > 0 ? "#2d5a3d" : "var(--gray-light, #D3D1C7)",
                            }}
                          >
                            {row.successfulAttempts}
                          </td>
                        </tr>
                      );
                    }
                    i = j;
                  }
                  return rendered;
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export function OverviewNextWeek({ overviewData, overviewLoading, overviewError, middleSlot }) {
  const unavailableMetricValue = overviewError ? "-" : null;
  const tatSummary = overviewData?.tatSummary || {};
  const tatDays = tatSummary?.averageTatDays;
  const plannedLive = overviewData?.plannedReleaseCount ?? 0;
  const target = overviewData?.targetFloor || 22;
  const shortfall = Math.max(0, target - Number(plannedLive || 0));
  const beatsCount = overviewData?.goodToGoBeatsCount ?? overviewData?.plannerBeatCount ?? 0;
  const reviewPendingCount = overviewData?.reviewPendingCount ?? 0;
  const iterateCount = overviewData?.iterateCount ?? 0;
  const wipCount = reviewPendingCount + iterateCount;

  const liveOnMetaCount = Number(overviewData?.plannedReleaseCount || 0);
  const inProductionCount = Number(overviewData?.inProductionBeatCount || 0);
  const uniqueShowCount = Number(overviewData?.uniqueShowCount || 0);

  return (
    <div className="section-stack">
      <div className="metric-grid three-col">
        <MetricCard
          label="Beats locked GTG"
          className="hero-card"
          tone="positive"
          body={
            <>
              <div className="metric-value">
                {overviewLoading ? "..." : unavailableMetricValue || formatMetricValue(beatsCount)}
              </div>
              <div className="metric-hint">Confirmed and ready to go</div>
              <DeltaBadge
                current={beatsCount}
                previous={overviewData?.prevFreshTakeCount}
                loading={overviewLoading}
                label="LW releases"
              />
            </>
          }
        />
        <MetricCard
          label="Fresh Take in Production"
          className="hero-card"
          value={overviewLoading ? "..." : unavailableMetricValue || formatMetricValue(overviewData?.freshTakeInProductionCount ?? 0)}
        />
        {wipCount > 0 ? (
          <MetricCard
            label="Work in Progress"
            className="hero-card"
            value={overviewLoading ? "..." : formatMetricValue(wipCount)}
            hint={`${reviewPendingCount} review pending · ${iterateCount} in iteration`}
            tone="warning"
          />
        ) : null}
        <MetricCard
          label="Assets planned to go live"
          className="hero-card"
          tone={getTargetCardTone(plannedLive, target)}
          body={
            <>
              <div className="metric-value">
                {overviewLoading ? "..." : unavailableMetricValue || formatMetricValue(plannedLive)}
                <span className="metric-unit">/ {target}</span>
              </div>
              <ProgressBar value={Number(plannedLive || 0)} target={target} />
              {!overviewLoading && shortfall > 0 && (
                <div style={{ fontSize: 11, color: "#9f2e2e", marginTop: 4 }}>{shortfall} short of target</div>
              )}
            </>
          }
        />
      </div>
      <div className="metric-grid three-col">
        <MetricCard
          label="Expected production TAT"
          value={overviewLoading ? "..." : unavailableMetricValue || (tatDays != null ? formatNumber(tatDays) : "...")}
          hint={tatDays == null ? "Not enough data yet" : "Production cells / unique beats"}
          tone={tatDays != null ? getTatCardTone(tatDays, tatSummary?.targetTatDays) : "default"}
        />
        <MetricCard
          label="Avg writing days"
          value={overviewLoading ? "..." : unavailableMetricValue || (overviewData?.averageWritingDays != null ? formatNumber(overviewData.averageWritingDays) : "...")}
          hint={overviewData?.averageWritingDays == null ? "Not enough allocations yet" : "Writing cells / unique beats"}
          tone={getWritingDaysTone(overviewData?.averageWritingDays)}
        />
        <MetricCard
          label="Avg CL review days"
          value={overviewLoading ? "..." : unavailableMetricValue || (overviewData?.averageClReviewDays != null ? formatNumber(overviewData.averageClReviewDays) : "...")}
          hint={overviewData?.averageClReviewDays == null ? "Not enough allocations yet" : "CL review cells / unique beats"}
          tone={getClReviewDaysTone(overviewData?.averageClReviewDays)}
        />
      </div>

      {middleSlot}

      <hr className="section-divider" />

      <div>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Readiness checklist</div>
        <div className="readiness-checklist">
          <ReadinessRow
            color={beatsCount > 0 ? getReadinessColor(1) : "#a39e93"}
            label="Beats locked and assigned to writers"
            value={beatsCount > 0 ? `${beatsCount} of ${beatsCount}` : "Pending"}
          />
          <ReadinessRow
            color={liveOnMetaCount > 0 ? getReadinessColor(inProductionCount / Math.max(liveOnMetaCount, 1)) : "#9f6b15"}
            label="Scripts in CL review pipeline"
            value={liveOnMetaCount > 0 ? `${inProductionCount} of ${liveOnMetaCount}` : "Pending"}
          />
          <ReadinessRow
            color={liveOnMetaCount > 0 ? getReadinessColor(liveOnMetaCount / Math.max(Number(target), 1)) : "#9f2e2e"}
            label="Scripts cleared for production"
            value={liveOnMetaCount > 0 ? `${liveOnMetaCount} of ${target}` : "Pending"}
          />
          <ReadinessRow
            color="#a39e93"
            label="Production slots booked"
            value="Pending"
          />
          <ReadinessRow
            color={uniqueShowCount > 0 ? "#2d5a3d" : "#a39e93"}
            label="Show coverage (shows with at least 1 beat)"
            value={uniqueShowCount > 0 ? String(uniqueShowCount) : "Pending"}
          />
        </div>
      </div>
    </div>
  );
}


// ─── Main View ────────────────────────────────────────────────────────────────

function MiniBar({ label, value, total, color }) {
  if (value === 0) return null;
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <span style={{ width: 26, fontSize: 11, fontWeight: 600, color: "var(--ink-secondary, #3a3530)", textAlign: "right", flexShrink: 0 }}>{value}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--surface, #ece8e1)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: color, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ width: 90, fontSize: 10, color: "var(--subtle)", flexShrink: 0, textAlign: "left" }}>{label}</span>
    </div>
  );
}

function normalizeDateOnly(value) {
  return String(value || "").trim().slice(0, 10);
}

function isDateInSelectedRange(value, startDate, endDate) {
  const date = normalizeDateOnly(value);
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

export default function OverviewContent({
  overviewData,
  overviewLoading,
  overviewError,
  acdMetricsData,
  acdMetricsLoading,
  leadershipOverviewData,
  leadershipOverviewLoading,
  onShare,
  copyingSection,
  includeNewShowsPod,
  onIncludeNewShowsPodChange,
}) {
  const notes = buildOverviewNotes({ overviewError, overviewData });
  const weekLabel = overviewData?.weekLabel || "";
  const selectionMode = String(overviewData?.selectionMode || "");
  const podThroughputRows = Array.isArray(leadershipOverviewData?.podThroughputRows) ? leadershipOverviewData.podThroughputRows : [];
  const editorialPodRows = Array.isArray(overviewData?.editorialPodRows) ? overviewData.editorialPodRows : [];
  const podBreakdownRows = Array.isArray(overviewData?.podBreakdownRows) ? overviewData.podBreakdownRows : [];

  const allBeatRows = Array.isArray(leadershipOverviewData?.allBeatRows) ? leadershipOverviewData.allBeatRows : [];
  const allWorkflowRows = Array.isArray(leadershipOverviewData?.allWorkflowRows) ? leadershipOverviewData.allWorkflowRows : [];
  const weekStart = normalizeDateOnly(overviewData?.weekStart);
  const weekEnd = normalizeDateOnly(overviewData?.weekEnd);

  // Beat breakdown — single filter pass
  const weekBeatRows = allBeatRows.filter((row) =>
    isDateInSelectedRange(normalizeDateOnly(row?.completedDate), weekStart, weekEnd)
  );
  const totalBeats = weekBeatRows.length;
  const beatBreakdown = {
    approved:      weekBeatRows.filter((r) => r.statusCategory === "approved").length,
    abandoned:     weekBeatRows.filter((r) => r.statusCategory === "abandoned").length,
    reviewPending: weekBeatRows.filter((r) => r.statusCategory === "review_pending").length,
    iterate:       weekBeatRows.filter((r) => r.statusCategory === "iterate").length,
    toBeIdeated:   weekBeatRows.filter((r) => r.statusCategory === "to_be_ideated").length,
  };
  const approvedBeatsCount = beatBreakdown.approved;

  // Fresh take breakdown — single filter pass
  const ftSources = new Set(["editorial", "ready_for_production", "production", "live"]);
  const weekWorkflowRows = allWorkflowRows.filter((row) =>
    ftSources.has(row?.source) &&
    isDateInSelectedRange(normalizeDateOnly(row?.leadSubmittedDate), weekStart, weekEnd)
  );
  const freshTakeCount = weekWorkflowRows.length;
  const ftBreakdown = {
    editorial:          weekWorkflowRows.filter((r) => r.source === "editorial").length,
    readyForProduction: weekWorkflowRows.filter((r) => r.source === "ready_for_production").length,
    production:         weekWorkflowRows.filter((r) => r.source === "production").length,
    live:               weekWorkflowRows.filter((r) => r.source === "live").length,
  };

  const podLoading = leadershipOverviewLoading || overviewLoading;

  const [progressView, setProgressView] = useState("pod");
  const [hoveredProgressKey, setHoveredProgressKey] = useState(null);

  const weekEditorialRows = weekWorkflowRows.filter((r) => r.source === "editorial");
  const weekReadyProdRows = weekWorkflowRows.filter((r) => r.source === "ready_for_production" || r.source === "production");
  const weekLiveRows = weekWorkflowRows.filter((r) => r.source === "live");
  const progressGetKey = (row) => String((progressView === "writer" ? row?.writerName : row?.podLeadName) || "").trim();

  const progressGroupMap = new Map();
  for (const row of weekBeatRows) {
    const key = progressGetKey(row);
    if (!key) continue;
    if (!progressGroupMap.has(key)) progressGroupMap.set(key, { label: key, approved: 0 });
    if (row.statusCategory === "approved") progressGroupMap.get(key).approved += 1;
  }
  for (const row of weekWorkflowRows) {
    const key = progressGetKey(row);
    if (key && !progressGroupMap.has(key)) progressGroupMap.set(key, { label: key, approved: 0 });
  }
  const progressRows = Array.from(progressGroupMap.values())
    .map((entry) => {
      const { label } = entry;
      const editorialCount = weekEditorialRows.filter((r) => progressGetKey(r) === label).length;
      const readyProductionCount = weekReadyProdRows.filter((r) => progressGetKey(r) === label).length;
      const liveCount = weekLiveRows.filter((r) => progressGetKey(r) === label).length;
      const details = [
        ...weekBeatRows
          .filter((r) => r.statusCategory === "approved" && progressGetKey(r) === label)
          .map((r, i) => ({ id: `approved-${r.id || i}`, beatName: r.beatName || "-", stageLabel: r.statusLabel || "Approved", etaLabel: "-", tone: "approved" })),
        ...weekEditorialRows
          .filter((r) => progressGetKey(r) === label)
          .map((r, i) => ({ id: `editorial-${r.assetCode || r.scriptCode || i}`, beatName: r.beatName || r.scriptCode || "-", stageLabel: r.stageLabel || "Editorial", etaLabel: r.stageDate || "-", tone: "editorial" })),
        ...weekReadyProdRows
          .filter((r) => progressGetKey(r) === label)
          .map((r, i) => ({ id: `ready-${r.assetCode || r.scriptCode || i}`, beatName: r.beatName || r.scriptCode || "-", stageLabel: r.stageLabel || "Ready+Prod", etaLabel: r.stageDate || "-", tone: "ready-production" })),
        ...weekLiveRows
          .filter((r) => progressGetKey(r) === label)
          .map((r, i) => ({ id: `live-${r.assetCode || r.scriptCode || i}`, beatName: r.beatName || r.scriptCode || "-", stageLabel: r.stageLabel || "Live", etaLabel: r.stageDate || "-", tone: "live" })),
      ];
      const total = entry.approved + editorialCount + readyProductionCount + liveCount;
      return { ...entry, editorial: editorialCount, readyProduction: readyProductionCount, live: liveCount, details, total };
    })
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  return (
    <ShareablePanel
      shareLabel={`Editorial Funnel ${weekLabel || "selected range"}`}
      onShare={onShare}
      isSharing={copyingSection === `Editorial Funnel ${weekLabel || "selected range"}`}
      topControls={
        <label className="overview-inline-check">
          <input
            type="checkbox"
            checked={Boolean(includeNewShowsPod)}
            onChange={(event) => onIncludeNewShowsPodChange?.(event.target.checked)}
          />
          <span>Include new shows POD (Dan Woodward)</span>
        </label>
      }
    >
      <div className="section-stack">
        {notes.map((note) => (
          <div key={note} className="warning-note">{note}</div>
        ))}

        <div className="metric-grid four-col" style={{ alignItems: "stretch" }}>
          <MetricCard
            label="Total Beats"
            body={
              <>
                <div className="metric-value">{podLoading ? "..." : formatMetricValue(totalBeats)}</div>
                {!podLoading && totalBeats > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <MiniBar label="Approved"       value={beatBreakdown.approved}      total={totalBeats} color="var(--forest)" />
                    <MiniBar label="Abandoned"      value={beatBreakdown.abandoned}     total={totalBeats} color="#7d5a3a" />
                    <MiniBar label="Review pending" value={beatBreakdown.reviewPending} total={totalBeats} color="var(--terracotta)" />
                    <MiniBar label="Iterate"        value={beatBreakdown.iterate}       total={totalBeats} color="var(--red)" />
                    <MiniBar label="To be ideated"  value={beatBreakdown.toBeIdeated}   total={totalBeats} color="#a39e93" />
                  </div>
                )}
              </>
            }
          />
          <MetricCard
            label="Approved Beats"
            body={
              <>
                <div className="metric-value">{podLoading ? "..." : formatMetricValue(approvedBeatsCount)}</div>
                {!podLoading && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--subtle)", marginBottom: 10 }}>
                      of {totalBeats} total beats
                    </div>
                    {totalBeats > 0 && (() => {
                      const pct = Math.round((approvedBeatsCount / totalBeats) * 100);
                      return (
                        <>
                          <div style={{ height: 10, borderRadius: 5, background: "var(--surface, #ece8e1)", overflow: "hidden", marginBottom: 6 }}>
                            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 5, background: "var(--forest)", transition: "width 0.4s ease" }} />
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--forest)" }}>{pct}% approval rate</div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </>
            }
          />
          <MetricCard
            label="Fresh Take"
            body={
              <>
                <div className="metric-value">{podLoading ? "..." : formatMetricValue(freshTakeCount)}</div>
                {!podLoading && freshTakeCount > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <MiniBar label="Editorial"    value={ftBreakdown.editorial}          total={freshTakeCount} color="var(--terracotta)" />
                    <MiniBar label="Ready+Prod"   value={ftBreakdown.readyForProduction} total={freshTakeCount} color="var(--forest)" />
                    <MiniBar label="Production"   value={ftBreakdown.production}         total={freshTakeCount} color="#3f8f83" />
                    <MiniBar label="Live"         value={ftBreakdown.live}               total={freshTakeCount} color="var(--red)" />
                  </div>
                )}
              </>
            }
          />
          <MetricCard
            label="Hit Rate"
            body={
              <>
                <div className="metric-value">
                  {overviewLoading ? "..." : (overviewData?.hitRate != null ? `${overviewData.hitRate.toFixed(1)}%` : "-")}
                </div>
                {!overviewLoading && overviewData?.hitRate != null && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 10, borderRadius: 5, background: "var(--surface, #ece8e1)", overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ width: `${Math.min(100, overviewData.hitRate)}%`, height: "100%", borderRadius: 5, background: "var(--terracotta)", transition: "width 0.4s ease" }} />
                    </div>
                    {overviewData?.hitRateNumerator != null && overviewData?.hitRateDenominator != null && (
                      <div style={{ fontSize: 11, color: "var(--subtle)" }}>
                        {overviewData.hitRateNumerator} of {overviewData.hitRateDenominator} analytics-eligible
                      </div>
                    )}
                  </div>
                )}
              </>
            }
          />
        </div>

        <PodThroughputRankingTable rows={podThroughputRows} loading={podLoading} />

        {(() => {
          if (selectionMode === "editorial_funnel") {
            return <OverviewCurrentWeek overviewData={overviewData} overviewLoading={overviewLoading} overviewError={overviewError} middleSlot={<PodEditorialStatusTable rows={editorialPodRows} loading={overviewLoading} />} />;
          }
          if (selectionMode === "planned") {
            return <OverviewNextWeek overviewData={overviewData} overviewLoading={overviewLoading} overviewError={overviewError} />;
          }
          return <OverviewLastWeek overviewData={overviewData} overviewLoading={overviewLoading} overviewError={overviewError} />;
        })()}

        <hr className="section-divider" />

        <div className="pod-section-header">
          <div style={{ display: "grid", gap: 4 }}>
            <span className="pod-section-title">Progress by Stage</span>
            <span className="pod-section-subtitle">
              Compare approved Ideation beats against Editorial, Ready + Production, and Live counts
            </span>
          </div>
          <div className="beats-progress-toggle" role="tablist" aria-label="Progress grouping">
            <button
              type="button"
              className={progressView === "pod" ? "beats-progress-toggle-button is-active" : "beats-progress-toggle-button"}
              onClick={() => setProgressView("pod")}
            >
              POD
            </button>
            <button
              type="button"
              className={progressView === "writer" ? "beats-progress-toggle-button is-active" : "beats-progress-toggle-button"}
              onClick={() => setProgressView("writer")}
            >
              Writer
            </button>
          </div>
        </div>

        <div className="beats-progress-card">
          {progressRows.length > 0 ? (
            <div className="beats-progress-list">
              {progressRows.map((row) => {
                const safeTotal = Math.max(row.total, 1);
                const isHovered = hoveredProgressKey === `${progressView}-${row.label}`;
                const segments = [
                  { key: "approved", label: "Approved", value: row.approved, className: "is-approved" },
                  { key: "editorial", label: "Editorial", value: row.editorial, className: "is-editorial" },
                  { key: "ready-production", label: "Ready + Production", value: row.readyProduction, className: "is-ready-production" },
                  { key: "live", label: "Live", value: row.live, className: "is-live" },
                ];
                return (
                  <div
                    key={`${progressView}-${row.label}`}
                    className="beats-progress-entry"
                    onMouseEnter={() => setHoveredProgressKey(`${progressView}-${row.label}`)}
                    onMouseLeave={() => setHoveredProgressKey((current) => (current === `${progressView}-${row.label}` ? null : current))}
                  >
                    <div className="beats-progress-row">
                      <div className="beats-progress-name">{row.label}</div>
                      <div className="beats-progress-bar-wrap">
                        <div className="beats-progress-bar">
                          {segments.map((segment) => {
                            if (segment.value <= 0) return null;
                            const width = `${(segment.value / safeTotal) * 100}%`;
                            return (
                              <div
                                key={`${row.label}-${segment.key}`}
                                className={`beats-progress-segment ${segment.className}`}
                                style={{ width }}
                                title={`${segment.label}: ${segment.value}`}
                              >
                                <span>{segment.value}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="beats-progress-legend">
                          <span className="beats-progress-legend-item"><span className="beats-progress-dot is-approved" />Approved {row.approved}</span>
                          <span className="beats-progress-legend-item"><span className="beats-progress-dot is-editorial" />Editorial {row.editorial}</span>
                          <span className="beats-progress-legend-item"><span className="beats-progress-dot is-ready-production" />Ready + Production {row.readyProduction}</span>
                          <span className="beats-progress-legend-item"><span className="beats-progress-dot is-live" />Live {row.live}</span>
                        </div>
                      </div>
                      <div className="beats-progress-total">{row.total}</div>
                    </div>
                    {isHovered ? (
                      <div className="beats-progress-hover-card">
                        <div className="beats-progress-hover-head">
                          <span>{row.label}</span>
                          <span>{row.details.length} items</span>
                        </div>
                        <div className="beats-progress-hover-table">
                          <div className="beats-progress-hover-header">Angle name</div>
                          <div className="beats-progress-hover-header">Stage where it is</div>
                          <div className="beats-progress-hover-header">ETA for promo completion</div>
                          {row.details.length > 0 ? (
                            row.details.map((detail) => (
                              <Fragment key={detail.id}>
                                <div className={`beats-progress-hover-cell is-${detail.tone || "approved"}`}>{detail.beatName}</div>
                                <div className={`beats-progress-hover-cell is-${detail.tone || "approved"}`}>{detail.stageLabel || ""}</div>
                                <div className={`beats-progress-hover-cell is-${detail.tone || "approved"}`}>{detail.etaLabel}</div>
                              </Fragment>
                            ))
                          ) : (
                            <div className="beats-progress-hover-empty" style={{ gridColumn: "1 / -1" }}>
                              No detail rows available.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="beats-progress-empty">
              {podLoading ? "Loading…" : "No progress rows match the selected date range."}
            </div>
          )}
        </div>
      </div>
    </ShareablePanel>
  );
}
