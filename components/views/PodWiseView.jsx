"use client";

import { useState, useEffect, useRef } from "react";
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
  const [containerW, setContainerW] = useState(720);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setContainerW(Math.floor(entry.contentRect.width) || 720);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const series = granularity === "week"
    ? (trendData?.weeks || [])
    : (trendData?.months || []);
  const podNames = trendData?.podNames || [];
  const activePods = podNames.filter((pod) => series.some((pt) => pod in pt.pods));

  const H = 260;
  const PAD = { top: 20, right: 20, bottom: 40, left: 46 };
  const W = Math.max(containerW, 280);
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const xStep = series.length > 1 ? chartW / (series.length - 1) : chartW / 2;
  const yScale = (val) => chartH - (val / 100) * chartH;
  const yTicks = [0, 25, 50, 75, 100];

  const xLabel = (i) => {
    if (granularity === "week") return `Wk ${i + 1}`;
    const pt = series[i];
    return pt.monthLabel?.slice(0, 3) || pt.monthKey?.slice(5) || "";
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
    .map((pod, i) => ({ pod, color: POD_LINE_COLORS[i % POD_LINE_COLORS.length], val: tooltipData?.pods[pod]?.hitRate }))
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

      {loading ? (
        <div style={{ color: "var(--subtle)", fontSize: 13, padding: "16px 0" }}>Loading trend data…</div>
      ) : activePods.length === 0 || series.length === 0 ? (
        <div style={{ color: "var(--subtle)", fontSize: 13, padding: "16px 0" }}>No trend data available yet.</div>
      ) : (
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

          {/* Chart container — relative so tooltip can be absolute */}
          <div ref={containerRef} style={{ position: "relative", userSelect: "none" }}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              style={{ display: "block", overflow: "visible" }}
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <defs>
                {activePods.map((pod, pi) => {
                  const color = POD_LINE_COLORS[pi % POD_LINE_COLORS.length];
                  return (
                    <linearGradient key={pod} id={`pod-grad-${pi}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                      <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                  );
                })}
              </defs>

              <g transform={`translate(${PAD.left},${PAD.top})`}>
                {/* Chart background */}
                <rect x={0} y={0} width={chartW} height={chartH} fill="white" fillOpacity="0.5" rx={4} />

                {/* Horizontal grid lines + Y labels */}
                {yTicks.map((tick) => (
                  <g key={tick}>
                    <line x1={0} x2={chartW} y1={yScale(tick)} y2={yScale(tick)}
                      stroke={tick === 0 ? "#c8bfb5" : "#e8e0d8"} strokeWidth={tick === 0 ? 1 : 1}
                      strokeDasharray={tick === 0 ? "none" : "3 4"} />
                    <text x={-8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle"
                      fontSize={9.5} fill="#9a8e84" fontWeight="500">{tick}%</text>
                  </g>
                ))}

                {/* Vertical grid lines + X labels */}
                {series.map((_, i) => {
                  const x = i * xStep;
                  const showLabel = i % labelEvery === 0;
                  return (
                    <g key={i}>
                      <line x1={x} x2={x} y1={0} y2={chartH}
                        stroke="#ece6e0" strokeWidth={1} strokeDasharray="3 4" />
                      {showLabel && (
                        <text x={x} y={chartH + 14} textAnchor="middle"
                          fontSize={9.5} fill="#9a8e84" fontWeight="500">
                          {xLabel(i)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Hover crosshair */}
                {hoveredIdx !== null && (
                  <line
                    x1={hoveredIdx * xStep} x2={hoveredIdx * xStep}
                    y1={0} y2={chartH}
                    stroke="#2d2420" strokeWidth={1.5} strokeOpacity={0.25}
                    strokeDasharray="4 3"
                    style={{ pointerEvents: "none" }}
                  />
                )}

                {/* Area fills */}
                {activePods.map((pod, pi) => {
                  const points = series.map((pt, i) => {
                    const val = pt.pods[pod]?.hitRate;
                    return val !== undefined ? { x: i * xStep, y: yScale(val) } : null;
                  });
                  const areaD = buildSmoothedAreaPath(points, chartH);
                  return areaD ? (
                    <path key={pod} d={areaD}
                      fill={`url(#pod-grad-${pi})`}
                      style={{ pointerEvents: "none" }} />
                  ) : null;
                })}

                {/* Lines */}
                {activePods.map((pod, pi) => {
                  const color = POD_LINE_COLORS[pi % POD_LINE_COLORS.length];
                  const points = series.map((pt, i) => {
                    const val = pt.pods[pod]?.hitRate;
                    return val !== undefined ? { x: i * xStep, y: yScale(val), val } : null;
                  });
                  const lineD = buildSmoothedPath(points);
                  return lineD ? (
                    <path key={pod} d={lineD}
                      fill="none" stroke={color} strokeWidth={2.5}
                      strokeLinejoin="round" strokeLinecap="round"
                      style={{ pointerEvents: "none" }} />
                  ) : null;
                })}

                {/* Dots — always small, larger at hovered column */}
                {activePods.map((pod, pi) => {
                  const color = POD_LINE_COLORS[pi % POD_LINE_COLORS.length];
                  return series.map((pt, i) => {
                    const val = pt.pods[pod]?.hitRate;
                    if (val === undefined) return null;
                    const isHovered = hoveredIdx === i;
                    return (
                      <circle key={`${pod}-${i}`}
                        cx={i * xStep} cy={yScale(val)}
                        r={isHovered ? 6 : 3.5}
                        fill={isHovered ? color : "white"}
                        stroke={color}
                        strokeWidth={isHovered ? 0 : 2}
                        style={{ transition: "r 0.15s ease, fill 0.15s ease", pointerEvents: "none" }}
                      />
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
                  minWidth: 140,
                  animation: "fadeInTooltip 0.12s ease",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#5a4f46", marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {xLabel(hoveredIdx)}
                  {granularity === "week" && series[hoveredIdx]?.weekLabel
                    ? <span style={{ fontWeight: 400, marginLeft: 4, textTransform: "none", letterSpacing: 0 }}>— {series[hoveredIdx].weekLabel}</span>
                    : null}
                </div>
                {tooltipRows.map((r) => (
                  <div key={r.pod} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4, fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0, display: "inline-block" }} />
                      <span style={{ color: "#2d2420" }}>{r.pod}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: r.color }}>{r.val}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
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

        {bestPod ? (
          <div className="metric-card" style={{ borderLeft: "4px solid var(--accent)" }}>
            <div className="metric-label">Best POD</div>
            <div className="metric-value" style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span>{bestPod.podLeadName}</span>
              <span style={{ fontSize: 16, color: "var(--subtle)" }}>Score: {formatMetricValue(bestPod.throughputScore)}</span>
            </div>
            <div className="metric-hint">
              POD Lead x Writers ({formatMetricValue(bestPod.writerCount)}) x Output ({formatMetricValue(bestPod.scripts)}) x Success ({formatMetricValue(bestPod.successful)})
            </div>
          </div>
        ) : null}

        <div className="pod-summary-grid">
          {[
            { label: "Total beats", value: totalBeats },
            { label: "Total scripts", value: totalScripts },
            { label: "Successful", value: totalSuccessful },
            { label: "Avg conversion", value: `${avgConversion}%` },
          ].map((card) => (
            <div key={card.label} className="metric-card">
              <div className="metric-label">{card.label}</div>
              <div className="metric-value">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="pod-section-header">
          <span className="pod-section-title">POD performance</span>
          <span className="pod-section-subtitle">Ranked by throughput score (successful beats/scripts)</span>
        </div>

        <div className="pod-cards-stack">
          {sorted.map((pod, i) => {
            const rank = i + 1;
            const tierColor = getPodTierColor(pod.conversion);
            return (
              <div key={pod.podLeadName} className="pod-rank-card" style={{ borderLeftColor: tierColor }}>
                <div className="pod-rank-col">
                  <div className="pod-rank-number" style={{ color: tierColor }}>{rank}</div>
                  <div className="pod-rank-label">RANK</div>
                </div>
                <div className="pod-info-col">
                  <div className="pod-lead-name">{pod.podLeadName}</div>
                  <div className="pod-conversion" style={{ color: tierColor }}>{pod.conversion}%</div>
                  <div className="pod-rate-label">SCRIPT HIT RATE</div>
                </div>
                <div className="pod-bars-col">
                  <PodFunnelBar label="Beats" value={pod.beats} maxValue={maxBeats} color="#2d5a3d" />
                  <PodFunnelBar label="Scripts" value={pod.scripts} maxValue={maxScripts} color="#c2703e" />
                  <PodFunnelBar label="Success" value={pod.successful} maxValue={maxSuccessful} color="#2d5a3d" />
                </div>
              </div>
            );
          })}
        </div>


        <div className="pod-legend">
          {[
            { color: "#2d5a3d", label: "Beats written" },
            { color: "#c2703e", label: "Scripts produced" },
            { color: "#2d5a3d", label: "Successful scripts" },
          ].map((item) => (
            <div key={item.label} className="pod-legend-item">
              <span className="pod-legend-swatch" style={{ background: item.color }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <HitRateTrendChart trendData={podTrendData} loading={podTrendLoading} />
      </div>
    </ShareablePanel>
  );
}
