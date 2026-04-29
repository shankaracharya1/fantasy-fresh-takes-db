"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GanttTracker from "./GanttTracker.jsx";
import { copyNodeImageToClipboard } from "../lib/clipboard-share.js";
import {
  buildPlannerBeatInventory,
  buildPlannerStageMetrics,
  getCurrentWeekKey,
  isVisiblePlannerPodLeadName,
  shiftWeekKey,
} from "../lib/tracker-data.js";
import { buildDateRangeSelection, MIN_DASHBOARD_DATE, WEEK_VIEW_OPTIONS, buildMonthWeekFilterOptions, buildStaticMonthWeekOptions, formatWeekRangeLabel, getMonthWeekSelectionByDate, getWeekSelection, getWeekViewLabel, normalizeWeekView } from "../lib/week-view.js";

// ─── View imports ─────────────────────────────────────────────────────────────
import DetailsContent from "./views/DetailsView.jsx";
import OverviewContent, { ReportsContent } from "./views/OverviewView.jsx";
import LeadershipOverviewContent from "./views/LeadershipOverviewView.jsx";
import AnalyticsContent from "./views/AnalyticsView.jsx";
import PodWiseContent, { PodTasksContent } from "./views/PodWiseView.jsx";
import ProductionContent from "./views/ProductionView.jsx";
import Planner2Content from "./views/Planner2View.jsx";
import { PlannerErrorBoundary } from "./views/shared.jsx";

// ─── Shared utilities ─────────────────────────────────────────────────────────
import {
  WRITER_TARGET_PER_WEEK,
  formatNumber,
  formatDateLabel,
  getAcdTimeViewLabel,
  getAcdViewLabel,
} from "./views/shared.jsx";

// ─── Suggestions form ────────────────────────────────────────────────────────

const PRIORITY_OPTIONS = [
  { id: "low",      label: "Low",      color: "#6b7f95", bg: "#edf2f7" },
  { id: "medium",   label: "Medium",   color: "#b8622c", bg: "#fdf0e6" },
  { id: "high",     label: "High",     color: "#e09b10", bg: "#fdf3d8" },
  { id: "critical", label: "Critical", color: "#9f2e2e", bg: "#fdf0f0" },
];

const DASHBOARD_SECTIONS = [
  "Editorial Funnel",
  "PODs Performance",
  "CDs Performance",
  "Production Pipeline",
  "WIP",
  "Planner",
  "Analytics",
  "Overview / Leadership",
  "Other",
];

function SuggestionsContent() {
  const EMPTY_FORM = { name: "", section: "", suggestion: "", whyMatters: "", priority: "" };
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState(false);
  const [entries, setEntries] = useState([]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setPriority = (id) => setForm((f) => ({ ...f, priority: id }));
  const isValid = form.name.trim() && form.section && form.suggestion.trim() && form.priority;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setEntries((prev) => [{ ...form, id: Date.now(), submittedAt: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) }, ...prev]);
    setSubmitting(false);
    setFlash(true);
    setForm(EMPTY_FORM);
    setTimeout(() => setFlash(false), 2000);
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    padding: "10px 14px", borderRadius: 8,
    border: "1.5px solid var(--border)", background: "var(--card, #fffdf9)",
    fontSize: 14, color: "var(--ink)", outline: "none",
    fontFamily: "inherit", transition: "border-color 0.15s",
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: "var(--subtle)",
    letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6, display: "block",
  };

  const priorityMeta = Object.fromEntries(PRIORITY_OPTIONS.map((p) => [p.id, p]));

  return (
    <div style={{ display: "flex", gap: 0, height: "100%", minHeight: 0, overflow: "hidden" }}>

      {/* ── LEFT: Form ── */}
      <div style={{
        width: 400, flexShrink: 0, borderRight: "1px solid var(--border)",
        overflowY: "auto", padding: "32px 28px",
      }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>💡 Suggest an improvement</div>
          <div style={{ fontSize: 13, color: "var(--subtle)" }}>Have an idea to make the dashboard better?</div>
        </div>

        {flash && (
          <div style={{
            marginBottom: 20, padding: "10px 16px", borderRadius: 8,
            background: "#edf7f1", border: "1px solid #a8d5b8",
            color: "#2d5a3d", fontSize: 13, fontWeight: 600,
          }}>
            ✅ Suggestion submitted!
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          <div>
            <label style={labelStyle}>Your Name <span style={{ color: "#c2703e" }}>*</span></label>
            <input type="text" placeholder="e.g. Shankar" value={form.name} onChange={set("name")} style={inputStyle} required />
          </div>

          <div>
            <label style={labelStyle}>Dashboard Section <span style={{ color: "#c2703e" }}>*</span></label>
            <select value={form.section} onChange={set("section")} required style={{
              ...inputStyle, appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: 36,
            }}>
              <option value="">Select a section…</option>
              {DASHBOARD_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Suggestion <span style={{ color: "#c2703e" }}>*</span></label>
            <textarea placeholder="Describe your idea clearly…" value={form.suggestion} onChange={set("suggestion")} rows={4} required style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
          </div>

          <div>
            <label style={labelStyle}>Why this matters</label>
            <textarea placeholder="What problem does this solve? Who benefits?" value={form.whyMatters} onChange={set("whyMatters")} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
          </div>

          <div>
            <label style={labelStyle}>Priority <span style={{ color: "#c2703e" }}>*</span></label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PRIORITY_OPTIONS.map(({ id, label, color, bg }) => {
                const selected = form.priority === id;
                return (
                  <button key={id} type="button" onClick={() => setPriority(id)} style={{
                    padding: "7px 16px", borderRadius: 20,
                    border: `2px solid ${selected ? color : "var(--border)"}`,
                    background: selected ? bg : "var(--card, #fffdf9)",
                    color: selected ? color : "var(--subtle)",
                    fontWeight: selected ? 700 : 500, fontSize: 12, cursor: "pointer",
                    transition: "all 0.15s",
                  }}>{label}</button>
                );
              })}
            </div>
          </div>

          <button type="submit" disabled={!isValid || submitting} style={{
            width: "100%", padding: "12px 0", borderRadius: 10, marginTop: 4,
            background: isValid ? "#2d5a3d" : "var(--border)",
            color: isValid ? "#fff" : "var(--subtle)",
            fontWeight: 700, fontSize: 14, border: "none",
            cursor: isValid ? "pointer" : "not-allowed",
            transition: "background 0.2s, color 0.2s",
          }}>
            {submitting ? "Submitting…" : "Submit suggestion"}
          </button>

        </form>
      </div>

      {/* ── RIGHT: Submissions table ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Submitted suggestions</div>
          {entries.length > 0 && (
            <span style={{ fontSize: 12, background: "#2d5a3d", color: "#fff", borderRadius: 20, padding: "2px 10px", fontWeight: 600 }}>
              {entries.length}
            </span>
          )}
        </div>

        {entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--subtle)", fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            No suggestions yet. Be the first!
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  {["#", "Name", "Section", "Suggestion", "Why it matters", "Priority", "Submitted"].map((h) => (
                    <th key={h} style={{
                      padding: "8px 12px", textAlign: "left", fontWeight: 700,
                      fontSize: 11, color: "var(--subtle)", textTransform: "uppercase",
                      letterSpacing: "0.05em", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const p = priorityMeta[e.priority];
                  return (
                    <tr key={e.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "top", background: i % 2 === 0 ? "transparent" : "var(--surface, #f9f6f1)" }}>
                      <td style={{ padding: "12px 12px", color: "var(--subtle)", fontWeight: 600 }}>{entries.length - i}</td>
                      <td style={{ padding: "12px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{e.name}</td>
                      <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                        <span style={{ background: "var(--surface, #f5f0e8)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", fontSize: 12 }}>{e.section}</span>
                      </td>
                      <td style={{ padding: "12px 12px", maxWidth: 260 }}>{e.suggestion}</td>
                      <td style={{ padding: "12px 12px", maxWidth: 200, color: "var(--subtle)" }}>{e.whyMatters || "—"}</td>
                      <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                        {p && (
                          <span style={{
                            background: p.bg, color: p.color, border: `1px solid ${p.color}`,
                            borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700,
                          }}>{p.label}</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 12px", color: "var(--subtle)", whiteSpace: "nowrap", fontSize: 12 }}>{e.submittedAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Lifetime Angle Lifecycle ────────────────────────────────────────────────

const LIFECYCLE_STAGES = [
  { id: "live",          label: "Live",            color: "#2563eb", bg: "#eff6ff" },
  { id: "editorial",     label: "Editorial",       color: "#9333ea", bg: "#f5f3ff" },
  { id: "ready_for_prod",label: "Ready for Prod",  color: "#d97706", bg: "#fffbeb" },
  { id: "production",    label: "Production",      color: "#16a34a", bg: "#f0fdf4" },
];

function LifetimeAngleContent() {
  const [startDate, setStartDate] = useState("");
  const [showFilter, setShowFilter] = useState("");
  const [angleFilter, setAngleFilter] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // Fetch all lifecycle data (no end date = full lifetime)
  useEffect(() => {
    setLoading(true);
    setFetched(false);
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    fetch(`/api/dashboard/overview-detail?${params}`)
      .then((r) => r.json())
      .then((d) => { setRows(Array.isArray(d.rows) ? d.rows : []); setFetched(true); })
      .catch(() => { setRows([]); setFetched(true); })
      .finally(() => setLoading(false));
  }, [startDate]);

  const showNames = useMemo(() =>
    [...new Set(rows.map((r) => r.showName).filter(Boolean))].sort()
  , [rows]);

  const angles = useMemo(() => {
    if (!showFilter) return [...new Set(rows.map((r) => r.beatName).filter(Boolean))].sort();
    return [...new Set(rows.filter((r) => r.showName === showFilter).map((r) => r.beatName).filter(Boolean))].sort();
  }, [rows, showFilter]);

  // Reset angle when show changes
  useEffect(() => { setAngleFilter(""); }, [showFilter]);

  const lifecycle = useMemo(() => {
    if (!angleFilter) return [];
    return rows
      .filter((r) => (!showFilter || r.showName === showFilter) && r.beatName === angleFilter)
      .sort((a, b) => {
        const order = { live: 0, editorial: 1, ready_for_prod: 2, production: 3 };
        return (order[a.source] ?? 99) - (order[b.source] ?? 99) ||
          (a.dateSubmittedByLead || "").localeCompare(b.dateSubmittedByLead || "");
      });
  }, [rows, showFilter, angleFilter]);

  const stageMap = useMemo(() => {
    const m = {};
    for (const r of lifecycle) {
      if (!m[r.source]) m[r.source] = r;
    }
    return m;
  }, [lifecycle]);

  const fLabel = { fontSize: 11, fontWeight: 700, color: "var(--subtle)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6, display: "block" };
  const fInput = { padding: "9px 12px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--card, #fffdf9)", fontSize: 13, color: "var(--ink)", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
  const fSelect = { ...fInput, appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32 };

  return (
    <div style={{ padding: "32px 28px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Lifetime Angle Lifecycle</div>
        <div style={{ fontSize: 13, color: "var(--subtle)" }}>Track an angle's full journey — from Live through Editorial, Ready for Prod, and Production.</div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", background: "var(--card, #fffdf9)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 32 }}>
        <div style={{ flex: "0 0 160px" }}>
          <label style={fLabel}>Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={fInput} />
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <label style={fLabel}>Show Name</label>
          <select value={showFilter} onChange={(e) => setShowFilter(e.target.value)} style={fSelect} disabled={loading}>
            <option value="">All shows</option>
            {showNames.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <label style={fLabel}>Angle</label>
          <select value={angleFilter} onChange={(e) => setAngleFilter(e.target.value)} style={fSelect} disabled={loading || angles.length === 0}>
            <option value="">Select angle…</option>
            {angles.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {loading && <div style={{ fontSize: 12, color: "var(--subtle)", alignSelf: "center" }}>Loading…</div>}
      </div>

      {/* Empty state */}
      {!angleFilter ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--subtle)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 13 }}>{!fetched ? "Set a start date or select a show to begin." : "Select an angle to see its lifecycle."}</div>
        </div>
      ) : lifecycle.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--subtle)", fontSize: 13 }}>No lifecycle data found for this angle.</div>
      ) : (
        <>
          {/* Timeline progress bar */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 32, gap: 0 }}>
            {LIFECYCLE_STAGES.map((stage, i) => {
              const hit = stageMap[stage.id];
              return (
                <div key={stage.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                  {/* Connector line */}
                  {i < LIFECYCLE_STAGES.length - 1 && (
                    <div style={{ position: "absolute", top: 19, left: "50%", width: "100%", height: 3, background: hit ? stage.color : "var(--border)", opacity: 0.4, zIndex: 0 }} />
                  )}
                  {/* Circle */}
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%", zIndex: 1, marginBottom: 8,
                    background: hit ? stage.bg : "var(--surface, #f5f0e8)",
                    border: `2.5px solid ${hit ? stage.color : "var(--border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, color: hit ? stage.color : "var(--border)",
                  }}>
                    {hit ? "✓" : "○"}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: hit ? stage.color : "var(--subtle)", textAlign: "center" }}>{stage.label}</div>
                  <div style={{ fontSize: 10, color: "var(--subtle)", marginTop: 2, textAlign: "center" }}>{hit?.dateSubmittedByLead || "—"}</div>
                </div>
              );
            })}
          </div>

          {/* Detail table */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface, #f5f0e8)" }}>
                  {["Stage", "Date", "Writer", "POD Lead", "Type"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lifecycle.map((row, i) => {
                  const s = LIFECYCLE_STAGES.find((s) => s.id === row.source) || {};
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface, #f9f6f1)" }}>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}20`, borderRadius: 20, padding: "3px 11px", fontSize: 12, fontWeight: 600 }}>{s.label}</span>
                      </td>
                      <td style={{ padding: "11px 14px", fontWeight: 600 }}>{row.dateSubmittedByLead || "—"}</td>
                      <td style={{ padding: "11px 14px" }}>{row.writerName || "—"}</td>
                      <td style={{ padding: "11px 14px" }}>{row.podLeadName || "—"}</td>
                      <td style={{ padding: "11px 14px", color: "var(--subtle)" }}>{row.reworkType || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Shell-only constants ─────────────────────────────────────────────────────

const THEME_STORAGE_KEY = "fresh-takes-theme-mode";
const EMPTY_ACD_MESSAGE = "No valid ACD output data available yet from Live tab sync.";
const DEFAULT_DASHBOARD_RANGE = buildDateRangeSelection({ period: "current", minDate: MIN_DASHBOARD_DATE });
const DASHBOARD_CLIENT_REFRESH_MS = 15 * 60 * 1000;
const DASHBOARD_CLIENT_CACHE_TTL_MS = 15 * 60 * 1000;

// ─── Shell-only helpers ───────────────────────────────────────────────────────

function buildNextWeekPlannerBoardMetrics(snapshot) {
  const safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : null;
  if (!safeSnapshot || safeSnapshot.isLoading || safeSnapshot.plannerRenderError) {
    return null;
  }

  const hasCommittedSnapshot = Boolean(safeSnapshot?.committedSnapshotMeta?.snapshotTimestamp);
  const visiblePods = (Array.isArray(safeSnapshot.pods) ? safeSnapshot.pods : []).filter((pod) =>
    isVisiblePlannerPodLeadName(pod?.cl)
  );
  const committedPods = (Array.isArray(safeSnapshot.committedPods) ? safeSnapshot.committedPods : []).filter((pod) =>
    isVisiblePlannerPodLeadName(pod?.cl)
  );
  const sourcePods = hasCommittedSnapshot ? committedPods : visiblePods;
  const podOrder = sourcePods.map((pod) => String(pod?.cl || "").trim()).filter(Boolean);
  const podWriterCounts = Object.fromEntries(
    podOrder.map((podLeadName) => {
      const pod = sourcePods.find((candidate) => String(candidate?.cl || "").trim() === podLeadName);
      const writerCount = (Array.isArray(pod?.writers) ? pod.writers : []).filter((writer) => writer?.active !== false).length;
      return [podLeadName, writerCount];
    })
  );
  const podTargetCounts = Object.fromEntries(
    podOrder.map((podLeadName) => [
      podLeadName,
      Number((Number(podWriterCounts[podLeadName] || 0) * WRITER_TARGET_PER_WEEK).toFixed(2)),
    ])
  );
  const targetFloor = Number(
    Object.values(podTargetCounts).reduce((sum, value) => sum + Number(value || 0), 0).toFixed(2)
  );
  const overallBeatRows = buildPlannerBeatInventory(sourcePods, { dedupeScope: "global" });
  const overallMetrics = buildPlannerStageMetrics(overallBeatRows, {
    targetFloor,
    targetTatDays: 1,
  });
  const podRows = podOrder.map((podLeadName) => {
    const pod = sourcePods.find((candidate) => String(candidate?.cl || "").trim() === podLeadName);
    const podBeatRows = buildPlannerBeatInventory(pod ? [pod] : [], { dedupeScope: "pod" });
    const metrics = buildPlannerStageMetrics(podBeatRows, {
      targetFloor: Number(podTargetCounts[podLeadName] || 0),
      targetTatDays: 1,
    });

    return {
      podLeadName,
      uniqueBeatCount: metrics.uniqueBeatCount,
      plannedLiveCount: metrics.liveOnMetaBeatCount,
      liveCount: metrics.liveOnMetaBeatCount,
      inProductionCount: 0,
      output: metrics.liveOnMetaBeatCount,
      expectedProductionTatDays: metrics.expectedProductionTatDays,
      averageWritingDays: metrics.averageWritingDays,
      averageClReviewDays: metrics.averageClReviewDays,
      writerCount: Number(podWriterCounts[podLeadName] || 0),
      targetCount: Number(podTargetCounts[podLeadName] || 0),
      isBelowTarget: metrics.liveOnMetaBeatCount < Number(podTargetCounts[podLeadName] || 0),
    };
  });

  return {
    overview: {
      ok: true,
      period: "next",
      selectionMode: "planned",
      weekKey: String(safeSnapshot.weekKey || ""),
      weekLabel: String(safeSnapshot.weekLabel || ""),
      hasPlannerData: true,
      hasWeekData: overallBeatRows.length > 0,
      emptyStateMessage: overallBeatRows.length > 0 ? "" : "No planner beats are assigned for next week yet.",
      plannerBeatCount: overallMetrics.uniqueBeatCount,
      freshTakeCount: overallMetrics.liveOnMetaBeatCount,
      plannedReleaseCount: overallMetrics.liveOnMetaBeatCount,
      targetFloor,
      tatSummary: {
        averageTatDays: overallMetrics.expectedProductionTatDays,
        medianTatDays: null,
        eligibleAssetCount: overallMetrics.productionBeatCount,
        skippedMissingTatDates: 0,
        skippedInvalidTatRows: 0,
        targetTatDays: overallMetrics.targetTatDays,
        tatRows: [],
      },
      tatEmptyMessage:
        overallMetrics.expectedProductionTatDays === null
          ? "Planner allocations are not sufficient yet to estimate production TAT."
          : "",
      averageWritingDays: overallMetrics.averageWritingDays,
      averageClReviewDays: overallMetrics.averageClReviewDays,
      writingEmptyMessage:
        overallMetrics.uniqueBeatCount > 0 ? "" : "No planner beats are assigned for the selected week yet.",
      clReviewEmptyMessage:
        overallMetrics.uniqueBeatCount > 0 ? "" : "No planner beats are assigned for the selected week yet.",
    },
    writing: {
      ok: true,
      period: "next",
      selectionMode: "planned",
      weekKey: String(safeSnapshot.weekKey || ""),
      weekLabel: String(safeSnapshot.weekLabel || ""),
      uniqueBeatCount: overallMetrics.uniqueBeatCount,
      plannedLiveCount: overallMetrics.liveOnMetaBeatCount,
      liveCount: overallMetrics.liveOnMetaBeatCount,
      inProductionCount: 0,
      outputCount: overallMetrics.liveOnMetaBeatCount,
      expectedProductionTatDays: overallMetrics.expectedProductionTatDays,
      averageWritingDays: overallMetrics.averageWritingDays,
      averageClReviewDays: overallMetrics.averageClReviewDays,
      releasedCount: overallMetrics.liveOnMetaBeatCount,
      targetFloor,
      onTrack: overallMetrics.liveOnMetaBeatCount >= targetFloor,
      shortfall: Math.max(0, targetFloor - overallMetrics.liveOnMetaBeatCount),
      surplus: Math.max(0, overallMetrics.liveOnMetaBeatCount - targetFloor),
      skippedMissingPodLeadCount: 0,
      skippedMissingProductionPodLeadCount: 0,
      writerTarget: WRITER_TARGET_PER_WEEK,
      podRows,
      hasLiveData: false,
      hasWeekData: overallBeatRows.length > 0,
      emptyStateMessage: overallBeatRows.length > 0 ? "" : "No planner beats are assigned for the selected week yet.",
      productionTabError: "",
    },
  };
}

function buildAnalyticsSubtitle(data) {
  const parts = [
    data?.selectedWeekLabel,
    data?.selectedWeekRangeLabel,
    data?.rowCount ? `${formatNumber(data.rowCount)} attempts` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function buildDemoOverviewPayload(rangeSelection) {
  return {
    ok: true,
    period: "range",
    selectionMode: "editorial_funnel",
    weekStart: rangeSelection.startDate,
    weekEnd: rangeSelection.endDate,
    weekLabel: formatWeekRangeLabel(rangeSelection.startDate, rangeSelection.endDate),
    hasWeekData: true,
    plannerBeatCount: 18,
    inProductionBeatCount: 11,
    scriptsPerWriter: 1.7,
    averageClReviewDays: 1.2,
    tatSummary: { averageTatDays: 2.6, eligibleAssetCount: 14 },
    podThroughputRows: [
      {
        podLeadName: "Woodward",
        lwProductionCount: 5,
        thisWeekBeatsCount: 7,
        wipCount: 2,
        reviewWithClCount: 1,
        onTrackCount: 4,
        readinessStage: "On Track",
        thuStatusMessage: "Thu update sent",
        writerRows: [{ writerName: "Writer A", lwProductionCount: 3, thisWeekBeatsCount: 4, wipCount: 1, reviewWithClCount: 1, onTrackCount: 2, readinessStage: "On Track" }],
      },
      {
        podLeadName: "Berman",
        lwProductionCount: 4,
        thisWeekBeatsCount: 6,
        wipCount: 2,
        reviewWithClCount: 1,
        onTrackCount: 3,
        readinessStage: "WIP",
        thuStatusMessage: "Needs Thursday update",
        writerRows: [{ writerName: "Writer B", lwProductionCount: 2, thisWeekBeatsCount: 3, wipCount: 1, reviewWithClCount: 0, onTrackCount: 2, readinessStage: "WIP" }],
      },
    ],
    beatsFunnel: [
      { showName: "MVS", beatName: "Prom", attempts: 4, successfulAttempts: 2 },
      { showName: "WBT", beatName: "Hydra", attempts: 3, successfulAttempts: 1 },
    ],
    hitRate: 42.9,
    hitRateNumerator: 3,
    hitRateDenominator: 7,
  };
}

function buildDemoLeadershipPayload(rangeSelection) {
  return {
    ok: true,
    selectedWeekRangeLabel: formatWeekRangeLabel(rangeSelection.startDate, rangeSelection.endDate),
    beatRows: [
      { id: "1", statusCategory: "approved", podLeadName: "Woodward", showName: "MVS", beatName: "Prom", monthKey: "2026-04", weekInMonth: 2 },
      { id: "2", statusCategory: "review_pending", podLeadName: "Berman", showName: "WBT", beatName: "Hydra", monthKey: "2026-04", weekInMonth: 2 },
    ],
    allBeatRows: [],
    workflowRows: [
      { id: "w1", source: "production", podLeadName: "Woodward", writerName: "Writer A", showName: "MVS", beatName: "Prom", stageDate: rangeSelection.startDate },
      { id: "w2", source: "ready_for_production", podLeadName: "Berman", writerName: "Writer B", showName: "WBT", beatName: "Hydra", stageDate: rangeSelection.startDate },
    ],
    allWorkflowRows: [],
    approvedMatchedRows: [],
    fullGenAiRows: [
      { id: "g1", showName: "MVS", beatName: "Prom", success: true },
      { id: "g2", showName: "WBT", beatName: "Hydra", success: false },
    ],
    currentWeekUpdateRows: [
      { podLeadName: "Woodward", writerName: "Writer A", beats: 4, editorial: 2, readyForProduction: 1, production: 1, live: 1 },
      { podLeadName: "Berman", writerName: "Writer B", beats: 3, editorial: 1, readyForProduction: 1, production: 0, live: 0 },
    ],
  };
}

function buildDemoAnalyticsPayload(rangeSelection) {
  return {
    ok: true,
    selectedWeekKey: rangeSelection.startDate,
    selectedWeekLabel: "Custom",
    selectedWeekRangeLabel: formatWeekRangeLabel(rangeSelection.startDate, rangeSelection.endDate),
    rowCount: 2,
    legend: [
      { label: "Potential Gen AI", tone: "gen-ai" },
      { label: "Potential P1 Rework", tone: "rework-p1" },
      { label: "Testing / Drop", tone: "testing-drop" },
    ],
    metricColumns: [
      { key: "amountSpent", label: "Spend", format: "currency" },
      { key: "cpi", label: "CPI", format: "currency" },
      { key: "cti", label: "CTI", format: "percent" },
    ],
    rows: [
      {
        assetCode: "GA123",
        rowIndex: 1,
        showName: "MVS",
        beatName: "Prom",
        nextStep: "Potential Gen AI",
        rowTone: "gen-ai",
        actioned: false,
        metrics: {
          amountSpent: { value: 180, meetsBenchmark: true },
          cpi: { value: 8.2, meetsBenchmark: true },
          cti: { value: 14.1, meetsBenchmark: true },
        },
      },
      {
        assetCode: "GI901",
        rowIndex: 2,
        showName: "WBT",
        beatName: "Hydra",
        nextStep: "Potential P1 Rework",
        rowTone: "rework-p1",
        actioned: false,
        metrics: {
          amountSpent: { value: 145, meetsBenchmark: true },
          cpi: { value: 11.4, meetsBenchmark: false },
          cti: { value: 12.6, meetsBenchmark: true },
        },
      },
    ],
  };
}

function buildDemoProductionPayload(rangeSelection) {
  return {
    ok: true,
    period: "range",
    weekStart: rangeSelection.startDate,
    weekEnd: rangeSelection.endDate,
    weekLabel: formatWeekRangeLabel(rangeSelection.startDate, rangeSelection.endDate),
    latestWorkDate: rangeSelection.endDate,
    emptyStateMessage: "",
    acdChartRows: [
      { acdName: "ACD 1", totalMinutes: 420, totalImages: 24 },
      { acdName: "ACD 2", totalMinutes: 360, totalImages: 19 },
    ],
    rolling7Rows: [
      { acdName: "ACD 1", totalMinutes: 420, totalImages: 24 },
      { acdName: "ACD 2", totalMinutes: 360, totalImages: 19 },
    ],
    rolling14Rows: [],
    rolling30Rows: [],
    rolling7CdRows: [],
    rolling14CdRows: [],
    rolling30CdRows: [],
    syncStatus: {
      latestRun: { createdAt: new Date().toISOString(), processedLiveRows: 120, eligibleLiveRows: 85, sheetLinksAttempted: 60, sheetLinksFailed: 6 },
      adherenceIssueRows: [{ cdName: "CD 1", acdName: "ACD 1", totalAssetsNotAdhering: 2, assets: [{ assetCode: "GA123", imageSheetLink: "" }] }],
      adherenceRows: [{ cdName: "CD 1", totalAssetsNotAdhering: 2 }],
      totalFailedSheets: 6,
      cutoffDate: "2026-03-16",
      sourceFilterWarning: "",
      syncError: "",
    },
    failureReasonRows: [{ failureReason: "sheet_inaccessible", count: 4 }],
  };
}

function Notice({ notice }) {
  if (!notice) {
    return null;
  }

  return <div className={`floating-notice tone-${notice.tone || "info"}`}>{notice.text}</div>;
}

async function readJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  return response.json();
}

function formatDisplayDate(ymd) {
  if (!ymd) return "—";
  const [year, month, day] = String(ymd).split("-").map(Number);
  if (!year || !month || !day) return ymd;
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function readClientCache(key, ttlMs = DASHBOARD_CLIENT_CACHE_TTL_MS) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Number.isFinite(parsed.savedAt) || Date.now() - parsed.savedAt > ttlMs) return null;
    return parsed.payload ?? null;
  } catch {
    return null;
  }
}

// Returns true if the cache entry is fresh enough to skip a background re-fetch.
// Uses a shorter TTL (5 min) so data stays reasonably up-to-date even while cached.
const BACKGROUND_REFETCH_SKIP_TTL_MS = 5 * 60 * 1000;
function isCacheFreshEnoughToSkipRefetch(key) {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || !Number.isFinite(parsed.savedAt)) return false;
    return Date.now() - parsed.savedAt < BACKGROUND_REFETCH_SKIP_TTL_MS;
  } catch {
    return false;
  }
}

function writeClientCache(key, payload) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        payload,
      })
    );
  } catch {}
}

// ─── Main component ───────────────────────────────────────────────────────────

const MORE_VIEWS = new Set(["details", "planner"]);

export default function UnifiedOpsApp() {
  const [activeView, setActiveView] = useState("overview");
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [themeMode, setThemeMode] = useState("light");
  const [dashboardDateRange, setDashboardDateRange] = useState({
    startDate: DEFAULT_DASHBOARD_RANGE.startDate,
    endDate: DEFAULT_DASHBOARD_RANGE.endDate,
  });
  const [plannerBoardSnapshot, setPlannerBoardSnapshot] = useState(null);
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [overviewDetailRows, setOverviewDetailRows] = useState([]);
  const [overviewDetailLoading, setOverviewDetailLoading] = useState(false);
  const [leadershipOverviewData, setLeadershipOverviewData] = useState(null);
  const [leadershipOverviewLoading, setLeadershipOverviewLoading] = useState(true);
  const [leadershipOverviewError, setLeadershipOverviewError] = useState("");
  const [competitionData, setCompetitionData] = useState(null);
  const [competitionLoading, setCompetitionLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsActionedBusyKey, setAnalyticsActionedBusyKey] = useState("");
  const [acdMetricsData, setAcdMetricsData] = useState(null);
  const [acdMetricsLoading, setAcdMetricsLoading] = useState(true);
  const [acdMetricsError, setAcdMetricsError] = useState("");
  const [productionPipelineData, setProductionPipelineData] = useState(null);
  const [productionPipelineLoading, setProductionPipelineLoading] = useState(false);
  const [acdTimeView, setAcdTimeView] = useState("rolling7");
  const [acdViewType, setAcdViewType] = useState("acd");
  const [busyAction, setBusyAction] = useState("");
  const [copyingSection, setCopyingSection] = useState("");
  const [includeNewShowsPod, setIncludeNewShowsPod] = useState(false);
  const [notice, setNotice] = useState(null);
  const [podWiseView, setPodWiseView] = useState("performance");
  const [performanceSubView, setPerformanceSubView] = useState("pods");
  const [performanceExpanded, setPerformanceExpanded] = useState(false);
  const [productionSubView, setProductionSubView] = useState("pipeline");
  const [productionExpanded, setProductionExpanded] = useState(false);
  const [podPerformanceRangeMode, setPodPerformanceRangeMode] = useState("selected");
  const [podPerformanceScope, setPodPerformanceScope] = useState("bau");
  const [includeGuAssets, setIncludeGuAssets] = useState(false);
  const [podTasksData, setPodTasksData] = useState(null);
  const [podTasksLoading, setPodTasksLoading] = useState(false);
  const [podTrendData, setPodTrendData] = useState(null);
  const [podTrendLoading, setPodTrendLoading] = useState(false);
  const [dashboardLoadingMessage, setDashboardLoadingMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [cacheRefreshing, setCacheRefreshing] = useState(false);
  const [planner2Data, setPlanner2Data] = useState(null);
  const [planner2Loading, setPlanner2Loading] = useState(false);
  const [planner2Error, setPlanner2Error] = useState("");
  const [lastNonQuickRange, setLastNonQuickRange] = useState(DEFAULT_DASHBOARD_RANGE);
  const [weekFilterSelection, setWeekFilterSelection] = useState(
    getMonthWeekSelectionByDate(DEFAULT_DASHBOARD_RANGE.startDate).id
  );
  const [dateFilterMode, setDateFilterMode] = useState("custom");
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const weekDropdownRef = useRef(null);
  const startDateRef = useRef(null);
  const endDateRef = useRef(null);
  const normalizedHeaderRange = useMemo(
    () => buildDateRangeSelection({ ...dashboardDateRange, minDate: MIN_DASHBOARD_DATE }),
    [dashboardDateRange]
  );
  const headerSupportsDateRange =
    activeView === "overview" ||
    activeView === "leadership-overview" ||
    activeView === "pod-wise" ||
    activeView === "production" ||
    activeView === "planner2";
  const headerDateRangeDisabled =
    (activeView === "overview" && overviewLoading) ||
    (activeView === "leadership-overview" && leadershipOverviewLoading) ||
    (activeView === "pod-wise" && competitionLoading) ||
    (activeView === "production" && acdMetricsLoading && !acdMetricsData) ||
    (activeView === "planner2" && planner2Loading && !planner2Data);
  const monthWeekOptions = useMemo(() => buildStaticMonthWeekOptions(MIN_DASHBOARD_DATE), []);
  const selectedMonthWeekOption = useMemo(
    () => monthWeekOptions.find((option) => option.id === weekFilterSelection) || monthWeekOptions[0] || null,
    [monthWeekOptions, weekFilterSelection]
  );
  const selectedWeekMatchesRange =
    Boolean(selectedMonthWeekOption) &&
    selectedMonthWeekOption.weekStart === normalizedHeaderRange.startDate &&
    selectedMonthWeekOption.weekEnd === normalizedHeaderRange.endDate;
  const headerDateRangeUsesWeekPreset = headerSupportsDateRange && selectedWeekMatchesRange;
  const headerDateRangeUsesManualDates = headerSupportsDateRange && !selectedWeekMatchesRange;

  useEffect(() => {
    if (monthWeekOptions.length === 0) {
      return;
    }

    const dateBasedSelection = getMonthWeekSelectionByDate(normalizedHeaderRange.startDate);
    const matchedOption =
      monthWeekOptions.find((option) => option.id === weekFilterSelection) ||
      monthWeekOptions.find((option) => option.id === dateBasedSelection.id) ||
      monthWeekOptions[0];

    if (matchedOption && matchedOption.id !== weekFilterSelection) {
      setWeekFilterSelection(matchedOption.id);
    }
  }, [monthWeekOptions, weekFilterSelection, normalizedHeaderRange.startDate]);

  useEffect(() => {
    if (!weekDropdownOpen) return undefined;
    function handleClickOutside(event) {
      if (weekDropdownRef.current && !weekDropdownRef.current.contains(event.target)) {
        setWeekDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [weekDropdownOpen]);

  const lastWeekQuickRange = useMemo(
    () =>
      buildDateRangeSelection({
        startDate: getWeekSelection("last").weekStart,
        endDate: getWeekSelection("last").weekEnd,
        minDate: MIN_DASHBOARD_DATE,
      }),
    []
  );
  const currentWeekQuickRange = useMemo(
    () =>
      buildDateRangeSelection({
        startDate: getWeekSelection("current").weekStart,
        endDate: getWeekSelection("current").weekEnd,
        minDate: MIN_DASHBOARD_DATE,
      }),
    []
  );
  const nextWeekQuickRange = useMemo(
    () =>
      buildDateRangeSelection({
        startDate: getWeekSelection("next").weekStart,
        endDate: getWeekSelection("next").weekEnd,
        minDate: MIN_DASHBOARD_DATE,
      }),
    []
  );
  const isLastWeekSelected = dateFilterMode === "last-week";
  const isCurrentWeekSelected = dateFilterMode === "current-week";
  const isNextWeekSelected = dateFilterMode === "next-week";
  const isCustomRangeSelected = dateFilterMode === "custom";

  const setPeriodLoadingState = (setter, period, value) => {
    setter((current) => ({ ...current, [period]: value }));
  };

  const setPeriodErrorState = (setter, period, value) => {
    setter((current) => ({ ...current, [period]: value }));
  };

  const setPeriodDataState = (setter, period, value) => {
    setter((current) => ({ ...current, [period]: value }));
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      setThemeMode(storedTheme);
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setThemeMode(prefersDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.setAttribute("data-theme", themeMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  const productionSubtitle = useMemo(
    () =>
      [
        "ACD productivity",
        `${getAcdTimeViewLabel(acdTimeView)} ${getAcdViewLabel(acdViewType)}`,
        acdMetricsData?.latestWorkDate ? `Latest synced work date ${formatDateLabel(acdMetricsData.latestWorkDate)}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    [acdMetricsData, acdTimeView, acdViewType]
  );
  const analyticsSubtitle = useMemo(() => buildAnalyticsSubtitle(analyticsData), [analyticsData]);
  const dashboardIsRefreshing =
    Boolean(dashboardLoadingMessage) ||
    cacheRefreshing ||
    (activeView === "overview" && (overviewLoading || leadershipOverviewLoading)) ||
    (activeView === "leadership-overview" && leadershipOverviewLoading);

  const handleRefreshCache = useCallback(async () => {
    if (cacheRefreshing) return;
    setCacheRefreshing(true);
    try {
      await fetch("/api/dashboard/refresh-cache", { method: "POST", cache: "no-store" });
      // Bump nonce → triggers all data-fetching useEffects to re-run with empty caches
      setRefreshNonce((n) => n + 1);
    } catch {
      // Ignore — data will still load on next natural expiry
    } finally {
      setCacheRefreshing(false);
    }
  }, [cacheRefreshing]);

  useEffect(() => {
    if (activeView !== "overview") {
      return undefined;
    }

    let cancelled = false;
    const rangeSelection = buildDateRangeSelection(dashboardDateRange);
    const cacheKey = `overview:${rangeSelection.startDate}:${rangeSelection.endDate}:${includeNewShowsPod ? "with-new" : "bau"}`;

    const cachedPayload = readClientCache(cacheKey);
    if (cachedPayload) {
      setOverviewData(cachedPayload);
      setOverviewLoading(false);
      setOverviewError("");
    }

    async function loadOverviewSection({ forceLoading = false } = {}) {
      setDashboardLoadingMessage("Refreshing Overview…");
      if (forceLoading || (!overviewData && !cachedPayload)) {
        setOverviewLoading(true);
      }
      setOverviewError("");

      try {
        const overviewResponse = await fetch(
          `/api/dashboard/overview?startDate=${encodeURIComponent(rangeSelection.startDate)}&endDate=${encodeURIComponent(rangeSelection.endDate)}&includeNewShowsPod=${includeNewShowsPod}`,
          { cache: "no-store" }
        );
        const overviewPayload = await readJson(overviewResponse);
        if (!overviewResponse.ok) {
          throw new Error(overviewPayload.liveTabError || overviewPayload.error || "Unable to load Overview metrics.");
        }

        if (!cancelled) {
          setOverviewData(overviewPayload);
          setOverviewLoading(false);
          setDashboardLoadingMessage("");
          writeClientCache(cacheKey, overviewPayload);
        }
      } catch (error) {
        if (!cancelled) {
          if (!overviewData && !cachedPayload) {
            setOverviewError(error.message || "Unable to load Overview metrics.");
          }
          setOverviewLoading(false);
          setDashboardLoadingMessage("");
        }
      }
    }

    // Skip background re-fetch if cache is very fresh (tab switch within 5 min)
    if (!isCacheFreshEnoughToSkipRefetch(cacheKey)) {
      void loadOverviewSection({ forceLoading: !cachedPayload && !overviewData });
    }

    // Fetch detailed overview rows (filtered by dateSubmittedByLead)
    async function loadOverviewDetail() {
      setOverviewDetailLoading(true);
      try {
        const res = await fetch(
          `/api/dashboard/overview-detail?startDate=${encodeURIComponent(rangeSelection.startDate)}&endDate=${encodeURIComponent(rangeSelection.endDate)}`,
          { cache: "no-store" }
        );
        const payload = await readJson(res);
        if (!cancelled) setOverviewDetailRows(payload.rows || []);
      } catch {
        if (!cancelled) setOverviewDetailRows([]);
      } finally {
        if (!cancelled) setOverviewDetailLoading(false);
      }
    }
    void loadOverviewDetail();

    const intervalId = window.setInterval(() => {
      void loadOverviewSection({ forceLoading: false });
    }, DASHBOARD_CLIENT_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeView, dashboardDateRange, includeNewShowsPod, refreshNonce]);

  useEffect(() => {
    if (activeView !== "leadership-overview" && activeView !== "overview") {
      return undefined;
    }

    let cancelled = false;
    const rangeSelection = buildDateRangeSelection(dashboardDateRange);
    const cacheKey = `leadership-overview:${rangeSelection.startDate}:${rangeSelection.endDate}:include-gu-${includeGuAssets ? "1" : "0"}`;

    const cachedPayload = readClientCache(cacheKey);
    if (cachedPayload) {
      setLeadershipOverviewData(cachedPayload);
      setLeadershipOverviewLoading(false);
      setLeadershipOverviewError("");
    }

    async function loadLeadershipOverview({ forceLoading = false } = {}) {
      setDashboardLoadingMessage("Refreshing Overview…");
      if (forceLoading || (!leadershipOverviewData && !cachedPayload)) {
        setLeadershipOverviewLoading(true);
      }
      setLeadershipOverviewError("");

      try {
        const response = await fetch(`/api/dashboard/leadership-overview?startDate=${encodeURIComponent(rangeSelection.startDate)}&endDate=${encodeURIComponent(rangeSelection.endDate)}&includeGuAssets=${includeGuAssets ? "true" : "false"}`, {
          cache: "no-store",
        });
        const payload = await readJson(response);
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load Overview.");
        }

        if (!cancelled) {
          setLeadershipOverviewData(payload);
          setLeadershipOverviewLoading(false);
          setDashboardLoadingMessage("");
          writeClientCache(cacheKey, payload);
        }
      } catch (error) {
        if (!cancelled) {
          if (!leadershipOverviewData && !cachedPayload) {
            setLeadershipOverviewError(error?.message || "Unable to load Overview.");
          }
          setLeadershipOverviewLoading(false);
          setDashboardLoadingMessage("");
        }
      }
    }

    // Skip background re-fetch if cache is very fresh (tab switch within 5 min)
    if (!isCacheFreshEnoughToSkipRefetch(cacheKey)) {
      void loadLeadershipOverview({ forceLoading: !cachedPayload && !leadershipOverviewData });
    }
    const intervalId = window.setInterval(() => {
      void loadLeadershipOverview({ forceLoading: false });
    }, DASHBOARD_CLIENT_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeView, dashboardDateRange, includeGuAssets, refreshNonce]);


  useEffect(() => {
    if (activeView !== "pod-wise" || podWiseView !== "performance") {
      return undefined;
    }

    let cancelled = false;
    const rangeSelection = buildDateRangeSelection(dashboardDateRange);
    const cacheKey = `pod-wise-performance:${podPerformanceRangeMode}:${podPerformanceScope}:${rangeSelection.startDate}:${rangeSelection.endDate}`;
    const cachedPayload = readClientCache(cacheKey);
    if (cachedPayload) {
      setCompetitionData(cachedPayload);
      setCompetitionLoading(false);
    }

    async function loadCompetition({ forceLoading = false } = {}) {
      setDashboardLoadingMessage("Refreshing Pod Wise…");
      if (forceLoading || (!competitionData && !cachedPayload)) {
        setCompetitionLoading(true);
      }
      try {
        const response = await fetch(
          podPerformanceRangeMode === "lifetime"
            ? `/api/dashboard/competition?mode=lifetime&scope=${encodeURIComponent(podPerformanceScope)}`
            : `/api/dashboard/competition?startDate=${encodeURIComponent(rangeSelection.startDate)}&endDate=${encodeURIComponent(rangeSelection.endDate)}&scope=${encodeURIComponent(podPerformanceScope)}`,
          { cache: "no-store" }
        );
        const payload = await readJson(response);
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load competition data.");
        }

        if (!cancelled) {
          setCompetitionData(payload);
          setDashboardLoadingMessage("");
          writeClientCache(cacheKey, payload);
        }
      } catch {
        if (!cancelled) {
          if (!competitionData && !cachedPayload) {
            setCompetitionData(null);
          }
        }
      } finally {
        if (!cancelled) {
          setCompetitionLoading(false);
          setDashboardLoadingMessage("");
        }
      }
    }

    void loadCompetition({ forceLoading: !cachedPayload && !competitionData });
    const intervalId = window.setInterval(() => {
      void loadCompetition({ forceLoading: false });
    }, DASHBOARD_CLIENT_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeView, podWiseView, dashboardDateRange, podPerformanceRangeMode, podPerformanceScope, refreshNonce]);


  useEffect(() => {
    if (activeView !== "pod-wise" || podWiseView !== "tasks") {
      return undefined;
    }
    if (podTasksData) {
      return undefined;
    }

    let cancelled = false;

    async function loadPodTasks() {
      setDashboardLoadingMessage("Refreshing Pod Tasks…");
      setPodTasksLoading(true);
      try {
        const response = await fetch("/api/dashboard/pod-tasks", { cache: "no-store" });
        const payload = await readJson(response);
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load POD tasks.");
        }
        if (!cancelled) {
          setPodTasksData(payload);
          setDashboardLoadingMessage("");
        }
      } catch {
        if (!cancelled) {
          setPodTasksData(null);
        }
      } finally {
        if (!cancelled) {
          setPodTasksLoading(false);
          setDashboardLoadingMessage("");
        }
      }
    }

    void loadPodTasks();
    return () => {
      cancelled = true;
    };
  }, [activeView, podWiseView, podTasksData]);

  useEffect(() => {
    if (activeView !== "pod-wise") return undefined;
    if (podTrendData) return undefined;
    let cancelled = false;
    async function loadPodTrend() {
      setPodTrendLoading(true);
      try {
        const response = await fetch("/api/dashboard/pod-trend", { cache: "no-store" });
        const payload = await readJson(response);
        if (!cancelled) setPodTrendData(payload);
      } catch {
        if (!cancelled) setPodTrendData(null);
      } finally {
        if (!cancelled) setPodTrendLoading(false);
      }
    }
    void loadPodTrend();
    return () => { cancelled = true; };
  }, [activeView, podTrendData]);

  useEffect(() => {
    if (activeView !== "planner2") {
      return undefined;
    }

    let cancelled = false;
    const rangeSelection = buildDateRangeSelection(dashboardDateRange);
    const cacheKey = `planner2:${rangeSelection.startDate}:${rangeSelection.endDate}`;
    const cachedPayload = readClientCache(cacheKey);
    if (cachedPayload) {
      setPlanner2Data(cachedPayload);
      setPlanner2Loading(false);
      setPlanner2Error("");
    }

    async function loadPlanner2({ forceLoading = false } = {}) {
      setDashboardLoadingMessage("Refreshing Planner…");
      if (forceLoading || (!planner2Data && !cachedPayload)) {
        setPlanner2Loading(true);
      }
      setPlanner2Error("");

      try {
        const response = await fetch(
          `/api/dashboard/planner2?startDate=${encodeURIComponent(rangeSelection.startDate)}&endDate=${encodeURIComponent(rangeSelection.endDate)}`,
          { cache: "no-store" }
        );
        const payload = await readJson(response);
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || "Unable to load Planner2.");
        }

        if (!cancelled) {
          setPlanner2Data(payload);
          setDashboardLoadingMessage("");
          writeClientCache(cacheKey, payload);
        }
      } catch (error) {
        if (!cancelled) {
          if (!planner2Data && !cachedPayload) {
            setPlanner2Data({
              ok: true,
              weekLabel: formatWeekRangeLabel(rangeSelection.startDate, rangeSelection.endDate),
              lastUpdatedAt: new Date().toISOString(),
              totals: { committedTaskCount: 18, completedTaskCount: 9, laggingTaskCount: 9 },
              ownerRows: [
                { ownerName: "Owner A", podLeadName: "Woodward", committedTaskCount: 5, completedTaskCount: 3, laggingTaskCount: 2, activeDays: 4 },
                { ownerName: "Owner B", podLeadName: "Berman", committedTaskCount: 4, completedTaskCount: 1, laggingTaskCount: 3, activeDays: 4 },
              ],
              dayRows: [
                { date: rangeSelection.startDate, items: [{ committedTaskCount: 6, completedTaskCount: 2, laggingTaskCount: 4 }] },
                { date: rangeSelection.endDate, items: [{ committedTaskCount: 4, completedTaskCount: 3, laggingTaskCount: 1 }] },
              ],
            });
            setPlanner2Error(`Demo mode: ${error.message || "Unable to load Planner2."}`);
          }
        }
      } finally {
        if (!cancelled) {
          setPlanner2Loading(false);
          setDashboardLoadingMessage("");
        }
      }
    }

    void loadPlanner2({ forceLoading: !cachedPayload && !planner2Data });
    const intervalId = window.setInterval(() => {
      void loadPlanner2({ forceLoading: false });
    }, DASHBOARD_CLIENT_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeView, dashboardDateRange, refreshNonce]);


  async function requestAcdMetrics(cancelState = null) {
    if (!cancelState?.cancelled) {
      setAcdMetricsLoading(true);
      setDashboardLoadingMessage("Refreshing ACD productivity…");
      setAcdMetricsError("");
    }

    try {
      const response = await fetch("/api/acd-metrics", { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load ACD productivity.");
      }

      if (!cancelState?.cancelled) {
        setAcdMetricsData(payload);
        setDashboardLoadingMessage("");
      }

      return payload;
    } catch (error) {
      if (!cancelState?.cancelled) {
        setAcdMetricsError(error.message || "Unable to load ACD productivity.");
      }
      throw error;
    } finally {
      if (!cancelState?.cancelled) {
        setAcdMetricsLoading(false);
        setDashboardLoadingMessage("");
      }
    }
  }

  async function ensureEditAccess() {
    const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
    const sessionPayload = await readJson(sessionResponse);

    if (!sessionResponse.ok) {
      throw new Error(sessionPayload.error || "Unable to verify sync access.");
    }

    if (sessionPayload.unlocked) {
      return true;
    }

    if (sessionPayload.configured === false) {
      throw new Error("Edit access is not configured right now.");
    }

    const password = window.prompt("Enter the edit password");
    if (!password) {
      return false;
    }

    const unlockResponse = await fetch("/api/auth/unlock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });
    const unlockPayload = await readJson(unlockResponse);

    if (!unlockResponse.ok) {
      throw new Error(unlockPayload.error || "Incorrect password.");
    }

    return true;
  }

  useEffect(() => {
    const isCdsPerformance = activeView === "pod-wise" && performanceSubView === "cds";
    if (activeView !== "production" && activeView !== "details" && activeView !== "overview" && activeView !== "leadership-overview" && !isCdsPerformance) {
      return undefined;
    }
    if (acdMetricsData) {
      return undefined;
    }

    const cancelState = { cancelled: false };
    void requestAcdMetrics(cancelState);
    return () => {
      cancelState.cancelled = true;
    };
  }, [activeView, performanceSubView, acdMetricsData]);

  useEffect(() => {
    const isCdsPerformance = activeView === "pod-wise" && performanceSubView === "cds";
    if (activeView !== "production" && !isCdsPerformance) return undefined;
    let cancelled = false;
    setDashboardLoadingMessage("Refreshing Production…");
    setProductionPipelineLoading(true);
    fetch("/api/dashboard/production", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setProductionPipelineData(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) { setProductionPipelineLoading(false); setDashboardLoadingMessage(""); } });
    return () => { cancelled = true; };
  }, [activeView, performanceSubView, refreshNonce]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function copySection(node, label) {
    setCopyingSection(label);

    try {
      await copyNodeImageToClipboard(
        node,
        label === "Production troubleshooting"
          ? { captureMode: "production-troubleshooting" }
          : undefined
      );
      setNotice({ tone: "success", text: "Copied to clipboard." });
    } catch (error) {
      setNotice({ tone: "error", text: error.message || `Unable to copy ${label}.` });
    } finally {
      setCopyingSection((current) => (current === label ? "" : current));
    }
  }

  async function updateAnalyticsActioned(row, actioned) {
    const assetCode = String(row?.assetCode || "").trim();
    const weekKey = String(row?.analyticsWeekKey || analyticsData?.selectedWeekKey || "").trim();
    const busyKey = `${weekKey}:${assetCode}`;

    if (!assetCode || !weekKey) {
      setNotice({ tone: "error", text: "Missing asset code or week for Actioned." });
      return;
    }

    const canEdit = await ensureEditAccess().catch((error) => {
      setNotice({ tone: "error", text: error.message || "Unable to unlock edits." });
      return false;
    });

    if (!canEdit) {
      return;
    }

    setAnalyticsActionedBusyKey(busyKey);

    try {
      const response = await fetch("/api/dashboard/analytics", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          weekKey,
          assetCode,
          actioned,
        }),
      });
      const payload = await readJson(response);

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Unable to update Actioned.");
      }

      setAnalyticsData((current) => {
        if (!current || !Array.isArray(current.rows)) {
          return current;
        }

        return {
          ...current,
          rows: current.rows.map((currentRow) =>
            String(currentRow?.assetCode || "").trim() === assetCode
              ? { ...currentRow, actioned }
              : currentRow
          ),
        };
      });
      setNotice({ tone: "success", text: actioned ? "Marked actioned." : "Returned to active queue." });
    } catch (error) {
      setNotice({ tone: "error", text: error.message || "Unable to update Actioned." });
    } finally {
      setAnalyticsActionedBusyKey("");
    }
  }

  async function runAcdSync() {
    const canRunSync = await ensureEditAccess().catch((error) => {
      setNotice({ tone: "error", text: error.message || "Unable to unlock sync." });
      return false;
    });

    if (!canRunSync) {
      return;
    }

    setBusyAction("acd-sync");
    try {
      const response = await fetch("/api/acd-live-sync", {
        method: "POST",
        cache: "no-store",
      });
      const payload = await readJson(response);

      if (!response.ok || payload.ok === false || payload.schemaReady === false) {
        throw new Error(payload.error || "ACD daily sync failed.");
      }

      await requestAcdMetrics();
      setNotice({
        tone: "success",
        text: `ACD sync complete. Eligible: ${formatNumber(payload.eligibleLiveRows)} | Sheets attempted: ${formatNumber(
          payload.sheetLinksAttempted
        )} | Failed: ${formatNumber(payload.sheetLinksFailed)}`,
      });
    } catch (error) {
      setNotice({ tone: "error", text: error.message || "ACD daily sync failed." });
    } finally {
      setBusyAction("");
    }
  }

  const activeViewLabelMap = {
    "leadership-overview": "Overview",
    overview: "Editorial Funnel",
    "pod-wise": performanceSubView === "cds" ? "CDs Performance" : "PODs Performance",
    planner: "Planner",
    planner2: "Planner",
    analytics: "Analytics",
    production: "Production Pipeline",
    suggestions: "Suggestions",
    "lifetime-angle": "Lifetime Angle Lifecycle",
    reports: "WIP",
    details: "Details",
  };



  return (
    <>
      <div className="app-shell">
        <nav className="sidebar" aria-label="Dashboard navigation">
          <div className="sidebar-brand">
            <span className="sidebar-brand-name">Fresh Takes</span>
            <span className="sidebar-brand-sub">Pocket FM</span>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-label">VIEWS</div>
	            <div className="sidebar-more-items">
	              {[
	                ["overview", "Editorial Funnel"],
	              ].map(([id, label]) => (
	                <button
	                  key={id}
	                  type="button"
                  className={`sidebar-link${activeView === id ? " active" : ""}`}
                  onClick={() => setActiveView(id)}
                >
                  {label}
                </button>
              ))}

              {[["pods", "PODs Performance"], ["cds", "CDs Performance"]].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`sidebar-link${activeView === "pod-wise" && performanceSubView === id ? " active" : ""}`}
                  onClick={() => { setActiveView("pod-wise"); setPerformanceSubView(id); }}
                >
                  {label}
                </button>
              ))}

              <button
                type="button"
                className={`sidebar-link${activeView === "production" ? " active" : ""}`}
                onClick={() => { setActiveView("production"); setProductionSubView("pipeline"); }}
              >
                Production Pipeline
              </button>

              <button
                type="button"
                className={`sidebar-link${activeView === "suggestions" ? " active" : ""}`}
                onClick={() => setActiveView("suggestions")}
              >
                Suggestions
              </button>

              {/* More toggle */}
              <button
                type="button"
                onClick={() => setMoreExpanded((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, color: "var(--subtle)",
                  padding: "4px 0", letterSpacing: "0.04em", textTransform: "uppercase",
                  marginTop: 4,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: moreExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                  <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {moreExpanded ? "Hide" : "More"}
              </button>

              {moreExpanded && (
                <>
                  <button
                    type="button"
                    className={`sidebar-link${activeView === "lifetime-angle" ? " active" : ""}`}
                    onClick={() => setActiveView("lifetime-angle")}
                  >
                    Lifetime Angle Lifecycle
                  </button>
                  <button
                    type="button"
                    className={`sidebar-link${activeView === "reports" ? " active" : ""}`}
                    onClick={() => setActiveView("reports")}
                  >
                    WIP
                  </button>
                  <button
                    type="button"
                    className={`sidebar-link${activeView === "planner2" ? " active" : ""}`}
                    onClick={() => setActiveView("planner2")}
                  >
                    Planner
                  </button>
                </>
              )}
            </div>
          </div>


        </nav>

        <main className="ops-main">
          <div className="app-topbar">
            <div className={`topbar-progress${dashboardIsRefreshing ? " is-active" : ""}`} aria-hidden="true" />
            <div className="app-topbar-left">
              <h1 className="app-topbar-title">{activeViewLabelMap[activeView] || "Dashboard"}</h1>
            </div>
            <div className="app-topbar-right">
              {headerSupportsDateRange ? (
                <div className="app-topbar-range" data-share-ignore="true">
                  <div
                    ref={weekDropdownRef}
                    className={`week-picker-wrap${headerDateRangeUsesWeekPreset ? " is-active" : ""}${weekDropdownOpen ? " is-open" : ""}`}
                  >
                    <span className="app-topbar-date-label">Filter by week</span>
                    <button
                      type="button"
                      className="week-picker-trigger"
                      disabled={headerDateRangeDisabled}
                      onClick={() => setWeekDropdownOpen((v) => !v)}
                      aria-haspopup="listbox"
                      aria-expanded={weekDropdownOpen}
                    >
                      <svg className="week-picker-cal-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.25"/>
                        <path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.25"/>
                        <path d="M5 1.5v2M11 1.5v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                        <circle cx="5.5" cy="9.5" r="0.8" fill="currentColor"/>
                        <circle cx="8" cy="9.5" r="0.8" fill="currentColor"/>
                        <circle cx="10.5" cy="9.5" r="0.8" fill="currentColor"/>
                      </svg>
                      <span className="week-picker-label" suppressHydrationWarning>
                        {selectedMonthWeekOption ? `${selectedMonthWeekOption.rangeLabel || selectedMonthWeekOption.label} (Sun–Sat)` : "Select week"}
                      </span>
                      <svg className="week-picker-chevron" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {weekDropdownOpen && (
                      <div className="week-picker-panel" role="listbox" aria-label="Select week">
                        {(() => {
                          const groups = [];
                          let currentGroup = null;
                          for (const option of monthWeekOptions) {
                            if (!currentGroup || currentGroup.monthKey !== option.monthKey) {
                              currentGroup = { monthKey: option.monthKey, label: option.label.replace(/\s+week\s+\d+$/i, ""), options: [] };
                              groups.push(currentGroup);
                            }
                            currentGroup.options.push(option);
                          }
                          return groups.map((group) => (
                            <div key={group.monthKey} className="week-picker-group">
                              <div className="week-picker-month-header">{group.label}</div>
                              {group.options.map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  role="option"
                                  aria-selected={option.id === weekFilterSelection}
                                  className={`week-picker-option${option.id === weekFilterSelection ? " is-selected" : ""}`}
                                  onClick={() => {
                                    setWeekFilterSelection(option.id);
                                    setDashboardDateRange(
                                      buildDateRangeSelection({
                                        startDate: option.weekStart,
                                        endDate: option.weekEnd,
                                        minDate: MIN_DASHBOARD_DATE,
                                      })
                                    );
                                    setWeekDropdownOpen(false);
                                  }}
                                >
                                  <svg className="week-picker-check" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                                    <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  <span>{option.rangeLabel ? `${option.rangeLabel} (Sun–Sat)` : option.label}</span>
                                </button>
                              ))}
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                <span className="topbar-range-divider" aria-hidden="true">|</span>
                <div className={`date-field-wrap${headerDateRangeUsesManualDates ? " is-active" : ""}`}>
                  <span className="app-topbar-date-label">Start date</span>
                  <button
                    type="button"
                    className="date-field-trigger"
                    disabled={headerDateRangeDisabled}
                    onClick={() => {
                      try { startDateRef.current?.showPicker(); } catch { startDateRef.current?.click(); }
                    }}
                  >
                    <svg className="date-field-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.25"/>
                      <path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.25"/>
                      <path d="M5 1.5v2M11 1.5v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                    </svg>
                    <span className="date-field-display" suppressHydrationWarning>{formatDisplayDate(normalizedHeaderRange.startDate)}</span>
                  </button>
                  <input
                    ref={startDateRef}
                    type="date"
                    className="date-field-hidden-input"
                    min={MIN_DASHBOARD_DATE}
                    max={normalizedHeaderRange.endDate}
                    value={normalizedHeaderRange.startDate}
                    disabled={headerDateRangeDisabled}
                    onChange={(event) => {
                      setDashboardDateRange((current) =>
                        buildDateRangeSelection({
                          startDate: event.target.value,
                          endDate: current?.endDate || normalizedHeaderRange.endDate,
                          minDate: MIN_DASHBOARD_DATE,
                        })
                      );
                    }}
                  />
                </div>
                <div className={`date-field-wrap${headerDateRangeUsesManualDates ? " is-active" : ""}`}>
                  <span className="app-topbar-date-label">End date</span>
                  <button
                    type="button"
                    className="date-field-trigger"
                    disabled={headerDateRangeDisabled}
                    onClick={() => {
                      try { endDateRef.current?.showPicker(); } catch { endDateRef.current?.click(); }
                    }}
                  >
                    <svg className="date-field-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.25"/>
                      <path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.25"/>
                      <path d="M5 1.5v2M11 1.5v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                    </svg>
                    <span className="date-field-display" suppressHydrationWarning>{formatDisplayDate(normalizedHeaderRange.endDate)}</span>
                  </button>
                  <input
                    ref={endDateRef}
                    type="date"
                    className="date-field-hidden-input"
                    min={normalizedHeaderRange.startDate || MIN_DASHBOARD_DATE}
                    value={normalizedHeaderRange.endDate}
                    disabled={headerDateRangeDisabled}
                    onChange={(event) => {
                      setDashboardDateRange((current) =>
                        buildDateRangeSelection({
                          startDate: current?.startDate || normalizedHeaderRange.startDate,
                          endDate: event.target.value,
                          minDate: MIN_DASHBOARD_DATE,
                        })
                      );
                    }}
                  />
                </div>
                <div className="app-topbar-range-note" suppressHydrationWarning>
                  {`Selected date range ${formatWeekRangeLabel(normalizedHeaderRange.startDate, normalizedHeaderRange.endDate)}`}
                </div>
              </div>
            ) : null}
            </div>
            <div className="app-topbar-end">
              <button
                type="button"
                className={`topbar-sync-btn${cacheRefreshing ? " is-spinning" : ""}`}
                onClick={handleRefreshCache}
                disabled={cacheRefreshing}
                title="Sync — fetches latest data from Google Sheets, bypassing cache"
                aria-label="Sync data from Google Sheets"
              >
                <svg className="topbar-sync-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M13.65 2.35A8 8 0 1 0 15 8h-2a6 6 0 1 1-1.76-4.24L9 6h6V0l-1.35 2.35Z" fill="currentColor"/>
                </svg>
                <span>{cacheRefreshing ? "Syncing…" : "Sync"}</span>
              </button>
              <label className="theme-switch" aria-label="Toggle dark mode">
                <input
                  type="checkbox"
                  role="switch"
                  checked={themeMode === "dark"}
                  onChange={(event) => setThemeMode(event.target.checked ? "dark" : "light")}
                />
                <span className="theme-switch-track" aria-hidden="true">
                  <span className="theme-switch-thumb" />
                </span>
              </label>
            </div>
          </div>

          <div className={`ops-shell ${dashboardIsRefreshing ? "is-refreshing" : ""}`}>
            {activeView === "leadership-overview" ? (
              <div className="section-shell">
                <LeadershipOverviewContent
                  leadershipOverviewData={leadershipOverviewData}
                  leadershipOverviewLoading={leadershipOverviewLoading}
                  leadershipOverviewError={leadershipOverviewError}
                  onNavigate={setActiveView}
                  acdMetricsData={acdMetricsData}
                  acdMetricsLoading={acdMetricsLoading}
                />
              </div>
            ) : null}

            {activeView === "overview" ? (
              <div className="section-shell">
                <OverviewContent
                  overviewData={overviewData}
                  overviewLoading={overviewLoading}
                  overviewError={overviewError}
                  leadershipOverviewData={leadershipOverviewData}
                  leadershipOverviewLoading={leadershipOverviewLoading}
                  onShare={copySection}
                  copyingSection={copyingSection}
                  includeNewShowsPod={includeNewShowsPod}
                  onIncludeNewShowsPodChange={setIncludeNewShowsPod}
                  detailRows={overviewDetailRows}
                  detailLoading={overviewDetailLoading}
                />
              </div>
            ) : null}


            {activeView === "pod-wise" && performanceSubView === "cds" ? (
              <div className="section-shell">
                <ProductionContent
                  acdMetricsData={acdMetricsData}
                  acdMetricsLoading={acdMetricsLoading}
                  acdMetricsError={acdMetricsError}
                  productionPipelineData={productionPipelineData}
                  productionPipelineLoading={productionPipelineLoading}
                  acdTimeView={acdTimeView}
                  onTimeViewChange={setAcdTimeView}
                  acdViewType={acdViewType}
                  onViewTypeChange={setAcdViewType}
                  onRunSync={runAcdSync}
                  busyAction={busyAction}
                  onShare={copySection}
                  copyingSection={copyingSection}
                  productionSubView="throughput"
                />
              </div>
            ) : null}

            {activeView === "pod-wise" && performanceSubView === "pods" ? (
              <div className="section-shell">
                <PodWiseContent
                  competitionPodRows={competitionData?.podRows}
                  analyticsRows={analyticsData?.rows || []}
                  competitionLoading={competitionLoading}
                  competitionWeekLabel={competitionData?.weekLabel}
                  performanceRangeMode={podPerformanceRangeMode}
                  onPerformanceRangeModeChange={setPodPerformanceRangeMode}
                  performanceScope={podPerformanceScope}
                  onPerformanceScopeChange={setPodPerformanceScope}
                  podTrendData={podTrendData}
                  podTrendLoading={podTrendLoading}
                  onShare={copySection}
                  copyingSection={copyingSection}
                />
              </div>
            ) : null}


            {activeView === "planner" ? (
              <div className="section-shell">
                <PlannerErrorBoundary>
                  <GanttTracker onPlannerSnapshotChange={setPlannerBoardSnapshot} />
                </PlannerErrorBoundary>
              </div>
            ) : null}

            {activeView === "planner2" ? (
              <div className="section-shell">
                <Planner2Content
                  planner2Data={planner2Data}
                  planner2Loading={planner2Loading}
                  planner2Error={planner2Error}
                  onShare={copySection}
                  copyingSection={copyingSection}
                />
              </div>
            ) : null}

            {activeView === "suggestions" ? (
              <div className="section-shell" style={{ display: "flex", flexDirection: "column", overflow: "hidden", padding: 0, height: "100%" }}>
                <SuggestionsContent />
              </div>
            ) : null}

            {activeView === "lifetime-angle" ? (
              <div className="section-shell" style={{ overflowY: "auto" }}>
                <LifetimeAngleContent />
              </div>
            ) : null}

            {activeView === "reports" ? (
              <div className="section-shell">
                <ReportsContent
                  detailRows={overviewDetailRows}
                  detailLoading={overviewDetailLoading}
                  leadershipOverviewData={leadershipOverviewData}
                  leadershipOverviewLoading={leadershipOverviewLoading}
                  overviewData={overviewData}
                  overviewLoading={overviewLoading}
                />
              </div>
            ) : null}




            {activeView === "production" ? (
              <div className="section-shell">
                <ProductionContent
                  acdMetricsData={acdMetricsData}
                  acdMetricsLoading={acdMetricsLoading}
                  acdMetricsError={acdMetricsError}
                  productionPipelineData={productionPipelineData}
                  productionPipelineLoading={productionPipelineLoading}
                  acdTimeView={acdTimeView}
                  onTimeViewChange={setAcdTimeView}
                  acdViewType={acdViewType}
                  onViewTypeChange={setAcdViewType}
                  onRunSync={runAcdSync}
                  busyAction={busyAction}
                  onShare={copySection}
                  copyingSection={copyingSection}
                  productionSubView={productionSubView}
                />
              </div>
            ) : null}

            {activeView === "details" ? (
              <div className="section-shell">
                <DetailsContent
                  acdMetricsData={acdMetricsData}
                  acdMetricsLoading={acdMetricsLoading}
                  acdMetricsError={acdMetricsError}
                  analyticsData={analyticsData}
                />
              </div>
            ) : null}
          </div>
        </main>
      </div>

      <Notice notice={notice} />
    </>
  );
}
