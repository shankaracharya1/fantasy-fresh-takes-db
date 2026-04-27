"use client";
import { useState, useRef, useMemo, Fragment } from "react";

import {
  BeatsSummaryCards,
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

function getWriterLastName(name) {
  const parts = String(name || "").trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
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
        <td style={{ fontWeight: 700, textAlign: "center" }}>{(pod.ftCount || 0) + (pod.rwCount || 0)}</td>
        <td style={{ fontWeight: 700, textAlign: "center", color: "#2d5a3d" }}>{pod.ftCount || 0}</td>
        <td style={{ fontWeight: 700, textAlign: "center", color: "#c2703e" }}>{pod.rwCount || 0}</td>
      </tr>
    );

    if (isExpanded) {
      for (const writer of writerRows) {
        tableRows.push(
          <tr key={`writer-${pod.podLeadName}-${writer.writerName}`} style={{ background: "var(--bg-deep, #f7f4ef)" }}>
            <td style={{ paddingLeft: 28, color: "var(--subtle)", fontSize: 12 }}>• {getWriterLastName(writer.writerName)}</td>
            <td style={{ textAlign: "center", fontSize: 12 }}>{(writer.ftCount || 0) + (writer.rwCount || 0)}</td>
            <td style={{ textAlign: "center", fontSize: 12, color: "#2d5a3d" }}>{writer.ftCount || 0}</td>
            <td style={{ textAlign: "center", fontSize: 12, color: "#c2703e" }}>{writer.rwCount || 0}</td>
          </tr>
        );
      }
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>POD throughput</div>
      <div style={{ fontSize: 11, color: "var(--subtle)", marginBottom: 10 }}>
        Date submitted by Lead (all sheets) · Fresh Take = FT rows · Rework = all other typed rows · etaToStartProd used as fallback when Lead date is blank
      </div>
      <div className="table-wrap">
        <table className="ops-table overview-table">
          <thead>
            <tr>
              <th>POD / Writer</th>
              <th style={{ textAlign: "center" }}>Total Script</th>
              <th style={{ textAlign: "center" }}>Fresh Take</th>
              <th style={{ textAlign: "center" }}>Rework</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ color: "var(--subtle)" }}>Loading…</td></tr>
            ) : tableRows.length > 0 ? (
              <>
                {tableRows}
                <tr style={{ borderTop: "2px solid var(--border)", background: "var(--subtle-bg, #f0ece4)" }}>
                  <td style={{ fontWeight: 700 }}>Total</td>
                  <td style={{ fontWeight: 700, textAlign: "center" }}>{totalFt + totalRw}</td>
                  <td style={{ fontWeight: 700, textAlign: "center", color: "#2d5a3d" }}>{totalFt}</td>
                  <td style={{ fontWeight: 700, textAlign: "center", color: "#c2703e" }}>{totalRw}</td>
                </tr>
              </>
            ) : (
              <tr><td colSpan="4">No scripts found for the selected date range.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── POD Throughput Detail Table ─────────────────────────────────────────────

function PodThroughputDetailTable({ rows = [], loading = false }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const [expanded, setExpanded] = useState(false);

  // Flatten all scripts from all pods/writers, preserving pod+writer grouping order
  const detailRows = [];
  for (const pod of safeRows) {
    for (const writer of Array.isArray(pod.writerRows) ? pod.writerRows : []) {
      for (const script of Array.isArray(writer.scripts) ? writer.scripts : []) {
        detailRows.push({
          pod: pod.podLeadName,
          writer: writer.writerName,
          assetCode: script.assetCode || "—",
          showName: script.showName || "—",
          beatName: script.beatName || "—",
          type: script.type,
          date: script.date || "—",
          source: script.source || "",
        });
      }
    }
  }

  if (!loading && detailRows.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", marginBottom: 4 }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span style={{
          fontSize: 10, width: 16, height: 16, display: "inline-flex", alignItems: "center",
          justifyContent: "center", background: "var(--subtle-bg, #f0ece4)", borderRadius: 3,
          color: "var(--subtle)", flexShrink: 0,
        }}>
          {expanded ? "▾" : "▸"}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Detailed POD Overview
        </span>
      </div>
      {expanded && (
        <div className="table-wrap" style={{ marginTop: 6 }}>
          <table className="ops-table overview-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>POD</th>
                <th>Writer</th>
                <th>Code</th>
                <th>Show</th>
                <th>Beat / Angle</th>
                <th style={{ textAlign: "center" }}>Type</th>
                <th style={{ textAlign: "center" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ color: "var(--subtle)" }}>Loading…</td></tr>
              ) : detailRows.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? undefined : "var(--bg-deep, #f7f4ef)" }}>
                  <td style={{ fontWeight: 600 }}>{r.pod}</td>
                  <td>{getWriterLastName(r.writer)}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.assetCode}</td>
                  <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.showName}</td>
                  <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.beatName}</td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{
                      display: "inline-block", padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                      background: r.type === "ft" ? "rgba(45,90,61,0.12)" : "rgba(194,112,62,0.12)",
                      color: r.type === "ft" ? "#2d5a3d" : "#c2703e",
                      letterSpacing: "0.04em",
                    }}>
                      {r.type === "ft" ? "FT" : "RW"}
                    </span>
                  </td>
                  <td style={{ textAlign: "center", color: "var(--subtle)", fontSize: 11 }}>{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Beats Overview Table ────────────────────────────────────────────────────

// Beat rows have monthKey ("2026-04") and weekInMonth (1-4) set by the API
// using Math.min(4, Math.floor((day-1)/7)+1). We match on those fields directly
// rather than date ranges so the counts stay identical to the source data.

function getMonthShort(monthKey) {
  const [y, m] = String(monthKey || "").split("-").map(Number);
  if (!y || !m) return "";
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

// Compute {monthKey, weekInMonth} for today, then step back n weeks.
// Each month has exactly 4 weeks (API caps at 4), so stepping back is:
//   weekInMonth-- ; if < 1 → weekInMonth=4, month--
function stepBackWeeks(monthKey, weekInMonth, steps) {
  let [y, m] = String(monthKey).split("-").map(Number);
  let wk = weekInMonth;
  for (let i = 0; i < steps; i++) {
    wk--;
    if (wk < 1) { wk = 4; m--; if (m < 1) { m = 12; y--; } }
  }
  return { monthKey: `${y}-${String(m).padStart(2, "0")}`, weekInMonth: wk };
}

// Current week + 3 previous weeks, newest first (index 0 = current).
function computeFourBeatsWeeks() {
  const now = new Date();
  const day = now.getDate();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const monthKey = `${y}-${String(m).padStart(2, "0")}`;
  const weekInMonth = Math.min(4, Math.floor((day - 1) / 7) + 1);

  return [0, 1, 2, 3].map((offset) => {
    const { monthKey: mk, weekInMonth: wk } = stepBackWeeks(monthKey, weekInMonth, offset);
    return { monthKey: mk, weekInMonth: wk, label: `${getMonthShort(mk)} Week ${wk}` };
  });
}

function IdeationWeeklyTable({ allBeatRows = [], weekStart = "", weekEnd = "", loading = false }) {
  // Aggregate all rows within the selected date range into a single flat table.
  const { pods, total } = useMemo(() => {
    const podMap = new Map();

    for (const row of allBeatRows) {
      // Date-filter: use primaryDate when available, fall back to week-bucket bounds
      const primaryDate = String(row.primaryDate || "").slice(0, 10);
      if (primaryDate) {
        if (weekStart && primaryDate < weekStart) continue;
        if (weekEnd && primaryDate > weekEnd) continue;
      } else if (row.monthKey && row.weekInMonth) {
        // derive the week-bucket start (approx) and check overlap
        const [y, mo] = String(row.monthKey).split("-").map(Number);
        const anchorDay = (Number(row.weekInMonth) - 1) * 7 + 1;
        const approxDate = `${y}-${String(mo).padStart(2, "0")}-${String(anchorDay).padStart(2, "0")}`;
        if (weekEnd && approxDate > weekEnd) continue;
        const approxEnd = `${y}-${String(mo).padStart(2, "0")}-${String(anchorDay + 6).padStart(2, "0")}`;
        if (weekStart && approxEnd < weekStart) continue;
      } else {
        continue; // no date info — skip
      }

      const pod = row.podLeadName || "Unknown";
      if (!podMap.has(pod)) {
        podMap.set(pod, { approved: 0, iterate: 0, reviewPending: 0, uploaded: 0, inProd: 0, approvedForProd: 0, completedByWriter: 0 });
      }
      const c = podMap.get(pod);
      const sc = String(row.statusCategory || "");
      const ss = String(row.scriptStatus || "").toLowerCase().trim();

      if (sc === "approved") c.approved += 1;
      if (sc === "iterate") c.iterate += 1;
      if (sc === "review_pending") c.reviewPending += 1;
      if (ss === "uploaded") c.uploaded += 1;
      if (ss.includes("visual") || ss.includes("sound editing")) c.inProd += 1;
      if (ss.includes("approved for production")) c.approvedForProd += 1;
      if (ss.includes("completed by writer")) c.completedByWriter += 1;
    }

    const pods = Array.from(podMap.entries())
      .map(([podName, c]) => ({ podName, ...c, writing: c.approved - (c.uploaded + c.completedByWriter) }))
      .sort((a, b) => b.approved - a.approved || a.podName.localeCompare(b.podName));

    const total = pods.reduce(
      (acc, p) => ({
        approved: acc.approved + p.approved,
        iterate: acc.iterate + p.iterate,
        reviewPending: acc.reviewPending + p.reviewPending,
        uploaded: acc.uploaded + p.uploaded,
        inProd: acc.inProd + p.inProd,
        approvedForProd: acc.approvedForProd + p.approvedForProd,
        completedByWriter: acc.completedByWriter + p.completedByWriter,
        writing: acc.writing + p.writing,
      }),
      { approved: 0, iterate: 0, reviewPending: 0, uploaded: 0, inProd: 0, approvedForProd: 0, completedByWriter: 0, writing: 0 }
    );

    return { pods, total };
  }, [allBeatRows, weekStart, weekEnd]);

  const numCell = (v, bold = false) => (
    <td style={{ textAlign: "center", fontWeight: bold ? 700 : 400, fontSize: 13, padding: "8px 10px" }}>{v}</td>
  );

  if (loading) return <div style={{ fontSize: 13, color: "var(--subtle)", padding: "12px 0" }}>Loading…</div>;
  if (!pods.length) return <div style={{ fontSize: 13, color: "var(--subtle)", padding: "12px 0" }}>No ideation data for selected range.</div>;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Beats Overview</div>
      <div className="table-wrap" style={{ overflowX: "auto" }}>
        <table className="ops-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ width: 120 }}>POD</th>
              <th style={{ textAlign: "center", fontWeight: 700 }}>Approved</th>
              <th style={{ textAlign: "center", fontWeight: 700 }}>Iterate</th>
              <th style={{ textAlign: "center", fontWeight: 700 }}>Review pending</th>
              <th style={{ textAlign: "center" }}>Uploaded</th>
              <th style={{ textAlign: "center" }}>In prod</th>
              <th style={{ textAlign: "center" }}>Approved for prod</th>
              <th style={{ textAlign: "center" }}>Completed by writer</th>
              <th style={{ textAlign: "center" }}>Writing</th>
            </tr>
          </thead>
          <tbody>
            {pods.map((pod) => (
              <tr key={pod.podName}>
                <td style={{ fontSize: 12, padding: "8px 10px" }}>{pod.podName}</td>
                {numCell(pod.approved, true)}
                {numCell(pod.iterate, true)}
                {numCell(pod.reviewPending, true)}
                {numCell(pod.uploaded)}
                {numCell(pod.inProd)}
                {numCell(pod.approvedForProd)}
                {numCell(pod.completedByWriter)}
                {numCell(pod.writing)}
              </tr>
            ))}
            <tr style={{ background: "var(--subtle-bg, #f0ece4)", borderTop: "2px solid var(--border)" }}>
              <td style={{ fontStyle: "italic", fontWeight: 600, fontSize: 12, padding: "8px 10px" }}>Total</td>
              {numCell(total.approved, true)}
              {numCell(total.iterate, true)}
              {numCell(total.reviewPending, true)}
              {numCell(total.uploaded)}
              {numCell(total.inProd)}
              {numCell(total.approvedForProd)}
              {numCell(total.completedByWriter)}
              {numCell(total.writing)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PodWriterScriptTable({ allBeatRows = [], allWorkflowRows = [], weekStart = "", weekEnd = "", loading = false }) {
  const [collapsedPods, setCollapsedPods] = useState(new Set());

  const togglePod = (podName) =>
    setCollapsedPods((prev) => {
      const next = new Set(prev);
      next.has(podName) ? next.delete(podName) : next.add(podName);
      return next;
    });

  const rows = useMemo(() => {
    // --- Approved Beats: ideation tracker, statusCategory === "approved", no date filter ---
    const approvedMap = new Map(); // pod → Map(writer → count)
    for (const row of allBeatRows) {
      if (row.statusCategory !== "approved") continue;
      const pod = row.podLeadName || "Unknown";
      const writer = row.writerName || "Unknown";
      if (!approvedMap.has(pod)) approvedMap.set(pod, new Map());
      const wm = approvedMap.get(pod);
      wm.set(writer, (wm.get(writer) || 0) + 1);
    }

    // --- Filter workflow rows by dateSubmittedByLead ---
    const dateFiltered = allWorkflowRows.filter((row) => {
      const d = String(row.strictLeadSubmittedDate || "").slice(0, 10);
      if (!d) return false;
      if (weekStart && d < weekStart) return false;
      if (weekEnd && d > weekEnd) return false;
      return true;
    });

    const submittedMap = new Map(); // pod → Map(writer → count) — all 4 sheets
    const completedMap = new Map(); // pod → Map(writer → count) — live only

    for (const row of dateFiltered) {
      const pod = row.podLeadName || "Unknown";
      const writer = row.writerName || "Unknown";
      if (!submittedMap.has(pod)) submittedMap.set(pod, new Map());
      const sm = submittedMap.get(pod);
      sm.set(writer, (sm.get(writer) || 0) + 1);
      if (row.source === "live") {
        if (!completedMap.has(pod)) completedMap.set(pod, new Map());
        const cm = completedMap.get(pod);
        cm.set(writer, (cm.get(writer) || 0) + 1);
      }
    }

    // --- Merge into POD → writers structure ---
    const allPods = new Set([...approvedMap.keys(), ...submittedMap.keys(), ...completedMap.keys()]);

    return Array.from(allPods)
      .map((pod) => {
        const aw = approvedMap.get(pod) || new Map();
        const sw = submittedMap.get(pod) || new Map();
        const cw = completedMap.get(pod) || new Map();
        const allWriters = new Set([...aw.keys(), ...sw.keys(), ...cw.keys()]);

        const writers = Array.from(allWriters)
          .map((writer) => ({
            writerName: writer,
            approvedBeats: aw.get(writer) || 0,
            submitted: sw.get(writer) || 0,
            completed: cw.get(writer) || 0,
          }))
          .sort((a, b) => b.submitted - a.submitted || a.writerName.localeCompare(b.writerName));

        return {
          podName: pod,
          writers,
          totalApproved: writers.reduce((s, w) => s + w.approvedBeats, 0),
          totalSubmitted: writers.reduce((s, w) => s + w.submitted, 0),
          totalCompleted: writers.reduce((s, w) => s + w.completed, 0),
        };
      })
      .sort((a, b) => b.totalSubmitted - a.totalSubmitted || a.podName.localeCompare(b.podName));
  }, [allBeatRows, allWorkflowRows, weekStart, weekEnd]);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>POD / Writer Script Pipeline</div>
      {loading ? (
        <div style={{ fontSize: 13, color: "var(--subtle)", padding: "12px 0" }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--subtle)", padding: "12px 0" }}>No data for selected range.</div>
      ) : (
        <div className="table-wrap">
          <table className="ops-table" style={{ width: "100%", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: "30%" }}>POD / Writer</th>
                <th style={{ textAlign: "right", width: "20%" }}>Approved Beats</th>
                <th style={{ textAlign: "right", width: "25%" }}>Scripts Submitted to Prod</th>
                <th style={{ textAlign: "right", width: "25%" }}>Total Completed</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((pod) => {
                const isCollapsed = collapsedPods.has(pod.podName);
                const toggleBtn = (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); togglePod(pod.podName); }}
                    style={{
                      width: 18, height: 18, borderRadius: 4, border: "1.5px solid var(--border)",
                      background: "var(--card)", color: "var(--fg)", fontSize: 12, fontWeight: 700,
                      lineHeight: 1, cursor: "pointer", display: "inline-flex", alignItems: "center",
                      justifyContent: "center", flexShrink: 0,
                    }}
                  >
                    {isCollapsed ? "+" : "−"}
                  </button>
                );

                const podRow = (
                  <tr key={`pod-${pod.podName}`} style={{ background: "var(--card-alt, #f7f4ee)" }}>
                    <td style={{ fontWeight: 700, fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {toggleBtn}
                        {pod.podName}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{pod.totalApproved || "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{pod.totalSubmitted || "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{pod.totalCompleted || "—"}</td>
                  </tr>
                );

                if (isCollapsed) return [podRow];

                return [
                  podRow,
                  ...pod.writers.map((writer) => (
                    <tr key={`writer-${pod.podName}-${writer.writerName}`}>
                      <td style={{ paddingLeft: 34, fontSize: 12, color: "var(--fg)" }}>{writer.writerName}</td>
                      <td style={{ textAlign: "right", fontSize: 12 }}>{writer.approvedBeats || "—"}</td>
                      <td style={{ textAlign: "right", fontSize: 12 }}>{writer.submitted || "—"}</td>
                      <td style={{ textAlign: "right", fontSize: 12 }}>{writer.completed || "—"}</td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BeatsOverviewTable({ allBeatRows = [], loading = false }) {
  const [expandedPods, setExpandedPods] = useState(new Set());

  // Stable for the lifetime of the session — today doesn't change mid-session
  const weeks = useMemo(() => computeFourBeatsWeeks(), []);

  const podMap = useMemo(() => {
    if (!weeks.length) return new Map();
    const map = new Map();
    for (const row of allBeatRows) {
      if (row?.statusCategory !== "approved") continue;
      const pod = String(row?.podLeadName || "").trim() || "Unknown";
      const writer = String(row?.writerName || "").trim() || "Unknown";
      // Match using the same monthKey + weekInMonth fields the API already computed
      const weekIdx = weeks.findIndex(
        (w) => w.monthKey === row.monthKey && w.weekInMonth === row.weekInMonth
      );
      if (weekIdx < 0) continue;

      if (!map.has(pod)) map.set(pod, { writers: new Map(), weekCounts: [0, 0, 0, 0], total: 0 });
      const podEntry = map.get(pod);
      podEntry.weekCounts[weekIdx]++;
      podEntry.total++;

      if (!podEntry.writers.has(writer)) podEntry.writers.set(writer, { weekCounts: [0, 0, 0, 0], total: 0 });
      const writerEntry = podEntry.writers.get(writer);
      writerEntry.weekCounts[weekIdx]++;
      writerEntry.total++;
    }
    return map;
  }, [allBeatRows, weeks]);

  const podRows = useMemo(() =>
    Array.from(podMap.entries())
      .map(([pod, data]) => ({
        podLeadName: pod,
        total: data.total,
        weekCounts: data.weekCounts,
        writerRows: Array.from(data.writers.entries())
          .map(([writer, wd]) => ({ writerName: writer, total: wd.total, weekCounts: wd.weekCounts }))
          .sort((a, b) => b.total - a.total || a.writerName.localeCompare(b.writerName)),
      }))
      .sort((a, b) => b.total - a.total || a.podLeadName.localeCompare(b.podLeadName)),
  [podMap]);

  const grandTotal = podRows.reduce((s, r) => s + r.total, 0);
  const weekTotals = weeks.map((_, i) => podRows.reduce((s, r) => s + r.weekCounts[i], 0));

  const togglePod = (name) => setExpandedPods((prev) => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const colCount = 2 + weeks.length;

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Beats Overview</div>
      <div style={{ fontSize: 11, color: "var(--subtle)", marginBottom: 8 }}>
        Approved beats only · based on Beats completed date · current week → past 3 weeks
      </div>
      <div className="table-wrap">
        <table className="ops-table overview-table">
          <thead>
            <tr>
              <th>POD / Beats owner</th>
              <th style={{ textAlign: "center" }}>Beats count</th>
              {weeks.map((w) => (
                <th key={w.label} style={{ textAlign: "center" }}>{w.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colCount} style={{ color: "var(--subtle)" }}>Loading…</td></tr>
            ) : podRows.length === 0 ? (
              <tr><td colSpan={colCount} style={{ color: "var(--subtle)" }}>No approved beats found for this period.</td></tr>
            ) : (
              <>
                {podRows.flatMap((pod) => {
                  const isExpanded = expandedPods.has(pod.podLeadName);
                  return [
                    <tr key={`pod-${pod.podLeadName}`} style={{ cursor: pod.writerRows.length ? "pointer" : undefined, userSelect: "none" }} onClick={() => pod.writerRows.length && togglePod(pod.podLeadName)}>
                      <td style={{ fontWeight: 700 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {pod.writerRows.length > 0 && (
                            <span style={{ fontSize: 10, width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--subtle-bg, #f0ece4)", borderRadius: 3, color: "var(--subtle)", flexShrink: 0 }}>
                              {isExpanded ? "▾" : "▸"}
                            </span>
                          )}
                          {pod.podLeadName}
                          {pod.writerRows.length > 0 && (
                            <span style={{ fontWeight: 400, fontSize: 11, color: "var(--subtle)" }}>
                              {pod.writerRows.length} writer{pod.writerRows.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </span>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: "#2d5a3d" }}>{pod.total}</td>
                      {pod.weekCounts.map((count, i) => (
                        <td key={i} style={{ textAlign: "center" }}>{count > 0 ? count : "—"}</td>
                      ))}
                    </tr>,
                    ...(isExpanded ? pod.writerRows.map((writer) => (
                      <tr key={`writer-${pod.podLeadName}-${writer.writerName}`} style={{ background: "var(--bg-deep, #f7f4ef)" }}>
                        <td style={{ paddingLeft: 28, color: "var(--subtle)", fontSize: 12 }}>• {writer.writerName}</td>
                        <td style={{ textAlign: "center", fontSize: 12, fontWeight: 600 }}>{writer.total}</td>
                        {writer.weekCounts.map((count, i) => (
                          <td key={i} style={{ textAlign: "center", fontSize: 12 }}>{count > 0 ? count : "—"}</td>
                        ))}
                      </tr>
                    )) : []),
                  ];
                })}
                <tr style={{ borderTop: "2px solid var(--border)", background: "var(--subtle-bg, #f0ece4)", fontWeight: 700 }}>
                  <td>Total</td>
                  <td style={{ textAlign: "center" }}>{grandTotal}</td>
                  {weekTotals.map((t, i) => (
                    <td key={i} style={{ textAlign: "center" }}>{t > 0 ? t : "—"}</td>
                  ))}
                </tr>
              </>
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


// ─── Show Wise Table ─────────────────────────────────────────────────────────

function swNormDate(v) { return String(v || "").trim().slice(0, 10); }
function swInRange(d, start, end) {
  const date = swNormDate(d);
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}
function swIsApproved(status) {
  return String(status || "").toLowerCase().includes("approved for production by cl");
}
function swDateShort(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return "";
  const [, m, d] = String(ymd).split("-").map(Number);
  return `${d} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1]}`;
}

export function ShowWiseTable({ allWorkflowRows = [], allAnalyticsRows = [], weekStart, weekEnd, loading = false }) {
  const [collapsedPods, setCollapsedPods] = useState(new Set());
  const togglePod = (podName) =>
    setCollapsedPods((prev) => {
      const next = new Set(prev);
      next.has(podName) ? next.delete(podName) : next.add(podName);
      return next;
    });

  const pods = useMemo(() => {
    const podMap = new Map();

    const getOrCreate = (map, key, factory) => { if (!map.has(key)) map.set(key, factory()); return map.get(key); };

    // Workflow rows → show list + Submit to Prod + Live
    for (const row of allWorkflowRows) {
      const pod = String(row.podLeadName || "").trim();
      const show = String(row.showName || "").trim();
      if (!pod || !show) continue;

      const source = String(row.source || "");
      const podKey = pod.toLowerCase();
      const showKey = show.toLowerCase();

      if (source === "editorial" || source === "ready_for_production" || source === "production") {
        const dateCheck = swNormDate(row.strictLeadSubmittedDate || row.leadSubmittedDate || row.stageDate);
        if (!swInRange(dateCheck, weekStart, weekEnd)) continue;
        // Editorial rows must also be Approved for Production by CL
        if (source === "editorial" && !swIsApproved(row.scriptStatus || row.status)) continue;

        const podEntry = getOrCreate(podMap, podKey, () => ({ podName: pod, writers: new Set(), showMap: new Map() }));
        if (row.writerName) podEntry.writers.add(String(row.writerName).trim());
        const showEntry = getOrCreate(podEntry.showMap, showKey, () => ({ showName: show, submitToProd: 0, live: 0, successBeats: new Set(), promisingBeats: new Set() }));
        if (swIsApproved(row.scriptStatus || row.status)) showEntry.submitToProd++;
      }

      if (source === "live") {
        const liveDate = swNormDate(row.finalUploadDate || row.stageDate);
        if (!swInRange(liveDate, weekStart, weekEnd)) continue;

        const podEntry = getOrCreate(podMap, podKey, () => ({ podName: pod, writers: new Set(), showMap: new Map() }));
        if (row.writerName) podEntry.writers.add(String(row.writerName).trim());
        const showEntry = getOrCreate(podEntry.showMap, showKey, () => ({ showName: show, submitToProd: 0, live: 0, successBeats: new Set(), promisingBeats: new Set() }));
        showEntry.live++;
      }
    }

    // Analytics rows → Success / Promising per show
    for (const row of allAnalyticsRows) {
      const show = String(row.showName || "").trim();
      const pod = String(row.podLeadName || "").trim();
      if (!show) continue;
      if (!swInRange(swNormDate(row.liveDate), weekStart, weekEnd)) continue;
      const cpi = Number(row.cpiUsd);
      if (!Number.isFinite(cpi) || cpi <= 0) continue;

      const beatLabel = String(row.beatName || row.assetCode || "").trim();
      const showKey = show.toLowerCase();
      const podKey = pod.toLowerCase();

      let showEntry = null;
      if (pod && podMap.has(podKey) && podMap.get(podKey).showMap.has(showKey)) {
        showEntry = podMap.get(podKey).showMap.get(showKey);
      } else {
        for (const pe of podMap.values()) {
          if (pe.showMap.has(showKey)) { showEntry = pe.showMap.get(showKey); break; }
        }
      }
      if (!showEntry) continue;
      if (cpi < 6) showEntry.successBeats.add(beatLabel);
      if (cpi < 10) showEntry.promisingBeats.add(beatLabel);
    }

    return Array.from(podMap.values())
      .map(({ podName, writers, showMap }) => {
        const shows = Array.from(showMap.values())
          .sort((a, b) => (b.submitToProd + b.live) - (a.submitToProd + a.live) || a.showName.localeCompare(b.showName));
        const total = {
          submitToProd: shows.reduce((s, sh) => s + sh.submitToProd, 0),
          live: shows.reduce((s, sh) => s + sh.live, 0),
          success: shows.reduce((s, sh) => s + sh.successBeats.size, 0),
          promising: shows.reduce((s, sh) => s + sh.promisingBeats.size, 0),
        };
        return { podName, writerCount: writers.size, shows, total };
      })
      .sort((a, b) => (b.total.submitToProd + b.total.live) - (a.total.submitToProd + a.total.live) || a.podName.localeCompare(b.podName));
  }, [allWorkflowRows, allAnalyticsRows, weekStart, weekEnd]);

  const dateRangeLabel = (weekStart && weekEnd)
    ? `${swDateShort(weekStart)} – ${swDateShort(weekEnd)}`
    : "";

  if (loading) return <div style={{ color: "var(--subtle)", fontSize: 13, padding: "12px 0" }}>Loading…</div>;
  if (!pods.length) return <div style={{ color: "var(--subtle)", fontSize: 13, padding: "12px 0" }}>No show data for selected range.</div>;

  return (
    <div className="table-wrap">
      <table className="ops-table show-wise-table">
        <thead>
          <tr>
            <th>POD</th>
            <th>Show</th>
            <th>Submitted to Prod</th>
            <th>
              Live
              {dateRangeLabel && <div className="show-wise-subhead">{dateRangeLabel}</div>}
            </th>
            <th>Success<div className="show-wise-subhead">{"< $6 CPI"}</div></th>
            <th>Promising<div className="show-wise-subhead">{"< $10 CPI"}</div></th>
            <th style={{ width: 36 }} />
          </tr>
        </thead>
        <tbody>
          {pods.map(({ podName, writerCount, shows, total }) => {
            const isCollapsed = collapsedPods.has(podName);
            return (
            <Fragment key={`pod-${podName}`}>
              <tr className="show-wise-pod-total-row">
                <td rowSpan={isCollapsed ? 1 : shows.length + 1} className="show-wise-pod-cell">
                  <div className="show-wise-pod-name">{podName}</div>
                  {writerCount > 0 && <div className="show-wise-writer-count">({writerCount} writers)</div>}
                </td>
                <td className="show-wise-total-label">Total</td>
                <td className="show-wise-total">{total.submitToProd > 0 ? total.submitToProd : "—"}</td>
                <td className="show-wise-total">{total.live > 0 ? total.live : "—"}</td>
                <td className="show-wise-total">{total.success > 0 ? total.success : "—"}</td>
                <td className="show-wise-total">{total.promising > 0 ? total.promising : "—"}</td>
                <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                  <button
                    type="button"
                    onClick={() => togglePod(podName)}
                    style={{
                      width: 22, height: 22, borderRadius: "50%",
                      border: "1.5px solid var(--accent, #c2703e)",
                      background: "transparent", color: "var(--accent, #c2703e)",
                      fontSize: 15, lineHeight: 1, fontWeight: 700,
                      cursor: "pointer", display: "inline-flex",
                      alignItems: "center", justifyContent: "center",
                      padding: 0, flexShrink: 0,
                    }}
                    aria-label={isCollapsed ? "Expand rows" : "Collapse rows"}
                  >
                    {isCollapsed ? "+" : "−"}
                  </button>
                </td>
              </tr>
              {!isCollapsed && shows.map((sh) => (
                <tr key={`${podName}-${sh.showName}`} className="show-wise-show-row">
                  <td className="show-wise-show-name">{sh.showName}</td>
                  <td>{sh.submitToProd > 0 ? sh.submitToProd : ""}</td>
                  <td>{sh.live > 0 ? sh.live : ""}</td>
                  <td>
                    {sh.successBeats.size > 0 ? (
                      <><span>{sh.successBeats.size}</span><div className="show-wise-beat-list">{Array.from(sh.successBeats).join(" / ")}</div></>
                    ) : ""}
                  </td>
                  <td>
                    {sh.promisingBeats.size > 0 ? (
                      <><span>{sh.promisingBeats.size}</span><div className="show-wise-beat-list">{Array.from(sh.promisingBeats).join(" / ")}</div></>
                    ) : ""}
                  </td>
                  <td />
                </tr>
              ))}
            </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Detailed Overview Table ──────────────────────────────────────────────────

const PAGE_SIZE = 15;

function ReworkBadge({ value }) {
  const v = String(value || "").trim().toLowerCase();
  const isFT = v.includes("fresh");
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 99,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.04em",
      background: isFT ? "rgba(45,90,61,0.12)" : "rgba(194,112,62,0.12)",
      color: isFT ? "#2d5a3d" : "#c2703e",
    }}>
      {isFT ? "FT" : "RW"}
    </span>
  );
}

function FullGenAiSection({ fullGenAiRows = [], fullGenAiSourceError = null, loading = false }) {
  const [expandedAngles, setExpandedAngles] = useState({});
  const [sortConfig, setSortConfig] = useState({ col: "ads", dir: "desc" });
  const [collapsedPods, setCollapsedPods] = useState(new Set());

  const togglePodCollapse = (podName) =>
    setCollapsedPods((prev) => {
      const next = new Set(prev);
      next.has(podName) ? next.delete(podName) : next.add(podName);
      return next;
    });
  const scopedRows = fullGenAiRows;
  const successfulAdsCount = scopedRows.filter((r) => r.success).length;

  const toggleSort = (col) =>
    setSortConfig((prev) => ({ col, dir: prev.col === col && prev.dir === "desc" ? "asc" : "desc" }));

  const sortIcon = (col) => {
    const isActive = sortConfig.col === col;
    return (
      <span style={{ marginLeft: 4, fontSize: 13, fontWeight: 700, color: isActive ? "#fff" : "rgba(255,255,255,0.55)" }}>
        {isActive ? (sortConfig.dir === "desc" ? "↓" : "↑") : "↕"}
      </span>
    );
  };

  // Group by POD → Writer → Show → Beat, with dynamic sorting
  const byPod = useMemo(() => {
    const { col, dir } = sortConfig;
    const m = dir === "asc" ? 1 : -1;

    const podMap = new Map();
    for (const row of scopedRows) {
      const pod = row.podLeadName || "Unknown";
      const writer = row.writerName || "Unknown";
      const show = row.showName;
      const beatKey = `${show}|${row.beatName}`;

      if (!podMap.has(pod)) podMap.set(pod, { podName: pod, writerMap: new Map() });
      const podEntry = podMap.get(pod);
      if (!podEntry.writerMap.has(writer)) podEntry.writerMap.set(writer, { writerName: writer, showMap: new Map() });
      const writerEntry = podEntry.writerMap.get(writer);
      if (!writerEntry.showMap.has(show)) writerEntry.showMap.set(show, { showName: show, beatMap: new Map() });
      const showEntry = writerEntry.showMap.get(show);
      if (!showEntry.beatMap.has(beatKey)) showEntry.beatMap.set(beatKey, { beatName: row.beatName, showName: show, attempts: 0, successCount: 0, ftCount: 0, rwCount: 0, ads: [] });
      const beatEntry = showEntry.beatMap.get(beatKey);
      beatEntry.attempts++;
      if (row.success) beatEntry.successCount++;
      if (row.scriptType === "ft") beatEntry.ftCount++; else if (row.scriptType === "rw") beatEntry.rwCount++;
      beatEntry.ads.push({ assetCode: row.assetCode, success: row.success, scriptType: row.scriptType, cpiUsd: row.cpiUsd, absoluteCompletionPct: row.absoluteCompletionPct, ctrPct: row.ctrPct, clickToInstall: row.clickToInstall });
    }

    // Sort helpers
    const beatCmp = (a, b) => {
      if (col === "beat") return m * a.beatName.localeCompare(b.beatName);
      if (col === "ads") return m * (a.attempts - b.attempts);
      if (col === "successful") return m * (a.successCount - b.successCount);
      if (col === "hitRate") return m * ((a.hitRate ?? -1) - (b.hitRate ?? -1));
      return b.attempts - a.attempts;
    };
    const numAgg = (beats) => {
      if (col === "successful") return beats.reduce((s, b) => s + b.successCount, 0);
      if (col === "hitRate") return beats.length > 0 ? beats.reduce((s, b) => s + (b.hitRate ?? 0), 0) / beats.length : 0;
      return beats.reduce((s, b) => s + b.attempts, 0);
    };

    return Array.from(podMap.values()).map(({ podName, writerMap }) => {
      const writers = Array.from(writerMap.values()).map(({ writerName, showMap }) => {
        const shows = Array.from(showMap.values()).map(({ showName, beatMap }) => {
          const beats = Array.from(beatMap.values())
            .map((b) => ({ ...b, hitRate: b.attempts > 0 ? Number(((b.successCount / b.attempts) * 100).toFixed(1)) : null }))
            .sort(beatCmp);
          return { showName, beats };
        }).sort((a, b) =>
          col === "show" ? m * a.showName.localeCompare(b.showName) : numAgg(b.beats) - numAgg(a.beats)
        );
        const allBeats = shows.flatMap((s) => s.beats);
        return { writerName, shows, totalAttempts: allBeats.reduce((s, b) => s + b.attempts, 0), totalSuccess: allBeats.reduce((s, b) => s + b.successCount, 0) };
      }).sort((a, b) => {
        if (col === "writer") return m * a.writerName.localeCompare(b.writerName);
        return b.totalAttempts - a.totalAttempts;
      });

      const allBeats = writers.flatMap((w) => w.shows.flatMap((s) => s.beats));
      const totalAttempts = allBeats.reduce((s, b) => s + b.attempts, 0);
      const totalSuccess = allBeats.reduce((s, b) => s + b.successCount, 0);
      return { podName, writers, totalAttempts, totalSuccess, totalShows: new Set(allBeats.map((b) => b.showName)).size, totalBeats: allBeats.length };
    }).sort((a, b) => {
      if (col === "pod") return m * a.podName.localeCompare(b.podName);
      if (col === "successful") return m * (a.totalSuccess - b.totalSuccess);
      if (col === "hitRate") {
        const aHr = a.totalAttempts > 0 ? a.totalSuccess / a.totalAttempts : 0;
        const bHr = b.totalAttempts > 0 ? b.totalSuccess / b.totalAttempts : 0;
        return m * (aHr - bHr);
      }
      return m * (a.totalAttempts - b.totalAttempts);
    });
  }, [scopedRows, sortConfig]);

  return (
    <section className="overview-flow-section">
      <div className="overview-section-head">
        <div>
          <div className="overview-section-title">Detailed POD Overview</div>
          <div className="overview-section-subtitle" style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            GA/GI scripts · Live tab only · filtered by upload date · success metrics from analytics
          </div>
        </div>
        <div className="overview-section-actions" style={{ marginLeft: "auto", justifyContent: "flex-end", display: "flex", alignItems: "center", gap: 10 }}>
          <div className="overview-section-note">
            {loading ? "PODs: ..." : `PODs: ${formatMetricValue(byPod.length)}`}
          </div>
        </div>
      </div>

      <>
          <div className="metric-grid three-col">
            <MetricCard label="Assets live (GI/GA)" value={loading ? "..." : formatMetricValue(scopedRows.length)} />
            <MetricCard
              label="Successful Hit Benchmark"
              body={
                <>
                  <div className="metric-value">{loading ? "..." : formatMetricValue(successfulAdsCount)}</div>
                  <ul style={{ margin: "8px 0 0", padding: "0 0 0 16px", fontSize: 11, color: "var(--subtle)", lineHeight: 1.7 }}>
                    <li>Amount Spent ≥ $100</li>
                    <li>Q1 Completion &gt; 10%</li>
                    <li>CTI ≥ 12%</li>
                    <li>True Completion ≥ 1.8%</li>
                    <li>CPI ≤ $12</li>
                    <li>OR CPI &lt; $6 regardless of other metrics</li>
                  </ul>
                </>
              }
            />
            <MetricCard
              label="Overall hit rate"
              value={loading ? "..." : scopedRows.length > 0 ? formatPercent((successfulAdsCount / scopedRows.length) * 100) : "-"}
            />
          </div>
          {fullGenAiSourceError ? (
            <div className="warning-note" style={{ marginTop: 10 }}>
              Full Gen AI source warning: {fullGenAiSourceError}
            </div>
          ) : null}
          <div className="table-wrap genai-table-wrap">
            <table className="ops-table overview-table">
              <thead>
                <tr>
                  <th style={{ width: 110, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("pod")}>POD{sortIcon("pod")}</th>
                  <th style={{ width: 120, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("writer")}>Writer{sortIcon("writer")}</th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("show")}>Show{sortIcon("show")}</th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("beat")}>Angle{sortIcon("beat")}</th>
                  <th style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("ads")}>Ads{sortIcon("ads")}</th>
                  <th style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("successful")}>Successful{sortIcon("successful")}</th>
                  <th style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("hitRate")}>Hit Rate{sortIcon("hitRate")}</th>
                  <th style={{ width: 36, background: "#2d5a3d" }} />
                </tr>
              </thead>
              <tbody>
                {byPod.length > 0 ? byPod.flatMap((pod) => {
                  const isPodCollapsed = collapsedPods.has(pod.podName);
                  const podToggleBtn = (isCollapsed) => (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); togglePodCollapse(pod.podName); }}
                      title={isCollapsed ? "Expand POD" : "Collapse POD"}
                      style={{
                        width: 18, height: 18, borderRadius: 4, border: "1.5px solid var(--border)",
                        background: "var(--card)", color: "var(--fg)", fontSize: 12, fontWeight: 700,
                        lineHeight: 1, cursor: "pointer", display: "inline-flex", alignItems: "center",
                        justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      {isCollapsed ? "+" : "−"}
                    </button>
                  );

                  if (isPodCollapsed) {
                    return [(
                      <tr key={`pod-collapsed-${pod.podName}`} style={{ background: "var(--subtle-bg, #f0ece4)" }}>
                        <td style={{ fontWeight: 700, fontSize: 13, borderRight: "1px solid var(--border)", paddingTop: 8, paddingBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {podToggleBtn(true)}
                            <span>{pod.podName}</span>
                          </div>
                        </td>
                        <td colSpan={2} style={{ fontStyle: "italic", color: "var(--subtle)", fontSize: 12, fontWeight: 600 }}>Total</td>
                        <td style={{ textAlign: "right", fontWeight: 700, fontSize: 12 }}>{pod.totalBeats}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, fontSize: 12 }}>{pod.totalAttempts}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, fontSize: 12 }}>{pod.totalSuccess}</td>
                        <td colSpan={2} />
                      </tr>
                    )];
                  }

                  const beatExtra = (writerName, beat) => {
                    const key = `${pod.podName}|${writerName}|${beat.showName}|${beat.beatName}`;
                    return expandedAngles[key] ? beat.ads.length + 1 : 0;
                  };
                  const podRowSpan = pod.writers.reduce((sum, w) =>
                    sum + w.shows.reduce((ws, sh) =>
                      ws + sh.beats.reduce((bs, b) => bs + 1 + beatExtra(w.writerName, b), 0), 0), 1
                  );

                  const rows = [];
                  let isFirstOfPod = true;

                  for (const writer of pod.writers) {
                    const writerRowSpan = writer.shows.reduce((sum, sh) =>
                      sum + sh.beats.reduce((s, b) => s + 1 + beatExtra(writer.writerName, b), 0), 0
                    );
                    let isFirstOfWriter = true;

                    for (const show of writer.shows) {
                      const showRowSpan = show.beats.reduce((s, b) => s + 1 + beatExtra(writer.writerName, b), 0);
                      let isFirstOfShow = true;

                      for (const beat of show.beats) {
                        const angleKey = `${pod.podName}|${writer.writerName}|${beat.showName}|${beat.beatName}`;
                        const isExpanded = Boolean(expandedAngles[angleKey]);

                        rows.push(
                          <tr
                            key={angleKey}
                            className={`overview-genai-parent-row${beat.successCount > 0 ? " overview-genai-success-row" : ""}`}
                            style={{ cursor: "pointer" }}
                            onClick={() => setExpandedAngles((prev) => ({ ...prev, [angleKey]: !prev[angleKey] }))}
                          >
                            {isFirstOfPod && (
                              <td rowSpan={podRowSpan} style={{ fontWeight: 700, verticalAlign: "top", fontSize: 13, paddingTop: 10, borderRight: "1px solid var(--border)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {podToggleBtn(false)}
                                  <span>{pod.podName}</span>
                                </div>
                              </td>
                            )}
                            {isFirstOfWriter && (
                              <td rowSpan={writerRowSpan} style={{ verticalAlign: "top", paddingTop: 10, fontSize: 12, color: "var(--fg)", borderRight: "1px solid var(--border)" }}>
                                {writer.writerName}
                              </td>
                            )}
                            {isFirstOfShow && (
                              <td rowSpan={showRowSpan} className="genai-show-name" style={{ verticalAlign: "top", paddingTop: 10 }}>
                                {show.showName}
                              </td>
                            )}
                            <td className="genai-beat-name">
                              <span>{beat.beatName || "-"}</span>
                              {beat.ftCount > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "#dcfce7", color: "#15803d" }}>FT</span>}
                              {beat.rwCount > 0 && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "#fef3c7", color: "#b45309" }}>RW</span>}
                            </td>
                            <td className="genai-num-cell" style={{ textAlign: "right" }}>{formatMetricValue(beat.attempts)}</td>
                            <td className="genai-num-cell" style={{ textAlign: "right" }}>
                              {beat.successCount > 0
                                ? <span className="genai-success-badge">{formatMetricValue(beat.successCount)}</span>
                                : <span className="genai-zero">0</span>}
                            </td>
                            <td className="genai-num-cell" style={{ textAlign: "right" }}>
                              <span className={`genai-hitrate${beat.hitRate != null ? (beat.hitRate >= 50 ? " is-high" : beat.hitRate >= 20 ? " is-mid" : " is-low") : ""}`}>
                                {beat.hitRate != null ? formatPercent(beat.hitRate) : "—"}
                              </span>
                            </td>
                            <td className="genai-chevron-cell">
                              <span className={`genai-chevron${isExpanded ? " is-open" : ""}`} />
                            </td>
                          </tr>
                        );

                        isFirstOfPod = false;
                        isFirstOfWriter = false;
                        isFirstOfShow = false;

                        if (isExpanded) {
                          rows.push(
                            <tr key={`${angleKey}-hdr`} className="overview-genai-expanded-hdr">
                              <td className="genai-col-asset" style={{ paddingLeft: 16 }}>Asset Code</td>
                              <td className="genai-col-metric">CPI</td>
                              <td className="genai-col-metric">True Comp</td>
                              <td className="genai-col-metric" style={{ fontSize: 10 }}>CTR · CTI</td>
                              <td />
                            </tr>
                          );
                          for (const ad of beat.ads) {
                            rows.push(
                              <tr key={`${angleKey}-${ad.assetCode}`} className={ad.success ? "overview-genai-expanded-row overview-genai-ad-success" : "overview-genai-expanded-row"}>
                                <td className="genai-asset-code-cell" style={{ paddingLeft: 16 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                    <span className="genai-asset-code">{ad.assetCode || "-"}</span>
                                    {ad.success && <span className="genai-hit-tag">HIT</span>}
                                  </div>
                                </td>
                                <td className="genai-metric-val">{ad.cpiUsd != null ? `$${ad.cpiUsd.toFixed(2)}` : "-"}</td>
                                <td className="genai-metric-val">{ad.absoluteCompletionPct != null ? formatPercent(ad.absoluteCompletionPct) : "-"}</td>
                                <td className="genai-metric-val" style={{ fontSize: 10 }}>
                                  {ad.ctrPct != null ? formatPercent(ad.ctrPct) : "-"}
                                  {" · "}
                                  {ad.clickToInstall != null ? formatPercent(ad.clickToInstall) : "-"}
                                </td>
                                <td />
                              </tr>
                            );
                          }
                        }
                      }
                    }
                  }

                  rows.push(
                    <tr key={`pod-total-${pod.podName}`} style={{ background: "var(--subtle-bg, #f0ece4)", borderTop: "2px solid var(--border)" }}>
                      <td colSpan={3} style={{ fontStyle: "italic", color: "var(--subtle)", fontSize: 12, fontWeight: 600 }}>Total</td>
                      <td style={{ textAlign: "right", fontWeight: 700, fontSize: 12 }}>{pod.totalAttempts}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, fontSize: 12 }}>{pod.totalSuccess}</td>
                      <td colSpan={2} />
                    </tr>
                  );

                  return rows;
                }) : (
                  <tr><td colSpan="8">No Full Gen AI rows for this filter yet.</td></tr>
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
      </>
    </section>
  );
}

export function DetailedOverviewTable({ rows = [], loading = false }) {
  const [expandedPods, setExpandedPods] = useState(new Set());
  const [page, setPage] = useState(0);

  const togglePod = (pod) =>
    setExpandedPods((prev) => {
      const next = new Set(prev);
      next.has(pod) ? next.delete(pod) : next.add(pod);
      return next;
    });

  // Group rows by POD
  const grouped = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const pod = row.podLeadName || "(No POD)";
      if (!map.has(pod)) map.set(pod, []);
      map.get(pod).push(row);
    }
    return Array.from(map.entries()).map(([pod, items]) => ({ pod, items }));
  }, [rows]);

  // Flatten for pagination (only expanded pods show writer rows)
  const flatRows = useMemo(() => {
    const result = [];
    for (const { pod, items } of grouped) {
      result.push({ type: "pod", pod, count: items.length });
      if (expandedPods.has(pod)) {
        for (const item of items) result.push({ type: "row", pod, item });
      }
    }
    return result;
  }, [grouped, expandedPods]);

  const totalPages = Math.ceil(flatRows.length / PAGE_SIZE);
  const pageRows = flatRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Detailed Overview</div>
      {loading ? (
        <div style={{ fontSize: 13, color: "var(--subtle)", padding: "12px 0" }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--subtle)", padding: "12px 0" }}>No records found for selected date range.</div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className="ops-table" style={{ width: "100%", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>POD</th>
                  <th>Writer</th>
                  <th>Show</th>
                  <th>Angle</th>
                  <th style={{ textAlign: "center" }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, idx) => {
                  if (r.type === "pod") {
                    const isOpen = expandedPods.has(r.pod);
                    return (
                      <tr key={`pod-${r.pod}-${idx}`}
                        onClick={() => togglePod(r.pod)}
                        style={{ cursor: "pointer", background: "var(--bg-surface)", userSelect: "none" }}
                      >
                        <td colSpan={5}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 12 }}>
                            <span style={{
                              width: 18, height: 18, borderRadius: "50%", border: "1.5px solid var(--accent)",
                              color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, lineHeight: 1, flexShrink: 0,
                            }}>{isOpen ? "−" : "+"}</span>
                            {r.pod}
                            <span style={{ fontWeight: 400, fontSize: 11, color: "var(--subtle)" }}>{r.count} entries</span>
                          </span>
                        </td>
                      </tr>
                    );
                  }
                  const { item } = r;
                  return (
                    <tr key={`row-${r.pod}-${idx}`}>
                      <td style={{ color: "var(--subtle)", fontSize: 11 }}></td>
                      <td style={{ fontSize: 12 }}>{item.writerName || "—"}</td>
                      <td style={{ fontSize: 12 }}>{item.showName || "—"}</td>
                      <td style={{ fontSize: 12 }}>{item.beatName || "—"}</td>
                      <td style={{ textAlign: "center" }}>
                        {item.reworkType ? <ReworkBadge value={item.reworkType} /> : <span style={{ color: "var(--subtle)", fontSize: 11 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
              <span style={{ fontSize: 11, color: "var(--subtle)" }}>
                Page {page + 1} of {totalPages} ({rows.length} total)
              </span>
              <button type="button" className="week-toggle-group" disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                style={{ opacity: page === 0 ? 0.4 : 1, cursor: page === 0 ? "default" : "pointer" }}>
                ‹ Prev
              </button>
              <button type="button" className="week-toggle-group" disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                style={{ opacity: page >= totalPages - 1 ? 0.4 : 1, cursor: page >= totalPages - 1 ? "default" : "pointer" }}>
                Next ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Reports View ─────────────────────────────────────────────────────────────

export function ReportsContent({
  detailRows = [],
  detailLoading = false,
  leadershipOverviewData = null,
  leadershipOverviewLoading = false,
  overviewData = null,
  overviewLoading = false,
}) {
  const allWorkflowRows = Array.isArray(leadershipOverviewData?.allWorkflowRows) ? leadershipOverviewData.allWorkflowRows : [];
  const allAnalyticsRows = Array.isArray(leadershipOverviewData?.allAnalyticsRows) ? leadershipOverviewData.allAnalyticsRows : [];
  const weekStart = swNormDate(overviewData?.weekStart);
  const weekEnd = swNormDate(overviewData?.weekEnd);
  const loading = leadershipOverviewLoading || overviewLoading;

  return (
    <div className="section-stack">
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Show Wise</div>
      <ShowWiseTable
        allWorkflowRows={allWorkflowRows}
        allAnalyticsRows={allAnalyticsRows}
        weekStart={weekStart}
        weekEnd={weekEnd}
        loading={loading}
      />
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function OverviewContent({
  overviewData,
  overviewLoading,
  overviewError,
  leadershipOverviewData,
  leadershipOverviewLoading,
  onShare,
  copyingSection,
  includeNewShowsPod,
  onIncludeNewShowsPodChange,
  detailRows = [],
  detailLoading = false,
}) {
  const notes = buildOverviewNotes({ overviewError, overviewData });
  const weekLabel = overviewData?.weekLabel || "";
  const selectionMode = String(overviewData?.selectionMode || "");
  const weekStart = swNormDate(overviewData?.weekStart);
  const weekEnd = swNormDate(overviewData?.weekEnd);
  const podThroughputRows = Array.isArray(leadershipOverviewData?.podThroughputRows) ? leadershipOverviewData.podThroughputRows : [];
  const editorialPodRows = Array.isArray(overviewData?.editorialPodRows) ? overviewData.editorialPodRows : [];
  const allBeatRows = Array.isArray(leadershipOverviewData?.allBeatRows) ? leadershipOverviewData.allBeatRows : [];
  const allWorkflowRows = Array.isArray(leadershipOverviewData?.allWorkflowRows) ? leadershipOverviewData.allWorkflowRows : [];
  const allAnalyticsRows = Array.isArray(leadershipOverviewData?.allAnalyticsRows) ? leadershipOverviewData.allAnalyticsRows : [];
  const podLoading = leadershipOverviewLoading || overviewLoading;

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

        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Lifecycle Overview</div>
        <BeatsSummaryCards leadershipOverviewData={leadershipOverviewData} loading={podLoading} />

        <hr className="section-divider" />

        <IdeationWeeklyTable
          allBeatRows={allBeatRows}
          weekStart={leadershipOverviewData?.weekStart || ""}
          weekEnd={leadershipOverviewData?.weekEnd || ""}
          loading={podLoading}
        />

        <hr className="section-divider" />

        <PodThroughputRankingTable rows={podThroughputRows} loading={podLoading} />
        <PodThroughputDetailTable rows={podThroughputRows} loading={podLoading} />

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

        <FullGenAiSection
          fullGenAiRows={Array.isArray(leadershipOverviewData?.fullGenAiRows) ? leadershipOverviewData.fullGenAiRows : []}
          fullGenAiSourceError={leadershipOverviewData?.fullGenAiSourceError || null}
          loading={podLoading}
        />

      </div>
    </ShareablePanel>
  );
}
