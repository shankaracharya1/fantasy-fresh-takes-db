"use client";
import { useState, useRef, Fragment } from "react";

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

function ZoomPreviewTable({
  zoomPercent = 100,
  onZoomChange,
  activeView = "editorial",
  onViewChange,
  totalBeats = 0,
  freshTakeCount = 0,
  productionTotal = 0,
  hitRate = null,
  tables = {},
}) {
  const pinchStateRef = useRef({ active: false, startDistance: 0, startZoom: 100 });
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [hoveredLinkedAdCode, setHoveredLinkedAdCode] = useState("");
  const [colWidths, setColWidths] = useState({});
  const resizingRef = useRef(null);

  const startColResize = (colKey, startX, startWidth) => {
    resizingRef.current = { colKey, startX, startWidth };
    const onMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const delta = clientX - resizingRef.current.startX;
      const newWidth = Math.max(40, resizingRef.current.startWidth + delta);
      setColWidths((prev) => ({ ...prev, [resizingRef.current.colKey]: newWidth }));
    };
    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  const safeZoom = Math.max(50, Math.min(200, Number(zoomPercent || 100)));
  const visibleTableKeys = ["editorial", "production", "live", "hit"];
  const baseColumns = ["Ad code", "POD", "Show", "Angle name"];
  const clampZoom = (value) => Math.max(50, Math.min(200, Number(value || 100)));
  const setZoom = (value) => onZoomChange?.(clampZoom(value));
  const normalizeAdCode = (value) => String(value || "").trim().toLowerCase();
  const isFreshTypeLabel = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "fresh take" || normalized === "fresh takes" || normalized.startsWith("new q1") || normalized === "ft";
  };
  const getCompactColumnStyle = (columnLabel, isHeader = false) => {
    const baseStyle = {
      padding: isHeader ? "4px 5px" : "3px 5px",
      fontSize: isHeader ? 9 : 10,
      whiteSpace: "nowrap",
      verticalAlign: "top",
    };
    if (columnLabel === "Ad code") {
      return { ...baseStyle, minWidth: 112, fontWeight: isHeader ? 700 : 600 };
    }
    if (columnLabel === "Angle name") {
      return { ...baseStyle, minWidth: 170 };
    }
    if (columnLabel === "Show") {
      return { ...baseStyle, minWidth: 118 };
    }
    if (columnLabel === "POD") {
      return { ...baseStyle, minWidth: 80 };
    }
    return baseStyle;
  };
  const toggleExpandedRow = (rowKey) => {
    setExpandedRows((previous) => {
      const next = new Set(previous);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };
  const touchDistance = (touches) => {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  return (
    <div style={{ marginTop: 16, width: "100%", minWidth: 0 }}>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          overflow: "hidden",
          background: "var(--card)",
          boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid var(--border)",
            background: "var(--subtle-bg, #f0ece4)",
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ marginLeft: 8, fontSize: 12, color: "var(--subtle)" }}>Preview window</span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="ghost-button" onClick={() => setZoom(safeZoom - 10)}>-</button>
            <div style={{ fontSize: 12, fontWeight: 700, minWidth: 52, textAlign: "center" }}>{safeZoom}%</div>
            <button type="button" className="ghost-button" onClick={() => setZoom(safeZoom + 10)}>+</button>
            <button type="button" className="ghost-button" onClick={() => setZoom(100)}>Reset</button>
          </div>
        </div>

        <div
          style={{
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: 560,
            minHeight: 460,
            padding: 16,
            touchAction: "pan-x pan-y",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
          }}
          onWheel={(event) => {
            // Trackpad pinch and Ctrl/Cmd + wheel zoom in browsers emit wheel events here.
            if (!(event.ctrlKey || event.metaKey)) return;
            event.preventDefault();
            const delta = event.deltaY < 0 ? 5 : -5;
            setZoom(safeZoom + delta);
          }}
          onTouchStart={(event) => {
            if (event.touches.length < 2) return;
            const dist = touchDistance(event.touches);
            if (!dist) return;
            pinchStateRef.current = {
              active: true,
              startDistance: dist,
              startZoom: safeZoom,
            };
          }}
          onTouchMove={(event) => {
            if (!pinchStateRef.current.active || event.touches.length < 2) return;
            const currentDistance = touchDistance(event.touches);
            if (!currentDistance || !pinchStateRef.current.startDistance) return;
            const ratio = currentDistance / pinchStateRef.current.startDistance;
            setZoom(pinchStateRef.current.startZoom * ratio);
          }}
          onTouchEnd={() => {
            if (pinchStateRef.current.active) {
              pinchStateRef.current = { active: false, startDistance: 0, startZoom: safeZoom };
            }
          }}
        >
            <div
              style={{
                display: "inline-block",
                width: "max-content",
                minWidth: "100%",
                transform: `scale(${safeZoom / 100})`,
                transformOrigin: "top left",
                transition: "transform 0.18s ease",
              }}
            >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 10, width: "max-content" }}>
              {visibleTableKeys.map((tableKey) => {
                const tableData = tables?.[tableKey] || { title: "Details", columns: [], rows: [] };
                const tableColumns = Array.isArray(tableData.columns) ? tableData.columns : [];
                const tableColumnCount = Math.max(1, tableColumns.length);
                const tableMinWidth = Math.max(500, tableColumnCount * 96);
                const tableHasCompactExpandable =
                  tableColumns.length > baseColumns.length &&
                  baseColumns.every((column) => tableColumns.includes(column));
                const tableBaseColumnIndexes = tableHasCompactExpandable
                  ? baseColumns.map((column) => tableColumns.indexOf(column)).filter((index) => index >= 0)
                  : [];
                const tableExtraColumnIndexes = tableHasCompactExpandable
                  ? tableColumns.map((_, index) => index).filter((index) => !tableBaseColumnIndexes.includes(index))
                  : [];
                const adCodeColumnIndex = tableColumns.indexOf("Ad code");
                const typeOfReworkColumnIndex = tableColumns.indexOf("Type of rework");

                return (
                  <div
                    key={`schema-table-${tableKey}`}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "var(--card)",
                      width: "max-content",
                      minWidth: 560,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        padding: "4px 6px",
                        borderBottom: "1px solid var(--border)",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                        color: "var(--subtle)",
                      }}
                    >
                      <div>{tableData.title}</div>
                      {tableKey === "editorial" && tableData?.summary ? (
                        <div style={{ marginTop: 3, fontSize: 10, fontWeight: 500, letterSpacing: 0, textTransform: "none", color: "var(--subtle)" }}>
                          {tableData.summary}
                        </div>
                      ) : null}
                    </div>
                    <table className="ops-table overview-table preview-grid-table" style={{ marginTop: 0, border: 0, width: "max-content", minWidth: tableMinWidth, fontSize: 10 }}>
                      <thead>
                        <tr>
                          {tableHasCompactExpandable ? (
                            <>
                              {baseColumns.map((column) => {
                                const colKey = `${tableKey}-${column}`;
                                const w = colWidths[colKey];
                                return (
                                  <th key={colKey} style={{ position: "relative", padding: "4px 6px", fontSize: 9, whiteSpace: "nowrap", ...(w ? { width: w, minWidth: w } : {}) }}>
                                    {column}
                                    <div
                                      onMouseDown={(e) => { e.preventDefault(); startColResize(colKey, e.clientX, e.currentTarget.parentElement.offsetWidth); }}
                                      style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", background: "transparent" }}
                                    />
                                  </th>
                                );
                              })}
                              <th style={{ textAlign: "center", width: 28, padding: "4px 4px", fontSize: 9 }}>+</th>
                            </>
                          ) : (
                            tableColumns.map((column) => {
                              const colKey = `${tableKey}-${column}`;
                              const w = colWidths[colKey];
                              return (
                                <th key={colKey} style={{ position: "relative", padding: "4px 6px", fontSize: 9, whiteSpace: "nowrap", ...(w ? { width: w, minWidth: w } : {}) }}>
                                  {column}
                                  <div
                                    onMouseDown={(e) => { e.preventDefault(); startColResize(colKey, e.clientX, e.currentTarget.parentElement.offsetWidth); }}
                                    style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", background: "transparent" }}
                                  />
                                </th>
                              );
                            })
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(tableData.rows) && tableData.rows.length > 0 ? (
                          tableData.rows.flatMap((row, rowIndex) => {
                            const rowKey = `${tableKey}-${rowIndex}`;
                            const isExpanded = expandedRows.has(rowKey);
                            const rowCells = Array.isArray(row) ? row : [];
                            const rowAdCode = adCodeColumnIndex >= 0 ? normalizeAdCode(rowCells[adCodeColumnIndex]) : "";
                            const rowTypeOfRework = typeOfReworkColumnIndex >= 0 ? String(rowCells[typeOfReworkColumnIndex] || "") : "";
                            const isEditorialFreshTakeRow = tableKey === "editorial" && isFreshTypeLabel(rowTypeOfRework);
                            const isLinkedHighlightTable = tableKey === "editorial" || tableKey === "production" || tableKey === "live";
                            const isLinkedMatch = Boolean(hoveredLinkedAdCode && rowAdCode && rowAdCode === hoveredLinkedAdCode);
                            const linkedRowStyle =
                              isLinkedHighlightTable && isLinkedMatch
                                ? { background: "rgba(45, 90, 61, 0.14)" }
                                : undefined;
                            if (!tableHasCompactExpandable) {
                              return (
                                <tr
                                  key={`${tableData.title}-row-${rowIndex}`}
                                  style={linkedRowStyle}
                                  onMouseEnter={() => {
                                    if (tableKey === "editorial" && isEditorialFreshTakeRow && rowAdCode) {
                                      setHoveredLinkedAdCode(rowAdCode);
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    if (tableKey === "editorial" && isEditorialFreshTakeRow) {
                                      setHoveredLinkedAdCode("");
                                    }
                                  }}
                                >
                                  {rowCells.map((cell, cellIndex) => (
                                    <td key={`${tableData.title}-row-${rowIndex}-cell-${cellIndex}`} style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>
                                      {cell == null || cell === "" ? "—" : String(cell)}
                                    </td>
                                  ))}
                                </tr>
                              );
                            }

                            const summaryTr = (
                              <tr
                                key={`${tableData.title}-row-${rowIndex}`}
                                style={linkedRowStyle}
                                onMouseEnter={() => {
                                  if (tableKey === "editorial" && isEditorialFreshTakeRow && rowAdCode) {
                                    setHoveredLinkedAdCode(rowAdCode);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (tableKey === "editorial" && isEditorialFreshTakeRow) {
                                    setHoveredLinkedAdCode("");
                                  }
                                }}
                              >
                                {tableBaseColumnIndexes.map((columnIndex) => (
                                  <td key={`${tableData.title}-row-${rowIndex}-base-${columnIndex}`} style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>
                                    {rowCells[columnIndex] == null || rowCells[columnIndex] === "" ? "—" : String(rowCells[columnIndex])}
                                  </td>
                                ))}
                                <td style={{ textAlign: "center", padding: "4px 4px" }}>
                                  <button
                                    type="button"
                                    className="ghost-button"
                                    onClick={() => toggleExpandedRow(rowKey)}
                                    style={{ minWidth: 20, padding: "0 5px", lineHeight: 1, fontSize: 10 }}
                                    aria-expanded={isExpanded}
                                  >
                                    {isExpanded ? "−" : "+"}
                                  </button>
                                </td>
                              </tr>
                            );

                            if (!isExpanded) return [summaryTr];

                            const detailTr = (
                              <tr key={`${tableData.title}-row-${rowIndex}-details`} style={{ background: "var(--bg-deep, #f7f4ef)" }}>
                              <td colSpan={baseColumns.length + 1} style={{ padding: 8 }}>
                                <div style={{ display: "grid", gap: 4 }}>
                                  {tableExtraColumnIndexes.map((columnIndex) => (
                                      <div key={`${tableData.title}-row-${rowIndex}-detail-${columnIndex}`} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 170px) 1fr", columnGap: 6, fontSize: 10 }}>
                                        <span style={{ color: "var(--subtle)", fontWeight: 600 }}>{tableColumns[columnIndex]}</span>
                                        <span>{rowCells[columnIndex] == null || rowCells[columnIndex] === "" ? "—" : String(rowCells[columnIndex])}</span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );

                            return [summaryTr, detailTr];
                          })
                        ) : (
                          <tr>
                            <td colSpan={tableHasCompactExpandable ? baseColumns.length + 1 : Math.max(1, tableColumns.length)} style={{ color: "var(--subtle)" }}>
                              No rows for selected date range.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--subtle)" }}>
              Tip: use Ctrl/⌘ + scroll (or pinch on touch devices) to zoom.
            </div>
          </div>
        </div>
      </div>
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

function isFreshTakeType(value) {
  const rt = String(value || "").trim().toLowerCase();
  return rt === "fresh take" || rt === "fresh takes";
}

function getWorkflowAssetKey(row) {
  return (
    String(row?.assetCode || "").trim().toLowerCase() ||
    `${String(row?.showName || "").trim().toLowerCase()}|${String(row?.beatName || "").trim().toLowerCase()}`
  );
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

  // Fresh Take cohort:
  // 1) pick assets with Fresh Take + Date submitted by Lead in selected range
  // 2) for those assets, compute current highest stage across workflow
  const stageSources = new Set(["editorial", "ready_for_production", "production", "live"]);
  const workflowStageRows = allWorkflowRows.filter((row) => stageSources.has(row?.source));
  const cohortAssetKeys = new Set(
    workflowStageRows
      .filter((row) => isDateInSelectedRange(normalizeDateOnly(row?.leadSubmittedDate), weekStart, weekEnd))
      .filter((row) => isFreshTakeType(row?.reworkType))
      .map((row) => getWorkflowAssetKey(row))
      .filter(Boolean)
  );
  const stagePriority = {
    editorial: 1,
    ready_for_production: 2,
    production: 3,
    live: 4,
  };
  const stageByAsset = new Map();
  for (const row of workflowStageRows) {
    const key = getWorkflowAssetKey(row);
    if (!key || !cohortAssetKeys.has(key)) continue;
    const stage = String(row?.source || "");
    if (!stagePriority[stage]) continue;
    const current = stageByAsset.get(key);
    if (!current || stagePriority[stage] > stagePriority[current]) {
      stageByAsset.set(key, stage);
    }
  }
  const ftBreakdown = { editorial: 0, readyForProduction: 0, production: 0, live: 0 };
  for (const stage of stageByAsset.values()) {
    if (stage === "ready_for_production") ftBreakdown.readyForProduction += 1;
    else if (stage === "production") ftBreakdown.production += 1;
    else if (stage === "live") ftBreakdown.live += 1;
    else ftBreakdown.editorial += 1;
  }
  const freshTakeCount = cohortAssetKeys.size;

  const podLoading = leadershipOverviewLoading || overviewLoading;

  const [progressView, setProgressView] = useState("pod");
  const [hoveredProgressKey, setHoveredProgressKey] = useState(null);
  const [editorialZoomPercent, setEditorialZoomPercent] = useState(100);
  const [editorialSchemaView, setEditorialSchemaView] = useState("editorial");

  const weekWorkflowRows = workflowStageRows.filter((row) =>
    isDateInSelectedRange(normalizeDateOnly(row?.leadSubmittedDate), weekStart, weekEnd)
  );
  const weekEditorialRows = weekWorkflowRows.filter((r) => r.source === "editorial");
  const weekReadyProdRows = weekWorkflowRows.filter((r) => r.source === "ready_for_production" || r.source === "production");
  const weekProductionOnlyRows = weekWorkflowRows.filter((r) => r.source === "production");
  const weekLiveRows = weekWorkflowRows.filter((r) => r.source === "live");
  const allAnalyticsRows = Array.isArray(leadershipOverviewData?.allAnalyticsRows) ? leadershipOverviewData.allAnalyticsRows : [];

  const normalizeCell = (value) => {
    if (value == null) return "";
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
    return String(value).trim();
  };
  const codeKey = (value) => normalizeCell(value).toLowerCase();
  const uniqueCodeSetFromRows = (rows) =>
    new Set(
      (Array.isArray(rows) ? rows : [])
        .map((row) => codeKey(row?.assetCode))
        .filter(Boolean)
    );
  const editorialFreshTakeRows = weekEditorialRows.filter((row) => isFreshTakeType(row?.reworkType) && codeKey(row?.assetCode));
  const editorialFreshTakeCodeSet = uniqueCodeSetFromRows(editorialFreshTakeRows);
  const productionCodeSet = uniqueCodeSetFromRows(weekProductionOnlyRows);
  const liveCodeSet = uniqueCodeSetFromRows(weekLiveRows);
  const editorialFreshTakeInProductionCount = Array.from(editorialFreshTakeCodeSet).filter((code) => productionCodeSet.has(code)).length;
  const editorialFreshTakeInLiveCount = Array.from(editorialFreshTakeCodeSet).filter((code) => liveCodeSet.has(code)).length;

  const analyticsByAssetCode = new Map();
  for (const row of allAnalyticsRows) {
    const key = codeKey(row?.assetCode);
    if (key && !analyticsByAssetCode.has(key)) {
      analyticsByAssetCode.set(key, row);
    }
  }

  const hitRateRows = weekLiveRows.map((liveRow) => {
    const analytics = analyticsByAssetCode.get(codeKey(liveRow?.assetCode));
    const amountSpent = Number(analytics?.amountSpentUsd);
    const q1Completion = Number(analytics?.video0To25Pct);
    const cti = Number(analytics?.clickToInstall);
    const trueCompletion = Number(analytics?.absoluteCompletionPct);
    const cpi = Number(analytics?.cpiUsd);
    const isSuccess =
      Number.isFinite(amountSpent) && amountSpent >= 100 &&
      Number.isFinite(q1Completion) && q1Completion > 10 &&
      Number.isFinite(cti) && cti >= 12 &&
      Number.isFinite(trueCompletion) && trueCompletion >= 1.8 &&
      Number.isFinite(cpi) && cpi <= 12;

    return [
      normalizeCell(liveRow?.assetCode),
      normalizeCell(liveRow?.podLeadName),
      normalizeCell(liveRow?.writerName),
      normalizeCell(liveRow?.showName),
      normalizeCell(liveRow?.beatName),
      normalizeCell(liveRow?.reworkType),
      normalizeCell(liveRow?.leadSubmittedDate),
      Number.isFinite(amountSpent) ? amountSpent : "",
      Number.isFinite(q1Completion) ? q1Completion : "",
      Number.isFinite(cti) ? cti : "",
      Number.isFinite(trueCompletion) ? trueCompletion : "",
      Number.isFinite(cpi) ? cpi : "",
      analytics ? (isSuccess ? "Success" : "Not hit") : "No analytics",
    ];
  });

  const schemaTables = {
    editorial: {
      title: "1. Fresh take / Editorial",
      summary: `Fresh Take between dates: ${editorialFreshTakeCodeSet.size} · In Production: ${editorialFreshTakeInProductionCount} · In Live: ${editorialFreshTakeInLiveCount}`,
      columns: ["Ad code", "POD", "Writer", "Show", "Angle name", "Type of rework", "Script status", "Date submitted by Lead"],
      rows: editorialFreshTakeRows.map((row) => [
        normalizeCell(row?.assetCode),
        normalizeCell(row?.podLeadName),
        normalizeCell(row?.writerName),
        normalizeCell(row?.showName),
        normalizeCell(row?.beatName),
        normalizeCell(row?.reworkType),
        normalizeCell(row?.scriptStatus),
        normalizeCell(row?.leadSubmittedDate),
      ]),
    },
    production: {
      title: "2. Production (Ready for Production + Production)",
      columns: [
        "Ad code",
        "POD",
        "Writer",
        "Show",
        "Angle name",
        "Type of rework",
        "Script status",
        "Date submitted by Lead",
        "Status",
        "ETA to start prod",
        "ETA for promo completion",
        "CD",
        "Final Upload Date",
      ],
      rows: weekReadyProdRows.map((row) => [
        normalizeCell(row?.assetCode),
        normalizeCell(row?.podLeadName),
        normalizeCell(row?.writerName),
        normalizeCell(row?.showName),
        normalizeCell(row?.beatName),
        normalizeCell(row?.reworkType),
        normalizeCell(row?.scriptStatus),
        normalizeCell(row?.leadSubmittedDate),
        normalizeCell(row?.status),
        normalizeCell(row?.etaToStartProd),
        normalizeCell(row?.etaPromoCompletion),
        normalizeCell(row?.cdName),
        normalizeCell(row?.finalUploadDate),
      ]),
    },
    live: {
      title: "3. Live",
      columns: [
        "Ad code",
        "POD",
        "Writer",
        "Show",
        "Angle name",
        "Type of rework",
        "Script status",
        "Date submitted by Lead",
        "Status",
        "ETA to start prod",
        "ETA for promo completion",
        "CD",
        "Final Upload Date",
        "Cost per App Install (USD)",
        "3 Sec Play",
        "ThruPlays",
        "Q1/ thruplays",
        "Video - 0% - 25%",
        "Q1",
        "Video - 25% - 50%",
        "Video - 50% - 75%",
        "Video - 75% - 95%",
        "Video - 0% - 95%",
        "Thruplay/3s",
        "Completions/ Impressions",
        "Q4/Q1",
        "CPM (cost per 1,000 impressions) (USD)",
        "CTR (link click-through rate)",
        "Amount spent (USD)",
        "Outbound Clicks to Completion",
        "Reach",
        "Impressions",
        "Click to Install",
        "CTR*CTI",
        "App Installs",
      ],
      rows: weekLiveRows.map((row) => {
        const analytics = analyticsByAssetCode.get(codeKey(row?.assetCode));
        return [
          normalizeCell(row?.assetCode),
          normalizeCell(row?.podLeadName),
          normalizeCell(row?.writerName),
          normalizeCell(row?.showName),
          normalizeCell(row?.beatName),
          normalizeCell(row?.reworkType),
          normalizeCell(row?.scriptStatus),
          normalizeCell(row?.leadSubmittedDate),
          normalizeCell(row?.status),
          normalizeCell(row?.etaToStartProd),
          normalizeCell(row?.etaPromoCompletion),
          normalizeCell(row?.cdName),
          normalizeCell(row?.finalUploadDate),
          normalizeCell(row?.cpiUsd || analytics?.cpiUsd),
          normalizeCell(row?.threeSecPlayPct || analytics?.threeSecPlayPct),
          normalizeCell(row?.thruPlaysPct || analytics?.thruPlaysPct),
          normalizeCell(row?.q1ToThruplays || analytics?.q1ToThruplays),
          normalizeCell(row?.video0To25Pct || analytics?.video0To25Pct),
          normalizeCell(row?.q1 || analytics?.q1),
          normalizeCell(row?.video25To50Pct || analytics?.video25To50Pct),
          normalizeCell(row?.video50To75Pct || analytics?.video50To75Pct),
          normalizeCell(row?.video75To95Pct || analytics?.video75To95Pct),
          normalizeCell(row?.video0To95Pct || analytics?.video0To95Pct),
          normalizeCell(row?.thruPlayTo3sRatio || analytics?.thruPlayTo3sRatio),
          normalizeCell(row?.absoluteCompletionPct || analytics?.absoluteCompletionPct),
          normalizeCell(row?.q4ToQ1 || analytics?.q4ToQ1),
          normalizeCell(row?.cpmUsd || analytics?.cpmUsd),
          normalizeCell(row?.ctrPct || analytics?.ctrPct),
          normalizeCell(row?.amountSpentUsd || analytics?.amountSpentUsd),
          normalizeCell(row?.outboundClicksToCompletionPct || analytics?.outboundClicksToCompletionPct),
          normalizeCell(row?.reach || analytics?.reach),
          normalizeCell(row?.impressions || analytics?.impressions),
          normalizeCell(row?.clickToInstall || analytics?.clickToInstall),
          normalizeCell(row?.ctrTimesCti || analytics?.ctrTimesCti),
          normalizeCell(row?.appInstalls || analytics?.appInstalls),
        ];
      }),
    },
    hit: {
      title: "4. Hit rate",
      columns: [
        "Ad code",
        "POD",
        "Writer",
        "Show",
        "Angle name",
        "Type of rework",
        "Date submitted by Lead",
        "Amount Spent",
        "Q1 Completion",
        "CTI",
        "True Completion",
        "CPI",
        "Result",
      ],
      rows: hitRateRows,
    },
  };
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
          <div
            onClick={() => setEditorialSchemaView("editorial")}
            style={{
              cursor: "pointer",
              borderRadius: 14,
              boxShadow: editorialSchemaView === "editorial" ? "0 0 0 1px var(--terracotta), 0 6px 18px rgba(247,118,44,0.14)" : "none",
              transition: "box-shadow 0.2s ease",
            }}
          >
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
          </div>
          <div
            onClick={() => setEditorialSchemaView("editorial")}
            style={{
              cursor: "pointer",
              borderRadius: 14,
              boxShadow: editorialSchemaView === "editorial" ? "0 0 0 1px var(--terracotta), 0 6px 18px rgba(247,118,44,0.14)" : "none",
              transition: "box-shadow 0.2s ease",
            }}
          >
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
          </div>
          <div
            onClick={() => setEditorialSchemaView("production")}
            style={{
              cursor: "pointer",
              borderRadius: 14,
              boxShadow: editorialSchemaView === "production" ? "0 0 0 1px var(--terracotta), 0 6px 18px rgba(247,118,44,0.14)" : "none",
              transition: "box-shadow 0.2s ease",
            }}
          >
            <MetricCard
              label="Production"
              body={
                <>
                  <div className="metric-value">{podLoading ? "..." : formatMetricValue(freshTakeCount)}</div>
                  {!podLoading && freshTakeCount > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <MiniBar label="Editorial"            value={ftBreakdown.editorial}          total={freshTakeCount} color="var(--terracotta)" />
                      <MiniBar label="Ready for Production" value={ftBreakdown.readyForProduction} total={freshTakeCount} color="var(--forest)" />
                      <MiniBar label="Production"           value={ftBreakdown.production}         total={freshTakeCount} color="#3f8f83" />
                      <MiniBar label="Live"                 value={ftBreakdown.live}               total={freshTakeCount} color="var(--red)" />
                    </div>
                  )}
                  {!podLoading && (
                    <div style={{ fontSize: 11, color: "var(--subtle)", marginTop: 8 }}>
                      Fresh Take cohort by current stage
                    </div>
                  )}
                </>
              }
            />
          </div>
          <div
            onClick={() => setEditorialSchemaView("hit")}
            style={{
              cursor: "pointer",
              borderRadius: 14,
              boxShadow: editorialSchemaView === "hit" ? "0 0 0 1px var(--terracotta), 0 6px 18px rgba(247,118,44,0.14)" : "none",
              transition: "box-shadow 0.2s ease",
            }}
          >
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
        </div>

        <ZoomPreviewTable
          zoomPercent={editorialZoomPercent}
          onZoomChange={setEditorialZoomPercent}
          activeView={editorialSchemaView}
          onViewChange={setEditorialSchemaView}
          totalBeats={totalBeats}
          freshTakeCount={freshTakeCount}
          productionTotal={Number(ftBreakdown?.readyForProduction || 0) + Number(ftBreakdown?.production || 0) + Number(ftBreakdown?.live || 0)}
          hitRate={overviewData?.hitRate}
          tables={schemaTables}
        />

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

        <hr className="section-divider" />

        <div className="panel-card">
          <div className="overview-table-toolbar" style={{ marginBottom: 10 }}>
            <div className="overview-table-toolbar-left">
              <div className="overview-table-toolbar-title">Fresh Take Cohort (Selected Range)</div>
              <div className="overview-table-toolbar-note">
                Cohort = Fresh Take assets where Date submitted by Lead is in selected range, then grouped by current highest stage.
              </div>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <MiniBar label="Editorial" value={ftBreakdown.editorial} total={freshTakeCount || 1} color="var(--terracotta)" />
            <MiniBar label="Ready for Production" value={ftBreakdown.readyForProduction} total={freshTakeCount || 1} color="var(--forest)" />
            <MiniBar label="Production" value={ftBreakdown.production} total={freshTakeCount || 1} color="#3f8f83" />
            <MiniBar label="Live" value={ftBreakdown.live} total={freshTakeCount || 1} color="var(--red)" />
          </div>
          <div style={{ fontSize: 12, color: "var(--subtle)", marginTop: 8 }}>
            Total cohort assets: {podLoading ? "..." : formatMetricValue(freshTakeCount)}
          </div>
        </div>
      </div>
    </ShareablePanel>
  );
}
