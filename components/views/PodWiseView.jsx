"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  EmptyState,
  ShareablePanel,
  formatMetricValue,
} from "./shared.jsx";

// ─── Private components ───────────────────────────────────────────────────────

const POD_LINE_COLORS = [
  "#2d5a3d", "#c2703e", "#2563eb", "#9333ea", "#d97706",
  "#0891b2", "#be185d", "#16a34a", "#7c3aed", "#dc2626",
];

// Build a smooth cubic-bezier path through an array of {x,y} points (with null gaps)
function buildSmoothedPath(points) {
  const segments = [];
  let seg = [];
  for (const pt of points) {
    if (pt) { seg.push(pt); }
    else if (seg.length) { segments.push(seg); seg = []; }
  }
  if (seg.length) segments.push(seg);
  return segments.map((s) => {
    if (s.length === 1) return `M ${s[0].x} ${s[0].y}`;
    let d = `M ${s[0].x} ${s[0].y}`;
    for (let i = 1; i < s.length; i++) {
      const cpx = (s[i - 1].x + s[i].x) / 2;
      d += ` C ${cpx},${s[i - 1].y} ${cpx},${s[i].y} ${s[i].x},${s[i].y}`;
    }
    return d;
  }).join(" ");
}

function buildSmoothedAreaPath(points, chartH) {
  const segments = [];
  let seg = [];
  for (const pt of points) {
    if (pt) { seg.push(pt); }
    else if (seg.length) { segments.push(seg); seg = []; }
  }
  if (seg.length) segments.push(seg);
  return segments.map((s) => {
    if (s.length === 0) return "";
    let d = `M ${s[0].x} ${s[0].y}`;
    for (let i = 1; i < s.length; i++) {
      const cpx = (s[i - 1].x + s[i].x) / 2;
      d += ` C ${cpx},${s[i - 1].y} ${cpx},${s[i].y} ${s[i].x},${s[i].y}`;
    }
    d += ` L ${s[s.length - 1].x},${chartH} L ${s[0].x},${chartH} Z`;
    return d;
  }).join(" ");
}

function HitRateTrendChart({ trendData, loading }) {
  const [granularity, setGranularity] = useState("week");
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const containerRef = useRef(null);
  const [containerW, setContainerW] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Measure synchronously before first paint so viewBox matches actual width
    const initial = Math.floor(el.getBoundingClientRect().width);
    if (initial > 0) setContainerW(initial);
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setContainerW(Math.floor(entry.contentRect.width) || initial || 720);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const allWeeks = trendData?.weeks || [];
  // Week: last 4 weeks excluding 2 most recent
  const slicedWeeks = allWeeks.length >= 2
    ? allWeeks.slice(Math.max(0, allWeeks.length - 6), allWeeks.length - 2)
    : [];
  // Lifetime: all weeks since Mar 16 (no slicing)
  const series = granularity === "week"
    ? slicedWeeks
    : granularity === "month"
    ? (trendData?.months || [])
    : allWeeks;
  const podNames = trendData?.podNames || [];
  const activePods = podNames.filter((pod) => series.some((pt) => pod in pt.pods));

  const H = 225;
  const PAD = { top: 16, right: 20, bottom: 36, left: 42 };
  const W = Math.max(containerW, 280);
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const xStep = series.length > 1 ? chartW / (series.length - 1) : chartW / 2;
  const yScale = (val) => chartH - (val / 100) * chartH;
  const yTicks = [0, 25, 50, 75, 100];

  const xLabel = (i) => {
    const pt = series[i];
    if ((granularity === "week" || granularity === "lifetime") && pt?.weekKey) {
      const parts = pt.weekKey.split("-").map(Number);
      const m = parts[1];
      const d = parts[2];
      const monthAbbr = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1];
      const weekNum = Math.floor((d - 1) / 7) + 1;
      return `${monthAbbr} W${weekNum}`;
    }
    if (pt?.monthLabel) return pt.monthLabel.slice(0, 3);
    return pt?.monthKey?.slice(5) || "";
  };
  const labelEvery = series.length <= 10 ? 1 : series.length <= 20 ? 2 : Math.ceil(series.length / 10);

  const handleSvgMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W - PAD.left;
    const idx = Math.max(0, Math.min(series.length - 1, Math.round(mouseX / xStep)));
    setHoveredIdx(idx);
  };

  // Tooltip positioning (% from left of container)
  const tooltipLeftPx = hoveredIdx !== null
    ? ((hoveredIdx * xStep + PAD.left) / W) * containerW
    : 0;
  const tooltipData = hoveredIdx !== null ? series[hoveredIdx] : null;
  const tooltipRows = activePods
    .map((pod, i) => ({
      pod,
      color: POD_LINE_COLORS[i % POD_LINE_COLORS.length],
      val: tooltipData?.pods[pod]?.hitRate,
      totalLive: tooltipData?.pods[pod]?.totalLive,
      hits: tooltipData?.pods[pod]?.hits,
    }))
    .filter((r) => r.val !== undefined)
    .sort((a, b) => b.val - a.val);

  return (
    <div style={{ marginTop: 32 }}>
      {/* Header + toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>Hit Rate Trend by POD</div>
        <div className="week-toggle-group">
          {[{ id: "week", label: "Week" }, { id: "month", label: "Month" }].map((opt) => (
            <button key={opt.id} type="button"
              className={granularity === opt.id ? "is-active" : ""}
              onClick={() => setGranularity(opt.id)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* containerRef div always rendered so useLayoutEffect can measure it */}
      <div ref={containerRef} style={{ position: "relative", userSelect: "none", width: "100%", height: H }}>
      {loading ? (
        <div style={{ color: "var(--subtle)", fontSize: 13, padding: "16px 0" }}>Loading trend data…</div>
      ) : activePods.length === 0 || series.length === 0 ? (
        <div style={{ color: "var(--subtle)", fontSize: 13, padding: "16px 0" }}>No trend data available yet.</div>
      ) : containerW === 0 ? null : (
        <>
          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginBottom: 14 }}>
            {activePods.map((pod, i) => (
              <span key={pod} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink)" }}>
                <span style={{ width: 24, height: 3, background: POD_LINE_COLORS[i % POD_LINE_COLORS.length], borderRadius: 99, display: "inline-block" }} />
                {pod}
              </span>
            ))}
          </div>

          {/* SVG fills the containerRef div */}
          <div style={{ position: "relative", width: "100%", height: H }}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              height="100%"
              style={{ display: "block", overflow: "visible" }}
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <defs>
                <style>{`
                  @keyframes fadeRiseUp {
                    0%   { transform: translateY(22px); opacity: 0; }
                    60%  { opacity: 1; }
                    100% { transform: translateY(0px);  opacity: 1; }
                  }
                  @keyframes fadeRiseArea {
                    0%   { transform: translateY(14px); opacity: 0; }
                    100% { transform: translateY(0px);  opacity: 1; }
                  }
                `}</style>
                {activePods.map((pod, pi) => {
                  const color = POD_LINE_COLORS[pi % POD_LINE_COLORS.length];
                  return (
                    <linearGradient key={pod} id={`pod-grad-${pi}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
                      <stop offset="55%"  stopColor={color} stopOpacity="0.08" />
                      <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                  );
                })}
              </defs>

              <g transform={`translate(${PAD.left},${PAD.top})`}>
                {/* Chart background */}
                <rect x={0} y={0} width={chartW} height={chartH} fill="var(--card)" fillOpacity="1" rx={4} />

                {/* Horizontal grid lines + Y labels — ghost thin */}
                {yTicks.map((tick) => (
                  <g key={tick}>
                    <line x1={0} x2={chartW} y1={yScale(tick)} y2={yScale(tick)}
                      stroke={tick === 0 ? "var(--border-strong)" : "var(--line)"} strokeWidth={0.5}
                      strokeDasharray={tick === 0 ? "none" : "4 6"} strokeOpacity={0.6} />
                    <text x={-8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle"
                      fontSize={8.5} fill="var(--subtle)" fontWeight="400">{tick}%</text>
                  </g>
                ))}

                {/* X labels only — no vertical grid lines */}
                {series.map((_, i) => {
                  const x = i * xStep;
                  const showLabel = i % labelEvery === 0;
                  return showLabel ? (
                    <text key={i} x={x} y={chartH + 13} textAnchor="middle"
                      fontSize={8.5} fill="var(--subtle)" fontWeight="400">
                      {xLabel(i)}
                    </text>
                  ) : null;
                })}

                {/* Hover crosshair */}
                {hoveredIdx !== null && (
                  <line
                    x1={hoveredIdx * xStep} x2={hoveredIdx * xStep}
                    y1={0} y2={chartH}
                    stroke="var(--ink)" strokeWidth={1} strokeOpacity={0.18}
                    strokeDasharray="3 3"
                    style={{ pointerEvents: "none" }}
                  />
                )}

                {/* Area fills — very subtle, fade in after lines draw */}
                {activePods.map((pod, pi) => {
                  const points = series.map((pt, i) => {
                    const val = pt.pods[pod]?.hitRate;
                    return val !== undefined ? { x: i * xStep, y: yScale(val) } : null;
                  });
                  const areaD = buildSmoothedAreaPath(points, chartH);
                  const delay = `${0.3 + pi * 0.08}s`;
                  return areaD ? (
                    <path key={`${pod}-${granularity}-area`} d={areaD}
                      fill={`url(#pod-grad-${pi})`}
                      className="pod-trend-area"
                      style={{
                        pointerEvents: "none",
                        opacity: 0,
                        animation: `fadeRiseArea 0.7s cubic-bezier(0.22,1,0.36,1) ${delay} forwards`,
                      }} />
                  ) : null;
                })}

                {/* Lines — draw-in animation, staggered per POD */}
                {activePods.map((pod, pi) => {
                  const color = POD_LINE_COLORS[pi % POD_LINE_COLORS.length];
                  const points = series.map((pt, i) => {
                    const val = pt.pods[pod]?.hitRate;
                    return val !== undefined ? { x: i * xStep, y: yScale(val), val } : null;
                  });
                  const lineD = buildSmoothedPath(points);
                  const delay = `${pi * 0.08}s`;
                  return lineD ? (
                    <path key={`${pod}-${granularity}-line`} d={lineD}
                      fill="none" stroke={color} strokeWidth={1}
                      strokeLinejoin="round" strokeLinecap="round"
                      style={{
                        pointerEvents: "none",
                        opacity: 0,
                        animation: `fadeRiseUp 0.75s cubic-bezier(0.22,1,0.36,1) ${delay} forwards`,
                      }} />
                  ) : null;
                })}

                {/* Dots — outer <g> positions, inner <g> animates scale so CSS doesn't clobber SVG translate */}
                {activePods.map((pod, pi) => {
                  const color = POD_LINE_COLORS[pi % POD_LINE_COLORS.length];
                  const lineDelay = pi * 0.08;
                  return series.map((pt, i) => {
                    const val = pt.pods[pod]?.hitRate;
                    if (val === undefined) return null;
                    const isHovered = hoveredIdx === i;
                    const cx = i * xStep;
                    const cy = yScale(val);
                    return (
                      <g
                        key={`${pod}-${granularity}-dot-${i}`}
                        transform={`translate(${cx},${cy})`}
                        style={{ pointerEvents: "none" }}
                      >
                        {/* Glow ring — blurred circle, fades in slowly, never sudden */}
                        <circle
                          cx={0} cy={0} r={9}
                          fill={color}
                          style={{
                            filter: "blur(5px)",
                            opacity: isHovered ? 0.28 : 0,
                            transition: "opacity 0.55s ease",
                          }}
                        />
                        {/* Outline dot — card-colored fill (adapts dark/light), colored ring */}
                        <circle
                          cx={0} cy={0}
                          r={isHovered ? 4.5 : 2.5}
                          fill="var(--card)"
                          stroke={color}
                          strokeWidth={isHovered ? 1.8 : 1}
                          style={{
                            transition: "r 0.3s cubic-bezier(0.34,1.56,0.64,1), stroke-width 0.3s ease",
                          }}
                        />
                      </g>
                    );
                  });
                })}
              </g>
            </svg>

            {/* HTML tooltip — shows all PODs at hovered column */}
            {hoveredIdx !== null && tooltipRows.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: tooltipLeftPx,
                  transform: tooltipLeftPx > containerW * 0.65
                    ? "translateX(calc(-100% - 8px))"
                    : "translateX(10px)",
                  pointerEvents: "none",
                  zIndex: 10,
                  background: "white",
                  border: "1px solid #e0d8d0",
                  borderRadius: 10,
                  boxShadow: "0 8px 24px -8px rgba(23,34,47,0.22), 0 2px 8px -2px rgba(23,34,47,0.10)",
                  padding: "10px 14px",
                  minWidth: 200,
                  animation: "fadeInTooltip 0.12s ease",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#5a4f46", marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {xLabel(hoveredIdx)}
                  {granularity === "week" && series[hoveredIdx]?.weekLabel
                    ? <span style={{ fontWeight: 400, marginLeft: 4, textTransform: "none", letterSpacing: 0 }}>— {series[hoveredIdx].weekLabel}</span>
                    : null}
                </div>
                {/* Column headers */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, paddingBottom: 4, borderBottom: "1px solid #ede8e2" }}>
                  <span style={{ fontSize: 10, color: "transparent", flex: 1 }}>·</span>
                  <span style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#9a8e84", width: 28, textAlign: "right" }}>FTs</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#9a8e84", width: 28, textAlign: "right" }}>Hits</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#9a8e84", width: 32, textAlign: "right" }}>Hit%</span>
                  </span>
                </div>
                {tooltipRows.map((r) => (
                  <div key={r.pod} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4, fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0, display: "inline-block" }} />
                      <span style={{ color: "#2d2420" }}>{r.pod}</span>
                    </span>
                    <span style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontWeight: 600, color: "#2d2420", width: 28, textAlign: "right" }}>{r.totalLive ?? "—"}</span>
                      <span style={{ fontWeight: 600, color: "#2d5a3d", width: 28, textAlign: "right" }}>{r.hits ?? "—"}</span>
                      <span style={{ fontWeight: 700, color: r.color, width: 32, textAlign: "right" }}>{r.val}%</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

const POD_TIER_GREEN_MIN = 35;
const POD_TIER_AMBER_MIN = 20;

function getPodTierColor(conversionRate) {
  if (conversionRate >= POD_TIER_GREEN_MIN) return "#2d5a3d";
  if (conversionRate >= POD_TIER_AMBER_MIN) return "#c2703e";
  return "#9f2e2e";
}

function PodFunnelBar({ label, value, maxValue, color }) {
  const pct = maxValue > 0 ? Math.max((value / maxValue) * 100, 2) : 0;
  return (
    <div className="pod-funnel-row">
      <span className="pod-funnel-label">{label}</span>
      <div className="pod-funnel-track">
        <div className="pod-funnel-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="pod-funnel-count">{value}</span>
    </div>
  );
}

// ─── PodTasksBarChart and PodTasksContent ────────────────────────────────────

function PodTasksBarChart({ title, subtitle, items, maxValue, accentColor }) {
  if (items.length === 0) {
    return (
      <>
        <div className="pod-section-header">
          <span className="pod-section-title">{title}</span>
          <span className="pod-section-subtitle">{subtitle}</span>
        </div>
        <EmptyState text={`No ${title.toLowerCase()} right now.`} />
      </>
    );
  }

  return (
    <>
      <div className="pod-section-header">
        <span className="pod-section-title">{title}</span>
        <span className="pod-section-subtitle">{subtitle}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => {
          const isMax = i === 0;
          const barColor = isMax ? accentColor : "#2d5a3d";
          const pct = maxValue > 0 ? Math.max((item.count / maxValue) * 100, 4) : 0;
          return (
            <div key={item.podLead} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 72, fontSize: 13, fontWeight: 500, color: "var(--ink)", textAlign: "right", flexShrink: 0 }}>
                {item.podLead}
              </span>
              <div style={{ flex: 1, height: 28, borderRadius: 6, background: "var(--surface)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 6, background: barColor, transition: "width 0.4s ease" }} />
              </div>
              <span style={{ width: 28, fontSize: 14, fontWeight: 700, color: isMax ? accentColor : "var(--ink-secondary)", textAlign: "right", flexShrink: 0 }}>
                {item.count}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function PodTasksContent({ podTasksData, podTasksLoading, onShare, copyingSection }) {
  const fallbackPods = ["Berman", "Roth", "Lee", "Gilatar", "Woodward"];

  // API returns { pods: [{ podLeadName, pendingBeats, scriptsToReview }] }
  // Normalise into the shape this component needs
  const rawPods = Array.isArray(podTasksData?.pods) ? podTasksData.pods : null;
  const scriptsPendingByPod = rawPods
    ? rawPods.map((p) => ({ podLead: p.podLeadName, count: Number(p.scriptsToReview) || 0 }))
    : fallbackPods.map((podLead) => ({ podLead, count: 0 }));
  const beatsPendingByPod = rawPods
    ? rawPods.map((p) => ({ podLead: p.podLeadName, count: Number(p.pendingBeats) || 0 }))
    : fallbackPods.map((podLead) => ({ podLead, count: 0 }));
  const totalScriptsPending = scriptsPendingByPod.reduce((sum, r) => sum + r.count, 0);
  const totalBeatsPending = beatsPendingByPod.reduce((sum, r) => sum + r.count, 0);
  const maxScripts = Math.max(...scriptsPendingByPod.map((r) => r.count), 1);
  const maxBeats = Math.max(...beatsPendingByPod.map((r) => r.count), 1);

  return (
    <ShareablePanel
      shareLabel="POD Tasks"
      onShare={onShare}
      isSharing={copyingSection === "POD Tasks"}
    >
      <div className="section-stack">
        {podTasksLoading ? <div className="warning-note">Loading data. Showing placeholder values.</div> : null}
        <div className="pod-summary-grid">
          {[
            { label: "Scripts to review", value: totalScriptsPending },
            { label: "Beats to review", value: totalBeatsPending },
          ].map((card) => (
            <div key={card.label} className="metric-card">
              <div className="metric-label">{card.label}</div>
              <div className="metric-value">{card.value}</div>
            </div>
          ))}
        </div>

        <PodTasksBarChart
          title="Scripts pending approval"
          subtitle="Scripts completed by writer, awaiting POD lead review"
          items={scriptsPendingByPod}
          maxValue={maxScripts}
          accentColor="#c2703e"
        />

        <PodTasksBarChart
          title="Beats pending approval"
          subtitle="Beats from current week in review pending or iterate status"
          items={beatsPendingByPod}
          maxValue={maxBeats}
          accentColor="#c2703e"
        />
      </div>
    </ShareablePanel>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function PodWiseContent({
  competitionPodRows,
  competitionLoading,
  competitionWeekLabel,
  performanceRangeMode,
  onPerformanceRangeModeChange,
  performanceScope,
  onPerformanceScopeChange,
  podTrendData,
  podTrendLoading,
  onShare,
  copyingSection,
}) {
  const placeholderRows = ["Berman", "Roth", "Lee", "Gilatar", "Woodward"].map((podLeadName) => ({
    podLeadName,
    lifetimeBeats: 0,
    lifetimeScripts: 0,
    hitRateNumerator: 0,
    throughputScore: 0,
    writerCount: 0,
  }));
  const competitionRows =
    Array.isArray(competitionPodRows) && competitionPodRows.length > 0 ? competitionPodRows : placeholderRows;

  const sorted = [...competitionRows]
    .map((row) => {
      const beats = row.lifetimeBeats || 0;
      const scripts = row.lifetimeScripts || 0;
      const successful = row.hitRateNumerator || 0;
      const throughputScore = row.throughputScore || successful;
      const conversion = scripts > 0 ? Math.round((successful / scripts) * 100) : 0;
      return { ...row, beats, scripts, successful, conversion, throughputScore };
    })
    .sort((a, b) => b.throughputScore - a.throughputScore || b.successful - a.successful || b.conversion - a.conversion);

  const bestPod = sorted[0] || null;

  const totalBeats = sorted.reduce((s, r) => s + r.beats, 0);
  const totalScripts = sorted.reduce((s, r) => s + r.scripts, 0);
  const totalSuccessful = sorted.reduce((s, r) => s + r.successful, 0);
  const avgConversion = totalScripts > 0 ? Math.round((totalSuccessful / totalScripts) * 100) : 0;

  const maxBeats = Math.max(...sorted.map((r) => r.beats), 1);
  const maxScripts = Math.max(...sorted.map((r) => r.scripts), 1);
  const maxSuccessful = Math.max(...sorted.map((r) => r.successful), 1);

  return (
    <ShareablePanel
      shareLabel="POD Wise leaderboard"
      onShare={onShare}
      isSharing={copyingSection === "POD Wise leaderboard"}
    >
      <div className="section-stack">
        {competitionLoading ? <div className="warning-note">Loading data. Showing placeholder values.</div> : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="week-toggle-group">
            {[
              { id: "selected", label: "Selected range" },
              { id: "lifetime", label: "Lifetime (Mar 16+)" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={performanceRangeMode === opt.id ? "is-active" : ""}
                onClick={() => onPerformanceRangeModeChange?.(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="week-toggle-group">
            {[
              { id: "bau", label: "BAU" },
              { id: "bau-lt", label: "BAU + LT" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={performanceScope === opt.id ? "is-active" : ""}
                onClick={() => onPerformanceScopeChange?.(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {competitionWeekLabel ? (
          <div style={{ fontSize: 11, color: "var(--subtle)", marginTop: -6 }}>{competitionWeekLabel}</div>
        ) : null}

        {/* ── Leaderboard header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 16 }}>
            <span style={{ color: "#d4a017", fontSize: 18 }}>★</span>
            POD leaderboard
          </div>
          <span style={{ fontSize: 11, color: "var(--subtle)" }}>Ranked by script hit rate (successful / scripts)</span>
        </div>

        {/* ── Podium (top 3) ── */}
        {sorted.length > 0 && (() => {
          const rankColor = (r) => r === 1 ? "#d4a017" : r === 2 ? "#888" : r === 3 ? "#c2703e" : "#aaa";
          const podiumBg = (r) => r === 1 ? "#fdf6e3" : r === 2 ? "#f7f4ef" : "#fdf0ed";
          const blocks = [
            { pod: sorted[1], rank: 2, h: 72 },
            { pod: sorted[0], rank: 1, h: 110 },
            { pod: sorted[2], rank: 3, h: 55 },
          ].filter(b => b.pod);
          return (
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 10, padding: "8px 0 4px" }}>
              {blocks.map(({ pod, rank, h }) => (
                <div key={rank} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1, maxWidth: 200 }}>
                  {rank === 1 && <span style={{ fontSize: 22 }}>👑</span>}
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{pod.podLeadName}</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: rankColor(rank) }}>{pod.conversion}%</div>
                  <div style={{ fontSize: 11, color: "var(--subtle)" }}>{pod.successful}/{pod.scripts} scripts</div>
                  <div style={{
                    width: "100%", height: h, borderRadius: "8px 8px 0 0",
                    background: podiumBg(rank),
                    border: `1px solid var(--border)`,
                    borderBottom: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 28, fontWeight: 800, color: rankColor(rank),
                  }}>{rank}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Ranked list ── */}
        {(() => {
          const rankColor = (r) => r === 1 ? "#d4a017" : r === 2 ? "#888" : r === 3 ? "#c2703e" : "#bbb";
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {sorted.map((pod, i) => {
                const rank = i + 1;
                const color = rankColor(rank);
                const pct = pod.conversion;
                const r = 18, circ = 2 * Math.PI * r;
                const offset = circ * (1 - Math.min(pct, 100) / 100);
                return (
                  <div key={pod.podLeadName} style={{
                    display: "flex", alignItems: "center", gap: 14,
                    background: "var(--card, #fffdf9)",
                    border: "1px solid var(--border)",
                    borderLeft: `4px solid ${rank <= 3 ? color : "var(--border)"}`,
                    borderRadius: 8, padding: "10px 16px",
                  }}>
                    {/* Rank number */}
                    <div style={{ width: 22, textAlign: "center", fontWeight: 700, fontSize: 15, color: rank <= 3 ? color : "var(--subtle)", flexShrink: 0 }}>{rank}</div>
                    {/* Circular progress ring */}
                    <div style={{ position: "relative", width: 46, height: 46, flexShrink: 0 }}>
                      <svg width={46} height={46} style={{ transform: "rotate(-90deg)" }}>
                        <circle cx={23} cy={23} r={r} fill="none" stroke="var(--border)" strokeWidth={3} />
                        <circle cx={23} cy={23} r={r} fill="none" stroke={color} strokeWidth={3}
                          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
                      </svg>
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color }}>{pct}%</div>
                    </div>
                    {/* Name + stats */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{pod.podLeadName}</div>
                      <div style={{ fontSize: 11, color: "var(--subtle)", marginTop: 2 }}>
                        Scripts {pod.scripts} · Success {pod.successful} · Beats {pod.beats}
                      </div>
                    </div>
                    {/* Hit rate + trophy */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: rank <= 3 ? color : "var(--subtle)" }}>{pct}%</span>
                      {rank === 1 && <span style={{ fontSize: 18 }}>🏆</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        <HitRateTrendChart trendData={podTrendData} loading={podTrendLoading} />
      </div>
    </ShareablePanel>
  );
}
